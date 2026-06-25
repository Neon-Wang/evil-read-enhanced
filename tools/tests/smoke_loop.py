#!/usr/bin/env python3
"""Offline smoke checks for the Zotero/Obsidian loop tools."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[2]
TOOLS_DIR = REPO_ROOT / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import safety_scan
import start_my_day_reflect
import start_my_day_daily
import zotero_runjs_attachments
import zotero_runjs_collections
import zotero_ingest
import zotero_sync


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
        )

        updated_config = config_path.read_text(encoding="utf-8")
        diff_text = (vault_root / "99_System" / "preference_diffs" / "2026-06-26.diff").read_text(encoding="utf-8")
        questions_text = (vault_root / "99_System" / "Indexes" / "open_questions.md").read_text(encoding="utf-8")

    assert summary["interests"] == ["spiking networks"]
    assert "spiking networks" in updated_config
    assert "medical imaging" in updated_config
    assert "random matrix theory" in summary["deepen"]
    assert "+interest: spiking networks" in diff_text
    assert "how does noise shape calibration?" in questions_text


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
                    "（由 /start-my-day 自动填）",
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

    assert "## Confirmed" in note_text
    assert "## Exploration" in note_text
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


def main() -> int:
    tests = [
        test_safety_scan_rejects_secret_text,
        test_reflect_updates_preferences_and_writes_diff,
        test_zotero_ingest_marks_needs_pdf_when_attachment_fails,
        test_zotero_ingest_mirror_uses_monorepo_relative_artifact_links,
        test_zotero_runjs_collection_script_is_idempotent_and_reports_missing,
        test_zotero_runjs_attachment_script_imports_stored_pdfs,
        test_daily_note_contains_loop_sections_and_empty_comment_template,
        test_daily_note_uses_monorepo_relative_pdf_links,
        test_zotero_sync_writes_metadata_and_fallback_bibtex,
        test_zotero_sync_does_not_overwrite_bibtex_with_attachments,
        test_zotero_sync_ignores_plain_pdf_when_matching_translation_by_title,
    ]
    for test in tests:
        test()
        print(f"[OK] {test.__name__}")
    print("[OK] loop smoke checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
