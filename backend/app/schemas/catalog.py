from __future__ import annotations

from uuid import UUID

from app.schemas.common import APIModel


class CategoryRead(APIModel):
    id: UUID
    name: str
    source: str
    external_account_id: str | None = None
    external_account_type: str | None = None
    is_active: bool


class VendorRead(APIModel):
    id: UUID
    display_name: str
    normalized_name: str
    last_used_category_id: UUID | None = None


class CategoryListResponse(APIModel):
    data: list[CategoryRead]


class VendorListResponse(APIModel):
    data: list[VendorRead]

