from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models.enums import ReceiptSource, ReceiptStatus, SyncTarget
from app.schemas.common import APIModel, Pagination


class ReceiptSyncState(str, Enum):
    NOT_CONNECTED = "not_connected"
    NOT_REQUESTED = "not_requested"
    QUEUED = "queued"
    SYNCING = "syncing"
    SYNCED = "synced"
    FAILED = "failed"


class ReceiptLineItemInput(APIModel):
    description: str
    quantity: Decimal | None = None
    unit_price: Decimal | None = None
    line_total: Decimal | None = None


class ReceiptLineItemRead(APIModel):
    description: str
    quantity: Decimal | None = None
    unit_price: Decimal | None = None
    line_total: Decimal | None = None


class ReceiptFileInput(APIModel):
    object_key: str
    mime_type: str
    original_filename: str | None = None


class ReceiptCreateRequest(APIModel):
    file: ReceiptFileInput
    source: ReceiptSource = ReceiptSource.CAMERA
    notes: str | None = None


class ReceiptUpdateRequest(APIModel):
    merchant_name: str | None = None
    transaction_date: date | None = None
    subtotal: Decimal | None = None
    tax: Decimal | None = None
    tip: Decimal | None = None
    total: Decimal | None = None
    payment_method: str | None = None
    category_id: UUID | None = None
    line_items: list[ReceiptLineItemInput] | None = None
    notes: str | None = None


class ReceiptApprovalRequest(APIModel):
    approved: bool = True
    sync_after_approval: list[SyncTarget] = Field(default_factory=list)


class ReceiptSyncRequest(APIModel):
    targets: list[SyncTarget] = Field(min_length=1)
    force_resync: bool = False


class ReceiptSyncTargets(APIModel):
    quickbooks: ReceiptSyncState
    excel: ReceiptSyncState


class SyncJobRead(APIModel):
    id: UUID
    target: SyncTarget
    status: str
    attempts: int
    external_object_id: str | None = None
    provider_request_id: str | None = None
    attachment_status: str | None = None
    attachment_error: str | None = None
    last_error_code: str | None = None
    last_error_message: str | None = None
    scheduled_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    updated_at: datetime


class ReceiptPayloadLayersRead(APIModel):
    raw_ocr_text: str | None = None
    ocr_payload: dict[str, Any] | None = None
    normalized_payload: dict[str, Any] | None = None
    final_payload: dict[str, Any] | None = None


class ReceiptDecisionRead(APIModel):
    decision_summary: list[str] = Field(default_factory=list)
    duplicate_of_receipt_id: UUID | None = None
    auto_approved: bool
    needs_review: bool


class ReceiptRead(APIModel):
    id: UUID
    status: ReceiptStatus
    source: ReceiptSource
    merchant_name: str | None = None
    receipt_number: str | None = None
    transaction_date: date | None = None
    currency: str
    subtotal: Decimal | None = None
    tax: Decimal | None = None
    tip: Decimal | None = None
    total: Decimal | None = None
    payment_method: str | None = None
    category_id: UUID | None = None
    category_name: str | None = None
    line_items: list[ReceiptLineItemRead]
    notes: str | None = None
    ocr_provider: str | None = None
    overall_confidence: Decimal | None = None
    confidence: dict[str, float] | None = None
    payload_layers: ReceiptPayloadLayersRead
    decision: ReceiptDecisionRead
    sync_targets: ReceiptSyncTargets
    sync_jobs: list[SyncJobRead]
    processed_at: datetime | None = None
    approved_at: datetime | None = None
    auto_approved_at: datetime | None = None
    processing_error: str | None = None
    created_at: datetime
    updated_at: datetime


class ReceiptListResponse(APIModel):
    data: list[ReceiptRead]
    pagination: Pagination


class ReceiptUploadCompleteRequest(APIModel):
    file_size_bytes: int | None = None
    sha256_hash: str | None = None


class ReceiptProcessRequest(APIModel):
    force_reprocess: bool = False


class ReceiptProcessingStatusRead(APIModel):
    receipt_id: UUID
    status: ReceiptStatus
    processed_at: datetime | None = None
    approved_at: datetime | None = None
    auto_approved_at: datetime | None = None
    processing_error: str | None = None
    decision: ReceiptDecisionRead
    overall_confidence: Decimal | None = None


class ReceiptSyncJobListResponse(APIModel):
    data: list[SyncJobRead]


class ReceiptSummaryResponse(APIModel):
    total_receipts: int
    review_required: int
    processing: int
    synced: int
    failed: int
    auto_approved: int
