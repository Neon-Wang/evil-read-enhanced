#!/usr/bin/env python3
"""Generate the loop v1 daily note from Zotero ingest results."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any


def load_results(path: Path) -> list[dict[str, Any]]:
    if not path or not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"expected a list of ingest results in {path}")
    return [item for item in payload if isinstance(item, dict)]


def mirror_wikilink(vault_root: Path, result: dict[str, Any]) -> str:
    title = str(result.get("title") or result.get("zotero_key") or "Untitled")
    mirror_path = Path(str(result.get("mirror_path") or ""))
    if mirror_path.is_absolute():
        try:
            mirror_path = mirror_path.relative_to(vault_root)
        except ValueError:
            mirror_path = Path("30_Inbox") / "Zotero" / mirror_path.name
    link_path = mirror_path.with_suffix("").as_posix()
    return f"[[{link_path}|{title}]]"


def relative_link(from_dir: Path, target: Path) -> str:
    return Path(os.path.relpath(target, from_dir)).as_posix()


def result_line(
    vault_root: Path,
    result: dict[str, Any],
    note_dir: Path | None = None,
    workspace_root: Path | None = None,
) -> str:
    key = result.get("zotero_key", "")
    status = result.get("status", "")
    collection = result.get("collection", "")
    details = " | ".join(part for part in [str(key), str(status), str(collection)] if part)
    links: list[str] = []
    if note_dir and workspace_root and key:
        item_dir = workspace_root / "zotero" / "library" / "items"
        for label, suffix in (("PDF", ".pdf"), ("ZH", ".zh.pdf")):
            target = item_dir / f"{key}{suffix}"
            if target.exists():
                links.append(f"[{label}]({relative_link(note_dir, target)})")
    link_text = f" - {' '.join(links)}" if links else ""
    return f"- {mirror_wikilink(vault_root, result)} - {details}{link_text}"


def render_daily_note(
    vault_root: Path,
    note_date: str,
    confirmed: list[dict[str, Any]],
    exploration: list[dict[str, Any]],
    workspace_root: Path | None = None,
) -> str:
    overview_header = "\u4eca\u65e5\u6982\u89c8"
    overview_text = "\u4eca\u65e5\u95ed\u73af\u5199\u5165"
    zotero_header = "Zotero \u65b0\u589e\uff08\u81ea\u52a8\u955c\u50cf\uff09"
    comments_header = "\u6211\u7684\u60f3\u6cd5\uff08Start My Day Comments\uff09"
    template_path = vault_root / "templates" / "daily.md"
    template = template_path.read_text(encoding="utf-8") if template_path.exists() else ""
    header = template.replace("{{date}}", note_date).split(f"## {overview_header}")[0].rstrip()
    note_dir = vault_root / "10_Daily"
    confirmed_lines = "\n".join(
        result_line(vault_root, item, note_dir=note_dir, workspace_root=workspace_root)
        for item in confirmed
    ) or "- --"
    exploration_lines = "\n".join(
        result_line(vault_root, item, note_dir=note_dir, workspace_root=workspace_root)
        for item in exploration
    ) or "- --"
    return "\n".join(
        [
            header,
            "",
            f"## {overview_header}",
            f"{overview_text} Confirmed {len(confirmed)} \u7bc7\uff0cExploration {len(exploration)} \u7bc7\u3002",
            "",
            f"## {zotero_header}",
            "",
            "## Confirmed",
            confirmed_lines,
            "",
            "## Exploration",
            exploration_lines,
            "",
            f"## {comments_header}",
            "- +interest:",
            "- -avoid:",
            "- !deepen:",
            "- ?question:",
            "",
        ]
    )


def write_daily_note(
    vault_root: Path,
    note_date: str,
    confirmed: list[dict[str, Any]],
    exploration: list[dict[str, Any]],
    workspace_root: Path | None = None,
) -> Path:
    note_path = vault_root / "10_Daily" / f"{note_date}论文推荐.md"
    note_path.parent.mkdir(parents=True, exist_ok=True)
    note_path.write_text(
        render_daily_note(vault_root, note_date, confirmed, exploration, workspace_root=workspace_root),
        encoding="utf-8",
    )
    return note_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the Zotero loop daily note")
    parser.add_argument("--vault", required=True)
    parser.add_argument("--workspace", default="", help="Monorepo root containing vault/ and zotero/")
    parser.add_argument("--date", required=True)
    parser.add_argument("--confirmed-results", default="")
    parser.add_argument("--exploration-results", default="")
    args = parser.parse_args()

    note_path = write_daily_note(
        vault_root=Path(args.vault),
        note_date=args.date,
        confirmed=load_results(Path(args.confirmed_results)) if args.confirmed_results else [],
        exploration=load_results(Path(args.exploration_results)) if args.exploration_results else [],
        workspace_root=Path(args.workspace) if args.workspace else None,
    )
    print(json.dumps({"note": str(note_path)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
