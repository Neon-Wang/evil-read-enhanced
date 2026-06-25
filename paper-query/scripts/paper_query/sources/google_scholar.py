"""Google Scholar source extraction helpers and adapter."""

from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import json
import re
from typing import Dict, List, Optional
from urllib.parse import urlencode

from ..models import PaperLink, PaperRecord, SourceProvenance
from ..pdf import classify_pdf_url
from .base import PaperSourceAdapter, SourceCapabilities


class _ScholarParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.stack: List[Dict[str, str]] = []
        self.items: List[Dict[str, str]] = []
        self.current: Optional[Dict[str, str]] = None
        self.current_field = ""
        self.current_link = ""
        self.div_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        attr = {key.lower(): value or "" for key, value in attrs}
        class_name = attr.get("class", "")
        class_tokens = set(class_name.split())
        if tag == "div" and "gs_r" in class_tokens:
            self.current = {"title": "", "url": "", "authors_raw": "", "snippet": "", "citationCount": "0", "pdf_url": ""}
            self.div_depth = 1
        elif tag == "div" and self.current is not None:
            self.div_depth += 1
        if self.current is None:
            return
        if tag == "h3" and "gs_rt" in class_name:
            self.current_field = "title"
        elif tag == "div" and "gs_a" in class_name:
            self.current_field = "authors_raw"
        elif tag == "div" and "gs_rs" in class_name:
            self.current_field = "snippet"
        elif tag == "a":
            href = attr.get("href", "")
            self.current_link = href
            if href.lower().endswith(".pdf") or ".pdf" in href.lower():
                self.current["pdf_url"] = href
            if self.current_field == "title" and href:
                self.current["url"] = href

    def handle_data(self, data: str) -> None:
        if self.current is None:
            return
        text = unescape(data.strip())
        if not text:
            return
        if self.current_field in {"title", "authors_raw", "snippet"}:
            self.current[self.current_field] = (self.current.get(self.current_field, "") + " " + text).strip()
        cited = re.search(r"Cited by\s+(\d+)", text, re.IGNORECASE)
        if cited:
            self.current["citationCount"] = cited.group(1)

    def handle_endtag(self, tag: str) -> None:
        if tag == "h3" and self.current_field == "title":
            self.current_field = ""
            return
        if tag != "div" or self.current is None:
            return
        if self.current_field in {"authors_raw", "snippet"}:
            self.current_field = ""
        self.div_depth -= 1
        if self.div_depth <= 0:
            if self.current.get("title") and (self.current.get("url") or self.current.get("snippet")):
                self.items.append(self.current)
            self.current = None
            self.current_field = ""


def parse_authors_raw(raw: str):
    parts = re.split(r"\s*[\-–—]+\s*", raw or "")
    authors = [part.strip() for part in parts[0].split(",") if part.strip() and part.strip() not in {"…", "..."}] if parts else []
    venue = ""
    year = ""
    if len(parts) >= 2:
        venue_year = parts[1].strip()
        match = re.search(r"\b(19|20)\d{2}\b", venue_year)
        if match:
            year = match.group(0)
            venue = venue_year[:match.start()].rstrip(", ").strip()
        else:
            venue = venue_year
    return authors, venue, year


def _records_from_items(items: List[Dict[str, str]], source_url: str) -> List[PaperRecord]:
    records = []
    for item in items:
        authors, venue, year = parse_authors_raw(item.get("authors_raw", ""))
        pdf_url = item.get("pdf_url", "")
        record = PaperRecord(
            title=item.get("title", "").replace("[PDF]", "").replace("[HTML]", "").strip(),
            source="google_scholar",
            url=item.get("url", ""),
            authors=authors,
            venue=venue,
            year=year,
            snippet=item.get("snippet", ""),
            citation_count=int(item.get("citationCount") or 0),
            pdf_url=pdf_url,
            pdf_status=classify_pdf_url(pdf_url),
            provenance=[SourceProvenance(source="google_scholar", url=source_url, evidence="search_result")],
        )
        if pdf_url:
            record.links.append(PaperLink(label="PDF", url=pdf_url, kind="pdf", status=record.pdf_status))
        records.append(record)
    return records


