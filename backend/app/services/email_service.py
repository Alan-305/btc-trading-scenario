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
