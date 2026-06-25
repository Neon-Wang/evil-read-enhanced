# Loop Design v1.5 - Zotero + Obsidian Monorepo

> Status: updated on 2026-06-25 after the Zotero attachment and monorepo decision.
> Goal: make paper discovery, Zotero ingestion, PDF translation, Obsidian reading, comments, and preference feedback a repeatable loop across multiple computers.

## 1. Decisions

| Decision | Current choice |
|---|---|
| Sync repository | `o2/evilread-workspace` |
| Local workspace | `C:\GitClient\windows\repos\evilread-workspace` |
| Obsidian vault | `C:\GitClient\windows\repos\evilread-workspace\vault` |
| Zotero artifact mirror | `C:\GitClient\windows\repos\evilread-workspace\zotero` |
| Zotero native storage | Original and translated PDFs are stored as Zotero stored attachments on the parent item |
| Cross-device links | Obsidian notes link to `../zotero/...` paths relative to files inside `vault/` |
| Large files | `zotero/**/*.pdf` and `zotero/library/translated/**` are tracked with Git LFS |

The previous two-repo layout (`evilread-vault` plus `evilread-zotero`) is superseded. Current tools should treat `evilread-workspace` as the only sync root.

## 2. Repository Shape

```text
evilread-workspace/
├── README.md
├── .gitattributes
├── .gitignore
├── vault/
│   ├── 10_Daily/
│   ├── 20_Research/Papers/
│   ├── 30_Inbox/Zotero/
│   ├── 99_System/Config/research_interests.yaml
│   ├── 99_System/Indexes/
│   └── templates/daily.md
└── zotero/
    ├── library/exports/library.bib
    ├── library/items/<zotero-parent-key>.json
    ├── library/items/<zotero-parent-key>.pdf
    ├── library/items/<zotero-parent-key>.zh.pdf
    └── library/translated/<translator-output>
```

The `zotero/` directory is a mirror for sync and relative links. It is not Zotero's live database and must not contain `zotero.sqlite`, `prefs.js`, extension state, credentials, caches, or logs.

## 3. Link Contract

Daily notes in `vault/10_Daily/` link to PDFs with paths like:

```markdown
[PDF](../../zotero/library/items/C43KBR9V.pdf)
[ZH](../../zotero/library/items/C43KBR9V.zh.pdf)
```

Zotero mirror notes in `vault/30_Inbox/Zotero/<year>/` link to PDFs with paths like:

```markdown
[C43KBR9V.pdf](../../../../zotero/library/items/C43KBR9V.pdf)
[C43KBR9V.zh.pdf](../../../../zotero/library/items/C43KBR9V.zh.pdf)
```

These links must resolve from the note location after cloning the same monorepo on another machine.

## 4. Data Flow

```text
[discover]  paper-query / scholar-search / conf-papers / browser-backed sources
    |
    v
[classify]  confirmed = user-selected or high-confidence reading targets
            exploration = diverse candidates for later review
    |
    v
[ingest]    tools/zotero_ingest.py
            - Save items through Zotero Connector/local API
            - Record collection intent tags
            - Write lightweight Obsidian mirror notes
    |
    v
[collect]   tools/zotero_runjs_collections.py
            - Use Zotero Run JavaScript to create/update native collections
            - Place items under Confirmed/<date> or Exploration/<date>
    |
    v
[translate] tools/translate_watch.py plus the user's Zotero PDF2zh pipeline
            - Wait for original PDF and translated PDF outputs
            - Record pending translation state when output is missing
    |
    v
[mirror]    tools/zotero_sync.py
            - Copy original PDF, translated PDF, JSON, and BibTeX into workspace/zotero
            - Keep large files under Git LFS patterns
    |
    v
[attach]    tools/zotero_runjs_attachments.py
            - Import workspace/zotero PDFs back into Zotero as stored attachments
            - Attach both EvilRead Original PDF and EvilRead Translated PDF
    |
    v
[read]      Obsidian daily note and Zotero mirror notes use relative links
    |
    v
[reflect]   tools/start_my_day_reflect.py
            - Parse comments from daily notes
            - Update research_interests.yaml and preference diff history
```

## 5. Start My Day Stages

1. **Fetch**: run `git -C C:\GitClient\windows\repos\evilread-workspace pull --ff-only`.
2. **Reflect**: parse the previous daily note's `## 我的想法（Start My Day Comments）` section and update `vault/99_System/Config/research_interests.yaml`.
3. **Discover**: run `paper-query` or compatible source tools and produce confirmed/exploration JSON files.
4. **Ingest**: write candidates to Zotero, record intended collections, and create Obsidian mirror notes.
5. **Native collections**: run the Zotero Run JavaScript collection script when connector-created items need collection placement.
6. **Translate**: use the user's Zotero PDF2zh workflow to produce `.zh.pdf` outputs.
7. **Mirror**: sync PDFs, translated PDFs, metadata, and BibTeX to `evilread-workspace/zotero`.
8. **Stored attachments**: import mirrored PDFs into Zotero parent items with `tools/zotero_runjs_attachments.py`.
9. **Daily note**: write `vault/10_Daily/<YYYY-MM-DD>论文推荐.md` with relative PDF links and the comments template.

## 6. Tool Responsibilities

| Path | Responsibility |
|---|---|
| `tools/zotero_ingest.py` | Save paper items through Zotero-supported local interfaces and write lightweight Obsidian mirror notes |
| `tools/zotero_runjs_collections.py` | Use Zotero Run JavaScript to create native collections and move items into them |
| `tools/translate_watch.py` | Observe original PDFs and translated outputs from the user's PDF2zh pipeline |
| `tools/zotero_sync.py` | Mirror PDFs, translated PDFs, metadata, and BibTeX into `evilread-workspace/zotero` |
| `tools/zotero_runjs_attachments.py` | Import mirrored original and translated PDFs into Zotero as stored attachments |
| `tools/start_my_day_daily.py` | Generate daily notes with confirmed/exploration sections and monorepo-relative PDF links |
| `tools/start_my_day_reflect.py` | Parse daily comments and update preference config plus diff history |
| `tools/safety_scan.py` | Scan for obvious secrets before committing sync artifacts |

## 7. Safety Rules

- Never modify `C:\Users\O2\Zotero` internals directly.
- Zotero writes must use supported Zotero local interfaces or Zotero Run JavaScript.
- Keep Zotero runtime files and credentials out of `evilread-workspace`.
- Do not commit or push from `evil-read-enhanced` unless the user explicitly asks.
- Commit and push `evilread-workspace` only after an explicit user request.
- Before network Git operations, use the configured local proxy detection workflow.

## 8. Dry Run Acceptance

The 2026-06-25 dry run is considered healthy when:

- `evilread-workspace` contains both `vault/` and `zotero/`.
- Confirmed parent items in Zotero have native collection placement.
- Confirmed parent items have both original and translated PDFs as stored Zotero attachments.
- `vault/10_Daily/<date>论文推荐.md` contains relative links to mirrored PDFs.
- `vault/30_Inbox/Zotero/<year>/<key>.md` contains relative links to mirrored PDFs.
- `tools/tests/smoke_loop.py` and `paper-query/scripts/smoke_offline.py` pass.
