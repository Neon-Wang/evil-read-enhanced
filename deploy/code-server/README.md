# EvilRead code-server Workbench

This directory contains the Windows-first deployment for an EvilRead browser workbench.

The default deployment opens the real repositories directly:

- `C:\GitClient\windows\repos\evilread-workspace`
- `C:\Users\O2\Documents\GitHub\evil-read-enhanced`

It does not create a host mirror and does not use a sandbox Git broker. The integrated terminal runs on the host and can use the real `git`, PowerShell, Python virtualenvs, SSH keys, and remotes.

## Security Boundary

The default listener is local-only:

```text
127.0.0.1:18080
```

Do not expose this port directly to the public internet. When Cloudflare is added later, publish only a Cloudflare Tunnel hostname and protect that hostname with Cloudflare Access. Keep code-server bound to `127.0.0.1` or a trusted private interface.

The start script uses `--auth none` because the intended external authentication layer is Cloudflare Access. This is acceptable only while the listener remains loopback/private. If you bind to anything public, stop and add Cloudflare Access first.

This directory must not contain:

- code-server passwords or tokens
- Cloudflare Access credentials or tunnel tokens
- Zotero runtime data such as `zotero.sqlite`, `prefs.js`, browser profiles, caches, or logs

Runtime state is written outside the repository by default:

```text
%LOCALAPPDATA%\EvilRead\code-server\
```

## Prerequisites

The default Windows install path uses npm because code-server does not publish Windows standalone releases.

Run:

```powershell
.\deploy\code-server\install.ps1
```

If PowerShell script execution is restricted in the current shell, run the same script with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\code-server\install.ps1
```

The installer checks for Node.js 20 and installs it with `winget` if needed. It then installs `code-server@4.93.1` globally with npm and installs recommended extensions. This pair is pinned for the native Windows npm deployment path: newer code-server npm releases currently expect newer Node versions but have Windows postinstall issues on this host. Upgrade only after re-verifying the Windows npm install path end to end.

- `yzhang.markdown-all-in-one`
- `tomoki1207.pdf`
- `foam.foam-vscode` optional, installed by default because this is an Obsidian-style knowledge workspace

## Start

```powershell
.\deploy\code-server\start.ps1
```

If PowerShell blocks direct script execution:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\code-server\start.ps1
```

Then open:

```text
http://127.0.0.1:18080
```

The opened workspace is `evilread.code-workspace`, with `evilread-workspace` as the first folder and `evil-read-enhanced` as the second folder.

## Stop

If started in the foreground, press `Ctrl+C` in the PowerShell window.

If started with `-Background`, stop it with:

```powershell
.\deploy\code-server\stop.ps1
```

## Optional Background Mode

```powershell
.\deploy\code-server\start.ps1 -Background
```

This writes a PID file under `%LOCALAPPDATA%\EvilRead\code-server\code-server.pid`.

Use the same `powershell -NoProfile -ExecutionPolicy Bypass -File ...` form if the current shell blocks `.ps1` execution.

## Later Cloudflare Tunnel

When Cloudflare Access/Tunnel is configured later:

1. Keep code-server bound to `127.0.0.1:18080`.
2. Configure `cloudflared` to route the protected hostname to `http://127.0.0.1:18080`.
3. Enforce Cloudflare Access on that hostname.
4. Do not commit tunnel credentials, Access policies, service tokens, or generated certs to this repository.

## Verification

After starting code-server, verify:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18080/ -TimeoutSec 10
git -C C:\GitClient\windows\repos\evilread-workspace status
git -C C:\GitClient\windows\repos\evilread-workspace fetch --dry-run
git -C C:\Users\O2\Documents\GitHub\evil-read-enhanced status
git -C C:\Users\O2\Documents\GitHub\evil-read-enhanced fetch --dry-run
C:\Users\O2\Documents\GitHub\evil-read-enhanced\.venv\Scripts\python.exe C:\Users\O2\Documents\GitHub\evil-read-enhanced\tools\tests\smoke_loop.py
```

Browser verification should confirm:

- the file tree shows both workspace folders
- a Markdown file can be opened and edited
- a PDF can be opened with the PDF viewer extension
- the integrated terminal can run PowerShell, Git, and the EvilRead Python tools

## Docker or WSL Fallback

Docker or WSL can run code-server, but they are not the default here because this workbench must operate on the real Windows working trees and use the host Git credentials without a mirror or broker.
