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


def _paper_trade_fill_html(
    *,
    side: str,
    status_label: str,
    entry_price: float,
    exit_price: float,
    size_btc: float,
    take_profit_target: str,
    realized_pnl_usd: float,
    label: str,
) -> str:
    side_ja = "ロング" if side == "long" else "ショート"
    pnl_color = "#16a34a" if realized_pnl_usd >= 0 else "#dc2626"
    pnl_sign = "+" if realized_pnl_usd >= 0 else ""
    label_row = f"<p>メモ: {label}</p>" if label else ""
    target_ja = "TP1" if take_profit_target == "tp1" else "TP2"
    return f"""\
<!DOCTYPE html>
<html lang="ja">
<body style="font-family:sans-serif;line-height:1.6;color:#1e293b;">
  <p>擬似トレードが設定価格で約定しました。</p>
  <p><strong>{side_ja}</strong> · {status_label}</p>
  {label_row}
  <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;">エントリー</td><td>${entry_price:,.0f}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;">決済</td><td>${exit_price:,.0f}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;">数量</td><td>{size_btc:g} BTC</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;">利確ライン設定</td><td>{target_ja}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;">損益</td><td style="color:{pnl_color};font-weight:600;">{pnl_sign}${realized_pnl_usd:,.2f}</td></tr>
  </table>
  <p style="font-size:12px;color:#64748b;">BTC Trading Scenario の擬似トレード通知です。実際の取引所注文は行っていません。</p>
</body>
</html>"""


def send_paper_trade_fill_email(
    *,
    to: str,
    side: str,
    status_label: str,
    entry_price: float,
    exit_price: float,
    size_btc: float,
    take_profit_target: str,
    realized_pnl_usd: float,
    label: str = "",
    settings: Settings | None = None,
) -> None:
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
            "subject": f"擬似トレード約定通知 — {status_label}",
            "html": _paper_trade_fill_html(
                side=side,
                status_label=status_label,
                entry_price=entry_price,
                exit_price=exit_price,
                size_btc=size_btc,
                take_profit_target=take_profit_target,
                realized_pnl_usd=realized_pnl_usd,
                label=label,
            ),
        },
        timeout=30.0,
    )
    if response.status_code >= 400:
        detail = response.text.strip() or response.reason_phrase
        raise RuntimeError(f"約定通知メールの送信に失敗しました（Resend {response.status_code}）: {detail}")


_SUPPORT_CATEGORY_LABELS = {
    "bug": "不具合・エラー",
    "feature": "機能の要望",
    "account": "アカウント・ログイン",
    "other": "その他",
}


def _support_html(
    *,
    from_email: str,
    category: str,
    subject: str,
    message: str,
) -> str:
    category_ja = _SUPPORT_CATEGORY_LABELS.get(category, category)
    escaped_message = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    escaped_subject = subject.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"""\
<!DOCTYPE html>
<html lang="ja">
<body style="font-family:sans-serif;line-height:1.6;color:#1e293b;">
  <p>BTC Trading Scenario からサポートお問い合わせが届きました。</p>
  <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;">送信者</td><td>{from_email}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;">カテゴリ</td><td>{category_ja}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;">件名</td><td>{escaped_subject}</td></tr>
  </table>
  <p style="font-weight:600;margin:16px 0 8px;">お問い合わせ内容</p>
  <pre style="white-space:pre-wrap;background:#f1f5f9;padding:12px;border-radius:8px;font-size:14px;">{escaped_message}</pre>
  <p style="font-size:12px;color:#64748b;">返信は送信者メールアドレス宛に行ってください。</p>
</body>
</html>"""


def send_support_email(
    *,
    from_email: str,
    category: str,
    subject: str,
    message: str,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    if not settings.resend_api_key:
        raise RuntimeError(
            "RESEND_API_KEY が未設定です。サポートメールを送信できません。"
        )
    if not settings.resend_from_email:
        raise RuntimeError(
            "RESEND_FROM_EMAIL が未設定です。サポートメールを送信できません。"
        )

    category_ja = _SUPPORT_CATEGORY_LABELS.get(category, category)
    to_email = settings.support_email.strip()
    if not to_email:
        raise RuntimeError("サポート宛先メールが未設定です。")

    response = httpx.post(
        RESEND_API_URL,
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": settings.resend_from_email,
            "to": [to_email],
            "reply_to": [from_email],
            "subject": f"[BTC Scenario] {category_ja}: {subject}",
            "html": _support_html(
                from_email=from_email,
                category=category,
                subject=subject,
                message=message,
            ),
        },
        timeout=30.0,
    )
    if response.status_code >= 400:
        detail = response.text.strip() or response.reason_phrase
        raise RuntimeError(f"サポートメールの送信に失敗しました（Resend {response.status_code}）: {detail}")
