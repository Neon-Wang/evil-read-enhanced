#!/usr/bin/env python3
"""Send the daily Markdown report through a self-contained CAT-compatible mailer."""

from __future__ import annotations

import argparse
import asyncio
from datetime import date
import json
from pathlib import Path
import re
import sys
from typing import Awaitable, Callable

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import cat_mailer

Sender = Callable[[str, str, str, str | None], Awaitable[bool]]


def date_from_note(path: Path) -> str:
    match = re.search(r"(20\d{2}-\d{2}-\d{2})", path.name)
    return match.group(1) if match else date.today().isoformat()


def send_daily_markdown(
    daily_note: Path,
    to_email: str,
    run_date: str | None = None,
    sender: Sender | None = None,
) -> dict[str, str]:
    daily_note = Path(daily_note)
    run_date = run_date or date_from_note(daily_note)
    markdown_body = daily_note.read_text(encoding="utf-8")
    title = f"EvilRead 日报 - {run_date}"

    async def run() -> bool:
        if sender is not None:
            return await sender(to_email, title, markdown_body, None)
        return cat_mailer.send_notification_email(to_email, title, markdown_body, None, base_dir=daily_note.parent)

    ok = asyncio.run(run())
    return {"status": "sent" if ok else "failed", "to": to_email, "title": title, "daily_note": str(daily_note)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a Start My Day Markdown report through CAT")
    parser.add_argument("--daily-note", required=True)
    parser.add_argument("--to", default="487844383@qq.com")
    args = parser.parse_args()
    result = send_daily_markdown(Path(args.daily_note), args.to)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "sent" else 2


if __name__ == "__main__":
    raise SystemExit(main())
