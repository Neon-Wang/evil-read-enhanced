#!/usr/bin/env python3
"""Offline smoke checks for the paper-query skill.

These checks intentionally avoid network/browser access. They validate the stable
contract that source adapters and shared utilities must provide.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from paper_query.dedupe import dedupe_papers
from paper_query.models import PaperRecord, SearchRequest, VerificationStatus
from paper_query.pdf import classify_pdf_url, find_pdf_links
from paper_query.scoring import score_paper
from paper_query.sources.google_scholar import extract_google_scholar_results
from paper_query.sources.nature import NatureSource, extract_nature_article_from_html, paper_from_nature_payload


NATURE_ARTICLE_HTML = """
<html>
  <head>
    <meta name="citation_title" content="The interaction of meaning similarity and confusability explains regularity in form–meaning mappings at and below the word level">
    <meta name="citation_author" content="Thomas Brochhagen">
    <meta name="citation_author" content="Xixian Liao">
    <meta name="citation_journal_title" content="Nature Human Behaviour">
    <meta name="citation_publication_date" content="2026/06/18">
    <meta name="citation_doi" content="10.1038/s41562-026-02488-3">
    <meta name="citation_pdf_url" content="https://www.nature.com/articles/s41562-026-02488-3.pdf">
    <meta name="description" content="A Nature Human Behaviour article abstract snippet.">
  </head>
  <body>
    <a href="/articles/s41562-026-02488-3.pdf">Download PDF</a>
  </body>
</html>
"""


SCHOLAR_HTML = """
<html><body>
  <div class="gs_r gs_or gs_scl">
    <div class="gs_ri">
      <h3 class="gs_rt"><a href="https://example.org/paper">A browser-based paper query system</a></h3>
      <div class="gs_a">A Researcher, B Author - Proceedings of Tests, 2025 - example.org</div>
      <div class="gs_rs">We propose a browser assisted framework for scholarly search.</div>
      <div class="gs_fl"><a>Cited by 42</a></div>
    </div>
    <div class="gs_or_ggsm"><a href="https://example.org/paper.pdf">[PDF]</a></div>
  </div>
</body></html>
"""


def test_nature_article_extraction() -> None:
    paper = extract_nature_article_from_html(
        NATURE_ARTICLE_HTML,
        "https://www.nature.com/articles/s41562-026-02488-3",
    )

    assert paper.title.startswith("The interaction of meaning similarity")
    assert paper.doi == "10.1038/s41562-026-02488-3"
    assert paper.source == "nature"
    assert paper.venue == "Nature Human Behaviour"
    assert paper.year == "2026"
    assert paper.pdf_url == "https://www.nature.com/articles/s41562-026-02488-3.pdf"
    assert paper.pdf_status == "link_found"
    assert any(p.source == "nature" for p in paper.provenance)


def test_nature_article_payload_extraction() -> None:
    payload = {
        "title": "The interaction of meaning similarity and confusability explains regularity in form–meaning mappings at and below the word level",
        "authors": ["Thomas Brochhagen", "Xixian Liao"],
        "venue": "Nature Human Behaviour",
        "published_date": "2026/06/18",
        "doi": "10.1038/s41562-026-02488-3",
        "abstract": "A Nature Human Behaviour article abstract snippet.",
        "pdf_url": "https://www.nature.com/articles/s41562-026-02488-3.pdf",
    }

    paper = paper_from_nature_payload(payload, "https://www.nature.com/articles/s41562-026-02488-3")

    assert paper.title.startswith("The interaction of meaning similarity")
    assert paper.doi == "10.1038/s41562-026-02488-3"
    assert paper.venue == "Nature Human Behaviour"
    assert paper.pdf_status == "link_found"


def test_nature_source_detects_direct_article_urls() -> None:
    source = NatureSource()
    request = SearchRequest(query="https://www.nature.com/articles/s41562-026-02488-3")

    assert source.is_direct_article_url(request.query)
    assert source.build_article_pdf_url(request.query) == "https://www.nature.com/articles/s41562-026-02488-3.pdf"


def test_google_scholar_fixture_extraction() -> None:
    papers = extract_google_scholar_results(SCHOLAR_HTML, source_url="https://scholar.google.com/scholar?q=browser")

    assert len(papers) == 1
    paper = papers[0]
    assert paper.title == "A browser-based paper query system"
    assert paper.year == "2025"
    assert paper.citation_count == 42
    assert paper.pdf_url == "https://example.org/paper.pdf"
    assert paper.pdf_status == "link_found"
    assert paper.source == "google_scholar"


def test_dedupe_merges_by_doi_and_keeps_provenance() -> None:
    nature = PaperRecord(
        title="Shared Discovery",
        source="nature",
        url="https://www.nature.com/articles/example",
        doi="10.1038/example",
        abstract="Nature abstract",
    )
    s2 = PaperRecord(
        title="Shared Discovery",
        source="semantic_scholar",
        url="https://www.semanticscholar.org/paper/example",
        doi="10.1038/example",
        citation_count=100,
        influential_citation_count=12,
    )

    merged = dedupe_papers([nature, s2])

    assert len(merged) == 1
    assert merged[0].doi == "10.1038/example"
    assert merged[0].citation_count == 100
    assert {p.source for p in merged[0].provenance} == {"nature", "semantic_scholar"}


def test_scoring_pdf_and_verification_serialization() -> None:
    request = SearchRequest(query="browser scholarly search", keywords=["browser", "scholarly search"])
    paper = PaperRecord(
        title="Browser Scholarly Search",
        source="nature",
        abstract="We propose a novel browser framework and evaluate it on benchmarks.",
        citation_count=60,
        influential_citation_count=5,
        pdf_url="https://example.org/browser-search.pdf",
        verification=VerificationStatus(status="verified", confidence=0.9, evidence=["doi_match", "pdf_link"]),
    )

    scored = score_paper(paper, request)
    assert scored.scores["recommendation"] > 0
    assert scored.scores["relevance"] > 0
    assert classify_pdf_url(scored.pdf_url) == "link_found"
    assert find_pdf_links('<a href="https://example.org/browser-search.pdf">PDF</a>', "https://example.org") == [
        "https://example.org/browser-search.pdf"
    ]

    payload = scored.to_dict()
    encoded = json.dumps(payload, ensure_ascii=False)
    assert "verified" in encoded
    assert payload["verification_status"]["confidence"] == 0.9


def main() -> int:
    tests = [
        test_nature_article_extraction,
        test_nature_article_payload_extraction,
        test_nature_source_detects_direct_article_urls,
        test_google_scholar_fixture_extraction,
        test_dedupe_merges_by_doi_and_keeps_provenance,
        test_scoring_pdf_and_verification_serialization,
    ]
    for test in tests:
        test()
        print(f"[OK] {test.__name__}")
    print("[OK] offline smoke checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
