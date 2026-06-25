#!/usr/bin/env python3
"""Run a multi-source paper query and emit normalized JSON."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from paper_query.config import load_config
from paper_query.orchestrator import build_request, query_papers


def parse_sources(value: str):
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Multi-source academic paper query")
    parser.add_argument("--query", default="", help="Search query/topic")
    parser.add_argument("--sources", default="", help="Comma-separated sources: arxiv,semantic_scholar,dblp,google_scholar,nature")
    parser.add_argument("--config", default=str(SCRIPT_DIR.parent / "paper-query.yaml"), help="paper-query config path")
    parser.add_argument("--research-config", default="", help="Optional research_interests.yaml path")
    parser.add_argument("--year-from", type=int, default=None)
    parser.add_argument("--year-to", type=int, default=None)
    parser.add_argument("--top-n", type=int, default=None)
    parser.add_argument("--max-pages", type=int, default=None)
    parser.add_argument("--download-pdfs", action="store_true")
    parser.add_argument("--output", default="", help="Output JSON path; stdout when omitted")
    args = parser.parse_args()

    config = load_config(args.config, args.research_config)
    request = build_request(
        config,
        query=args.query,
        sources=parse_sources(args.sources),
        year_from=args.year_from,
        year_to=args.year_to,
        top_n=args.top_n,
        max_pages=args.max_pages,
        download_pdfs=args.download_pdfs,
    )
    result = query_papers(request, config)
    encoded = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(encoded + "\n", encoding="utf-8")
    else:
        print(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
