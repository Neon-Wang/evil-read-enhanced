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
            - start_my_day_daily.py calls the --all mirror path before writing the
              daily note when --workspace is provided
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
[insight]   tools/start_my_day_daily.py
            - Render topic overview, reading suggestions, per-paper summary,
              why-to-read rationale, observations, and next actions
            - Use deterministic metadata/abstract rules by default
            - Optionally call an OpenAI-compatible LLM endpoint and fall back to
              deterministic rules when the endpoint or key is unavailable
    |
    v
[reflect]   tools/start_my_day_reflect.py
            - Parse comments from daily notes
            - Keep raw preference comments in preference diff history
            - Update research_interests.yaml only from agent-analyzed preference_updates
```

## 5. Start My Day Stages

1. **Fetch**: run `git -C C:\GitClient\windows\repos\evilread-workspace pull --ff-only`.
2. **Reflect**: parse the previous daily note's `## 我的想法（Start My Day Comments）` section. Raw `+interest:` and `-avoid:` lines are audit input only and are written to `vault/99_System/preference_diffs/<date>.diff`; they must not be copied directly into `vault/99_System/Config/research_interests.yaml`. The calling Agent must provide `preference_updates` in `agent-decisions.json`, and only those normalized keywords/exclusions may update the config. In production email mode, missing `preference_updates` for raw preference comments is a hard failure.
3. **Discover**: run `paper-query` or compatible source tools and produce confirmed/exploration JSON files.
4. **Ingest**: write candidates to Zotero, record intended collections, and create Obsidian mirror notes.
5. **Native collections**: run the Zotero Run JavaScript collection script when connector-created items need collection placement.
6. **Translate**: use the user's Zotero PDF2zh workflow to produce `.zh.pdf` outputs.
7. **Mirror**: sync PDFs, translated PDFs, metadata, and BibTeX to `evilread-workspace/zotero`; during Start My Day, `tools/start_my_day_daily.py --workspace C:\GitClient\windows\repos\evilread-workspace` refreshes the mirror before writing the daily note.
8. **Stored attachments**: import mirrored PDFs into Zotero parent items with `tools/zotero_runjs_attachments.py`.
9. **Daily note**: write `vault/10_Daily/<YYYY-MM-DD>论文推荐.md` with relative PDF links, topic overview, reading suggestions, per-paper insight blocks, and the comments template.

## 6. Tool Responsibilities

| Path | Responsibility |
|---|---|
| `tools/zotero_ingest.py` | Save paper items through Zotero-supported local interfaces and write lightweight Obsidian mirror notes |
| `tools/zotero_runjs_collections.py` | Use Zotero Run JavaScript to create native collections and move items into them |
| `tools/translate_watch.py` | Observe original PDFs and translated outputs from the user's PDF2zh pipeline |
| `tools/zotero_sync.py` | Mirror PDFs, translated PDFs, metadata, and BibTeX into `evilread-workspace/zotero`; supports `--all` to enumerate top-level Zotero items through the local API |
| `tools/zotero_runjs_attachments.py` | Import mirrored original and translated PDFs into Zotero as stored attachments |
| `tools/start_my_day_daily.py` | Refresh the Zotero mirror when `--workspace` is provided, then generate daily notes with confirmed/exploration sections, insight summaries, reading suggestions, optional LLM enhancement, and monorepo-relative PDF links |
| `tools/start_my_day_reflect.py` | Parse daily comments, keep raw preference text in diff history, and update preference config only from Agent-normalized `preference_updates` |
| `tools/safety_scan.py` | Scan for obvious secrets before committing sync artifacts |

## 7. Safety Rules

- Never modify `C:\Users\O2\Zotero` internals directly.
- Zotero writes must use supported Zotero local interfaces or Zotero Run JavaScript.
- Keep Zotero runtime files and credentials out of `evilread-workspace`.
- Do not commit or push from `evil-read-enhanced` unless the user explicitly asks.
- Commit and push `evilread-workspace` only after an explicit user request.
- Before network Git operations, use the configured local proxy detection workflow.
- Do not commit LLM API keys. Configure Start My Day LLM enhancement with environment variables: `EVILREAD_LLM_API_KEY`, `EVILREAD_LLM_BASE_URL`, `EVILREAD_LLM_MODEL`.

## 8. Start My Day LLM Insight Configuration

`tools/start_my_day_daily.py` always produces a deterministic insight layer from titles, abstracts, mirror notes, statuses, and local PDF availability. To improve synthesis quality, set:

```powershell
$env:EVILREAD_LLM_BASE_URL = "https://api.jiashengfan.space"
$env:EVILREAD_LLM_MODEL = "gpt-5.5"
$env:EVILREAD_LLM_API_KEY = "<set locally; never commit>"
```

The tool sends a compact JSON payload to an OpenAI-compatible `/v1/chat/completions` endpoint and expects JSON with `overview`, `reading_suggestions`, and per-paper `summary`, `why`, `observations`, `next_action` fields. If the request fails, the daily note falls back to deterministic insight output.

