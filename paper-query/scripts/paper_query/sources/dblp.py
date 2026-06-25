"""DBLP adapter wrapping conf-papers behavior."""

from __future__ import annotations

from pathlib import Path
import sys
from typing import List

from ..models import PaperRecord, SourceProvenance, SourceResult
from .base import PaperSourceAdapter, SourceCapabilities

ROOT = Path(__file__).resolve().parents[4]
CONF_PAPERS_SCRIPTS = ROOT / "conf-papers" / "scripts"
if str(CONF_PAPERS_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(CONF_PAPERS_SCRIPTS))

try:
    from search_conf_papers import search_all_conferences
except Exception:  # pragma: no cover
    search_all_conferences = None


class DblpSource(PaperSourceAdapter):
    source_name = "dblp"
    capabilities = SourceCapabilities(supports_date_range=True)

    def search(self, request):
        if search_all_conferences is None:
            return SourceResult(source=self.source_name, errors=["conf-papers search_conf_papers.py unavailable"])
        year = request.year_from or request.year_to
        if not year:
            return SourceResult(source=self.source_name, errors=["DBLP requires a year"])
        venues = self.config.get("default_conferences") or ["ICLR", "NeurIPS", "CVPR", "ICML"]
        try:
            raw_papers = search_all_conferences(year, venues, max_per_venue=self.config.get("max_per_venue", 200))
        except Exception as exc:
            return SourceResult(source=self.source_name, errors=[str(exc)])
        papers: List[PaperRecord] = []
        for item in raw_papers:
            doi = item.get("doi", "")
            papers.append(
                PaperRecord(
                    title=item.get("title", ""),
                    source="dblp",
                    url=item.get("dblp_url", item.get("url", "")),
                    authors=item.get("authors", []),
                    venue=item.get("conference", item.get("venue", "")),
                    year=str(item.get("year", year)),
                    doi=doi,
                    provenance=[SourceProvenance(source="dblp", url=item.get("dblp_url", ""), evidence="dblp_api")],
                )
            )
        return SourceResult(source=self.source_name, papers=papers)
