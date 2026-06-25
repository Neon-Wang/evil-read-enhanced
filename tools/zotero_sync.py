#!/usr/bin/env python3
"""Mirror Zotero PDFs, translations, and BibTeX exports into the workspace zotero mirror."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import safety_scan


def find_first_pdf(source_dir: Path) -> Path | None:
    if not source_dir.exists():
        return None
    pdfs = sorted(source_dir.glob("*.pdf"))
    if not pdfs:
        return None
    return pdfs[0]


def copy_first_pdf(source_dir: Path, destination: Path) -> Path | None:
    source_pdf = find_first_pdf(source_dir)
    if source_pdf is None:
        return None
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_pdf, destination)
    return source_pdf


def normalized_name(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\u4e00-\u9fff]+", " ", value.lower())).strip()


def translation_candidates(
    translated_dir: Path,
    item_key: str,
    source_pdf: Path | None = None,
) -> list[Path]:
    if not translated_dir.exists():
        return []
    matches = [
        path
        for path in translated_dir.glob(f"*{item_key}*.pdf")
        if not path.name.startswith("._") and is_translation_pdf(path)
    ]
    if matches or source_pdf is None:
        return sorted(matches)
    source_stem = normalized_name(source_pdf.stem)
    candidates: list[Path] = []
    for path in translated_dir.glob("*.pdf"):
        if path.name.startswith("._"):
            continue
        if not is_translation_pdf(path):
            continue
        translated_stem = normalized_name(path.stem)
        if source_stem and (source_stem in translated_stem or translated_stem in source_stem):
            candidates.append(path)
    return sorted(candidates, key=translation_rank)


def is_translation_pdf(path: Path) -> bool:
    name = path.name.lower()
    return "zh" in name or "dual" in name or "mono" in name


def translation_rank(path: Path) -> tuple[int, str]:
    name = path.name.lower()
    if "dual" in name:
        rank = 0
    elif "mono" in name or "zh" in name:
        rank = 1
    else:
        rank = 2
    return (rank, name)


def copy_matching_translation(
    translated_dir: Path,
    item_key: str,
    destination: Path,
    source_pdf: Path | None = None,
) -> bool:
    matches = translation_candidates(translated_dir, item_key, source_pdf)
    if not matches:
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(matches[0], destination)
    return True


def run_git(repo: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    )


def fetch_item_metadata(api_url: str, item_key: str) -> dict[str, object]:
    request = urllib.request.Request(f"{api_url.rstrip('/')}/items/{urllib.parse.quote(item_key)}")
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def creator_bibtex_name(creator: dict[str, object]) -> str:
    if creator.get("name"):
        return str(creator["name"])
    first = str(creator.get("firstName", "")).strip()
    last = str(creator.get("lastName", "")).strip()
    return f"{last}, {first}".strip(", ")


def bibtex_year(date_value: object) -> str:
    match = re.search(r"\b(?:19|20)\d{2}\b", str(date_value))
    return match.group(0) if match else ""


def bibtex_entry(item_key: str, metadata: dict[str, object]) -> str:
    data = metadata.get("data", {}) if isinstance(metadata.get("data"), dict) else {}
    if data.get("itemType") == "attachment":
        return ""
    creators = data.get("creators", []) if isinstance(data.get("creators"), list) else []
    authors = " and ".join(
        creator_bibtex_name(creator)
        for creator in creators
        if isinstance(creator, dict) and creator.get("creatorType") == "author"
    )
    fields = {
        "title": data.get("title", ""),
        "author": authors,
        "year": bibtex_year(data.get("date", "")),
        "doi": data.get("DOI", ""),
        "url": data.get("url", ""),
    }
    lines = [f"@article{{{item_key},"]
    for name, value in fields.items():
        if value:
            lines.append(f"  {name} = {{{value}}},")
    lines.append("}")
    return "\n".join(lines)


def write_item_metadata(
    item_key: str,
    metadata: dict[str, object],
    zotero_repo: Path,
) -> Path:
    destination = zotero_repo / "library" / "items" / f"{item_key}.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination


def write_fallback_bibtex(
    item_keys: list[str],
    metadata_by_key: dict[str, dict[str, object]],
    zotero_repo: Path,
) -> Path | None:
    destination = zotero_repo / "library" / "exports" / "library.bib"
    entries = [
        entry
        for item_key in item_keys
        if item_key in metadata_by_key
        for entry in [bibtex_entry(item_key, metadata_by_key[item_key])]
        if entry
    ]
    if not entries:
        return None
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text("\n\n".join(entries) + ("\n" if entries else ""), encoding="utf-8")
    return destination


def sync_items(
    item_keys: list[str],
    zotero_storage: Path,
    translated_dir: Path,
    bib_export: Path,
    zotero_repo: Path,
    commit: bool = False,
    item_metadata: dict[str, dict[str, object]] | None = None,
    zotero_api: str = "http://127.0.0.1:23119/api/users/0",
) -> dict[str, object]:
    item_dir = zotero_repo / "library" / "items"
    export_dir = zotero_repo / "library" / "exports"
    item_metadata = item_metadata or {}
    copied: list[str] = []
    missing: list[str] = []
    for item_key in item_keys:
        metadata = item_metadata.get(item_key)
        if metadata is None:
            try:
                metadata = fetch_item_metadata(zotero_api, item_key)
                item_metadata[item_key] = metadata
            except OSError as exc:
                missing.append(f"{item_key}: metadata ({exc})")
        if metadata:
            copied.append(str(write_item_metadata(item_key, metadata, zotero_repo)))
        raw_destination = item_dir / f"{item_key}.pdf"
        translated_destination = item_dir / f"{item_key}.zh.pdf"
        source_pdf = copy_first_pdf(zotero_storage / item_key, raw_destination)
        translated_ok = copy_matching_translation(
            translated_dir,
            item_key,
            translated_destination,
            source_pdf,
        )
        if source_pdf:
            copied.append(str(raw_destination))
        if translated_ok:
            copied.append(str(translated_destination))
        if not source_pdf:
            missing.append(f"{item_key}: raw pdf")
        if not translated_ok:
            missing.append(f"{item_key}: translated pdf")
    if bib_export.exists():
        export_dir.mkdir(parents=True, exist_ok=True)
        bib_destination = export_dir / "library.bib"
        shutil.copy2(bib_export, bib_destination)
        copied.append(str(bib_destination))
    elif item_metadata:
        fallback_bibtex = write_fallback_bibtex(item_keys, item_metadata, zotero_repo)
        if fallback_bibtex:
            copied.append(str(fallback_bibtex))
    findings = safety_scan.scan_paths([Path(path) for path in copied])
    if findings:
        raise RuntimeError("safety scan failed:\n" + "\n".join(findings))
    commit_sha = ""
    if commit and copied:
        relative_paths = [str(Path(path).relative_to(zotero_repo)) for path in copied]
        run_git(zotero_repo, ["add", "--", *relative_paths])
        message = f"chore(zotero): sync {len(item_keys)} items"
        run_git(zotero_repo, ["commit", "-m", message])
        run_git(zotero_repo, ["push", "origin", "main"])
        commit_sha = run_git(zotero_repo, ["rev-parse", "--short", "HEAD"]).stdout.strip()
    return {"copied": copied, "missing": missing, "commit": commit_sha}


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Zotero artifacts to the EvilRead workspace")
    parser.add_argument("--keys", required=True, help="Comma-separated Zotero item keys")
    parser.add_argument("--zotero-storage", default=str(Path.home() / "Zotero" / "storage"))
    parser.add_argument(
        "--translated-dir",
        default=str(Path.home() / "AppData" / "Roaming" / "CodexZoteroPDF2zh" / "server" / "translated"),
    )
    parser.add_argument("--bib-export", default=str(Path.home() / "Zotero" / "exports" / "library.bib"))
    parser.add_argument("--workspace", default="", help="Monorepo root containing zotero/")
    parser.add_argument("--zotero-repo", default="", help="Zotero mirror root; defaults to <workspace>/zotero")
    parser.add_argument("--zotero-api", default="http://127.0.0.1:23119/api/users/0")
    parser.add_argument("--commit", action="store_true", help="Commit and push copied artifacts")
    args = parser.parse_args()

    keys = [key.strip() for key in args.keys.split(",") if key.strip()]
    zotero_repo = Path(args.zotero_repo) if args.zotero_repo else Path(args.workspace) / "zotero"
    if not args.zotero_repo and not args.workspace:
        zotero_repo = Path("C:/GitClient/windows/repos/evilread-workspace/zotero")
    result = sync_items(
        item_keys=keys,
        zotero_storage=Path(args.zotero_storage),
        translated_dir=Path(args.translated_dir),
        bib_export=Path(args.bib_export),
        zotero_repo=zotero_repo,
        commit=args.commit,
        zotero_api=args.zotero_api,
    )
    import json

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
