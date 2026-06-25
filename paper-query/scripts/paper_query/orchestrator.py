"""Multi-source orchestration for paper-query."""

from __future__ import annotations

from typing import Dict, List, Optional, Type

from .browser import BrowserClient, make_browser_client
from .dedupe import dedupe_papers
from .models import PaperRecord, SearchRequest, SourceResult
from .s2 import enrich_records
from .scoring import score_papers
from .sources.arxiv import ArxivSource
from .sources.base import PaperSourceAdapter
from .sources.dblp import DblpSource
from .sources.google_scholar import GoogleScholarSource
from .sources.nature import NatureSource
from .sources.semantic_scholar import SemanticScholarSource

ADAPTERS: Dict[str, Type[PaperSourceAdapter]] = {
    "arxiv": ArxivSource,
    "semantic_scholar": SemanticScholarSource,
    "dblp": DblpSource,
    "google_scholar": GoogleScholarSource,
    "nature": NatureSource,
}


def build_request(config: Dict, query: str, sources: List[str], year_from=None, year_to=None, top_n=None, max_pages=None, download_pdfs=False) -> SearchRequest:
    keywords = config.get("keywords") or []
    excluded = config.get("excluded_keywords") or []
    domains = config.get("research_domains") or {}
    if not keywords and domains:
        for domain in domains.values():
            keywords.extend(domain.get("keywords", []))
    return SearchRequest(
        query=query,
        keywords=keywords,
        excluded_keywords=excluded,
        year_from=year_from,
        year_to=year_to,
        top_n=top_n or config.get("top_n", 10),
        sources=sources or config.get("sources", []),
        download_pdfs=download_pdfs or config.get("download_pdfs", False),
        allow_browser=(config.get("browser", {}).get("backend", "auto") != "none"),
        max_pages=max_pages or config.get("max_pages", 1),
        config=config,
    )


def run_sources(request: SearchRequest, config: Dict, browser: Optional[BrowserClient] = None) -> List[SourceResult]:
    selected = request.sources or config.get("sources", []) or ["arxiv", "semantic_scholar"]
    if browser is None and request.allow_browser and any(name in {"google_scholar", "nature"} for name in selected):
        browser = make_browser_client(config)
    results = []
    for name in selected:
        adapter_cls = ADAPTERS.get(name)
        if adapter_cls is None:
            results.append(SourceResult(source=name, errors=["unknown source"]))
            continue
        source_config = config.get(name, {})
        adapter = adapter_cls(source_config, browser=browser)
        if adapter.capabilities.requires_browser and browser is None:
            results.append(SourceResult(source=name, errors=["browser backend unavailable"], manual_required=True))
            continue
        results.append(adapter.search(request))
    return results


def query_papers(request: SearchRequest, config: Dict) -> Dict:
    source_results = run_sources(request, config)
    papers: List[PaperRecord] = []
    errors = []
    manual_sources = []
    for result in source_results:
        papers.extend(result.papers)
        errors.extend([{"source": result.source, "error": error} for error in result.errors])
        if result.manual_required:
            manual_sources.append(result.source)

    merged = dedupe_papers(papers)
    if config.get("enrich_with_s2", False):
        merged = enrich_records(merged, api_key=config.get("semantic_scholar_api_key", ""))
    scored = score_papers(merged, request)
    top = scored[: request.top_n]
    return {
        "query": request.query,
        "sources_requested": request.sources,
        "sources_completed": [result.source for result in source_results if not result.errors],
        "manual_required_sources": manual_sources,
        "errors": errors,
        "total_found": len(papers),
        "total_merged": len(merged),
        "top_papers": [paper.to_dict() for paper in top],
    }
