from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def get_fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.app_secret_key.encode("utf-8")).digest())
    return Fernet(key)


def seal_secret(value: str | None) -> bytes | None:
    if not value:
        return None
    return get_fernet().encrypt(value.encode("utf-8"))


def open_secret(value: bytes | None) -> str | None:
    if not value:
        return None
    return get_fernet().decrypt(value).decode("utf-8")
