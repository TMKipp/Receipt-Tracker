from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.receipt import Receipt
from app.models.sync import SyncJob
from app.services.processing import run_processing_backlog
from app.services.sync_runner import run_due_sync_jobs


@dataclass(frozen=True)
class WorkerRunSummary:
    processed_receipts: list[dict[str, str | None]]
    sync_jobs: list[dict[str, str | int | None]]

    def as_dict(self) -> dict[str, object]:
        return {
            "processedReceiptCount": len(self.processed_receipts),
            "syncJobCount": len(self.sync_jobs),
            "processedReceipts": self.processed_receipts,
            "syncJobs": self.sync_jobs,
        }


def _receipt_summary(receipt: Receipt) -> dict[str, str | None]:
    return {
        "id": str(receipt.id),
        "status": receipt.status.value,
        "merchantName": receipt.merchant_name,
        "total": str(receipt.total_amount) if receipt.total_amount is not None else None,
        "processingError": receipt.processing_error,
    }


def _sync_job_summary(job: SyncJob) -> dict[str, str | int | None]:
    return {
        "id": str(job.id),
        "receiptId": str(job.receipt_id),
        "target": job.target.value,
        "status": job.status.value,
        "attempts": job.attempts,
        "lastErrorCode": job.last_error_code,
        "lastErrorMessage": job.last_error_message,
    }


def run_worker_once(
    db: Session,
    *,
    processing_limit: int = 25,
    sync_limit: int = 25,
    user_id: UUID | None = None,
) -> WorkerRunSummary:
    processed_receipts = run_processing_backlog(db, limit=processing_limit, user_id=user_id)
    db.flush()
    sync_jobs = run_due_sync_jobs(db, limit=sync_limit, user_id=user_id)
    db.flush()

    return WorkerRunSummary(
        processed_receipts=[_receipt_summary(receipt) for receipt in processed_receipts],
        sync_jobs=[_sync_job_summary(job) for job in sync_jobs],
    )
