from __future__ import annotations

from collections.abc import Generator

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User
from app.services.auth import resolve_demo_user, resolve_user_from_claims, verify_supabase_access_token
bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    demo_email: str | None = Header(default=None, alias="X-Demo-User-Email"),
    demo_name: str | None = Header(default=None, alias="X-Demo-User-Name"),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    if credentials and credentials.scheme.lower() == "bearer":
        claims = verify_supabase_access_token(credentials.credentials)
        return resolve_user_from_claims(db, claims)

    if not settings.dev_auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer authentication is required in this environment.",
        )

    email = (demo_email or settings.dev_auth_email).strip().lower()
    full_name = (demo_name or settings.dev_auth_name).strip()
    return resolve_demo_user(db, email, full_name)
