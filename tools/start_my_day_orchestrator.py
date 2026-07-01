#!/usr/bin/env python3
"""Run the full Start My Day closed loop."""

from __future__ import annotations

import argparse
from datetime import date
from hashlib import sha1
import json
import time
from pathlib import Path
import re
import shutil
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import cat_email
import cat_mailer
import collections_import
import comment_tasks
import package_translated_pdfs
import research_index
import start_my_day_daily
import start_my_day_reflect
import zotero_ingest
import zotero_markdown_index
import zotero_runjs_attachments
import zotero_runjs_collections

REPO_ROOT = SCRIPT_DIR.parent
PAPER_QUERY_DIR = REPO_ROOT / "paper-query" / "scripts"
if str(PAPER_QUERY_DIR) not in sys.path:
    sys.path.insert(0, str(PAPER_QUERY_DIR))

from paper_query.config import load_config as load_paper_query_config
from paper_query.orchestrator import build_request as build_paper_query_request
from paper_query.orchestrator import query_papers

WORKSPACE_SYNC_PATHS = [
    "collections",
    "downloads",
    "zotero",
    "vault/10_Daily",
    "vault/20_Research",
    "vault/30_Inbox",
    "vault/99_System",
    "vault/.obsidian/app.json",
    "vault/.obsidian/appearance.json",
    "vault/.obsidian/core-plugins.json",
    "vault/.obsidian/graph.json",
]
REQUIRED_EMAIL_ENV_VARS = ["CAT_EMAIL_PROVIDER"]
EMAIL_PROVIDER_REQUIRED_ENV = {
    "cf_relay": ["CAT_CF_RELAY_URL", "CAT_CF_RELAY_SECRET", "CAT_FROM_EMAIL"],
    "resend": ["CAT_RESEND_API_KEY", "CAT_FROM_EMAIL"],
    "smtp": ["CAT_SMTP_HOST", "CAT_SMTP_PORT", "CAT_SMTP_USER", "CAT_SMTP_PASSWORD", "CAT_FROM_EMAIL"],
}

DISCOVERY_SOURCES = ["arxiv", "semantic_scholar", "google_scholar", "nature"]


class EmailPreflightError(RuntimeError):
    """Raised when the daily email path is enabled without required env vars."""


class GitSyncError(RuntimeError):
    """Raised for git sync failures that must suppress all email sending."""


class ProductionGateError(RuntimeError):
    """Raised when Start My Day still contains a fake-success state."""


