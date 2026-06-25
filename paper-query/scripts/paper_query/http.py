"""HTTPS helpers for paper-query network calls."""

from __future__ import annotations

import ssl
from typing import Optional
import urllib.request

try:
    import certifi
except ImportError:  # pragma: no cover
    certifi = None


_SSL_CONTEXT: Optional[ssl.SSLContext] = None


def default_ssl_context() -> Optional[ssl.SSLContext]:
    """Return a certifi-backed SSL context when available.

    Windows Store/Python installs can have no default CA file configured. Using
    certifi preserves certificate verification while making urllib calls portable.
    """
    global _SSL_CONTEXT
    if certifi is None:
        return None
    if _SSL_CONTEXT is None:
        _SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
    return _SSL_CONTEXT


def urlopen(request, timeout: int = 30):
    context = default_ssl_context()
    if context is None:
        return urllib.request.urlopen(request, timeout=timeout)
    return urllib.request.urlopen(request, timeout=timeout, context=context)
