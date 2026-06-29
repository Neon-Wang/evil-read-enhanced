# Translated PDF Station

Single-port download station for Start My Day translated Chinese PDF batches.

## Runtime Contract

- Default bind: `127.0.0.1:18082`
- External reverse-proxy domain: `https://code-file.jiashengfan.space`
- Manifest: `C:\GitClient\windows\repos\evilread-workspace\downloads\translated-pdfs\manifest.csv`
- Zip batches: `C:\GitClient\windows\repos\evilread-workspace\downloads\translated-pdfs\batches\<YYYY-MM-DD>\<run_id>.zip`

## Commands

```powershell
pnpm install
pnpm build
pnpm serve:downloads
```

Environment overrides:

```powershell
$env:PORT = "18082"
$env:HOST = "127.0.0.1"
$env:EVILREAD_WORKSPACE = "C:\GitClient\windows\repos\evilread-workspace"
$env:DOWNLOAD_BASE_URL = "https://code-file.jiashengfan.space"
pnpm serve:downloads
```

## API

- `GET /health`
- `GET /api/runs`
- `GET /api/runs/:runId`
- `GET /downloads/:runId.zip`

The UI reads `/api/runs`, opens the latest run by default, shows file-level manifest rows, and uses the external `code-file.jiashengfan.space` URL for the download button.
