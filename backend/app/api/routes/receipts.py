from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.enums import ReceiptStatus, VersionSource
from app.models.receipt import Receipt, ReceiptFile
from app.models.user import User
from app.schemas.common import Pagination
from app.schemas.receipts import (
    ReceiptApprovalRequest,
    ReceiptCreateRequest,
    ReceiptListResponse,
    ReceiptProcessingStatusRead,
    ReceiptRead,
    ReceiptSummaryResponse,
    ReceiptSyncJobListResponse,
    ReceiptSyncRequest,
    ReceiptUploadCompleteRequest,
    ReceiptUpdateRequest,
)
from app.services.processing import process_uploaded_receipt
from app.services.sync_runner import run_sync_job
from app.services.receipts import (
    add_receipt_version,
    build_processing_status,
    build_receipt_summary,
    build_final_payload,
    get_integration_map,
    get_or_create_vendor,
    get_receipt_or_404,
    invalidate_stale_sync_jobs,
    queue_sync_jobs,
    receipt_load_options,
    replace_line_items,
    resolve_category,
    serialize_receipt,
    serialize_sync_job,
)

router = APIRouter()


@router.post("", response_model=ReceiptRead, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    payload: ReceiptCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptRead:
    receipt = Receipt(
        user_id=current_user.id,
        source=payload.source,
        status=ReceiptStatus.UPLOADED,
        currency=current_user.default_currency,
        notes=payload.notes,
    )
    receipt.files.append(
        ReceiptFile(
            object_key=payload.file.object_key,
            mime_type=payload.file.mime_type,
            original_filename=payload.file.original_filename,
        )
    )
    db.add(receipt)
    db.flush()
    receipt.final_payload = build_final_payload(receipt)
    add_receipt_version(receipt, source=VersionSource.USER, user_id=current_user.id)
    db.commit()

    created = get_receipt_or_404(db, current_user.id, receipt.id)
    return serialize_receipt(created, get_integration_map(db, current_user.id))


@router.get("/summary", response_model=ReceiptSummaryResponse)
async def receipt_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptSummaryResponse:
    return build_receipt_summary(db, current_user.id)


@router.get("", response_model=ReceiptListResponse)
async def list_receipts(
    status_filter: ReceiptStatus | None = Query(default=None, alias="status"),
    q: str | None = None,
    from_date: date | None = Query(default=None, alias="fromDate"),
    to_date: date | None = Query(default=None, alias="toDate"),
    category_id: UUID | None = Query(default=None, alias="categoryId"),
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptListResponse:
    filters = [Receipt.user_id == current_user.id]
    if status_filter:
        filters.append(Receipt.status == status_filter)
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(or_(Receipt.merchant_name.ilike(pattern), Receipt.notes.ilike(pattern)))
    if from_date:
        filters.append(Receipt.transaction_date >= from_date)
    if to_date:
        filters.append(Receipt.transaction_date <= to_date)
    if category_id:
        filters.append(Receipt.category_id == category_id)

    total = db.scalar(select(func.count()).select_from(Receipt).where(*filters)) or 0
    receipts = db.scalars(
        select(Receipt)
        .where(*filters)
        .options(*receipt_load_options())
        .order_by(Receipt.updated_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    connections = get_integration_map(db, current_user.id)
    return ReceiptListResponse(
        data=[serialize_receipt(receipt, connections) for receipt in receipts],
        pagination=Pagination(limit=limit, offset=offset, total=total),
    )


@router.post("/{receipt_id}/upload-complete", response_model=ReceiptProcessingStatusRead)
async def complete_receipt_upload(
    receipt_id: UUID,
    payload: ReceiptUploadCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptProcessingStatusRead:
    receipt = get_receipt_or_404(db, current_user.id, receipt_id)
    if receipt.files:
        receipt.files[0].file_size_bytes = payload.file_size_bytes
        receipt.files[0].sha256_hash = payload.sha256_hash

    processed = process_uploaded_receipt(db, receipt)
    db.commit()
    return build_processing_status(processed)


@router.get("/{receipt_id}", response_model=ReceiptRead)
async def get_receipt(
    receipt_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptRead:
    receipt = get_receipt_or_404(db, current_user.id, receipt_id)
    return serialize_receipt(receipt, get_integration_map(db, current_user.id))


@router.patch("/{receipt_id}", response_model=ReceiptRead)
async def update_receipt(
    receipt_id: UUID,
    payload: ReceiptUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptRead:
    receipt = get_receipt_or_404(db, current_user.id, receipt_id)
    updates = payload.model_dump(exclude_unset=True)

    if "merchant_name" in updates:
        receipt.merchant_name = updates["merchant_name"]
        vendor = get_or_create_vendor(db, current_user.id, receipt.merchant_name)
        receipt.vendor = vendor
    if "transaction_date" in updates:
        receipt.transaction_date = updates["transaction_date"]
    if "subtotal" in updates:
        receipt.subtotal_amount = updates["subtotal"]
    if "tax" in updates:
        receipt.tax_amount = updates["tax"]
    if "tip" in updates:
        receipt.tip_amount = updates["tip"]
    if "total" in updates:
        receipt.total_amount = updates["total"]
    if "payment_method" in updates:
        receipt.payment_method = updates["payment_method"]
    if "notes" in updates:
        receipt.notes = updates["notes"]
    if "category_id" in updates:
        category = resolve_category(db, current_user.id, updates["category_id"])
        receipt.category = category
        receipt.category_id = category.id if category else None
    if "line_items" in updates and updates["line_items"] is not None:
        replace_line_items(receipt, payload.line_items or [])

    receipt.final_payload = build_final_payload(receipt)
    receipt.normalized_payload = {
        **(receipt.normalized_payload or {}),
        "decisionSummary": ["User edited receipt fields after OCR review."],
    }
    receipt.status = ReceiptStatus.REVIEW_REQUIRED
    receipt.approved_at = None
    receipt.auto_approved_at = None
    invalidate_stale_sync_jobs(receipt, "Queued sync jobs were invalidated because the receipt was edited.")
    add_receipt_version(receipt, source=VersionSource.USER, user_id=current_user.id)
    db.commit()

    updated = get_receipt_or_404(db, current_user.id, receipt.id)
    return serialize_receipt(updated, get_integration_map(db, current_user.id))


@router.get("/{receipt_id}/processing-status", response_model=ReceiptProcessingStatusRead)
async def receipt_processing_status(
    receipt_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptProcessingStatusRead:
    receipt = get_receipt_or_404(db, current_user.id, receipt_id)
    return build_processing_status(receipt)


@router.post("/{receipt_id}/approve", response_model=ReceiptRead)
async def approve_receipt(
    receipt_id: UUID,
    payload: ReceiptApprovalRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptRead:
    request_payload = payload or ReceiptApprovalRequest()
    if not request_payload.approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only approval is supported here.")

    receipt = get_receipt_or_404(db, current_user.id, receipt_id)
    receipt.status = ReceiptStatus.APPROVED
    receipt.approved_at = datetime.now(timezone.utc)
    receipt.final_payload = build_final_payload(receipt)
    add_receipt_version(receipt, source=VersionSource.USER, user_id=current_user.id)

    if request_payload.sync_after_approval:
        jobs = queue_sync_jobs(
            db=db,
            receipt=receipt,
            targets=request_payload.sync_after_approval,
            force_resync=False,
        )
        if settings.sync_run_inline:
            for job in jobs:
                run_sync_job(db, job.id)

    db.commit()
    approved_receipt = get_receipt_or_404(db, current_user.id, receipt.id)
    return serialize_receipt(approved_receipt, get_integration_map(db, current_user.id))


@router.post("/{receipt_id}/retry-processing", status_code=status.HTTP_202_ACCEPTED)
async def retry_processing(
    receipt_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptProcessingStatusRead:
    receipt = get_receipt_or_404(db, current_user.id, receipt_id)
    processed = process_uploaded_receipt(db, receipt)
    db.commit()
    return build_processing_status(processed)


@router.post("/{receipt_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_receipt(
    receipt_id: UUID,
    payload: ReceiptSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str | list[str]]:
    receipt = get_receipt_or_404(db, current_user.id, receipt_id)
    if receipt.approved_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Receipt must be approved before sync.",
        )

    jobs = queue_sync_jobs(
        db=db,
        receipt=receipt,
        targets=payload.targets,
        force_resync=payload.force_resync,
    )
    if settings.sync_run_inline:
        for job in jobs:
            run_sync_job(db, job.id)
    db.commit()
    return {
        "receiptId": str(receipt.id),
        "status": "executed" if settings.sync_run_inline else "queued",
        "targets": [job.target.value for job in jobs],
        "jobIds": [str(job.id) for job in jobs],
    }


@router.get("/{receipt_id}/sync-jobs", response_model=ReceiptSyncJobListResponse)
async def list_sync_jobs(
    receipt_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptSyncJobListResponse:
    receipt = get_receipt_or_404(db, current_user.id, receipt_id)
    jobs = sorted(receipt.sync_jobs, key=lambda job: job.created_at, reverse=True)
    return ReceiptSyncJobListResponse(data=[serialize_sync_job(job) for job in jobs])
