#!/usr/bin/env python3
"""Generate or execute Zotero Run JavaScript for stored PDF attachments."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from zotero_runjs_collections import execute_in_runjs_window


def load_items_from_mirror(items_dir: Path, keys: list[str]) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for key in keys:
        original = items_dir / f"{key}.pdf"
        translated = items_dir / f"{key}.zh.pdf"
        items.append(
            {
                "key": key,
                "original": str(original) if original.exists() else "",
                "translated": str(translated) if translated.exists() else "",
            }
        )
    return items


def build_attachment_script(items: list[dict[str, str]]) -> str:
    encoded_items = json.dumps(items, ensure_ascii=False)
    return f"""const libraryID = Zotero.Libraries.userLibraryID;
const attachmentRequests = {encoded_items};

async function fileExists(path) {{
  if (!path) return false;
  if (typeof IOUtils !== "undefined" && typeof IOUtils.exists === "function") {{
    return await IOUtils.exists(path);
  }}
  if (typeof OS !== "undefined" && OS.File && typeof OS.File.exists === "function") {{
    return await OS.File.exists(path);
  }}
  return false;
}}

function existingAttachment(parentItem, title) {{
  if (typeof parentItem.getAttachments !== "function") return null;
  const attachmentIDs = parentItem.getAttachments();
  for (const attachmentID of attachmentIDs) {{
    const attachment = Zotero.Items.get(attachmentID);
    if (attachment && attachment.getField("title") === title) {{
      return attachment;
    }}
  }}
  return null;
}}

async function ensureStoredPdf(parentItem, filePath, title, fileBaseName) {{
  if (!filePath) {{
    return {{ status: "missing-path", title }};
  }}
  if (!(await fileExists(filePath))) {{
    return {{ status: "missing-file", title, filePath }};
  }}
  const existing = existingAttachment(parentItem, title);
  if (existing) {{
    return {{ status: "existing", title, key: existing.key }};
  }}
  const attachment = await Zotero.Attachments.importFromFile({{
    file: filePath,
    parentItemID: parentItem.id,
    title,
    fileBaseName,
    contentType: "application/pdf",
  }});
  return {{ status: "created", title, key: attachment.key }};
}}

const results = [];
for (const request of attachmentRequests) {{
  const parentItem = Zotero.Items.getByLibraryAndKey(libraryID, request.key);
  if (!parentItem) {{
    results.push({{ key: request.key, status: "missing-item" }});
    continue;
  }}
  const original = await ensureStoredPdf(
    parentItem,
    request.original,
    "EvilRead Original PDF",
    request.key
  );
  const translated = await ensureStoredPdf(
    parentItem,
    request.translated,
    "EvilRead Translated PDF",
    request.key + ".zh"
  );
  results.push({{ key: request.key, original, translated }});
}}
return JSON.stringify(results);
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Attach mirrored PDFs to Zotero items through Run JavaScript")
    parser.add_argument("--items-dir", required=True, help="Directory containing <key>.pdf and <key>.zh.pdf")
    parser.add_argument("--keys", required=True, help="Comma-separated Zotero item keys")
    parser.add_argument("--output-js", default="", help="Write generated JavaScript to this path")
    parser.add_argument("--execute", action="store_true", help="Paste and run in Zotero's Run JavaScript window")
    parser.add_argument("--title-re", default=".*JavaScript.*", help="Run JavaScript window title regex")
    parser.add_argument("--wait-seconds", type=float, default=15.0)
    args = parser.parse_args()

    keys = [key.strip() for key in args.keys.split(",") if key.strip()]
    if not keys:
        raise SystemExit("no Zotero item keys were provided")
    items = load_items_from_mirror(Path(args.items_dir), keys)
    script = build_attachment_script(items)
    if args.output_js:
        Path(args.output_js).write_text(script, encoding="utf-8")
    else:
        print(script)
    if args.execute:
        execute_in_runjs_window(script, args.title_re, args.wait_seconds)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
