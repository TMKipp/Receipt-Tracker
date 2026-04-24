from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.category import Category
from app.models.enums import (
    IntegrationProvider,
    IntegrationStatus,
    ReceiptStatus,
    SyncStatus,
    SyncTarget,
    VersionSource,
)
from app.models.integration import IntegrationConnection
from app.models.receipt import Receipt, ReceiptLineItem, ReceiptVersion
from app.models.sync import SyncJob
from app.models.vendor import Vendor
from app.schemas.catalog import CategoryRead, VendorRead
from app.schemas.integrations import IntegrationStatusRead
from app.schemas.receipts import (
    ReceiptDecisionRead,
    ReceiptLineItemInput,
    ReceiptLineItemRead,
    ReceiptPayloadLayersRead,
    ReceiptProcessingStatusRead,
    ReceiptRead,
    ReceiptSummaryResponse,
    SyncJobRead,
    ReceiptSyncState,
    ReceiptSyncTargets,
)


def receipt_load_options():
    return (
        selectinload(Receipt.user),
        selectinload(Receipt.category),
        selectinload(Receipt.vendor),
        selectinload(Receipt.files),
        selectinload(Receipt.line_items),
        selectinload(Receipt.versions),
        selectinload(Receipt.sync_jobs),
    )


def normalize_vendor_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()


def get_or_create_vendor(db: Session, user_id: uuid.UUID, merchant_name: str | None) -> Vendor | None:
    if not merchant_name:
        return None

    normalized_name = normalize_vendor_name(merchant_name)
    if not normalized_name:
        return None

    vendor = db.scalar(
        select(Vendor).where(
            Vendor.user_id == user_id,
            Vendor.normalized_name == normalized_name,
        )
    )
    if vendor is None:
        vendor = Vendor(
            user_id=user_id,
            normalized_name=normalized_name,
            display_name=merchant_name.strip(),
            receipt_count=0,
            first_seen_at=datetime.now(UTC),
        )
        db.add(vendor)
        db.flush()
    else:
        vendor.display_name = merchant_name.strip()
    vendor.last_seen_at = datetime.now(UTC)

    return vendor


def build_final_payload(receipt: Receipt) -> dict:
    return {
        "merchantName": receipt.merchant_name,
        "transactionDate": receipt.transaction_date.isoformat() if receipt.transaction_date else None,
        "currency": receipt.currency,
        "subtotal": str(receipt.subtotal_amount) if receipt.subtotal_amount is not None else None,
        "tax": str(receipt.tax_amount) if receipt.tax_amount is not None else None,
        "tip": str(receipt.tip_amount) if receipt.tip_amount is not None else None,
        "total": str(receipt.total_amount) if receipt.total_amount is not None else None,
        "paymentMethod": receipt.payment_method,
        "categoryId": str(receipt.category_id) if receipt.category_id else None,
        "notes": receipt.notes,
        "lineItems": [
            {
                "description": item.description,
                "quantity": str(item.quantity) if item.quantity is not None else None,
                "unitPrice": str(item.unit_price_amount) if item.unit_price_amount is not None else None,
                "lineTotal": str(item.line_total_amount) if item.line_total_amount is not None else None,
            }
            for item in receipt.line_items
        ],
    }


def add_receipt_version(receipt: Receipt, source: VersionSource, user_id: uuid.UUID | None = None) -> None:
    next_version = len(receipt.versions) + 1
    receipt.versions.append(
        ReceiptVersion(
            source=source,
            version_number=next_version,
            payload=build_final_payload(receipt),
            confidence_payload=receipt.field_confidence or {},
            created_by_user_id=user_id,
        )
    )


