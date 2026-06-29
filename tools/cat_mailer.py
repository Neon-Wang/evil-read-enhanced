#!/usr/bin/env python3
"""Self-contained CAT-compatible notification email sender."""

from __future__ import annotations

import html
import json
import os
from pathlib import Path
import re
import smtplib
import sys
from email.message import EmailMessage
from urllib import request
from urllib.error import HTTPError, URLError

HTTP_USER_AGENT = "CAT-EvilRead/1.0"


class EmailConfigError(RuntimeError):
    """Raised when required email provider configuration is missing."""


def user_env_value(name: str) -> str:
    if sys.platform != "win32":
        return ""
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            value, _ = winreg.QueryValueEx(key, name)
            return str(value).strip()
    except OSError:
        return ""


def env_value(name: str, default: str = "") -> str:
    return (os.environ.get(name) or user_env_value(name) or default).strip()


def inline_markdown(value: str) -> str:
    escaped = html.escape(value)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        lambda match: f'<a href="{html.escape(match.group(2), quote=True)}" style="color:#2563eb;text-decoration:none;">{match.group(1)}</a>',
        escaped,
    )
    return escaped


def code_server_url_for_path(path: Path) -> str:
    base_url = env_value("CAT_CODE_SERVER_URL", "https://code.jiashengfan.space").rstrip("/")
    absolute = path.resolve()
    workspace = env_value("EVILREAD_WORKSPACE_ROOT", "C:/GitClient/windows/repos/evilread-workspace")
    workspace_web = "/" + Path(workspace).as_posix().lstrip("/")
    file_web = "/" + absolute.as_posix().lstrip("/")
    return f"{base_url}/?folder={workspace_web}&file={file_web}"


def markdown_for_email_links(body: str, base_dir: Path | None = None) -> str:
    base_dir = base_dir.resolve() if base_dir else None

    def resolve_link(target: str) -> str:
        if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target):
            return target
        target_path = Path(target)
        if not target_path.is_absolute() and base_dir:
            target_path = base_dir / target_path
        if target_path.exists() or str(target_path).startswith(("C:", "/C:")):
            return code_server_url_for_path(target_path)
        return target

    def replace_markdown_link(match: re.Match[str]) -> str:
        label, target = match.group(1), match.group(2)
        return f"[{label}]({resolve_link(target)})"

    def replace_wikilink(match: re.Match[str]) -> str:
        raw = match.group(1)
        path_text, _, label = raw.partition("|")
        label = label or Path(path_text).name or path_text
        target = path_text
        if not target.lower().endswith((".md", ".pdf", ".json")):
            target = target + ".md"
        if base_dir:
            vault_root = base_dir.parent
            target_path = vault_root / target
            if target_path.exists():
                return f"[{label}]({code_server_url_for_path(target_path)})"
        return label

    body = re.sub(r"\[\[([^\]]+)\]\]", replace_wikilink, body)
    body = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", replace_markdown_link, body)
    return body


def body_to_html(body: str) -> str:
    lines = body.replace("\r\n", "\n").split("\n")
    rendered: list[str] = []
    list_open = False
    code_open = False

    def close_list() -> None:
        nonlocal list_open
        if list_open:
            rendered.append("</ul>")
            list_open = False

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()
        if stripped.startswith("```"):
            close_list()
            if code_open:
                rendered.append("</code></pre>")
            else:
                rendered.append('<pre style="background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:8px;overflow:auto;"><code>')
            code_open = not code_open
            continue
        if code_open:
            rendered.append(html.escape(line) + "\n")
            continue
        if not stripped:
            close_list()
            continue
        heading = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if heading:
            close_list()
            level = min(len(heading.group(1)) + 1, 5)
            sizes = {2: 22, 3: 18, 4: 16, 5: 15}
            margin = "26px 0 12px" if level <= 3 else "18px 0 8px"
            rendered.append(
                f'<h{level} style="margin:{margin};font-size:{sizes.get(level, 15)}px;line-height:1.35;color:#111827;">'
                f"{inline_markdown(heading.group(2))}</h{level}>"
            )
            continue
        bullet = re.match(r"^[-*]\s+(.+)$", stripped)
        if bullet:
            if not list_open:
                rendered.append('<ul style="margin:8px 0 16px 20px;padding:0;">')
                list_open = True
            rendered.append(f'<li style="margin:6px 0;">{inline_markdown(bullet.group(1))}</li>')
            continue
        numbered = re.match(r"^\d+\.\s+(.+)$", stripped)
        if numbered:
            close_list()
            rendered.append(f'<p style="margin:8px 0;"><strong>{inline_markdown(stripped.split(".", 1)[0] + ".")}</strong> {inline_markdown(numbered.group(1))}</p>')
            continue
        close_list()
        rendered.append(f'<p style="margin:10px 0;">{inline_markdown(stripped)}</p>')
    close_list()
    if code_open:
        rendered.append("</code></pre>")
    return "\n".join(rendered) or "<p></p>"


