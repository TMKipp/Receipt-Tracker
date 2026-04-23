from __future__ import annotations

from datetime import UTC, datetime, timedelta
import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.commercial import ExcelWorkbookBinding
from app.models.enums import IntegrationStatus, ReceiptStatus, SyncStatus, SyncTarget
from app.models.receipt import Receipt
from app.models.sync import SyncJob
from app.services.billing import get_workbook_binding
from app.services.microsoft_graph import append_receipt_row
from app.services.provider_errors import ProviderError
from app.services.quickbooks import sync_receipt_to_quickbooks
from app.services.receipts import build_final_payload


def _load_job(db: Session, job_id: uuid.UUID) -> SyncJob | None:
    return db.scalar(
        select(SyncJob)
        .where(SyncJob.id == job_id)
        .options(
            selectinload(SyncJob.receipt).selectinload(Receipt.user),
            selectinload(SyncJob.receipt).selectinload(Receipt.category),
            selectinload(SyncJob.receipt).selectinload(Receipt.vendor),
            selectinload(SyncJob.receipt).selectinload(Receipt.line_items),
            selectinload(SyncJob.receipt).selectinload(Receipt.sync_jobs),
            selectinload(SyncJob.integration_connection),
        )
    )


def _schedule_retry(job: SyncJob) -> None:
    delay_minutes = 2 ** max(0, job.attempts - 1)
    job.status = SyncStatus.QUEUED
    job.scheduled_at = datetime.now(UTC) + timedelta(minutes=delay_minutes)
    job.finished_at = None


def _refresh_receipt_status(receipt: Receipt) -> None:
    current_payload = build_final_payload(receipt)
    relevant_jobs = [job for job in receipt.sync_jobs if (job.request_payload or {}) == current_payload]
    if not relevant_jobs:
        if receipt.approved_at:
            receipt.status = ReceiptStatus.APPROVED
        return

    if any(job.status in {SyncStatus.QUEUED, SyncStatus.RUNNING} for job in relevant_jobs):
        receipt.status = ReceiptStatus.SYNCING
        return
    if any(job.status in {SyncStatus.FAILED, SyncStatus.NEEDS_REAUTH} for job in relevant_jobs):
        receipt.status = ReceiptStatus.FAILED
        return
    if any(job.status == SyncStatus.SUCCEEDED for job in relevant_jobs):
        receipt.status = ReceiptStatus.SYNCED


def _execute_target(db: Session, job: SyncJob) -> dict:
    connection = job.integration_connection
    receipt = job.receipt
    if connection is None or receipt is None:
        raise ProviderError("sync_missing_data", "The sync job is missing its receipt or integration connection record.")
    if connection.status not in {IntegrationStatus.CONNECTED, IntegrationStatus.ERROR, IntegrationStatus.EXPIRED}:
        raise ProviderError(
            "integration_not_connected",
            f"{connection.provider.value} is not connected for this user.",
            needs_reauth=True,
        )

    if job.target == SyncTarget.QUICKBOOKS:
        return sync_receipt_to_quickbooks(db, connection, receipt)

    if job.target == SyncTarget.EXCEL:
        binding: ExcelWorkbookBinding | None = get_workbook_binding(db, receipt.user)
        if binding is None:
            raise ProviderError("excel_workbook_missing", "No Excel workbook has been selected for this user yet.")
        return append_receipt_row(db, connection, binding, receipt)

    raise ProviderError("sync_target_unsupported", f"Sync target {job.target.value} is not implemented.")


def run_sync_job(db: Session, job_id: uuid.UUID) -> SyncJob:
    job = _load_job(db, job_id)
    if job is None:
        raise ProviderError("sync_job_missing", f"Sync job {job_id} was not found.")
    if job.receipt is None:
        raise ProviderError("receipt_missing", "The receipt attached to this sync job was not found.")
    if job.receipt.approved_at is None:
        raise ProviderError("receipt_not_approved", "Only approved receipts can be synced.")

    job.attempts += 1
    job.status = SyncStatus.RUNNING
    job.started_at = datetime.now(UTC)
    job.last_error_code = None
    job.last_error_message = None
    db.flush()

    try:
        result = _execute_target(db, job)
        job.status = SyncStatus.SUCCEEDED
        job.external_object_id = result.get("externalObjectId") or job.external_object_id
        job.response_payload = result
        job.finished_at = datetime.now(UTC)
        _refresh_receipt_status(job.receipt)
        db.flush()
        return job
    except ProviderError as exc:
        job.last_error_code = exc.code
        job.last_error_message = exc.message
        job.response_payload = {"error": exc.message, "details": exc.details}
        if exc.needs_reauth:
            job.status = SyncStatus.NEEDS_REAUTH
            if job.integration_connection is not None:
                job.integration_connection.status = IntegrationStatus.EXPIRED
            job.finished_at = datetime.now(UTC)
        elif exc.retryable and job.attempts < settings.max_sync_attempts:
            _schedule_retry(job)
        else:
            job.status = SyncStatus.FAILED
            if job.integration_connection is not None and job.integration_connection.status == IntegrationStatus.CONNECTED:
                job.integration_connection.status = IntegrationStatus.ERROR
            job.finished_at = datetime.now(UTC)
        _refresh_receipt_status(job.receipt)
        db.flush()
        return job


def run_due_sync_jobs(db: Session, *, limit: int = 25, user_id: uuid.UUID | None = None) -> list[SyncJob]:
    now = datetime.now(UTC)
    query = select(SyncJob).where(
        SyncJob.status == SyncStatus.QUEUED,
        or_(SyncJob.scheduled_at.is_(None), SyncJob.scheduled_at <= now),
    )
    if user_id is not None:
        query = query.where(SyncJob.user_id == user_id)
    jobs = db.scalars(
        query.order_by(SyncJob.scheduled_at.asc().nullsfirst(), SyncJob.created_at.asc()).limit(limit)
    ).all()
    return [run_sync_job(db, job.id) for job in jobs]
