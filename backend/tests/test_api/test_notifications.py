from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@patch("app.api.v1.notifications.disable_morning_digest_by_token", return_value=True)
def test_unsubscribe_morning_digest_success(_mock_disable):
    response = client.get("/api/v1/notifications/unsubscribe/token-abc")
    assert response.status_code == 200
    assert "配信を停止しました" in response.text


@patch("app.api.v1.notifications.disable_morning_digest_by_token", return_value=False)
def test_unsubscribe_morning_digest_invalid(_mock_disable):
    response = client.get("/api/v1/notifications/unsubscribe/bad-token")
    assert response.status_code == 200
    assert "リンクが無効です" in response.text
