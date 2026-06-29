#!/usr/bin/env python3
"""Generate or execute Zotero Run JavaScript for native daily collections."""

from __future__ import annotations

import argparse
import ctypes
from datetime import date
import json
from pathlib import Path
import re
import time
from typing import Any


def js_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def js_array(values: list[str]) -> str:
    return json.dumps(values, ensure_ascii=False)


def load_keys(path: Path) -> list[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"{path} must contain an ingest result list")
    keys: list[str] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        key = str(item.get("zotero_key") or "").strip()
        if key:
            keys.append(key)
    return keys


def parse_keys(raw: str) -> list[str]:
    if not raw.strip():
        return []
    return [part.strip() for part in re.split(r"[,;\s]+", raw) if part.strip()]


def build_collection_script(
    confirmed_keys: list[str],
    exploration_keys: list[str],
    run_date: str,
    confirmed_label: str = "Confirmed",
    exploration_label: str = "Exploration",
) -> str:
    return f"""const libraryID = Zotero.Libraries.userLibraryID;
const confirmedKeys = {js_array(confirmed_keys)};
const explorationKeys = {js_array(exploration_keys)};
const runDate = {js_string(run_date)};
const confirmedLabel = {js_string(confirmed_label)};
const explorationLabel = {js_string(exploration_label)};

function existingChild(name, parentID) {{
  const collections = Zotero.Collections.getByLibrary(libraryID) || [];
  for (const collection of collections) {{
    const sameParent = (collection.parentID || false) === (parentID || false);
    if (collection.name === name && sameParent) return collection;
  }}
  return null;
}}

async function ensureChild(name, parentID) {{
  let collection = existingChild(name, parentID);
  if (collection) return collection;
  collection = new Zotero.Collection();
  collection.libraryID = libraryID;
  collection.name = name;
  if (parentID) collection.parentID = parentID;
  await collection.saveTx();
  return collection;
}}

async function addKeys(collection, keys) {{
  const added = [];
  const missing = [];
  for (const key of keys) {{
    const item = Zotero.Items.getByLibraryAndKey(libraryID, key);
    if (!item) {{
      missing.push(key);
      continue;
    }}
    if (typeof item.getCollections === "function" && typeof item.setCollections === "function") {{
      const collections = item.getCollections();
      if (!collections.includes(collection.id)) {{
        item.setCollections([...collections, collection.id]);
        await item.saveTx();
      }}
    }} else if (typeof item.addToCollection === "function") {{
      item.addToCollection(collection.id);
      await item.saveTx();
    }} else if (typeof collection.addItem === "function") {{
      collection.addItem(item.id);
      await collection.saveTx();
    }} else {{
      throw new Error("No supported collection add method for item " + key);
    }}
    added.push(key);
  }}
  return {{ added, missing }};
}}

const confirmedRoot = await ensureChild(confirmedLabel, false);
const confirmed = await ensureChild(runDate, confirmedRoot.id);
const explorationRoot = await ensureChild(explorationLabel, false);
const exploration = await ensureChild(runDate, explorationRoot.id);
const confirmedResult = await addKeys(confirmed, confirmedKeys);
const explorationResult = await addKeys(exploration, explorationKeys);
return JSON.stringify({{
  confirmed: confirmed.key,
  exploration: exploration.key,
  confirmedAdded: confirmedResult.added,
  confirmedMissing: confirmedResult.missing,
  explorationAdded: explorationResult.added,
  explorationMissing: explorationResult.missing
}});
"""


def set_windows_clipboard_text(text: str) -> None:
    CF_UNICODETEXT = 13
    GMEM_MOVEABLE = 0x0002
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    kernel32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]
    kernel32.GlobalAlloc.restype = ctypes.c_void_p
    kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalUnlock.restype = ctypes.c_bool
    user32.SetClipboardData.argtypes = [ctypes.c_uint, ctypes.c_void_p]
    user32.SetClipboardData.restype = ctypes.c_void_p
    if not user32.OpenClipboard(None):
        raise ctypes.WinError()
    try:
        user32.EmptyClipboard()
        data = text.encode("utf-16le") + b"\x00\x00"
        handle = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(data))
        if not handle:
            raise ctypes.WinError()
        locked = kernel32.GlobalLock(handle)
        if not locked:
            raise ctypes.WinError()
        ctypes.memmove(locked, data, len(data))
        kernel32.GlobalUnlock(handle)
        if not user32.SetClipboardData(CF_UNICODETEXT, handle):
            raise ctypes.WinError()
    finally:
        user32.CloseClipboard()


def find_runjs_window(desktop: Any, title_re: str, timeout_seconds: float = 0.0) -> Any | None:
    end = time.time() + timeout_seconds
    while True:
        for window in reversed(desktop.windows(title_re=title_re)):
            if "JavaScript" in window.window_text() or re.search(title_re, window.window_text()):
                return window
        if time.time() >= end:
            return None
        time.sleep(0.25)


