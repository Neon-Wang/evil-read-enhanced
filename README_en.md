# evil-read-arxiv

> Automated paper reading workflow - Search, recommend, analyze and organize research papers

## 语言 / Language

- [中文版](README.md)
- [English Version](README_en.md)

## Introduction

This is a collection of Claude Code Skills for automating research paper search, recommendation, analysis, and organization. It now supports arXiv, Semantic Scholar, DBLP, Google Scholar, and Nature through a unified `paper-query` entry point, with browser-assisted retrieval, PDF link detection, source provenance, and deep-research-style synthesis.

## Features

### 1. start-my-day - Daily Paper Recommendations
- Search papers from arXiv in the last month
- Search highly-cited papers from Semantic Scholar in the past year
- Comprehensive scoring based on relevance, recency, popularity, and quality
- Auto-generate daily overview and recommendation list
- Top 3 papers get detailed analysis and image extraction
- Auto-link keywords to existing notes

### 2. paper-analyze - Deep Paper Analysis
- Deep analysis of individual papers
- Generate structured notes including:
  - Abstract translation and key points
  - Research background and motivation
  - Method overview and architecture
  - Experimental results analysis
  - Research value assessment
  - Advantages and limitations analysis
  - Comparison with related papers
- Auto-extract paper images and insert into notes
- Update knowledge graph

### 3. extract-paper-images - Paper Image Extraction
- Prefer extracting high-quality images from arXiv source packages
- Fallback to PDF image extraction
- Auto-generate image index
- Save to notes directory's images subfolder

### 4. paper-search - Paper Note Search
- Search existing notes
- Support searching by title, author, keywords, domain
- Sort by relevance score

### 5. conf-papers - Conference Paper Recommendations
- Search top conference papers from CVPR/ICCV/ECCV/ICLR/AAAI/NeurIPS/ICML
- Use DBLP for publication metadata and Semantic Scholar for abstracts/citations
- Independent `conf-papers.yaml` configuration

### 6. scholar-search - Google Scholar Recommendations
- Search Google Scholar through Chrome CDP Proxy (`http://localhost:3457` by default)
- Supports keyword search, year filters, pagination, CAPTCHA/manual handling, and optional S2 enrichment

### 7. paper-query - Multi-Source Paper Query and Deep Research
- Query arXiv, Semantic Scholar, DBLP, Google Scholar, and Nature from one entry point
- Normalize results into one `PaperRecord` schema with provenance and verification status
- Dedupe by DOI, arXiv ID, Semantic Scholar URL, primary URL, and normalized title
- Detect PDF links and status; PDF download is opt-in
- Supports Chrome CDP Proxy and optional Kimi WebBridge for real-browser sessions
- Can hand structured results to Claude Code `deep-research` for verified recommendation reports

## Installation

### Prerequisites

1. **Claude Code CLI** - Install and configure Claude Code
2. **Python 3.8+** - For running search and analysis scripts
3. **Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Browser backend** for Google Scholar/Nature sources:
   - Chrome CDP Proxy: default `http://localhost:3457`, compatible with the existing `scholar-search` flow
   - Kimi WebBridge (optional): default `http://127.0.0.1:10086`, useful for real-browser login sessions and Nature PDF links

### Installation Steps

1. Clone or copy this repository to your Claude Code skills directory:
   ```bash
   # Windows PowerShell
   Copy-Item -Recurse evil-read-arxiv\start-my-day $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\paper-analyze $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\extract-paper-images $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\paper-search $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\conf-papers $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\scholar-search $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\paper-query $env:USERPROFILE\.claude\skills\

   # macOS/Linux
   cp -r evil-read-arxiv/start-my-day ~/.claude/skills/
   cp -r evil-read-arxiv/paper-analyze ~/.claude/skills/
   cp -r evil-read-arxiv/extract-paper-images ~/.claude/skills/
   cp -r evil-read-arxiv/paper-search ~/.claude/skills/
   cp -r evil-read-arxiv/conf-papers ~/.claude/skills/
   cp -r evil-read-arxiv/scholar-search ~/.claude/skills/
   cp -r evil-read-arxiv/paper-query ~/.claude/skills/
   ```

2. Configure environment variables and paths (see "Configuration" below)

3. Restart Claude Code CLI

## Configuration

> **Strongly recommended**: Read [QUICKSTART.md](QUICKSTART.md) for quick setup.

### Step 1: Set Environment Variables (Recommended)

All scripts read the Obsidian Vault path from the `OBSIDIAN_VAULT_PATH` environment variable:

```bash
# Windows PowerShell (temporary)
$env:OBSIDIAN_VAULT_PATH = "C:/Users/YourName/Documents/Obsidian Vault"

# Windows PowerShell (permanent)
[System.Environment]::SetEnvironmentVariable("OBSIDIAN_VAULT_PATH", "C:/Users/YourName/Documents/Obsidian Vault", "User")

# macOS/Linux (add to ~/.bashrc or ~/.zshrc)
export OBSIDIAN_VAULT_PATH="/Users/yourname/Documents/Obsidian Vault"
```

