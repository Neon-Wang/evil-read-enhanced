"""Browser client abstractions for paper-query."""

from __future__ import annotations

from dataclasses import dataclass
import json
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote
import urllib.request

from .http import urlopen


@dataclass
class BrowserPage:
    target_id: str
    url: str


class BrowserClient:
    name = "base"

    def health_check(self) -> bool:
        return False

    def open(self, url: str) -> Optional[BrowserPage]:
        raise NotImplementedError

    def evaluate(self, page: BrowserPage, script: str) -> Optional[str]:
        raise NotImplementedError

    def wait_until_ready(self, page: BrowserPage, timeout_seconds: int = 10) -> bool:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            state = self.evaluate(page, "document.readyState")
            if state == "complete":
                return True
            time.sleep(0.5)
        return False

    def screenshot(self, page: BrowserPage, path: Optional[str] = None) -> str:
        raise NotImplementedError

    def close(self, page: BrowserPage) -> None:
        return None


class CDPProxyBrowserClient(BrowserClient):
    name = "cdp"

    def __init__(self, proxy_url: str = "http://localhost:3457", screenshot_dir: str = "") -> None:
        self.proxy_url = proxy_url.rstrip("/")
        self.screenshot_dir = Path(screenshot_dir) if screenshot_dir else Path(tempfile.gettempdir())

    def _get(self, url: str, timeout: int = 30) -> str:
        with urlopen(url, timeout=timeout) as response:
            return response.read().decode("utf-8")

    def _post(self, url: str, data: str, timeout: int = 30) -> str:
        request = urllib.request.Request(url, data=data.encode("utf-8"), method="POST")
        with urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8")

    def health_check(self) -> bool:
        for endpoint in ("targets", "health"):
            try:
                self._get(f"{self.proxy_url}/{endpoint}", timeout=5)
                return True
            except Exception:
                continue
        return False

    def open(self, url: str) -> Optional[BrowserPage]:
        try:
            encoded = quote(url, safe=":/?&=+%#")
            raw = self._get(f"{self.proxy_url}/new?url={encoded}", timeout=30)
            data = json.loads(raw)
            target_id = data.get("targetId") or data.get("id")
            if not target_id:
                return None
            return BrowserPage(target_id=target_id, url=url)
        except Exception:
            return None

    def evaluate(self, page: BrowserPage, script: str) -> Optional[str]:
        try:
            raw = self._post(f"{self.proxy_url}/eval?target={page.target_id}", script, timeout=30)
            try:
                wrapper = json.loads(raw)
                if isinstance(wrapper, dict) and "value" in wrapper:
                    return wrapper["value"]
            except (json.JSONDecodeError, TypeError):
                pass
            return raw
        except Exception:
            return None

    def screenshot(self, page: BrowserPage, path: Optional[str] = None) -> str:
        target = Path(path) if path else self.screenshot_dir / f"paper-query-{page.target_id}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        self._get(f"{self.proxy_url}/screenshot?target={page.target_id}&file={target}", timeout=15)
        return str(target)

    def close(self, page: BrowserPage) -> None:
        try:
            self._get(f"{self.proxy_url}/close?target={page.target_id}", timeout=10)
        except Exception:
            return None


class KimiWebBridgeBrowserClient(BrowserClient):
    name = "webbridge"

    def __init__(self, base_url: str = "http://127.0.0.1:10086", session: str = "paper-query") -> None:
        self.base_url = base_url.rstrip("/")
        self.session = session
        self.current_tab_id = ""

    def _command(self, action: str, args: Dict[str, Any]) -> Dict[str, Any]:
        payload = json.dumps({"action": action, "args": args, "session": self.session}).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/command",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))

    def health_check(self) -> bool:
        try:
            self._command("list_tabs", {})
            return True
        except Exception:
            return False

    def open(self, url: str) -> Optional[BrowserPage]:
        try:
            data = self._command("navigate", {"url": url, "newTab": True, "group_title": "Paper Query"})
            result = data.get("data", data)
            tab_id = str(result.get("tabId") or "")
            self.current_tab_id = tab_id
            return BrowserPage(target_id=tab_id, url=result.get("url", url))
        except Exception:
            return None

    def evaluate(self, page: BrowserPage, script: str) -> Optional[str]:
        try:
            data = self._command("evaluate", {"code": script})
            result = data.get("data", data)
            value = result.get("value")
            if isinstance(value, str):
                return value
            return json.dumps(value, ensure_ascii=False)
        except Exception:
            return None

    def screenshot(self, page: BrowserPage, path: Optional[str] = None) -> str:
        args: Dict[str, Any] = {"format": "png"}
        if path:
            args["path"] = path
        data = self._command("screenshot", args)
        result = data.get("data", data)
        return result.get("path", path or "")

    def close(self, page: BrowserPage) -> None:
        try:
            self._command("close_tab", {})
        except Exception:
            return None


def make_browser_client(config: Dict[str, Any]) -> Optional[BrowserClient]:
    browser_config = config.get("browser", config)
    backend = browser_config.get("backend", "auto")
    clients = []
    if backend in ("webbridge", "auto"):
        clients.append(KimiWebBridgeBrowserClient(browser_config.get("webbridge_url", "http://127.0.0.1:10086")))
    if backend in ("cdp", "auto"):
        clients.append(
            CDPProxyBrowserClient(
                browser_config.get("cdp_proxy_url", "http://localhost:3457"),
                browser_config.get("screenshot_dir", ""),
            )
        )
    for client in clients:
        if client.health_check():
            return client
    return None
