from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.commercial import Entitlement, ExcelWorkbookBinding, SubscriptionEvent
from app.models.enums import BillingProvider, EntitlementStatus
from app.models.user import User
from app.schemas.billing import EntitlementRead, EntitlementResponse, WorkbookBindingRead


def entitlement_to_read(entitlement: Entitlement | None) -> EntitlementRead | None:
    if entitlement is None:
        return None
    return EntitlementRead(
        provider=entitlement.provider.value,
        entitlement_key=entitlement.entitlement_key,
        product_id=entitlement.product_id,
        status=entitlement.status.value,
        starts_at=entitlement.starts_at,
        trial_ends_at=entitlement.trial_ends_at,
        expires_at=entitlement.expires_at,
        latest_event_at=entitlement.latest_event_at,
        app_user_id=entitlement.app_user_id,
    )


def get_effective_entitlement(db: Session, user: User) -> Entitlement | None:
    return db.scalar(
        select(Entitlement)
        .where(
            Entitlement.user_id == user.id,
            Entitlement.provider == BillingProvider.REVENUECAT,
            Entitlement.entitlement_key == settings.revenuecat_entitlement_key,
        )
        .order_by(Entitlement.updated_at.desc())
    )


def build_entitlement_response(db: Session, user: User) -> EntitlementResponse:
    entitlement = get_effective_entitlement(db, user)
    if entitlement is None:
        trial_anchor = user.created_at
        trial_end = trial_anchor + timedelta(days=settings.default_trial_days)
        remaining = max(0, (trial_end - datetime.now(UTC)).days)
        return EntitlementResponse(
            active=remaining > 0,
            paywall_required=remaining <= 0,
            trial_days_remaining=remaining,
            entitlement=None,
        )

    is_active = entitlement.status in {EntitlementStatus.TRIALING, EntitlementStatus.ACTIVE, EntitlementStatus.GRACE_PERIOD}
    remaining = None
    if entitlement.trial_ends_at:
        remaining = max(0, (entitlement.trial_ends_at - datetime.now(UTC)).days)
    return EntitlementResponse(
        active=is_active,
        paywall_required=not is_active,
        trial_days_remaining=remaining,
        entitlement=entitlement_to_read(entitlement),
    )


def verify_revenuecat_authorization(header_value: str | None) -> None:
    expected = settings.revenuecat_webhook_authorization.strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RevenueCat webhook authorization is not configured.",
        )
    actual = (header_value or "").strip()
    if actual == expected:
        return
    if actual.startswith("Bearer ") and actual.removeprefix("Bearer ").strip() == expected:
        return
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid RevenueCat authorization.")


def resolve_revenuecat_user(db: Session, event: dict[str, Any]) -> User | None:
    app_user_id = str(event.get("app_user_id") or "").strip()
    original_app_user_id = str(event.get("original_app_user_id") or "").strip()
    for candidate in (app_user_id, original_app_user_id):
        if not candidate:
            continue
        user = db.scalar(select(User).where(User.auth_subject == candidate))
        if user is None:
            try:
                user = db.get(User, candidate)
            except Exception:
                user = None
        if user:
            return user
    return None


def map_revenuecat_status(event_type: str, expiration_at: datetime | None) -> EntitlementStatus:
    if event_type in {"INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"} and expiration_at is None:
        return EntitlementStatus.ACTIVE
    if event_type in {"INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE"}:
        return EntitlementStatus.ACTIVE
    if event_type == "BILLING_ISSUE":
        return EntitlementStatus.GRACE_PERIOD
    if event_type in {"CANCELLATION", "UNCANCELLATION"}:
        return EntitlementStatus.CANCELED
    if event_type == "EXPIRATION":
        return EntitlementStatus.EXPIRED
    return EntitlementStatus.TRIALING


def parse_ms_timestamp(value: Any) -> datetime | None:
    if value in (None, "", 0):
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=UTC)
    return None