def build_notification_html(title: str, body: str, notification_type: str | None = None, base_dir: Path | None = None) -> str:
    frontend_url = env_value("CAT_FRONTEND_URL", "https://cat-sigma-sandy.vercel.app")
    badge = html.escape((notification_type or "NOTIFICATION").upper())
    safe_title = html.escape(title)
    content = body_to_html(markdown_for_email_links(body, base_dir=base_dir))
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{safe_title}</title>
</head>
<body style="margin:0;background:#f6f7f9;color:#182026;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e3e8ef;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:22px 28px;background:#111827;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1;">CAT</div>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">{safe_title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <div style="display:inline-block;margin-bottom:16px;padding:4px 10px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:12px;font-weight:700;">{badge}</div>
              <div style="font-size:15px;line-height:1.65;color:#182026;">{content}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;">
              Sent by CAT notification service. <a href="{html.escape(frontend_url)}" style="color:#2563eb;">Open CAT</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def cf_relay_send(email: str, subject: str, html_body: str) -> bool:
    relay_url = env_value("CAT_CF_RELAY_URL")
    relay_secret = env_value("CAT_CF_RELAY_SECRET")
    if not relay_url or not relay_secret:
        raise EmailConfigError("CAT_CF_RELAY_URL and CAT_CF_RELAY_SECRET are required for cf_relay")
    payload = json.dumps(
        {
            "secret": relay_secret,
            "to": email,
            "subject": subject,
            "html": html_body,
        }
    ).encode("utf-8")
    req = request.Request(
        relay_url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": HTTP_USER_AGENT},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=30) as response:
            return 200 <= response.status < 300
    except (HTTPError, URLError, TimeoutError):
        return False


def resend_send(email: str, subject: str, html_body: str) -> bool:
    api_key = env_value("CAT_RESEND_API_KEY")
    from_email = env_value("CAT_FROM_EMAIL")
    if not api_key or not from_email:
        raise EmailConfigError("CAT_RESEND_API_KEY and CAT_FROM_EMAIL are required for resend")
    payload = json.dumps(
        {
            "from": from_email,
            "to": [email],
            "subject": subject,
            "html": html_body,
        }
    ).encode("utf-8")
    req = request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}", "User-Agent": HTTP_USER_AGENT},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=30) as response:
            return 200 <= response.status < 300
    except (HTTPError, URLError, TimeoutError):
        return False


def smtp_send(email: str, subject: str, html_body: str) -> bool:
    host = env_value("CAT_SMTP_HOST")
    port_text = env_value("CAT_SMTP_PORT", "587")
    user = env_value("CAT_SMTP_USER")
    password = env_value("CAT_SMTP_PASSWORD")
    from_email = env_value("CAT_FROM_EMAIL") or user
    use_tls = env_value("CAT_SMTP_USE_TLS", "true").lower() not in {"0", "false", "no"}
    if not host or not port_text or not user or not password or not from_email:
        raise EmailConfigError("CAT_SMTP_HOST, CAT_SMTP_PORT, CAT_SMTP_USER, CAT_SMTP_PASSWORD, and CAT_FROM_EMAIL are required for smtp")
    message = EmailMessage()
    message["From"] = from_email
    message["To"] = email
    message["Subject"] = subject
    message.set_content("This email requires an HTML-capable client.")
    message.add_alternative(html_body, subtype="html")
    try:
        with smtplib.SMTP(host, int(port_text), timeout=30) as smtp:
            if use_tls:
                smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(message)
        return True
    except (OSError, smtplib.SMTPException, ValueError):
        return False


def send_notification_email(email: str, title: str, body: str, notification_type: str | None = None, base_dir: Path | None = None) -> bool:
    provider = env_value("CAT_EMAIL_PROVIDER", "cf_relay").lower()
    subject = f"CAT — {title}"
    html_body = build_notification_html(title, body, notification_type, base_dir=base_dir)
    if provider == "cf_relay":
        return cf_relay_send(email, subject, html_body)
    if provider == "resend":
        return resend_send(email, subject, html_body)
    if provider == "smtp":
        return smtp_send(email, subject, html_body)
    raise EmailConfigError(f"unsupported CAT_EMAIL_PROVIDER: {provider}")
