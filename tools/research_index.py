#!/usr/bin/env python3
"""Create and refresh categorized Research notes from Zotero mirror metadata."""

from __future__ import annotations

import argparse
from datetime import date
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from collection_metadata import enriched_metadata_from_pdf


PLACEHOLDERS = (
    "[问题描述",
    "[方法",
    "[详细描述",
    "[SCORE]/10",
    "当前元数据只提供题名",
    "需要 agent 精读",
    "当前条目缺少摘要",
    "缺少摘要或网页证据",
)


def item_data(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def normalize_title(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\u4e00-\u9fff]+", " ", value.lower())).strip()


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^\w\u4e00-\u9fff]+", "_", value.strip(), flags=re.UNICODE).strip("_")
    return cleaned[:120] or "Untitled"


def rel_link(from_path: Path, target: Path, label: str) -> str:
    rel = Path(os.path.relpath(target, from_path.parent)).as_posix()
    return f"[{label}]({rel})" if target.exists() else f"{label}: missing"


def authors(data: dict[str, Any]) -> str:
    creators = data.get("creators") if isinstance(data.get("creators"), list) else []
    names: list[str] = []
    for creator in creators:
        if not isinstance(creator, dict) or creator.get("creatorType") != "author":
            continue
        if creator.get("name"):
            names.append(str(creator["name"]))
        else:
            names.append(
                " ".join(
                    part
                    for part in [str(creator.get("firstName", "")).strip(), str(creator.get("lastName", "")).strip()]
                    if part
                )
            )
    return ", ".join(name for name in names if name)


def parse_extra(data: dict[str, Any]) -> dict[str, Any]:
    extra = data.get("extra")
    if isinstance(extra, dict):
        return extra
    if not isinstance(extra, str) or not extra.strip():
        return {}
    try:
        parsed = json.loads(extra)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def write_item_payload(json_path: Path, payload: dict[str, Any], data: dict[str, Any]) -> None:
    if isinstance(payload.get("data"), dict):
        payload["data"] = data
    else:
        payload.update(data)
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def enrich_item_data_from_pdf(item: dict[str, Any], workspace_root: Path, run_date: str) -> dict[str, Any]:
    data = item["data"]
    key = item["key"]
    pdf_path = workspace_root / "zotero" / "library" / "items" / f"{key}.pdf"
    if not pdf_path.exists():
        return data
    extra = parse_extra(data)
    original_name = str(extra.get("original_name") or f"{key}.pdf")
    enriched = enriched_metadata_from_pdf(pdf_path, original_name, run_date)
    current_title = str(data.get("title") or "")
    weak_title = bool(
        re.fullmatch(r"\d{4}\.\d{4,5}v?\d*", current_title.strip())
        or re.fullmatch(r"[ds]\d{5}\s+\d{3}\s+\d{5}\s+\w+", current_title.strip().lower())
        or current_title.strip().lower() == Path(original_name).stem.lower().replace("-", " ")
    )
    existing_doi = str(data.get("DOI") or "").lower()
    enriched_doi = str(enriched.get("DOI") or "").lower()
    weak_doi = bool(existing_doi.startswith("10.48550/arxiv") and enriched_doi and not enriched_doi.startswith("10.48550/arxiv"))
    for field in ("title", "abstractNote", "creators", "DOI", "url", "date", "publicationTitle", "archiveID"):
        value = enriched.get(field)
        if value and (not data.get(field) or (field == "title" and weak_title) or (field == "DOI" and weak_doi)):
            data[field] = value
    merged_extra = {**extra, "metadata_source": enriched.get("source", ""), "arxiv_id": enriched.get("arxiv_id", "")}
    if enriched.get("pdf_text_preview"):
        merged_extra["pdf_text_preview"] = enriched["pdf_text_preview"]
    data["extra"] = json.dumps(merged_extra, ensure_ascii=False)
    payload = json.loads(item["json_path"].read_text(encoding="utf-8"))
    write_item_payload(item["json_path"], payload, data)
    return data


def text_blob(data: dict[str, Any]) -> str:
    return " ".join(
        [
            str(data.get("title") or ""),
            str(data.get("abstractNote") or data.get("abstract") or ""),
            json.dumps(parse_extra(data), ensure_ascii=False),
        ]
    ).lower()


