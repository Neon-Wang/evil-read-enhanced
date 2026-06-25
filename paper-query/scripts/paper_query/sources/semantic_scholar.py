"""Semantic Scholar source adapter."""

from __future__ import annotations

import json
from urllib.parse import urlencode
import urllib.request

from ..http import urlopen
from ..models import PaperRecord, SourceProvenance, SourceResult
from ..s2 import S2_API_URL, S2_FIELDS
from .base import PaperSourceAdapter, SourceCapabilities


class SemanticScholarSource(PaperSourceAdapter):
    source_name = "semantic_scholar"
    capabilities = SourceCapabilities(supports_citations=True, supports_date_range=True, supports_pdf_resolution=True)

    def search(self, request):
        query = request.query or " ".join(request.keywords)
        if not query:
            return SourceResult(source=self.source_name, errors=["query is required"])
        params = {"query": query, "limit": min(max(request.top_n, 1), 100), "fields": S2_FIELDS}
        if request.year_from or request.year_to:
            params["year"] = f"{request.year_from or ''}-{request.year_to or ''}"
        headers = {"User-Agent": "paper-query/1.0"}
        api_key = request.config.get("semantic_scholar_api_key", "")
        if api_key:
            headers["x-api-key"] = api_key
        try:
            req = urllib.request.Request(f"{S2_API_URL}?{urlencode(params)}", headers=headers)
            with urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            return SourceResult(source=self.source_name, errors=[str(exc)])
        papers = []
        for item in data.get("data", []):
            ext = item.get("externalIds") or {}
            pdf_url = f"https://arxiv.org/pdf/{ext.get('ArXiv')}" if ext.get("ArXiv") else ""
            papers.append(
                PaperRecord(
                    title=item.get("title", ""),
                    source="semantic_scholar",
                    url=item.get("url", ""),
                    authors=[a.get("name", "") for a in item.get("authors", []) if a.get("name")],
                    published_date=item.get("publicationDate", "") or "",
                    year=(item.get("publicationDate", "") or "")[:4],
                    abstract=item.get("abstract") or "",
                    doi=ext.get("DOI", ""),
                    arxiv_id=ext.get("ArXiv", ""),
                    s2_url=item.get("url", ""),
                    citation_count=item.get("citationCount") or 0,
                    influential_citation_count=item.get("influentialCitationCount") or 0,
                    pdf_url=pdf_url,
                    pdf_status="link_found" if pdf_url else "none",
                    provenance=[SourceProvenance(source="semantic_scholar", url=item.get("url", ""), evidence="s2_search")],
                )
            )
        return SourceResult(source=self.source_name, papers=papers)
