#!/usr/bin/env python3
"""Ensure collection PDFs have translated PDF artifacts in the workspace mirror."""

from __future__ import annotations

import base64
import json
from pathlib import Path
import shutil
import sys
import textwrap
import urllib.error
import urllib.request
import urllib.parse
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from zotero_sync import copy_matching_translation, translation_candidates


DEFAULT_TRANSLATED_DIR = Path.home() / "AppData" / "Roaming" / "CodexZoteroPDF2zh" / "server" / "translated"
DEFAULT_SERVER_URL = "http://127.0.0.1:8890"


def _post_json(url: str, payload: dict[str, Any], timeout: int) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        text = response.read().decode("utf-8")
    return json.loads(text) if text else {}


def _get_json(url: str, timeout: int = 5) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        text = response.read().decode("utf-8")
    return json.loads(text) if text else {}


def _download_file(url: str, destination: Path, timeout: int) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            content_type = str(response.headers.get("Content-Type") or "").lower()
            data = response.read()
    except (OSError, urllib.error.URLError, TimeoutError):
        return False
    if not data.startswith(b"%PDF") and "pdf" not in content_type:
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return destination.exists() and destination.stat().st_size > 0


def pdf2zh_available(server_url: str = DEFAULT_SERVER_URL) -> bool:
    try:
        payload = _get_json(f"{server_url.rstrip('/')}/health", timeout=5)
    except (OSError, urllib.error.URLError, TimeoutError):
        return False
    return payload.get("status") == "ok"


def choose_generated_file(file_list: list[str], translated_dir: Path, item_key: str = "") -> Path | None:
    candidates: list[Path] = []
    for name in file_list:
        path = translated_dir / name
        if path.exists() and path.suffix.lower() == ".pdf":
            candidates.append(path)
    if item_key:
        candidates.extend(
            path
            for path in translated_dir.glob(f"{item_key}*.pdf")
            if path.exists() and path.suffix.lower() == ".pdf" and path not in candidates
        )
    if not candidates:
        return None
    return sorted(
        candidates,
        key=lambda path: (0 if "dual" in path.name.lower() else 1, -path.stat().st_mtime, path.name.lower()),
    )[0]


def snapshot_pdfs(translated_dir: Path) -> set[Path]:
    if not translated_dir.exists():
        return set()
    return {path.resolve() for path in translated_dir.glob("*.pdf") if not path.name.startswith("._")}


def choose_new_generated_file(before: set[Path], translated_dir: Path, item_key: str) -> Path | None:
    after = snapshot_pdfs(translated_dir)
    created = [path for path in after - before if path.exists()]
    keyed = [path for path in created if path.name.startswith(item_key)]
    candidates = keyed or created
    if not candidates:
        return None
    return sorted(
        candidates,
        key=lambda path: (0 if "dual" in path.name.lower() else 1, -path.stat().st_mtime, path.name.lower()),
    )[0]


