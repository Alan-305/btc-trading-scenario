import pytest
import respx
from httpx import Response

from app.config import Settings
from app.services.email_service import send_paper_trade_fill_email


@respx.mock
def test_send_paper_trade_fill_email_success():
    respx.post("https://api.resend.com/emails").mock(
        return_value=Response(200, json={"id": "msg_fill"}),
    )
    settings = Settings(
        resend_api_key="re_test",
        resend_from_email="BTC Scenario <onboarding@resend.dev>",
    )
    send_paper_trade_fill_email(
        to="trader@example.com",
        side="long",
        status_label="TP1決済",
        entry_price=60000,
        exit_price=62000,
        size_btc=0.05,
        take_profit_target="tp1",
        realized_pnl_usd=100,
        label="テスト",
        settings=settings,
    )
