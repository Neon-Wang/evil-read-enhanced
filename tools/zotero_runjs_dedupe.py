#!/usr/bin/env python3
"""Plan and execute non-destructive EvilRead Zotero duplicate cleanup."""

from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import sys
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import zotero_closure_audit
from zotero_runjs_collections import execute_in_runjs_window


def data_of(item: dict[str, Any]) -> dict[str, Any]:
    return zotero_closure_audit.data_of(item)


def item_key(item: dict[str, Any]) -> str:
    return zotero_closure_audit.item_key(item)


def attachment_titles(attachments: list[dict[str, Any]]) -> set[str]:
    return zotero_closure_audit.attachment_titles(attachments)


def attachment_index(items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    return zotero_closure_audit.attachment_index(items)


def parent_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return zotero_closure_audit.parent_items(items)


def score_parent(parent: dict[str, Any], attachments: list[dict[str, Any]]) -> tuple[int, str]:
    data = data_of(parent)
    titles = attachment_titles(attachments)
    score = 0
    if str(data.get("DOI") or "").strip():
        score += 50
    if str(data.get("url") or "").strip():
        score += 30
    if data.get("collections"):
        score += 20
    if "EvilRead Translated PDF" in titles:
        score += 15
    if "EvilRead Original PDF" in titles:
        score += 10
    if data.get("abstractNote"):
        score += 5
    # Prefer newer generated EvilRead records when all metadata is otherwise equal.
    return (score, str(data.get("dateAdded") or ""))


def mirrored_pdf_path(items_dir: Path, key: str, translated: bool) -> str:
    suffix = ".zh.pdf" if translated else ".pdf"
    path = items_dir / f"{key}{suffix}"
    return str(path) if path.exists() else ""


def make_dedupe_plan(items: list[dict[str, Any]], items_dir: Path) -> list[dict[str, Any]]:
    parents = parent_items(items)
    attachments_by_parent = attachment_index(items)
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for parent in parents:
        title = str(data_of(parent).get("title") or "")
        normalized = zotero_closure_audit.normalized_title(title)
        if normalized:
            groups[normalized].append(parent)

    plan: list[dict[str, Any]] = []
    for group in groups.values():
        if len(group) < 2:
            continue
        canonical = max(group, key=lambda parent: score_parent(parent, attachments_by_parent.get(item_key(parent), [])))
        canonical_key = item_key(canonical)
        canonical_titles = attachment_titles(attachments_by_parent.get(canonical_key, []))
        duplicates = [item_key(parent) for parent in group if item_key(parent) != canonical_key]
        if not duplicates:
            continue
        ensure_attachments: list[dict[str, str]] = []
        for title, translated in [
            ("EvilRead Original PDF", False),
            ("EvilRead Translated PDF", True),
        ]:
            if title in canonical_titles:
                continue
            source_key = ""
            source_path = ""
            for parent in group:
                key = item_key(parent)
                candidate = mirrored_pdf_path(items_dir, key, translated)
                if candidate:
                    source_key = key
                    source_path = candidate
                    break
            if source_path:
                ensure_attachments.append(
                    {
                        "title": title,
                        "filePath": source_path,
                        "fileBaseName": canonical_key + (".zh" if translated else ""),
                        "sourceKey": source_key,
                    }
                )
        plan.append(
            {
                "title": str(data_of(canonical).get("title") or canonical_key),
                "canonical": canonical_key,
                "duplicates": duplicates,
                "ensureAttachments": ensure_attachments,
            }
        )
    return plan


def build_dedupe_script(plan: list[dict[str, Any]]) -> str:
    encoded = json.dumps(plan, ensure_ascii=False)
    return f"""const libraryID = Zotero.Libraries.userLibraryID;
const dedupePlan = {encoded};

async function fileExists(path) {{
  if (!path) return false;
  if (typeof IOUtils !== "undefined" && typeof IOUtils.exists === "function") {{
    return await IOUtils.exists(path);
  }}
  if (typeof OS !== "undefined" && OS.File && typeof OS.File.exists === "function") {{
    return await OS.File.exists(path);
  }}
  return false;
}}

function existingAttachment(parentItem, title) {{
  if (typeof parentItem.getAttachments !== "function") return null;
  for (const attachmentID of parentItem.getAttachments()) {{
    const attachment = Zotero.Items.get(attachmentID);
    if (attachment && attachment.getField("title") === title) return attachment;
  }}
  return null;
}}

async function ensureStoredPdf(parentItem, request) {{
  if (existingAttachment(parentItem, request.title)) {{
    return {{ status: "existing", title: request.title }};
  }}
  if (!(await fileExists(request.filePath))) {{
    return {{ status: "missing-file", title: request.title, filePath: request.filePath }};
  }}
  const attachment = await Zotero.Attachments.importFromFile({{
    file: request.filePath,
    parentItemID: parentItem.id,
    title: request.title,
    fileBaseName: request.fileBaseName,
    contentType: "application/pdf",
  }});
  return {{ status: "created", title: request.title, key: attachment.key, sourceKey: request.sourceKey }};
}}

async function mergeCollections(canonical, duplicate) {{
  if (typeof canonical.getCollections !== "function" || typeof canonical.setCollections !== "function") {{
    return [];
  }}
  const merged = new Set(canonical.getCollections());
  if (typeof duplicate.getCollections === "function") {{
    for (const collectionID of duplicate.getCollections()) merged.add(collectionID);
  }}
  const next = Array.from(merged);
  canonical.setCollections(next);
  await canonical.saveTx();
  return next;
}}

async function markDuplicate(canonicalKey, duplicate) {{
  if (typeof duplicate.addTag === "function") {{
    duplicate.addTag("evilread:duplicate-of:" + canonicalKey);
    duplicate.addTag("evilread:deduped:" + new Date().toISOString().slice(0, 10));
    await duplicate.saveTx();
  }}
  if (Zotero.Items && typeof Zotero.Items.trashTx === "function") {{
    await Zotero.Items.trashTx([duplicate.id]);
    return "trashed";
  }}
  duplicate.deleted = true;
  await duplicate.saveTx();
  return "deleted-flag";
}}

const results = [];
for (const group of dedupePlan) {{
  const canonical = Zotero.Items.getByLibraryAndKey(libraryID, group.canonical);
  if (!canonical) {{
    results.push({{ title: group.title, canonical: group.canonical, status: "missing-canonical" }});
    continue;
  }}
  const attachments = [];
  for (const request of group.ensureAttachments || []) {{
    attachments.push(await ensureStoredPdf(canonical, request));
  }}
  const duplicates = [];
  for (const duplicateKey of group.duplicates) {{
    const duplicate = Zotero.Items.getByLibraryAndKey(libraryID, duplicateKey);
    if (!duplicate) {{
      duplicates.push({{ key: duplicateKey, status: "missing-duplicate" }});
      continue;
    }}
    await mergeCollections(canonical, duplicate);
    const status = await markDuplicate(group.canonical, duplicate);
    duplicates.push({{ key: duplicateKey, status }});
  }}
  results.push({{ title: group.title, canonical: group.canonical, attachments, duplicates }});
}}
return JSON.stringify(results);
"""


def archive_mirror_duplicates(plan: list[dict[str, Any]], items_dir: Path, archive_root: Path) -> dict[str, Any]:
    archive_root.mkdir(parents=True, exist_ok=True)
    moved: list[str] = []
    missing: list[str] = []
    mapping: dict[str, str] = {}
    for group in plan:
        canonical = str(group["canonical"])
        group_dir = archive_root / canonical
        group_dir.mkdir(parents=True, exist_ok=True)
        for duplicate in group["duplicates"]:
            duplicate_key = str(duplicate)
            mapping[duplicate_key] = canonical
            found = False
            for suffix in [".json", ".pdf", ".zh.pdf"]:
                source = items_dir / f"{duplicate_key}{suffix}"
                if not source.exists():
                    continue
                found = True
                destination = group_dir / source.name
                if destination.exists():
                    destination = group_dir / f"{source.stem}.{len(list(group_dir.glob(source.stem + '*')))}{source.suffix}"
                shutil.move(str(source), str(destination))
                moved.append(str(destination))
            if not found:
                missing.append(duplicate_key)
    mapping_path = archive_root / "duplicate_key_map.json"
    mapping_path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"archive_root": str(archive_root), "moved": moved, "missing": missing, "mapping": str(mapping_path)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Deduplicate EvilRead Zotero parent items by normalized title")
    parser.add_argument("--api-base", default="http://127.0.0.1:23119/api/users/0")
    parser.add_argument(
        "--items-dir",
        default=r"C:\GitClient\windows\repos\evilread-workspace\zotero\library\items",
    )
    parser.add_argument(
        "--plan-output",
        default="",
        help="Write dedupe plan JSON. Defaults to zotero/library/logs/dedupe_plan_<timestamp>.json next to items-dir.",
    )
    parser.add_argument("--plan-input", default="", help="Reuse an existing dedupe plan JSON instead of reading Zotero API")
    parser.add_argument("--archive-mirror", action="store_true", help="Archive duplicate mirror files from items-dir")
    parser.add_argument("--archive-dir", default="", help="Archive directory for duplicate mirror files")
    parser.add_argument("--output-js", default="", help="Write generated JavaScript to this path")
    parser.add_argument("--execute", action="store_true", help="Run the dedupe plan in Zotero Run JavaScript")
    parser.add_argument("--title-re", default=".*JavaScript.*")
    parser.add_argument("--wait-seconds", type=float, default=30.0)
    args = parser.parse_args()

    items_dir = Path(args.items_dir)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    if args.plan_input:
        plan = json.loads(Path(args.plan_input).read_text(encoding="utf-8"))
    else:
        items = zotero_closure_audit.fetch_all_items(args.api_base)
        plan = make_dedupe_plan(items, items_dir)
    plan_output = Path(args.plan_output) if args.plan_output else items_dir.parents[1] / "logs" / f"dedupe_plan_{timestamp}.json"
    plan_output.parent.mkdir(parents=True, exist_ok=True)
    plan_output.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    script = build_dedupe_script(plan)
    if args.output_js:
        Path(args.output_js).write_text(script, encoding="utf-8")
    else:
        print(json.dumps({"groups": len(plan), "duplicates": sum(len(group["duplicates"]) for group in plan), "plan": str(plan_output)}, ensure_ascii=False))
    if args.execute and plan:
        execute_in_runjs_window(script, args.title_re, args.wait_seconds)
    if args.archive_mirror and plan:
        archive_dir = Path(args.archive_dir) if args.archive_dir else items_dir / "_deduped" / timestamp
        archive_result = archive_mirror_duplicates(plan, items_dir, archive_dir)
        print(json.dumps({"archive": archive_result}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
