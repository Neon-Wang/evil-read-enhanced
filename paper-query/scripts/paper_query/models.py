"""Paper-query data models.

The models are intentionally stdlib-only so every skill can import them without
extra dependencies beyond the repository's existing requirements.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class SourceProvenance:
    source: str
    url: str = ""
    evidence: str = ""
    confidence: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "url": self.url,
            "evidence": self.evidence,
            "confidence": self.confidence,
        }


@dataclass
class RetrievalEvidence:
    source: str
    kind: str
    value: str
    url: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "kind": self.kind,
            "value": self.value,
            "url": self.url,
        }


@dataclass
class VerificationStatus:
    status: str = "unverified"
    confidence: float = 0.0
    evidence: List[str] = field(default_factory=list)
    reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "confidence": self.confidence,
            "evidence": list(self.evidence),
            "reason": self.reason,
        }


@dataclass
class PaperLink:
    label: str
    url: str
    kind: str = "source"
    status: str = "available"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "label": self.label,
            "url": self.url,
            "kind": self.kind,
            "status": self.status,
        }


@dataclass
class SearchRequest:
    query: str = ""
    keywords: List[str] = field(default_factory=list)
    excluded_keywords: List[str] = field(default_factory=list)
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    top_n: int = 10
    sources: List[str] = field(default_factory=list)
    download_pdfs: bool = False
    allow_browser: bool = True
    max_pages: int = 1
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PaperRecord:
    title: str
    source: str
    url: str = ""
    authors: List[str] = field(default_factory=list)
    venue: str = ""
    year: str = ""
    published_date: str = ""
    abstract: str = ""
    snippet: str = ""
    doi: str = ""
    arxiv_id: str = ""
    s2_url: str = ""
    citation_count: int = 0
    influential_citation_count: int = 0
    pdf_url: str = ""
    pdf_status: str = "none"
    pdf_local_path: str = ""
    pdf_evidence: str = ""
    manual_required: bool = False
    blocked_reason: str = ""
    provenance: List[SourceProvenance] = field(default_factory=list)
    links: List[PaperLink] = field(default_factory=list)
    retrieval_evidence: List[RetrievalEvidence] = field(default_factory=list)
    verification: VerificationStatus = field(default_factory=VerificationStatus)
    scores: Dict[str, float] = field(default_factory=dict)
    matched_domain: Optional[str] = None
    matched_keywords: List[str] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.provenance:
            self.provenance.append(
                SourceProvenance(source=self.source, url=self.url, evidence="initial_record")
            )
        if self.pdf_url and self.pdf_status == "none":
            self.pdf_status = "link_found"

    def merge_from(self, other: "PaperRecord") -> None:
        """Merge another source's fields into this record without losing provenance."""
        for field_name in (
            "url",
            "venue",
            "year",
            "published_date",
            "abstract",
            "snippet",
            "doi",
            "arxiv_id",
            "s2_url",
            "pdf_url",
            "pdf_status",
            "pdf_local_path",
            "pdf_evidence",
            "blocked_reason",
        ):
            if not getattr(self, field_name) and getattr(other, field_name):
                setattr(self, field_name, getattr(other, field_name))

        if not self.authors and other.authors:
            self.authors = list(other.authors)

        self.citation_count = max(self.citation_count, other.citation_count)
        self.influential_citation_count = max(
            self.influential_citation_count, other.influential_citation_count
        )
        self.manual_required = self.manual_required or other.manual_required

        seen_provenance = {(p.source, p.url, p.evidence) for p in self.provenance}
        for provenance in other.provenance:
            key = (provenance.source, provenance.url, provenance.evidence)
            if key not in seen_provenance:
                self.provenance.append(provenance)
                seen_provenance.add(key)

        seen_links = {(link.label, link.url, link.kind) for link in self.links}
        for link in other.links:
            key = (link.label, link.url, link.kind)
            if key not in seen_links:
                self.links.append(link)
                seen_links.add(key)

        seen_evidence = {(e.source, e.kind, e.value, e.url) for e in self.retrieval_evidence}
        for evidence in other.retrieval_evidence:
            key = (evidence.source, evidence.kind, evidence.value, evidence.url)
            if key not in seen_evidence:
                self.retrieval_evidence.append(evidence)
                seen_evidence.add(key)

        self.extra.update({k: v for k, v in other.extra.items() if k not in self.extra})

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "source": self.source,
            "url": self.url,
            "authors": list(self.authors),
            "venue": self.venue,
            "year": self.year,
            "published_date": self.published_date,
            "abstract": self.abstract,
            "snippet": self.snippet,
            "doi": self.doi,
            "arxiv_id": self.arxiv_id,
            "s2_url": self.s2_url,
            "citationCount": self.citation_count,
            "influentialCitationCount": self.influential_citation_count,
            "pdf_url": self.pdf_url,
            "pdf_status": self.pdf_status,
            "pdf_local_path": self.pdf_local_path,
            "pdf_evidence": self.pdf_evidence,
            "manual_required": self.manual_required,
            "blocked_reason": self.blocked_reason,
            "sources": [p.to_dict() for p in self.provenance],
            "links": [link.to_dict() for link in self.links],
            "retrieval_evidence": [e.to_dict() for e in self.retrieval_evidence],
            "verification_status": self.verification.to_dict(),
            "scores": dict(self.scores),
            "matched_domain": self.matched_domain,
            "matched_keywords": list(self.matched_keywords),
            "extra": dict(self.extra),
        }


@dataclass
class SourceResult:
    source: str
    papers: List[PaperRecord] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    manual_required: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "papers": [paper.to_dict() for paper in self.papers],
            "errors": list(self.errors),
            "manual_required": self.manual_required,
        }
