#!/usr/bin/env python3
"""Package newly added or changed translated Zotero PDFs into persistent zip files."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_WORKSPACE_ROOT = Path(r"C:\GitClient\windows\repos\evilread-workspace")
DEFAULT_DOWNLOAD_BASE_URL = "https://code-file.jiashengfan.space"
MANIFEST_FIELDS = [
    "run_id",
    "date",
    "zotero_key",
    "title",
    "source_pdf",
    "zh_pdf",
    "zh_sha256",
    "size_bytes",
    "mtime_utc",
    "zip_path",
    "zip_sha256",
    "status",
]


def download_root(workspace_root: Path) -> Path:
    return Path(workspace_root) / "downloads" / "translated-pdfs"


def manifest_path(workspace_root: Path) -> Path:
    return download_root(workspace_root) / "manifest.csv"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_manifest(workspace_root: Path) -> list[dict[str, str]]:
    path = manifest_path(workspace_root)
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        rows: list[dict[str, str]] = []
        for row in reader:
            rows.append({field: str(row.get(field) or "") for field in MANIFEST_FIELDS})
    return rows


def append_manifest_rows(workspace_root: Path, rows: list[dict[str, Any]]) -> None:
    path = manifest_path(workspace_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    exists = path.exists() and path.stat().st_size > 0
    with path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST_FIELDS)
        if not exists:
            writer.writeheader()
        for row in rows:
            writer.writerow({field: str(row.get(field) or "") for field in MANIFEST_FIELDS})


def zotero_key_from_zh_pdf(path: Path) -> str:
    name = path.name
    suffix = ".zh.pdf"
    if name.lower().endswith(suffix):
        return name[: -len(suffix)]
    return path.stem


def load_title(item_dir: Path, zotero_key: str) -> str:
    metadata_path = item_dir / f"{zotero_key}.json"
    if not metadata_path.exists():
        return zotero_key
    try:
        data = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return zotero_key
    title = data.get("title")
    if not title and isinstance(data.get("data"), dict):
        title = data["data"].get("title")
    return str(title or zotero_key).strip() or zotero_key


def mtime_utc(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def safe_archive_name(zotero_key: str, title: str) -> str:
    compact_title = re.sub(r"[\\/:*?\"<>|\r\n\t]+", " ", title).strip()
    compact_title = re.sub(r"\s+", " ", compact_title)
    if not compact_title or compact_title == zotero_key:
        return f"{zotero_key}.zh.pdf"
    return f"{zotero_key} - {compact_title[:120]}.zh.pdf"


def existing_pdf_signatures(rows: list[dict[str, str]]) -> set[tuple[str, str, str]]:
    return {
        (row.get("zotero_key", ""), row.get("zh_sha256", ""), row.get("size_bytes", ""))
        for row in rows
        if row.get("status") == "packaged" and row.get("zotero_key") and row.get("zh_sha256")
    }


def default_run_id(run_date: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%H%M%S")
    return f"{run_date}-{stamp}"


def package_incremental_translations(
    workspace_root: Path = DEFAULT_WORKSPACE_ROOT,
    run_date: str | None = None,
    run_id: str | None = None,
    download_base_url: str = DEFAULT_DOWNLOAD_BASE_URL,
) -> dict[str, Any]:
    workspace_root = Path(workspace_root)
    run_date = run_date or datetime.now().strftime("%Y-%m-%d")
    run_id = run_id or default_run_id(run_date)
    item_dir = workspace_root / "zotero" / "library" / "items"
    previous_rows = read_manifest(workspace_root)
    seen = existing_pdf_signatures(previous_rows)

    candidates: list[dict[str, Any]] = []
    for zh_pdf in sorted(item_dir.glob("*.zh.pdf")):
        zotero_key = zotero_key_from_zh_pdf(zh_pdf)
        stat = zh_pdf.stat()
        zh_hash = sha256_file(zh_pdf)
        size = str(stat.st_size)
        signature = (zotero_key, zh_hash, size)
        if signature in seen:
            continue
        source_pdf = item_dir / f"{zotero_key}.pdf"
        candidates.append(
            {
                "zotero_key": zotero_key,
                "title": load_title(item_dir, zotero_key),
                "source_pdf": str(source_pdf) if source_pdf.exists() else "",
                "zh_pdf": str(zh_pdf),
                "zh_sha256": zh_hash,
                "size_bytes": size,
                "mtime_utc": mtime_utc(zh_pdf),
            }
        )

    if not candidates:
        append_manifest_rows(
            workspace_root,
            [
                {
                    "run_id": run_id,
                    "date": run_date,
                    "status": "no_new_files",
                }
            ],
        )
        return {
            "run_id": run_id,
            "date": run_date,
            "status": "no_new_files",
            "file_count": 0,
            "zip_path": "",
            "zip_sha256": "",
            "download_url": "",
            "manifest_path": str(manifest_path(workspace_root)),
            "items": [],
        }

    batch_dir = download_root(workspace_root) / "batches" / run_date
    batch_dir.mkdir(parents=True, exist_ok=True)
    zip_path = batch_dir / f"{run_id}.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        used_names: set[str] = set()
        for item in candidates:
            archive_name = safe_archive_name(item["zotero_key"], item["title"])
            if archive_name in used_names:
                archive_name = f"{item['zotero_key']}-{item['zh_sha256'][:8]}.zh.pdf"
            used_names.add(archive_name)
            archive.write(item["zh_pdf"], arcname=archive_name)

    zip_hash = sha256_file(zip_path)
    rows = [
        {
            **item,
            "run_id": run_id,
            "date": run_date,
            "zip_path": str(zip_path),
            "zip_sha256": zip_hash,
            "status": "packaged",
        }
        for item in candidates
    ]
    append_manifest_rows(workspace_root, rows)
    return {
        "run_id": run_id,
        "date": run_date,
        "status": "packaged",
        "file_count": len(candidates),
        "zip_path": str(zip_path),
        "zip_sha256": zip_hash,
        "download_url": f"{download_base_url.rstrip('/')}/downloads/{run_id}.zip",
        "manifest_path": str(manifest_path(workspace_root)),
        "items": candidates,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Package changed translated Zotero PDFs.")
    parser.add_argument("--workspace", default=str(DEFAULT_WORKSPACE_ROOT))
    parser.add_argument("--date", default="")
    parser.add_argument("--run-id", default="")
    parser.add_argument("--download-base-url", default=DEFAULT_DOWNLOAD_BASE_URL)
    args = parser.parse_args()
    result = package_incremental_translations(
        Path(args.workspace),
        run_date=args.date or None,
        run_id=args.run_id or None,
        download_base_url=args.download_base_url,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
