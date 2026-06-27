from functools import lru_cache

import firebase_admin
from firebase_admin import auth, credentials


@lru_cache
def _ensure_firebase_app() -> firebase_admin.App:
    try:
        return firebase_admin.get_app()
    except ValueError:
        return firebase_admin.initialize_app(credentials.ApplicationDefault())


def verify_firebase_id_token(token: str) -> dict:
    _ensure_firebase_app()
    return auth.verify_id_token(token)
