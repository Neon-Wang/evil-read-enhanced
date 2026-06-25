#!/usr/bin/env python3
"""Build an incremental full-text index from Zotero PDF storage."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

import fitz


def extract_pdf_text(pdf_path: Path, max_chars: int) -> str:
    parts: list[str] = []
    with fitz.open(pdf_path) as document:
        for page in document:
            parts.append(page.get_text("text"))
            if sum(len(part) for part in parts) >= max_chars:
                break
    return "\n".join(parts)[:max_chars]


def load_existing(index_path: Path) -> dict[str, Any]:
    if not index_path.exists():
        return {"items": {}, "updated_at": ""}
    return json.loads(index_path.read_text(encoding="utf-8"))


def build_index(zotero_storage: Path, output_path: Path, max_chars: int = 12000) -> dict[str, Any]:
    existing = load_existing(output_path)
    items: dict[str, Any] = existing.get("items", {})
    for pdf_path in sorted(zotero_storage.glob("*/*.pdf")):
        item_key = pdf_path.parent.name
        mtime = pdf_path.stat().st_mtime
        current = items.get(item_key, {})
        if current.get("mtime") == mtime:
            continue
        items[item_key] = {
            "key": item_key,
            "pdf_path": str(pdf_path),
            "mtime": mtime,
            "text": extract_pdf_text(pdf_path, max_chars),
        }
    index = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "items": items,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return index


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Zotero full-text index")
    parser.add_argument("--zotero-storage", default=str(Path.home() / "Zotero" / "storage"))
    parser.add_argument(
        "--output",
        default="C:/GitClient/windows/repos/evilread-vault/99_System/Indexes/zotero_index.json",
    )
    parser.add_argument("--max-chars", type=int, default=12000)
    args = parser.parse_args()

    index = build_index(Path(args.zotero_storage), Path(args.output), args.max_chars)
    print(json.dumps({"items": len(index["items"]), "output": args.output}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
