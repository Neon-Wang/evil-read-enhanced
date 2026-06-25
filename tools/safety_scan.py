#!/usr/bin/env python3
"""Scan candidate sync files for obvious secrets and blocked filenames."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
from typing import Iterable

BLOCKED_NAMES = {
    ".env",
    "prefs.js",
    "extensions.json",
}

BLOCKED_PATTERNS = [
    re.compile(r"^zotero\.sqlite", re.IGNORECASE),
    re.compile(r"^INITIAL-CREDENTIALS", re.IGNORECASE),
]

SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9_-]{10,}"),
    re.compile(r"Bearer\s+[A-Za-z0-9._-]{10,}", re.IGNORECASE),
    re.compile(r"\bapi[_-]?key\s*[:=]\s*['\"]?[^'\"\s]+", re.IGNORECASE),
    re.compile(r"\btoken\s*[:=]\s*['\"]?[^'\"\s]+", re.IGNORECASE),
    re.compile(r"\bpassword\s*[:=]\s*['\"]?[^'\"\s]+", re.IGNORECASE),
]


def iter_files(paths: Iterable[Path]) -> Iterable[Path]:
    for path in paths:
        resolved = Path(path)
        if not resolved.exists():
            yield resolved
            continue
        if resolved.is_file():
            yield resolved
            continue
        for child in resolved.rglob("*"):
            if child.is_file():
                yield child


def is_blocked_name(path: Path) -> bool:
    name = path.name
    if name in BLOCKED_NAMES:
        return True
    return any(pattern.match(name) for pattern in BLOCKED_PATTERNS)


def scan_file(path: Path) -> list[str]:
    findings: list[str] = []
    if not path.exists():
        findings.append(f"{path}: path does not exist")
        return findings
    if is_blocked_name(path):
        findings.append(f"{path}: blocked filename")
        return findings
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except OSError as exc:
        findings.append(f"{path}: unreadable file: {exc}")
        return findings
    for pattern in SECRET_PATTERNS:
        if pattern.search(content):
            findings.append(f"{path}: secret-like content matched {pattern.pattern}")
    return findings


def scan_paths(paths: Iterable[Path | str]) -> list[str]:
    candidate_paths = [Path(path) for path in paths]
    findings: list[str] = []
    for file_path in iter_files(candidate_paths):
        findings.extend(scan_file(file_path))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan files for obvious secrets")
    parser.add_argument("paths", nargs="+", help="Files or directories to scan")
    args = parser.parse_args()

    findings = scan_paths(args.paths)
    for finding in findings:
        print(finding)
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
