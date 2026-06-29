#!/usr/bin/env python3
"""Encrypt and inspect EvilRead relay credentials."""

from __future__ import annotations

import argparse
import base64
import getpass
import json
import os
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


DEFAULT_ITERATIONS = 600_000


def read_passphrase(env_name: str) -> str:
    value = os.environ.get(env_name)
    if value:
        return value
    value = getpass.getpass(f"{env_name}: ")
    if not value:
        raise SystemExit(f"{env_name} is required")
    return value


def derive_key(passphrase: str, salt: bytes, iterations: int) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=iterations,
    )
    return kdf.derive(passphrase.encode("utf-8"))


def encrypt_payload(payload: dict[str, Any], passphrase: str, iterations: int = DEFAULT_ITERATIONS) -> dict[str, Any]:
    salt = os.urandom(16)
    nonce = os.urandom(12)
    key = derive_key(passphrase, salt, iterations)
    ciphertext = AESGCM(key).encrypt(nonce, json.dumps(payload, ensure_ascii=False).encode("utf-8"), None)
    return {
        "format": "evilread-relay-credentials-v1",
        "kdf": "pbkdf2-sha256",
        "cipher": "aes-256-gcm",
        "iterations": iterations,
        "salt": base64.b64encode(salt).decode("ascii"),
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
    }


def decrypt_payload(envelope: dict[str, Any], passphrase: str) -> dict[str, Any]:
    if envelope.get("format") != "evilread-relay-credentials-v1":
        raise ValueError("unsupported credential envelope format")
    salt = base64.b64decode(str(envelope["salt"]))
    nonce = base64.b64decode(str(envelope["nonce"]))
    ciphertext = base64.b64decode(str(envelope["ciphertext"]))
    key = derive_key(passphrase, salt, int(envelope.get("iterations") or DEFAULT_ITERATIONS))
    try:
        plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
    except InvalidTag as exc:
        raise ValueError("invalid passphrase or corrupted credential file") from exc
    payload = json.loads(plaintext.decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("credential payload must be a JSON object")
    return payload


def redacted(payload: dict[str, Any]) -> dict[str, Any]:
    hidden = {}
    for key, value in payload.items():
        if any(marker in key.lower() for marker in ("token", "password", "secret", "key")):
            text = str(value)
            hidden[key] = f"***{text[-6:]}" if len(text) >= 6 else "***"
        else:
            hidden[key] = value
    return hidden


def main() -> int:
    parser = argparse.ArgumentParser(description="Encrypt/decrypt EvilRead relay credentials")
    sub = parser.add_subparsers(dest="command", required=True)

    encrypt = sub.add_parser("encrypt")
    encrypt.add_argument("--input", required=True, help="Plain JSON credential file")
    encrypt.add_argument("--output", required=True, help="Encrypted credential envelope")
    encrypt.add_argument("--passphrase-env", default="EVILREAD_RELAY_PASSPHRASE")

    decrypt = sub.add_parser("decrypt")
    decrypt.add_argument("--input", required=True, help="Encrypted credential envelope")
    decrypt.add_argument("--output", default="", help="Optional plaintext output path")
    decrypt.add_argument("--passphrase-env", default="EVILREAD_RELAY_PASSPHRASE")
    decrypt.add_argument("--redacted", action="store_true", help="Print redacted payload instead of plaintext")

    args = parser.parse_args()
    passphrase = read_passphrase(args.passphrase_env)
    if args.command == "encrypt":
        payload = json.loads(Path(args.input).read_text(encoding="utf-8-sig"))
        if not isinstance(payload, dict):
            raise SystemExit("plain credential file must contain a JSON object")
        envelope = encrypt_payload(payload, passphrase)
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(json.dumps(envelope, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"status": "encrypted", "output": args.output}, ensure_ascii=False))
        return 0
    envelope = json.loads(Path(args.input).read_text(encoding="utf-8-sig"))
    payload = decrypt_payload(envelope, passphrase)
    if args.output:
        Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"status": "decrypted", "output": args.output}, ensure_ascii=False))
    else:
        print(json.dumps(redacted(payload) if args.redacted else payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
