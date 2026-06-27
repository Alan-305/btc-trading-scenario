from datetime import datetime, timezone

from firebase_admin import firestore

from app.auth.firebase_auth import _ensure_firebase_app
from app.config import Settings, get_settings


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _allowed_from_env(settings: Settings) -> frozenset[str]:
    return frozenset(
        e.strip().lower() for e in settings.allowed_emails.split(",") if e.strip()
    )


def is_email_invited(email: str, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    normalized = _normalize_email(email)
    if not normalized:
        return False
    if normalized in _allowed_from_env(settings):
        return True
    _ensure_firebase_app()
    doc = firestore.client().collection("invites").document(normalized).get()
    return doc.exists


def is_admin_email(email: str, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    return _normalize_email(email) in _allowed_from_env(settings)


def add_invite(email: str, invited_by: str) -> str:
    normalized = _normalize_email(email)
    if not normalized or "@" not in normalized:
        raise ValueError("invalid email")
    _ensure_firebase_app()
    now = datetime.now(timezone.utc)
    firestore.client().collection("invites").document(normalized).set(
        {
            "email": normalized,
            "invitedAt": now,
            "invitedBy": invited_by,
        },
        merge=True,
    )
    return normalized