### Step 2: Create Config File

Copy `config.example.yaml` and modify:

```bash
cp config.example.yaml config.yaml
```

Edit `config.yaml`, modify keywords based on your research interests:

```yaml
# Language setting (zh/en)
language: "en"

vault_path: "/path/to/your/obsidian/vault"

research_domains:
  "LLM":
    keywords:
      - "pre-training"
      - "foundation model"
      - "large language model"
      - "LLM"
    arxiv_categories:
      - "cs.AI"
      - "cs.LG"
```

Then copy the modified `config.yaml` to your Vault:
```bash
cp config.yaml "$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml"
```

### Step 3 (Optional): Override Paths via CLI Parameters

If you don't want to set environment variables, you can specify paths via parameters each time:

```bash
python scripts/search_arxiv.py --config "/your/path/research_interests.yaml"
python scripts/scan_existing_notes.py --vault "/your/obsidian/vault"
python scripts/generate_note.py --vault "/your/obsidian/vault" --paper-id "2402.12345" --title "Paper Title" --authors "Author" --domain "LLM" --language "en"
python scripts/update_graph.py --vault "/your/obsidian/vault" --paper-id "2402.12345" --title "Paper Title" --domain "LLM" --language "en"
```

### Path Format Notes

- **Windows**: Use forward slashes `/` or double backslashes `\\`
  - Correct: `C:/Users/Name/Documents/Vault`
  - Correct: `C:\\Users\\Name\\Documents\\Vault`
  - Wrong: `C:\Users\Name\Documents\Vault` (single backslash needs escaping)

- **macOS/Linux**: Use forward slashes `/`
  - Correct: `/Users/name/Documents/Vault`

### Obsidian Directory Structure Requirements

Your Obsidian Vault needs to contain:

```
yourVault/
├── 10_Daily/                    # Daily recommendation notes (auto-created)
│   └── YYYY-MM-DD-Paper-Recommendations.md
├── 20_Research/
│   └── Papers/                  # Paper detailed notes directory
│       ├── LLM/
│       │   └── Paper-Title.md
│       │       └── images/      # Paper images
│       ├── Multimodal/
│       └── Agent/
└── 99_System/
    └── Config/
        └── research_interests.yaml  # Research interests config
```

## Usage

### Start Daily Paper Recommendations

In your Obsidian Vault directory, open terminal and enter:

```bash
start my day
```

This will:
1. Search high-quality papers from the last month and past year
2. Filter and score based on your research interests
3. Generate daily recommendation notes (saved to `10_Daily/`)
4. Auto-generate detailed analysis for top 3 papers
5. Extract paper images and insert into notes
6. Auto-link keywords to existing notes

### Analyze Individual Papers

If you want to deeply read a specific paper:

```bash
paper-analyze 2602.12345
# Or use paper title
paper-analyze "Paper Title"
```

This will:
1. Download paper PDF
2. Extract images
3. Generate detailed analysis notes
4. Update knowledge graph

### Extract Paper Images

```bash
extract-paper-images 2602.12345
```

### Search Existing Papers

```bash
paper-search "keyword"
```

### Multi-source Paper Query

```bash
paper-query "form meaning mappings language"
```

Or run the script directly:

```bash
python paper-query/scripts/run_query.py \
  --query "form meaning mappings language" \
  --sources arxiv,semantic_scholar,dblp,google_scholar,nature \
  --top-n 10
```

`paper-query` emits normalized JSON with source provenance, verification status, DOI/arXiv/S2 IDs, PDF link status, and recommendation scores. If the browser backend is unavailable, API-only sources still run and browser sources are marked as requiring manual/browser access.

### Search Google Scholar Papers

```bash
scholar-search
scholar-search 2024 2025
```

Requires Chrome CDP Proxy at `http://localhost:3457`.

## Directory Structure

```
evil-read-arxiv/
├── README.md                 # This file
├── README_en.md              # English version
├── QUICKSTART.md             # Quick start guide
├── config.example.yaml       # Config template
├── requirements.txt          # Python dependencies
├── start-my-day/             # Daily recommendation skill
│   ├── SKILL.md              # Skill definition
│   └── scripts/
│       ├── search_arxiv.py   # arXiv/Semantic Scholar search script
│       ├── scan_existing_notes.py  # Scan existing notes
│       └── link_keywords.py  # Auto keyword linking script
├── paper-analyze/            # Paper analysis skill
│   ├── SKILL.md
│   └── scripts/
│       ├── generate_note.py  # Generate note template
│       └── update_graph.py   # Update knowledge graph
├── extract-paper-images/      # Image extraction skill
│   ├── SKILL.md
│   └── scripts/
│       └── extract_images.py # Image extraction script
├── paper-search/             # Local paper note search skill
│   └── SKILL.md
├── conf-papers/              # Conference recommendation skill
│   ├── SKILL.md
│   ├── conf-papers.yaml
│   └── scripts/
│       └── search_conf_papers.py
├── scholar-search/           # Google Scholar recommendation skill
│   ├── SKILL.md
│   ├── scholar-search.yaml
│   └── scripts/
│       └── search_scholar.py
└── paper-query/              # Multi-source paper query skill
    ├── SKILL.md
    ├── paper-query.yaml
    └── scripts/
        ├── run_query.py
        ├── smoke_offline.py
        └── paper_query/
```

