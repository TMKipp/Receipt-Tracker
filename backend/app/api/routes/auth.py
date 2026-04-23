from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.deps import get_db
from app.models.commercial import DeviceSession
from app.models.user import User
from app.schemas.auth import SessionExchangeRequest, SessionExchangeResponse, UserSettingsUpdateRequest
from app.schemas.common import UserRead
from app.services.auth import register_device_session
from sqlalchemy.orm import Session

router = APIRouter()


@router.post("/session/exchange", response_model=SessionExchangeResponse)
async def exchange_session(
    payload: SessionExchangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionExchangeResponse:
    device_session: DeviceSession = register_device_session(
        db,
        user=current_user,
        platform=payload.platform,
        device_name=payload.device_name,
        app_version=payload.app_version,
        push_token=payload.push_token,
    )
    db.commit()
    db.refresh(current_user)
    return SessionExchangeResponse(
        access_token="supabase-client-managed",
        refresh_token="supabase-client-managed",
        expires_in_seconds=3600,
        user=UserRead.model_validate(current_user),
        device_session_id=str(device_session.id),
    )


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead)
async def update_me(
    payload: UserSettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserRead:
    updates = payload.model_dump(exclude_unset=True)
    if "full_name" in updates:
        current_user.full_name = updates["full_name"]
    if "company_name" in updates:
        current_user.company_name = updates["company_name"]
    if "default_currency" in updates and updates["default_currency"]:
        current_user.default_currency = updates["default_currency"].upper()
    if "timezone" in updates and updates["timezone"]:
        current_user.timezone = updates["timezone"]
    if "country_code" in updates and updates["country_code"]:
        current_user.country_code = updates["country_code"].upper()
    if "auto_approve_enabled" in updates and updates["auto_approve_enabled"] is not None:
        current_user.auto_approve_enabled = updates["auto_approve_enabled"]
    if updates.get("onboarding_completed"):
        current_user.onboarding_completed_at = datetime.now(UTC)

    db.commit()
    db.refresh(current_user)
    return UserRead.model_validate(current_user)
