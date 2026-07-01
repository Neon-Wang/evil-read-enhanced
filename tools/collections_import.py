#!/usr/bin/env python3
"""Import root-level collections PDFs into Zotero and archive processed files."""

from __future__ import annotations

import argparse
from datetime import date
import hashlib
import json
from pathlib import Path
import shutil
import sys
from typing import Any, Callable

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from zotero_runjs_collections import execute_in_runjs_window
from collection_metadata import enriched_metadata_from_pdf
from collection_translation import ensure_translated_pdf

ImportRunner = Callable[[list[dict[str, Any]], str], list[dict[str, Any]]]


def workspace_paths(workspace_root: Path) -> dict[str, Path]:
    collections = workspace_root / "collections"
    paths = {
        "collections": collections,
        "imported": collections / "imported",
        "fails": collections / "fails",
        "logs": collections / "logs",
        "manifest": collections / "logs" / "import_manifest.json",
    }
    collections.mkdir(parents=True, exist_ok=True)
    paths["imported"].mkdir(parents=True, exist_ok=True)
    paths["fails"].mkdir(parents=True, exist_ok=True)
    paths["logs"].mkdir(parents=True, exist_ok=True)
    return paths


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"items_by_hash": {}}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        return {"items_by_hash": {}}
    payload.setdefault("items_by_hash", {})
    return payload