## Scoring Mechanism

Paper recommendation scoring is source-aware:

| Context | Relevance | Recency | Popularity | Quality / Verification |
|---------|-----------|---------|------------|------------------------|
| Daily arXiv | 40% | 20% | 30% | 10% quality |
| Conference DBLP | 40% | — | 40% | 20% quality |
| Google Scholar | 40% | — | 40% | 20% quality |
| paper-query | 40% | optional | 30% | 20% quality + 10% verification |

**Scoring Details**:
- **Relevance**: Title keyword match (+0.5/each), abstract keyword match (+0.3/each), category match (+1.0)
- **Recency**: Within 30 days (+3), 30-90 days (+2), 90-180 days (+1), 180+ days (0)
- **Popularity**: High impact citations > 100 (+3), 50-100 (+2), < 50 (+1)
- **Quality**: Multi-dimensional indicators

## Common arXiv Categories

| Category Code | Name | Description |
|---------------|------|-------------|
| cs.AI | Artificial Intelligence | Artificial Intelligence |
| cs.LG | Learning | Machine Learning |
| cs.CL | Computation and Language | Computational Linguistics/NLP |
| cs.CV | Computer Vision | Computer Vision |
| cs.MM | Multimedia | Multimedia |
| cs.MA | Multiagent Systems | Multi-Agent Systems |
| cs.RO | Robotics | Robotics |

## FAQ

### Q: No search results?
A: Check the following:
1. Confirm network connection is normal
2. Check if keywords in config file are correct
3. Try扩大搜索的 arXiv 分类范围 (try expanding the search arXiv category range)

### Q: Image extraction failed?
A:
1. Ensure PyMuPDF is installed: `pip install PyMuPDF`
2. Check if arXiv ID format is correct (e.g., 2602.12345)

### Q: Auto keyword linking not accurate?
A: You can modify the `COMMON_WORDS` set in `start-my-day/scripts/link_keywords.py` to add words you don't want auto-linked

### Q: "Papers directory not found" error?
A:
1. Check if `OBSIDIAN_VAULT_PATH` environment variable is set correctly
2. Confirm the directory structure is correct in your Obsidian Vault (20_Research/Papers/)

### Q: "Vault path not specified" error?
A: Set `OBSIDIAN_VAULT_PATH` environment variable, or specify path via `--vault`/`--config` parameters when calling scripts.

## Advanced Configuration

### Modify Search arXiv Categories

Specify via `--categories` parameter when calling `search_arxiv.py`:

```bash
python scripts/search_arxiv.py --categories "cs.AI,cs.LG,cs.CL,cs.CV"
```

### Modify Daily Recommendation Count

Specify via `--top-n` parameter when calling `search_arxiv.py`:

```bash
python scripts/search_arxiv.py --top-n 15
```

### Modify Scoring Weights

Adjust weights in the `calculate_recommendation_score` function in `start-my-day/scripts/search_arxiv.py`.

## How It Works

```
User inputs "start my day"
         ↓
    1. Load research config
    2. Scan existing notes to build index
         ↓
    3. Search arXiv (last 30 days)
    4. Search Semantic Scholar (past year hot papers)
         ↓
    5. Merge results and deduplicate
    6. Comprehensive scoring and sorting
    7. Take top N papers
         ↓
    8. Generate daily recommendation notes
    9. Generate detailed analysis for top 3
    10. Auto-link keywords
```

## Contributing

Welcome to submit Issues and Pull Requests!

If you find this project helpful, please give a Star ⭐️!

[![Star History Chart](https://api.star-history.com/svg?repos=juliye2025/evil-read-arxiv&type=Date)](https://star-history.com/#juliye2025/evil-read-arxiv&Date)

## License

MIT License

## Acknowledgments

- [arXiv](https://arxiv.org/) - Open-access academic preprint platform
- [Semantic Scholar](https://www.semanticscholar.org/) - AI-powered academic research platform
- [Claude Code](https://claude.ai/claude-code) - AI-assisted code and writing tool
- [Obsidian](https://obsidian.md/) - Powerful knowledge management tool