def apply_revenuecat_event(db: Session, payload: dict[str, Any]) -> SubscriptionEvent:
    event = payload.get("event", payload)
    event_type = str(event.get("type") or event.get("event") or "UNKNOWN")
    external_event_id = str(
        event.get("id")
        or event.get("event_id")
        or f"{event_type}:{event.get('event_timestamp_ms') or datetime.now(UTC).timestamp()}"
    )
    user = resolve_revenuecat_user(db, event)
    event_at = parse_ms_timestamp(event.get("event_timestamp_ms"))
    subscription_event = db.scalar(
        select(SubscriptionEvent).where(
            SubscriptionEvent.provider == BillingProvider.REVENUECAT,
            SubscriptionEvent.external_event_id == external_event_id,
        )
    )
    if subscription_event is None:
        subscription_event = SubscriptionEvent(
            user_id=user.id if user else None,
            provider=BillingProvider.REVENUECAT,
            external_event_id=external_event_id,
            event_type=event_type,
            event_at=event_at,
            payload=event,
        )
        db.add(subscription_event)
    else:
        subscription_event.user_id = user.id if user else subscription_event.user_id
        subscription_event.event_type = event_type
        subscription_event.event_at = event_at
        subscription_event.payload = event

    if user:
        entitlement = get_effective_entitlement(db, user)
        if entitlement is None:
            entitlement = Entitlement(
                user_id=user.id,
                provider=BillingProvider.REVENUECAT,
                entitlement_key=settings.revenuecat_entitlement_key,
            )
            db.add(entitlement)
        expiration_at = parse_ms_timestamp(event.get("expiration_at_ms"))
        entitlement.status = map_revenuecat_status(event_type, expiration_at)
        entitlement.product_id = event.get("product_id")
        entitlement.app_user_id = event.get("app_user_id")
        entitlement.original_app_user_id = event.get("original_app_user_id")
        entitlement.store = event.get("store")
        entitlement.starts_at = parse_ms_timestamp(event.get("purchased_at_ms")) or entitlement.starts_at
        entitlement.trial_ends_at = parse_ms_timestamp(event.get("expiration_at_ms"))
        entitlement.expires_at = expiration_at
        entitlement.latest_event_at = event_at
        entitlement.metadata_json = event

    subscription_event.processed_at = datetime.now(UTC)
    db.flush()
    return subscription_event


def upsert_workbook_binding(
    db: Session,
    user: User,
    *,
    drive_id: str,
    item_id: str,
    table_id: str,
    workbook_name: str | None,
    worksheet_name: str | None,
    table_name: str | None,
) -> ExcelWorkbookBinding:
    binding = db.scalar(select(ExcelWorkbookBinding).where(ExcelWorkbookBinding.user_id == user.id))
    if binding is None:
        binding = ExcelWorkbookBinding(user_id=user.id, drive_id=drive_id, item_id=item_id, table_id=table_id)
        db.add(binding)
    binding.drive_id = drive_id
    binding.item_id = item_id
    binding.table_id = table_id
    binding.workbook_name = workbook_name
    binding.worksheet_name = worksheet_name
    binding.table_name = table_name
    binding.last_validated_at = datetime.now(UTC)
    db.flush()
    return binding


def get_workbook_binding(db: Session, user: User) -> ExcelWorkbookBinding | None:
    return db.scalar(select(ExcelWorkbookBinding).where(ExcelWorkbookBinding.user_id == user.id))


def workbook_binding_to_read(binding: ExcelWorkbookBinding | None) -> WorkbookBindingRead | None:
    if binding is None:
        return None
    return WorkbookBindingRead(
        drive_id=binding.drive_id,
        item_id=binding.item_id,
        table_id=binding.table_id,
        workbook_name=binding.workbook_name,
        worksheet_name=binding.worksheet_name,
        table_name=binding.table_name,
        last_validated_at=binding.last_validated_at,
    )
