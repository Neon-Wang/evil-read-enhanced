#!/usr/bin/env python3
"""Agent-supplied insight helpers for Start My Day.

This module deliberately does not call an LLM API. Start My Day is a Codex
skill: the calling agent owns interpretation, classification, and prose. The
Python layer only renders verified agent decisions and provides conservative
fallback snippets for offline tests.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Protocol


class DailyInsightClient(Protocol):
    def complete_daily_insight(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Return structured insight overrides supplied by the calling agent."""


def compact_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def first_sentence(text: str, fallback: str = "--") -> str:
    text = compact_text(text)
    if not text:
        return fallback
    match = re.search(r"(.+?[.!?。！？])(?:\s|$)", text)
    sentence = match.group(1) if match else text
    return sentence[:260].rstrip()


def extract_mirror_abstract(vault_root: Path, result: dict[str, Any]) -> str:
    mirror_value = str(result.get("mirror_path") or "").strip()
    if not mirror_value:
        return ""
    mirror_path = Path(mirror_value)
    if not mirror_path.is_absolute():
        mirror_path = vault_root / mirror_path
    if not mirror_path.exists() or not mirror_path.is_file():
        return ""
    text = mirror_path.read_text(encoding="utf-8", errors="ignore")
    match = re.search(r"(?ims)^##\s+Abstract\s*\n(.+?)(?:\n##\s+|\Z)", text)
    return compact_text(match.group(1)) if match else ""


def paper_abstract(vault_root: Path, result: dict[str, Any]) -> str:
    return compact_text(
        result.get("abstract")
        or result.get("summary")
        or result.get("snippet")
        or extract_mirror_abstract(vault_root, result)
    )


def keyword_candidates(text: str, limit: int = 6) -> list[str]:
    stopwords = {
        "about",
        "across",
        "after",
        "algorithm",
        "approach",
        "based",
        "between",
        "data",
        "demonstrate",
        "during",
        "from",
        "into",
        "learning",
        "method",
        "model",
        "models",
        "network",
        "networks",
        "paper",
        "propose",
        "proposes",
        "result",
        "results",
        "show",
        "shows",
        "study",
        "system",
        "that",
        "their",
        "this",
        "through",
        "training",
        "using",
        "with",
    }
    words = re.findall(r"[A-Za-z][A-Za-z0-9-]{3,}", text)
    counts: dict[str, int] = {}
    display: dict[str, str] = {}
    for word in words:
        key = word.lower().strip("-")
        if key in stopwords or len(key) < 4:
            continue
        counts[key] = counts.get(key, 0) + 1
        display.setdefault(key, word)
    ranked = sorted(counts, key=lambda key: (-counts[key], key))
    return [display[key] for key in ranked[:limit]]


def paper_insight(vault_root: Path, result: dict[str, Any], mode: str, has_pdf: bool) -> dict[str, Any]:
    title = compact_text(result.get("title") or result.get("zotero_key") or "Untitled")
    abstract = paper_abstract(vault_root, result)
    combined = compact_text(f"{title}. {abstract}")
    keywords = keyword_candidates(combined)
    source = compact_text(result.get("source") or result.get("venue") or result.get("collection") or "unknown")
    status = compact_text(result.get("status") or "")
    summary = first_sentence(abstract, fallback=f"{title} 已完成本地 PDF 导入；优先打开 Research 链接核对问题定义、方法和实验。")
    if abstract:
        why = f"摘要信号集中在 {', '.join(keywords[:3]) or title}，来源可追溯到 {source}。"
    else:
        why = "这条记录来自可追溯的本地 PDF/Zotero mirror；Start My Day 会在 Research 笔记中继续承接元数据和图片抽取结果。"
    if mode == "confirmed":
        next_action = "优先精读：先核对问题定义、方法假设和实验设置，再把关键疑问写回评论区。"
    elif has_pdf:
        next_action = "快速扫 PDF：如果方法或实验贴近当前兴趣，再转入 Confirmed。"
    else:
        next_action = "打开本地 PDF 与 Research 笔记，核对标题页、摘要、方法图和实验表，再决定是否继续精读。"
    observations = [
        f"主题信号：{', '.join(keywords[:4]) if keywords else title}",
        f"来源/状态：{source}；{status or 'status unknown'}",
        "可读性：已有本地 PDF。" if has_pdf else "可读性：当前未发现本地 PDF。",
    ]
    return {
        "summary": summary,
        "why": why,
        "observations": observations,
        "next_action": next_action,
        "keywords": keywords,
    }


