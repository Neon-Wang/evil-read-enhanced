# Zotero Environment Contract

This document is the portable Zotero environment contract for EvilRead. A machine is not ready for production `start-my-day` until the active Zotero profile has the same plugin set and the audit below is clean.

## Current Finding

On this Windows host the currently detected active profile is:

```text
C:\Users\O2\AppData\Roaming\Zotero\Zotero\Profiles\jreb5ppf.default
```

At the time this contract was written, that profile had:

```json
{"schemaVersion":37,"addons":[]}
```

That means the active profile itself is not enough evidence of a closed Zotero environment. Use the plugin manifest below and rerun the audit after installing plugins.

## Plugin Source

The local migration package contains the XPI files here:

```text
C:\Users\O2\Documents\Zotero-preparation\zotero-migration-extracted\zotero-migration-20260620-165339\plugins-xpi
```

Ignore AppleDouble files whose names start with `._`.

Available XPI files observed in that directory:

```text
immersive-translate-v0.0.23.xpi
jasminum@linxzh.com.xpi
Knowledge4Zotero@windingwind.com.xpi
pdf2zh@guaguastandup.com.xpi
tara@linxzh.com.xpi
zoplicate@chenglongma.com.xpi
zotero-format-metadata@northword.cn.xpi
zotero-pdf-2-zh-v4.0.3.xpi
zoteroattanger@polygon.org.xpi
zoteroif@qnscholar.xpi
zoteropdftranslate@euclpts.com.xpi
zoteroreference@polygon.org.xpi
zoterostyle@polygon.org.xpi
zoterotag@euclpts.com.xpi
```

## Expected Plugins

| Plugin ID | Version | Required | Purpose |
|---|---:|---|---|
| `jasminum@linxzh.com` | 1.1.37 | yes | Chinese metadata translators and lookup |
| `zoplicate@chenglongma.com` | 5.0.8 | yes | Duplicate detection support |
| `zoteropdftranslate@euclpts.com` | 2.4.5 | yes | PDF/selection translation workflow |
| `zoteroattanger@polygon.org` | 1.4.7 | yes | Attachment management |
| `Knowledge4Zotero@windingwind.com` | 3.2.2 | yes | Structured notes and paper reading workspace |
| `zoterotag@euclpts.com` | 2.5.2 | yes | Automation actions used by import/reconciliation routines |
| `zotero-format-metadata@northword.cn` | 3.3.0 | yes | Metadata normalization |
| `pdf2zh@guaguastandup.com` | 4.0.3 | yes | Chinese translated PDF generation |
| `zoteroif@qnscholar` | 1.6.0 | optional | Journal impact factor context |
| `tara@linxzh.com` | 1.0.11 | optional | Portable Zotero settings backup |
| `zoterostyle@polygon.org` | 6.0.8 | optional | Library table styling and visual fields |
| `zoteroreference@polygon.org` | 1.7.5 | optional | Reference panel support |

`immersive-translate-v0.0.23.xpi` and `zotero-pdf-2-zh-v4.0.3.xpi` are kept as local package artifacts. Do not treat them as replacements for the required Zotero plugin IDs unless a later audit proves that the active Zotero addon ID matches the expected manifest.

## Install Steps

1. Start Zotero.
2. Open `Tools -> Add-ons`.
3. Use the gear menu and choose `Install Add-on From File`.
4. Install each required XPI from the plugin source directory. Do not install files beginning with `._`.
5. Restart Zotero after plugin installation.
6. Open `Tools -> Add-ons` again and confirm the required plugins are enabled.
7. Run the audit command below.

## Audit Command

From this repository:

```powershell
.\.venv\Scripts\python.exe tools\zotero_env_audit.py `
  --plugin-source "C:\Users\O2\Documents\Zotero-preparation\zotero-migration-extracted\zotero-migration-20260620-165339\plugins-xpi"
```

Expected production result:

```text
status: ok
missing_required:
  - none
```

For machine-readable output:

```powershell
.\.venv\Scripts\python.exe tools\zotero_env_audit.py `
  --plugin-source "C:\Users\O2\Documents\Zotero-preparation\zotero-migration-extracted\zotero-migration-20260620-165339\plugins-xpi" `
  --json
```

## Start My Day Gate

Before production `start-my-day` on a new or repaired machine:

1. `tools\zotero_env_audit.py` must report `status: ok`.
2. Zotero local API must answer on `http://127.0.0.1:23119/api/users/0`.
3. `tools\zotero_closure_audit.py` must report no duplicate title groups and no missing original/translated attachments for mirrored PDFs.
4. `start-my-day` may proceed only after the Git workspace mirror is pulled and clean.

## Security Boundary

Do not commit or copy these Zotero runtime files into this repository:

- `zotero.sqlite`
- `prefs.js`
- Zotero `storage/`
- plugin `.xpi` binaries
- `%APPDATA%\CodexZoteroPDF2zh\.env`
- API keys, tokens, SMTP credentials, relay credentials

Only this contract, audit scripts, and encrypted relay envelopes belong in Git.
