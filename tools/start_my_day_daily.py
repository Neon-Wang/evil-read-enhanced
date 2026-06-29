#!/usr/bin/env python3
"""Generate the Start My Day daily note from Zotero and discovery results."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import zotero_sync

from start_my_day_insights import (
    DailyInsightClient,
    apply_insight_override,
    compact_text,
    load_agent_insight,
    insight_payload,
    paper_insight,
    render_overview,
    render_reading_suggestions,
    request_agent_insight,
)


def sync_zotero_mirror(
    workspace_root: Path | None,
    zotero_api: str = "http://127.0.0.1:23119/api/users/0",
    zotero_storage: Path | None = None,
    translated_dir: Path | None = None,
    bib_export: Path | None = None,
) -> dict[str, object] | None:
    if workspace_root is None:
        return None
    zotero_storage = zotero_storage or Path.home() / "Zotero" / "storage"
    translated_dir = translated_dir or Path.home() / "AppData" / "Roaming" / "CodexZoteroPDF2zh" / "server" / "translated"
    bib_export = bib_export or Path.home() / "Zotero" / "exports" / "library.bib"
    item_keys = zotero_sync.fetch_library_item_keys(zotero_api)
    return zotero_sync.sync_items(
        item_keys=item_keys,
        zotero_storage=zotero_storage,
        translated_dir=translated_dir,
        bib_export=bib_export,
        zotero_repo=workspace_root / "zotero",
        zotero_api=zotero_api,
    )


def load_results(path: Path) -> list[dict[str, Any]]:
    if not path or not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"expected a list of ingest results in {path}")
    return [item for item in payload if isinstance(item, dict)]


def mirror_wikilink(vault_root: Path, result: dict[str, Any]) -> str:
    title = str(result.get("title") or result.get("zotero_key") or "Untitled")
    mirror_value = str(result.get("mirror_path") or "").strip()
    if not mirror_value:
        return title
    mirror_path = Path(mirror_value)
    if mirror_path.is_absolute():
        try:
            mirror_path = mirror_path.relative_to(vault_root)
        except ValueError:
            mirror_path = Path("30_Inbox") / "Zotero" / mirror_path.name
    return f"[[{mirror_path.with_suffix('').as_posix()}|{title}]]"


def relative_link(from_dir: Path, target: Path) -> str:
    return Path(os.path.relpath(target, from_dir)).as_posix()


def research_note_for_key(vault_root: Path, zotero_key: str) -> Path | None:
    if not zotero_key:
        return None
    research_root = vault_root / "20_Research" / "Papers"
    if not research_root.exists():
        return None
    pattern = re.compile(r"zotero_key:\s*[\"']?([^\"'\n]+)", flags=re.IGNORECASE)
    aliases_pattern = re.compile(r"zotero_keys:\s*\[([^\]\n]+)\]", flags=re.IGNORECASE)
    wanted = zotero_key.strip().lower()
    for path in sorted(research_root.glob("**/*.md")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in pattern.finditer(text):
            if match.group(1).strip().lower() == wanted:
                return path
        for match in aliases_pattern.finditer(text):
            aliases = [alias.strip().strip("\"'").lower() for alias in match.group(1).split(",")]
            if wanted in aliases:
                return path
    return None


def section_text(markdown: str, names: tuple[str, ...]) -> str:
    headings = "|".join(re.escape(name) for name in names)
    pattern = re.compile(rf"(?ims)^##\s+(?:{headings})\s*\n(.+?)(?=\n##\s+|\Z)")
    match = pattern.search(markdown)
    return re.sub(r"\s+", " ", match.group(1)).strip() if match else ""


def section_bullets(markdown: str, names: tuple[str, ...], limit: int = 4) -> list[str]:
    text = section_text(markdown, names)
    if not text:
        return []
    bullets = re.findall(r"(?:^|\s)[-*]\s+(.+?)(?=(?:\s[-*]\s+)|\Z)", text)
    if not bullets:
        bullets = re.split(r"(?<=[。.!?])\s+", text)
    return [re.sub(r"\s+", " ", item).strip() for item in bullets if item.strip()][:limit]


def research_digest(vault_root: Path, zotero_key: str) -> dict[str, Any]:
    note_path = research_note_for_key(vault_root, zotero_key)
    if not note_path or not note_path.exists():
        return {}
    text = note_path.read_text(encoding="utf-8", errors="ignore")
    summary = (
        section_text(text, ("日报摘要", "Daily Digest", "精读结论", "Executive Summary"))
        or section_text(text, ("研究问题", "Research Question"))
    )
    why = (
        section_text(text, ("为什么值得读", "Why Read", "对我研究的启发", "Implications"))
        or section_text(text, ("核心贡献", "Contributions"))
    )
    observations = section_bullets(text, ("核心贡献", "Contributions", "关键证据", "Evidence", "实验与证据"), limit=4)
    next_action = section_text(text, ("下一步动作", "Next Action", "阅读检查点", "Reading Checkpoints"))
    digest = {
        "summary": compact_text(summary)[:500],
        "why": compact_text(why)[:500],
        "observations": observations,
        "next_action": compact_text(next_action)[:320],
        "note_path": str(note_path),
    }
    return {key: value for key, value in digest.items() if value}


def result_links(
    result: dict[str, Any],
    note_dir: Path | None = None,
    workspace_root: Path | None = None,
    vault_root: Path | None = None,
) -> list[str]:
    key = str(result.get("zotero_key") or "")
    links: list[str] = []
    if note_dir and workspace_root and key:
        item_dir = workspace_root / "zotero" / "library" / "items"
        for label, suffix in (("PDF", ".pdf"), ("ZH", ".zh.pdf"), ("JSON", ".json")):
            target = item_dir / f"{key}{suffix}"
            if target.exists():
                links.append(f"[{label}]({relative_link(note_dir, target)})")
    if note_dir and vault_root and key:
        research_note = research_note_for_key(vault_root, key)
        if research_note:
            links.append(f"[Research]({relative_link(note_dir, research_note)})")
    if result.get("pdf_url"):
        links.append(f"[Source PDF]({result['pdf_url']})")
    return links


def result_line(
    vault_root: Path,
    result: dict[str, Any],
    note_dir: Path | None = None,
    workspace_root: Path | None = None,
) -> str:
    key = str(result.get("zotero_key") or "")
    status = str(result.get("status") or "")
    collection = str(result.get("collection") or "")
    score = ""
    scores = result.get("scores")
    if isinstance(scores, dict) and scores.get("recommendation") is not None:
        score = f"score={scores['recommendation']}"
    domain = str(result.get("matched_domain") or "")
    details = " | ".join(part for part in [key, status, collection, domain, score] if part)
    links = result_links(result, note_dir=note_dir, workspace_root=workspace_root, vault_root=vault_root)
    return f"- {mirror_wikilink(vault_root, result)}" + (f" - {details}" if details else "") + (f" - {' '.join(links)}" if links else "")


def result_block(
    vault_root: Path,
    result: dict[str, Any],
    mode: str,
    note_dir: Path | None = None,
    workspace_root: Path | None = None,
    llm_papers: dict[str, Any] | None = None,
    require_research_digest: bool = False,
) -> str:
    links = result_links(result, note_dir=note_dir, workspace_root=workspace_root, vault_root=vault_root)
    paper_key = compact_text(result.get("zotero_key") or result.get("title"))
    title_key = compact_text(result.get("title"))
    insight = research_digest(vault_root, str(result.get("zotero_key") or ""))
    if not insight and llm_papers:
        insight = apply_insight_override({}, llm_papers.get(paper_key) or llm_papers.get(title_key))
    if require_research_digest and not all(insight.get(key) for key in ("summary", "why", "observations")):
        raise RuntimeError(f"missing agent-read Research digest for {title_key or paper_key}")
    if not insight:
        insight = paper_insight(vault_root, result, mode=mode, has_pdf=any(link.startswith("[PDF]") for link in links))
    title = compact_text(result.get("title") or result.get("zotero_key") or "Untitled")
    details = result_line(vault_root, result, note_dir=note_dir, workspace_root=workspace_root).removeprefix("- ").strip()
    lines = [
        f"### {title}",
        f"- **入口**：{details}",
        f"**一句话总结**：{insight.get('summary', '')}",
        "",
        f"**为什么值得读**：{insight.get('why', '')}",
        "",
        "**核心贡献/观察**",
    ]
    lines.extend(f"- {observation}" for observation in insight.get("observations", []))
    if insight.get("next_action"):
        lines.extend(["", f"**下一步动作**：{insight['next_action']}"])
    return "\n".join(lines)


def load_zotero_item_summary(workspace_root: Path | None, zotero_key: str) -> dict[str, Any]:
    if not workspace_root or not zotero_key:
        return {}
    metadata_path = workspace_root / "zotero" / "library" / "items" / f"{zotero_key}.json"
    if not metadata_path.exists():
        return {}
    try:
        payload = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    if not isinstance(data, dict):
        return {}
    return {
        "title": data.get("title", ""),
        "abstract": data.get("abstractNote") or data.get("abstract") or "",
        "source": "collections",
    }


def collection_imports_as_recommendations(
    collections_result: dict[str, Any] | None,
    workspace_root: Path | None,
    vault_root: Path,
    note_date: str,
) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    for item in (collections_result or {}).get("imported", []):
        if not isinstance(item, dict):
            continue
        zotero_key = str(item.get("zotero_key") or item.get("parentKey") or "").strip()
        metadata = load_zotero_item_summary(workspace_root, zotero_key)
        title = str(metadata.get("title") or item.get("title") or item.get("name") or zotero_key or "Imported PDF")
        mirror_path = vault_root / "30_Inbox" / "Zotero" / note_date[:4] / f"{zotero_key}.md" if zotero_key else Path("")
        recommendation = {
            **item,
            **metadata,
            "title": title,
            "zotero_key": zotero_key,
            "status": item.get("status") or "imported",
            "collection": item.get("collection") or f"Collections/{note_date}",
        }
        if mirror_path.exists():
            recommendation["mirror_path"] = str(mirror_path)
        recommendations.append(recommendation)
    return recommendations


def collection_research_updates_as_recommendations(
    research_result: dict[str, Any] | None,
    workspace_root: Path | None,
    vault_root: Path,
    note_date: str,
) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    for item in [*(research_result or {}).get("created", []), *(research_result or {}).get("updated", [])]:
        if not isinstance(item, dict):
            continue
        zotero_key = str(item.get("zotero_key") or "").strip()
        if not zotero_key.startswith("COLL"):
            continue
        metadata = load_zotero_item_summary(workspace_root, zotero_key)
        title = str(metadata.get("title") or item.get("title") or zotero_key)
        mirror_path = vault_root / "30_Inbox" / "Zotero" / note_date[:4] / f"{zotero_key}.md"
        recommendation = {
            **item,
            **metadata,
            "title": title,
            "zotero_key": zotero_key,
            "status": item.get("status") or "research-updated",
            "collection": item.get("collection") or f"Collections/{note_date}",
        }
        if mirror_path.exists():
            recommendation["mirror_path"] = str(mirror_path)
        recommendations.append(recommendation)
    return recommendations


def prepend_unique_by_key(primary: list[dict[str, Any]], secondary: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for item in [*primary, *secondary]:
        key = str(item.get("zotero_key") or item.get("title") or "").lower()
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        merged.append(item)
    return merged


def zotero_key_from_missing(entry: object) -> str:
    if isinstance(entry, str) and ":" in entry:
        return entry.split(":", 1)[0].strip()
    if isinstance(entry, dict):
        return str(entry.get("zotero_key") or entry.get("key") or "").strip()
    return ""


def zotero_key_from_artifact_path(path_value: object) -> str:
    if not path_value:
        return ""
    return Path(str(path_value)).name.split(".", 1)[0].strip()


def relevant_zotero_keys(*groups: list[dict[str, Any]]) -> set[str]:
    keys: set[str] = set()
    for group in groups:
        for item in group:
            key = str(item.get("zotero_key") or "").strip()
            if key:
                keys.add(key)
    return keys


def daily_zotero_sync_result(
    zotero_sync_result: dict[str, Any] | None,
    relevant_keys: set[str],
    workspace_root: Path | None = None,
) -> dict[str, Any]:
    zotero_sync_result = zotero_sync_result or {}
    copied = list(zotero_sync_result.get("copied", []))
    missing = list(zotero_sync_result.get("missing", []))
    if not relevant_keys:
        return {
            **zotero_sync_result,
            "copied": [],
            "missing": [],
            "global_copied_count": len(copied),
            "global_missing_count": len(missing),
        }
    if workspace_root:
        item_dir = workspace_root / "zotero" / "library" / "items"
        current_copied: list[str] = []
        current_missing: list[str] = []
        for key in sorted(relevant_keys):
            for suffix, label in ((".pdf", "raw pdf"), (".zh.pdf", "translated pdf"), (".json", "metadata")):
                path = item_dir / f"{key}{suffix}"
                if path.exists() and path.stat().st_size > 0:
                    current_copied.append(str(path))
                elif label != "metadata":
                    current_missing.append(f"{key}: {label}")
        return {
            **zotero_sync_result,
            "copied": current_copied,
            "missing": current_missing,
            "global_copied_count": len(copied),
            "global_missing_count": len(missing),
        }
    return {
        **zotero_sync_result,
        "copied": [path for path in copied if zotero_key_from_artifact_path(path) in relevant_keys],
        "missing": [entry for entry in missing if zotero_key_from_missing(entry) in relevant_keys],
        "global_copied_count": len(copied),
        "global_missing_count": len(missing),
    }


def bullet_lines(items: list[Any], empty: str = "- 无") -> str:
    if not items:
        return empty
    lines: list[str] = []
    for item in items:
        if isinstance(item, dict):
            label = item.get("title") or item.get("name") or item.get("zotero_key") or item.get("question") or item.get("request") or item.get("path") or "item"
            detail = item.get("answer") or item.get("error") or item.get("feedback") or item.get("reason") or item.get("status") or ""
            lines.append(f"- {label}" + (f" - {detail}" if detail else ""))
        else:
            lines.append(f"- {item}")
    return "\n".join(lines)


def render_closed_loop_overview(
    confirmed: list[dict[str, Any]],
    exploration: list[dict[str, Any]],
    collections_result: dict[str, Any] | None,
    zotero_sync_result: dict[str, Any] | None,
    research_result: dict[str, Any] | None,
    email_result: dict[str, Any] | None,
) -> str:
    collections_result = collections_result or {}
    zotero_sync_result = zotero_sync_result or {}
    research_result = research_result or {}
    email_result = email_result or {"status": "pending"}
    pdf_count = sum(1 for item in [*confirmed, *exploration] if str(item.get("status")) == "ok")
    return "\n".join(
        [
            f"- 今日真实搜索入选：Confirmed {len(confirmed)} 篇，Exploration {len(exploration)} 篇",
            f"- 已下载并镜像 PDF：{pdf_count} 篇",
            f"- Collections imported: {len(collections_result.get('imported', []))}",
            f"- Collections unresolved: {len(collections_result.get('skipped', [])) + len(collections_result.get('failed', [])) + len(collections_result.get('pending', []))}",
            f"- Zotero artifacts copied: {len(zotero_sync_result.get('copied', []))}",
            f"- Zotero missing artifacts: {len(zotero_sync_result.get('missing', []))}",
            f"- Research notes created: {len(research_result.get('created', []))}",
            f"- Research notes updated: {len(research_result.get('updated', []))}",
            f"- Email status: {email_result.get('status', 'pending')}",
            "- Zotero index: [zotero/INDEX.md](../../zotero/INDEX.md)",
        ]
    )


def render_comment_feedback(comment_tasks_result: dict[str, Any] | None) -> str:
    comment_tasks_result = comment_tasks_result or {}
    return "\n".join(
        [
            "### Questions",
            bullet_lines(comment_tasks_result.get("answers", [])),
            "",
            "### Requests",
            bullet_lines(comment_tasks_result.get("request_feedback", [])),
            "",
            "### TODO",
            bullet_lines(comment_tasks_result.get("todos", [])),
        ]
    )


def render_collections_result(collections_result: dict[str, Any] | None) -> str:
    collections_result = collections_result or {}
    return "\n".join(
        [
            f"- Scanned: {collections_result.get('scanned', 0)}",
            f"- Imported: {len(collections_result.get('imported', []))}",
            f"- Failed: {len(collections_result.get('failed', []))}",
            f"- Pending/skipped: {len(collections_result.get('skipped', []))}",
            "",
            "### Imported",
            bullet_lines(collections_result.get("imported", [])),
            "",
            "### Failed",
            bullet_lines(collections_result.get("failed", [])),
            "",
            "### Pending",
            bullet_lines(collections_result.get("skipped", [])),
        ]
    )


def render_zotero_status(zotero_sync_result: dict[str, Any] | None) -> str:
    zotero_sync_result = zotero_sync_result or {}
    global_missing_count = zotero_sync_result.get("global_missing_count")
    global_backlog = (
        f"- Global mirror backlog: {global_missing_count} missing artifacts (see index)"
        if isinstance(global_missing_count, int) and global_missing_count != len(zotero_sync_result.get("missing", []))
        else ""
    )
    return "\n".join(
        [line for line in [
            "- Index: [zotero/INDEX.md](../../zotero/INDEX.md)",
            f"- Copied artifacts: {len(zotero_sync_result.get('copied', []))}",
            f"- Missing artifacts: {len(zotero_sync_result.get('missing', []))}",
            global_backlog,
            "",
            "### Missing",
            bullet_lines(zotero_sync_result.get("missing", [])),
        ] if line != ""]
    )


def render_research_updates(research_result: dict[str, Any] | None) -> str:
    research_result = research_result or {}
    return "\n".join(
        [
            "### Created",
            bullet_lines(research_result.get("created", [])),
            "",
            "### Updated",
            bullet_lines(research_result.get("updated", [])),
            "",
            "### Pending",
            bullet_lines(research_result.get("pending", [])),
        ]
    )


def render_email_status(email_result: dict[str, Any] | None) -> str:
    email_result = email_result or {"status": "pending", "to": "487844383@qq.com"}
    return "\n".join([f"- To: {email_result.get('to', '487844383@qq.com')}", f"- Status: {email_result.get('status', 'pending')}"])


def render_humanized_daily_preface(
    confirmed: list[dict[str, Any]],
    exploration: list[dict[str, Any]],
    collections_result: dict[str, Any] | None,
    research_result: dict[str, Any] | None,
) -> str:
    first_title = str(confirmed[0].get("title") or confirmed[0].get("zotero_key") or "") if confirmed else ""
    imported_count = len((collections_result or {}).get("imported", []))
    research_count = len((research_result or {}).get("created", [])) + len((research_result or {}).get("updated", []))
    lines = ["今天的日报只保留能追溯的内容：搜索来源、推荐理由、PDF/JSON/Research 链接都放在同一处，不能再用空列表冒充推荐。"]
    if first_title:
        lines.append(f"第一篇先读《{first_title}》。它是今天分数最高的候选，适合用来判断这批论文是否真的贴近当前研究兴趣。")
    if imported_count:
        lines.append(f"collections 里新导入的 {imported_count} 篇也合并到推荐区；手动收进来的论文不应该只躺在导入日志里。")
    if exploration:
        lines.append(f"Exploration 里还有 {len(exploration)} 篇备选，不建议今天全部精读，先扫摘要和实验设置。")
    if research_count:
        lines.append(f"20_Research 今天新增/刷新 {research_count} 条正式笔记，日报只做导航和阅读顺序。")
    return "\n\n".join(lines)


def render_translated_pdf_package(pdf_package_result: dict[str, Any] | None) -> str:
    result = pdf_package_result or {}
    status = str(result.get("status") or "not_run")
    run_id = str(result.get("run_id") or "")
    file_count = int(result.get("file_count") or 0)
    if status == "packaged":
        download_url = str(result.get("download_url") or "")
        zip_sha = str(result.get("zip_sha256") or "")
        lines = [
            "- Status: packaged",
            f"- Run: {run_id}",
            f"- Files: {file_count}",
            f"- Download: [下载本次中文 PDF 增量包]({download_url})",
        ]
        if zip_sha:
            lines.append(f"- ZIP sha256: `{zip_sha}`")
        return "\n".join(lines)
    if status == "no_new_files":
        return "\n".join(
            [
                "- Status: no_new_files",
                f"- Run: {run_id}",
                "- 本轮 Zotero mirror/翻译同步后没有发现新增或内容变化的中文 PDF，因此未生成空 zip。",
            ]
        )
    return "- Status: not_run"


def render_daily_note(
    vault_root: Path,
    note_date: str,
    confirmed: list[dict[str, Any]],
    exploration: list[dict[str, Any]],
    workspace_root: Path | None = None,
    llm_client: DailyInsightClient | None = None,
    agent_insight: dict[str, Any] | None = None,
    require_agent_insight: bool = False,
    collections_result: dict[str, Any] | None = None,
    zotero_sync_result: dict[str, Any] | None = None,
    research_result: dict[str, Any] | None = None,
    comment_tasks_result: dict[str, Any] | None = None,
    email_result: dict[str, Any] | None = None,
    pdf_package_result: dict[str, Any] | None = None,
    humanize: bool = False,
    pending_items: list[str] | None = None,
) -> str:
    note_dir = vault_root / "10_Daily"
    imported_recommendations = collection_imports_as_recommendations(collections_result, workspace_root, vault_root, note_date)
    collection_research_recommendations = collection_research_updates_as_recommendations(research_result, workspace_root, vault_root, note_date)
    effective_confirmed = prepend_unique_by_key(confirmed, [*imported_recommendations, *collection_research_recommendations])
    daily_zotero_result = daily_zotero_sync_result(
        zotero_sync_result,
        relevant_zotero_keys(effective_confirmed, exploration),
        workspace_root=workspace_root,
    )
    llm_insight = request_agent_insight(
        agent_insight,
        llm_client,
        insight_payload(vault_root, note_date, effective_confirmed, exploration),
        required=require_agent_insight,
    )
    llm_papers = llm_insight.get("papers", {}) if isinstance(llm_insight.get("papers"), dict) else {}
    confirmed_lines = "\n".join(
        result_block(
            vault_root,
            item,
            mode="confirmed",
            note_dir=note_dir,
            workspace_root=workspace_root,
            llm_papers=llm_papers,
            require_research_digest=require_agent_insight,
        )
        for item in effective_confirmed
    ) or "- 无 confirmed 论文；这应视为黄灯。"
    exploration_lines = "\n".join(
        result_block(
            vault_root,
            item,
            mode="exploration",
            note_dir=note_dir,
            workspace_root=workspace_root,
            llm_papers=llm_papers,
            require_research_digest=require_agent_insight,
        )
        for item in exploration
    ) or "- 无 exploration 论文。"
    lines = [
        "---",
        f'date: "{note_date}"',
        'tags: ["daily", "start-my-day", "evilread-report"]',
        'email_to: "487844383@qq.com"',
        f'email_status: "{(email_result or {}).get("status", "pending")}"',
        "---",
        "",
        f"# {note_date} 论文日报",
        "",
    ]
    if humanize:
        lines.extend(["## 今天怎么读", render_humanized_daily_preface(effective_confirmed, exploration, collections_result, research_result), ""])
    lines.extend(
        [
            "## 闭环概览",
            render_closed_loop_overview(effective_confirmed, exploration, collections_result, daily_zotero_result, research_result, email_result),
            "",
            "## 今日概览",
            render_overview(vault_root, effective_confirmed, exploration, llm_insight.get("overview", "")),
            "",
            "## 今日阅读建议",
            render_reading_suggestions(llm_insight.get("reading_suggestions")),
            "",
            "## 精读候选 Confirmed",
            confirmed_lines,
            "",
            "## 探索候选 Exploration",
            exploration_lines,
            "",
            "## 20_Research 更新",
            render_research_updates(research_result),
            "",
            "## Collections 导入",
            render_collections_result(collections_result),
            "",
            "## 中文 PDF 增量包",
            render_translated_pdf_package(pdf_package_result),
            "",
            "## Zotero Mirror 状态",
            render_zotero_status(daily_zotero_result),
            "",
            "## 昨日 Comments 反馈",
            render_comment_feedback(comment_tasks_result),
            "",
            "## Email 状态",
            render_email_status(email_result),
            "",
            "## 我的想法（Start My Day Comments）",
            "- +interest:",
            "- -avoid:",
            "- !deepen:",
            "- ?question:",
            *[f"- pending: {item}" for item in (pending_items or [])],
            "",
        ]
    )
    return "\n".join(lines)


def write_daily_note(
    vault_root: Path,
    note_date: str,
    confirmed: list[dict[str, Any]],
    exploration: list[dict[str, Any]],
    workspace_root: Path | None = None,
    llm_client: DailyInsightClient | None = None,
    agent_insight: dict[str, Any] | None = None,
    require_agent_insight: bool = False,
    collections_result: dict[str, Any] | None = None,
    zotero_sync_result: dict[str, Any] | None = None,
    research_result: dict[str, Any] | None = None,
    comment_tasks_result: dict[str, Any] | None = None,
    email_result: dict[str, Any] | None = None,
    pdf_package_result: dict[str, Any] | None = None,
    humanize: bool = False,
    pending_items: list[str] | None = None,
) -> Path:
    note_path = vault_root / "10_Daily" / f"{note_date}论文日报.md"
    note_path.parent.mkdir(parents=True, exist_ok=True)
    note_path.write_text(
        render_daily_note(
            vault_root,
            note_date,
            confirmed,
            exploration,
            workspace_root=workspace_root,
            llm_client=llm_client,
            agent_insight=agent_insight,
            require_agent_insight=require_agent_insight,
            collections_result=collections_result,
            zotero_sync_result=zotero_sync_result,
            research_result=research_result,
            comment_tasks_result=comment_tasks_result,
            email_result=email_result,
            pdf_package_result=pdf_package_result,
            humanize=humanize,
            pending_items=pending_items,
        ),
        encoding="utf-8",
    )
    return note_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the Zotero loop daily note")
    parser.add_argument("--vault", required=True)
    parser.add_argument("--workspace", default="", help="Monorepo root containing vault/ and zotero/")
    parser.add_argument("--date", required=True)
    parser.add_argument("--confirmed-results", default="")
    parser.add_argument("--exploration-results", default="")
    parser.add_argument("--skip-zotero-sync", action="store_true", help="Do not mirror Zotero before generating the note")
    parser.add_argument("--zotero-api", default="http://127.0.0.1:23119/api/users/0")
    parser.add_argument("--collections-result", default="")
    parser.add_argument("--zotero-sync-result", default="")
    parser.add_argument("--research-result", default="")
    parser.add_argument("--comment-tasks-result", default="")
    parser.add_argument("--email-result", default="")
    parser.add_argument("--agent-insight", default="", help="JSON decisions generated by the calling agent")
    parser.add_argument("--require-agent-insight", action="store_true", help="Fail if no agent insight JSON is supplied")
    parser.add_argument("--humanize", action="store_true")
    parser.add_argument("--pending", action="append", default=[])
    args = parser.parse_args()

    workspace_root = Path(args.workspace) if args.workspace else None
    zotero_sync_result = None
    if workspace_root and not args.skip_zotero_sync:
        try:
            zotero_sync_result = sync_zotero_mirror(workspace_root, zotero_api=args.zotero_api)
        except OSError as exc:
            raise SystemExit(
                "Zotero local API is unavailable. Start Zotero and rerun Start My Day, "
                f"or pass --skip-zotero-sync to generate the note without refreshing PDFs. Original error: {exc}"
            )
    note_path = write_daily_note(
        vault_root=Path(args.vault),
        note_date=args.date,
        confirmed=load_results(Path(args.confirmed_results)) if args.confirmed_results else [],
        exploration=load_results(Path(args.exploration_results)) if args.exploration_results else [],
        workspace_root=workspace_root,
        agent_insight=load_agent_insight(Path(args.agent_insight)) if args.agent_insight else None,
        require_agent_insight=args.require_agent_insight,
        collections_result=json.loads(Path(args.collections_result).read_text(encoding="utf-8")) if args.collections_result else None,
        zotero_sync_result=json.loads(Path(args.zotero_sync_result).read_text(encoding="utf-8")) if args.zotero_sync_result else zotero_sync_result,
        research_result=json.loads(Path(args.research_result).read_text(encoding="utf-8")) if args.research_result else None,
        comment_tasks_result=json.loads(Path(args.comment_tasks_result).read_text(encoding="utf-8")) if args.comment_tasks_result else None,
        email_result=json.loads(Path(args.email_result).read_text(encoding="utf-8")) if args.email_result else None,
        humanize=args.humanize,
        pending_items=args.pending,
    )
    print(json.dumps({"note": str(note_path), "zotero_sync": zotero_sync_result}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
