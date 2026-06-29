#!/usr/bin/env python3
"""Build a code-server friendly Markdown index for the Zotero mirror."""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import re
from typing import Any


def item_data(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def normalize_title(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\u4e00-\u9fff]+", " ", value.lower())).strip()


def load_items(workspace_root: Path) -> list[dict[str, Any]]:
    item_dir = workspace_root / "zotero" / "library" / "items"
    items: list[dict[str, Any]] = []
    for path in sorted(item_dir.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        data = item_data(payload)
        if data.get("itemType") in {"attachment", "note"}:
            continue
        key = str(data.get("key") or payload.get("key") or path.stem)
        items.append({"path": path, "key": key, "data": data})
    return items


def research_note_index(workspace_root: Path) -> dict[str, Path]:
    index: dict[str, Path] = {}
    research_root = workspace_root / "vault" / "20_Research" / "Papers"
    for path in sorted(research_root.glob("**/*.md")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for pattern in (r"zotero_key:\s*[\"']?([^\"'\n]+)", r"doi:\s*[\"']?([^\"'\n]+)"):
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                index[match.group(1).strip().lower()] = path
        title = path.stem.replace("_", " ")
        index.setdefault(normalize_title(title), path)
    return index


def rel_link(from_path: Path, target: Path) -> str:
    return Path(os.path.relpath(target, from_path.parent)).as_posix()


def artifact_link(index_path: Path, target: Path, label: str) -> str:
    return f"[{label}]({rel_link(index_path, target)})" if target.exists() else "missing"


def find_research(data: dict[str, Any], key: str, notes: dict[str, Path]) -> Path | None:
    doi = str(data.get("DOI") or data.get("doi") or "").strip().lower()
    title = normalize_title(str(data.get("title") or ""))
    return notes.get(key.lower()) or (notes.get(doi) if doi else None) or (notes.get(title) if title else None)


def write_zotero_index(workspace_root: Path) -> Path:
    workspace_root = Path(workspace_root)
    index_path = workspace_root / "zotero" / "INDEX.md"
    index_path.parent.mkdir(parents=True, exist_ok=True)
    item_dir = workspace_root / "zotero" / "library" / "items"
    items = load_items(workspace_root)
    notes = research_note_index(workspace_root)
    rows: list[str] = []
    linked = 0
    original_count = translated_count = missing_original = missing_translated = 0
    for item in items:
        key = item["key"]
        data = item["data"]
        pdf = item_dir / f"{key}.pdf"
        zh_pdf = item_dir / f"{key}.zh.pdf"
        json_path = item_dir / f"{key}.json"
        if pdf.exists():
            original_count += 1
        else:
            missing_original += 1
        if zh_pdf.exists():
            translated_count += 1
        else:
            missing_translated += 1
        research = find_research(data, key, notes)
        if research:
            linked += 1
            research_link = f"[Research]({rel_link(index_path, research)})"
        else:
            research_link = "missing"
        title = str(data.get("title") or key).replace("|", "\\|")
        doi = str(data.get("DOI") or data.get("doi") or "").replace("|", "\\|")
        rows.append(
            "| "
            + " | ".join(
                [
                    key,
                    title,
                    doi,
                    artifact_link(index_path, pdf, "PDF"),
                    artifact_link(index_path, zh_pdf, "ZH"),
                    artifact_link(index_path, json_path, "JSON"),
                    research_link,
                ]
            )
            + " |"
        )
    lines = [
        "# Zotero Mirror Index",
        "",
        f"Updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## Summary",
        f"- Items: {len(items)}",
        f"- Original PDFs: {original_count}",
        f"- Translated PDFs: {translated_count}",
        f"- Missing original PDFs: {missing_original}",
        f"- Missing translated PDFs: {missing_translated}",
        f"- Research notes linked: {linked}",
        "",
        "## Items",
        "",
        "| Key | Title | DOI | PDF | ZH | JSON | Research |",
        "|---|---|---|---|---|---|---|",
        *rows,
        "",
    ]
    index_path.write_text("\n".join(lines), encoding="utf-8")
    return index_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate zotero/INDEX.md")
    parser.add_argument("--workspace", required=True)
    path = write_zotero_index(Path(parser.parse_args().workspace))
    print(json.dumps({"index": str(path)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
