#!/usr/bin/env python3
"""Ingest normalized paper records into Zotero and mirror them into Obsidian."""

from __future__ import annotations

import argparse
from datetime import date
import json
import os
from pathlib import Path
import re
from typing import Any, Protocol
from uuid import uuid4
import urllib.error
import urllib.parse
import urllib.request


class ZoteroClient(Protocol):
    def ensure_collection(self, collection_path: str) -> str:
        ...

    def create_journal_article(self, record: dict[str, Any], collection_key: str) -> str:
        ...

    def attach_pdf(self, item_key: str, record: dict[str, Any]) -> bool:
        ...


class LocalZoteroClient:
    collection_status = "native"

    def __init__(self, base_url: str = "http://127.0.0.1:23119/api/users/0") -> None:
        self.base_url = base_url.rstrip("/")

    def request_json(self, method: str, path: str, payload: Any | None = None) -> Any:
        data = None
        headers = {"Content-Type": "application/json"}
        if payload is not None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            headers=headers,
            method=method,
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}

    def ensure_collection(self, collection_path: str) -> str:
        # Local Zotero exposes the Web API shape. We create nested collections when
        # lookup is unavailable; existing duplicates are acceptable for v1 dry runs.
        parent_key = ""
        for part in [segment for segment in collection_path.split("/") if segment and segment != "Library"]:
            payload: dict[str, Any] = {"name": part}
            if parent_key:
                payload["parentCollection"] = parent_key
            response = self.request_json("POST", "/collections", [payload])
            successful = response.get("successful", {})
            if successful:
                parent_key = next(iter(successful.values()))["key"]
        if not parent_key:
            raise RuntimeError(f"failed to create collection path {collection_path}")
        return parent_key

    def create_journal_article(self, record: dict[str, Any], collection_key: str) -> str:
        creators = [
            {"creatorType": "author", "name": author}
            for author in record.get("authors", [])
            if str(author).strip()
        ]
        item = {
            "itemType": "journalArticle",
            "title": record.get("title", ""),
            "creators": creators,
            "abstractNote": record.get("abstract", ""),
            "DOI": record.get("doi", ""),
            "url": record.get("url") or record.get("paper_url") or record.get("pdf_url", ""),
            "publicationTitle": record.get("venue", ""),
            "date": record.get("published_date") or str(record.get("year", "")),
            "collections": [collection_key],
            "tags": [{"tag": f"source:{record.get('source', 'unknown')}"}],
        }
        response = self.request_json("POST", "/items", [item])
        successful = response.get("successful", {})
        if not successful:
            raise RuntimeError(f"failed to create Zotero item for {record.get('title')}")
        return next(iter(successful.values()))["key"]

    def attach_pdf(self, item_key: str, record: dict[str, Any]) -> bool:
        # Zotero's local connector attachment endpoints differ by plugin state.
        # For v1, return whether the record already has a usable local/pdf URL; the
        # watcher/sync step will verify actual files and tag pending work.
        return bool(record.get("pdf_local_path") or record.get("pdf_url"))


