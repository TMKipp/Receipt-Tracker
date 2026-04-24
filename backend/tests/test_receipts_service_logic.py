from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.models.enums import IntegrationProvider, IntegrationStatus, SyncStatus, SyncTarget
from app.schemas.receipts import ReceiptSyncState
from app.services.receipts import (
    build_idempotency_key,
    compute_sync_state,
    invalidate_stale_sync_jobs,
    normalize_vendor_name,
    serialize_sync_job,
)


def _make_line_item() -> SimpleNamespace:
    return SimpleNamespace(
        description="Line item",
        quantity=Decimal("1"),
        unit_price_amount=Decimal("10.00"),
        line_total_amount=Decimal("10.00"),
    )


def _make_receipt(**overrides) -> SimpleNamespace:
    defaults = {
        "id": uuid4(),
        "merchant_name": "Acme Supply",
        "transaction_date": date(2026, 4, 24),
        "currency": "USD",
        "subtotal_amount": Decimal("10.00"),
        "tax_amount": Decimal("0.80"),
        "tip_amount": Decimal("0.00"),
        "total_amount": Decimal("10.80"),
        "payment_method": "Visa",
        "category_id": uuid4(),
        "notes": "Office expense",
        "line_items": [_make_line_item()],
        "sync_jobs": [],
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _make_sync_job(
    *,
    target: SyncTarget,
    request_payload: dict | None,
    status: SyncStatus,
    created_at: datetime | None = None,
) -> SimpleNamespace:
    now = created_at or datetime.now(UTC)
    return SimpleNamespace(
        id=uuid4(),
        target=target,
        status=status,
        attempts=1,
        external_object_id=None,
        response_payload=None,
        request_payload=request_payload,
        last_error_code=None,
        last_error_message=None,
        scheduled_at=None,
        started_at=None,
        finished_at=None,
        updated_at=now,
        created_at=now,
    )


def test_normalize_vendor_name_compacts_symbols() -> None:
    assert normalize_vendor_name("LOWE'S HOME CENTERS, LLC!") == "lowe s home centers llc"


def test_build_idempotency_key_is_stable_and_changes_with_payload() -> None:
    receipt = _make_receipt()
    first = build_idempotency_key(receipt, SyncTarget.QUICKBOOKS)
    second = build_idempotency_key(receipt, SyncTarget.QUICKBOOKS)
    assert first == second

    receipt.notes = "Different note"
    third = build_idempotency_key(receipt, SyncTarget.QUICKBOOKS)
    assert third != first


def test_compute_sync_state_reports_not_connected_without_connection() -> None:
    receipt = _make_receipt()
    state = compute_sync_state(receipt, SyncTarget.QUICKBOOKS, {})
    assert state == ReceiptSyncState.NOT_CONNECTED


def test_compute_sync_state_reports_synced_for_matching_succeeded_job() -> None:
    receipt = _make_receipt()
    payload = {
        "merchantName": receipt.merchant_name,
        "transactionDate": receipt.transaction_date.isoformat(),
        "currency": receipt.currency,
        "subtotal": "10.00",
        "tax": "0.80",
        "tip": "0.00",
        "total": "10.80",
        "paymentMethod": receipt.payment_method,
        "categoryId": str(receipt.category_id),
        "notes": receipt.notes,
        "lineItems": [
            {
                "description": "Line item",
                "quantity": "1",
                "unitPrice": "10.00",
                "lineTotal": "10.00",
            }
        ],
    }
    receipt.sync_jobs = [
        _make_sync_job(target=SyncTarget.QUICKBOOKS, request_payload=payload, status=SyncStatus.SUCCEEDED)
    ]
    connections = {
        IntegrationProvider.QUICKBOOKS: SimpleNamespace(status=IntegrationStatus.CONNECTED),
    }
    state = compute_sync_state(receipt, SyncTarget.QUICKBOOKS, connections)
    assert state == ReceiptSyncState.SYNCED


def test_compute_sync_state_reports_not_requested_for_stale_payload() -> None:
    receipt = _make_receipt()
    receipt.sync_jobs = [
        _make_sync_job(
            target=SyncTarget.QUICKBOOKS,
            request_payload={"merchantName": "Stale Merchant"},
            status=SyncStatus.SUCCEEDED,
        )
    ]
    connections = {
        IntegrationProvider.QUICKBOOKS: SimpleNamespace(status=IntegrationStatus.CONNECTED),
    }
    state = compute_sync_state(receipt, SyncTarget.QUICKBOOKS, connections)
    assert state == ReceiptSyncState.NOT_REQUESTED


def test_serialize_sync_job_includes_support_safe_attachment_fields() -> None:
    now = datetime.now(UTC)
    job = SimpleNamespace(
        id=uuid4(),
        target=SyncTarget.QUICKBOOKS,
        status=SyncStatus.SUCCEEDED,
        attempts=2,
        external_object_id="purchase-123",
        response_payload={
            "requestId": "req-001",
            "attachment": {"status": "failed", "message": "provider timeout"},
        },
        last_error_code=None,
        last_error_message=None,
        scheduled_at=None,
        started_at=now,
        finished_at=now,
        updated_at=now,
    )

    serialized = serialize_sync_job(job)
    assert serialized.provider_request_id == "req-001"
    assert serialized.attachment_status == "failed"
    assert serialized.attachment_error == "provider timeout"


def test_invalidate_stale_sync_jobs_fails_queued_and_running_only() -> None:
    receipt = _make_receipt()
    current_payload = {
        "merchantName": receipt.merchant_name,
        "transactionDate": receipt.transaction_date.isoformat(),
        "currency": receipt.currency,
        "subtotal": "10.00",
        "tax": "0.80",
        "tip": "0.00",
        "total": "10.80",
        "paymentMethod": receipt.payment_method,
        "categoryId": str(receipt.category_id),
        "notes": receipt.notes,
        "lineItems": [
            {
                "description": "Line item",
                "quantity": "1",
                "unitPrice": "10.00",
                "lineTotal": "10.00",
            }
        ],
    }
    queued = _make_sync_job(target=SyncTarget.QUICKBOOKS, request_payload={"old": True}, status=SyncStatus.QUEUED)
    running = _make_sync_job(target=SyncTarget.EXCEL, request_payload={"old": True}, status=SyncStatus.RUNNING)
    succeeded = _make_sync_job(
        target=SyncTarget.QUICKBOOKS,
        request_payload={"old": True},
        status=SyncStatus.SUCCEEDED,
    )
    matching = _make_sync_job(target=SyncTarget.QUICKBOOKS, request_payload=current_payload, status=SyncStatus.QUEUED)
    receipt.sync_jobs = [queued, running, succeeded, matching]

    invalidate_stale_sync_jobs(receipt, "Receipt was edited")

    assert queued.status == SyncStatus.FAILED
    assert queued.last_error_code == "superseded_by_edit"
    assert running.status == SyncStatus.FAILED
    assert running.last_error_message == "Receipt was edited"
    assert succeeded.status == SyncStatus.SUCCEEDED
    assert matching.status == SyncStatus.QUEUED