## 9. Dry Run Acceptance

The 2026-06-25 dry run is considered healthy when:

- `evilread-workspace` contains both `vault/` and `zotero/`.
- Confirmed parent items in Zotero have native collection placement.
- Confirmed parent items have both original and translated PDFs as stored Zotero attachments.
- `vault/10_Daily/<date>论文推荐.md` contains relative links to mirrored PDFs plus `## 今日概览`, `## 今日阅读建议`, and per-paper insight blocks.
- `vault/30_Inbox/Zotero/<year>/<key>.md` contains relative links to mirrored PDFs.
- `tools/tests/smoke_loop.py` and `paper-query/scripts/smoke_offline.py` pass.

## 10. Full Closed Loop v1.6

`tools/start_my_day_orchestrator.py` is the single-command entry point for the current closed loop:

```powershell
.\.venv\Scripts\python.exe tools\start_my_day_orchestrator.py `
  --workspace C:\GitClient\windows\repos\evilread-workspace `
  --date <YYYY-MM-DD> `
  --send-email
```

Windows Task Scheduler should call the wrapper so the repo-local virtualenv,
default workspace, date, and email preflight stay consistent:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\O2\Documents\GitHub\evil-read-enhanced\scripts\run-start-my-day.ps1"
```

The wrapper checks required mail environment variables by presence only and
does not print values. For local validation, run it with
`-NoSendEmail -SkipGit -SkipZoteroImport` against a temporary workspace.

The orchestrator runs these stages in order:

1. If `evilread-workspace` is dirty, commit allowed user edits first with explicit paths only.
2. Pull remote changes. Clean workspaces use `git pull --ff-only`; dirty workspaces are first committed, then use `git pull --rebase`.
3. Push the pre-start user edit commit when one was created.
4. Parse the previous daily note comments.
5. Process comment questions and free-form requests.
6. Ensure Zotero local API is available. If it is down, try to start Zotero and poll the local API. If Zotero still cannot be reached, continue with a degraded daily report, skip collections import/mirror/research sync, and write `pending:` comments for the next run.
7. Import only root-level `collections/*.pdf` files into Zotero.
8. Archive successful imports under `collections/imported/<date>/` and failed imports under `collections/fails/<date>/`. `pending-verification`, `pending`, and `skipped` import results are not moved into `fails`; the root PDF stays in place for the next run or manual verification.
9. Sync Zotero metadata, original PDFs, translated PDFs, and BibTeX into `zotero/`.
10. Generate `zotero/INDEX.md` with code-server friendly links to JSON, PDF, translated PDF, and Research notes.
11. Ensure `vault/20_Research/Papers/**.md` has full-level Research notes for Zotero items.
12. Generate `vault/10_Daily/<YYYY-MM-DD>论文日报.md`.
13. Promote successfully imported Collections PDFs into the daily recommendation section with the same insight treatment as normal recommendations.
14. Apply the humanizer style to daily report prose only. Research notes remain formal and structured.
15. Commit and push Start My Day changes in `evilread-workspace`.
16. Send the Markdown daily report file content verbatim by email.
17. Record email status in the daily note and commit/push that status if it changed.

The pre-start dirty sync stages only these paths:

```text
collections
zotero
vault/10_Daily
vault/20_Research
vault/30_Inbox
vault/99_System
```

Never use `git add .`, `git add -A`, `git reset --hard`, `git checkout -- <path>`, or `git clean` in the scheduled loop.

`tools/cat_email.py` no longer imports from an external CAT repository. It uses the self-contained `tools/cat_mailer.py`, which keeps the minimal CAT-compatible wrapper and sends via the recommended `cf_relay` provider.

Runtime email configuration is read only from environment variables. Do not put real values in source files, daily notes, workspace logs, or commit messages. Required `cf_relay` variables are:

```text
CAT_EMAIL_PROVIDER=cf_relay
CAT_CF_RELAY_URL=<relay url>
CAT_CF_RELAY_SECRET=<relay secret>
CAT_FROM_EMAIL=<from email>
CAT_FRONTEND_URL=<frontend url>
```

The email subject is `CAT — EvilRead 日报 - <YYYY-MM-DD>`. The body passed into the CAT wrapper is exactly the Markdown content of the generated daily report.

If the CLI hits a fatal error and `--send-email` is enabled, it attempts to send a short failure notice through the same self-contained CAT mailer. The failure notice does not include secrets. Recoverable dependency failures such as Zotero local API outage should produce a degraded daily report instead of leaving the user without email. Git sync failures are the exception: `git pull --rebase` conflicts and `git push` failures abort the task and suppress all email because the workspace state is not safe to report as completed.

Pending work is written into the daily comments section as:

```text
- pending: <task and reason>
```

The next `start-my-day` run parses these lines and treats them as requests to retry.