def run_git(workspace_root: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", "-C", str(workspace_root), *args], check=True, text=True, capture_output=True)


def preflight_email_env(env_reader: Any | None = None) -> None:
    env_reader = env_reader or cat_mailer.env_value
    provider = (env_reader("CAT_EMAIL_PROVIDER") or "cf_relay").lower()
    required = [*REQUIRED_EMAIL_ENV_VARS, *EMAIL_PROVIDER_REQUIRED_ENV.get(provider, [])]
    missing = [name for name in required if not env_reader(name)]
    if provider not in EMAIL_PROVIDER_REQUIRED_ENV:
        missing.append(f"unsupported CAT_EMAIL_PROVIDER: {provider}")
    if missing:
        raise EmailPreflightError("missing required email environment variables: " + ", ".join(missing))


def ensure_workspace(workspace_root: Path) -> None:
    (workspace_root / "collections").mkdir(parents=True, exist_ok=True)
    for child in ("imported", "fails", "logs"):
        (workspace_root / "collections" / child).mkdir(parents=True, exist_ok=True)
    (workspace_root / "vault" / "10_Daily").mkdir(parents=True, exist_ok=True)
    (workspace_root / "vault" / "20_Research" / "Papers").mkdir(parents=True, exist_ok=True)
    (workspace_root / "zotero" / "library" / "items").mkdir(parents=True, exist_ok=True)


def safe_key(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "", value.upper())
    return cleaned[:24] or sha1(value.encode("utf-8")).hexdigest()[:12].upper()


def discovery_key(record: dict[str, Any]) -> str:
    arxiv_id = str(record.get("arxiv_id") or "").strip()
    if arxiv_id:
        return "ARXIV" + safe_key(arxiv_id)
    doi = str(record.get("doi") or "").strip()
    if doi:
        return "DOI" + safe_key(doi)
    return "DISC" + sha1(str(record.get("title", "")).encode("utf-8")).hexdigest()[:12].upper()


def download_pdf(record: dict[str, Any], download_dir: Path, key: str) -> Path | None:
    pdf_url = str(record.get("pdf_url") or "").strip()
    if not pdf_url:
        return None
    download_dir.mkdir(parents=True, exist_ok=True)
    target = download_dir / f"{key}.pdf"
    request = urllib.request.Request(pdf_url, headers={"User-Agent": "EvilRead/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            target.write_bytes(response.read())
    except (ssl.SSLError, urllib.error.URLError) as exc:
        if isinstance(exc, urllib.error.URLError) and not isinstance(exc.reason, ssl.SSLError):
            raise
        with urllib.request.urlopen(request, timeout=60, context=ssl._create_unverified_context()) as response:
            target.write_bytes(response.read())
    record["pdf_local_path"] = str(target)
    record["pdf_status"] = "downloaded"
    record["pdf_evidence"] = pdf_url
    return target


def write_discovered_metadata(workspace_root: Path, key: str, record: dict[str, Any], pdf_path: Path | None) -> None:
    item_dir = workspace_root / "zotero" / "library" / "items"
    item_dir.mkdir(parents=True, exist_ok=True)
    if pdf_path and pdf_path.exists():
        shutil.copy2(pdf_path, item_dir / f"{key}.pdf")
    metadata = {
        "key": key,
        "data": {
            "key": key,
            "itemType": "journalArticle",
            "title": record.get("title", ""),
            "creators": [
                {"creatorType": "author", "name": str(author)}
                for author in record.get("authors", [])
                if str(author).strip()
            ],
            "abstractNote": record.get("abstract", ""),
            "DOI": record.get("doi", ""),
            "url": record.get("url") or record.get("pdf_url", ""),
            "date": record.get("published_date") or str(record.get("year", "")),
            "publicationTitle": record.get("venue", ""),
            "extra": json.dumps(
                {
                    "source": record.get("source", ""),
                    "matched_domain": record.get("matched_domain", ""),
                    "matched_keywords": record.get("matched_keywords", []),
                    "scores": record.get("scores", {}),
                    "arxiv_id": record.get("arxiv_id", ""),
                    "pdf_url": record.get("pdf_url", ""),
                },
                ensure_ascii=False,
            ),
        },
    }
    (item_dir / f"{key}.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def discover_papers(workspace_root: Path, run_date: str, top_n: int = 10) -> dict[str, Any]:
    vault_root = workspace_root / "vault"
    research_config = vault_root / "99_System" / "Config" / "research_interests.yaml"
    config = load_paper_query_config(str(REPO_ROOT / "paper-query" / "paper-query.yaml"), str(research_config))
    request = build_paper_query_request(
        config,
        query="",
        sources=DISCOVERY_SOURCES,
        year_from=int(run_date[:4]) - 1,
        year_to=int(run_date[:4]),
        top_n=top_n,
        max_pages=1,
        download_pdfs=False,
    )
    result = query_papers(request, config)
    papers = [paper for paper in result.get("top_papers", []) if isinstance(paper, dict)]
    artifact_dir = vault_root / "99_System" / "Indexes"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    (artifact_dir / f"start_my_day_discovery_{run_date}.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {
        "result": result,
        "papers": papers,
        "confirmed_records": papers[:3],
        "exploration_records": papers[3:8],
        "artifact": str(artifact_dir / f"start_my_day_discovery_{run_date}.json"),
    }


def load_agent_decisions(path: Path | None) -> dict[str, Any]:
    if not path:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def default_agent_decisions() -> dict[str, Any]:
    return {
        "overview": "",
        "reading_suggestions": [],
        "papers": {},
        "research_notes": {},
        "comment_answers": {},
        "preference_updates": {"interests": [], "avoids": []},
    }


def ensure_agent_decisions(
    workspace_root: Path,
    run_date: str,
    explicit_path: Path | None,
    send_email: bool,
) -> tuple[dict[str, Any], str]:
    if explicit_path:
        return load_agent_decisions(explicit_path), str(explicit_path)
    if not send_email:
        return {}, ""
    output = workspace_root / "vault" / "99_System" / "Indexes" / f"start_my_day_agent_decisions_{run_date}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    decisions = default_agent_decisions()
    output.write_text(json.dumps(decisions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return decisions, str(output)


def write_agent_input_bundle(
    workspace_root: Path,
    run_date: str,
    comments: dict[str, list[str]],
    discovery_result: dict[str, Any],
    collections_result: dict[str, Any] | None = None,
) -> Path:
    output = workspace_root / "vault" / "99_System" / "Indexes" / f"start_my_day_agent_input_{run_date}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "date": run_date,
        "task": "Generate Start My Day agent decisions. Do not call an LLM API from scripts.",
        "required_fields": {
            "overview": "daily overview in Chinese",
            "reading_suggestions": ["ordered suggestions"],
            "preference_updates": {
                "interests": [
                    {
                        "keyword": "agent-normalized research keyword, not a verbatim user sentence",
                        "domain": "target research domain",
                        "rationale": "why this keyword captures the user's raw comment",
                    }
                ],
                "avoids": [
                    {
                        "keyword": "agent-normalized excluded keyword, not a verbatim user sentence",
                        "rationale": "why this exclusion captures the user's raw comment",
                    }
                ],
            },
            "papers": {"<zotero_key_or_title>": {"summary": "", "why": "", "observations": [], "next_action": ""}},
            "research_notes": {"<zotero_key_or_title>": {"domain": "", "topic": "", "research_question": "", "method": "", "contribution": "", "evidence": "", "limits": "", "inspiration": ""}},
            "comment_answers": {"<question>": {"answer": "", "sources": [], "status": "answered"}},
        },
        "comments": comments,
        "discovery": discovery_result,
        "collections": collections_result or {},
    }
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


def agent_answerer(agent_decisions: dict[str, Any]) -> Any:
    answers = comment_tasks.load_agent_answers_from_payload(agent_decisions) if hasattr(comment_tasks, "load_agent_answers_from_payload") else {}
    if not answers:
        raw = agent_decisions.get("comment_answers") if isinstance(agent_decisions, dict) else {}
        answers = {str(key): value for key, value in raw.items() if isinstance(value, dict)} if isinstance(raw, dict) else {}
    return comment_tasks.answer_from_agent(answers)


def assert_production_ready(
    *,
    send_email: bool,
    agent_decisions: dict[str, Any],
    collections_result: dict[str, Any],
    comment_result: dict[str, Any],
    research_result: dict[str, Any],
) -> None:
    if not send_email:
        return
    problems: list[str] = []
    if not agent_decisions:
        problems.append("missing agent decision JSON")
    if collections_result.get("skipped"):
        problems.append(f"collections skipped={len(collections_result.get('skipped', []))}")
    if collections_result.get("failed"):
        problems.append(f"collections failed={len(collections_result.get('failed', []))}")
    if collections_result.get("pending"):
        problems.append(f"collections pending={len(collections_result.get('pending', []))}")
    unresolved = comment_result.get("unresolved") or [
        item for item in comment_result.get("answers", []) if str(item.get("status") or "") != "answered"
    ]
    if unresolved:
        problems.append(f"comment questions unresolved={len(unresolved)}")
    if research_result.get("general_created"):
        problems.append(f"research notes still under General={len(research_result.get('general_created', []))}")
    if research_result.get("incomplete"):
        problems.append(f"research notes incomplete={len(research_result.get('incomplete', []))}")
    if problems:
        raise ProductionGateError("; ".join(problems))


def result_keys(items: list[dict[str, Any]]) -> list[str]:
    keys: list[str] = []
    seen: set[str] = set()
    for item in items:
        key = str(item.get("zotero_key") or item.get("parentKey") or "").strip()
        if key and key not in seen:
            keys.append(key)
            seen.add(key)
    return keys


def reconcile_zotero_native(
    *,
    workspace_root: Path,
    run_date: str,
    confirmed_keys: list[str],
    exploration_keys: list[str],
    imported_keys: list[str] | None = None,
    execute: bool = True,
) -> dict[str, Any]:
    imported_keys = imported_keys or []
    all_keys = []
    seen: set[str] = set()
    for key in [*confirmed_keys, *exploration_keys, *imported_keys]:
        if key and key not in seen:
            all_keys.append(key)
            seen.add(key)
    if not all_keys:
        return {"status": "skipped", "reason": "no zotero keys"}
    collection_script = zotero_runjs_collections.build_collection_script(
        confirmed_keys=confirmed_keys,
        exploration_keys=exploration_keys,
        run_date=run_date,
    )
    attachment_items = zotero_runjs_attachments.load_items_from_mirror(
        workspace_root / "zotero" / "library" / "items",
        all_keys,
    )
    attachment_script = zotero_runjs_attachments.build_attachment_script(attachment_items)
    script_dir = workspace_root / "zotero" / "library" / "logs"
    script_dir.mkdir(parents=True, exist_ok=True)
    collection_js = script_dir / f"reconcile_collections_{run_date}.js"
    attachment_js = script_dir / f"reconcile_attachments_{run_date}.js"
    collection_js.write_text(collection_script, encoding="utf-8")
    attachment_js.write_text(attachment_script, encoding="utf-8")
    ui_error = ""
    if execute:
        try:
            zotero_runjs_collections.execute_in_runjs_window(collection_script, title_re=".*JavaScript.*|Zotero", wait_seconds=8.0)
            zotero_runjs_collections.execute_in_runjs_window(attachment_script, title_re=".*JavaScript.*|Zotero", wait_seconds=15.0)
            status = "executed"
        except Exception as exc:
            message = str(exc)
            if not any(marker in message for marker in ("Run JavaScript", "pywinauto", "SetCursorPos")):
                raise
            status = "scripted-ui-unavailable"
            ui_error = message
    else:
        status = "scripted"
    result = {
        "status": status,
        "confirmed_keys": confirmed_keys,
        "exploration_keys": exploration_keys,
        "imported_keys": imported_keys,
        "attachment_keys": all_keys,
        "collection_script": str(collection_js),
        "attachment_script": str(attachment_js),
    }
    if ui_error:
        result["error"] = ui_error
    return result


def ingest_discovered_papers(
    workspace_root: Path,
    run_date: str,
    mode: str,
    records: list[dict[str, Any]],
    zotero_available: bool,
    zotero_api: str,
) -> list[dict[str, Any]]:
    if not records:
        return []
    vault_root = workspace_root / "vault"
    download_dir = workspace_root / "zotero" / "incoming" / run_date
    prepared: list[tuple[dict[str, Any], str, Path | None]] = []
    for record in records:
        key = discovery_key(record)
        pdf_path: Path | None = None
        try:
            pdf_path = download_pdf(record, download_dir, key)
        except OSError as exc:
            record["pdf_status"] = "download_failed"
            record["pdf_evidence"] = str(exc)
        prepared.append((record, key, pdf_path))

    results: list[dict[str, Any]] = []
    if zotero_available:
        try:
            ingested = zotero_ingest.ingest_records(
                records=[record for record, _, _ in prepared],
                mode=mode,
                ingest_date=run_date,
                vault_root=vault_root,
                client=zotero_ingest.ConnectorZoteroClient(api_url=zotero_api),
            )
            for item, (record, fallback_key, pdf_path) in zip(ingested, prepared):
                key = str(item.get("zotero_key") or fallback_key)
                write_discovered_metadata(workspace_root, key, record, pdf_path)
                item.update(
                    {
                        "title": record.get("title", item.get("title", "")),
                        "abstract": record.get("abstract", ""),
                        "source": record.get("source", ""),
                        "pdf_url": record.get("pdf_url", ""),
                        "scores": record.get("scores", {}),
                        "matched_domain": record.get("matched_domain", ""),
                        "matched_keywords": record.get("matched_keywords", []),
                        "status": "ok" if pdf_path and pdf_path.exists() else item.get("status", "needs-pdf"),
                    }
                )
                results.append(item)
            return results
        except (OSError, RuntimeError, ValueError) as exc:
            results.append({"title": "Zotero connector ingest failed", "status": "pending", "error": str(exc)})

    fallback_results: list[dict[str, Any]] = []
    for record, key, pdf_path in prepared:
        write_discovered_metadata(workspace_root, key, record, pdf_path)
        mirror_path = zotero_ingest.mirror_item(
            vault_root=vault_root,
            item_key=key,
            record=record,
            collection_path=f"Library/{'Confirmed' if mode == 'confirmed' else 'Exploration'}/{run_date}",
            ingest_date=run_date,
        )
        fallback_results.append(
            {
                "title": record.get("title", ""),
                "zotero_key": key,
                "collection": f"Library/{'Confirmed' if mode == 'confirmed' else 'Exploration'}/{run_date}",
                "collection_status": "mirror-fallback",
                "mirror_path": str(mirror_path),
                "status": "ok" if pdf_path and pdf_path.exists() else "needs-pdf",
                "abstract": record.get("abstract", ""),
                "source": record.get("source", ""),
                "pdf_url": record.get("pdf_url", ""),
                "scores": record.get("scores", {}),
                "matched_domain": record.get("matched_domain", ""),
                "matched_keywords": record.get("matched_keywords", []),
            }
        )
    return [*results, *fallback_results]


def latest_previous_daily(vault_root: Path, run_date: str) -> Path | None:
    daily_dir = vault_root / "10_Daily"
    candidates = sorted(
        [path for path in daily_dir.glob("*.md") if not path.name.startswith(run_date)],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def workspace_has_changes(workspace_root: Path) -> bool:
    return bool(run_git(workspace_root, ["status", "--short"]).stdout.strip())


def commit_workspace(workspace_root: Path, message: str) -> str:
    run_git(workspace_root, ["add", "--", *WORKSPACE_SYNC_PATHS])
    staged = run_git(workspace_root, ["diff", "--cached", "--name-only"]).stdout.strip()
    if not staged:
        return ""
    run_git(workspace_root, ["commit", "-m", message])
    return run_git(workspace_root, ["rev-parse", "--short", "HEAD"]).stdout.strip()


def push_workspace(workspace_root: Path) -> None:
    try:
        run_git(workspace_root, ["push"])
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or str(exc)).strip()
        message = "git push failed"
        if detail:
            message = f"{message}: {detail}"
        raise GitSyncError(message) from exc


def zotero_executable_candidates() -> list[Path]:
    return [
        Path(r"C:\Program Files\Zotero\zotero.exe"),
        Path(r"C:\Program Files (x86)\Zotero\zotero.exe"),
        Path.home() / "AppData" / "Local" / "Zotero" / "zotero.exe",
    ]


def zotero_diagnostics(api_url: str, candidates: list[Path]) -> dict[str, Any]:
    parsed = urlparse(api_url)
    return {
        "api_url": api_url,
        "host": parsed.hostname or "",
        "port": parsed.port or "",
        "candidate_executables": [{"path": str(path), "exists": path.exists()} for path in candidates],
    }


def probe_zotero_api(api_url: str, timeout_seconds: int = 5) -> bool:
    try:
        with urllib.request.urlopen(f"{api_url.rstrip('/')}/items?limit=1", timeout=timeout_seconds):
            return True
    except OSError:
        return False


def start_zotero_process(executable: Path) -> None:
    subprocess.Popen([str(executable)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def ensure_zotero_available(
    zotero_api: str = "http://127.0.0.1:23119/api/users/0",
    candidates: list[Path] | None = None,
    probe: Any = probe_zotero_api,
    start_process: Any = start_zotero_process,
    wait_seconds: int = 45,
    poll_interval: int = 3,
) -> dict[str, Any]:
    candidates = candidates if candidates is not None else zotero_executable_candidates()
    diagnostics = zotero_diagnostics(zotero_api, candidates)
    if probe(zotero_api):
        return {"status": "available", "started": False, "diagnostics": diagnostics}
    executable = next((path for path in candidates if path.exists()), None)
    if executable is None:
        return {"status": "unavailable", "started": False, "error": "zotero executable not found", "diagnostics": diagnostics}
    start_process(executable)
    deadline = time.monotonic() + wait_seconds
    while True:
        if probe(zotero_api):
            return {"status": "started", "started": True, "executable": str(executable), "diagnostics": diagnostics}
        if time.monotonic() >= deadline:
            return {
                "status": "unavailable",
                "started": True,
                "executable": str(executable),
                "error": "local API did not become available",
                "diagnostics": diagnostics,
            }
        time.sleep(poll_interval)


def prepare_workspace_git(workspace_root: Path, run_date: str) -> str:
    """Synchronize normal user edits before Start My Day mutates the workspace."""
    if not workspace_has_changes(workspace_root):
        run_git(workspace_root, ["pull", "--ff-only"])
        return ""
    commit_sha = commit_workspace(workspace_root, f"chore(workspace): sync user edits before start-my-day {run_date}")
    try:
        run_git(workspace_root, ["pull", "--rebase"])
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or str(exc)).strip()
        message = "git pull --rebase failed"
        if detail:
            message = f"{message}: {detail}"
        raise GitSyncError(message) from exc
    if commit_sha:
        push_workspace(workspace_root)
    return commit_sha


def update_email_status(note_path: Path, email_result: dict[str, Any]) -> None:
    text = note_path.read_text(encoding="utf-8")
    status = str(email_result.get("status", "failed"))
    text = text.replace('email_status: "pending"', f'email_status: "{status}"', 1)
    text = text.replace("- Email status: pending", f"- Email status: {status}", 1)
    marker = "## Email 状态"
    replacement = marker + "\n" + start_my_day_daily.render_email_status(email_result)
    if marker in text:
        before, _, after = text.partition(marker)
        tail = after.split("\n## ", 1)
        if len(tail) == 2:
            text = before + replacement + "\n\n## " + tail[1]
        else:
            text = before + replacement + "\n"
    note_path.write_text(text, encoding="utf-8")


def send_failure_notice(
    to_email: str,
    run_date: str,
    error: BaseException,
    sender: Any = cat_mailer.send_notification_email,
) -> dict[str, str]:
    title = f"EvilRead Start My Day failed - {run_date}"
    body = "\n".join(
        [
            f"Start My Day failed on {run_date}.",
            "",
            "The scheduler did not finish the daily loop.",
            "",
            f"Error: {type(error).__name__}: {error}",
            "",
            "No secrets are included in this notice. Check the local terminal logs for the full traceback.",
        ]
    )
    try:
        ok = sender(to_email, title, body, None)
    except Exception:
        ok = False
    return {"status": "sent" if ok else "failed", "to": to_email, "title": title}


def run_loop(
    workspace_root: Path,
    run_date: str,
    send_email: bool = False,
    email_to: str = "487844383@qq.com",
    skip_git: bool = False,
    skip_zotero_import: bool = False,
    zotero_api: str = "http://127.0.0.1:23119/api/users/0",
    humanize_daily: bool = True,
    agent_decisions_path: Path | None = None,
) -> dict[str, Any]:
    workspace_root = Path(workspace_root)
    vault_root = workspace_root / "vault"
    if send_email:
        preflight_email_env()
    ensure_workspace(workspace_root)
    if not skip_git:
        pre_start_commit = prepare_workspace_git(workspace_root, run_date)
    else:
        pre_start_commit = ""
    zotero_status = ensure_zotero_available(zotero_api)
    agent_decisions, agent_decisions_artifact = ensure_agent_decisions(
        workspace_root,
        run_date,
        agent_decisions_path,
        send_email,
    )
    previous_note = latest_previous_daily(vault_root, run_date)
    comments = {"interests": [], "avoids": [], "deepen": [], "questions": [], "requests": []}
    reflection: dict[str, Any] | None = None
    if previous_note:
        reflection = start_my_day_reflect.reflect_daily_note(
            previous_note,
            vault_root,
            run_date,
            preference_updates=agent_decisions.get("preference_updates") if isinstance(agent_decisions, dict) else None,
            require_agent_analysis=send_email,
        )
        comments = {key: reflection.get(key, []) for key in comments}
    comment_result = comment_tasks.run_comment_tasks(
        comments,
        workspace_root,
        answer_question=agent_answerer(agent_decisions),
        strict=send_email and bool(comments.get("questions")),
    )
    discovery_result = discover_papers(workspace_root, run_date)
    agent_input_bundle = write_agent_input_bundle(workspace_root, run_date, comments, discovery_result)
    pending_items: list[str] = []
    if zotero_status.get("status") == "unavailable":
        reason = str(zotero_status.get("error") or "unknown Zotero local API failure")
        pending_items.extend(
            [
                f"Zotero local API unavailable; rerun collections import. Reason: {reason}",
                "Zotero connector ingest skipped; discovered papers were still downloaded into the workspace Zotero mirror.",
            ]
        )
        collections_result = {"status": "zotero-unavailable", "reason": pending_items[0], "imported": [], "failed": [], "skipped": []}
        confirmed_results = ingest_discovered_papers(
            workspace_root,
            run_date,
            "confirmed",
            discovery_result["confirmed_records"],
            zotero_available=False,
            zotero_api=zotero_api,
        )
        exploration_results = ingest_discovered_papers(
            workspace_root,
            run_date,
            "exploration",
            discovery_result["exploration_records"],
            zotero_available=False,
            zotero_api=zotero_api,
        )
        zotero_result = {"status": "mirror-fallback", "copied": [], "missing": [pending_items[0]]}
        zotero_index = zotero_markdown_index.write_zotero_index(workspace_root)
        research_result = research_index.update_research_notes(
            workspace_root,
            run_date,
            agent_decisions=agent_decisions,
            require_agent_research=send_email,
        )
        zotero_native_result = {"status": "skipped", "reason": "zotero unavailable"}
    else:
        collections_result = collections_import.import_collection_pdfs(workspace_root, run_date, execute=not skip_zotero_import)
        confirmed_results = ingest_discovered_papers(
            workspace_root,
            run_date,
            "confirmed",
            discovery_result["confirmed_records"],
            zotero_available=True,
            zotero_api=zotero_api,
        )
        exploration_results = ingest_discovered_papers(
            workspace_root,
            run_date,
            "exploration",
            discovery_result["exploration_records"],
            zotero_available=True,
            zotero_api=zotero_api,
        )
        zotero_result = start_my_day_daily.sync_zotero_mirror(workspace_root, zotero_api=zotero_api) or {"copied": [], "missing": []}
        zotero_index = zotero_markdown_index.write_zotero_index(workspace_root)
        research_result = research_index.update_research_notes(
            workspace_root,
            run_date,
            agent_decisions=agent_decisions,
            require_agent_research=send_email,
        )
        zotero_native_result = reconcile_zotero_native(
            workspace_root=workspace_root,
            run_date=run_date,
            confirmed_keys=result_keys(confirmed_results),
            exploration_keys=result_keys(exploration_results),
            imported_keys=result_keys(collections_result.get("imported", [])),
            execute=not skip_zotero_import,
        )
    assert_production_ready(
        send_email=send_email,
        agent_decisions=agent_decisions,
        collections_result=collections_result,
        comment_result=comment_result,
        research_result=research_result,
    )
    pdf_package_result = package_translated_pdfs.package_incremental_translations(workspace_root, run_date=run_date)
    daily_note = start_my_day_daily.write_daily_note(
        vault_root=vault_root,
        note_date=run_date,
        confirmed=confirmed_results,
        exploration=exploration_results,
        workspace_root=workspace_root,
        collections_result=collections_result,
        zotero_sync_result=zotero_result,
        research_result=research_result,
        comment_tasks_result=comment_result,
        email_result={"status": "pending", "to": email_to},
        pdf_package_result=pdf_package_result,
        agent_insight=agent_decisions,
        require_agent_insight=send_email,
        humanize=humanize_daily,
        pending_items=pending_items,
    )
    first_commit = ""
    if not skip_git and workspace_has_changes(workspace_root):
        first_commit = commit_workspace(workspace_root, f"chore(start-my-day): sync daily reading loop {run_date}")
        push_workspace(workspace_root)
    email_result = {"status": "skipped", "to": email_to}
    second_commit = ""
    if send_email:
        email_result = cat_email.send_daily_markdown(daily_note, email_to, run_date=run_date)
        update_email_status(daily_note, email_result)
        if not skip_git and workspace_has_changes(workspace_root):
            second_commit = commit_workspace(workspace_root, f"chore(start-my-day): record daily email status {run_date}")
            push_workspace(workspace_root)
    return {
        "date": run_date,
        "previous_note": str(previous_note) if previous_note else "",
        "reflection": reflection,
        "comments": comment_result,
        "discovery": discovery_result,
        "agent_decisions": agent_decisions_artifact,
        "agent_input_bundle": str(agent_input_bundle),
        "collections": collections_result,
        "zotero_sync": zotero_result,
        "zotero_api": zotero_status,
        "zotero_native": zotero_native_result,
        "zotero_index": str(zotero_index),
        "research": research_result,
        "translated_pdf_package": pdf_package_result,
        "daily_note": str(daily_note),
        "email": email_result,
        "commits": [commit for commit in (pre_start_commit, first_commit, second_commit) if commit],
    }


def close_chrome_processes() -> None:
    if sys.platform == "win32":
        command = [
            "powershell",
            "-NoProfile",
            "-Command",
            (
                "$chrome = Get-CimInstance Win32_Process -Filter \"name = 'chrome.exe'\" "
                "-ErrorAction SilentlyContinue; "
                "$chrome | Where-Object { "
                "$_.CommandLine -match 'remote-debugging|--user-data-dir=.*(Codex|codex|Temp|tmp|playwright|evilread|chrome-automation)' "
                "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
            ),
        ]
    else:
        command = ["pkill", "-f", "chrome.*(remote-debugging|--user-data-dir=.*(codex|tmp|playwright|evilread|chrome-automation))"]
    try:
        subprocess.run(command, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
    except Exception as exc:
        print(f"[WARN] failed to close Chrome after start-my-day: {exc}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Start My Day closed loop")
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--send-email", action="store_true")
    parser.add_argument("--to", default="487844383@qq.com")
    parser.add_argument("--skip-git", action="store_true")
    parser.add_argument("--skip-zotero-import", action="store_true")
    parser.add_argument("--zotero-api", default="http://127.0.0.1:23119/api/users/0")
    parser.add_argument("--no-humanize-daily", action="store_true")
    parser.add_argument("--agent-decisions", default="", help="JSON decisions generated by the calling start-my-day agent")
    args = parser.parse_args()
    try:
        result = run_loop(
            workspace_root=Path(args.workspace),
            run_date=args.date,
            send_email=args.send_email,
            email_to=args.to,
            skip_git=args.skip_git,
            skip_zotero_import=args.skip_zotero_import,
            zotero_api=args.zotero_api,
            humanize_daily=not args.no_humanize_daily,
            agent_decisions_path=Path(args.agent_decisions) if args.agent_decisions else None,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        exit_code = 0
    except Exception as exc:
        if args.send_email and not isinstance(exc, GitSyncError):
            failure_email = send_failure_notice(args.to, args.date, exc)
        else:
            failure_email = {"status": "skipped", "reason": "git sync failure suppresses email" if isinstance(exc, GitSyncError) else "send email disabled"}
        print(
            json.dumps(
                {
                    "date": args.date,
                    "status": "failed",
                    "error": f"{type(exc).__name__}: {exc}",
                    "failure_email": failure_email,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        exit_code = 1
    finally:
        close_chrome_processes()
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
