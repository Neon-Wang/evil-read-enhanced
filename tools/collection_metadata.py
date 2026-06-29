#!/usr/bin/env python3
"""Metadata enrichment for PDFs dropped into the collections folder."""

from __future__ import annotations

from html import unescape
import json
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any

USER_AGENT = "EvilRead-StartMyDay/1.0 (metadata enrichment)"


def compact_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def clean_html(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    return compact_text(unescape(value))


def normalize_collection_title(stem: str) -> str:
    cleaned = stem.replace("_", " ").replace("-", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return "Imported collection PDF"
    return cleaned[:1].upper() + cleaned[1:]


def extract_pdf_text(pdf_path: Path, max_chars: int = 8000) -> str:
    try:
        import fitz
    except ImportError:
        return ""
    try:
        doc = fitz.open(str(pdf_path))
    except Exception:
        return ""
    chunks: list[str] = []
    try:
        for page in doc[: min(len(doc), 3)]:
            chunks.append(page.get_text("text"))
            if sum(len(chunk) for chunk in chunks) >= max_chars:
                break
    finally:
        doc.close()
    return compact_text(" ".join(chunks))[:max_chars]


def infer_arxiv_id(name: str, text: str = "") -> str:
    match = re.search(r"\b(\d{4}\.\d{4,5})(v\d+)?\b", name)
    if not match:
        match = re.search(r"\barXiv[:\s]+(\d{4}\.\d{4,5})(v\d+)?\b", text, flags=re.IGNORECASE)
    return "".join(match.groups(default="")) if match else ""


def infer_doi(name: str, text: str = "") -> str:
    stem = Path(name).stem.lower().replace("_", "-")
    if re.match(r"d\d{5}-\d{3}-\d{5}-[a-z0-9]+$", stem):
        return f"10.1038/{stem}"
    if re.match(r"s\d{5}-\d{3}-\d{5}-[a-z0-9]+$", stem):
        return f"10.1038/{stem}"
    if stem.startswith("annurev-"):
        return f"10.1146/{stem}"
    doi = re.search(r"\b(10\.\d{4,9}/[-._;()/:A-Za-z0-9]+)\b", text)
    if doi:
        return doi.group(1).rstrip(".,;)").lower()
    return ""


def http_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload if isinstance(payload, dict) else {}


def fetch_arxiv_metadata(arxiv_id: str) -> dict[str, Any]:
    if not arxiv_id:
        return {}
    query_id = re.sub(r"v\d+$", "", arxiv_id)
    url = "https://export.arxiv.org/api/query?id_list=" + urllib.parse.quote(query_id)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            xml = response.read()
    except OSError:
        return {}
    root = ET.fromstring(xml)
    ns = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
    entry = root.find("atom:entry", ns)
    if entry is None:
        return {}
    title = compact_text(entry.findtext("atom:title", default="", namespaces=ns))
    abstract = compact_text(entry.findtext("atom:summary", default="", namespaces=ns))
    authors = [
        compact_text(author.findtext("atom:name", default="", namespaces=ns))
        for author in entry.findall("atom:author", ns)
    ]
    published = compact_text(entry.findtext("atom:published", default="", namespaces=ns))[:10]
    categories = [cat.attrib.get("term", "") for cat in entry.findall("atom:category", ns)]
    return {
        "title": title,
        "abstractNote": abstract,
        "creators": [{"creatorType": "author", "name": name} for name in authors if name],
        "date": published,
        "url": f"https://arxiv.org/abs/{query_id}",
        "DOI": "",
        "publicationTitle": "arXiv",
        "archiveID": f"arXiv:{query_id}",
        "categories": categories,
        "source": "arxiv",
        "pdf_url": f"https://arxiv.org/pdf/{query_id}",
    }


def webbridge_command(action: str, args: dict[str, Any], session: str = "start-my-day-metadata") -> dict[str, Any]:
    body = {"action": action, "args": args, "session": session}
    request_path = Path(tempfile.gettempdir()) / f"webbridge-req-{session}-{abs(hash(json.dumps(body, sort_keys=True))) & 0xFFFFFFFF:x}.json"
    request_path.write_text(json.dumps(body, ensure_ascii=False), encoding="utf-8")
    try:
        completed = subprocess.run(
            [
                "curl.exe",
                "-s",
                "-X",
                "POST",
                "http://127.0.0.1:10086/command",
                "-H",
                "Content-Type: application/json",
                "--data-binary",
                "@" + str(request_path),
            ],
            text=True,
            capture_output=True,
            timeout=45,
            check=False,
        )
    finally:
        try:
            request_path.unlink()
        except FileNotFoundError:
            pass
    if completed.returncode != 0 or not completed.stdout.strip():
        return {}
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) and payload.get("ok") else {}


def fetch_arxiv_metadata_kimi(arxiv_id: str) -> dict[str, Any]:
    if not arxiv_id:
        return {}
    query_id = re.sub(r"v\d+$", "", arxiv_id)
    session = "start-my-day-metadata"
    opened = webbridge_command(
        "navigate",
        {"url": f"https://arxiv.org/abs/{query_id}", "newTab": True, "group_title": "Start My Day metadata"},
        session=session,
    )
    if not opened:
        return {}
    code = r"""(() => {
      const meta = {};
      for (const m of document.querySelectorAll('meta')) {
        const k = m.getAttribute('name') || m.getAttribute('property');
        if (k) meta[k] = m.getAttribute('content') || '';
      }
      const rawTitle = document.querySelector('h1.title')?.innerText || meta['og:title'] || document.title || '';
      const title = rawTitle.replace(/^Title:\s*/i, '').trim();
      const authors = [...document.querySelectorAll('.authors a')].map(a => a.innerText.trim()).filter(Boolean);
      const abstract = (document.querySelector('blockquote.abstract')?.innerText || meta['og:description'] || '').replace(/^Abstract:\s*/i, '').trim();
      const dateText = document.querySelector('.dateline')?.innerText || '';
      const subjects = document.querySelector('.subjects')?.innerText || '';
      return JSON.stringify({title, authors, abstract, dateText, subjects, url: location.href});
    })()"""
    evaluated = webbridge_command("evaluate", {"code": code}, session=session)
    value = ((evaluated.get("data") or {}).get("value") or "") if isinstance(evaluated.get("data"), dict) else ""
    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        return {}
    title = compact_text(data.get("title"))
    abstract = compact_text(data.get("abstract"))
    if not title and not abstract:
        return {}
    authors = data.get("authors") if isinstance(data.get("authors"), list) else []
    return {
        "title": title,
        "abstractNote": abstract,
        "creators": [{"creatorType": "author", "name": compact_text(name)} for name in authors if compact_text(name)],
        "date": compact_text(data.get("dateText")),
        "url": compact_text(data.get("url") or f"https://arxiv.org/abs/{query_id}"),
        "DOI": "",
        "publicationTitle": "arXiv",
        "archiveID": f"arXiv:{query_id}",
        "categories": [compact_text(data.get("subjects"))] if compact_text(data.get("subjects")) else [],
        "source": "kimi-webbridge-arxiv",
        "pdf_url": f"https://arxiv.org/pdf/{query_id}",
    }


def fetch_crossref_metadata(doi: str) -> dict[str, Any]:
    if not doi:
        return {}
    try:
        payload = http_json("https://api.crossref.org/works/" + urllib.parse.quote(doi, safe=""))
    except OSError:
        return {}
    message = payload.get("message") if isinstance(payload.get("message"), dict) else {}
    title = message.get("title") or []
    abstract = clean_html(str(message.get("abstract") or ""))
    authors = []
    for author in message.get("author") or []:
        if not isinstance(author, dict):
            continue
        name = compact_text(" ".join(part for part in [author.get("given", ""), author.get("family", "")] if part))
        if name:
            authors.append({"creatorType": "author", "name": name})
    published = message.get("published-print") or message.get("published-online") or message.get("created") or {}
    date_parts = published.get("date-parts") if isinstance(published, dict) else []
    date_text = "-".join(str(part) for part in (date_parts[0] if date_parts else []) if part)
    containers = message.get("container-title") or []
    return {
        "title": compact_text(title[0] if title else ""),
        "abstractNote": abstract,
        "creators": authors,
        "date": date_text,
        "url": str(message.get("URL") or f"https://doi.org/{doi}"),
        "DOI": doi,
        "publicationTitle": compact_text(containers[0] if containers else ""),
        "source": "crossref",
    }


def title_from_pdf_text(text: str, fallback: str) -> str:
    if not text:
        return fallback
    lines = [compact_text(line) for line in re.split(r"[\r\n]+", text) if compact_text(line)]
    candidates = [line for line in lines[:20] if 12 <= len(line) <= 180 and not line.lower().startswith(("arxiv:", "doi:"))]
    return candidates[0] if candidates else fallback


def fallback_abstract_from_pdf(text: str) -> str:
    if not text:
        return ""
    abstract_match = re.search(r"(?is)\babstract\b\s*[:.\-]?\s*(.{120,1800}?)(?:\b1\s+introduction\b|\bintroduction\b|\bkeywords?\b)", text)
    if abstract_match:
        return compact_text(abstract_match.group(1))[:1500]
    return compact_text(text[:1500])


def enriched_metadata_from_pdf(pdf_path: Path, original_name: str, run_date: str) -> dict[str, Any]:
    pdf_path = Path(pdf_path)
    text = extract_pdf_text(pdf_path)
    arxiv_id = infer_arxiv_id(original_name, text)
    doi = infer_doi(original_name, text)
    metadata = fetch_arxiv_metadata(arxiv_id) if arxiv_id else {}
    if arxiv_id and not metadata:
        metadata = fetch_arxiv_metadata_kimi(arxiv_id)
    if not metadata and doi:
        metadata = fetch_crossref_metadata(doi)
    fallback_title = normalize_collection_title(Path(original_name).stem)
    title = compact_text(metadata.get("title")) or title_from_pdf_text(text, fallback_title)
    abstract = compact_text(metadata.get("abstractNote")) or fallback_abstract_from_pdf(text)
    arxiv_base = re.sub(r"v\d+$", "", arxiv_id)
    return {
        "title": title,
        "abstractNote": abstract,
        "creators": metadata.get("creators") if isinstance(metadata.get("creators"), list) else [],
        "DOI": compact_text(metadata.get("DOI") or doi),
        "url": compact_text(metadata.get("url")),
        "date": compact_text(metadata.get("date") or run_date),
        "publicationTitle": compact_text(metadata.get("publicationTitle")),
        "archiveID": compact_text(metadata.get("archiveID") or (f"arXiv:{arxiv_base}" if arxiv_id else "")),
        "source": compact_text(metadata.get("source") or ("pdf-text" if text else "filename")),
        "pdf_url": compact_text(metadata.get("pdf_url")),
        "pdf_text_preview": text[:2200],
        "arxiv_id": arxiv_id,
    }
