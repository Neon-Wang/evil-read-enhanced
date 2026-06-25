#!/usr/bin/env python3
"""Check PDF2zh health and wait for translated PDF artifacts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request


def check_json(url: str, timeout: int = 5) -> dict:
    request = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8")
    return json.loads(body) if body else {}


def ensure_pdf2zh(start_script: Path | None = None) -> dict[str, object]:
    status: dict[str, object] = {}
    for label, url in {
        "server": "http://127.0.0.1:8890/health",
        "proxy": "http://127.0.0.1:8891/health",
    }.items():
        try:
            status[label] = check_json(url)
        except (OSError, urllib.error.URLError) as exc:
            status[label] = {"status": "error", "message": str(exc)}
    if all(isinstance(value, dict) and value.get("status") == "ok" for value in status.values()):
        return status
    if start_script and start_script.exists():
        subprocess.run(
            ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(start_script)],
            check=False,
            capture_output=True,
            text=True,
        )
        for label, url in {
            "server": "http://127.0.0.1:8890/health",
            "proxy": "http://127.0.0.1:8891/health",
        }.items():
            try:
                status[label] = check_json(url)
            except (OSError, urllib.error.URLError) as exc:
                status[label] = {"status": "error", "message": str(exc)}
    return status


def wait_for_translations(
    item_keys: list[str],
    translated_dir: Path,
    timeout_seconds: int,
    poll_seconds: int,
) -> dict[str, str]:
    deadline = time.time() + timeout_seconds
    pending = set(item_keys)
    found: dict[str, str] = {}
    while pending and time.time() <= deadline:
        for item_key in list(pending):
            matches = sorted(translated_dir.glob(f"*{item_key}*.pdf"))
            if matches:
                found[item_key] = str(matches[0])
                pending.remove(item_key)
        if pending:
            time.sleep(poll_seconds)
    for item_key in pending:
        found[item_key] = "translate-pending"
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description="Check PDF2zh and wait for translated PDFs")
    parser.add_argument("--keys", default="", help="Comma-separated Zotero item keys")
    parser.add_argument(
        "--translated-dir",
        default=str(Path.home() / "AppData" / "Roaming" / "CodexZoteroPDF2zh" / "server" / "translated"),
    )
    parser.add_argument(
        "--start-script",
        default=str(Path.home() / "AppData" / "Roaming" / "CodexZoteroPDF2zh" / "start-pdf2zh-windows.ps1"),
    )
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--poll", type=int, default=5)
    args = parser.parse_args()

    status = ensure_pdf2zh(Path(args.start_script))
    keys = [key.strip() for key in args.keys.split(",") if key.strip()]
    translations = wait_for_translations(keys, Path(args.translated_dir), args.timeout, args.poll) if keys else {}
    print(json.dumps({"health": status, "translations": translations}, ensure_ascii=False, indent=2))
    unhealthy = any(isinstance(value, dict) and value.get("status") == "error" for value in status.values())
    return 1 if unhealthy else 0


if __name__ == "__main__":
    raise SystemExit(main())
