import respx

from app.config import Settings
from app.services.email_service import send_support_email


@respx.mock
def test_send_support_email_success():
    route = respx.post("https://api.resend.com/emails").mock(
        return_value=respx.MockResponse(200, json={"id": "msg_123"})
    )
    settings = Settings(
        resend_api_key="re_test",
        resend_from_email="BTC Scenario <onboarding@resend.dev>",
        support_email="support@nexus-learning.com",
    )
    send_support_email(
        from_email="user@example.com",
        category="bug",
        subject="チャートが表示されない",
        message="エントリーチャートを開くと真っ白になります。",
        settings=settings,
    )
    assert route.called
    payload = route.calls.last.request.read().decode()
    assert "support@nexus-learning.com" in payload
    assert "user@example.com" in payload
