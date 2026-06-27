from __future__ import annotations

import urllib.parse
from datetime import datetime, timezone

from firebase_admin import auth, firestore

from app.auth.firebase_auth import _ensure_firebase_app
from app.config import Settings, get_settings
from app.services.email_service import send_invite_email


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _allowed_from_env(settings: Settings) -> frozenset[str]:
    return frozenset(
        e.strip().lower() for e in settings.allowed_emails.split(",") if e.strip()
    )


def is_email_invited(email: str, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    if settings.auth_open_google:
        normalized = _normalize_email(email)
        return bool(normalized and "@" in normalized)

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


def _save_invite(normalized: str, invited_by: str) -> None:
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


def _generate_sign_in_link(email: str, settings: Settings) -> str:
    _ensure_firebase_app()
    base = settings.app_public_url.rstrip("/")
    continue_url = f"{base}/?email={urllib.parse.quote(email)}"
    action_code_settings = auth.ActionCodeSettings(
        url=continue_url,
        handle_code_in_app=True,
    )
    return auth.generate_sign_in_with_email_link(email, action_code_settings)


def send_invite_with_email(email: str, invited_by: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    normalized = _normalize_email(email)
    if not normalized or "@" not in normalized:
        raise ValueError("invalid email")

    _save_invite(normalized, invited_by)
    sign_in_link = _generate_sign_in_link(normalized, settings)
    send_invite_email(to=normalized, sign_in_link=sign_in_link, settings=settings)
    return normalized
