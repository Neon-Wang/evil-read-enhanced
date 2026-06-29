#!/usr/bin/env python3
"""Reflect daily-note comments back into research preferences."""

from __future__ import annotations

import argparse
from datetime import date
import json
from pathlib import Path
import re
from typing import Any

import yaml

COMMENT_HEADINGS = (
    "## 我的想法",
    "## Start My Day Comments",
    "## 鎴戠殑鎯虫硶",
    "## 閹存垹娈戦幆铏《",
)


class PreferenceAnalysisError(RuntimeError):
    """Raised when raw preference comments would be written without agent analysis."""


def looks_like_question(value: str) -> bool:
    return value.endswith(("?", "？")) or any(
        token in value
        for token in ("什么", "如何", "为什么", "怎么", "是否", "吗", "哪", "浠€涔?", "濡備綍", "涓轰粈涔?", "鎬庝箞", "鏄惁", "鍚?")
    )


def parse_comment_lines(note_text: str) -> dict[str, list[str]]:
    parsed = {"interests": [], "avoids": [], "deepen": [], "questions": [], "requests": [], "pending": []}
    in_section = False
    for raw_line in note_text.splitlines():
        line = raw_line.strip()
        if line.startswith("## "):
            if in_section:
                break
            in_section = any(line.startswith(heading) for heading in COMMENT_HEADINGS)
            continue
        if not in_section:
            continue
        cleaned = re.sub(r"^[-*]\s*", "", line).strip()
        if cleaned.startswith("+interest:"):
            value = cleaned.split(":", 1)[1].strip()
            if value:
                parsed["interests"].append(value)
        elif cleaned.startswith("-avoid:"):
            value = cleaned.split(":", 1)[1].strip()
            if value:
                parsed["avoids"].append(value)
        elif cleaned.startswith("!deepen:"):
            value = cleaned.split(":", 1)[1].strip()
            if value:
                parsed["deepen"].append(value)
        elif cleaned.startswith("?question:"):
            value = cleaned.split(":", 1)[1].strip()
            if value:
                parsed["questions"].append(value)
        elif cleaned.startswith("pending:"):
            value = cleaned.split(":", 1)[1].strip()
            if value:
                parsed["pending"].append(value)
                parsed["requests"].append(f"pending: {value}")
        elif cleaned and cleaned not in {"-", "--"}:
            if cleaned.startswith(("请", "帮", "麻烦", "检查", "同步", "导入", "璇?", "甯?", "楹荤儲", "妫€鏌?", "鍚屾", "瀵煎叆")):
                parsed["requests"].append(cleaned)
            elif looks_like_question(cleaned):
                parsed["questions"].append(cleaned)
            else:
                parsed["requests"].append(cleaned)
    return parsed


def ensure_list(mapping: dict[str, Any], key: str) -> list[Any]:
    value = mapping.get(key)
    if isinstance(value, list):
        return value
    mapping[key] = []
    return mapping[key]


def append_unique(values: list[Any], additions: list[str]) -> list[str]:
    added: list[str] = []
    existing = {str(value).strip().lower() for value in values}
    for addition in additions:
        normalized = addition.strip()
        if normalized and normalized.lower() not in existing:
            values.append(normalized)
            existing.add(normalized.lower())
            added.append(normalized)
    return added


def raw_preference_values(comments: dict[str, list[str]]) -> set[str]:
    return {
        value.strip().lower()
        for key in ("interests", "avoids")
        for value in comments.get(key, [])
        if value.strip()
    }


def extract_preference_keywords(preference_updates: dict[str, Any] | None, key: str, raw_values: set[str]) -> list[str]:
    if not isinstance(preference_updates, dict):
        return []
    aliases = {
        "interests": ("interests", "keywords"),
        "avoids": ("avoids", "excluded_keywords"),
    }
    entries: list[Any] = []
    for alias in aliases[key]:
        value = preference_updates.get(alias)
        if isinstance(value, list):
            entries.extend(value)
    keywords: list[str] = []
    seen: set[str] = set()
    for entry in entries:
        if isinstance(entry, str):
            candidate = entry
        elif isinstance(entry, dict):
            candidate = str(
                entry.get("keyword")
                or entry.get("topic")
                or entry.get("query")
                or entry.get("name")
                or ""
            )
        else:
            continue
        normalized = " ".join(candidate.split()).strip()
        lowered = normalized.lower()
        if not normalized or lowered in seen or lowered in raw_values:
            continue
        keywords.append(normalized)
        seen.add(lowered)
    return keywords


