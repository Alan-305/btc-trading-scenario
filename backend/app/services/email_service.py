from __future__ import annotations

import httpx

from app.config import Settings, get_settings

RESEND_API_URL = "https://api.resend.com/emails"


def _invite_html(sign_in_link: str) -> str:
    return f"""\
<!DOCTYPE html>
<html lang="ja">
<body style="font-family:sans-serif;line-height:1.6;color:#1e293b;">
  <p>BTC Trading Scenario への招待が届いています。</p>
  <p>下のボタンを押すと、招待されたメールアドレスでログインできます（Gmail 以外のメールでも利用できます）。</p>
  <p style="margin:24px 0;">
    <a href="{sign_in_link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
      ログインする
    </a>
  </p>
  <p style="font-size:12px;color:#64748b;">ボタンが開けない場合は、次の URL をブラウザに貼り付けてください。<br>{sign_in_link}</p>
  <p style="font-size:12px;color:#64748b;">このリンクは一度だけ有効です。心当たりがない場合は無視してください。</p>
</body>
</html>"""


def send_invite_email(*, to: str, sign_in_link: str, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    if not settings.resend_api_key:
        raise RuntimeError(
            "RESEND_API_KEY が未設定です。Resend の API キーと RESEND_FROM_EMAIL を .env に設定してください。"
        )
    if not settings.resend_from_email:
        raise RuntimeError(
            "RESEND_FROM_EMAIL が未設定です。Resend で認証済みの送信元アドレスを設定してください。"
        )

    response = httpx.post(
        RESEND_API_URL,
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": settings.resend_from_email,
            "to": [to],
            "subject": "BTC Trading Scenario への招待",
            "html": _invite_html(sign_in_link),
        },
        timeout=30.0,
    )
    if response.status_code >= 400:
        detail = response.text.strip() or response.reason_phrase
        raise RuntimeError(f"招待メールの送信に失敗しました（Resend {response.status_code}）: {detail}")
