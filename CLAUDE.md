# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**evil-read-arxiv** is a collection of Claude Code Skills that automate academic paper research workflows. It searches arXiv, Semantic Scholar, DBLP, and Google Scholar for papers, scores/ranks them by research interest, and generates structured Obsidian notes with images and knowledge graph links.

## Architecture

The project is organized as **6 independent Claude Code skills**, each in its own directory with a `SKILL.md` definition and `scripts/` folder containing Python scripts:

- **start-my-day** — Daily paper recommendations. Searches arXiv (last 30 days) + Semantic Scholar (last year), applies 4-dimensional scoring (relevance 40%, popularity 30%, recency 20%, quality 10%), generates a daily note, then auto-triggers paper-analyze + extract-paper-images for the top 3.
- **paper-analyze** — Deep single-paper analysis. Downloads PDF + source package, generates structured Obsidian note with translations, method analysis, experimental results, and 5-dimension quality assessment.
- **extract-paper-images** — Image extraction with 3-tier priority: arXiv source package > PDF figure files > PDF direct extraction. Filters out icons/UI fragments by minimum size.
- **paper-search** — Searches existing vault notes via Grep (no dedicated Python script).
- **conf-papers** — Conference paper recommendations from DBLP + Semantic Scholar. Uses its own independent config (`conf-papers.yaml`), 3-dimensional scoring (relevance 40%, popularity 40%, quality 20%).
- **scholar-search** — Google Scholar paper search via Chrome CDP Proxy. Bypasses anti-bot measures using real browser automation. Uses its own config (`scholar-search.yaml`), 3-dimensional scoring (relevance 40%, popularity 40%, quality 20%). Requires Chrome + CDP Proxy running.

### Cross-skill dependencies

- `start-my-day` orchestrates `paper-analyze` and `extract-paper-images` for top-ranked papers
- `conf-papers` reuses `start-my-day/scripts/scan_existing_notes.py` for vault indexing
- `scholar-search` reuses `start-my-day/scripts/scan_existing_notes.py` and scoring functions from `search_arxiv.py`
- All skills write to the same Obsidian vault structure

### External APIs

- **arXiv API** — XML-based paper search, PDF/source downloads
- **Semantic Scholar API** — Citation counts, abstracts, author info (optional API key reduces rate limiting)
- **DBLP API** — Conference paper metadata lookup
- **Google Scholar** — Scraped via Chrome CDP Proxy (no official API); requires `web-access` skill's CDP Proxy

## Key Configuration

- `OBSIDIAN_VAULT_PATH` env var — Points to the Obsidian vault root (all scripts read this)
- `$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml` — Main research config (domains, keywords, arXiv categories, language)
- `conf-papers/conf-papers.yaml` — Independent config for conference searches (keywords, excluded keywords, default year/conferences, top_n)
- `scholar-search/scholar-search.yaml` — Independent config for Google Scholar searches (keywords, year range, CDP proxy port)
- `config.example.yaml` — Template; copy to vault's config path and customize

### Language setting

All skills support `language: "zh"` (Chinese, default) or `language: "en"` in the config. This controls note filenames, section headers, and content language.

## Development Commands

```bash
# Install dependencies
pip install -r requirements.txt   # PyYAML, requests, PyMuPDF

# Run individual scripts directly (for testing/debugging)
python start-my-day/scripts/search_arxiv.py --config "$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml"
python start-my-day/scripts/scan_existing_notes.py --vault "$OBSIDIAN_VAULT_PATH" --output existing_notes_index.json
python start-my-day/scripts/link_keywords.py --file /path/to/note.md --index existing_notes_index.json
python paper-analyze/scripts/generate_note.py --vault "$OBSIDIAN_VAULT_PATH" --paper-id "2402.12345" --title "Title" --authors "Author" --domain "Domain"
python paper-analyze/scripts/update_graph.py --vault "$OBSIDIAN_VAULT_PATH" --paper-id "2402.12345" --title "Title" --domain "Domain"
python extract-paper-images/scripts/extract_images.py --paper-id "2402.12345" --output-dir /path/to/images/
python conf-papers/scripts/search_conf_papers.py --year 2024 --conferences "ICLR,CVPR"
python scholar-search/scripts/search_scholar.py --config scholar-search/scholar-search.yaml --cdp-url http://localhost:3457 --year-from 2024 --year-to 2025
```

There is no formal test suite. Scripts are validated by running them end-to-end.

## Obsidian Vault Structure (Required)

```
Vault/
├── 10_Daily/                              # Daily/conference recommendation notes
├── 20_Research/Papers/<DomainName>/        # Paper notes organized by domain
│   └── <PaperTitle>/images/               # Extracted images per paper
└── 99_System/Config/
    └── research_interests.yaml            # Research config
```

## Obsidian Format Rules

When generating or editing notes that go into the Obsidian vault:

- Use **wikilinks with display aliases**: `[[File_Name|Display Title]]`
- Use **Obsidian image syntax**: `![[filename.png|600]]` (not standard markdown `![](...)`)
- Frontmatter: quote all string values in YAML
- Never use `---` as placeholder text (Obsidian interprets it as a YAML separator)
- Never use URL-encoded paths (Obsidian doesn't decode them)

## Scoring System

Papers are scored on weighted dimensions before recommendation:

| Context | Relevance | Recency | Popularity | Quality |
|---------|-----------|---------|------------|---------|
| Daily (arXiv) | 40% | 20% | 30% | 10% |
| Conference | 40% | — | 40% | 20% |
| Scholar | 40% | — | 40% | 20% |

Scoring logic lives in `search_arxiv.py:calculate_recommendation_score`, `search_conf_papers.py`, and `search_scholar.py`.