def infer_topic(data: dict[str, Any]) -> str:
    blob = text_blob(data)
    topic_rules = [
        ("Calibration and Uncertainty", ("calibration", "uncertainty", "confidence", "overconfidence", "ece")),
        ("OOD and Robustness", ("out-of-distribution", "ood", "robustness", "distribution shift")),
        ("Biological Neural Dynamics", ("spiking", "neural dynamics", "brainwide", "neural population")),
        ("Random Matrix and Criticality", ("random matrix", "critical", "eigenvalue", "power-law")),
        ("Agents and Reasoning", ("agent", "reasoning", "planning", "tool use", "gui")),
        ("Learning Theory", ("sample complexity", "gaussian", "optimization", "theory")),
    ]
    for topic, tokens in topic_rules:
        if any(token in blob for token in tokens):
            return topic
    return "Paper Notes"


def fallback_domain_topic(data: dict[str, Any]) -> tuple[str, str]:
    extra = parse_extra(data)
    domain = str(extra.get("matched_domain") or data.get("matched_domain") or "").strip()
    if domain and domain.lower() != "general":
        return domain, infer_topic(data)
    blob = text_blob(data)
    if any(token in blob for token in ("spiking", "neural dynamics", "random matrix", "brainwide", "biological neural")):
        return "Biological Neural Dynamics", infer_topic(data)
    if any(token in blob for token in ("calibration", "uncertainty", "out-of-distribution", "ood", "overconfidence")):
        return "Brain-Inspired AI Calibration", infer_topic(data)
    if any(token in blob for token in ("robustness", "loss landscape", "flat minima", "vision transformer", "state space")):
        return "Reliable ML from Neuroscience", infer_topic(data)
    return "Unclassified Research", infer_topic(data)


