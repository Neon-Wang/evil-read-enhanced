#!/usr/bin/env python3
"""Audit EvilRead Zotero closure against the local Zotero API and mirror."""

from __future__ import annotations

import argparse
from collections import defaultdict
import json
from pathlib import Path
import re
from typing import Any
import urllib.parse
import urllib.request


PARENT_TYPES = {
    "journalArticle",
    "conferencePaper",
    "preprint",
    "book",
    "bookSection",
    "report",
    "thesis",
    "webpage",
}


def normalized_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.casefold()).strip()


def request_json(url: str) -> object:
    with urllib.request.urlopen(url, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_all_items(base_url: str, limit: int = 100) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    start = 0
    while True:
        query = urllib.parse.urlencode({"limit": limit, "start": start, "sort": "dateModified", "direction": "desc"})
        payload = request_json(f"{base_url.rstrip('/')}/items?{query}")
        if not isinstance(payload, list):
            raise RuntimeError(f"Unexpected Zotero item response: {type(payload).__name__}")
        items.extend([item for item in payload if isinstance(item, dict)])
        if len(payload) < limit:
            break
        start += limit
    return items


def fetch_collections(base_url: str) -> list[dict[str, Any]]:
    payload = request_json(f"{base_url.rstrip('/')}/collections")
    if not isinstance(payload, list):
        raise RuntimeError(f"Unexpected Zotero collection response: {type(payload).__name__}")
    return [collection for collection in payload if isinstance(collection, dict)]


def data_of(item: dict[str, Any]) -> dict[str, Any]:
    data = item.get("data")
    return data if isinstance(data, dict) else {}


def item_key(item: dict[str, Any]) -> str:
    return str(item.get("key") or data_of(item).get("key") or "").strip()


def parent_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    parents: list[dict[str, Any]] = []
    for item in items:
        data = data_of(item)
        item_type = str(data.get("itemType") or "")
        if item_type in PARENT_TYPES and not data.get("parentItem"):
            parents.append(item)
    return parents


def attachment_index(items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        data = data_of(item)
        if data.get("itemType") != "attachment":
            continue
        parent_key = str(data.get("parentItem") or "").strip()
        if parent_key:
            index[parent_key].append(item)
    return index


def attachment_titles(attachments: list[dict[str, Any]]) -> set[str]:
    return {str(data_of(attachment).get("title") or "").strip() for attachment in attachments}


def duplicate_title_groups(parents: list[dict[str, Any]]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)
    display_titles: dict[str, str] = {}
    for item in parents:
        title = str(data_of(item).get("title") or "").strip()
        normalized = normalized_title(title)
        if not normalized:
            continue
        groups[normalized].append(item_key(item))
        display_titles[normalized] = title
    return {
        display_titles[normalized]: keys
        for normalized, keys in sorted(groups.items())
        if len(keys) > 1
    }


def mirror_keys(items_dir: Path) -> set[str]:
    if not items_dir.exists():
        return set()
    return {path.stem for path in items_dir.glob("*.json") if path.is_file()}


def mirror_pdf_keys(items_dir: Path, suffix: str) -> set[str]:
    if not items_dir.exists():
        return set()
    keys: set[str] = set()
    for path in items_dir.glob(f"*{suffix}"):
        if not path.is_file():
            continue
        name = path.name
        if suffix == ".zh.pdf":
            keys.add(name[: -len(".zh.pdf")])
        elif suffix == ".pdf" and not name.endswith(".zh.pdf"):
            keys.add(path.stem)
    return keys


def collection_paths(collections: list[dict[str, Any]]) -> dict[str, str]:
    by_key = {item_key(collection): data_of(collection) for collection in collections}
    paths: dict[str, str] = {}
    for key, data in by_key.items():
        names = [str(data.get("name") or key)]
        parent_key = str(data.get("parentCollection") or "").strip()
        guard = 0
        while parent_key and parent_key in by_key and guard < 20:
            parent = by_key[parent_key]
            names.append(str(parent.get("name") or parent_key))
            parent_key = str(parent.get("parentCollection") or "").strip()
            guard += 1
        paths[key] = "/".join(reversed(names))
    return paths


def audit(items: list[dict[str, Any]], collections: list[dict[str, Any]], items_dir: Path) -> dict[str, Any]:
    parents = parent_items(items)
    parent_keys = {item_key(item) for item in parents}
    attachments_by_parent = attachment_index(items)
    json_keys = mirror_keys(items_dir)
    raw_pdf_keys = mirror_pdf_keys(items_dir, ".pdf")
    zh_pdf_keys = mirror_pdf_keys(items_dir, ".zh.pdf")
    missing_original = sorted(
        key
        for key in parent_keys
        if key in raw_pdf_keys and "EvilRead Original PDF" not in attachment_titles(attachments_by_parent.get(key, []))
    )
    missing_translated = sorted(
        key
        for key in parent_keys
        if key in zh_pdf_keys and "EvilRead Translated PDF" not in attachment_titles(attachments_by_parent.get(key, []))
    )
    paths = collection_paths(collections)
    dated_collections = sorted(path for path in paths.values() if re.search(r"/\d{4}-\d{2}-\d{2}$", path))
    return {
        "zotero_total_items": len(items),
        "zotero_parent_items": len(parent_keys),
        "zotero_attachment_items": len(items) - len(parent_keys),
        "mirror_json_count": len(json_keys),
        "mirror_raw_pdf_count": len(raw_pdf_keys),
        "mirror_zh_pdf_count": len(zh_pdf_keys),
        "zotero_parent_missing_mirror_json": sorted(parent_keys - json_keys),
        "mirror_json_not_in_zotero_parent": sorted(json_keys - parent_keys),
        "duplicate_title_groups": duplicate_title_groups(parents),
        "missing_original_attachment_for_mirrored_pdf": missing_original,
        "missing_translated_attachment_for_mirrored_pdf": missing_translated,
        "dated_collections": dated_collections,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Zotero native library against EvilRead mirror files")
    parser.add_argument("--api-base", default="http://127.0.0.1:23119/api/users/0")
    parser.add_argument(
        "--items-dir",
        default=r"C:\GitClient\windows\repos\evilread-workspace\zotero\library\items",
        help="Directory containing mirrored <key>.json, <key>.pdf and <key>.zh.pdf files",
    )
    parser.add_argument("--json", action="store_true", help="Print full JSON instead of compact summary")
    args = parser.parse_args()

    result = audit(fetch_all_items(args.api_base), fetch_collections(args.api_base), Path(args.items_dir))
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    print(f"zotero_total_items={result['zotero_total_items']}")
    print(f"zotero_parent_items={result['zotero_parent_items']}")
    print(f"mirror_json_count={result['mirror_json_count']}")
    print(f"mirror_raw_pdf_count={result['mirror_raw_pdf_count']}")
    print(f"mirror_zh_pdf_count={result['mirror_zh_pdf_count']}")
    print(f"duplicate_title_groups={len(result['duplicate_title_groups'])}")
    print(f"zotero_parent_missing_mirror_json={len(result['zotero_parent_missing_mirror_json'])}")
    print(f"mirror_json_not_in_zotero_parent={len(result['mirror_json_not_in_zotero_parent'])}")
    print(f"missing_original_attachment_for_mirrored_pdf={len(result['missing_original_attachment_for_mirrored_pdf'])}")
    print(f"missing_translated_attachment_for_mirrored_pdf={len(result['missing_translated_attachment_for_mirrored_pdf'])}")
    print(f"dated_collections={len(result['dated_collections'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
