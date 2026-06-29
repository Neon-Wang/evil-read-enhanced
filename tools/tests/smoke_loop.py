#!/usr/bin/env python3
"""Offline smoke checks for the Zotero/Obsidian loop tools."""

from __future__ import annotations

import json
import tempfile
import zipfile
from pathlib import Path
import sys
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
TOOLS_DIR = REPO_ROOT / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import safety_scan
import cat_email
import cat_mailer
import collection_translation
import collections_import
import comment_tasks
import research_index
import start_my_day_reflect
import start_my_day_daily
import start_my_day_orchestrator
import zotero_markdown_index
import zotero_runjs_attachments
import zotero_runjs_collections
import zotero_closure_audit
import zotero_runjs_dedupe
import zotero_ingest
import zotero_sync
import relay_credentials
import git_tls_relay


def test_safety_scan_rejects_secret_text() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        secret_file = Path(temp_dir) / "notes.md"
        secret_file.write_text("token = sk-test-secret-value-123456\n", encoding="utf-8")

        findings = safety_scan.scan_paths([secret_file])

    assert findings
    assert any("secret-like content" in finding for finding in findings)


def test_reflect_updates_preferences_and_writes_diff() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        vault_root = Path(temp_dir)
        config_dir = vault_root / "99_System" / "Config"
        config_dir.mkdir(parents=True)
        (vault_root / "10_Daily").mkdir()
        (vault_root / "99_System" / "Indexes").mkdir(parents=True)
        config_path = config_dir / "research_interests.yaml"
        config_path.write_text(
            "\n".join(
                [
                    'language: "zh"',
                    "domains:",
                    '  - name: "Brain-Inspired AI"',
                    "    keywords:",
                    '      - "warm-up training"',
                    "    excluded_keywords: []",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        daily_note = vault_root / "10_Daily" / "2026-06-25论文推荐.md"
        daily_note.write_text(
            "\n".join(
                [
                    "# 2026-06-25 论文推荐",
                    "",
                    "## 我的想法（Start My Day Comments）",
                    "- +interest: spiking networks",
                    "- -avoid: medical imaging",
                    "- !deepen: random matrix theory",
                    "- ?question: how does noise shape calibration?",
                    "",
                ]
            ),
            encoding="utf-8",
        )

        summary = start_my_day_reflect.reflect_daily_note(
            daily_note=daily_note,
            vault_root=vault_root,
            diff_date="2026-06-26",
            preference_updates={
                "interests": [
                    {
                        "keyword": "event-driven neural computation",
                        "domain": "Brain-Inspired AI",
                        "rationale": "User's spiking-network note maps to the broader SNN computation thread.",
                    }
                ],
                "avoids": [
                    {
                        "keyword": "clinical medical imaging",
                        "rationale": "User wants to avoid medical imaging papers, especially clinical imaging.",
                    }
                ],
            },
            require_agent_analysis=True,
        )

        updated_config = config_path.read_text(encoding="utf-8")
        diff_text = (vault_root / "99_System" / "preference_diffs" / "2026-06-26.diff").read_text(encoding="utf-8")
        questions_text = (vault_root / "99_System" / "Indexes" / "open_questions.md").read_text(encoding="utf-8")

    assert summary["interests"] == ["spiking networks"]
    assert "event-driven neural computation" in updated_config
    assert "clinical medical imaging" in updated_config
    assert "spiking networks" not in updated_config
    assert '- medical imaging' not in updated_config
    assert '- "medical imaging"' not in updated_config
    assert summary["preference_updates"]["interests"] == ["event-driven neural computation"]
    assert "random matrix theory" in summary["deepen"]
    assert "+interest: spiking networks" in diff_text
    assert "how does noise shape calibration?" in questions_text


def test_reflect_blocks_raw_interest_config_without_agent_analysis() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        vault_root = Path(temp_dir)
        config_dir = vault_root / "99_System" / "Config"
        config_dir.mkdir(parents=True)
        (vault_root / "10_Daily").mkdir()
        config_path = config_dir / "research_interests.yaml"
        original_config = "domains:\n  - name: General\n    keywords: []\n    excluded_keywords: []\n"
        config_path.write_text(original_config, encoding="utf-8")
        daily_note = vault_root / "10_Daily" / "2026-06-25论文推荐.md"
        daily_note.write_text(
            "\n".join(
                [
                    "## Start My Day Comments",
                    "- +interest: I want more papers about SNNs but mainly when they help calibration, not random neuromorphic hype.",
                ]
            ),
            encoding="utf-8",
        )

        try:
            start_my_day_reflect.reflect_daily_note(
                daily_note=daily_note,
                vault_root=vault_root,
                diff_date="2026-06-26",
                require_agent_analysis=True,
            )
        except start_my_day_reflect.PreferenceAnalysisError as exc:
            error = str(exc)
        else:
            raise AssertionError("raw preference comments must require agent analysis before config update")

        updated_config = config_path.read_text(encoding="utf-8")

    assert "agent-analyzed preference updates" in error
    assert updated_config == original_config
    assert "SNNs but mainly" not in updated_config


class FailingAttachmentClient:
    collection_status = "tag-fallback"

    def ensure_collection(self, collection_path: str) -> str:
        return "COLLECTIONKEY"

    def create_journal_article(self, record: dict, collection_key: str) -> str:
        assert collection_key == "COLLECTIONKEY"
        assert record["title"] == "A Test Paper"
        return "ITEMKEY"

    def attach_pdf(self, item_key: str, record: dict) -> bool:
        assert item_key == "ITEMKEY"
        return False


def test_zotero_ingest_marks_needs_pdf_when_attachment_fails() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        vault_root = Path(temp_dir)
        records = [
            {
                "title": "A Test Paper",
                "authors": ["A Researcher"],
                "doi": "10.1234/test",
                "url": "https://example.org/test",
                "abstract": "A short abstract.",
                "source": "nature",
            }
        ]

        result = zotero_ingest.ingest_records(
            records=records,
            mode="confirmed",
            ingest_date="2026-06-25",
            vault_root=vault_root,
            client=FailingAttachmentClient(),
        )

        mirror = vault_root / "30_Inbox" / "Zotero" / "2026" / "ITEMKEY.md"
        mirror_text = mirror.read_text(encoding="utf-8")

    assert result[0]["zotero_key"] == "ITEMKEY"
    assert result[0]["collection_status"] == "tag-fallback"
    assert "needs-pdf" in result[0]["tags"]
    assert 'zotero_key: "ITEMKEY"' in mirror_text


def test_zotero_ingest_mirror_uses_monorepo_relative_artifact_links() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (item_dir / "ITEMKEY.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (item_dir / "ITEMKEY.zh.pdf").write_bytes(b"%PDF-1.4\ntranslated\n")
        mirror_path = zotero_ingest.mirror_item(
            vault_root=vault_root,
            item_key="ITEMKEY",
            record={
                "title": "A Test Paper",
                "authors": ["A Researcher"],
                "doi": "10.1234/test",
                "url": "https://example.org/test",
                "abstract": "A short abstract.",
                "source": "nature",
            },
            collection_path="Library/Confirmed/2026-06-25",
            ingest_date="2026-06-25",
        )
        mirror_text = mirror_path.read_text(encoding="utf-8")

    assert "[ITEMKEY.pdf](../../../../zotero/library/items/ITEMKEY.pdf)" in mirror_text
    assert "[ITEMKEY.zh.pdf](../../../../zotero/library/items/ITEMKEY.zh.pdf)" in mirror_text


def test_connector_ingest_reuses_existing_item_before_saveitems() -> None:
    client = zotero_ingest.ConnectorZoteroClient()
    calls: list[tuple[str, str]] = []

    def fake_request(url: str, method: str = "GET", payload: object | None = None, headers: dict[str, str] | None = None) -> object:
        calls.append((method, url))
        if "/items?" in url:
            return [
                {
                    "key": "EXIST123",
                    "data": {
                        "key": "EXIST123",
                        "itemType": "journalArticle",
                        "title": "A Stable Paper",
                        "DOI": "10.1234/stable",
                    },
                }
            ]
        raise AssertionError(f"unexpected Zotero write: {method} {url}")

    client._request_json = fake_request  # type: ignore[method-assign]

    key = client.create_journal_article(
        {
            "title": "A Stable Paper",
            "doi": "10.1234/stable",
            "authors": ["A Researcher"],
            "source": "arxiv",
        },
        "Library/Confirmed/2026-06-27",
    )

    assert key == "EXIST123"
    assert not any("/connector/saveItems" in url for _, url in calls)


def test_zotero_runjs_collection_script_is_idempotent_and_reports_missing() -> None:
    script = zotero_runjs_collections.build_collection_script(
        confirmed_keys=["CONF1234"],
        exploration_keys=["EXPL1234"],
        run_date="2026-06-25",
    )

    assert 'const confirmedKeys = ["CONF1234"];' in script
    assert 'const explorationKeys = ["EXPL1234"];' in script
    assert 'const runDate = "2026-06-25";' in script
    assert "if (!collections.includes(collection.id))" in script
    assert "confirmedMissing" in script


def test_collections_import_script_reuses_existing_sha_item() -> None:
    script = collections_import.build_import_script(
        [
            {
                "path": "C:/repo/collections/paper.pdf",
                "name": "paper.pdf",
                "sha256": "abc123",
            }
        ],
        run_date="2026-06-27",
    )

    assert "evilread:sha256:" in script
    assert "findExistingBySha" in script
    assert "status: \"existing\"" in script
    assert "parentKey: existing.key" in script
    assert 'ensureChild("Collections", false)' in script
    assert 'ensureChild("2026-06-27", collectionsRoot.id)' in script


def test_zotero_runjs_attachment_script_imports_stored_pdfs() -> None:
    script = zotero_runjs_attachments.build_attachment_script(
        [
            {
                "key": "ITEMKEY",
                "original": "C:/repo/zotero/library/items/ITEMKEY.pdf",
                "translated": "C:/repo/zotero/library/items/ITEMKEY.zh.pdf",
            }
        ]
    )

    assert "Zotero.Attachments.importFromFile" in script
    assert "EvilRead Original PDF" in script
    assert "EvilRead Translated PDF" in script
    assert 'request.key + ".zh"' in script
    assert "linkFromFile" not in script


def test_daily_note_contains_loop_sections_and_empty_comment_template() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        vault_root = Path(temp_dir)
        (vault_root / "templates").mkdir(parents=True)
        (vault_root / "10_Daily").mkdir()
        (vault_root / "templates" / "daily.md").write_text(
            "\n".join(
                [
                    "---",
                    'date: "{{date}}"',
                    'tags: ["daily", "start-my-day"]',
                    "---",
                    "",
                    "# {{date}} 论文回环",
                    "",
                    "## 今日概览",
                    "（由 /start-my-day 自动填充）",
                    "",
                    "## Zotero 新增（自动镜像）",
                    "（由 tools/zotero_sync.py 写入）",
                    "",
                    "## 我的想法（Start My Day Comments）",
                    "- +interest:",
                    "- -avoid:",
                    "- !deepen:",
                    "- ?question:",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        confirmed = [
            {
                "title": "Confirmed Paper",
                "zotero_key": "CONF1234",
                "collection": "Library/Confirmed/2026-06-25",
                "status": "ok",
                "mirror_path": str(vault_root / "30_Inbox" / "Zotero" / "2026" / "CONF1234.md"),
            }
        ]
        exploration = [
            {
                "title": "Exploration Paper",
                "zotero_key": "EXPL1234",
                "collection": "Library/Exploration/2026-06-25",
                "status": "needs-pdf",
                "mirror_path": str(vault_root / "30_Inbox" / "Zotero" / "2026" / "EXPL1234.md"),
            }
        ]

        note_path = start_my_day_daily.write_daily_note(
            vault_root=vault_root,
            note_date="2026-06-25",
            confirmed=confirmed,
            exploration=exploration,
        )
        note_text = note_path.read_text(encoding="utf-8")

    assert "## 精读候选 Confirmed" in note_text
    assert "## 探索候选 Exploration" in note_text
    assert "[[30_Inbox/Zotero/2026/CONF1234|Confirmed Paper]]" in note_text
    assert "[[30_Inbox/Zotero/2026/EXPL1234|Exploration Paper]]" in note_text
    assert "- +interest:\n- -avoid:\n- !deepen:\n- ?question:" in note_text


def test_daily_note_uses_monorepo_relative_pdf_links() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        item_dir = workspace_root / "zotero" / "library" / "items"
        (vault_root / "templates").mkdir(parents=True)
        (vault_root / "10_Daily").mkdir()
        item_dir.mkdir(parents=True)
        (item_dir / "ITEMKEY.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (item_dir / "ITEMKEY.zh.pdf").write_bytes(b"%PDF-1.4\ntranslated\n")
        result = [
            {
                "title": "Linked Paper",
                "zotero_key": "ITEMKEY",
                "collection": "Library/Confirmed/2026-06-25",
                "status": "ok",
                "mirror_path": str(vault_root / "30_Inbox" / "Zotero" / "2026" / "ITEMKEY.md"),
            }
        ]

        note_text = start_my_day_daily.render_daily_note(
            vault_root=vault_root,
            note_date="2026-06-25",
            confirmed=result,
            exploration=[],
            workspace_root=workspace_root,
        )

    assert "[PDF](../../zotero/library/items/ITEMKEY.pdf)" in note_text
    assert "[ZH](../../zotero/library/items/ITEMKEY.zh.pdf)" in note_text


def test_translated_pdf_packager_creates_incremental_zip_and_manifest() -> None:
    import package_translated_pdfs

    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (item_dir / "ITEMA.zh.pdf").write_bytes(b"%PDF translated a")
        (item_dir / "ITEMA.pdf").write_bytes(b"%PDF original a")
        (item_dir / "ITEMA.json").write_text(json.dumps({"title": "Useful Paper"}, ensure_ascii=False), encoding="utf-8")

        result = package_translated_pdfs.package_incremental_translations(
            workspace_root,
            run_date="2026-06-27",
            run_id="2026-06-27-test",
        )

        assert result["status"] == "packaged"
        assert result["file_count"] == 1
        assert result["download_url"] == "https://code-file.jiashengfan.space/downloads/2026-06-27-test.zip"
        zip_path = Path(result["zip_path"])
        assert zip_path.exists()
        assert zip_path.parent == workspace_root / "downloads" / "translated-pdfs" / "batches" / "2026-06-27"
        with zipfile.ZipFile(zip_path) as archive:
            names = archive.namelist()
        assert any(name.endswith(".zh.pdf") and "ITEMA" in name for name in names)

        manifest_rows = package_translated_pdfs.read_manifest(workspace_root)
        assert len(manifest_rows) == 1
        row = manifest_rows[0]
        assert list(row.keys()) == package_translated_pdfs.MANIFEST_FIELDS
        assert row["run_id"] == "2026-06-27-test"
        assert row["zotero_key"] == "ITEMA"
        assert row["title"] == "Useful Paper"
        assert row["status"] == "packaged"
        assert row["zip_sha256"] == package_translated_pdfs.sha256_file(zip_path)


def test_translated_pdf_packager_skips_unchanged_files_without_empty_zip() -> None:
    import package_translated_pdfs

    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (item_dir / "ITEMB.zh.pdf").write_bytes(b"%PDF translated b")

        first = package_translated_pdfs.package_incremental_translations(
            workspace_root,
            run_date="2026-06-27",
            run_id="2026-06-27-first",
        )
        second = package_translated_pdfs.package_incremental_translations(
            workspace_root,
            run_date="2026-06-27",
            run_id="2026-06-27-second",
        )

        assert first["status"] == "packaged"
        assert second["status"] == "no_new_files"
        assert second["file_count"] == 0
        assert second.get("zip_path", "") == ""
        assert not (workspace_root / "downloads" / "translated-pdfs" / "batches" / "2026-06-27" / "2026-06-27-second.zip").exists()
        statuses = [row["status"] for row in package_translated_pdfs.read_manifest(workspace_root)]
        assert statuses == ["packaged", "no_new_files"]


def test_translated_pdf_packager_repackages_changed_file() -> None:
    import package_translated_pdfs

    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        pdf_path = item_dir / "ITEMC.zh.pdf"
        pdf_path.write_bytes(b"%PDF translated c v1")

        package_translated_pdfs.package_incremental_translations(
            workspace_root,
            run_date="2026-06-27",
            run_id="2026-06-27-v1",
        )
        pdf_path.write_bytes(b"%PDF translated c v2")
        changed = package_translated_pdfs.package_incremental_translations(
            workspace_root,
            run_date="2026-06-27",
            run_id="2026-06-27-v2",
        )

        assert changed["status"] == "packaged"
        assert changed["file_count"] == 1
        rows = [row for row in package_translated_pdfs.read_manifest(workspace_root) if row["zotero_key"] == "ITEMC"]
        assert len(rows) == 2
        assert rows[0]["zh_sha256"] != rows[1]["zh_sha256"]


def test_translated_pdf_packager_uses_key_when_metadata_is_missing() -> None:
    import package_translated_pdfs

    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (item_dir / "ITEMD.zh.pdf").write_bytes(b"%PDF translated d")

        result = package_translated_pdfs.package_incremental_translations(
            workspace_root,
            run_date="2026-06-27",
            run_id="2026-06-27-missing-json",
        )

        assert result["items"][0]["title"] == "ITEMD"
        assert package_translated_pdfs.read_manifest(workspace_root)[0]["title"] == "ITEMD"


def test_daily_note_includes_translated_pdf_package_link() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        vault_root = Path(temp_dir) / "vault"
        (vault_root / "10_Daily").mkdir(parents=True)

        note_text = start_my_day_daily.render_daily_note(
            vault_root,
            "2026-06-27",
            confirmed=[],
            exploration=[],
            pdf_package_result={
                "status": "packaged",
                "run_id": "2026-06-27-test",
                "file_count": 2,
                "download_url": "https://code-file.jiashengfan.space/downloads/2026-06-27-test.zip",
            },
        )

    assert "中文 PDF 增量包" in note_text
    assert "https://code-file.jiashengfan.space/downloads/2026-06-27-test.zip" in note_text


def test_daily_note_zotero_status_filters_global_missing_backlog() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        (vault_root / "10_Daily").mkdir(parents=True)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (item_dir / "TODAY1.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        confirmed = [
            {
                "title": "Today Paper",
                "zotero_key": "TODAY1",
                "collection": "Library/Confirmed/2026-06-25",
                "status": "ok",
                "mirror_path": str(vault_root / "30_Inbox" / "Zotero" / "2026" / "TODAY1.md"),
            }
        ]

        note_text = start_my_day_daily.render_daily_note(
            vault_root=vault_root,
            note_date="2026-06-25",
            confirmed=confirmed,
            exploration=[],
            workspace_root=workspace_root,
            zotero_sync_result={
                "copied": [
                    str(item_dir / "TODAY1.pdf"),
                    str(item_dir / "OLDKEY.pdf"),
                ],
                "missing": [
                    "OLDKEY: raw pdf",
                    "OLDKEY: translated pdf",
                    "TODAY1: raw pdf",
                    "TODAY1: translated pdf",
                ],
            },
        )

    assert "- Zotero missing artifacts: 1" in note_text
    assert "- Missing artifacts: 1" in note_text
    assert "- Global mirror backlog: 4 missing artifacts (see index)" in note_text
    assert "TODAY1: translated pdf" in note_text
    assert "TODAY1: raw pdf" not in note_text
    assert "OLDKEY: raw pdf" not in note_text
    assert "OLDKEY: translated pdf" not in note_text


def test_daily_note_links_json_metadata_and_research_note_when_available() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        item_dir = workspace_root / "zotero" / "library" / "items"
        research_dir = vault_root / "20_Research" / "Papers" / "General"
        (vault_root / "templates").mkdir(parents=True)
        (vault_root / "10_Daily").mkdir(parents=True)
        item_dir.mkdir(parents=True)
        research_dir.mkdir(parents=True)
        (item_dir / "ITEMKEY.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (item_dir / "ITEMKEY.zh.pdf").write_bytes(b"%PDF-1.4\ntranslated\n")
        (item_dir / "ITEMKEY.json").write_text(
            json.dumps({"key": "ITEMKEY", "data": {"key": "ITEMKEY", "title": "Linked Paper"}}),
            encoding="utf-8",
        )
        (research_dir / "Linked_Paper.md").write_text(
            '---\nzotero_key: "ITEMKEY"\n---\n# Linked Paper\n',
            encoding="utf-8",
        )
        result = [
            {
                "title": "Linked Paper",
                "zotero_key": "ITEMKEY",
                "collection": "Collections/2026-06-25",
                "status": "imported",
            }
        ]

        note_text = start_my_day_daily.render_daily_note(
            vault_root=vault_root,
            note_date="2026-06-25",
            confirmed=result,
            exploration=[],
            workspace_root=workspace_root,
        )

    assert "[PDF](../../zotero/library/items/ITEMKEY.pdf)" in note_text
    assert "[ZH](../../zotero/library/items/ITEMKEY.zh.pdf)" in note_text
    assert "[JSON](../../zotero/library/items/ITEMKEY.json)" in note_text
    assert "[Research](../20_Research/Papers/General/Linked_Paper.md)" in note_text


def test_daily_note_contains_paper_insights_and_reading_suggestions() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        mirror_dir = vault_root / "30_Inbox" / "Zotero" / "2026"
        item_dir = workspace_root / "zotero" / "library" / "items"
        (vault_root / "templates").mkdir(parents=True)
        (vault_root / "10_Daily").mkdir(parents=True)
        mirror_dir.mkdir(parents=True)
        item_dir.mkdir(parents=True)
        (item_dir / "CONF1234.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        mirror_path = mirror_dir / "CONF1234.md"
        mirror_path.write_text(
            "\n".join(
                [
                    "# Brain-inspired warm-up training for spiking neural networks",
                    "",
                    "## Abstract",
                    "This paper proposes a warm-up training schedule for spiking neural networks. "
                    "It improves stability, reduces early training collapse, and reports stronger accuracy "
                    "on neuromorphic benchmarks.",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        confirmed = [
            {
                "title": "Brain-inspired warm-up training for spiking neural networks",
                "zotero_key": "CONF1234",
                "collection": "Library/Confirmed/2026-06-25",
                "status": "ok",
                "mirror_path": str(mirror_path),
                "abstract": "This paper proposes a warm-up training schedule for spiking neural networks. It improves stability.",
                "source": "arxiv",
            }
        ]
        exploration = [
            {
                "title": "Post-training progress advantage for LLM agents",
                "zotero_key": "EXPL1234",
                "collection": "Library/Exploration/2026-06-25",
                "status": "needs-pdf",
                "mirror_path": str(mirror_dir / "EXPL1234.md"),
                "abstract": "The work studies post-training recipes for LLM agents and measures progress advantage.",
                "source": "semantic_scholar",
            }
        ]

        note_text = start_my_day_daily.render_daily_note(
            vault_root=vault_root,
            note_date="2026-06-25",
            confirmed=confirmed,
            exploration=exploration,
            workspace_root=workspace_root,
        )

    assert "## 今日概览" in note_text
    assert "## 今日阅读建议" in note_text
    assert "**一句话总结**" in note_text
    assert "**为什么值得读**" in note_text
    assert "**核心贡献/观察**" in note_text
    assert "**下一步动作**" in note_text
    assert "warm-up training" in note_text
    assert "spiking neural networks" in note_text
    assert "needs-pdf" in note_text
    assert "[PDF](../../zotero/library/items/CONF1234.pdf)" in note_text


class FakeDailyInsightClient:
    def __init__(self) -> None:
        self.payload = {}

    def complete_daily_insight(self, payload: dict) -> dict:
        self.payload = payload
        return {
            "overview": "LLM 今日判断：Confirmed 候选形成了清晰的精读主线。",
            "reading_suggestions": [
                "先读有译文的脉冲神经网络论文。",
                "再检查 exploration 是否只是主题噪声。",
            ],
            "papers": {
                "CONF1234": {
                    "summary": "LLM 总结：warm-up training 缓解 SNN 训练早期不稳定。",
                    "why": "LLM 理由：它直接对应当前 brain-inspired AI 兴趣。",
                    "observations": ["LLM 观察：实验关注稳定性。"],
                    "next_action": "LLM 下一步：精读方法和训练曲线。",
                }
            },
        }


def test_daily_note_can_use_llm_insight_client_without_losing_links() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        mirror_dir = vault_root / "30_Inbox" / "Zotero" / "2026"
        item_dir = workspace_root / "zotero" / "library" / "items"
        (vault_root / "templates").mkdir(parents=True)
        (vault_root / "10_Daily").mkdir(parents=True)
        mirror_dir.mkdir(parents=True)
        item_dir.mkdir(parents=True)
        (item_dir / "CONF1234.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        confirmed = [
            {
                "title": "Brain-inspired warm-up training for spiking neural networks",
                "zotero_key": "CONF1234",
                "collection": "Library/Confirmed/2026-06-25",
                "status": "ok",
                "mirror_path": str(mirror_dir / "CONF1234.md"),
                "abstract": "Warm-up training improves spiking neural network stability.",
            }
        ]
        client = FakeDailyInsightClient()

        note_text = start_my_day_daily.render_daily_note(
            vault_root=vault_root,
            note_date="2026-06-25",
            confirmed=confirmed,
            exploration=[],
            workspace_root=workspace_root,
            llm_client=client,
        )

    assert client.payload["model_task"] == "start-my-day-agent-insight"
    assert "LLM 今日判断" in note_text
    assert "LLM 总结" in note_text
    assert "LLM 下一步" in note_text
    assert "[PDF](../../zotero/library/items/CONF1234.pdf)" in note_text


def test_collections_import_archives_success_and_writes_logs() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        collections_dir = workspace_root / "collections"
        collections_dir.mkdir()
        pdf_path = collections_dir / "Paper One.pdf"
        pdf_path.write_bytes(b"%PDF-1.4\npaper-one\n")
        (collections_dir / "nested").mkdir()
        (collections_dir / "nested" / "Ignored.pdf").write_bytes(b"%PDF-1.4\nignored\n")

        result = collections_import.import_collection_pdfs(
            workspace_root=workspace_root,
            run_date="2026-06-27",
            execute=True,
            run_import_script=lambda requests, script: [
                {
                    "path": requests[0]["path"],
                    "sha256": requests[0]["sha256"],
                    "parentKey": "ITEM1234",
                    "title": "Recognized Paper One",
                    "status": "imported",
                    "metadataStatus": "recognized",
                }
            ],
        )

        archived = workspace_root / "collections" / "imported" / "2026-06-27" / "Paper One.pdf"
        log_md = workspace_root / "collections" / "logs" / "2026-06-27.md"
        manifest = json.loads((workspace_root / "collections" / "logs" / "import_manifest.json").read_text())
        archived_exists = archived.exists()
        source_exists = pdf_path.exists()
        nested_exists = (collections_dir / "nested" / "Ignored.pdf").exists()
        log_text = log_md.read_text(encoding="utf-8")

    assert result["scanned"] == 1
    assert result["imported"][0]["zotero_key"] == "ITEM1234"
    assert archived_exists
    assert not source_exists
    assert nested_exists
    assert "ITEM1234" in log_text
    assert next(iter(manifest["items_by_hash"].values()))["zotero_key"] == "ITEM1234"


def test_collections_import_archives_failed_pdf() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        collections_dir = workspace_root / "collections"
        collections_dir.mkdir()
        pdf_path = collections_dir / "Broken.pdf"
        pdf_path.write_bytes(b"%PDF-1.4\nbroken\n")

        result = collections_import.import_collection_pdfs(
            workspace_root=workspace_root,
            run_date="2026-06-27",
            execute=True,
            run_import_script=lambda requests, script: [
                {
                    "path": requests[0]["path"],
                    "sha256": requests[0]["sha256"],
                    "status": "failed",
                    "error": "recognition failed",
                }
            ],
        )

        archived = workspace_root / "collections" / "fails" / "2026-06-27" / "Broken.pdf"
        archived_exists = archived.exists()
        source_exists = pdf_path.exists()

    assert result["failed"][0]["error"] == "recognition failed"
    assert archived_exists
    assert not source_exists


def test_collections_import_keeps_pending_verification_pdf_in_place() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        collections_dir = workspace_root / "collections"
        collections_dir.mkdir()
        pdf_path = collections_dir / "Pending.pdf"
        pdf_path.write_bytes(b"%PDF-1.4\npending\n")

        result = collections_import.import_collection_pdfs(
            workspace_root=workspace_root,
            run_date="2026-06-27",
            execute=True,
            run_import_script=lambda requests, script: [
                {
                    "path": requests[0]["path"],
                    "sha256": requests[0]["sha256"],
                    "status": "pending-verification",
                    "error": "RunJS executed; rerun after Zotero sync to verify key",
                }
            ],
        )

        failed_path = workspace_root / "collections" / "fails" / "2026-06-27" / "Pending.pdf"
        log_text = (workspace_root / "collections" / "logs" / "2026-06-27.md").read_text(encoding="utf-8")
        source_exists = pdf_path.exists()
        failed_exists = failed_path.exists()

    assert result["skipped"] == []
    assert result["failed"][0]["error"] == "RunJS executed; rerun after Zotero sync to verify key"
    assert not source_exists
    assert failed_exists
    assert "Pending.pdf - RunJS executed; rerun after Zotero sync to verify key" in log_text


def test_collections_import_keeps_pdf_pending_when_runjs_window_missing() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        collections_dir = workspace_root / "collections"
        collections_dir.mkdir()
        pdf_path = collections_dir / "Needs RunJS.pdf"
        pdf_path.write_bytes(b"%PDF-1.4\npending-runjs\n")

        def missing_runjs(requests: list[dict[str, object]], script: str) -> list[dict[str, object]]:
            raise RuntimeError("Run JavaScript editor was not found")

        with patch(
            "collections_import.enriched_metadata_from_pdf",
            return_value={
                "title": "Recovered Collection Paper",
                "abstractNote": "Recovered abstract from PDF metadata.",
                "creators": [{"creatorType": "author", "name": "A. Author"}],
                "DOI": "10.1234/recovered",
                "url": "https://doi.org/10.1234/recovered",
                "date": "2026",
                "publicationTitle": "Recovered Venue",
                "archiveID": "",
                "source": "test",
                "pdf_url": "",
                "pdf_text_preview": "Recovered abstract from PDF metadata.",
                "arxiv_id": "",
            },
        ), patch(
            "collections_import.ensure_translated_pdf",
            return_value={"status": "generated", "path": "ITEM.zh.pdf"},
        ):
            result = collections_import.import_collection_pdfs(
                workspace_root=workspace_root,
                run_date="2026-06-27",
                execute=True,
                run_import_script=missing_runjs,
            )

        imported_path = workspace_root / "collections" / "imported" / "2026-06-27" / "Needs RunJS.pdf"
        log_text = (workspace_root / "collections" / "logs" / "2026-06-27.md").read_text(encoding="utf-8")
        zotero_key = result["imported"][0]["zotero_key"]
        metadata = json.loads((workspace_root / "zotero" / "library" / "items" / f"{zotero_key}.json").read_text(encoding="utf-8"))
        source_exists = pdf_path.exists()
        imported_exists = imported_path.exists()
        mirror_pdf_exists = (workspace_root / "zotero" / "library" / "items" / f"{zotero_key}.pdf").exists()

    assert result["skipped"] == []
    assert result["failed"] == []
    assert result["imported"][0]["collection_status"] == "mirror-fallback"
    assert result["imported"][0]["reason"] == "runjs-unavailable-mirror-fallback"
    assert result["imported"][0]["abstract"] == "Recovered abstract from PDF metadata."
    assert result["imported"][0]["translation_status"] == "generated"
    assert metadata["data"]["abstractNote"] == "Recovered abstract from PDF metadata."
    assert metadata["data"]["DOI"] == "10.1234/recovered"
    assert not source_exists
    assert imported_exists
    assert mirror_pdf_exists
    assert "Needs RunJS.pdf ->" in log_text


def test_collections_import_refreshes_translation_for_already_imported_pdf() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        collections_dir = workspace_root / "collections"
        item_dir = workspace_root / "zotero" / "library" / "items"
        collections_dir.mkdir()
        item_dir.mkdir(parents=True)
        pdf_path = collections_dir / "Already Imported.pdf"
        pdf_path.write_bytes(b"%PDF-1.4\nalready\n")
        file_hash = collections_import.sha256_file(pdf_path)
        manifest = {
            "items_by_hash": {
                file_hash: {
                    "zotero_key": "COLLKNOWN",
                    "title": "Already Imported",
                    "imported_at": "2026-06-26",
                }
            }
        }
        (collections_dir / "logs").mkdir()
        (collections_dir / "logs" / "import_manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

        with patch(
            "collections_import.ensure_translated_pdf",
            return_value={"status": "generated", "path": str(item_dir / "COLLKNOWN.zh.pdf")},
        ) as translated:
            result = collections_import.import_collection_pdfs(
                workspace_root=workspace_root,
                run_date="2026-06-27",
                execute=True,
                run_import_script=lambda requests, script: [],
            )

        archived = workspace_root / "collections" / "imported" / "2026-06-27" / "Already Imported.pdf"
        mirror_pdf_exists = (item_dir / "COLLKNOWN.pdf").exists()
        archived_exists = archived.exists()

    assert result["imported"][0]["zotero_key"] == "COLLKNOWN"
    assert result["imported"][0]["translation_status"] == "generated"
    assert mirror_pdf_exists
    assert archived_exists
    translated.assert_called_once()


def test_collection_translation_downloads_filelist_output_when_not_on_disk() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        root = Path(temp_dir)
        source = root / "ITEM.pdf"
        source.write_bytes(b"%PDF-1.4\nraw\n")
        translated_dir = root / "translated"
        destination = root / "ITEM.zh.pdf"

        with patch("collection_translation.pdf2zh_available", return_value=True), patch(
            "collection_translation._post_json",
            return_value={"status": "success", "fileList": ["ITEM.no_watermark.zh-CN.dual.pdf"]},
        ), patch("collection_translation._download_file") as download:
            def fake_download(url: str, path: Path, timeout: int) -> bool:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"%PDF-1.7\ntranslated\n")
                return True

            download.side_effect = fake_download
            result = collection_translation.ensure_translated_pdf(
                source,
                "ITEM",
                destination,
                translated_dir=translated_dir,
                server_url="http://127.0.0.1:8890",
            )
            destination_exists = destination.exists()
            destination_head = destination.read_bytes()[:4] if destination.exists() else b""

    assert result["status"] == "generated"
    assert destination_exists
    assert destination_head == b"%PDF"


def test_zotero_markdown_index_links_artifacts_and_research_notes() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        research_dir = workspace_root / "vault" / "20_Research" / "Papers" / "General"
        item_dir.mkdir(parents=True)
        research_dir.mkdir(parents=True)
        (item_dir / "ITEM1234.json").write_text(
            json.dumps(
                {
                    "key": "ITEM1234",
                    "data": {
                        "key": "ITEM1234",
                        "itemType": "journalArticle",
                        "title": "A Linked Paper",
                        "DOI": "10.1234/linked",
                        "date": "2026",
                    },
                }
            ),
            encoding="utf-8",
        )
        (item_dir / "ITEM1234.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (item_dir / "ITEM1234.zh.pdf").write_bytes(b"%PDF-1.4\nzh\n")
        (research_dir / "A_Linked_Paper.md").write_text(
            '---\nzotero_key: "ITEM1234"\ndoi: "10.1234/linked"\n---\n# A Linked Paper\n',
            encoding="utf-8",
        )

        index_path = zotero_markdown_index.write_zotero_index(workspace_root)
        text = index_path.read_text(encoding="utf-8")

    assert "[PDF](library/items/ITEM1234.pdf)" in text
    assert "[ZH](library/items/ITEM1234.zh.pdf)" in text
    assert "[JSON](library/items/ITEM1234.json)" in text
    assert "../vault/20_Research/Papers/General/A_Linked_Paper.md" in text


def test_research_index_creates_note_without_placeholder_text() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (workspace_root / "vault" / "20_Research" / "Papers").mkdir(parents=True)
        (item_dir / "ITEM1234.json").write_text(
            json.dumps(
                {
                    "key": "ITEM1234",
                    "data": {
                        "key": "ITEM1234",
                        "itemType": "journalArticle",
                        "title": "A Research Paper",
                        "abstractNote": "This paper studies adaptive retrieval and evaluates it on benchmark tasks.",
                        "DOI": "10.1234/research",
                        "date": "2026",
                        "creators": [{"creatorType": "author", "firstName": "Ada", "lastName": "Lovelace"}],
                    },
                }
            ),
            encoding="utf-8",
        )
        (item_dir / "ITEM1234.pdf").write_bytes(b"%PDF-1.4\nnot a real pdf\n")

        with patch("research_index.ensure_images", return_value={"status": "ok", "images": [], "index": ""}):
            result = research_index.update_research_notes(
                workspace_root=workspace_root,
                run_date="2026-06-27",
                llm_client=None,
            )
        note_path = Path(result["created"][0]["path"])
        text = note_path.read_text(encoding="utf-8")

    assert "## Zotero Artifacts" in text
    assert "## 图片与图表" in text
    assert "## 摘要与可追溯证据" in text
    assert "## 研究问题" in text
    assert "adaptive retrieval" in text
    assert "[问题描述" not in text
    assert "[鏂规硶1]" not in text
    assert not result["incomplete"]


def test_research_index_enriches_collection_pdf_before_note_generation() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (workspace_root / "vault" / "20_Research" / "Papers").mkdir(parents=True)
        (item_dir / "COLL123.json").write_text(
            json.dumps(
                {
                    "key": "COLL123",
                    "data": {
                        "key": "COLL123",
                        "itemType": "journalArticle",
                        "title": "Collection Imported Paper",
                        "abstractNote": "",
                        "extra": json.dumps({"source": "collections", "original_name": "collection.pdf"}),
                    },
                }
            ),
            encoding="utf-8",
        )
        (item_dir / "COLL123.pdf").write_bytes(b"%PDF-1.4\nfake\n")
        (item_dir / "COLL123.zh.pdf").write_bytes(b"%PDF-1.4\ntranslated\n")

        with patch(
            "research_index.enriched_metadata_from_pdf",
            return_value={
                "title": "Collection Imported Paper",
                "abstractNote": "This recovered abstract explains the imported collection PDF.",
                "creators": [],
                "DOI": "10.5555/collection",
                "url": "https://doi.org/10.5555/collection",
                "date": "2026",
                "publicationTitle": "Collection Venue",
                "archiveID": "",
                "source": "test",
                "pdf_text_preview": "This recovered abstract explains the imported collection PDF.",
                "arxiv_id": "",
            },
        ), patch("research_index.ensure_images", return_value={"status": "ok", "images": [], "index": ""}):
            result = research_index.update_research_notes(workspace_root, "2026-06-27")

        note_path = Path(result["created"][0]["path"])
        note_text = note_path.read_text(encoding="utf-8")
        metadata = json.loads((item_dir / "COLL123.json").read_text(encoding="utf-8"))

    assert not result["incomplete"]
    assert metadata["data"]["abstractNote"] == "This recovered abstract explains the imported collection PDF."
    assert metadata["data"]["DOI"] == "10.5555/collection"
    assert "This recovered abstract explains the imported collection PDF." in note_text
    assert "需要 agent 精读" not in note_text


def test_research_index_marks_collection_missing_translation_incomplete() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (workspace_root / "vault" / "20_Research" / "Papers").mkdir(parents=True)
        (item_dir / "COLLNOZH.json").write_text(
            json.dumps(
                {
                    "key": "COLLNOZH",
                    "data": {
                        "key": "COLLNOZH",
                        "itemType": "journalArticle",
                        "title": "Collection Without Translation",
                        "abstractNote": "Recovered abstract is present.",
                        "extra": json.dumps({"source": "collections"}),
                    },
                }
            ),
            encoding="utf-8",
        )
        (item_dir / "COLLNOZH.pdf").write_bytes(b"%PDF-1.4\nfake\n")

        with patch("research_index.ensure_images", return_value={"status": "ok", "images": [], "index": ""}):
            result = research_index.update_research_notes(workspace_root, "2026-06-27")

    reasons = [item["reason"] for item in result["incomplete"]]
    assert "collection translated PDF missing" in reasons


def test_research_index_requires_agent_read_markdown_for_production() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (workspace_root / "vault" / "20_Research" / "Papers").mkdir(parents=True)
        (item_dir / "ITEMPROD.json").write_text(
            json.dumps(
                {
                    "key": "ITEMPROD",
                    "data": {
                        "key": "ITEMPROD",
                        "itemType": "journalArticle",
                        "title": "Production Paper",
                        "abstractNote": "A real abstract is still not a substitute for agent reading.",
                    },
                }
            ),
            encoding="utf-8",
        )
        (item_dir / "ITEMPROD.pdf").write_bytes(b"%PDF-1.4\nraw\n")

        with patch("research_index.ensure_images", return_value={"status": "ok", "images": [], "index": ""}):
            result = research_index.update_research_notes(
                workspace_root,
                "2026-06-27",
                agent_decisions={"research_notes": {"Production Paper": {"domain": "Reliable ML from Neuroscience"}}},
                require_agent_research=True,
            )

    assert any(item["reason"] == "agent-read research note missing" for item in result["incomplete"])


def test_research_index_does_not_require_agent_read_markdown_for_unselected_history() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (workspace_root / "vault" / "20_Research" / "Papers").mkdir(parents=True)
        (item_dir / "HISTORY.json").write_text(
            json.dumps(
                {
                    "key": "HISTORY",
                    "data": {
                        "key": "HISTORY",
                        "itemType": "journalArticle",
                        "title": "Historical Zotero Item",
                        "abstractNote": "Old item outside today's selected recommendations.",
                    },
                }
            ),
            encoding="utf-8",
        )
        (item_dir / "HISTORY.pdf").write_bytes(b"%PDF-1.4\nraw\n")

        with patch("research_index.ensure_images", return_value={"status": "ok", "images": [], "index": ""}):
            result = research_index.update_research_notes(
                workspace_root,
                "2026-06-27",
                agent_decisions={"research_notes": {"Different Selected Paper": {"domain": "Reliable ML from Neuroscience"}}},
                require_agent_research=True,
            )

    assert not any(item["reason"] == "agent-read research note missing" for item in result["incomplete"])


def test_research_index_writes_agent_read_markdown_with_frontmatter() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        item_dir.mkdir(parents=True)
        (workspace_root / "vault" / "20_Research" / "Papers").mkdir(parents=True)
        (item_dir / "ITEMREAD.json").write_text(
            json.dumps(
                {
                    "key": "ITEMREAD",
                    "data": {
                        "key": "ITEMREAD",
                        "itemType": "journalArticle",
                        "title": "Agent Read Paper",
                        "abstractNote": "Abstract.",
                    },
                }
            ),
            encoding="utf-8",
        )
        (item_dir / "ITEMREAD.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        markdown = "\n".join(
            [
                "# Agent Read Paper",
                "",
                "## 日报摘要",
                "这是一段由 agent 精读论文后写出的日报摘要。",
                "",
                "## 核心贡献",
                "- 贡献一来自正文方法部分。",
                "- 贡献二关联 [[Prior Work|既有研究]]。",
                "",
                "## 为什么值得读",
                "它解释了方法和证据之间的关系。",
            ]
        )

        with patch("research_index.ensure_images", return_value={"status": "ok", "images": [], "index": ""}):
            result = research_index.update_research_notes(
                workspace_root,
                "2026-06-27",
                agent_decisions={"research_notes": {"Agent Read Paper": {"research_note_markdown": markdown}}},
                require_agent_research=True,
            )
        note_text = Path(result["created"][0]["path"]).read_text(encoding="utf-8")

    assert not result["incomplete"]
    assert 'zotero_key: "ITEMREAD"' in note_text
    assert "由 agent 精读论文后写出" in note_text
    assert "贡献二关联" in note_text


def test_research_index_adds_alias_for_duplicate_zotero_parent_key() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        item_dir = workspace_root / "zotero" / "library" / "items"
        research_dir = workspace_root / "vault" / "20_Research" / "Papers" / "Agents"
        item_dir.mkdir(parents=True)
        research_dir.mkdir(parents=True)
        (item_dir / "DUPENEW2.json").write_text(
            json.dumps(
                {
                    "key": "DUPENEW2",
                    "data": {
                        "key": "DUPENEW2",
                        "title": "Duplicate Alias Paper",
                        "itemType": "journalArticle",
                        "abstractNote": "A duplicate Zotero parent item should map to the existing research note.",
                    },
                }
            ),
            encoding="utf-8",
        )
        note_path = research_dir / "Duplicate_Alias_Paper.md"
        note_path.write_text(
            "\n".join(
                [
                    "---",
                    'zotero_key: "DUPEOLD1"',
                    'title: "Duplicate Alias Paper"',
                    "---",
                    "# Duplicate Alias Paper",
                    "",
                    "## Zotero Artifacts",
                    "- Metadata JSON: ok",
                    "",
                    "## Daily Digest",
                    "Existing digest.",
                    "",
                    "## Why Read",
                    "Existing why.",
                    "",
                    "## Contributions",
                    "- Existing contribution.",
                    "",
                    "## Start My Day",
                    "Existing loop section.",
                ]
            ),
            encoding="utf-8",
        )

        research_index.update_research_notes(workspace_root, run_date="2026-06-27")
        text = note_path.read_text(encoding="utf-8")

    assert 'zotero_keys: ["DUPEOLD1", "DUPENEW2"]' in text


def test_reflect_parses_freeform_questions_and_requests() -> None:
    text = "\n".join(
        [
            "## Start My Day Comments",
            "- +interest: retrieval agents",
            "- ?question: how does this paper relate to my Zotero workflow?",
            "- please check whether yesterday PDF import finished",
        ]
    )

    parsed = start_my_day_reflect.parse_comment_lines(text)

    assert parsed["interests"] == ["retrieval agents"]
    assert "Zotero workflow" in parsed["questions"][0]
    assert parsed["requests"] == ["please check whether yesterday PDF import finished"]


def test_comment_tasks_answers_questions_and_records_requests() -> None:
    comments = {
        "questions": ["浠€涔堟槸 adaptive retrieval?"],
        "requests": ["检查 Zotero mirror 是否更新"],
    }

    result = comment_tasks.run_comment_tasks(
        comments=comments,
        workspace_root=Path("C:/workspace"),
        answer_question=lambda question: {
            "question": question,
            "answer": "adaptive retrieval 是按任务动态改写检索策略。",
            "sources": ["https://example.org"],
            "status": "answered",
        },
    )

    assert result["answers"][0]["status"] == "answered"
    assert result["request_feedback"][0]["status"] == "checked"


def test_cat_email_sends_markdown_file_verbatim() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        note_path = Path(temp_dir) / "daily.md"
        note_text = "# 2026-06-27 论文日报`n`n## 闭环概览`n原文内容"
        note_path.write_text(note_text, encoding="utf-8")
        sent: dict[str, object] = {}

        async def fake_sender(email: str, title: str, body: str, notification_type: str | None = None) -> bool:
            sent.update({"email": email, "title": title, "body": body, "notification_type": notification_type})
            return True

        result = cat_email.send_daily_markdown(
            daily_note=note_path,
            to_email="487844383@qq.com",
            run_date="2026-06-27",
            sender=fake_sender,
        )

    assert result["status"] == "sent"
    assert sent["email"] == "487844383@qq.com"
    assert sent["title"].startswith("EvilRead ")
    assert "2026-06-27" in sent["title"]
    assert sent["notification_type"] is None


def test_cat_mailer_supports_cf_relay_resend_and_smtp_without_leaking_secrets() -> None:
    html = cat_mailer.build_notification_html("Title", "# Markdown\n\nBody")
    assert "CAT" in html
    assert "<h2" in html
    assert "# Markdown" not in html

    class FakeEmailResponse:
        status = 200

        def __enter__(self) -> "FakeEmailResponse":
            return self

        def __exit__(self, *args: object) -> None:
            return None

    with patch.dict(
        "os.environ",
        {
            "CAT_EMAIL_PROVIDER": "cf_relay",
            "CAT_CF_RELAY_URL": "https://relay.example.com/send",
            "CAT_CF_RELAY_SECRET": "test-relay-secret",
            "CAT_FRONTEND_URL": "https://cat.example.com",
        },
        clear=False,
    ), patch("cat_mailer.request.urlopen", return_value=FakeEmailResponse()) as opened:
        assert cat_mailer.send_notification_email("to@example.com", "Title", "Body") is True
        request_obj = opened.call_args.args[0]
        assert request_obj.full_url == "https://relay.example.com/send"
        assert request_obj.get_header("User-agent") == "CAT-EvilRead/1.0"
        assert "test-relay-secret" not in request_obj.full_url
        assert "test-relay-secret" not in str(request_obj.header_items())

    with patch.dict(
        "os.environ",
        {
            "CAT_EMAIL_PROVIDER": "resend",
            "CAT_RESEND_API_KEY": "test-resend-key",
            "CAT_FROM_EMAIL": "noreply@example.com",
        },
        clear=False,
    ), patch("cat_mailer.request.urlopen", return_value=FakeEmailResponse()) as opened:
        assert cat_mailer.send_notification_email("to@example.com", "Title", "Body") is True
        request_obj = opened.call_args.args[0]
        assert request_obj.full_url == "https://api.resend.com/emails"
        assert "test-resend-key" not in str(request_obj.data)

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: int) -> None:
            self.host = host
            self.port = port
            self.timeout = timeout
            self.started_tls = False

        def __enter__(self) -> "FakeSMTP":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def starttls(self) -> None:
            self.started_tls = True

        def login(self, user: str, password: str) -> None:
            assert user == "noreply@example.com"
            assert password == "smtp-password"

        def send_message(self, message: object) -> None:
            assert "CAT" in str(message)

    with patch.dict(
        "os.environ",
        {
            "CAT_EMAIL_PROVIDER": "smtp",
            "CAT_SMTP_HOST": "smtp.example.com",
            "CAT_SMTP_PORT": "587",
            "CAT_SMTP_USER": "noreply@example.com",
            "CAT_SMTP_PASSWORD": "smtp-password",
            "CAT_SMTP_USE_TLS": "false",
            "CAT_FROM_EMAIL": "noreply@example.com",
        },
        clear=False,
    ), patch("cat_mailer.smtplib.SMTP", FakeSMTP):
        assert cat_mailer.send_notification_email("to@example.com", "Title", "Body") is True


def test_cat_mailer_rewrites_workspace_links_to_code_server() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        daily_dir = workspace_root / "vault" / "10_Daily"
        research = workspace_root / "vault" / "20_Research" / "Papers" / "Agents" / "Digest.md"
        pdf = workspace_root / "zotero" / "library" / "items" / "ITEM.pdf"
        daily_dir.mkdir(parents=True)
        research.parent.mkdir(parents=True)
        pdf.parent.mkdir(parents=True)
        research.write_text("# Digest\n", encoding="utf-8")
        pdf.write_bytes(b"%PDF-1.4\n")
        body = "\n".join(
            [
                "## 精读候选 Confirmed",
                "- [PDF](../../zotero/library/items/ITEM.pdf)",
                "- [[20_Research/Papers/Agents/Digest|Research Note]]",
            ]
        )

        with patch.dict(
            "os.environ",
            {
                "CAT_CODE_SERVER_URL": "https://code.jiashengfan.space",
                "EVILREAD_WORKSPACE_ROOT": str(workspace_root),
            },
            clear=False,
        ):
            html = cat_mailer.build_notification_html("Title", body, base_dir=daily_dir)

    assert "https://code.jiashengfan.space/?folder=" in html
    assert "file=" in html
    assert "../../zotero/library/items/ITEM.pdf" not in html
    assert "[[20_Research" not in html


def test_cat_mailer_reads_user_scope_environment_when_process_env_missing() -> None:
    with patch.dict("os.environ", {}, clear=True), patch("cat_mailer.user_env_value", return_value="from-user"):
        assert cat_mailer.env_value("CAT_CF_RELAY_SECRET") == "from-user"


def test_daily_report_contains_closed_loop_sections_and_email_status() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        (vault_root / "10_Daily").mkdir(parents=True)
        report = start_my_day_daily.write_daily_note(
            vault_root=vault_root,
            note_date="2026-06-27",
            confirmed=[],
            exploration=[],
            workspace_root=workspace_root,
            collections_result={"imported": [{"zotero_key": "ITEM1234", "title": "Imported"}], "failed": [], "skipped": []},
            zotero_sync_result={"copied": ["x"], "missing": []},
            research_result={"created": [{"title": "Imported"}], "updated": [], "pending": []},
            comment_tasks_result={"answers": [{"question": "Q", "answer": "A", "status": "answered"}], "request_feedback": [], "todos": []},
            email_result={"status": "pending", "to": "487844383@qq.com"},
        )
        text = report.read_text(encoding="utf-8")

    assert report.name == "2026-06-27论文日报.md"
    assert "## 闭环概览" in text
    assert "## 昨日 Comments 反馈" in text
    assert "## Collections 导入" in text
    assert "## Email 状态" in text
    assert "487844383@qq.com" in text


def test_collections_imported_items_receive_daily_recommendation_analysis() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        item_dir = workspace_root / "zotero" / "library" / "items"
        (vault_root / "10_Daily").mkdir(parents=True)
        item_dir.mkdir(parents=True)
        (item_dir / "ITEM1234.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (item_dir / "ITEM1234.json").write_text(
            json.dumps(
                {
                    "key": "ITEM1234",
                    "data": {
                        "key": "ITEM1234",
                        "title": "Imported Collections Paper",
                        "abstractNote": "This imported paper studies retrieval agents for daily research workflows.",
                    },
                }
            ),
            encoding="utf-8",
        )

        report = start_my_day_daily.write_daily_note(
            vault_root=vault_root,
            note_date="2026-06-27",
            confirmed=[],
            exploration=[],
            workspace_root=workspace_root,
            collections_result={
                "imported": [
                    {
                        "zotero_key": "ITEM1234",
                        "title": "Old Manifest Title",
                        "status": "imported",
                    }
                ],
                "failed": [],
                "skipped": [],
            },
            zotero_sync_result={"copied": [str(item_dir / "ITEM1234.pdf")], "missing": []},
            research_result={"created": [], "updated": [], "pending": []},
            comment_tasks_result={"answers": [], "request_feedback": [], "todos": []},
            email_result={"status": "pending", "to": "487844383@qq.com"},
        )
        text = report.read_text(encoding="utf-8")

    recommendation_section = text.split("## 精读候选 Confirmed", 1)[1]
    first_recommendation = recommendation_section.split("## 探索候选 Exploration", 1)[0]
    assert "Imported Collections Paper" in recommendation_section
    assert "Old Manifest Title" not in first_recommendation
    assert "**一句话总结**" in recommendation_section
    assert "**为什么值得读**" in recommendation_section
    assert "[PDF](../../zotero/library/items/ITEM1234.pdf)" in recommendation_section


def test_collection_research_updates_receive_daily_recommendation_analysis() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        item_dir = workspace_root / "zotero" / "library" / "items"
        research_dir = vault_root / "20_Research" / "Papers" / "Collections"
        (vault_root / "10_Daily").mkdir(parents=True)
        item_dir.mkdir(parents=True)
        research_dir.mkdir(parents=True)
        (item_dir / "COLL123.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (item_dir / "COLL123.json").write_text(
            json.dumps(
                {
                    "key": "COLL123",
                    "data": {
                        "key": "COLL123",
                        "title": "Collection Research Digest Paper",
                        "abstractNote": "Abstract.",
                    },
                }
            ),
            encoding="utf-8",
        )
        (research_dir / "Collection_Research_Digest_Paper.md").write_text(
            "\n".join(
                [
                    "---",
                    'zotero_key: "COLL123"',
                    "---",
                    "# Collection Research Digest Paper",
                    "",
                    "## 日报摘要",
                    "这是 collection 论文精读后的日报摘要。",
                    "",
                    "## 为什么值得读",
                    "它把游戏评测和认知机制连接起来。",
                    "",
                    "## 核心贡献",
                    "- collection 精读观察一。",
                    "",
                    "## 下一步动作",
                    "继续对照既有游戏评测笔记。",
                ]
            ),
            encoding="utf-8",
        )

        note_text = start_my_day_daily.render_daily_note(
            vault_root=vault_root,
            note_date="2026-06-27",
            confirmed=[],
            exploration=[],
            workspace_root=workspace_root,
            agent_insight={"overview": "overview", "reading_suggestions": [], "papers": {}},
            require_agent_insight=True,
            collections_result={"imported": [], "failed": [], "skipped": []},
            research_result={
                "created": [],
                "updated": [{"zotero_key": "COLL123", "title": "Collection Research Digest Paper"}],
                "pending": [],
            },
        )

    recommendation_section = note_text.split("## 精读候选 Confirmed", 1)[1]
    first_recommendation = recommendation_section.split("## 探索候选 Exploration", 1)[0]
    assert "### Collection Research Digest Paper" in first_recommendation
    assert "collection 论文精读后的日报摘要" in first_recommendation
    assert "collection 精读观察一" in first_recommendation


def test_daily_note_uses_research_digest_for_production_summary() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        item_dir = workspace_root / "zotero" / "library" / "items"
        research_dir = vault_root / "20_Research" / "Papers" / "Agents"
        (vault_root / "10_Daily").mkdir(parents=True)
        item_dir.mkdir(parents=True)
        research_dir.mkdir(parents=True)
        (item_dir / "ITEMDIGEST.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (item_dir / "ITEMDIGEST.json").write_text(
            json.dumps({"key": "ITEMDIGEST", "data": {"key": "ITEMDIGEST", "title": "Digest Paper"}}),
            encoding="utf-8",
        )
        (research_dir / "Digest_Paper.md").write_text(
            "\n".join(
                [
                    "---",
                    'zotero_key: "ITEMDIGEST"',
                    "---",
                    "# Digest Paper",
                    "",
                    "## 日报摘要",
                    "这是从 20_Research 精读稿熵减出来的一句话总结。",
                    "",
                    "## 为什么值得读",
                    "因为它比较了正文证据、baseline 和失败案例。",
                    "",
                    "## 核心贡献",
                    "- 精读贡献一。",
                    "- 精读贡献二。",
                    "",
                    "## 下一步动作",
                    "复查实验设置。",
                ]
            ),
            encoding="utf-8",
        )

        note_text = start_my_day_daily.render_daily_note(
            vault_root=vault_root,
            note_date="2026-06-27",
            confirmed=[{"zotero_key": "ITEMDIGEST", "title": "Digest Paper", "status": "ok"}],
            exploration=[],
            workspace_root=workspace_root,
            agent_insight={"overview": "overview", "reading_suggestions": ["读 Digest Paper。"], "papers": {}},
            require_agent_insight=True,
        )

    assert "### Digest Paper" in note_text
    assert "从 20_Research 精读稿熵减" in note_text
    assert "精读贡献一" in note_text
    assert "复查实验设置" in note_text
    assert "**为什么值得读**" in note_text


def test_daily_note_research_digest_matches_zotero_key_aliases() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        research_dir = vault_root / "20_Research" / "Papers" / "Agents"
        (vault_root / "10_Daily").mkdir(parents=True)
        research_dir.mkdir(parents=True)
        (research_dir / "Alias_Paper.md").write_text(
            "\n".join(
                [
                    "---",
                    'zotero_key: "OLDKEY01"',
                    'zotero_keys: ["OLDKEY01", "NEWKEY02"]',
                    "---",
                    "# Alias Paper",
                    "",
                    "## Daily Digest",
                    "Alias digest should be used for the new Zotero duplicate key.",
                    "",
                    "## Why Read",
                    "It verifies duplicate Zotero parent items still map to one research note.",
                    "",
                    "## Contributions",
                    "- Alias contribution.",
                    "",
                    "## Next Action",
                    "Keep one canonical research note and map duplicate Zotero keys to it.",
                ]
            ),
            encoding="utf-8",
        )

        note_text = start_my_day_daily.render_daily_note(
            vault_root=vault_root,
            note_date="2026-06-27",
            confirmed=[{"zotero_key": "NEWKEY02", "title": "Alias Paper", "status": "ok"}],
            exploration=[],
            workspace_root=workspace_root,
            agent_insight={"overview": "overview", "reading_suggestions": ["读 Alias Paper。"], "papers": {}},
            require_agent_insight=True,
        )

    assert "Alias digest should be used" in note_text
    assert "Alias contribution" in note_text


def test_orchestrator_commits_dirty_workspace_before_pull_with_explicit_paths() -> None:
    calls: list[list[str]] = []

    def fake_run_git(workspace_root: Path, args: list[str]) -> object:
        calls.append(args)
        stdout = ""
        if args == ["status", "--short"]:
            stdout = " M vault/10_Daily/old.md\n?? collections/\n"
        elif args == ["diff", "--cached", "--name-only"]:
            stdout = "vault/10_Daily/old.md\ncollections/README.md\n"
        elif args == ["rev-parse", "--short", "HEAD"]:
            stdout = "abc1234\n"
        return type("Result", (), {"stdout": stdout})()

    with patch("start_my_day_orchestrator.run_git", side_effect=fake_run_git):
        commit = start_my_day_orchestrator.prepare_workspace_git(Path("C:/workspace"), "2026-06-27")

    assert commit == "abc1234"
    assert calls[0] == ["status", "--short"]
    assert ["add", "--", *start_my_day_orchestrator.WORKSPACE_SYNC_PATHS] in calls
    assert ["pull", "--rebase"] in calls
    assert ["push"] in calls
    assert ["add", "."] not in calls
    assert ["add", "-A"] not in calls


def test_orchestrator_email_preflight_fails_on_missing_env_without_secret_values() -> None:
    seen_names: set[str] = set()

    def fake_env_value(name: str, default: str = "") -> str:
        seen_names.add(name)
        if name == "CAT_EMAIL_PROVIDER":
            return "smtp"
        if name == "CAT_SMTP_PASSWORD":
            return "configured-secret-value"
        return ""
    with patch("start_my_day_orchestrator.cat_mailer.env_value", side_effect=fake_env_value):
        try:
            start_my_day_orchestrator.preflight_email_env()
        except start_my_day_orchestrator.EmailPreflightError as exc:
            message = str(exc)
        else:
            raise AssertionError("email preflight should fail when required env vars are missing")
    assert "missing required email environment variables" in message
    assert "CAT_SMTP_HOST" in message
    assert "CAT_CF_RELAY_SECRET" not in seen_names
    assert "configured-secret-value" not in message

def test_orchestrator_git_rebase_failure_main_suppresses_failure_email() -> None:
    sent: list[str] = []

    def fake_run_loop(**kwargs: object) -> dict[str, object]:
        raise start_my_day_orchestrator.GitSyncError("git pull --rebase failed")

    argv = [
        "start_my_day_orchestrator.py",
        "--workspace",
        "C:/workspace",
        "--date",
        "2026-06-27",
        "--send-email",
    ]
    with patch.object(sys, "argv", argv), \
        patch("start_my_day_orchestrator.run_loop", side_effect=fake_run_loop), \
        patch("start_my_day_orchestrator.send_failure_notice", side_effect=lambda *args, **kwargs: sent.append("sent")):
        exit_code = start_my_day_orchestrator.main()

    assert exit_code == 1
    assert sent == []


def test_orchestrator_non_git_failure_main_keeps_failure_email() -> None:
    sent: list[str] = []

    def fake_run_loop(**kwargs: object) -> dict[str, object]:
        raise RuntimeError("Zotero unavailable")

    argv = [
        "start_my_day_orchestrator.py",
        "--workspace",
        "C:/workspace",
        "--date",
        "2026-06-27",
        "--send-email",
    ]
    with patch.object(sys, "argv", argv), \
        patch("start_my_day_orchestrator.run_loop", side_effect=fake_run_loop), \
        patch("start_my_day_orchestrator.send_failure_notice", side_effect=lambda *args, **kwargs: sent.append("sent") or {"status": "sent"}):
        exit_code = start_my_day_orchestrator.main()

    assert exit_code == 1
    assert sent == ["sent"]


def test_orchestrator_main_closes_chrome_after_success_and_failure() -> None:
    argv = [
        "start_my_day_orchestrator.py",
        "--workspace",
        "C:/workspace",
        "--date",
        "2026-06-27",
    ]
    closed: list[str] = []

    with patch.object(sys, "argv", argv), \
        patch("start_my_day_orchestrator.run_loop", return_value={"date": "2026-06-27"}), \
        patch("start_my_day_orchestrator.close_chrome_processes", create=True, side_effect=lambda: closed.append("success")):
        exit_code = start_my_day_orchestrator.main()

    assert exit_code == 0
    assert closed == ["success"]

    closed = []
    with patch.object(sys, "argv", argv), \
        patch("start_my_day_orchestrator.run_loop", side_effect=RuntimeError("boom")), \
        patch("start_my_day_orchestrator.close_chrome_processes", create=True, side_effect=lambda: closed.append("failure")):
        exit_code = start_my_day_orchestrator.main()

    assert exit_code == 1
    assert closed == ["failure"]


def test_orchestrator_git_push_failure_aborts_before_daily_email() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        (vault_root / "10_Daily").mkdir(parents=True)
        (vault_root / "99_System" / "Config").mkdir(parents=True)
        (vault_root / "99_System" / "Config" / "research_interests.yaml").write_text(
            "domains:\n  - name: General\n    keywords: []\n    excluded_keywords: []\n",
            encoding="utf-8",
        )
        decisions_path = workspace_root / "agent-decisions.json"
        decisions_path.write_text(
            json.dumps({"overview": "agent overview", "reading_suggestions": ["agent suggestion"], "papers": {}, "research_notes": {}, "comment_answers": {}}),
            encoding="utf-8",
        )
        sent: list[str] = []

        with patch("start_my_day_orchestrator.preflight_email_env"), \
            patch("start_my_day_orchestrator.ensure_zotero_available", return_value={"status": "unavailable", "error": "test outage"}), \
            patch("start_my_day_orchestrator.discover_papers", return_value={"result": {}, "papers": [], "confirmed_records": [], "exploration_records": [], "artifact": "offline.json"}), \
            patch("start_my_day_orchestrator.prepare_workspace_git", return_value=""), \
            patch("start_my_day_orchestrator.workspace_has_changes", return_value=True), \
            patch("start_my_day_orchestrator.commit_workspace", return_value="abc1234"), \
            patch("start_my_day_orchestrator.push_workspace", side_effect=start_my_day_orchestrator.GitSyncError("git push failed")), \
            patch("start_my_day_orchestrator.cat_email.send_daily_markdown", side_effect=lambda *args, **kwargs: sent.append("sent")):
            try:
                start_my_day_orchestrator.run_loop(
                    workspace_root=workspace_root,
                    run_date="2026-06-27",
                    send_email=True,
                    skip_git=False,
                    agent_decisions_path=decisions_path,
                )
            except start_my_day_orchestrator.GitSyncError:
                pass
            else:
                raise AssertionError("git push failure should fail the loop")

    assert sent == []


def test_orchestrator_auto_starts_zotero_when_local_api_is_down() -> None:
    attempts = {"count": 0}
    started: list[Path] = []

    def fake_probe(api_url: str, timeout_seconds: int = 5) -> bool:
        attempts["count"] += 1
        return attempts["count"] >= 2

    def fake_start(path: Path) -> None:
        started.append(path)

    with tempfile.TemporaryDirectory() as temp_dir:
        fake_exe = Path(temp_dir) / "zotero.exe"
        fake_exe.write_text("", encoding="utf-8")
        result = start_my_day_orchestrator.ensure_zotero_available(
            zotero_api="http://127.0.0.1:23119/api/users/0",
            candidates=[fake_exe],
            probe=fake_probe,
            start_process=fake_start,
            wait_seconds=0,
            poll_interval=0,
        )

    assert result["status"] == "started"
    assert started == [fake_exe]


def test_orchestrator_reports_zotero_diagnostics_when_auto_start_fails() -> None:
    result = start_my_day_orchestrator.ensure_zotero_available(
        zotero_api="http://127.0.0.1:23119/api/users/0",
        candidates=[],
        probe=lambda api_url, timeout_seconds=5: False,
        wait_seconds=0,
        poll_interval=0,
    )

    assert result["status"] == "unavailable"
    assert result["started"] is False
    assert "diagnostics" in result
    assert result["diagnostics"]["api_url"] == "http://127.0.0.1:23119/api/users/0"


def test_orchestrator_retries_zotero_probe_before_declaring_available() -> None:
    attempts = {"count": 0}

    def flaky_probe(api_url: str, timeout_seconds: int = 5) -> bool:
        attempts["count"] += 1
        return attempts["count"] >= 3

    with tempfile.TemporaryDirectory() as temp_dir:
        fake_exe = Path(temp_dir) / "zotero.exe"
        fake_exe.write_text("", encoding="utf-8")
        result = start_my_day_orchestrator.ensure_zotero_available(
            zotero_api="http://127.0.0.1:23119/api/users/0",
            candidates=[fake_exe],
            probe=flaky_probe,
            start_process=lambda path: None,
            wait_seconds=1,
            poll_interval=0,
        )

    assert result["status"] == "started"
    assert attempts["count"] >= 3


def test_orchestrator_failure_notice_uses_mailer_without_secrets() -> None:
    sent: dict[str, str] = {}

    def fake_send(email: str, title: str, body: str, notification_type: str | None = None) -> bool:
        sent.update({"email": email, "title": title, "body": body, "notification_type": str(notification_type)})
        return True

    result = start_my_day_orchestrator.send_failure_notice(
        to_email="487844383@qq.com",
        run_date="2026-06-27",
        error=RuntimeError("Zotero unavailable"),
        sender=fake_send,
    )

    assert result["status"] == "sent"
    assert sent["email"] == "487844383@qq.com"
    assert "failed" in sent["title"].lower()
    assert "Zotero unavailable" in sent["body"]
    assert "CAT_CF_RELAY_SECRET" not in sent["body"]


def test_reflect_parses_pending_comments_as_requests() -> None:
    text = "\n".join(
        [
            "## 我的想法（Start My Day Comments）",
            "- pending: Zotero local API unavailable; rerun collections import",
        ]
    )

    parsed = start_my_day_reflect.parse_comment_lines(text)

    assert parsed["pending"] == ["Zotero local API unavailable; rerun collections import"]
    assert "Zotero local API unavailable" in parsed["requests"][0]


def test_orchestrator_blocks_daily_email_when_agent_decisions_are_missing() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        (vault_root / "10_Daily").mkdir(parents=True)
        (vault_root / "99_System" / "Config").mkdir(parents=True)
        (vault_root / "99_System" / "Config" / "research_interests.yaml").write_text(
            "domains:\n  - name: General\n    keywords: []\n    excluded_keywords: []\n",
            encoding="utf-8",
        )
        sent: dict[str, str] = {}

        def fake_send(daily_note: Path, to_email: str, run_date: str | None = None) -> dict[str, str]:
            sent["body"] = daily_note.read_text(encoding="utf-8")
            return {"status": "sent", "to": to_email, "daily_note": str(daily_note)}

        fake_record = {
            "title": "Offline Discovery Paper",
            "authors": ["Ada Lovelace"],
            "abstract": "This paper studies reliable retrieval workflows.",
            "source": "arxiv",
            "pdf_url": "https://arxiv.org/pdf/2601.00001v1",
            "arxiv_id": "2601.00001v1",
            "scores": {"recommendation": 9.1},
            "matched_domain": "General",
        }

        def fake_download(record: dict[str, object], download_dir: Path, key: str) -> Path:
            download_dir.mkdir(parents=True, exist_ok=True)
            target = download_dir / f"{key}.pdf"
            target.write_bytes(b"%PDF-1.4\noffline\n")
            record["pdf_local_path"] = str(target)
            return target

        with patch("start_my_day_orchestrator.ensure_zotero_available", return_value={"status": "unavailable", "error": "test outage"}), \
            patch("start_my_day_orchestrator.discover_papers", return_value={"result": {}, "papers": [fake_record], "confirmed_records": [fake_record], "exploration_records": [], "artifact": "offline.json"}), \
            patch("start_my_day_orchestrator.download_pdf", side_effect=fake_download), \
            patch("start_my_day_orchestrator.cat_email.send_daily_markdown", side_effect=fake_send), \
            patch("start_my_day_orchestrator.prepare_workspace_git", return_value=""), \
            patch("start_my_day_orchestrator.workspace_has_changes", return_value=False):
            try:
                start_my_day_orchestrator.run_loop(
                    workspace_root=workspace_root,
                    run_date="2026-06-27",
                    send_email=True,
                    skip_git=False,
                )
            except start_my_day_orchestrator.ProductionGateError as exc:
                error = str(exc)
            else:
                raise AssertionError("missing agent decisions should block production email")

    assert "missing agent decision JSON" in error
    assert sent == {}


def test_orchestrator_uses_agent_analyzed_preferences_for_reflection() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        (vault_root / "10_Daily").mkdir(parents=True)
        (vault_root / "99_System" / "Config").mkdir(parents=True)
        config_path = vault_root / "99_System" / "Config" / "research_interests.yaml"
        config_path.write_text(
            "domains:\n  - name: General\n    keywords: []\n    excluded_keywords: []\n",
            encoding="utf-8",
        )
        previous_note = vault_root / "10_Daily" / "2026-06-26论文日报.md"
        previous_note.write_text(
            "\n".join(
                [
                    "# 2026-06-26",
                    "",
                    "## Start My Day Comments",
                    "- +interest: I want more SNN papers only when they help calibration, not broad neuromorphic hype.",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        decisions_path = workspace_root / "agent-decisions.json"
        decisions_path.write_text(
            json.dumps(
                {
                    "overview": "agent overview",
                    "reading_suggestions": ["agent suggestion"],
                    "preference_updates": {
                        "interests": [
                            {
                                "keyword": "spiking neural calibration",
                                "domain": "Brain-Inspired AI",
                                "rationale": "Condenses the user's raw SNN calibration preference.",
                            }
                        ]
                    },
                    "papers": {},
                    "research_notes": {},
                    "comment_answers": {},
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        with patch("start_my_day_orchestrator.preflight_email_env"), \
            patch("start_my_day_orchestrator.ensure_zotero_available", return_value={"status": "unavailable", "error": "test outage"}), \
            patch("start_my_day_orchestrator.discover_papers", return_value={"result": {}, "papers": [], "confirmed_records": [], "exploration_records": [], "artifact": "offline.json"}), \
            patch("start_my_day_orchestrator.prepare_workspace_git", return_value=""), \
            patch("start_my_day_orchestrator.workspace_has_changes", return_value=False), \
            patch("start_my_day_orchestrator.cat_email.send_daily_markdown", return_value={"status": "sent"}):
            result = start_my_day_orchestrator.run_loop(
                workspace_root=workspace_root,
                run_date="2026-06-27",
                send_email=False,
                skip_git=False,
                agent_decisions_path=decisions_path,
            )

        updated_config = config_path.read_text(encoding="utf-8")
        diff_text = (vault_root / "99_System" / "preference_diffs" / "2026-06-27.diff").read_text(encoding="utf-8")

    assert "spiking neural calibration" in updated_config
    assert "I want more SNN papers" not in updated_config
    assert "I want more SNN papers" in diff_text
    assert result["reflection"]["preference_updates"]["interests"] == ["spiking neural calibration"]


def test_orchestrator_reconciles_zotero_collections_and_attachments() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        item_dir = workspace_root / "zotero" / "library" / "items"
        (vault_root / "10_Daily").mkdir(parents=True)
        (vault_root / "99_System" / "Config").mkdir(parents=True)
        item_dir.mkdir(parents=True)
        (vault_root / "99_System" / "Config" / "research_interests.yaml").write_text(
            "domains:\n  - name: General\n    keywords: []\n    excluded_keywords: []\n",
            encoding="utf-8",
        )
        decisions_path = workspace_root / "agent-decisions.json"
        decisions_path.write_text(
            json.dumps({"overview": "agent overview", "reading_suggestions": ["agent suggestion"], "papers": {}, "research_notes": {}, "comment_answers": {}}),
            encoding="utf-8",
        )
        reconciled: list[dict[str, object]] = []

        with patch("start_my_day_orchestrator.preflight_email_env"), \
            patch("start_my_day_orchestrator.ensure_zotero_available", return_value={"status": "available"}), \
            patch("start_my_day_orchestrator.collections_import.import_collection_pdfs", return_value={"imported": [], "failed": [], "skipped": [], "pending": []}), \
            patch("start_my_day_orchestrator.discover_papers", return_value={"result": {}, "papers": [], "confirmed_records": [], "exploration_records": [], "artifact": "offline.json"}), \
            patch("start_my_day_orchestrator.ingest_discovered_papers", side_effect=[
                [{"title": "Confirmed Paper", "zotero_key": "CONF123", "collection": "Library/Confirmed/2026-06-27", "status": "ok"}],
                [{"title": "Exploration Paper", "zotero_key": "EXPL123", "collection": "Library/Exploration/2026-06-27", "status": "ok"}],
            ]), \
            patch("start_my_day_orchestrator.start_my_day_daily.sync_zotero_mirror", return_value={"copied": [], "missing": []}), \
            patch("start_my_day_orchestrator.zotero_markdown_index.write_zotero_index", return_value=workspace_root / "zotero" / "INDEX.md"), \
            patch("start_my_day_orchestrator.research_index.update_research_notes", return_value={"updated": [], "incomplete": []}), \
            patch("start_my_day_orchestrator.reconcile_zotero_native", side_effect=lambda **kwargs: reconciled.append(kwargs) or {"status": "ok"}), \
            patch("start_my_day_orchestrator.prepare_workspace_git", return_value=""), \
            patch("start_my_day_orchestrator.workspace_has_changes", return_value=False), \
            patch("start_my_day_orchestrator.cat_email.send_daily_markdown", return_value={"status": "sent"}):
            result = start_my_day_orchestrator.run_loop(
                workspace_root=workspace_root,
                run_date="2026-06-27",
                send_email=False,
                skip_git=False,
                agent_decisions_path=decisions_path,
            )

    assert reconciled
    assert reconciled[0]["confirmed_keys"] == ["CONF123"]
    assert reconciled[0]["exploration_keys"] == ["EXPL123"]
    assert result["zotero_native"]["status"] == "ok"


def test_daily_report_humanizes_daily_sections_without_changing_research_notes() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        (vault_root / "10_Daily").mkdir(parents=True)

        report = start_my_day_daily.write_daily_note(
            vault_root=vault_root,
            note_date="2026-06-27",
            confirmed=[
                {
                    "title": "A Useful Paper",
                    "zotero_key": "ITEM1234",
                    "status": "ok",
                    "abstract": "This paper studies retrieval agents.",
                }
            ],
            exploration=[],
            workspace_root=workspace_root,
            collections_result={"imported": [], "failed": [], "skipped": []},
            zotero_sync_result={"copied": [], "missing": []},
            research_result={"created": [], "updated": [], "pending": []},
            comment_tasks_result={"answers": [], "request_feedback": [], "todos": []},
            email_result={"status": "pending", "to": "487844383@qq.com"},
            humanize=True,
        )
        text = report.read_text(encoding="utf-8")

    assert "今天的日报只保留能追溯的内容" in text
    assert "Let's dive in" not in text
    assert "鑷冲叧閲嶈" not in text


def test_start_my_day_daily_syncs_zotero_before_note_generation() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace_root = Path(temp_dir)
        vault_root = workspace_root / "vault"
        (vault_root / "templates").mkdir(parents=True)
        (vault_root / "10_Daily").mkdir(parents=True)
        results_path = workspace_root / "confirmed.json"
        results_path.write_text(
            json.dumps(
                [
                    {
                        "title": "Synced Paper",
                        "zotero_key": "ITEMKEY",
                        "collection": "Library/Confirmed/2026-06-25",
                        "status": "ok",
                        "mirror_path": str(vault_root / "30_Inbox" / "Zotero" / "2026" / "ITEMKEY.md"),
                    }
                ]
            ),
            encoding="utf-8",
        )

        def fake_sync_items(**kwargs: object) -> dict[str, object]:
            assert kwargs["item_keys"] == ["ITEMKEY"]
            item_dir = workspace_root / "zotero" / "library" / "items"
            item_dir.mkdir(parents=True)
            (item_dir / "ITEMKEY.pdf").write_bytes(b"%PDF-1.4\nraw\n")
            return {"copied": [str(item_dir / "ITEMKEY.pdf")], "missing": [], "commit": ""}

        argv = [
            "start_my_day_daily.py",
            "--vault",
            str(vault_root),
            "--workspace",
            str(workspace_root),
            "--date",
            "2026-06-25",
            "--confirmed-results",
            str(results_path),
        ]
        with patch.object(sys, "argv", argv), patch(
            "start_my_day_daily.zotero_sync.fetch_library_item_keys",
            return_value=["ITEMKEY"],
        ), patch("start_my_day_daily.zotero_sync.sync_items", side_effect=fake_sync_items):
            exit_code = start_my_day_daily.main()

        daily_notes = list((vault_root / "10_Daily").glob("2026-06-25*.md"))
        assert len(daily_notes) == 1
        note_text = daily_notes[0].read_text(encoding="utf-8")

    assert exit_code == 0
    assert "[PDF](../../zotero/library/items/ITEMKEY.pdf)" in note_text


def test_task_scheduler_start_my_day_wrapper_contract() -> None:
    script_path = REPO_ROOT / "scripts" / "run-start-my-day.ps1"
    script_text = script_path.read_text(encoding="utf-8")

    assert ".venv\\Scripts\\python.exe" in script_text
    assert "tools\\start_my_day_orchestrator.py" in script_text
    assert "C:\\GitClient\\windows\\repos\\evilread-workspace" in script_text
    assert "--send-email" in script_text
    assert "--skip-git" in script_text
    assert "--skip-zotero-import" in script_text
    assert "--no-humanize-daily" in script_text
    assert "C:\\GitClient\\windows\\.ssh\\config" in script_text
    assert "$gitSshConfigForGit = $gitSshConfig.Replace(\"\\\", \"/\")" in script_text
    assert '$env:GIT_SSH_COMMAND = "ssh -F `"$gitSshConfigForGit`""' in script_text
    assert "GIT_SSH_COMMAND" in script_text
    assert "exit 3" in script_text
    assert "CAT_CF_RELAY_SECRET" in script_text
    assert "CAT_RESEND_API_KEY" in script_text
    assert "CAT_SMTP_PASSWORD" in script_text
    assert "EVILREAD_RELAY_CREDENTIALS" in script_text
    assert "sync-zotero-workspace.ps1" in script_text
    assert "-BeforeStartMyDay" in script_text
    assert "-AfterStartMyDay" in script_text


def test_relay_credentials_encrypt_decrypt_and_redact_secret_fields() -> None:
    payload = {
        "workspace_remote": "https://git.jiashengfan.space/o2/evilread-workspace.git",
        "local_test_remote": "https://127.0.0.1:18083/o2/evilread-workspace.git",
        "git_username": "tester",
        "git_token": "secret-token-value",
    }

    envelope = relay_credentials.encrypt_payload(payload, "test-passphrase", iterations=1000)
    decrypted = relay_credentials.decrypt_payload(envelope, "test-passphrase")
    redacted = relay_credentials.redacted(decrypted)

    assert envelope["cipher"] == "aes-256-gcm"
    assert "secret-token-value" not in json.dumps(envelope)
    assert decrypted == payload
    assert redacted["git_token"] == "***-value"
    assert redacted["git_username"] == "tester"


def test_relay_credentials_cli_accepts_windows_utf8_bom_input() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        plain_path = Path(temp_dir) / "credentials.local.json"
        enc_path = Path(temp_dir) / "credentials.enc.json"
        plain_path.write_text(
            json.dumps({"git_username": "tester", "git_token": "secret-token-value"}),
            encoding="utf-8-sig",
        )
        passphrase = "test-passphrase"

        payload = json.loads(plain_path.read_text(encoding="utf-8-sig"))
        envelope = relay_credentials.encrypt_payload(payload, passphrase, iterations=1000)
        enc_path.write_text(json.dumps(envelope), encoding="utf-8-sig")
        decrypted = relay_credentials.decrypt_payload(
            json.loads(enc_path.read_text(encoding="utf-8-sig")),
            passphrase,
        )

    assert decrypted["git_username"] == "tester"
    assert decrypted["git_token"] == "secret-token-value"


def test_git_tls_relay_generates_local_certificate_pair() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        cert_path = Path(temp_dir) / "git-relay.local.crt"
        key_path = Path(temp_dir) / "git-relay.local.key"

        git_tls_relay.generate_self_signed_cert(cert_path, key_path)

        cert_text = cert_path.read_text(encoding="utf-8")
        key_text = key_path.read_text(encoding="utf-8")

    assert "BEGIN CERTIFICATE" in cert_text
    assert "BEGIN RSA PRIVATE KEY" in key_text


def test_zotero_relay_skill_and_sync_script_contract() -> None:
    skill_text = (REPO_ROOT / "zotero-relay" / "SKILL.md").read_text(encoding="utf-8")
    sync_script = (REPO_ROOT / "scripts" / "sync-zotero-workspace.ps1").read_text(encoding="utf-8")
    start_script = (REPO_ROOT / "scripts" / "start-git-tls-relay.ps1").read_text(encoding="utf-8")

    assert "https://127.0.0.1:18083/o2/evilread-workspace.git" in skill_text
    assert "https://git.jiashengfan.space/o2/evilread-workspace.git" in skill_text
    assert "Do not assume Cloudflare Access" in skill_text
    assert "[switch]$UseLocalRelay" in sync_script
    assert "http.extraHeader=Authorization: Basic" in sync_script
    assert "http.sslBackend=schannel" in sync_script
    assert "http.sslVerify=false" in sync_script
    assert "http.sslBackend=openssl" in sync_script
    assert "http.sslCAInfo" in sync_script
    assert "Start-Process -WindowStyle Hidden" in start_script


def test_zotero_sync_writes_metadata_and_fallback_bibtex() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        root = Path(temp_dir)
        zotero_repo = root / "evilread-zotero"
        storage = root / "storage"
        translated = root / "translated"
        storage.mkdir()
        translated.mkdir()
        source_storage = storage / "ITEMKEY"
        source_storage.mkdir()
        source_pdf = source_storage / "A BibTeX Paper.pdf"
        source_pdf.write_bytes(b"%PDF-1.4\nraw\n")
        translated_pdf = translated / "A BibTeX Paper.no_watermark.zh-CN.dual.pdf"
        translated_pdf.write_bytes(b"%PDF-1.4\ntranslated\n")
        untranslated_copy = translated / "A BibTeX Paper.pdf"
        untranslated_copy.write_bytes(b"%PDF-1.4\nnot-translated\n")
        item_metadata = {
            "ITEMKEY": {
                "key": "ITEMKEY",
                "data": {
                    "key": "ITEMKEY",
                    "itemType": "journalArticle",
                    "title": "A BibTeX Paper",
                    "DOI": "10.1234/bibtex",
                    "url": "https://example.org/bibtex",
                    "date": "2026",
                    "creators": [
                        {
                            "firstName": "Ada",
                            "lastName": "Lovelace",
                            "creatorType": "author",
                        }
                    ],
                },
            }
        }

        result = zotero_sync.sync_items(
            item_keys=["ITEMKEY"],
            zotero_storage=storage,
            translated_dir=translated,
            bib_export=root / "missing.bib",
            zotero_repo=zotero_repo,
            item_metadata=item_metadata,
        )
        metadata_path = zotero_repo / "library" / "items" / "ITEMKEY.json"
        bib_path = zotero_repo / "library" / "exports" / "library.bib"
        raw_path = zotero_repo / "library" / "items" / "ITEMKEY.pdf"
        translated_path = zotero_repo / "library" / "items" / "ITEMKEY.zh.pdf"
        metadata_text = metadata_path.read_text(encoding="utf-8")
        bib_text = bib_path.read_text(encoding="utf-8")
        raw_exists = raw_path.exists()
        translated_exists = translated_path.exists()

    assert metadata_text
    assert "@article{ITEMKEY" in bib_text
    assert "author = {Lovelace, Ada}" in bib_text
    assert "year = {2026}" in bib_text
    assert "doi = {10.1234/bibtex}" in bib_text
    assert "ITEMKEY: raw pdf" not in result["missing"]
    assert "ITEMKEY: translated pdf" not in result["missing"]
    assert raw_exists
    assert translated_exists

    item_metadata["ITEMKEY"]["data"]["date"] = "17:54:08+00:00"
    bad_date_bib = zotero_sync.bibtex_entry("BADDATE", item_metadata["ITEMKEY"])
    assert "year = {" not in bad_date_bib


def test_zotero_sync_does_not_overwrite_bibtex_with_attachments() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        root = Path(temp_dir)
        zotero_repo = root / "evilread-zotero"
        storage = root / "storage"
        translated = root / "translated"
        export_dir = zotero_repo / "library" / "exports"
        storage.mkdir()
        translated.mkdir()
        export_dir.mkdir(parents=True)
        existing_bib = export_dir / "library.bib"
        existing_bib.write_text("@article{PAPER,\n  title = {Existing Paper},\n}\n", encoding="utf-8")
        item_metadata = {
            "ATTACH": {
                "key": "ATTACH",
                "data": {
                    "key": "ATTACH",
                    "itemType": "attachment",
                    "title": "PDF",
                    "contentType": "application/pdf",
                },
            }
        }

        zotero_sync.sync_items(
            item_keys=["ATTACH"],
            zotero_storage=storage,
            translated_dir=translated,
            bib_export=root / "missing.bib",
            zotero_repo=zotero_repo,
            item_metadata=item_metadata,
        )

        assert existing_bib.read_text(encoding="utf-8") == "@article{PAPER,\n  title = {Existing Paper},\n}\n"


def test_zotero_sync_ignores_plain_pdf_when_matching_translation_by_title() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        root = Path(temp_dir)
        zotero_repo = root / "evilread-zotero"
        storage = root / "storage"
        translated = root / "translated"
        source_storage = storage / "ITEMKEY"
        source_storage.mkdir(parents=True)
        translated.mkdir()
        (source_storage / "Same Title.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (translated / "Same Title.pdf").write_bytes(b"%PDF-1.4\nplain\n")

        result = zotero_sync.sync_items(
            item_keys=["ITEMKEY"],
            zotero_storage=storage,
            translated_dir=translated,
            bib_export=root / "missing.bib",
            zotero_repo=zotero_repo,
            item_metadata={},
        )

    assert "ITEMKEY: translated pdf" in result["missing"]
    assert not (zotero_repo / "library" / "items" / "ITEMKEY.zh.pdf").exists()


class FakeZoteroResponse:
    def __init__(self, payload: object) -> None:
        self.payload = payload

    def __enter__(self) -> "FakeZoteroResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def test_zotero_sync_lists_top_level_regular_items_from_local_api() -> None:
    payload = [
        {"key": "PARENT1", "data": {"key": "PARENT1", "itemType": "journalArticle"}},
        {"key": "ATTACH1", "data": {"key": "ATTACH1", "itemType": "attachment", "parentItem": "PARENT1"}},
        {"key": "PARENT2", "data": {"key": "PARENT2", "itemType": "conferencePaper"}},
    ]

    with patch("urllib.request.urlopen", return_value=FakeZoteroResponse(payload)):
        keys = zotero_sync.fetch_library_item_keys("http://127.0.0.1:23119/api/users/0")

    assert keys == ["PARENT1", "PARENT2"]


def test_zotero_sync_paginates_local_api_item_listing() -> None:
    first_page = [
        {"key": f"PARENT{index}", "data": {"key": f"PARENT{index}", "itemType": "journalArticle"}}
        for index in range(100)
    ]
    second_page = [{"key": "LAST", "data": {"key": "LAST", "itemType": "conferencePaper"}}]

    with patch(
        "urllib.request.urlopen",
        side_effect=[FakeZoteroResponse(first_page), FakeZoteroResponse(second_page)],
    ):
        keys = zotero_sync.fetch_library_item_keys("http://127.0.0.1:23119/api/users/0")

    assert len(keys) == 101
    assert keys[0] == "PARENT0"
    assert keys[-1] == "LAST"


def test_zotero_sync_copies_parent_child_attachment_pdfs() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        root = Path(temp_dir)
        storage = root / "storage"
        zotero_repo = root / "zotero"
        (storage / "RAWATT").mkdir(parents=True)
        (storage / "ZHATT").mkdir(parents=True)
        (storage / "RAWATT" / "Paper.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (storage / "ZHATT" / "Paper.zh.pdf").write_bytes(b"%PDF-1.4\nzh\n")

        raw_source, zh_source = zotero_sync.copy_item_pdfs(
            item_key="PARENT",
            zotero_storage=storage,
            raw_destination=zotero_repo / "library" / "items" / "PARENT.pdf",
            translated_destination=zotero_repo / "library" / "items" / "PARENT.zh.pdf",
            translated_dir=root / "translated",
            child_attachment_keys=["RAWATT", "ZHATT"],
        )
        raw_exists = (zotero_repo / "library" / "items" / "PARENT.pdf").exists()
        translated_exists = (zotero_repo / "library" / "items" / "PARENT.zh.pdf").exists()

    assert raw_source == storage / "RAWATT" / "Paper.pdf"
    assert zh_source == storage / "ZHATT" / "Paper.zh.pdf"
    assert raw_exists
    assert translated_exists


def test_zotero_closure_audit_reports_duplicates_and_missing_attachments() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        items_dir = Path(temp_dir)
        (items_dir / "PARENT1.json").write_text("{}", encoding="utf-8")
        (items_dir / "PARENT1.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (items_dir / "PARENT1.zh.pdf").write_bytes(b"%PDF-1.4\nzh\n")
        (items_dir / "MIRRORONLY.json").write_text("{}", encoding="utf-8")
        items = [
            {
                "key": "PARENT1",
                "data": {
                    "key": "PARENT1",
                    "itemType": "journalArticle",
                    "title": "Repeated Paper",
                },
            },
            {
                "key": "PARENT2",
                "data": {
                    "key": "PARENT2",
                    "itemType": "journalArticle",
                    "title": "Repeated   Paper",
                },
            },
            {
                "key": "RAWATT",
                "data": {
                    "key": "RAWATT",
                    "itemType": "attachment",
                    "parentItem": "PARENT1",
                    "title": "EvilRead Original PDF",
                },
            },
        ]
        collections = [
            {"key": "ROOT", "data": {"key": "ROOT", "name": "Confirmed"}},
            {
                "key": "DATE",
                "data": {"key": "DATE", "name": "2026-06-25", "parentCollection": "ROOT"},
            },
        ]

        result = zotero_closure_audit.audit(items, collections, items_dir)

    assert result["zotero_parent_items"] == 2
    assert result["mirror_json_not_in_zotero_parent"] == ["MIRRORONLY"]
    assert result["zotero_parent_missing_mirror_json"] == ["PARENT2"]
    assert result["missing_original_attachment_for_mirrored_pdf"] == []
    assert result["missing_translated_attachment_for_mirrored_pdf"] == ["PARENT1"]
    assert ["PARENT1", "PARENT2"] in result["duplicate_title_groups"].values()
    assert result["dated_collections"] == ["Confirmed/2026-06-25"]


def test_zotero_runjs_dedupe_plans_canonical_and_trash_duplicates() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        items_dir = Path(temp_dir)
        (items_dir / "DUP1.pdf").write_bytes(b"%PDF-1.4\nraw\n")
        (items_dir / "DUP1.zh.pdf").write_bytes(b"%PDF-1.4\nzh\n")
        items = [
            {
                "key": "CANON",
                "data": {
                    "key": "CANON",
                    "itemType": "journalArticle",
                    "title": "Repeated Paper",
                    "DOI": "10.1234/canon",
                    "url": "https://example.org/canon",
                },
            },
            {
                "key": "DUP1",
                "data": {
                    "key": "DUP1",
                    "itemType": "journalArticle",
                    "title": "Repeated   Paper",
                    "url": "https://example.org/canon",
                    "collections": ["COLL"],
                },
            },
            {
                "key": "SINGLE",
                "data": {
                    "key": "SINGLE",
                    "itemType": "journalArticle",
                    "title": "Unique Paper",
                },
            },
        ]

        plan = zotero_runjs_dedupe.make_dedupe_plan(items, items_dir)
        script = zotero_runjs_dedupe.build_dedupe_script(plan)

    assert len(plan) == 1
    assert plan[0]["canonical"] == "CANON"
    assert plan[0]["duplicates"] == ["DUP1"]
    assert plan[0]["ensureAttachments"][0]["sourceKey"] == "DUP1"
    assert "evilread:duplicate-of:" in script
    assert "trashTx" in script


def main() -> int:
    tests = [
        test_safety_scan_rejects_secret_text,
        test_reflect_updates_preferences_and_writes_diff,
        test_reflect_blocks_raw_interest_config_without_agent_analysis,
        test_zotero_ingest_marks_needs_pdf_when_attachment_fails,
        test_zotero_ingest_mirror_uses_monorepo_relative_artifact_links,
        test_connector_ingest_reuses_existing_item_before_saveitems,
        test_zotero_runjs_collection_script_is_idempotent_and_reports_missing,
        test_collections_import_script_reuses_existing_sha_item,
        test_zotero_runjs_attachment_script_imports_stored_pdfs,
        test_daily_note_contains_loop_sections_and_empty_comment_template,
        test_daily_note_uses_monorepo_relative_pdf_links,
        test_translated_pdf_packager_creates_incremental_zip_and_manifest,
        test_translated_pdf_packager_skips_unchanged_files_without_empty_zip,
        test_translated_pdf_packager_repackages_changed_file,
        test_translated_pdf_packager_uses_key_when_metadata_is_missing,
        test_daily_note_includes_translated_pdf_package_link,
        test_daily_note_zotero_status_filters_global_missing_backlog,
        test_daily_note_links_json_metadata_and_research_note_when_available,
        test_daily_note_contains_paper_insights_and_reading_suggestions,
        test_daily_note_can_use_llm_insight_client_without_losing_links,
        test_collections_import_archives_success_and_writes_logs,
        test_collections_import_archives_failed_pdf,
        test_collections_import_keeps_pending_verification_pdf_in_place,
        test_collections_import_keeps_pdf_pending_when_runjs_window_missing,
        test_collections_import_refreshes_translation_for_already_imported_pdf,
        test_collection_translation_downloads_filelist_output_when_not_on_disk,
        test_zotero_markdown_index_links_artifacts_and_research_notes,
        test_research_index_creates_note_without_placeholder_text,
        test_research_index_enriches_collection_pdf_before_note_generation,
        test_research_index_marks_collection_missing_translation_incomplete,
        test_research_index_requires_agent_read_markdown_for_production,
        test_research_index_does_not_require_agent_read_markdown_for_unselected_history,
        test_research_index_writes_agent_read_markdown_with_frontmatter,
        test_research_index_adds_alias_for_duplicate_zotero_parent_key,
        test_reflect_parses_freeform_questions_and_requests,
        test_comment_tasks_answers_questions_and_records_requests,
        test_cat_email_sends_markdown_file_verbatim,
        test_cat_mailer_supports_cf_relay_resend_and_smtp_without_leaking_secrets,
        test_cat_mailer_rewrites_workspace_links_to_code_server,
        test_cat_mailer_reads_user_scope_environment_when_process_env_missing,
        test_daily_report_contains_closed_loop_sections_and_email_status,
        test_collections_imported_items_receive_daily_recommendation_analysis,
        test_collection_research_updates_receive_daily_recommendation_analysis,
        test_daily_note_uses_research_digest_for_production_summary,
        test_daily_note_research_digest_matches_zotero_key_aliases,
        test_orchestrator_commits_dirty_workspace_before_pull_with_explicit_paths,
        test_orchestrator_email_preflight_fails_on_missing_env_without_secret_values,
        test_orchestrator_git_rebase_failure_main_suppresses_failure_email,
        test_orchestrator_non_git_failure_main_keeps_failure_email,
        test_orchestrator_main_closes_chrome_after_success_and_failure,
        test_orchestrator_git_push_failure_aborts_before_daily_email,
        test_orchestrator_auto_starts_zotero_when_local_api_is_down,
        test_orchestrator_reports_zotero_diagnostics_when_auto_start_fails,
        test_orchestrator_retries_zotero_probe_before_declaring_available,
        test_orchestrator_failure_notice_uses_mailer_without_secrets,
        test_reflect_parses_pending_comments_as_requests,
        test_orchestrator_blocks_daily_email_when_agent_decisions_are_missing,
        test_orchestrator_uses_agent_analyzed_preferences_for_reflection,
        test_orchestrator_reconciles_zotero_collections_and_attachments,
        test_daily_report_humanizes_daily_sections_without_changing_research_notes,
        test_start_my_day_daily_syncs_zotero_before_note_generation,
        test_task_scheduler_start_my_day_wrapper_contract,
        test_relay_credentials_encrypt_decrypt_and_redact_secret_fields,
        test_relay_credentials_cli_accepts_windows_utf8_bom_input,
        test_git_tls_relay_generates_local_certificate_pair,
        test_zotero_relay_skill_and_sync_script_contract,
        test_zotero_sync_writes_metadata_and_fallback_bibtex,
        test_zotero_sync_does_not_overwrite_bibtex_with_attachments,
        test_zotero_sync_ignores_plain_pdf_when_matching_translation_by_title,
        test_zotero_sync_lists_top_level_regular_items_from_local_api,
        test_zotero_sync_paginates_local_api_item_listing,
        test_zotero_sync_copies_parent_child_attachment_pdfs,
        test_zotero_closure_audit_reports_duplicates_and_missing_attachments,
        test_zotero_runjs_dedupe_plans_canonical_and_trash_duplicates,
    ]
    for test in tests:
        test()
        print(f"[OK] {test.__name__}")
    print("[OK] loop smoke checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