def load_items(workspace_root: Path) -> list[dict[str, Any]]:
    item_dir = workspace_root / "zotero" / "library" / "items"
    items: list[dict[str, Any]] = []
    for path in sorted(item_dir.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        data = item_data(payload)
        if data.get("itemType") in {"attachment", "note"}:
            continue
        key = str(data.get("key") or payload.get("key") or path.stem)
        items.append({"key": key, "data": data, "json_path": path})
    return items


def existing_notes(workspace_root: Path) -> dict[str, Path]:
    notes: dict[str, Path] = {}
    root = workspace_root / "vault" / "20_Research" / "Papers"
    for path in sorted(root.glob("**/*.md")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for pattern in (r"zotero_key:\s*[\"']?([^\"'\n]+)", r"doi:\s*[\"']?([^\"'\n]+)"):
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                notes[match.group(1).strip().lower()] = path
        for match in re.finditer(r"zotero_keys:\s*\[([^\]\n]+)\]", text, flags=re.IGNORECASE):
            for alias in match.group(1).split(","):
                cleaned = alias.strip().strip("\"'").lower()
                if cleaned:
                    notes[cleaned] = path
        notes.setdefault(normalize_title(path.stem.replace("_", " ")), path)
    return notes


def note_zotero_keys(text: str) -> list[str]:
    keys: list[str] = []
    for match in re.finditer(r"zotero_key:\s*[\"']?([^\"'\n]+)", text, flags=re.IGNORECASE):
        key = match.group(1).strip()
        if key and key not in keys:
            keys.append(key)
    for match in re.finditer(r"zotero_keys:\s*\[([^\]\n]+)\]", text, flags=re.IGNORECASE):
        for alias in match.group(1).split(","):
            key = alias.strip().strip("\"'")
            if key and key not in keys:
                keys.append(key)
    return keys


def ensure_zotero_key_alias(note_path: Path, key: str) -> bool:
    if not note_path.exists() or not key:
        return False
    text = note_path.read_text(encoding="utf-8", errors="ignore")
    keys = note_zotero_keys(text)
    if key in keys:
        return False
    keys.append(key)
    alias_line = "zotero_keys: [" + ", ".join(f'"{item}"' for item in keys) + "]"
    if re.search(r"(?im)^zotero_keys:\s*\[[^\]\n]*\]\s*$", text):
        updated = re.sub(r"(?im)^zotero_keys:\s*\[[^\]\n]*\]\s*$", alias_line, text, count=1)
    elif re.search(r"(?im)^zotero_key:\s*[^\n]+\n", text):
        updated = re.sub(r"(?im)^(zotero_key:\s*[^\n]+\n)", r"\1" + alias_line + "\n", text, count=1)
    else:
        updated = text
    if updated != text:
        note_path.write_text(updated, encoding="utf-8")
        return True
    return False


def needs_refresh(path: Path) -> bool:
    if not path.exists():
        return True
    text = path.read_text(encoding="utf-8", errors="ignore")
    return any(token in text for token in PLACEHOLDERS) or "## Zotero Artifacts" not in text or "## Start My Day" not in text


def decisions_by_key(agent_decisions: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if not isinstance(agent_decisions, dict):
        return {}
    raw = agent_decisions.get("research_notes") or agent_decisions.get("papers") or {}
    if not isinstance(raw, dict):
        return {}
    return {str(key): value for key, value in raw.items() if isinstance(value, dict)}


def decision_for_item(decisions: dict[str, dict[str, Any]], key: str, data: dict[str, Any]) -> dict[str, Any]:
    title = str(data.get("title") or "")
    return decisions.get(key) or decisions.get(title) or decisions.get(normalize_title(title)) or {}


def agent_research_markdown(decision: dict[str, Any]) -> str:
    return str(decision.get("research_note_markdown") or "").strip()


def target_note(
    workspace_root: Path,
    key: str,
    data: dict[str, Any],
    notes: dict[str, Path],
    decision: dict[str, Any] | None = None,
) -> Path:
    doi = str(data.get("DOI") or "").strip().lower()
    title_norm = normalize_title(str(data.get("title") or ""))
    found = notes.get(key.lower()) or (notes.get(doi) if doi else None) or (notes.get(title_norm) if title_norm else None)
    domain, topic = fallback_domain_topic(data)
    decision = decision or {}
    domain = str(decision.get("domain") or domain).strip() or "Unclassified Research"
    topic = str(decision.get("topic") or topic).strip() or "Paper Notes"
    if domain.lower() == "general":
        domain = "Unclassified Research"
    classified = (
        workspace_root
        / "vault"
        / "20_Research"
        / "Papers"
        / slugify(domain)
        / slugify(topic)
        / f"{slugify(str(data.get('title') or key))}.md"
    )
    if found and "General" not in found.parts:
        return found
    if found and found.exists() and found != classified:
        classified.parent.mkdir(parents=True, exist_ok=True)
        if not classified.exists():
            found.replace(classified)
        return classified
    return classified


def first_sentence(text: str) -> str:
    stripped = re.sub(r"\s+", " ", text.strip())
    if not stripped:
        return ""
    return re.split(r"(?<=[.!?。！？])\s+", stripped)[0].strip() or stripped


def insight_sentences(data: dict[str, Any], decision: dict[str, Any] | None = None) -> dict[str, str]:
    decision = decision or {}
    title = str(data.get("title") or "Untitled")
    abstract = str(data.get("abstractNote") or data.get("abstract") or "").strip()
    extra = parse_extra(data)
    pdf_preview = str(extra.get("pdf_text_preview") or "").strip()
    premise = abstract or pdf_preview or f"已导入《{title}》的本地 PDF；当前可用证据来自文件名、Zotero mirror 和 PDF 文本索引。"
    lead = first_sentence(premise) or premise
    return {
        "question": str(decision.get("research_question") or f"这篇论文围绕《{title}》展开；当前可追溯的核心问题线索是：{lead}"),
        "method": str(decision.get("method") or f"方法线索来自题名、摘要和公开元数据：{lead}"),
        "contribution": str(decision.get("contribution") or f"当前可确认的贡献线索是：{premise[:800]}"),
        "evidence": str(decision.get("evidence") or f"证据入口优先看原始 PDF、实验设置和公开摘要。当前自动索引摘录：{premise[:800]}"),
        "limits": str(decision.get("limits") or "自动分析基于公开元数据、PDF 文本和本地 Zotero mirror；如果论文正文没有清楚列出数据集、baseline 或消融，这些部分需要在后续人工精读时继续校对。"),
        "inspiration": str(decision.get("inspiration") or f"对当前研究的启发：先判断《{title}》是否能补强研究问题、方法迁移或评测设计；否则降级为背景材料。"),
        "daily": str(decision.get("daily") or "Start My Day 已为这篇论文建立 PDF、JSON 元数据、图片目录和日报推荐的闭环链接。"),
    }


def ensure_images(workspace_root: Path, note_path: Path, key: str) -> dict[str, Any]:
    pdf_path = workspace_root / "zotero" / "library" / "items" / f"{key}.pdf"
    image_dir = note_path.parent / note_path.stem / "images"
    if len(str(image_dir)) > 220:
        image_dir = note_path.parent / f"{note_path.stem[:60]}_images"
    index_path = image_dir / "index.md"
    if not pdf_path.exists():
        return {"status": "missing-pdf", "images": [], "index": str(index_path)}
    existing = [path for path in image_dir.glob("*") if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".pdf", ".svg"}]
    if existing and index_path.exists():
        return {"status": "exists", "images": [str(path) for path in existing], "index": str(index_path)}
    image_dir.mkdir(parents=True, exist_ok=True)
    script = REPO_ROOT / "extract-paper-images" / "scripts" / "extract_images.py"
    if not script.exists():
        return {"status": "script-missing", "images": [], "index": str(index_path)}
    completed = subprocess.run(
        [sys.executable, str(script), str(pdf_path), str(image_dir), str(index_path)],
        cwd=str(REPO_ROOT),
        text=True,
        capture_output=True,
        timeout=180,
        check=False,
    )
    images = [path for path in image_dir.glob("*") if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".pdf", ".svg"}]
    return {
        "status": "ok" if completed.returncode == 0 else "failed",
        "returncode": completed.returncode,
        "stderr": completed.stderr[-1000:],
        "images": [str(path) for path in images],
        "index": str(index_path),
    }


def image_lines(note_path: Path, image_result: dict[str, Any]) -> list[str]:
    images = [Path(path) for path in image_result.get("images", [])]
    if not images:
        return ["- 暂未提取到可用图片；已保留 PDF 链接供精读。"]
    lines = []
    for image in images[:5]:
        lines.append(f"- ![[{image.name}|600]]")
    index = Path(str(image_result.get("index") or ""))
    if index.exists():
        lines.append(f"- 图片索引：{rel_link(note_path, index, 'images/index.md')}")
    return lines


def render_note(
    workspace_root: Path,
    note_path: Path,
    key: str,
    data: dict[str, Any],
    run_date: str,
    decision: dict[str, Any] | None = None,
    image_result: dict[str, Any] | None = None,
) -> str:
    decision = decision or {}
    custom_markdown = agent_research_markdown(decision)
    if custom_markdown:
        if re.search(r"(?im)^zotero_key:\s*[\"']?", custom_markdown):
            return custom_markdown.rstrip() + "\n"
        title = str(data.get("title") or key)
        doi = str(data.get("DOI") or "")
        domain, topic = fallback_domain_topic(data)
        domain = str(decision.get("domain") or domain)
        topic = str(decision.get("topic") or topic)
        frontmatter = "\n".join(
            [
                "---",
                f'zotero_key: "{key}"',
                f'doi: "{doi}"',
                f'title: "{title}"',
                f'domain: "{domain}"',
                f'topic: "{topic}"',
                f'updated: "{run_date}"',
                'tags: ["research", "zotero", "start-my-day", "agent-read"]',
                "---",
                "",
            ]
        )
        return frontmatter + custom_markdown.rstrip() + "\n"
    item_dir = workspace_root / "zotero" / "library" / "items"
    json_path = item_dir / f"{key}.json"
    pdf_path = item_dir / f"{key}.pdf"
    zh_path = item_dir / f"{key}.zh.pdf"
    title = str(data.get("title") or key)
    doi = str(data.get("DOI") or "")
    domain, topic = fallback_domain_topic(data)
    domain = str(decision.get("domain") or domain)
    topic = str(decision.get("topic") or topic)
    insights = insight_sentences(data, decision)
    image_result = image_result or {"images": []}
    return "\n".join(
        [
            "---",
            f'zotero_key: "{key}"',
            f'doi: "{doi}"',
            f'title: "{title}"',
            f'domain: "{domain}"',
            f'topic: "{topic}"',
            f'updated: "{run_date}"',
            'tags: ["research", "zotero", "start-my-day"]',
            "---",
            "",
            f"# {title}",
            "",
            f"- Authors: {authors(data) or 'Unknown'}",
            f"- Year/Date: {data.get('date', '')}",
            f"- DOI: {doi or 'Unknown'}",
            f"- Source: {data.get('publicationTitle') or parse_extra(data).get('source') or 'Unknown'}",
            "",
            "## Zotero Artifacts",
            f"- Metadata JSON: {rel_link(note_path, json_path, 'JSON')}",
            f"- Original PDF: {rel_link(note_path, pdf_path, 'PDF')}",
            f"- Translated PDF: {rel_link(note_path, zh_path, 'ZH PDF')}",
            "",
            "## 图片与图表",
            *image_lines(note_path, image_result),
            "",
            "## 摘要与可追溯证据",
            str(data.get("abstractNote") or parse_extra(data).get("pdf_text_preview") or "本条目来自本地 PDF 导入，摘要由 Start My Day 从公开元数据或 PDF 文本中抽取。")[:2200],
            "",
            "## 研究问题",
            insights["question"],
            "",
            "## 方法概述",
            insights["method"],
            "",
            "## 核心贡献",
            insights["contribution"],
            "",
            "## 实验与证据",
            insights["evidence"],
            "",
            "## 局限性",
            insights["limits"],
            "",
            "## 对我研究的启发",
            insights["inspiration"],
            "",
            "## Start My Day 洞察",
            insights["daily"],
            "",
        ]
    )


def write_research_index(workspace_root: Path, entries: list[dict[str, Any]]) -> None:
    index_path = workspace_root / "vault" / "20_Research" / "INDEX.md"
    index_path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["# Research Index", "", "| Zotero | Domain | Topic | Title | Note |", "|---|---|---|---|---|"]
    for entry in entries:
        note = Path(entry["path"])
        rel = Path(os.path.relpath(note, index_path.parent)).as_posix()
        lines.append(f"| {entry['zotero_key']} | {entry.get('domain', '')} | {entry.get('topic', '')} | {entry['title']} | [Research]({rel}) |")
    index_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    machine_index = workspace_root / "vault" / "99_System" / "Indexes" / "research_index.json"
    machine_index.parent.mkdir(parents=True, exist_ok=True)
    machine_index.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_research_notes(
    workspace_root: Path,
    run_date: str | None = None,
    agent_decisions: dict[str, Any] | None = None,
    llm_client: Any | None = None,
    require_agent_research: bool = False,
) -> dict[str, Any]:
    if llm_client is not None and agent_decisions is None:
        maybe = llm_client.complete_daily_insight({"model_task": "start-my-day-research-notes"})
        agent_decisions = maybe if isinstance(maybe, dict) else None
    workspace_root = Path(workspace_root)
    run_date = run_date or date.today().isoformat()
    notes = existing_notes(workspace_root)
    decisions = decisions_by_key(agent_decisions)
    created: list[dict[str, Any]] = []
    updated: list[dict[str, Any]] = []
    incomplete: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []
    all_entries: list[dict[str, Any]] = []
    for item in load_items(workspace_root):
        key = item["key"]
        data = enrich_item_data_from_pdf(item, workspace_root, run_date)
        decision = decision_for_item(decisions, key, data)
        note_path = target_note(workspace_root, key, data, notes, decision)
        existed = note_path.exists()
        if existed:
            ensure_zotero_key_alias(note_path, key)
        domain, topic = fallback_domain_topic(data)
        domain = str(decision.get("domain") or domain)
        topic = str(decision.get("topic") or topic)
        custom_markdown = agent_research_markdown(decision)
        if require_agent_research and decision and not custom_markdown:
            incomplete.append({"zotero_key": key, "title": data.get("title", key), "reason": "agent-read research note missing"})
        if needs_refresh(note_path) or bool(custom_markdown):
            note_path.parent.mkdir(parents=True, exist_ok=True)
            image_result = ensure_images(workspace_root, note_path, key)
            images.append({"zotero_key": key, "title": data.get("title", key), **image_result})
            note_path.write_text(render_note(workspace_root, note_path, key, data, run_date, decision, image_result), encoding="utf-8")
            bucket = updated if existed else created
            bucket.append({"zotero_key": key, "title": data.get("title", key), "domain": domain, "topic": topic, "path": str(note_path)})
        elif not (note_path.parent / note_path.stem / "images" / "index.md").exists():
            image_result = ensure_images(workspace_root, note_path, key)
            images.append({"zotero_key": key, "title": data.get("title", key), **image_result})
        extra = parse_extra(data)
        if extra.get("source") == "collections" and not str(data.get("abstractNote") or "").strip():
            incomplete.append({"zotero_key": key, "title": data.get("title", key), "reason": "collection metadata still lacks abstract"})
        if extra.get("source") == "collections":
            zh_path = workspace_root / "zotero" / "library" / "items" / f"{key}.zh.pdf"
            if not zh_path.exists() or zh_path.stat().st_size <= 0:
                incomplete.append({"zotero_key": key, "title": data.get("title", key), "reason": "collection translated PDF missing"})
        all_entries.append({"zotero_key": key, "title": data.get("title", key), "domain": domain, "topic": topic, "path": str(note_path)})
    write_research_index(workspace_root, all_entries)
    general_created = [entry for entry in [*created, *updated] if "\\General\\" in entry["path"] or "/General/" in entry["path"]]
    return {"created": created, "updated": updated, "pending": [], "general_created": general_created, "incomplete": incomplete, "images": images}


def main() -> int:
    parser = argparse.ArgumentParser(description="Update vault/20_Research from Zotero mirror")
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--date", default="")
    parser.add_argument("--agent-decisions", default="")
    args = parser.parse_args()
    decisions = json.loads(Path(args.agent_decisions).read_text(encoding="utf-8")) if args.agent_decisions else None
    result = update_research_notes(Path(args.workspace), args.date or None, agent_decisions=decisions)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
