"""Semantic Scholar helpers shared by paper-query sources."""

from __future__ import annotations

import json
import re
import time
from typing import Dict, Iterable, List, Optional
from urllib.parse import urlencode
import urllib.request

from .http import urlopen
from .models import PaperRecord, SourceProvenance, VerificationStatus

S2_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
S2_FIELDS = "title,abstract,publicationDate,citationCount,influentialCitationCount,url,authors,externalIds"


def title_similarity(a: str, b: str) -> float:
    def normalize(value: str) -> str:
        return re.sub(r"[^a-z0-9\s]", "", (value or "").lower()).strip()

    words_a = set(normalize(a).split())
    words_b = set(normalize(b).split())
    if not words_a or not words_b:
        return 0.0
    return len(words_a & words_b) / len(words_a | words_b)


def search_by_title(title: str, api_key: str = "", max_retries: int = 3) -> Optional[Dict]:
    params = urlencode({"query": title, "limit": 3, "fields": S2_FIELDS})
    headers = {"User-Agent": "paper-query/1.0"}
    if api_key:
        headers["x-api-key"] = api_key
    request = urllib.request.Request(f"{S2_API_URL}?{params}", headers=headers)
    for attempt in range(max_retries):
        try:
            with urlopen(request, timeout=20) as response:
                data = json.loads(response.read().decode("utf-8"))
            results = data.get("data", [])
            if not results:
                return None
            return max(results, key=lambda item: title_similarity(title, item.get("title", "")))
        except Exception:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
    return None


def enrich_records(records: Iterable[PaperRecord], api_key: str = "") -> List[PaperRecord]:
    enriched = []
    for record in records:
        match = search_by_title(record.title, api_key=api_key)
        if not match:
            enriched.append(record)
            continue
        similarity = title_similarity(record.title, match.get("title", ""))
        if similarity < 0.6:
            enriched.append(record)
            continue

        record.abstract = record.abstract or (match.get("abstract") or "")
        record.citation_count = max(record.citation_count, match.get("citationCount") or 0)
        record.influential_citation_count = max(
            record.influential_citation_count,
            match.get("influentialCitationCount") or 0,
        )
        record.s2_url = record.s2_url or (match.get("url") or "")
        ext_ids = match.get("externalIds") or {}
        record.doi = record.doi or ext_ids.get("DOI", "")
        record.arxiv_id = record.arxiv_id or ext_ids.get("ArXiv", "")
        if not record.authors and match.get("authors"):
            record.authors = [author.get("name", "") for author in match["authors"] if author.get("name")]
        record.provenance.append(
            SourceProvenance(
                source="semantic_scholar",
                url=record.s2_url,
                evidence=f"title_similarity:{similarity:.2f}",
                confidence=round(similarity, 2),
            )
        )
        if similarity >= 0.85 or record.doi:
            record.verification = VerificationStatus(
                status="verified",
                confidence=round(max(similarity, record.verification.confidence), 2),
                evidence=list(set(record.verification.evidence + ["semantic_scholar_title_match"])),
            )
        enriched.append(record)
        time.sleep(1.0)
    return enriched
