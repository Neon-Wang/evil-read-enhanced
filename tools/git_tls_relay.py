#!/usr/bin/env python3
"""HTTPS reverse proxy for local Gitea smoke tests."""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
from pathlib import Path
import ssl
from urllib.parse import urlsplit

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}


def generate_self_signed_cert(cert_path: Path, key_path: Path) -> None:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, "EvilRead local Git relay"),
        ]
    )
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(
            x509.SubjectAlternativeName(
                [
                    x509.DNSName("localhost"),
                    x509.DNSName("git.jiashengfan.space"),
                    x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
                ]
            ),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    cert_path.parent.mkdir(parents=True, exist_ok=True)
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    upstream_host = "127.0.0.1"
    upstream_port = 3000

    def do_GET(self) -> None:
        self.proxy()

    def do_POST(self) -> None:
        self.proxy()

    def do_HEAD(self) -> None:
        self.proxy()

    def proxy(self) -> None:
        body = None
        content_length = self.headers.get("Content-Length")
        if content_length:
            body = self.rfile.read(int(content_length))
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in HOP_BY_HOP and key.lower() != "host"
        }
        headers["Host"] = f"{self.upstream_host}:{self.upstream_port}"
        conn = http.client.HTTPConnection(self.upstream_host, self.upstream_port, timeout=60)
        try:
            conn.request(self.command, self.path, body=body, headers=headers)
            response = conn.getresponse()
            payload = response.read()
            self.send_response(response.status, response.reason)
            for key, value in response.getheaders():
                if key.lower() in HOP_BY_HOP:
                    continue
                self.send_header(key, value)
            self.send_header("Connection", "close")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)
                self.wfile.flush()
            self.close_connection = True
            try:
                self.connection.unwrap()
            except OSError:
                pass
        finally:
            conn.close()

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve local Gitea through HTTPS on 127.0.0.1")
    parser.add_argument("--listen-host", default="127.0.0.1")
    parser.add_argument("--listen-port", type=int, default=18083)
    parser.add_argument("--upstream", default="http://127.0.0.1:3000")
    parser.add_argument("--cert", default="deploy/relay/git-relay.local.crt")
    parser.add_argument("--key", default="deploy/relay/git-relay.local.key")
    args = parser.parse_args()

    upstream = urlsplit(args.upstream)
    if upstream.scheme != "http":
        raise SystemExit("upstream must be http")
    ProxyHandler.upstream_host = upstream.hostname or "127.0.0.1"
    ProxyHandler.upstream_port = upstream.port or 80

    cert_path = Path(args.cert)
    key_path = Path(args.key)
    if not cert_path.exists() or not key_path.exists():
        generate_self_signed_cert(cert_path, key_path)

    server = ThreadingHTTPServer((args.listen_host, args.listen_port), ProxyHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=cert_path, keyfile=key_path)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    print(f"serving https://{args.listen_host}:{args.listen_port} -> {args.upstream}")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
