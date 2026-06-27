from unittest.mock import MagicMock, patch

from app.config import Settings
from app.services.invite_service import is_email_invited


def test_open_google_allows_any_email():
    settings = Settings(auth_open_google=True, invite_only=True, allowed_emails="")
    assert is_email_invited("anyone@gmail.com", settings)
    assert is_email_invited("user@company.co.jp", settings)


@patch("app.services.invite_service._ensure_firebase_app")
@patch("app.services.invite_service.firestore")
def test_invite_only_without_open_google_requires_allowlist(mock_firestore, _mock_app):
    doc = MagicMock()
    doc.exists = False
    mock_firestore.client.return_value.collection.return_value.document.return_value.get.return_value = doc

    settings = Settings(
        auth_open_google=False,
        allowed_emails="owner@example.com",
    )
    assert is_email_invited("owner@example.com", settings)
    assert not is_email_invited("stranger@gmail.com", settings)