def resolve_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID | None) -> Category | None:
    if category_id is None:
        return None
    category = db.scalar(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    return category


def replace_line_items(receipt: Receipt, line_items: list[ReceiptLineItemInput]) -> None:
    receipt.line_items.clear()
    for index, item in enumerate(line_items, start=1):
        receipt.line_items.append(
            ReceiptLineItem(
                line_number=index,
                description=item.description,
                quantity=item.quantity,
                unit_price_amount=item.unit_price,
                line_total_amount=item.line_total,
            )
        )


def get_receipt_or_404(db: Session, user_id: uuid.UUID, receipt_id: uuid.UUID) -> Receipt:
    receipt = db.scalar(
        select(Receipt)
        .where(Receipt.id == receipt_id, Receipt.user_id == user_id)
        .options(*receipt_load_options())
    )
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found.")
    return receipt


def connection_provider_for_target(target: SyncTarget) -> IntegrationProvider:
    if target == SyncTarget.QUICKBOOKS:
        return IntegrationProvider.QUICKBOOKS
    return IntegrationProvider.MICROSOFT


def get_integration_map(db: Session, user_id: uuid.UUID) -> dict[IntegrationProvider, IntegrationConnection]:
    rows = db.scalars(
        select(IntegrationConnection).where(IntegrationConnection.user_id == user_id)
    ).all()
    return {row.provider: row for row in rows}


def compute_sync_state(
    receipt: Receipt,
    target: SyncTarget,
    connections: dict[IntegrationProvider, IntegrationConnection],
) -> ReceiptSyncState:
    provider = connection_provider_for_target(target)
    connection = connections.get(provider)
    if connection is None or connection.status != IntegrationStatus.CONNECTED:
        return ReceiptSyncState.NOT_CONNECTED

    latest_job = None
    for job in receipt.sync_jobs:
        if job.target == target:
            if latest_job is None or job.created_at > latest_job.created_at:
                latest_job = job

    if latest_job is None:
        return ReceiptSyncState.NOT_REQUESTED

    if (latest_job.request_payload or {}) != build_final_payload(receipt):
        return ReceiptSyncState.NOT_REQUESTED

    if latest_job.status == SyncStatus.QUEUED:
        return ReceiptSyncState.QUEUED
    if latest_job.status == SyncStatus.RUNNING:
        return ReceiptSyncState.SYNCING
    if latest_job.status == SyncStatus.SUCCEEDED:
        return ReceiptSyncState.SYNCED
    return ReceiptSyncState.FAILED


def serialize_sync_job(job: SyncJob) -> SyncJobRead:
    response_payload = job.response_payload if isinstance(job.response_payload, dict) else {}
    attachment_payload = response_payload.get("attachment") if isinstance(response_payload.get("attachment"), dict) else {}
    return SyncJobRead(
        id=job.id,
        target=job.target,
        status=job.status.value,
        attempts=job.attempts,
        external_object_id=job.external_object_id,
        provider_request_id=response_payload.get("requestId") if isinstance(response_payload.get("requestId"), str) else None,
        attachment_status=attachment_payload.get("status") if isinstance(attachment_payload.get("status"), str) else None,
        attachment_error=(
            attachment_payload.get("message")
            if isinstance(attachment_payload.get("message"), str)
            else attachment_payload.get("reason")
            if isinstance(attachment_payload.get("reason"), str)
            else None
        ),
        last_error_code=job.last_error_code,
        last_error_message=job.last_error_message,
        scheduled_at=job.scheduled_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        updated_at=job.updated_at,
    )


def build_receipt_decision(receipt: Receipt) -> ReceiptDecisionRead:
    normalized_payload = receipt.normalized_payload or {}
    return ReceiptDecisionRead(
        decision_summary=list(normalized_payload.get("decisionSummary") or []),
        duplicate_of_receipt_id=receipt.duplicate_of_receipt_id,
        auto_approved=receipt.auto_approved_at is not None,
        needs_review=receipt.status == ReceiptStatus.REVIEW_REQUIRED,
    )


def serialize_receipt(
    receipt: Receipt,
    connections: dict[IntegrationProvider, IntegrationConnection],
) -> ReceiptRead:
    sync_jobs = sorted(receipt.sync_jobs, key=lambda job: job.created_at, reverse=True)
    return ReceiptRead(
        id=receipt.id,
        status=receipt.status,
        source=receipt.source,
        merchant_name=receipt.merchant_name,
        receipt_number=receipt.receipt_number,
        transaction_date=receipt.transaction_date,
        currency=receipt.currency,
        subtotal=receipt.subtotal_amount,
        tax=receipt.tax_amount,
        tip=receipt.tip_amount,
        total=receipt.total_amount,
        payment_method=receipt.payment_method,
        category_id=receipt.category_id,
        category_name=receipt.category.name if receipt.category else None,
        line_items=[
            ReceiptLineItemRead(
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price_amount,
                line_total=item.line_total_amount,
            )
            for item in receipt.line_items
        ],
        notes=receipt.notes,
        ocr_provider=receipt.ocr_provider,
        overall_confidence=receipt.overall_confidence,
        confidence={
            key: float(value)
            for key, value in (receipt.field_confidence or {}).items()
            if value is not None
        }
        or None,
        payload_layers=ReceiptPayloadLayersRead(
            raw_ocr_text=receipt.raw_ocr_text,
            ocr_payload=receipt.ocr_payload,
            normalized_payload=receipt.normalized_payload,
            final_payload=receipt.final_payload,
        ),
        decision=build_receipt_decision(receipt),
        sync_targets=ReceiptSyncTargets(
            quickbooks=compute_sync_state(receipt, SyncTarget.QUICKBOOKS, connections),
            excel=compute_sync_state(receipt, SyncTarget.EXCEL, connections),
        ),
        sync_jobs=[serialize_sync_job(job) for job in sync_jobs],
        processed_at=receipt.processed_at,
        approved_at=receipt.approved_at,
        auto_approved_at=receipt.auto_approved_at,
        processing_error=receipt.processing_error,
        created_at=receipt.created_at,
        updated_at=receipt.updated_at,
    )


def serialize_category(category: Category) -> CategoryRead:
    return CategoryRead(
        id=category.id,
        name=category.name,
        source=category.source.value,
        external_account_id=category.external_account_id,
        external_account_type=category.external_account_type,
        is_active=category.is_active,
    )


def serialize_vendor(db: Session, vendor: Vendor) -> VendorRead:
    last_category_id = db.scalar(
        select(Receipt.category_id)
        .where(
            Receipt.user_id == vendor.user_id,
            Receipt.vendor_id == vendor.id,
            Receipt.category_id.is_not(None),
        )
        .order_by(Receipt.updated_at.desc())
        .limit(1)
    )
    return VendorRead(
        id=vendor.id,
        display_name=vendor.display_name,
        normalized_name=vendor.normalized_name,
        last_used_category_id=last_category_id,
    )


def serialize_integration_status(
    connection: IntegrationConnection | None,
    provider: IntegrationProvider,
) -> IntegrationStatusRead:
    return IntegrationStatusRead(
        provider=provider.value if isinstance(provider, IntegrationProvider) else str(provider),
        status=connection.status.value if connection else IntegrationStatus.NOT_CONNECTED.value,
        connected_at=connection.created_at if connection else None,
        external_tenant_name=connection.external_tenant_name if connection else None,
        scopes=list(connection.scopes or []) if connection else [],
    )


def build_idempotency_key(receipt: Receipt, target: SyncTarget) -> str:
    fingerprint = json.dumps(
        {
            "receiptId": str(receipt.id),
            "target": target.value,
            "payload": build_final_payload(receipt),
        },
        sort_keys=True,
    )
    return hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()


def queue_sync_jobs(
    db: Session,
    receipt: Receipt,
    targets: list[SyncTarget],
    force_resync: bool,
) -> list[SyncJob]:
    connections = get_integration_map(db, receipt.user_id)
    queued_jobs: list[SyncJob] = []

    for target in targets:
        provider = connection_provider_for_target(target)
        connection = connections.get(provider)
        if connection is None or connection.status != IntegrationStatus.CONNECTED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{provider.value} is not connected for this user.",
            )

        idempotency_key = build_idempotency_key(receipt, target)
        existing_job = db.scalar(
            select(SyncJob).where(SyncJob.idempotency_key == idempotency_key)
        )
        if existing_job and not force_resync:
            queued_jobs.append(existing_job)
            continue

        job = SyncJob(
            user_id=receipt.user_id,
            receipt_id=receipt.id,
            integration_connection_id=connection.id,
            target=target,
            status=SyncStatus.QUEUED,
            idempotency_key=idempotency_key if not force_resync else f"{idempotency_key}:{uuid.uuid4()}",
            request_payload=build_final_payload(receipt),
            scheduled_at=datetime.now(UTC),
        )
        db.add(job)
        queued_jobs.append(job)

    if queued_jobs:
        receipt.status = ReceiptStatus.SYNCING

    return queued_jobs


