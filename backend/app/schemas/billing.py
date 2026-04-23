from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class EntitlementRead(APIModel):
    provider: str
    entitlement_key: str
    product_id: str | None = None
    status: str
    starts_at: datetime | None = None
    trial_ends_at: datetime | None = None
    expires_at: datetime | None = None
    latest_event_at: datetime | None = None
    app_user_id: str | None = None


class EntitlementResponse(APIModel):
    active: bool
    paywall_required: bool
    trial_days_remaining: int | None = None
    entitlement: EntitlementRead | None = None


class RevenueCatWebhookEnvelope(APIModel):
    event: dict = Field(default_factory=dict)


class WorkbookBindingRequest(APIModel):
    drive_id: str
    item_id: str
    table_id: str
    workbook_name: str | None = None
    worksheet_name: str | None = None
    table_name: str | None = None


class WorkbookBindingRead(APIModel):
    drive_id: str
    item_id: str
    table_id: str
    workbook_name: str | None = None
    worksheet_name: str | None = None
    table_name: str | None = None
    last_validated_at: datetime | None = None


class BillingSnapshotResponse(APIModel):
    entitlement: EntitlementResponse
    workbook_binding: WorkbookBindingRead | None = None
