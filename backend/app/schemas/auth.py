from __future__ import annotations

from pydantic import Field

from app.models.enums import DevicePlatform
from app.schemas.common import APIModel, UserRead


class SessionExchangeRequest(APIModel):
    platform: DevicePlatform
    device_name: str = Field(min_length=1)
    app_version: str | None = None
    push_token: str | None = None


class SessionExchangeResponse(APIModel):
    access_token: str
    refresh_token: str
    expires_in_seconds: int
    user: UserRead
    device_session_id: str | None = None


class UserSettingsUpdateRequest(APIModel):
    full_name: str | None = None
    company_name: str | None = None
    default_currency: str | None = None
    timezone: str | None = None
    country_code: str | None = None
    auto_approve_enabled: bool | None = None
    onboarding_completed: bool | None = None
