"""Dedupe helpers for normalized paper records."""

from __future__ import annotations

import re
from typing import Dict, Iterable, List

from .models import PaperRecord


def normalize_title(title: str) -> str:
    normalized = re.sub(r"[^a-z0-9\s]", " ", (title or "").lower())
    return re.sub(r"\s+", " ", normalized).strip()


def paper_keys(paper: PaperRecord) -> List[str]:
    keys = []
    if paper.doi:
        keys.append(f"doi:{paper.doi.lower()}")
    if paper.arxiv_id:
        keys.append(f"arxiv:{paper.arxiv_id.lower()}")
    if paper.s2_url:
        keys.append(f"s2:{paper.s2_url.lower()}")
    if paper.url:
        keys.append(f"url:{paper.url.lower().rstrip('/')}")
    title_key = normalize_title(paper.title)
    if title_key:
        keys.append(f"title:{title_key}")
    return keys


def dedupe_papers(papers: Iterable[PaperRecord]) -> List[PaperRecord]:
    """Merge records that share DOI/arXiv/S2/URL/title identity."""
    merged: List[PaperRecord] = []
    index: Dict[str, PaperRecord] = {}

    for paper in papers:
        keys = paper_keys(paper)
        existing = next((index[key] for key in keys if key in index), None)
        if existing is None:
            merged.append(paper)
            existing = paper
        else:
            existing.merge_from(paper)

        for key in paper_keys(existing):
            index[key] = existing
        for key in keys:
            index[key] = existing

    return merged
