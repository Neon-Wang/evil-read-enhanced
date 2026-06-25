"""Base classes for paper-query source adapters."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from ..browser import BrowserClient
from ..models import SearchRequest, SourceResult


@dataclass
class SourceCapabilities:
    requires_browser: bool = False
    supports_pdf_resolution: bool = False
    supports_date_range: bool = False
    supports_citations: bool = False


class PaperSourceAdapter:
    source_name = "base"
    capabilities = SourceCapabilities()

    def __init__(self, config: Optional[dict] = None, browser: Optional[BrowserClient] = None) -> None:
        self.config = config or {}
        self.browser = browser

    def search(self, request: SearchRequest) -> SourceResult:
        raise NotImplementedError