def invalidate_stale_sync_jobs(receipt: Receipt, reason: str) -> None:
    current_payload = build_final_payload(receipt)
    now = datetime.now(UTC)
    for job in receipt.sync_jobs:
        if (job.request_payload or {}) == current_payload:
            continue
        if job.status in {SyncStatus.QUEUED, SyncStatus.RUNNING}:
            job.status = SyncStatus.FAILED
            job.last_error_code = "superseded_by_edit"
            job.last_error_message = reason
            job.finished_at = now


def build_processing_status(receipt: Receipt) -> ReceiptProcessingStatusRead:
    return ReceiptProcessingStatusRead(
        receipt_id=receipt.id,
        status=receipt.status,
        processed_at=receipt.processed_at,
        approved_at=receipt.approved_at,
        auto_approved_at=receipt.auto_approved_at,
        processing_error=receipt.processing_error,
        decision=build_receipt_decision(receipt),
        overall_confidence=receipt.overall_confidence,
    )


def build_receipt_summary(db: Session, user_id: uuid.UUID) -> ReceiptSummaryResponse:
    def count_with_status(status_value: ReceiptStatus) -> int:
        return db.scalar(
            select(func.count(Receipt.id)).where(
                Receipt.user_id == user_id,
                Receipt.status == status_value,
            )
        ) or 0

    return ReceiptSummaryResponse(
        total_receipts=db.scalar(select(func.count(Receipt.id)).where(Receipt.user_id == user_id)) or 0,
        review_required=count_with_status(ReceiptStatus.REVIEW_REQUIRED),
        processing=count_with_status(ReceiptStatus.PROCESSING),
        synced=count_with_status(ReceiptStatus.SYNCED),
        failed=count_with_status(ReceiptStatus.FAILED),
        auto_approved=db.scalar(
            select(func.count(Receipt.id)).where(
                Receipt.user_id == user_id,
                Receipt.auto_approved_at.is_not(None),
            )
        ) or 0,
    )


def monthly_spend_query(db: Session, user_id: uuid.UUID, from_month: str | None, to_month: str | None):
    base = select(Receipt).where(
        Receipt.user_id == user_id,
        Receipt.transaction_date.is_not(None),
        Receipt.total_amount.is_not(None),
    )
    if from_month:
        base = base.where(func.to_char(Receipt.transaction_date, "YYYY-MM") >= from_month)
    if to_month:
        base = base.where(func.to_char(Receipt.transaction_date, "YYYY-MM") <= to_month)
    return db.scalars(base.options(selectinload(Receipt.category))).all()
