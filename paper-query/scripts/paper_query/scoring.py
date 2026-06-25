"""Shared scoring wrappers for paper-query."""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Dict, List, Tuple

from .models import PaperRecord, SearchRequest

ROOT = Path(__file__).resolve().parents[3]
START_MY_DAY_SCRIPTS = ROOT / "start-my-day" / "scripts"
if str(START_MY_DAY_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(START_MY_DAY_SCRIPTS))

try:
    from search_arxiv import calculate_quality_score, calculate_relevance_score, SCORE_MAX
except Exception:  # pragma: no cover - defensive fallback for partial installs
    SCORE_MAX = 3.0

    def calculate_quality_score(summary: str) -> float:
        if not summary:
            return 0.0
        lowered = summary.lower()
        score = 0.0
        if any(word in lowered for word in ("novel", "propose", "introduce")):
            score += 0.5
        if any(word in lowered for word in ("experiment", "benchmark", "evaluate")):
            score += 0.5
        return min(score, SCORE_MAX)

    def calculate_relevance_score(paper: Dict, domains: Dict, excluded_keywords: List[str]) -> Tuple[float, str, List[str]]:
        text = f"{paper.get('title', '')} {paper.get('summary', '')} {paper.get('abstract', '')}".lower()
        for keyword in excluded_keywords:
            if keyword.lower() in text:
                return 0.0, None, []
        score = 0.0
        matched = []
        for domain_name, domain in domains.items():
            for keyword in domain.get("keywords", []):
                if keyword.lower() in text:
                    score += 0.5
                    matched.append(keyword)
            if matched:
                return min(score, SCORE_MAX), domain_name, matched
        return 0.0, None, []


WEIGHTS_PLATFORM = {
    "relevance": 0.40,
    "popularity": 0.30,
    "quality": 0.20,
    "verification": 0.10,
}


def _domains_from_request(request: SearchRequest) -> Dict:
    domains = request.config.get("research_domains") or request.config.get("domains")
    if domains:
        return domains
    keywords = request.keywords or ([request.query] if request.query else [])
    return {
        "paper_query": {
            "keywords": keywords,
            "arxiv_categories": [],
        }
    }


def popularity_score(paper: PaperRecord) -> float:
    influential = paper.influential_citation_count or 0
    citations = paper.citation_count or 0
    if influential > 0:
        return min(influential / (100 / SCORE_MAX), SCORE_MAX)
    if citations > 0:
        return min(citations / 200 * SCORE_MAX, SCORE_MAX * 0.7)
    return 0.0


def score_paper(paper: PaperRecord, request: SearchRequest) -> PaperRecord:
    paper_dict = {
        "title": paper.title,
        "summary": paper.abstract or paper.snippet,
        "abstract": paper.abstract or paper.snippet,
        "categories": paper.extra.get("categories", []),
    }
    relevance, domain, matched_keywords = calculate_relevance_score(
        paper_dict,
        _domains_from_request(request),
        request.excluded_keywords,
    )
    quality = calculate_quality_score(paper.abstract or paper.snippet)
    popularity = popularity_score(paper)
    verification = max(0.0, min(float(paper.verification.confidence or 0.0) * SCORE_MAX, SCORE_MAX))

    normalized = {
        "relevance": (relevance / SCORE_MAX) * 10,
        "popularity": (popularity / SCORE_MAX) * 10,
        "quality": (quality / SCORE_MAX) * 10,
        "verification": (verification / SCORE_MAX) * 10,
    }
    recommendation = sum(normalized[key] * WEIGHTS_PLATFORM[key] for key in WEIGHTS_PLATFORM)

    paper.scores = {
        "relevance": round(relevance, 2),
        "popularity": round(popularity, 2),
        "quality": round(quality, 2),
        "verification": round(verification, 2),
        "recommendation": round(recommendation, 2),
    }
    paper.matched_domain = domain
    paper.matched_keywords = matched_keywords
    return paper


def score_papers(papers: List[PaperRecord], request: SearchRequest) -> List[PaperRecord]:
    scored = [score_paper(paper, request) for paper in papers]
    scored.sort(key=lambda paper: paper.scores.get("recommendation", 0.0), reverse=True)
    return scored
