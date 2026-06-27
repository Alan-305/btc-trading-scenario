import pytest
import respx
from httpx import Response

from app.config import Settings
from app.services.email_service import send_invite_email


@respx.mock
def test_send_invite_email_success():
    respx.post("https://api.resend.com/emails").mock(
        return_value=Response(200, json={"id": "msg_123"}),
    )
    settings = Settings(
        resend_api_key="re_test",
        resend_from_email="BTC Scenario <onboarding@resend.dev>",
    )
    send_invite_email(
        to="guest@example.com",
        sign_in_link="https://nexus-btc-trading.web.app/?email=guest@example.com",
        settings=settings,
    )


def test_send_invite_email_missing_api_key():
    settings = Settings(resend_api_key="", resend_from_email="noreply@example.com")
    with pytest.raises(RuntimeError, match="RESEND_API_KEY"):
        send_invite_email(
            to="guest@example.com",
            sign_in_link="https://example.com",
            settings=settings,
        )