def analyzed_preference_comments(
    comments: dict[str, list[str]],
    preference_updates: dict[str, Any] | None,
    require_agent_analysis: bool = False,
) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    raw_values = raw_preference_values(comments)
    analyzed = {
        "interests": extract_preference_keywords(preference_updates, "interests", raw_values),
        "avoids": extract_preference_keywords(preference_updates, "avoids", raw_values),
    }
    missing_categories = [
        key
        for key in ("interests", "avoids")
        if comments.get(key) and not analyzed[key]
    ]
    if require_agent_analysis and missing_categories:
        raise PreferenceAnalysisError(
            "raw preference comments require agent-analyzed preference updates before updating research_interests.yaml: "
            + ", ".join(missing_categories)
        )
    config_comments = {**comments, "interests": analyzed["interests"], "avoids": analyzed["avoids"]}
    return config_comments, analyzed


def append_to_yaml_sequence(lines: list[str], key: str, additions: list[str], item_indent: str) -> tuple[list[str], list[str]]:
    added: list[str] = []
    if not additions:
        return lines, added
    key_pattern = re.compile(rf"^(\s*){re.escape(key)}:\s*$")
    key_index = next((index for index, line in enumerate(lines) if key_pattern.match(line)), None)
    if key_index is None:
        return lines, added
    existing = {line.strip().lstrip("-").strip().strip('"').strip("'").lower() for line in lines[key_index + 1 :]}
    insert_at = key_index + 1
    while insert_at < len(lines):
        stripped = lines[insert_at].strip()
        if stripped.startswith("-") or not stripped:
            insert_at += 1
            continue
        current_indent = len(lines[insert_at]) - len(lines[insert_at].lstrip(" "))
        key_indent = len(lines[key_index]) - len(lines[key_index].lstrip(" "))
        if current_indent <= key_indent:
            break
        insert_at += 1
    new_lines = list(lines)
    for addition in additions:
        normalized = addition.strip()
        if normalized and normalized.lower() not in existing:
            new_lines.insert(insert_at, f'{item_indent}- "{normalized}"')
            insert_at += 1
            existing.add(normalized.lower())
            added.append(normalized)
    return new_lines, added


def update_research_domains_text(config_path: Path, comments: dict[str, list[str]]) -> dict[str, list[str]]:
    lines = config_path.read_text(encoding="utf-8").splitlines()
    updated_lines, keyword_additions = append_to_yaml_sequence(lines, "keywords", comments["interests"], "      ")
    updated_lines, excluded_additions = append_to_yaml_sequence(updated_lines, "excluded_keywords", comments["avoids"], "  ")
    config_path.write_text("\n".join(updated_lines).rstrip() + "\n", encoding="utf-8")
    return {"keywords": keyword_additions, "excluded_keywords": excluded_additions}


