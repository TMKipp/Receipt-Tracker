from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class APIModel(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel,
    )


class Pagination(APIModel):
    limit: int
    offset: int
    total: int


class UserRead(APIModel):
    id: UUID
    email: str
    full_name: str | None = None
    company_name: str | None = None
    default_currency: str
    timezone: str
    country_code: str
    auto_approve_enabled: bool
    onboarding_completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
