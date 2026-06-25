"""Configuration loading for paper-query."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


DEFAULT_CONFIG: Dict[str, Any] = {
    "sources": ["arxiv", "semantic_scholar", "dblp", "google_scholar", "nature"],
    "top_n": 10,
    "max_pages": 1,
    "download_pdfs": False,
    "browser": {
        "backend": "auto",
        "webbridge_url": "http://127.0.0.1:10086",
        "cdp_proxy_url": "http://localhost:3457",
        "manual_timeout_seconds": 120,
        "screenshot_dir": "",
    },
    "nature": {
        "enabled": True,
        "max_pages": 1,
        "download_pdfs": False,
    },
    "google_scholar": {
        "enabled": True,
        "max_pages": 1,
    },
}


def load_yaml(path: str) -> Dict[str, Any]:
    if not path or not Path(path).exists():
        return {}
    if yaml is None:
        return {}
    with open(path, "r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_config(config_path: str = "", research_config_path: str = "") -> Dict[str, Any]:
    config = deep_merge(DEFAULT_CONFIG, load_yaml(config_path))
    research_config = load_yaml(research_config_path)
    if research_config:
        config["research_domains"] = research_config.get("research_domains", {})
        config["excluded_keywords"] = research_config.get("excluded_keywords", [])
        config["semantic_scholar_api_key"] = research_config.get("semantic_scholar_api_key", "")
        config["language"] = research_config.get("language", config.get("language", "zh"))
    return config
