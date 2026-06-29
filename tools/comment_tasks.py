#!/usr/bin/env python3
"""Handle Start My Day comment questions and free-form requests.

Scripts do not answer research questions by template. The calling agent should
use browser/search skills, then pass concrete answers into this module.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Callable

QuestionAnswerer = Callable[[str], dict[str, Any]]


class CommentTaskError(RuntimeError):
    """Raised when comments contain unresolved questions in strict mode."""


def default_answer_question(question: str) -> dict[str, Any]:
    return {
        "question": question,
        "answer": "",
        "sources": [],
        "status": "needs_agent_research",
        "error": "No agent-supplied answer was provided; scripts do not fabricate answers.",
    }


def load_agent_answers(path: Path | None) -> dict[str, dict[str, Any]]:
    if not path:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    raw = payload.get("comment_answers", payload) if isinstance(payload, dict) else {}
    if isinstance(raw, list):
        result: dict[str, dict[str, Any]] = {}
        for item in raw:
            if isinstance(item, dict) and item.get("question"):
                result[str(item["question"])] = item
        return result
    if isinstance(raw, dict):
        return {str(key): value for key, value in raw.items() if isinstance(value, dict)}
    return {}


def answer_from_agent(agent_answers: dict[str, dict[str, Any]]) -> QuestionAnswerer:
    def answer(question: str) -> dict[str, Any]:
        item = agent_answers.get(question) or agent_answers.get(question.strip())
        if not item:
            return default_answer_question(question)
        status = str(item.get("status") or "answered").strip()
        answer_text = str(item.get("answer") or "").strip()
        sources = item.get("sources") if isinstance(item.get("sources"), list) else []
        if status == "answered" and not answer_text:
            status = "failed_with_reason"
        return {"question": question, **item, "answer": answer_text, "sources": sources, "status": status}

    return answer


def unresolved_answers(answers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [item for item in answers if str(item.get("status") or "") != "answered"]


def run_comment_tasks(
    comments: dict[str, list[str]],
    workspace_root: Path,
    answer_question: QuestionAnswerer | None = None,
    strict: bool = False,
) -> dict[str, Any]:
    del workspace_root
    answer_question = answer_question or default_answer_question
    answers = [answer_question(question) for question in comments.get("questions", []) if question]
    unresolved = unresolved_answers(answers)
    request_feedback = [
        {
            "request": request,
            "status": "checked",
            "feedback": "已纳入 Start My Day 回环核查；超出自动流程的部分会进入明确 TODO。",
        }
        for request in comments.get("requests", [])
        if request
    ]
    todos = [
        {"request": request, "todo": "需要人工或后续 agent 继续处理"}
        for request in comments.get("requests", [])
        if any(token in request.lower() for token in ("手动", "人工", "manual", "login"))
    ]
    if strict and unresolved:
        raise CommentTaskError(f"{len(unresolved)} comment questions still need agent research")
    return {"answers": answers, "unresolved": unresolved, "request_feedback": request_feedback, "todos": todos}


def main() -> int:
    parser = argparse.ArgumentParser(description="Process Start My Day comment tasks")
    parser.add_argument("--comments-json", required=True)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--agent-answers", default="")
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--output", default="")
    args = parser.parse_args()
    comments = json.loads(Path(args.comments_json).read_text(encoding="utf-8"))
    answers = load_agent_answers(Path(args.agent_answers)) if args.agent_answers else {}
    result = run_comment_tasks(comments, Path(args.workspace), answer_question=answer_from_agent(answers), strict=args.strict)
    encoded = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(encoded + "\n", encoding="utf-8")
    else:
        print(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
