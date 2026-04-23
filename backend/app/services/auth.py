from __future__ import annotations

import re
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import httpx
import jwt as pyjwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.category import Category
from app.models.commercial import DeviceSession
from app.models.enums import CategorySource, DevicePlatform
from app.models.user import User

DEFAULT_CATEGORY_NAMES = [
    "Meals & Entertainment",
    "Office Supplies",
    "Travel",
    "Software & Subscriptions",
    "Transportation",
    "Other Business Expense",
]


def slugify_subject(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "demo-user"


def ensure_default_categories(db: Session, user: User) -> None:
    existing_names = set(
        db.scalars(
            select(Category.name).where(Category.user_id == user.id)
        ).all()
    )
    missing = [
        Category(
            user_id=user.id,
            name=name,
            source=CategorySource.SYSTEM,
        )
        for name in DEFAULT_CATEGORY_NAMES
        if name not in existing_names
    ]
    if missing:
        db.add_all(missing)
        db.flush()


def upsert_user_from_identity(
    db: Session,
    *,
    auth_subject: str,
    email: str,
    full_name: str | None,
    company_name: str | None = None,
) -> User:
    user = db.scalar(select(User).where(User.auth_subject == auth_subject))
    if user is None:
        user = db.scalar(select(User).where(User.email == email.lower()))

    if user is None:
        user = User(
            email=email.lower(),
            auth_subject=auth_subject,
            full_name=full_name,
            company_name=company_name,
            default_currency="USD",
            timezone="America/New_York",
            country_code="US",
        )
        db.add(user)
        db.flush()
    else:
        user.email = email.lower()
        user.auth_subject = auth_subject
        user.full_name = full_name
        if company_name:
            user.company_name = company_name

    ensure_default_categories(db, user)
    return user


def get_pyjwt_client() -> pyjwt.PyJWKClient:
    jwks_url = settings.resolved_supabase_jwks_url
    if not jwks_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase JWT verification is not configured.",
        )
    return pyjwt.PyJWKClient(jwks_url)


@lru_cache(maxsize=1)
def get_cached_jwks_client() -> pyjwt.PyJWKClient:
    return get_pyjwt_client()


def verify_supabase_access_token(token: str) -> dict[str, Any]:
    issuer = settings.resolved_supabase_jwt_issuer
    if not issuer:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase JWT issuer is not configured.",
        )

    try:
        signing_key = get_cached_jwks_client().get_signing_key_from_jwt(token)
        return pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.supabase_jwt_audience,
            issuer=issuer,
        )
    except pyjwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase access token.",
        ) from exc


def resolve_user_from_claims(db: Session, claims: dict[str, Any]) -> User:
    auth_subject = str(claims.get("sub") or claims.get("user_id") or "")
    email = str(claims.get("email") or "").strip().lower()
    if not auth_subject or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase token is missing required identity claims.",
        )

    full_name = (
        claims.get("user_metadata", {}).get("full_name")
        or claims.get("user_metadata", {}).get("name")
        or claims.get("name")
    )
    company_name = claims.get("user_metadata", {}).get("company_name")
    user = upsert_user_from_identity(
        db,
        auth_subject=auth_subject,
        email=email,
        full_name=full_name,
        company_name=company_name,
    )
    db.commit()
    db.refresh(user)
    return user


def resolve_demo_user(db: Session, email: str, full_name: str) -> User:
    auth_subject = f"dev:{slugify_subject(email)}"
    user = upsert_user_from_identity(
        db,
        auth_subject=auth_subject,
        email=email,
        full_name=full_name,
    )
    db.commit()
    db.refresh(user)
    return user


def register_device_session(
    db: Session,
    *,
    user: User,
    platform: DevicePlatform,
    device_name: str,
    app_version: str | None,
    push_token: str | None,
) -> DeviceSession:
    session = db.scalar(
        select(DeviceSession).where(
            DeviceSession.user_id == user.id,
            DeviceSession.platform == platform,
            DeviceSession.device_name == device_name,
        )
    )
    if session is None:
        session = DeviceSession(
            user_id=user.id,
            platform=platform,
            device_name=device_name,
        )
        db.add(session)
    session.app_version = app_version
    session.push_token = push_token
    session.last_seen_at = datetime.now(timezone.utc)
    db.flush()
    return session