def apply_insight_override(base: dict[str, Any], override: Any) -> dict[str, Any]:
    if not isinstance(override, dict):
        return base
    merged = dict(base)
    for key in ("summary", "why", "next_action"):
        value = compact_text(override.get(key))
        if value:
            merged[key] = value
    observations = override.get("observations")
    if isinstance(observations, list):
        cleaned = [compact_text(item) for item in observations if compact_text(item)]
        if cleaned:
            merged["observations"] = cleaned[:4]
    elif compact_text(observations):
        merged["observations"] = [compact_text(observations)]
    return merged


def insight_payload(
    vault_root: Path,
    note_date: str,
    confirmed: list[dict[str, Any]],
    exploration: list[dict[str, Any]],
) -> dict[str, Any]:
    def serialize(item: dict[str, Any], mode: str) -> dict[str, Any]:
        return {
            "key": compact_text(item.get("zotero_key") or item.get("title")),
            "mode": mode,
            "title": compact_text(item.get("title")),
            "abstract": paper_abstract(vault_root, item)[:2200],
            "source": compact_text(item.get("source") or item.get("venue")),
            "status": compact_text(item.get("status")),
            "collection": compact_text(item.get("collection")),
            "domain": compact_text(item.get("matched_domain") or item.get("domain")),
            "topic": compact_text(item.get("matched_topic") or item.get("topic")),
            "tags": item.get("tags", []),
        }

    return {
        "model_task": "start-my-day-agent-insight",
        "date": note_date,
        "confirmed": [serialize(item, "confirmed") for item in confirmed],
        "exploration": [serialize(item, "exploration") for item in exploration],
    }


def load_agent_insight(path: Path | None) -> dict[str, Any]:
    if not path:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def request_agent_insight(
    insight: dict[str, Any] | None,
    client: DailyInsightClient | None,
    payload: dict[str, Any],
    required: bool = False,
) -> dict[str, Any]:
    if insight:
        return insight
    if client:
        result = client.complete_daily_insight(payload)
        if not isinstance(result, dict):
            raise ValueError("agent insight client must return a JSON object")
        return result
    if required:
        raise RuntimeError("agent insight JSON is required; scripts do not call an LLM API")
    return {}


def collect_topics(vault_root: Path, papers: list[dict[str, Any]]) -> list[str]:
    combined = " ".join(f"{compact_text(item.get('title'))} {paper_abstract(vault_root, item)}" for item in papers)
    return keyword_candidates(combined, limit=6)


def render_overview(
    vault_root: Path,
    confirmed: list[dict[str, Any]],
    exploration: list[dict[str, Any]],
    agent_overview: Any = "",
) -> str:
    if compact_text(agent_overview):
        return compact_text(agent_overview)
    papers = confirmed + exploration
    topics = collect_topics(vault_root, papers)
    topic_text = "、".join(f"**{topic}**" for topic in topics[:3]) if topics else "**待补充主题**"
    confirmed_ready = sum(1 for item in confirmed if "needs-pdf" not in item.get("tags", []))
    exploration_needs_pdf = sum(
        1 for item in exploration if item.get("status") == "needs-pdf" or "needs-pdf" in item.get("tags", [])
    )
    return "\n".join(
        [
            f"今天写入 Confirmed {len(confirmed)} 篇，Exploration {len(exploration)} 篇，主要信号集中在 {topic_text}。",
            "",
            "- **总体趋势**：Confirmed 用作今天精读入口，Exploration 用来扩展相邻方向并识别噪声候选。",
            f"- **质量/可读性分布**：Confirmed 中 {confirmed_ready}/{len(confirmed) or 1} 篇具备可读条件；Exploration 中 {exploration_needs_pdf} 篇仍需补 PDF 或摘要。",
            f"- **研究热点**：{', '.join(topics) if topics else '暂无足够摘要信号'}。",
            "- **反馈重点**：读完后优先写 `!deepen:` 和 `?question:`，让下一轮 Discover 更贴近真实兴趣。",
        ]
    )


def render_reading_suggestions(agent_suggestions: Any = None) -> str:
    if isinstance(agent_suggestions, list):
        cleaned = [compact_text(item) for item in agent_suggestions if compact_text(item)]
        if cleaned:
            return "\n".join(f"{index}. {item}" for index, item in enumerate(cleaned, start=1))
    return "\n".join(
        [
            "1. 先读 Confirmed 中已有 PDF/译文的论文，快速判断是否值得进入深度笔记。",
            "2. 对方法或实验不清楚的部分，直接写入 `?question:`，供下一轮反射更新偏好。",
            "3. 再扫 Exploration：只把贡献清晰、PDF 可获得、与当前兴趣强相关的候选转入 Confirmed。",
            "4. 对明显离题或无法获得全文的候选，用 `-avoid:` 记录排除线索。",
        ]
    )
