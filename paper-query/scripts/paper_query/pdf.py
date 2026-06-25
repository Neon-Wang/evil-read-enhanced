"""PDF link helpers for paper-query."""

from __future__ import annotations

import re
from html import unescape
from pathlib import Path
from typing import List, Optional
from urllib.parse import urljoin, urlparse
import urllib.request

PDF_HREF_RE = re.compile(r"href=[\"']([^\"']+?\.pdf(?:\?[^\"']*)?)[\"']", re.IGNORECASE)
PDF_URL_RE = re.compile(r"https?://[^\s\"'<>]+?\.pdf(?:\?[^\s\"'<>]*)?", re.IGNORECASE)


def classify_pdf_url(url: Optional[str]) -> str:
    """Return the initial PDF status for a candidate URL."""
    if not url:
        return "none"
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return "failed"
    if parsed.path.lower().endswith(".pdf") or ".pdf" in parsed.path.lower():
        return "link_found"
    return "link_found" if "pdf" in url.lower() else "none"


def find_pdf_links(html: str, base_url: str = "") -> List[str]:
    """Extract unique PDF links from HTML/text, resolving relative links."""
    candidates = []
    for match in PDF_HREF_RE.finditer(html or ""):
        candidates.append(unescape(match.group(1)))
    for match in PDF_URL_RE.finditer(html or ""):
        candidates.append(unescape(match.group(0)))

    seen = set()
    links = []
    for candidate in candidates:
        url = urljoin(base_url, candidate) if base_url else candidate
        if url not in seen:
            seen.add(url)
            links.append(url)
    return links


def validate_pdf_url(url: str, timeout: int = 20) -> str:
    """Best-effort PDF validation without bypassing access controls."""
    if classify_pdf_url(url) == "none":
        return "none"
    try:
        request = urllib.request.Request(url, method="GET", headers={"User-Agent": "paper-query/1.0"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            sample = response.read(8)
            content_type = response.headers.get("Content-Type", "").lower()
            if sample.startswith(b"%PDF") or "pdf" in content_type:
                return "valid"
            return "failed"
    except Exception:
        return "failed"


def download_pdf(url: str, output_dir: str, filename: Optional[str] = None, timeout: int = 60) -> str:
    """Download a PDF to output_dir after a minimal magic-header check."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    target_name = filename or Path(urlparse(url).path).name or "paper.pdf"
    if not target_name.lower().endswith(".pdf"):
        target_name += ".pdf"
    target = output_path / target_name

    request = urllib.request.Request(url, headers={"User-Agent": "paper-query/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read()
    if not data.startswith(b"%PDF"):
        raise ValueError("downloaded content is not a PDF")
    target.write_bytes(data)
    return str(target)