def write_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def scan_root_pdfs(collections_dir: Path, manifest: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    requests: list[dict[str, Any]] = []
    seen = manifest.get("items_by_hash", {})
    for pdf_path in sorted(collections_dir.glob("*.pdf")):
        file_hash = sha256_file(pdf_path)
        entry = {"path": str(pdf_path), "name": pdf_path.name, "sha256": file_hash}
        if file_hash in seen:
            requests.append({**entry, "previously_imported": True, "zotero_key": seen[file_hash].get("zotero_key", "")})
        else:
            requests.append(entry)
    return requests, []


def recover_same_day_archived_requests(manifest: dict[str, Any], run_date: str, existing_hashes: set[str]) -> list[dict[str, Any]]:
    recovered: list[dict[str, Any]] = []
    seen = manifest.get("items_by_hash", {})
    if not isinstance(seen, dict):
        return recovered
    for file_hash, item in sorted(seen.items()):
        if file_hash in existing_hashes or not isinstance(item, dict):
            continue
        if str(item.get("imported_at") or "") != run_date:
            continue
        archived_path = Path(str(item.get("archived_path") or ""))
        zotero_key = str(item.get("zotero_key") or "").strip()
        if not archived_path.exists() or not zotero_key:
            continue
        recovered.append(
            {
                "path": str(archived_path),
                "name": archived_path.name,
                "sha256": file_hash,
                "previously_imported": True,
                "archived_replay": True,
                "zotero_key": zotero_key,
                "title": item.get("title", ""),
            }
        )
    return recovered


def js_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def build_import_script(requests: list[dict[str, Any]], run_date: str) -> str:
    payload = json.dumps(requests, ensure_ascii=False)
    return f"""
(async () => {{
  const requests = {payload};
  const results = [];
  const libraryID = Zotero.Libraries.userLibraryID;
  function existingChild(name, parentID) {{
    const collections = Zotero.Collections.getByLibrary(libraryID) || [];
    for (const collection of collections) {{
      const sameParent = (collection.parentID || false) === (parentID || false);
      if (collection.name === name && sameParent) return collection;
    }}
    return null;
  }}
  async function ensureChild(name, parentID) {{
    let collection = existingChild(name, parentID);
    if (collection) return collection;
    collection = new Zotero.Collection();
    collection.libraryID = libraryID;
    collection.name = name;
    if (parentID) collection.parentID = parentID;
    await collection.saveTx();
    return collection;
  }}
  async function addToCollection(item, collection) {{
    if (typeof item.getCollections === "function" && typeof item.setCollections === "function") {{
      const collections = item.getCollections();
      if (!collections.includes(collection.id)) {{
        item.setCollections([...collections, collection.id]);
        await item.saveTx();
      }}
      return;
    }}
    if (typeof item.addToCollection === "function") {{
      item.addToCollection(collection.id);
      await item.saveTx();
      return;
    }}
    if (typeof collection.addItem === "function") {{
      collection.addItem(item.id);
      await collection.saveTx();
      return;
    }}
    throw new Error("No supported collection add method for item " + item.key);
  }}
  const collectionsRoot = await ensureChild("Collections", false);
  const importCollection = await ensureChild("{run_date}", collectionsRoot.id);
  function itemTags(item) {{
    if (!item || typeof item.getTags !== "function") return [];
    return item.getTags().map(tag => typeof tag === "string" ? tag : tag.tag).filter(Boolean);
  }}
  function findExistingBySha(sha) {{
    const marker = "evilread:sha256:" + sha;
    const items = Zotero.Items.getAll(Zotero.Libraries.userLibraryID) || [];
    for (const item of items) {{
      if (!item || item.isAttachment && item.isAttachment()) continue;
      if (itemTags(item).includes(marker)) return item;
    }}
    return null;
  }}
  for (const request of requests) {{
    try {{
      const existing = findExistingBySha(request.sha256);
      if (existing) {{
        await addToCollection(existing, importCollection);
        results.push({{...request, status: "existing", parentKey: existing.key}});
        continue;
      }}
      const parent = new Zotero.Item("journalArticle");
      parent.setField("title", request.name.replace(/\\.pdf$/i, ""));
      parent.addTag("evilread:source:collections");
      parent.addTag("evilread:needs-metadata");
      parent.addTag("evilread:import-date:{run_date}");
      parent.addTag("evilread:sha256:" + request.sha256);
      const parentKey = await parent.saveTx();
      await addToCollection(parent, importCollection);
      const attachment = await Zotero.Attachments.importFromFile({{
        file: request.path,
        parentItemID: parent.id,
        title: "EvilRead Collections PDF"
      }});
      results.push({{...request, status: "imported", parentKey: parent.key, attachmentKey: attachment.key}});
    }} catch (error) {{
      results.push({{...request, status: "failed", error: String(error && error.message || error)}});
    }}
  }}
  return results;
}})();
"""


def default_run_import_script(
    requests: list[dict[str, Any]],
    script: str,
    title_re: str = "Zotero",
    wait_seconds: int = 3,
) -> list[dict[str, Any]]:
    execute_in_runjs_window(script, title_re=title_re, wait_seconds=wait_seconds)
    return [{**request, "status": "pending-verification", "error": "RunJS executed; rerun after Zotero sync to verify key"} for request in requests]


def archive_file(source: Path, target_dir: Path, file_hash: str) -> Path:
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / source.name
    if target.exists():
        target = target_dir / f"{source.stem}-{file_hash[:8]}{source.suffix}"
    shutil.move(str(source), str(target))
    return target


def normalize_runner_result(result: dict[str, Any]) -> dict[str, Any]:
    key = str(result.get("parentKey") or result.get("zotero_key") or result.get("key") or "").strip()
    status = str(result.get("status") or "").strip().lower()
    normalized = dict(result)
    if key:
        normalized["zotero_key"] = key
    normalized["status"] = "imported" if status in {"imported", "ok", "success", "existing"} and key else status or "failed"
    return normalized


def mirror_import_collection_pdf(workspace_root: Path, request: dict[str, Any], run_date: str) -> dict[str, Any]:
    item_dir = workspace_root / "zotero" / "library" / "items"
    item_dir.mkdir(parents=True, exist_ok=True)
    key = "COLL" + str(request["sha256"])[:20].upper()
    source = Path(str(request["path"]))
    pdf_target = item_dir / f"{key}.pdf"
    zh_target = item_dir / f"{key}.zh.pdf"
    shutil.copy2(source, pdf_target)
    enriched = enriched_metadata_from_pdf(pdf_target, str(request.get("name") or source.name), run_date)
    translation = ensure_translated_pdf(pdf_target, key, zh_target)
    title = str(enriched.get("title") or source.stem.replace("_", " ").replace("-", " ").strip() or source.stem)
    extra_payload = {
        "source": "collections",
        "collection_status": "mirror-fallback",
        "sha256": request["sha256"],
        "original_name": request["name"],
        "metadata_source": enriched.get("source", ""),
        "arxiv_id": enriched.get("arxiv_id", ""),
        "pdf_text_preview": enriched.get("pdf_text_preview", ""),
        "translation_status": translation.get("status", ""),
    }
    metadata = {
        "key": key,
        "data": {
            "key": key,
            "itemType": "journalArticle",
            "title": title,
            "creators": enriched.get("creators", []),
            "abstractNote": enriched.get("abstractNote", ""),
            "DOI": enriched.get("DOI", ""),
            "url": enriched.get("url", ""),
            "date": enriched.get("date", run_date),
            "publicationTitle": enriched.get("publicationTitle", ""),
            "archiveID": enriched.get("archiveID", ""),
            "extra": json.dumps(extra_payload, ensure_ascii=False),
        },
    }
    (item_dir / f"{key}.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        **request,
        "status": "imported",
        "zotero_key": key,
        "collection_status": "mirror-fallback",
        "title": title,
        "abstract": enriched.get("abstractNote", ""),
        "source": enriched.get("source", "collections"),
        "pdf_url": enriched.get("pdf_url", ""),
        "pdf_path": str(pdf_target),
        "translated_pdf_path": str(zh_target),
        "translation_status": translation.get("status", "missing"),
    }


def refresh_existing_collection_artifacts(workspace_root: Path, request: dict[str, Any]) -> dict[str, Any]:
    key = str(request.get("zotero_key") or "").strip()
    if not key:
        return {**request, "status": "failed", "error": "already-imported entry lacks zotero key"}
    item_dir = workspace_root / "zotero" / "library" / "items"
    item_dir.mkdir(parents=True, exist_ok=True)
    source = Path(str(request["path"]))
    pdf_target = item_dir / f"{key}.pdf"
    zh_target = item_dir / f"{key}.zh.pdf"
    if not pdf_target.exists() or pdf_target.stat().st_size <= 0:
        shutil.copy2(source, pdf_target)
    translation = ensure_translated_pdf(pdf_target, key, zh_target)
    return {
        **request,
        "status": "imported",
        "reason": "already-imported",
        "pdf_path": str(pdf_target),
        "translated_pdf_path": str(zh_target),
        "translation_status": translation.get("status", "missing"),
    }


def is_pending_result(result: dict[str, Any]) -> bool:
    return str(result.get("status") or "").strip().lower() in {"pending", "pending-verification", "skipped"}


def is_runjs_unavailable_error(error: BaseException) -> bool:
    message = str(error)
    return any(
        marker in message
        for marker in (
            "Run JavaScript editor was not found",
            "Run button was not found",
            "pywinauto is required",
        )
    )


def write_logs(paths: dict[str, Path], run_date: str, result: dict[str, Any]) -> None:
    jsonl_path = paths["logs"] / f"{run_date}.jsonl"
    with jsonl_path.open("a", encoding="utf-8") as handle:
        for bucket in ("imported", "failed", "skipped"):
            for item in result[bucket]:
                handle.write(json.dumps({"date": run_date, "bucket": bucket, **item}, ensure_ascii=False) + "\n")
    md_lines = [
        f"# Collections import {run_date}",
        "",
        f"- Scanned: {result['scanned']}",
        f"- Imported: {len(result['imported'])}",
        f"- Failed: {len(result['failed'])}",
        f"- Skipped: {len(result['skipped'])}",
        "",
        "## Imported",
    ]
    md_lines.extend(f"- {item.get('name')} -> {item.get('zotero_key', '')}" for item in result["imported"])
    md_lines.extend(["", "## Failed"])
    md_lines.extend(f"- {item.get('name')} - {item.get('error', item.get('status', 'failed'))}" for item in result["failed"])
    md_lines.extend(["", "## Skipped"])
    md_lines.extend(f"- {item.get('name')} - {item.get('reason', '')}" for item in result["skipped"])
    (paths["logs"] / f"{run_date}.md").write_text("\n".join(md_lines).rstrip() + "\n", encoding="utf-8")


def import_collection_pdfs(
    workspace_root: Path,
    run_date: str | None = None,
    execute: bool = False,
    run_import_script: ImportRunner | None = None,
) -> dict[str, Any]:
    workspace_root = Path(workspace_root)
    run_date = run_date or date.today().isoformat()
    paths = workspace_paths(workspace_root)
    manifest = load_manifest(paths["manifest"])
    requests, skipped = scan_root_pdfs(paths["collections"], manifest)
    requests.extend(recover_same_day_archived_requests(manifest, run_date, {request["sha256"] for request in requests}))
    result: dict[str, Any] = {"date": run_date, "scanned": len(requests), "imported": [], "failed": [], "skipped": skipped}
    if requests and execute:
        already_imported = [request for request in requests if request.get("previously_imported")]
        fresh_requests = [request for request in requests if not request.get("previously_imported")]
        runner_results: list[dict[str, Any]] = [
            refresh_existing_collection_artifacts(workspace_root, request) for request in already_imported
        ]
        if fresh_requests:
            script = build_import_script(fresh_requests, run_date)
            runner = run_import_script or (lambda reqs, js: default_run_import_script(reqs, js))
            try:
                runner_results.extend(runner(fresh_requests, script))
            except RuntimeError as exc:
                if not is_runjs_unavailable_error(exc):
                    raise
                runner_results.extend(
                    {
                        **mirror_import_collection_pdf(workspace_root, request, run_date),
                        "reason": "runjs-unavailable-mirror-fallback",
                        "runjs_error": str(exc),
                    }
                    for request in fresh_requests
                )
        by_hash = {item["sha256"]: normalize_runner_result(item) for item in runner_results}
        for request in requests:
            runner_result = by_hash.get(request["sha256"], {"status": "failed", "error": "missing runner result"})
            if is_pending_result(runner_result):
                archive_path = Path(str(request["path"])) if request.get("archived_replay") else archive_file(Path(request["path"]), paths["fails"] / run_date, request["sha256"])
                result["failed"].append(
                    {
                        **request,
                        **runner_result,
                        "error": str(runner_result.get("error") or runner_result.get("reason") or runner_result.get("status") or "pending-verification"),
                        "archived_path": str(archive_path),
                    }
                )
                continue
            archive_bucket = "imported" if runner_result.get("status") == "imported" else "failed"
            target_root = paths["imported"] if archive_bucket == "imported" else paths["fails"]
            archive_path = Path(str(request["path"])) if request.get("archived_replay") else archive_file(Path(request["path"]), target_root / run_date, request["sha256"])
            entry = {**request, **runner_result, "archived_path": str(archive_path)}
            if archive_bucket == "imported":
                manifest["items_by_hash"][request["sha256"]] = {
                    "zotero_key": entry.get("zotero_key", ""),
                    "title": entry.get("title", request["name"]),
                    "imported_at": run_date,
                    "archived_path": str(archive_path),
                }
                result["imported"].append(entry)
            else:
                result["failed"].append(entry)
    elif requests:
        result["pending"] = requests
        result["runjs"] = build_import_script([request for request in requests if not request.get("previously_imported")], run_date)
    write_manifest(paths["manifest"], manifest)
    write_logs(paths, run_date, result)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Import collections/*.pdf into Zotero")
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--date", default="")
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    result = import_collection_pdfs(Path(args.workspace), run_date=args.date or None, execute=args.execute)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not result.get("failed") and not result.get("skipped") and not result.get("pending") else 2


if __name__ == "__main__":
    raise SystemExit(main())