class ConnectorZoteroClient:
    """Write through Zotero's built-in Connector server.

    Zotero's local Web API is currently read-only for item/collection mutation.
    The connector server is the supported local write path used by browser
    connectors. It writes to the currently selected library/collection; v1 stores
    the requested collection path as a tag and mirror metadata.
    """

    collection_status = "tag-fallback"

    def __init__(
        self,
        connector_url: str = "http://127.0.0.1:23119/connector",
        api_url: str = "http://127.0.0.1:23119/api/users/0",
    ) -> None:
        self.connector_url = connector_url.rstrip("/")
        self.api_url = api_url.rstrip("/")
        self.collection_path = ""

    def _request_json(
        self,
        url: str,
        method: str = "GET",
        payload: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        data = None
        request_headers = headers or {}
        if payload is not None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            request_headers = {"Content-Type": "application/json", **request_headers}
        request = urllib.request.Request(url, data=data, headers=request_headers, method=method)
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}

    def ensure_collection(self, collection_path: str) -> str:
        self.collection_path = collection_path
        return collection_path

    def create_journal_article(self, record: dict[str, Any], collection_key: str) -> str:
        title = str(record.get("title") or "Untitled").strip()
        if not title:
            raise ValueError("record title is required")
        existing_key = self._find_existing_item_key(title=title, doi=str(record.get("doi") or ""))
        if existing_key:
            return existing_key
        connector_item_id = f"evilread-{uuid4().hex}"
        tags = [
            {"tag": f"source:{record.get('source', 'unknown')}"},
            {"tag": f"evilread:collection:{collection_key}"},
        ]
        if record.get("mode"):
            tags.append({"tag": f"evilread:mode:{record['mode']}"})
        if not record.get("pdf_local_path"):
            tags.append({"tag": "needs-pdf"})
        item = {
            "id": connector_item_id,
            "itemType": "journalArticle",
            "title": title,
            "creators": self._creators(record.get("authors", [])),
            "abstractNote": record.get("abstract", ""),
            "DOI": record.get("doi", ""),
            "url": record.get("url") or record.get("paper_url") or record.get("pdf_url", ""),
            "publicationTitle": record.get("venue", ""),
            "date": record.get("published_date") or str(record.get("year", "")),
            "tags": tags,
        }
        if record.get("pdf_url"):
            item["attachments"] = [
                {
                    "title": "EvilRead PDF",
                    "url": record.get("pdf_url"),
                    "mimeType": "application/pdf",
                }
            ]
        payload = {
            "sessionID": f"evilread-{uuid4().hex}",
            "uri": item["url"] or "https://local.evilread/connector-ingest",
            "items": [item],
        }
        self._request_json(
            f"{self.connector_url}/saveItems",
            method="POST",
            payload=payload,
            headers={"X-Zotero-Connector-API-Version": "3", "Origin": "http://127.0.0.1"},
        )
        return self._find_recent_item_key(title=title, doi=str(record.get("doi") or ""))

    def _find_existing_item_key(self, title: str, doi: str) -> str:
        wanted_title = normalized_title(title)
        wanted_doi = doi.strip().lower()
        start = 0
        limit = 100
        while start < 500:
            query = urllib.parse.urlencode({"sort": "dateModified", "direction": "desc", "limit": str(limit), "start": str(start)})
            items = self._request_json(f"{self.api_url}/items?{query}")
            if not isinstance(items, list):
                return ""
            for item in items:
                if not isinstance(item, dict):
                    continue
                data = item.get("data", {})
                if not isinstance(data, dict):
                    continue
                if data.get("itemType") == "attachment" or data.get("parentItem"):
                    continue
                item_key = str(item.get("key") or data.get("key") or "").strip()
                item_doi = str(data.get("DOI") or "").strip().lower()
                item_title = normalized_title(str(data.get("title") or ""))
                if item_key and wanted_doi and item_doi == wanted_doi:
                    return item_key
                if item_key and wanted_title and item_title == wanted_title:
                    return item_key
            if len(items) < limit:
                break
            start += limit
        return ""

    def attach_pdf(self, item_key: str, record: dict[str, Any]) -> bool:
        return bool(record.get("pdf_local_path"))

    def _find_recent_item_key(self, title: str, doi: str) -> str:
        query = urllib.parse.urlencode({"sort": "dateAdded", "direction": "desc", "limit": "25"})
        items = self._request_json(f"{self.api_url}/items?{query}")
        for item in items:
            data = item.get("data", {})
            if data.get("title") == title and (not doi or data.get("DOI") == doi):
                return item["key"]
        for item in items:
            if item.get("data", {}).get("title") == title:
                return item["key"]
        raise RuntimeError(f"saved Zotero item was not found in recent items: {title}")

    def _creators(self, authors: Any) -> list[dict[str, str]]:
        creators: list[dict[str, str]] = []
        if not isinstance(authors, list):
            return creators
        for author in authors:
            name = str(author).strip()
            if not name:
                continue
            parts = name.split()
            if len(parts) >= 2:
                creators.append(
                    {
                        "creatorType": "author",
                        "firstName": " ".join(parts[:-1]),
                        "lastName": parts[-1],
                    }
                )
            else:
                creators.append({"creatorType": "author", "name": name})
        return creators


def normalized_title(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\u4e00-\u9fff]+", " ", value.lower())).strip()


