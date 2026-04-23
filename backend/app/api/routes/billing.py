from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.enums import IntegrationProvider, IntegrationStatus
from app.models.integration import IntegrationConnection
from app.models.user import User
from app.schemas.billing import (
    BillingSnapshotResponse,
    EntitlementResponse,
    RevenueCatWebhookEnvelope,
    WorkbookBindingRead,
    WorkbookBindingRequest,
)
from app.services.microsoft_graph import validate_workbook_binding
from app.services.provider_errors import ProviderError
from app.services.billing import (
    apply_revenuecat_event,
    build_entitlement_response,
    get_workbook_binding,
    upsert_workbook_binding,
    verify_revenuecat_authorization,
    workbook_binding_to_read,
)

router = APIRouter()


@router.get("/entitlement", response_model=EntitlementResponse)
async def get_entitlement(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntitlementResponse:
    return build_entitlement_response(db, current_user)


@router.get("/excel-workbook", response_model=WorkbookBindingRead | None)
async def get_excel_workbook_binding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkbookBindingRead | None:
    return workbook_binding_to_read(get_workbook_binding(db, current_user))


@router.get("/snapshot", response_model=BillingSnapshotResponse)
async def get_billing_snapshot(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BillingSnapshotResponse:
    return BillingSnapshotResponse(
        entitlement=build_entitlement_response(db, current_user),
        workbook_binding=workbook_binding_to_read(get_workbook_binding(db, current_user)),
    )


@router.post("/webhooks/revenuecat", status_code=status.HTTP_202_ACCEPTED)
async def revenuecat_webhook(
    payload: RevenueCatWebhookEnvelope,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    verify_revenuecat_authorization(authorization)
    event = apply_revenuecat_event(db, payload.model_dump())
    db.commit()
    return {"status": "accepted", "eventId": str(event.id)}


@router.put("/excel-workbook", response_model=WorkbookBindingRead)
async def bind_excel_workbook(
    payload: WorkbookBindingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkbookBindingRead:
    binding = upsert_workbook_binding(
        db,
        current_user,
        drive_id=payload.drive_id,
        item_id=payload.item_id,
        table_id=payload.table_id,
        workbook_name=payload.workbook_name,
        worksheet_name=payload.worksheet_name,
        table_name=payload.table_name,
    )
    connection = db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == current_user.id,
            IntegrationConnection.provider == IntegrationProvider.MICROSOFT,
        )
    )
    if connection and connection.status == IntegrationStatus.CONNECTED:
        try:
            validate_workbook_binding(db, connection, binding)
        except ProviderError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc
    db.commit()
    db.refresh(binding)
    return workbook_binding_to_read(binding)
