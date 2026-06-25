"""arXiv adapter wrapping the existing start-my-day implementation."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
import sys
from typing import List

from ..models import PaperRecord, SourceProvenance, SourceResult
from .base import PaperSourceAdapter, SourceCapabilities

ROOT = Path(__file__).resolve().parents[4]
START_MY_DAY_SCRIPTS = ROOT / "start-my-day" / "scripts"
if str(START_MY_DAY_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(START_MY_DAY_SCRIPTS))

try:
    from search_arxiv import parse_arxiv_xml, search_arxiv_by_date_range
except Exception:  # pragma: no cover
    parse_arxiv_xml = None
    search_arxiv_by_date_range = None


class ArxivSource(PaperSourceAdapter):
    source_name = "arxiv"
    capabilities = SourceCapabilities(supports_pdf_resolution=True, supports_date_range=True)

    def search(self, request):
        if search_arxiv_by_date_range is None:
            return SourceResult(source=self.source_name, errors=["start-my-day search_arxiv.py unavailable"])
        categories = self.config.get("arxiv_categories") or ["cs.AI", "cs.CL", "cs.LG", "cs.CV"]
        end = datetime.now()
        if request.year_to:
            end = datetime(request.year_to, 12, 31)
        start = end - timedelta(days=30)
        if request.year_from:
            start = datetime(request.year_from, 1, 1)
        raw_papers = search_arxiv_by_date_range(categories, start, end, max_results=self.config.get("max_results", 50))
        papers: List[PaperRecord] = []
        for item in raw_papers:
            arxiv_id = item.get("id", "").split("/")[-1]
            pdf_url = item.get("pdf_url") or (f"https://arxiv.org/pdf/{arxiv_id}" if arxiv_id else "")
            papers.append(
                PaperRecord(
                    title=item.get("title", ""),
                    source="arxiv",
                    url=item.get("url", item.get("link", "")),
                    authors=item.get("authors", []),
                    published_date=str(item.get("published", "")),
                    year=str(item.get("published", ""))[:4],
                    abstract=item.get("summary", ""),
                    arxiv_id=arxiv_id,
                    pdf_url=pdf_url,
                    pdf_status="link_found" if pdf_url else "none",
                    provenance=[SourceProvenance(source="arxiv", url=item.get("url", ""), evidence="arxiv_api")],
                    extra={"categories": item.get("categories", [])},
                )
            )
        return SourceResult(source=self.source_name, papers=papers)
