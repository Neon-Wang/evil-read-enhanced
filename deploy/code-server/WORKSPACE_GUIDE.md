# EvilRead Workspace Execution Guide

This guide is the operational contract for the local EvilRead workbench on this Windows host. The source-of-truth workspace file is:

```text
C:\Users\O2\Documents\GitHub\evil-read-enhanced\deploy\code-server\evilread.code-workspace
```

The running code-server instance may cache this content under:

```text
%LOCALAPPDATA%\EvilRead\code-server\user-data\User\caches\CachedConfigurations\workspaces\
```

Do not edit the cached copy as the durable source. Update `deploy/code-server/evilread.code-workspace`, then restart code-server.

## Workspace Shape

The workbench opens two folders:

- `evilread-workspace`: `C:\GitClient\windows\repos\evilread-workspace`
- `evil-read-enhanced`: `C:\Users\O2\Documents\GitHub\evil-read-enhanced`

The integrated terminal starts in:

```text
C:\GitClient\windows\repos\evilread-workspace
```

This is intentional: operators usually inspect vault, Zotero mirror, daily notes, Research notes, and generated downloads first. Implementation scripts live in the second folder.

## Core Runtime Roles

- `scripts/run-start-my-day.ps1`: production wrapper for scheduled/manual Start My Day.
- `tools/start_my_day_orchestrator.py`: full loop coordinator.
- `tools/start_my_day_daily.py`: daily report renderer and Zotero mirror entry.
- `tools/research_index.py`: `20_Research` note completion and paper digest indexing.
- `tools/package_translated_pdfs.py`: incremental Chinese PDF zip packager.
- `translated-pdf-station/`: React + Node single-port station for translated PDF batch browsing and downloads.
- `deploy/code-server/start.ps1`: local code-server workbench entry.

## VS Code Tasks

Open Command Palette and run `Tasks: Run Task`.

Available tasks:

- `EvilRead: Start code-server workbench`
- `Start My Day: production run`
- `Start My Day: dry run without email/git/Zotero import`
- `Verify: loop smoke checks`
- `Translated PDF Station: build`
- `Translated PDF Station: serve 18082`

Production runs deliberately do not pass `-NoSendEmail`, `-SkipGit`, or `-SkipZoteroImport`.

## Start My Day Production Path

Manual production run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\O2\Documents\GitHub\evil-read-enhanced\scripts\run-start-my-day.ps1"
```

Dry-run validation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\O2\Documents\GitHub\evil-read-enhanced\scripts\run-start-my-day.ps1" -NoSendEmail -SkipGit -SkipZoteroImport
```

Expected production loop:

1. Pull/sync the workspace repository.
2. Reflect prior daily comments.
3. Discover confirmed/exploration papers.
4. Import Collections and discovered papers into Zotero.
5. Mirror Zotero PDFs, translated PDFs, metadata, and BibTeX.
6. Update `zotero/INDEX.md`.
7. Complete and index `vault/20_Research` notes.
8. Package incremental `*.zh.pdf` into a persistent zip.
9. Render the daily report with code-server and code-file links.
10. Send formatted email.
11. Commit/push the workspace result when enabled.
12. Close Chrome at the end of the orchestrator run.

## Translated PDF Station

Default local endpoint:

```text
http://127.0.0.1:18082
```

External reverse-proxy domain:

```text
https://code-file.jiashengfan.space
```

The station reads:

```text
C:\GitClient\windows\repos\evilread-workspace\downloads\translated-pdfs\manifest.csv
```

It serves:

- `GET /health`
- `GET /api/runs`
- `GET /api/runs/:runId`
- `GET /downloads/:runId.zip`

The daily report should link to:

```text
https://code-file.jiashengfan.space/downloads/<run_id>.zip
```

## Verification Commands

Repository smoke:

```powershell
C:\Users\O2\Documents\GitHub\evil-read-enhanced\.venv\Scripts\python.exe C:\Users\O2\Documents\GitHub\evil-read-enhanced\tools\tests\smoke_loop.py
```

Translated PDF station:

```powershell
cd C:\Users\O2\Documents\GitHub\evil-read-enhanced\translated-pdf-station
C:\Users\O2\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd run typecheck
C:\Users\O2\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd run lint
C:\Users\O2\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd run build
```

Station API:

```powershell
Invoke-RestMethod http://127.0.0.1:18082/health
Invoke-RestMethod http://127.0.0.1:18082/api/runs
```

## Scheduled Automation

Codex automation ID:

```text
weekly-start-my-day-sunday-06
```

Intended behavior:

- Every Sunday at 06:00 Asia/Shanghai.
- Create/run as an independent Codex automation job/session.
- Use workspace `C:\Users\O2\Documents\GitHub\evil-read-enhanced`.
- Execute `scripts/run-start-my-day.ps1` as a production run.
- Report daily note path, email status, translated PDF zip link, key logs, and verification evidence in Chinese.

## Recovery Notes

- If code-server opens an old or empty workspace, restart it with `deploy/code-server/start.ps1`; do not edit cached workspace JSON.
- If `127.0.0.1:18081` is occupied, this is expected; translated PDF station uses `18082`.
- Runtime logs under `logs/` are local artifacts and are ignored by git.
- Secrets must stay in environment variables or external credential stores, never in the workspace file.