def update_research_config(
    config_path: Path,
    comments: dict[str, list[str]],
    preference_updates: dict[str, Any] | None = None,
    require_agent_analysis: bool = False,
) -> dict[str, Any]:
    config_comments, analyzed = analyzed_preference_comments(
        comments,
        preference_updates,
        require_agent_analysis=require_agent_analysis,
    )
    raw_text = config_path.read_text(encoding="utf-8")
    config = yaml.safe_load(raw_text) or {}
    if isinstance(config.get("research_domains"), dict):
        changes = update_research_domains_text(config_path, config_comments)
        return {**changes, "preference_updates": analyzed}
    domains = config.setdefault("domains", [])
    if not domains:
        domains.append({"name": "General", "keywords": [], "excluded_keywords": []})
    primary_domain = domains[0]
    if not isinstance(primary_domain, dict):
        raise ValueError("first domain in research config must be a mapping")
    keyword_additions = append_unique(ensure_list(primary_domain, "keywords"), config_comments["interests"])
    excluded_additions = append_unique(ensure_list(primary_domain, "excluded_keywords"), config_comments["avoids"])
    config_path.write_text(yaml.safe_dump(config, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return {"keywords": keyword_additions, "excluded_keywords": excluded_additions, "preference_updates": analyzed}


def write_preference_diff(vault_root: Path, diff_date: str, comments: dict[str, list[str]]) -> Path:
    diff_dir = vault_root / "99_System" / "preference_diffs"
    diff_dir.mkdir(parents=True, exist_ok=True)
    diff_path = diff_dir / f"{diff_date}.diff"
    lines = [f"# Preference diff {diff_date}", ""]
    for interest in comments["interests"]:
        lines.append(f"+interest: {interest}")
    for avoid in comments["avoids"]:
        lines.append(f"-avoid: {avoid}")
    for deepen in comments["deepen"]:
        lines.append(f"!deepen: {deepen}")
    for question in comments["questions"]:
        lines.append(f"?question: {question}")
    for request in comments.get("requests", []):
        lines.append(f"request: {request}")
    for pending in comments.get("pending", []):
        lines.append(f"pending: {pending}")
    diff_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return diff_path


def append_open_questions(vault_root: Path, topics: list[str]) -> Path:
    index_dir = vault_root / "99_System" / "Indexes"
    index_dir.mkdir(parents=True, exist_ok=True)
    questions_path = index_dir / "open_questions.md"
    existing_text = questions_path.read_text(encoding="utf-8") if questions_path.exists() else "# Open Questions\n"
    existing_lines = {line.strip().lower() for line in existing_text.splitlines()}
    new_lines = []
    for topic in topics:
        line = f"- {topic}"
        if line.lower() not in existing_lines:
            new_lines.append(line)
            existing_lines.add(line.lower())
    if new_lines:
        separator = "" if existing_text.endswith("\n") else "\n"
        questions_path.write_text(existing_text + separator + "\n".join(new_lines) + "\n", encoding="utf-8")
    elif not questions_path.exists():
        questions_path.write_text(existing_text, encoding="utf-8")
    return questions_path


def reflect_daily_note(
    daily_note: Path,
    vault_root: Path,
    diff_date: str | None = None,
    preference_updates: dict[str, Any] | None = None,
    require_agent_analysis: bool = False,
) -> dict[str, Any]:
    diff_date = diff_date or date.today().isoformat()
    vault_root = Path(vault_root)
    daily_note = Path(daily_note)
    comments = parse_comment_lines(daily_note.read_text(encoding="utf-8"))
    config_path = vault_root / "99_System" / "Config" / "research_interests.yaml"
    config_changes = update_research_config(
        config_path,
        comments,
        preference_updates=preference_updates,
        require_agent_analysis=require_agent_analysis,
    )
    diff_path = write_preference_diff(vault_root, diff_date, comments)
    questions_path = append_open_questions(vault_root, comments["deepen"] + comments["questions"])
    return {
        **comments,
        "config_changes": config_changes,
        "preference_updates": config_changes.get("preference_updates", {"interests": [], "avoids": []}),
        "diff_path": str(diff_path),
        "open_questions_path": str(questions_path),
        "paper_query": {"confirmed_query": comments["deepen"], "avoid": comments["avoids"]},
    }


def find_latest_daily(vault_root: Path) -> Path:
    daily_dir = vault_root / "10_Daily"
    candidates = sorted(daily_dir.glob("*.md"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not candidates:
        raise FileNotFoundError(f"no daily notes found in {daily_dir}")
    return candidates[0]


def main() -> int:
    parser = argparse.ArgumentParser(description="Reflect Start My Day comments into preferences")
    parser.add_argument("--vault", required=True, help="Obsidian vault root")
    parser.add_argument("--daily-note", default="", help="Daily note path; latest note when omitted")
    parser.add_argument("--diff-date", default="", help="Diff date, defaults to today")
    parser.add_argument("--output", default="", help="Optional JSON output path")
    args = parser.parse_args()

    vault_root = Path(args.vault)
    daily_note = Path(args.daily_note) if args.daily_note else find_latest_daily(vault_root)
    summary = reflect_daily_note(daily_note, vault_root, args.diff_date or None)
    encoded = json.dumps(summary, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(encoded + "\n", encoding="utf-8")
    else:
        print(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
