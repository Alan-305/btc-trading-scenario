from unittest.mock import MagicMock, patch

import pytest

from app.services.digest_subscribers import disable_morning_digest_by_token


@patch("app.services.digest_subscribers._ensure_firebase_app")
@patch("app.services.digest_subscribers.firestore")
def test_disable_morning_digest_by_token_success(mock_firestore, _mock_app):
    doc_ref = MagicMock()
    snapshot = MagicMock()
    snapshot.reference = doc_ref
    mock_firestore.client.return_value.collection_group.return_value.where.return_value.limit.return_value.stream.return_value = [
        snapshot
    ]

    assert disable_morning_digest_by_token("token-123") is True
    doc_ref.set.assert_called_once()


@patch("app.services.digest_subscribers._ensure_firebase_app")
@patch("app.services.digest_subscribers.firestore")
def test_disable_morning_digest_by_token_not_found(mock_firestore, _mock_app):
    mock_firestore.client.return_value.collection_group.return_value.where.return_value.limit.return_value.stream.return_value = []
    assert disable_morning_digest_by_token("missing") is False


def test_disable_morning_digest_by_token_empty():
    assert disable_morning_digest_by_token("") is False
