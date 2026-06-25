"""Nature source extraction helpers and adapter."""

from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import json
import re
from typing import Dict, List, Optional
from urllib.parse import urlencode, urlparse
import urllib.request

from ..models import PaperLink, PaperRecord, RetrievalEvidence, SourceProvenance
from ..pdf import classify_pdf_url, find_pdf_links
from .base import PaperSourceAdapter, SourceCapabilities


class _MetaLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: Dict[str, List[str]] = {}
        self.links: List[Dict[str, str]] = []
        self.anchor_stack: List[Dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        attr = {key.lower(): value or "" for key, value in attrs}
        if tag.lower() == "meta":
            key = attr.get("name") or attr.get("property")
            content = attr.get("content", "")
            if key and content:
                self.meta.setdefault(key.lower(), []).append(unescape(content.strip()))
        elif tag.lower() == "a":
            self.anchor_stack.append({"href": attr.get("href", ""), "text": ""})

    def handle_data(self, data: str) -> None:
        if self.anchor_stack:
            self.anchor_stack[-1]["text"] += data

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self.anchor_stack:
            link = self.anchor_stack.pop()
            self.links.append({"href": link.get("href", ""), "text": " ".join(link.get("text", "").split())})


def _first(meta: Dict[str, List[str]], *keys: str) -> str:
    for key in keys:
        values = meta.get(key.lower())
        if values:
            return values[0]
    return ""


def _all(meta: Dict[str, List[str]], *keys: str) -> List[str]:
    result: List[str] = []
    seen = set()
    for key in keys:
        for value in meta.get(key.lower(), []):
            if value not in seen:
                result.append(value)
                seen.add(value)
    return result


def _year_from_date(value: str) -> str:
    match = re.search(r"\b(19|20)\d{2}\b", value or "")
    return match.group(0) if match else ""


def extract_nature_article_from_html(html: str, article_url: str) -> PaperRecord:
    parser = _MetaLinkParser()
    parser.feed(html or "")
    meta = parser.meta

    title = _first(meta, "citation_title", "dc.title", "og:title")
    authors = _all(meta, "citation_author", "dc.creator")
    venue = _first(meta, "citation_journal_title", "prism.publicationname") or "Nature"
    published_date = _first(meta, "citation_publication_date", "prism.publicationdate", "dc.date")
    doi = _first(meta, "citation_doi", "dc.identifier", "prism.doi")
    abstract = _first(meta, "description", "og:description", "dc.description")
    pdf_url = _first(meta, "citation_pdf_url")
    if not pdf_url:
        links = find_pdf_links(html, article_url)
        pdf_url = links[0] if links else ""

    record = PaperRecord(
        title=title or article_url,
        source="nature",
        url=article_url,
        authors=authors,
        venue=venue,
        year=_year_from_date(published_date),
        published_date=published_date,
        abstract=abstract,
        doi=doi,
        pdf_url=pdf_url,
        pdf_status=classify_pdf_url(pdf_url),
        provenance=[SourceProvenance(source="nature", url=article_url, evidence="article_page_meta")],
        retrieval_evidence=[RetrievalEvidence(source="nature", kind="html_meta", value="citation_*", url=article_url)],
    )
    if pdf_url:
        record.links.append(PaperLink(label="PDF", url=pdf_url, kind="pdf", status=record.pdf_status))
    if doi:
        record.links.append(PaperLink(label="DOI", url=f"https://doi.org/{doi}", kind="doi"))
    return record


def paper_from_nature_payload(payload: Dict, article_url: str) -> PaperRecord:
    pdf_url = payload.get("pdf_url", "")
    doi = payload.get("doi", "")
    if not doi:
        article_id = urlparse(article_url).path.rstrip("/").split("/")[-1]
        if article_id.startswith("s"):
            doi = f"10.1038/{article_id}"
    record = PaperRecord(
        title=payload.get("title", "") or article_url,
        source="nature",
        url=article_url,
        authors=payload.get("authors", []) or [],
        venue=payload.get("venue", "") or "Nature",
        year=_year_from_date(payload.get("published_date", "")),
        published_date=payload.get("published_date", ""),
        abstract=payload.get("abstract", ""),
        doi=doi,
        pdf_url=pdf_url,
        pdf_status=classify_pdf_url(pdf_url),
        provenance=[SourceProvenance(source="nature", url=article_url, evidence="article_page_meta")],
        retrieval_evidence=[RetrievalEvidence(source="nature", kind="browser_meta", value="citation_*", url=article_url)],
    )
    if pdf_url:
        record.links.append(PaperLink(label="PDF", url=pdf_url, kind="pdf", status=record.pdf_status))
    if record.doi:
        record.links.append(PaperLink(label="DOI", url=f"https://doi.org/{record.doi}", kind="doi"))
    return record


NATURE_ARTICLE_EXTRACT_JS = r"""
(() => {
  const metas = Array.from(document.querySelectorAll('meta'));
  const values = (key) => metas.filter((m) => (m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase() === key).map((m) => m.getAttribute('content') || '').filter(Boolean);
  const first = (...keys) => {
    for (const key of keys) {
      const found = values(key.toLowerCase());
      if (found.length) return found[0];
    }
    return '';
  };
  const pdf = first('citation_pdf_url') || (Array.from(document.links).map((a) => a.href).find((href) => /\.pdf(?:$|\?)/i.test(href)) || '');
  const heading = document.querySelector('h1');
  const title = first('citation_title', 'dc.title', 'og:title') || (heading ? heading.textContent.trim() : '') || document.title.replace(/\s*\|\s*Nature.*$/i, '').trim();
  const doiLink = Array.from(document.links).map((a) => a.href).find((href) => /doi\.org\/10\.1038\//i.test(href)) || '';
  return JSON.stringify({
    title: title,
    authors: values('citation_author').concat(values('dc.creator')),
    venue: first('citation_journal_title', 'prism.publicationname') || (document.title.match(/\|\s*([^|]+)$/) || [])[1] || '',
    published_date: first('citation_publication_date', 'prism.publicationdate', 'dc.date'),
    doi: first('citation_doi', 'prism.doi') || doiLink.replace(/^https?:\/\/doi\.org\//i, ''),
    abstract: first('description', 'og:description', 'dc.description'),
    pdf_url: pdf
  });
})()
"""


NATURE_SEARCH_EXTRACT_JS = r"""
(() => JSON.stringify(Array.from(document.querySelectorAll('article, li, .app-card, [data-test="article-item"]')).map((node) => {
  const link = node.querySelector('a[href*="/articles/"]');
  const title = link ? link.textContent.trim() : '';
  const href = link ? link.href : '';
  const text = node.textContent.replace(/\s+/g, ' ').trim();
  return {title, url: href, snippet: text.slice(0, 500)};
}).filter(item => item.title && item.url)))()
"""


def parse_nature_search_results(payload: str) -> List[PaperRecord]:
    try:
        data = json.loads(payload)
        if isinstance(data, str):
            data = json.loads(data)
    except Exception:
        return []
    records = []
    for item in data:
        record = PaperRecord(
            title=item.get("title", ""),
            source="nature",
            url=item.get("url", ""),
            snippet=item.get("snippet", ""),
            provenance=[SourceProvenance(source="nature", url=item.get("url", ""), evidence="search_result")],
        )
        records.append(record)
    return records


def fetch_nature_article_html(article_url: str, timeout: int = 30) -> str:
    request = urllib.request.Request(article_url, headers={"User-Agent": "paper-query/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", "ignore")


class NatureSource(PaperSourceAdapter):
    source_name = "nature"
    capabilities = SourceCapabilities(requires_browser=False, supports_pdf_resolution=True, supports_date_range=True)

    def is_direct_article_url(self, value: str) -> bool:
        parsed = urlparse(value or "")
        return parsed.netloc.endswith("nature.com") and "/articles/" in parsed.path

    def build_article_pdf_url(self, article_url: str) -> str:
        parsed = urlparse(article_url)
        path = parsed.path.rstrip("/")
        return f"{parsed.scheme}://{parsed.netloc}{path}.pdf"

    def build_search_url(self, request) -> str:
        query = request.query or " ".join(request.keywords)
        params = {"q": query, "order": "relevance"}
        if request.year_from:
            params["date_range"] = f"{request.year_from}-01-01:{request.year_to or request.year_from}-12-31"
        return f"https://www.nature.com/search?{urlencode(params)}"

    def search(self, request):
        from ..models import SourceResult

        if self.is_direct_article_url(request.query):
            article_url = request.query
            try:
                html = fetch_nature_article_html(article_url)
                record = extract_nature_article_from_html(html, article_url)
                if not record.pdf_url:
                    record.pdf_url = self.build_article_pdf_url(article_url)
                    record.pdf_status = "link_found"
                return SourceResult(source=self.source_name, papers=[record])
            except Exception:
                pass

            if not self.browser:
                record = PaperRecord(
                    title=article_url,
                    source="nature",
                    url=article_url,
                    pdf_url=self.build_article_pdf_url(article_url),
                    pdf_status="link_found",
                    provenance=[SourceProvenance(source="nature", url=article_url, evidence="direct_article_url")],
                )
                return SourceResult(source=self.source_name, papers=[record], manual_required=True)
            page = self.browser.open(article_url)
            if not page:
                return SourceResult(source=self.source_name, errors=["failed to open Nature article"], manual_required=True)
            try:
                self.browser.wait_until_ready(page, timeout_seconds=15)
                raw_payload = self.browser.evaluate(page, NATURE_ARTICLE_EXTRACT_JS) or "{}"
                try:
                    payload = json.loads(raw_payload)
                    if isinstance(payload, str):
                        payload = json.loads(payload)
                except Exception:
                    payload = {}
                record = paper_from_nature_payload(payload, article_url) if payload else extract_nature_article_from_html("", article_url)
                if not record.pdf_url:
                    record.pdf_url = self.build_article_pdf_url(article_url)
                    record.pdf_status = "link_found"
                return SourceResult(source=self.source_name, papers=[record])
            finally:
                self.browser.close(page)

        if not self.browser:
            return SourceResult(source=self.source_name, errors=["browser backend unavailable"], manual_required=True)
        page = self.browser.open(self.build_search_url(request))
        if not page:
            return SourceResult(source=self.source_name, errors=["failed to open Nature search"], manual_required=True)
        try:
            raw = self.browser.evaluate(page, NATURE_SEARCH_EXTRACT_JS) or "[]"
            return SourceResult(source=self.source_name, papers=parse_nature_search_results(raw))
        finally:
            self.browser.close(page)
