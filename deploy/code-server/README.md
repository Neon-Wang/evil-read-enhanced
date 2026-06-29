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

The installer checks the Node.js major required by the pinned code-server version and installs it with `winget` if needed. It then installs `code-server@4.117.0` with npm into a short path:

```text
C:\cs117
```

The short install path is intentional. Newer code-server npm releases build native VS Code dependencies during install; long Windows paths can exceed the legacy 260-character MSBuild path limit.

- `yzhang.markdown-all-in-one`
- `jishii1204.markdown-live-editor`
- `tomoki1207.pdf`
- `foam.foam-vscode` optional, installed by default because this is an Obsidian-style knowledge workspace
- `johnny-zhao.oai-compatible-copilot@0.3.6` installed from Marketplace VSIX cache

By default the installer also downloads the latest `openai.chatgpt` VSIX from Marketplace and installs it from the local VSIX cache. This is required because the Codex extension currently has pre-release-only Marketplace packaging and code-server cannot install it by extension ID alone.

`johnny-zhao.oai-compatible-copilot` is pinned to `0.3.6` because `0.4.x` requires VS Code `^1.120.0`, while `code-server@4.117.0` currently embeds Code `1.117.0`.

Use `-SkipCodexPreRelease` if you want to install only code-server and the knowledge-workspace extensions.

The installer also runs `patch-markdown-live-editor.ps1`. That patch makes Markdown Live Editor send clicked links back through VS Code instead of letting the browser resolve them under `/static/out/vs/workbench/...`. This is required for Obsidian-style relative links such as `../../../../zotero/library/items/C43KBR9V.pdf`.

Markdown Live Editor is installed but disabled by the start script. It is kept under the runtime root so it can be re-enabled later without finding the extension again.

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

For the full execution framework, reusable VS Code tasks, Start My Day production path, translated PDF station, and scheduled automation contract, see [WORKSPACE_GUIDE.md](./WORKSPACE_GUIDE.md).

The start script enables the Codex extension's proposed API gate:

```text
--enable-proposed-api openai.chatgpt
```

Open the Codex side bar from the Codex activity-bar icon or run `Codex: Open Codex Sidebar` from the command palette. On this host, `code-server@4.117.0` with `openai.chatgpt@26.5623.42026` renders the Codex side bar and shows local Codex Tasks from the host account. The browser console still reports that `chatSessionsProvider` and `languageModelProxy` proposals do not exist in code-server's VS Code Web build, so VS Code's native chat session integration is not expected to be complete.

## Markdown Reading and Editing

Markdown files open in the normal source editor by default so they remain editable.

For an Obsidian-like reading surface while editing, use VS Code's source-plus-preview workflow:

```text
Ctrl+K V
```

That opens a rendered Markdown preview beside the source editor. Edits in the source pane update the preview live, and preview/editor scrolling is synchronized.

Markdown Live Editor remains installed under `%LOCALAPPDATA%\EvilRead\code-server\extensions-disabled`, but code-server does not load it while it is disabled.

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
- Markdown opens as editable source, and `Ctrl+K V` provides rendered live preview beside it
- a PDF can be opened with a web-compatible PDF viewer extension or browser fallback
- the integrated terminal can run PowerShell, Git, and the EvilRead Python tools

## Docker or WSL Fallback

Docker or WSL can run code-server, but they are not the default here because this workbench must operate on the real Windows working trees and use the host Git credentials without a mirror or broker.