def request_pdf2zh_translation(
    source_pdf: Path,
    item_key: str,
    *,
    server_url: str = DEFAULT_SERVER_URL,
    translated_dir: Path = DEFAULT_TRANSLATED_DIR,
    timeout_seconds: int = 1800,
) -> Path | None:
    if not pdf2zh_available(server_url):
        return None
    file_name = f"{item_key}.pdf"
    before = snapshot_pdfs(translated_dir)
    payload = {
        "fileName": file_name,
        "fileContent": "data:application/pdf;base64," + base64.b64encode(source_pdf.read_bytes()).decode("ascii"),
        "engine": "pdf2zh_next",
        "sourceLang": "en",
        "targetLang": "zh-CN",
        "mono": False,
        "dual": True,
        "noMono": True,
        "noDual": False,
        "noWatermark": True,
    }
    try:
        response = _post_json(f"{server_url.rstrip('/')}/translate", payload, timeout=timeout_seconds)
    except (OSError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None
    if response.get("status") != "success":
        return None
    file_list = [str(name) for name in response.get("fileList", []) if str(name).strip()]
    generated = choose_generated_file(file_list, translated_dir, item_key) or choose_new_generated_file(before, translated_dir, item_key)
    if generated:
        return generated
    for file_name in sorted(file_list, key=lambda name: (0 if "dual" in name.lower() else 1, name.lower())):
        if not file_name.lower().endswith(".pdf"):
            continue
        cached = translated_dir / file_name
        if download_pdf2zh_output(file_name, cached, server_url=server_url, timeout_seconds=min(timeout_seconds, 300)):
            return cached
    return None


def download_pdf2zh_output(
    file_name: str,
    destination: Path,
    *,
    server_url: str = DEFAULT_SERVER_URL,
    timeout_seconds: int = 300,
) -> bool:
    quoted = urllib.parse.quote(file_name)
    return _download_file(f"{server_url.rstrip('/')}/translatedFile/{quoted}", destination, timeout_seconds)


def extracted_text_preview(source_pdf: Path, limit: int = 6000) -> str:
    try:
        import fitz
    except ImportError:
        return ""
    try:
        with fitz.open(source_pdf) as document:
            chunks: list[str] = []
            for page in document:
                chunks.append(page.get_text("text"))
                if sum(len(chunk) for chunk in chunks) >= limit:
                    break
    except Exception:
        return ""
    return "\n".join(chunks).strip()[:limit]


def cjk_font_name() -> str:
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except ImportError:
        return "Helvetica"
    for font_path in (Path(r"C:\Windows\Fonts\msyh.ttc"), Path(r"C:\Windows\Fonts\simsun.ttc")):
        if font_path.exists():
            try:
                pdfmetrics.registerFont(TTFont("EvilReadCJK", str(font_path)))
                return "EvilReadCJK"
            except Exception:
                continue
    return "Helvetica"


def write_fallback_translation_pdf(source_pdf: Path, item_key: str, destination: Path) -> bool:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError:
        return False
    preview = extracted_text_preview(source_pdf)
    if not preview:
        preview = "PDF text extraction did not return readable text."
    destination.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(destination), pagesize=A4)
    width, height = A4
    font_name = cjk_font_name()
    x = 48
    y = height - 54
    line_height = 15
    lines = [
        "EvilRead 中文 PDF fallback",
        "",
        f"Zotero key: {item_key}",
        f"Source PDF: {source_pdf.name}",
        "",
        "说明：自动 PDF2ZH 翻译服务未能处理该 PDF。此文件用于生产流程闭环和增量包审计，",
        "不代表完整机器翻译；下方附源 PDF 可抽取文本预览，方便后续人工处理。",
        "",
        "Extracted source text preview:",
        "",
    ]
    for paragraph in preview.splitlines():
        wrapped = textwrap.wrap(paragraph, width=88) or [""]
        lines.extend(wrapped)
    for line in lines:
        if y < 48:
            pdf.showPage()
            y = height - 54
        pdf.setFont(font_name, 10 if line else 8)
        pdf.drawString(x, y, line[:180])
        y -= line_height
    pdf.save()
    return destination.exists() and destination.stat().st_size > 0


def ensure_translated_pdf(
    source_pdf: Path,
    item_key: str,
    destination: Path,
    *,
    translated_dir: Path = DEFAULT_TRANSLATED_DIR,
    server_url: str = DEFAULT_SERVER_URL,
    timeout_seconds: int = 1800,
) -> dict[str, str]:
    if destination.exists() and destination.stat().st_size > 0:
        return {"status": "exists", "path": str(destination)}
    if copy_matching_translation(translated_dir, item_key, destination, source_pdf):
        return {"status": "copied", "path": str(destination)}
    generated = request_pdf2zh_translation(
        source_pdf,
        item_key,
        server_url=server_url,
        translated_dir=translated_dir,
        timeout_seconds=timeout_seconds,
    )
    if generated and generated.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(generated, destination)
        return {"status": "generated", "path": str(destination), "source": str(generated)}
    # Some Zotero PDF2zh builds return generated file names through /translate but
    # serve them from /translatedFile without leaving them in the configured
    # translated directory visible to this process.
    payload = {
        "fileName": f"{item_key}.pdf",
        "fileContent": "data:application/pdf;base64," + base64.b64encode(source_pdf.read_bytes()).decode("ascii"),
        "engine": "pdf2zh_next",
        "sourceLang": "en",
        "targetLang": "zh-CN",
        "mono": False,
        "dual": True,
        "noMono": True,
        "noDual": False,
        "noWatermark": True,
    }
    try:
        response = _post_json(f"{server_url.rstrip('/')}/translate", payload, timeout=timeout_seconds)
    except (OSError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        response = {}
    if response.get("status") == "success":
        file_list = [str(name) for name in response.get("fileList", []) if str(name).strip()]
        preferred = sorted(file_list, key=lambda name: (0 if "dual" in name.lower() else 1, name.lower()))
        for file_name in preferred:
            if file_name.lower().endswith(".pdf") and download_pdf2zh_output(
                file_name,
                destination,
                server_url=server_url,
                timeout_seconds=min(timeout_seconds, 300),
            ):
                return {"status": "generated", "path": str(destination), "source": f"{server_url.rstrip('/')}/translatedFile/{file_name}"}
    matches = translation_candidates(translated_dir, item_key, source_pdf)
    if matches:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(matches[0], destination)
        return {"status": "copied", "path": str(destination), "source": str(matches[0])}
    if write_fallback_translation_pdf(source_pdf, item_key, destination):
        return {"status": "fallback", "path": str(destination), "source": str(source_pdf)}
    return {"status": "missing", "path": str(destination)}
