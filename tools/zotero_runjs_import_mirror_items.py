#!/usr/bin/env python3
"""Import mirrored EvilRead item JSON/PDF pairs into native Zotero."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from zotero_runjs_collections import execute_in_runjs_window


def load_requests(items_dir: Path, keys: list[str]) -> list[dict[str, Any]]:
    requests: list[dict[str, Any]] = []
    for key in keys:
        metadata_path = items_dir / f"{key}.json"
        if not metadata_path.exists():
            continue
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        data = metadata.get("data") if isinstance(metadata, dict) else {}
        if not isinstance(data, dict):
            continue
        item_type = str(data.get("itemType") or "")
        if item_type == "note" or item_type == "computerProgram":
            continue
        requests.append(
            {
                "key": key,
                "data": data,
                "original": str(items_dir / f"{key}.pdf") if (items_dir / f"{key}.pdf").exists() else "",
                "translated": str(items_dir / f"{key}.zh.pdf") if (items_dir / f"{key}.zh.pdf").exists() else "",
            }
        )
    return requests


def build_import_script(requests: list[dict[str, Any]], run_date: str) -> str:
    encoded = json.dumps(requests, ensure_ascii=False)
    return f"""const libraryID = Zotero.Libraries.userLibraryID;
const requests = {encoded};

function setIfPresent(item, field, value) {{
  if (value === undefined || value === null || value === "") return;
  try {{ item.setField(field, value); }} catch (error) {{}}
}}

function existingByKey(key) {{
  return Zotero.Items.getByLibraryAndKey(libraryID, key);
}}

function existingByTitleOrUrl(request) {{
  const title = (request.data.title || "").trim().toLocaleLowerCase();
  const url = (request.data.url || "").trim();
  const doi = (request.data.DOI || "").trim().toLocaleLowerCase();
  const allItems = Zotero.Items.getAll(libraryID) || [];
  const items = Array.isArray(allItems) ? allItems : Object.values(allItems);
  for (const item of items) {{
    if (!item || item.isAttachment && item.isAttachment()) continue;
    const itemTitle = (item.getField("title") || "").trim().toLocaleLowerCase();
    const itemUrl = (item.getField("url") || "").trim();
    const itemDoi = (item.getField("DOI") || "").trim().toLocaleLowerCase();
    if (doi && itemDoi === doi) return item;
    if (url && itemUrl === url) return item;
    if (title && itemTitle === title) return item;
  }}
  return null;
}}

function existingAttachment(parentItem, title) {{
  if (typeof parentItem.getAttachments !== "function") return null;
  for (const id of parentItem.getAttachments()) {{
    const attachment = Zotero.Items.get(id);
    if (attachment && attachment.getField("title") === title) return attachment;
  }}
  return null;
}}

async function fileExists(path) {{
  if (!path) return false;
  if (typeof IOUtils !== "undefined" && typeof IOUtils.exists === "function") return await IOUtils.exists(path);
  if (typeof OS !== "undefined" && OS.File && typeof OS.File.exists === "function") return await OS.File.exists(path);
  return false;
}}

async function ensureStoredPdf(parentItem, path, title, fileBaseName) {{
  if (!path) return {{ status: "missing-path", title }};
  if (existingAttachment(parentItem, title)) return {{ status: "existing", title }};
  if (!(await fileExists(path))) return {{ status: "missing-file", title, path }};
  const attachment = await Zotero.Attachments.importFromFile({{
    file: path,
    parentItemID: parentItem.id,
    title,
    fileBaseName,
    contentType: "application/pdf",
  }});
  return {{ status: "created", title, key: attachment.key }};
}}

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
  }}
}}

const collectionsRoot = await ensureChild("Collections", false);
const importCollection = await ensureChild({json.dumps(run_date)}, collectionsRoot.id);
const results = [];
for (const request of requests) {{
  let parent = existingByKey(request.key) || existingByTitleOrUrl(request);
  let status = "existing";
  if (!parent) {{
    parent = new Zotero.Item(request.data.itemType || "journalArticle");
    try {{ parent.key = request.key; }} catch (error) {{}}
    setIfPresent(parent, "title", request.data.title);
    setIfPresent(parent, "abstractNote", request.data.abstractNote);
    setIfPresent(parent, "DOI", request.data.DOI);
    setIfPresent(parent, "url", request.data.url);
    setIfPresent(parent, "date", request.data.date);
    setIfPresent(parent, "publicationTitle", request.data.publicationTitle);
    setIfPresent(parent, "archiveID", request.data.archiveID);
    setIfPresent(parent, "extra", request.data.extra);
    if (Array.isArray(request.data.creators)) {{
      parent.setCreators(request.data.creators);
    }}
    parent.addTag("evilread:source:collections");
    parent.addTag("evilread:import-date:{run_date}");
    await parent.saveTx();
    status = "created";
  }}
  await addToCollection(parent, importCollection);
  const original = await ensureStoredPdf(parent, request.original, "EvilRead Original PDF", parent.key);
  const translated = await ensureStoredPdf(parent, request.translated, "EvilRead Translated PDF", parent.key + ".zh");
  results.push({{ requestedKey: request.key, parentKey: parent.key, status, original, translated }});
}}
return JSON.stringify(results);
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Import top-level EvilRead mirror JSON/PDF items into Zotero")
    parser.add_argument("--items-dir", required=True)
    parser.add_argument("--keys", required=True, help="Comma-separated mirror keys")
    parser.add_argument("--date", default="")
    parser.add_argument("--output-js", default="")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--wait-seconds", type=float, default=30.0)
    parser.add_argument("--title-re", default=".*JavaScript.*")
    args = parser.parse_args()

    keys = [key.strip() for key in args.keys.split(",") if key.strip()]
    requests = load_requests(Path(args.items_dir), keys)
    script = build_import_script(requests, args.date or "2026-06-29")
    if args.output_js:
        Path(args.output_js).write_text(script, encoding="utf-8")
    else:
        print(json.dumps({"requests": len(requests), "keys": [request["key"] for request in requests]}, ensure_ascii=False))
    if args.execute and requests:
        execute_in_runjs_window(script, args.title_re, args.wait_seconds)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
