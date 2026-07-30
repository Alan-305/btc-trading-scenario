from __future__ import annotations

import secrets
from dataclasses import dataclass

import structlog
from firebase_admin import auth, firestore

from app.auth.firebase_auth import _ensure_firebase_app

logger = structlog.get_logger(__name__)

PREFERENCES_DOC_ID = "preferences"


@dataclass(frozen=True)
class DigestSubscriber:
    uid: str
    email: str
    unsubscribe_token: str


def ensure_unsubscribe_token(uid: str) -> str:
    """Return existing or newly generated unsubscribe token for a user."""
    _ensure_firebase_app()
    doc_ref = (
        firestore.client()
        .collection("users")
        .document(uid)
        .collection("settings")
        .document(PREFERENCES_DOC_ID)
    )
    snapshot = doc_ref.get()
    data = snapshot.to_dict() or {}
    token = data.get("morningEmailUnsubscribeToken")
    if isinstance(token, str) and token.strip():
        return token.strip()

    new_token = secrets.token_urlsafe(32)
    doc_ref.set(
        {
            "morningEmailUnsubscribeToken": new_token,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    return new_token


def list_morning_digest_subscribers() -> list[DigestSubscriber]:
    _ensure_firebase_app()
    db = firestore.client()
    subscribers: list[DigestSubscriber] = []

    query = db.collection_group(PREFERENCES_DOC_ID).where("morningEmailEnabled", "==", True)
    for snapshot in query.stream():
        data = snapshot.to_dict() or {}
        token = data.get("morningEmailUnsubscribeToken")
        if not isinstance(token, str) or not token.strip():
            logger.warning("digest_subscriber_missing_token", path=snapshot.reference.path)
            continue

        user_ref = snapshot.reference.parent.parent
        if user_ref is None:
            continue
        uid = user_ref.id

        try:
            user = auth.get_user(uid)
        except Exception as exc:
            logger.warning("digest_subscriber_lookup_failed", uid=uid, error=str(exc))
            continue

        email = (user.email or "").strip().lower()
        if not email:
            continue

        subscribers.append(
            DigestSubscriber(
                uid=uid,
                email=email,
                unsubscribe_token=token.strip(),
            )
        )

    return subscribers


def disable_morning_digest_by_token(token: str) -> bool:
    if not token.strip():
        return False

    _ensure_firebase_app()
    db = firestore.client()
    query = (
        db.collection_group(PREFERENCES_DOC_ID)
        .where("morningEmailUnsubscribeToken", "==", token.strip())
        .limit(1)
    )
    for snapshot in query.stream():
        snapshot.reference.set(
            {
                "morningEmailEnabled": False,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        return True
    return False