def extract_google_scholar_results(html_or_json: str, source_url: str = "") -> List[PaperRecord]:
    """Extract Google Scholar results from fixture HTML or JS JSON payload."""
    try:
        data = json.loads(html_or_json)
        if isinstance(data, str):
            data = json.loads(data)
        if isinstance(data, list):
            normalized = []
            for item in data:
                copied = dict(item)
                copied["citationCount"] = str(copied.get("citationCount", 0))
                normalized.append(copied)
            return _records_from_items(normalized, source_url)
    except Exception:
        pass

    parser = _ScholarParser()
    parser.feed(html_or_json or "")
    return _records_from_items(parser.items, source_url)


GOOGLE_SCHOLAR_EXTRACT_JS = r"""
(function() {
    var results = [];
    var items = document.querySelectorAll('.gs_r.gs_or.gs_scl');
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var ri = item.querySelector('.gs_ri') || item;
        var titleEl = ri.querySelector('h3.gs_rt');
        var title = '';
        var url = '';
        if (titleEl) {
            var link = titleEl.querySelector('a');
            if (link) { title = link.textContent.trim(); url = link.href; }
            else { title = titleEl.textContent.replace(/^\[(PDF|HTML|CITATION|BOOK)\]\s*/i, '').trim(); }
        }
        var authEl = ri.querySelector('.gs_a');
        var authorsRaw = authEl ? authEl.textContent.trim() : '';
        var snipEl = ri.querySelector('.gs_rs');
        var snippet = snipEl ? snipEl.textContent.trim() : '';
        var citedBy = 0;
        var flLinks = ri.querySelectorAll('.gs_fl a');
        for (var j = 0; j < flLinks.length; j++) {
            var m = flLinks[j].textContent.match(/Cited by (\d+)/i) || flLinks[j].textContent.match(/被引用次数[：:]*\s*(\d+)/);
            if (m) { citedBy = parseInt(m[1], 10); break; }
        }
        var pdfUrl = '';
        var sideLinks = item.querySelectorAll('.gs_or_ggsm a, .gs_ggs a');
        for (var k = 0; k < sideLinks.length; k++) {
            var href = sideLinks[k].href || '';
            if (href.match(/\.pdf/i)) { pdfUrl = href; break; }
        }
        if (title) results.push({title: title, url: url, authors_raw: authorsRaw, snippet: snippet, citationCount: citedBy, pdf_url: pdfUrl});
    }
    return JSON.stringify(results);
})()
"""


class GoogleScholarSource(PaperSourceAdapter):
    source_name = "google_scholar"
    capabilities = SourceCapabilities(requires_browser=True, supports_pdf_resolution=True, supports_date_range=True, supports_citations=True)

    def build_search_url(self, request, start: int = 0) -> str:
        query = request.query or " OR ".join(request.keywords)
        params = {"q": query, "hl": "en", "as_sdt": "0", "start": str(start)}
        if request.year_from:
            params["as_ylo"] = str(request.year_from)
        if request.year_to:
            params["as_yhi"] = str(request.year_to)
        return f"https://scholar.google.com/scholar?{urlencode(params)}"

    def search(self, request):
        from ..models import SourceResult

        if not self.browser:
            return SourceResult(source=self.source_name, errors=["browser backend unavailable"], manual_required=True)
        papers = []
        for page_number in range(max(1, request.max_pages)):
            url = self.build_search_url(request, start=page_number * 10)
            page = self.browser.open(url)
            if not page:
                return SourceResult(source=self.source_name, papers=papers, errors=["failed to open Google Scholar"], manual_required=True)
            try:
                raw = self.browser.evaluate(page, GOOGLE_SCHOLAR_EXTRACT_JS) or "[]"
                papers.extend(extract_google_scholar_results(raw, source_url=url))
            finally:
                self.browser.close(page)
        return SourceResult(source=self.source_name, papers=papers)
