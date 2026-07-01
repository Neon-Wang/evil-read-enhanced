#!/usr/bin/env python3
"""Audit the local Zotero plugin environment for EvilRead."""

from __future__ import annotations

import argparse
import configparser
import json
import os
from pathlib import Path
from typing import Any


EXPECTED_PLUGINS = [
    {
        "id": "zoteroif@qnscholar",
        "name": "Zotero IF",
        "version": "1.6.0",
        "required": False,
        "purpose": "journal impact factor context",
    },
    {
        "id": "jasminum@linxzh.com",
        "name": "Jasminum",
        "version": "1.1.37",
        "required": True,
        "purpose": "Chinese metadata translators and lookup",
    },
    {
        "id": "tara@linxzh.com",
        "name": "Tara",
        "version": "1.0.11",
        "required": False,
        "purpose": "portable Zotero settings backup",
    },
    {
        "id": "zoplicate@chenglongma.com",
        "name": "Zoplicate",
        "version": "5.0.8",
        "required": True,
        "purpose": "duplicate detection support",
    },
    {
        "id": "zoteropdftranslate@euclpts.com",
        "name": "Translate for Zotero",
        "version": "2.4.5",
        "required": True,
        "purpose": "PDF/selection translation workflow",
    },
    {
        "id": "zoteroattanger@polygon.org",
        "name": "Zotero Attanger",
        "version": "1.4.7",
        "required": True,
        "purpose": "attachment management",
    },
    {
        "id": "Knowledge4Zotero@windingwind.com",
        "name": "Better Notes",
        "version": "3.2.2",
        "required": True,
        "purpose": "structured notes and paper reading workspace",
    },
    {
        "id": "zoterostyle@polygon.org",
        "name": "Ethereal Style",
        "version": "6.0.8",
        "required": False,
        "purpose": "library table styling and visual fields",
    },
    {
        "id": "zoterotag@euclpts.com",
        "name": "Actions and Tags",
        "version": "2.5.2",
        "required": True,
        "purpose": "automation actions used by import/reconciliation routines",
    },
    {
        "id": "zotero-format-metadata@northword.cn",
        "name": "Linter for Zotero",
        "version": "3.3.0",
        "required": True,
        "purpose": "metadata normalization",
    },
    {
        "id": "pdf2zh@guaguastandup.com",
        "name": "Zotero PDF2zh",
        "version": "4.0.3",
        "required": True,
        "purpose": "Chinese translated PDF generation",
    },
    {
        "id": "zoteroreference@polygon.org",
        "name": "Ethereal Reference",
        "version": "1.7.5",
        "required": False,
        "purpose": "reference panel support",
    },
]


def default_zotero_root() -> Path:
    appdata = os.environ.get("APPDATA")
    if appdata:
        return Path(appdata) / "Zotero" / "Zotero"
    return Path.home() / "AppData" / "Roaming" / "Zotero" / "Zotero"


def discover_profile(zotero_root: Path | None = None) -> Path | None:
    root = zotero_root or default_zotero_root()
    profiles_ini = root / "profiles.ini"
    if profiles_ini.exists():
        parser = configparser.ConfigParser()
        parser.read(profiles_ini, encoding="utf-8")
        fallback: Path | None = None
        for section in parser.sections():
            if not section.startswith("Profile"):
                continue
            rel_path = parser.get(section, "Path", fallback="")
            if not rel_path:
                continue
            is_relative = parser.getint(section, "IsRelative", fallback=1)
            profile = root / rel_path if is_relative else Path(rel_path)
            if parser.getint(section, "Default", fallback=0) == 1:
                return profile
            fallback = fallback or profile
        if fallback:
            return fallback

    profiles_dir = root / "Profiles"
    if not profiles_dir.exists():
        return None
    candidates = sorted(profiles_dir.glob("*.default"), key=lambda path: path.stat().st_mtime, reverse=True)
    return candidates[0] if candidates else None


def load_active_addons(profile_dir: Path) -> list[dict[str, Any]]:
    extensions_path = profile_dir / "extensions.json"
    if not extensions_path.exists():
        return []
    try:
        payload = json.loads(extensions_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError:
        return []
    addons = payload.get("addons", [])
    return addons if isinstance(addons, list) else []


def addon_id(addon: dict[str, Any]) -> str:
    for key in ("id", "defaultLocale", "manifest"):
        value = addon.get(key)
        if isinstance(value, str):
            return value
        if isinstance(value, dict) and isinstance(value.get("id"), str):
            return value["id"]
    return ""


def list_plugin_xpis(plugin_source: Path | None) -> list[str]:
    if not plugin_source or not plugin_source.exists():
        return []
    return sorted(path.name for path in plugin_source.glob("*.xpi") if not path.name.startswith("._"))


def audit_environment(profile_dir: Path | None, plugin_source: Path | None = None) -> dict[str, Any]:
    profile = profile_dir or discover_profile()
    addons = load_active_addons(profile) if profile else []
    active_ids = sorted({addon_id(addon) for addon in addons if addon_id(addon)})
    active_set = set(active_ids)
    expected_ids = [plugin["id"] for plugin in EXPECTED_PLUGINS]
    missing_required = [
        plugin["id"] for plugin in EXPECTED_PLUGINS if plugin["required"] and plugin["id"] not in active_set
    ]
    missing_optional = [
        plugin["id"] for plugin in EXPECTED_PLUGINS if not plugin["required"] and plugin["id"] not in active_set
    ]
    return {
        "profile_dir": str(profile) if profile else "",
        "active_addon_count": len(active_ids),
        "active_addon_ids": active_ids,
        "expected_plugins": EXPECTED_PLUGINS,
        "expected_plugin_ids": expected_ids,
        "missing_required": missing_required,
        "missing_optional": missing_optional,
        "plugin_source": str(plugin_source) if plugin_source else "",
        "available_xpi_files": list_plugin_xpis(plugin_source),
        "status": "ok" if not missing_required else "missing_required_plugins",
    }


def render_text(result: dict[str, Any]) -> str:
    lines = [
        f"status: {result['status']}",
        f"profile_dir: {result['profile_dir'] or '(not found)'}",
        f"active_addon_count: {result['active_addon_count']}",
        "missing_required:",
    ]
    lines.extend(f"  - {plugin_id}" for plugin_id in result["missing_required"])
    if not result["missing_required"]:
        lines.append("  - none")
    lines.append("available_xpi_files:")
    lines.extend(f"  - {name}" for name in result["available_xpi_files"])
    if not result["available_xpi_files"]:
        lines.append("  - none")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, help="Zotero profile directory. Defaults to detected active profile.")
    parser.add_argument("--plugin-source", type=Path, help="Directory containing expected Zotero plugin .xpi files.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args()

    result = audit_environment(args.profile, args.plugin_source)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(render_text(result))
    return 0 if result["status"] == "ok" else 2


if __name__ == "__main__":
    raise SystemExit(main())