def open_runjs_window() -> bool:
    try:
        from pywinauto import Application, Desktop, mouse
    except ImportError as exc:
        raise RuntimeError("pywinauto is required for --execute") from exc

    desktop = Desktop(backend="uia")
    zotero_windows = [window for window in desktop.windows() if "Zotero" in window.window_text()]
    if not zotero_windows:
        return False
    zotero = zotero_windows[0]
    app = Application(backend="uia").connect(handle=zotero.handle)
    window = app.window(handle=zotero.handle)
    window.set_focus()
    time.sleep(0.2)
    tools_menu = window.child_window(auto_id="toolsMenu", control_type="MenuItem")
    if not tools_menu.exists(timeout=3):
        return False
    tools_menu.click_input()
    time.sleep(0.2)
    # Zotero native menu popups are not exposed as descendants. The row offsets are
    # stable relative to the Tools menu on Windows Zotero 7.
    menu_rect = tools_menu.rectangle()
    developer_x = menu_rect.right + 26
    developer_y = menu_rect.bottom + 176
    runjs_x = menu_rect.right + 205
    runjs_y = menu_rect.bottom + 219
    mouse.click(button="left", coords=(developer_x, developer_y))
    time.sleep(0.4)
    mouse.click(button="left", coords=(runjs_x, runjs_y))
    time.sleep(1.0)
    return find_runjs_window(desktop, ".*JavaScript.*", timeout_seconds=3) is not None


def execute_in_runjs_window(script: str, title_re: str, wait_seconds: float) -> None:
    try:
        from pywinauto import Desktop, keyboard
    except ImportError as exc:
        raise RuntimeError("pywinauto is required for --execute") from exc

    desktop = Desktop(backend="uia")
    window = find_runjs_window(desktop, title_re, timeout_seconds=1)
    if window is None and open_runjs_window():
        window = find_runjs_window(desktop, title_re, timeout_seconds=3)
    if window is None:
        raise RuntimeError("Run JavaScript editor was not found")
    window.set_focus()
    editor_panes = [
        pane
        for pane in window.descendants(control_type="Pane")
        if getattr(pane.element_info, "automation_id", "") == "editor-code"
    ]
    if not editor_panes:
        raise RuntimeError("Run JavaScript code editor was not found")
    editor_panes[0].click_input()
    time.sleep(0.1)
    set_windows_clipboard_text(script)
    keyboard.send_keys("^a")
    time.sleep(0.1)
    keyboard.send_keys("^v")
    time.sleep(0.2)

    checkboxes = [
        checkbox
        for checkbox in window.descendants(control_type="CheckBox")
        if getattr(checkbox.element_info, "automation_id", "") == "run-as-async"
    ]
    if checkboxes and checkboxes[0].get_toggle_state() == 0:
        checkboxes[0].invoke()

    run_buttons = [
        button
        for button in window.descendants(control_type="Button")
        if button.window_text() in {"执行", "Run"}
    ]
    if not run_buttons:
        raise RuntimeError("Run button was not found")
    run_buttons[0].invoke()
    time.sleep(wait_seconds)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create native Zotero Confirmed/Exploration daily collections via Run JavaScript"
    )
    parser.add_argument("--confirmed-result", help="JSON output from zotero_ingest.py --mode confirmed")
    parser.add_argument("--exploration-result", help="JSON output from zotero_ingest.py --mode exploration")
    parser.add_argument("--confirmed-keys", default="", help="Comma/space separated Zotero item keys")
    parser.add_argument("--exploration-keys", default="", help="Comma/space separated Zotero item keys")
    parser.add_argument("--date", default=date.today().isoformat(), help="Collection date")
    parser.add_argument("--output-js", default="", help="Write generated JavaScript to this path")
    parser.add_argument("--execute", action="store_true", help="Paste and run in Zotero's Run JavaScript window")
    parser.add_argument("--title-re", default=".*JavaScript.*", help="Run JavaScript window title regex")
    parser.add_argument("--wait-seconds", type=float, default=8.0)
    args = parser.parse_args()

    confirmed_keys = parse_keys(args.confirmed_keys)
    exploration_keys = parse_keys(args.exploration_keys)
    if args.confirmed_result:
        confirmed_keys.extend(load_keys(Path(args.confirmed_result)))
    if args.exploration_result:
        exploration_keys.extend(load_keys(Path(args.exploration_result)))
    if not confirmed_keys and not exploration_keys:
        raise SystemExit("no Zotero item keys were provided")

    script = build_collection_script(
        confirmed_keys=confirmed_keys,
        exploration_keys=exploration_keys,
        run_date=args.date,
    )
    if args.output_js:
        Path(args.output_js).write_text(script, encoding="utf-8")
    else:
        print(script)
    if args.execute:
        execute_in_runjs_window(script, args.title_re, args.wait_seconds)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