def load_records(input_path: Path) -> list[dict[str, Any]]:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("papers", "records", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
        if isinstance(payload.get("sources"), list):
            papers: list[dict[str, Any]] = []
            for source in payload["sources"]:
                if isinstance(source, dict) and isinstance(source.get("papers"), list):
                    papers.extend(source["papers"])
            return papers
    raise ValueError(f"unsupported paper-query JSON shape in {input_path}")


def mirror_item(
    vault_root: Path,
    item_key: str,
    record: dict[str, Any],
    collection_path: str,
    ingest_date: str,
) -> Path:
    year = ingest_date[:4]
    mirror_dir = vault_root / "30_Inbox" / "Zotero" / year
    mirror_dir.mkdir(parents=True, exist_ok=True)
    mirror_path = mirror_dir / f"{item_key}.md"
    title = record.get("title", "Untitled")
    authors = ", ".join(record.get("authors", []))
    workspace_root = vault_root.parent if vault_root.name == "vault" else None
    artifact_lines: list[str] = []
    if workspace_root:
        item_dir = workspace_root / "zotero" / "library" / "items"
        for label, suffix in (("Original PDF", ".pdf"), ("Translated PDF", ".zh.pdf")):
            target = item_dir / f"{item_key}{suffix}"
            if target.exists():
                relative = Path(os.path.relpath(target, mirror_path.parent)).as_posix()
                artifact_lines.append(f"- {label}: [{target.name}]({relative})")
    mirror_path.write_text(
        "\n".join(
            [
                "---",
                f'zotero_key: "{item_key}"',
                f'doi: "{record.get("doi", "")}"',
                f'added_date: "{ingest_date}"',
                f'collection: "{collection_path}"',
                f'source: "{record.get("source", "")}"',
                "---",
                "",
                f"# {title}",
                "",
                f"- Authors: {authors}",
                f"- URL: {record.get('url') or record.get('pdf_url', '')}",
                f"- PDF: {record.get('pdf_url', '')}",
                *artifact_lines,
                "",
                "## Abstract",
                record.get("abstract", ""),
                "",
            ]
        ),
        encoding="utf-8",
    )
    return mirror_path


def ingest_records(
    records: list[dict[str, Any]],
    mode: str,
    ingest_date: str | None,
    vault_root: Path,
    client: ZoteroClient | None = None,
) -> list[dict[str, Any]]:
    if mode not in {"confirmed", "exploration"}:
        raise ValueError("mode must be confirmed or exploration")
    ingest_date = ingest_date or date.today().isoformat()
    collection_label = "Confirmed" if mode == "confirmed" else "Exploration"
    collection_path = f"Library/{collection_label}/{ingest_date}"
    client = client or LocalZoteroClient()
    collection_key = client.ensure_collection(collection_path)
    collection_status = getattr(client, "collection_status", "unknown")
    results: list[dict[str, Any]] = []
    for record in records:
        item_key = client.create_journal_article(record, collection_key)
        has_attachment = client.attach_pdf(item_key, record)
        tags = [] if has_attachment else ["needs-pdf"]
        mirror_path = mirror_item(Path(vault_root), item_key, record, collection_path, ingest_date)
        results.append(
            {
                "title": record.get("title", ""),
                "zotero_key": item_key,
                "collection": collection_path,
                "collection_status": collection_status,
                "tags": tags,
                "mirror_path": str(mirror_path),
                "status": "ok" if has_attachment else "needs-pdf",
            }
        )
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest paper-query JSON into Zotero")
    parser.add_argument("--input", required=True, help="paper-query JSON path")
    parser.add_argument("--mode", choices=["confirmed", "exploration"], required=True)
    parser.add_argument("--vault", required=True, help="evilread-vault working tree")
    parser.add_argument("--date", default="", help="Ingest date, defaults to today")
    parser.add_argument("--zotero-api", default="http://127.0.0.1:23119/api/users/0")
    parser.add_argument("--connector-url", default="http://127.0.0.1:23119/connector")
    parser.add_argument("--backend", choices=["connector", "local-api"], default="connector")
    parser.add_argument("--output", default="", help="Optional JSON output path")
    args = parser.parse_args()

    records = load_records(Path(args.input))
    try:
        results = ingest_records(
            records=records,
            mode=args.mode,
            ingest_date=args.date or None,
            vault_root=Path(args.vault),
            client=ConnectorZoteroClient(args.connector_url, args.zotero_api)
            if args.backend == "connector"
            else LocalZoteroClient(args.zotero_api),
        )
    except urllib.error.URLError as exc:
        raise SystemExit(f"Zotero local API unavailable: {exc}") from exc
    encoded = json.dumps(results, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(encoded + "\n", encoding="utf-8")
    else:
        print(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
