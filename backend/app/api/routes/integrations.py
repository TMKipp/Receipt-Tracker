from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.commercial import ExcelWorkbookBinding
from app.models.enums import IntegrationProvider, IntegrationStatus
from app.models.integration import IntegrationConnection
from app.models.user import User
from app.schemas.integrations import (
    ConnectUrlRequest,
    ConnectUrlResponse,
    IntegrationHealthResponse,
    IntegrationStatusRead,
    OAuthCallbackRequest,
)
from app.services.billing import workbook_binding_to_read
from app.services.microsoft_graph import begin_microsoft_connection, complete_microsoft_callback
from app.services.provider_errors import ProviderError
from app.services.quickbooks import begin_quickbooks_connection, complete_quickbooks_callback
from app.services.receipts import serialize_integration_status
from app.services.sync_runner import run_due_sync_jobs

router = APIRouter()


def _raise_provider_error(exc: ProviderError) -> None:
    status_code = status.HTTP_409_CONFLICT
    if exc.code == "oauth_state_mismatch":
        status_code = status.HTTP_400_BAD_REQUEST
    elif exc.needs_reauth:
        status_code = status.HTTP_401_UNAUTHORIZED
    elif exc.retryable:
        status_code = status.HTTP_502_BAD_GATEWAY
    raise HTTPException(status_code=status_code, detail=exc.message) from exc


@router.post("/quickbooks/connect-url", response_model=ConnectUrlResponse)
async def quickbooks_connect_url(
    payload: ConnectUrlRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConnectUrlResponse:
    state, authorization_url = begin_quickbooks_connection(db, current_user, payload.redirect_uri)
    db.commit()
    return ConnectUrlResponse(
        authorization_url=authorization_url,
        state=state,
    )


@router.post("/quickbooks/callback", response_model=IntegrationStatusRead)
async def quickbooks_callback(
    payload: OAuthCallbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationStatusRead:
    try:
        connection = complete_quickbooks_callback(
            db,
            user=current_user,
            code=payload.code,
            state=payload.state,
            realm_id=payload.realm_id,
        )
    except ProviderError as exc:
        _raise_provider_error(exc)
    db.commit()
    db.refresh(connection)
    return serialize_integration_status(connection, IntegrationProvider.QUICKBOOKS)


@router.get("/quickbooks/status", response_model=IntegrationStatusRead)
async def quickbooks_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationStatusRead:
    connection = db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == current_user.id,
            IntegrationConnection.provider == IntegrationProvider.QUICKBOOKS,
        )
    )
    return serialize_integration_status(connection, IntegrationProvider.QUICKBOOKS)


@router.post("/microsoft/connect-url", response_model=ConnectUrlResponse)
async def microsoft_connect_url(
    payload: ConnectUrlRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConnectUrlResponse:
    state, authorization_url = begin_microsoft_connection(db, current_user, payload.redirect_uri)
    db.commit()
    return ConnectUrlResponse(
        authorization_url=authorization_url,
        state=state,
    )


@router.post("/microsoft/callback", response_model=IntegrationStatusRead)
async def microsoft_callback(
    payload: OAuthCallbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationStatusRead:
    try:
        connection = complete_microsoft_callback(
            db,
            user=current_user,
            code=payload.code,
            state=payload.state,
        )
    except ProviderError as exc:
        _raise_provider_error(exc)
    db.commit()
    db.refresh(connection)
    return serialize_integration_status(connection, IntegrationProvider.MICROSOFT)


@router.get("/microsoft/status", response_model=IntegrationStatusRead)
async def microsoft_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationStatusRead:
    connection = db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == current_user.id,
            IntegrationConnection.provider == IntegrationProvider.MICROSOFT,
        )
    )
    return serialize_integration_status(connection, IntegrationProvider.MICROSOFT)


@router.get("/health", response_model=IntegrationHealthResponse)
async def integration_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationHealthResponse:
    quickbooks = db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == current_user.id,
            IntegrationConnection.provider == IntegrationProvider.QUICKBOOKS,
        )
    )
    microsoft = db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == current_user.id,
            IntegrationConnection.provider == IntegrationProvider.MICROSOFT,
        )
    )
    workbook = db.scalar(select(ExcelWorkbookBinding).where(ExcelWorkbookBinding.user_id == current_user.id))

    sync_ready_targets: list[str] = []
    if quickbooks and quickbooks.status == IntegrationStatus.CONNECTED:
        sync_ready_targets.append("quickbooks")
    if microsoft and microsoft.status == IntegrationStatus.CONNECTED and workbook is not None:
        sync_ready_targets.append("excel")

    return IntegrationHealthResponse(
        quickbooks=serialize_integration_status(quickbooks, IntegrationProvider.QUICKBOOKS),
        microsoft=serialize_integration_status(microsoft, IntegrationProvider.MICROSOFT),
        workbook_binding=workbook_binding_to_read(workbook),
        sync_ready_targets=sync_ready_targets,
    )


@router.post("/sync-jobs/run")
async def run_sync_jobs(
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    jobs = run_due_sync_jobs(db, limit=limit, user_id=current_user.id)
    db.commit()
    return {
        "executed": len(jobs),
        "jobIds": [str(job.id) for job in jobs],
        "statuses": {str(job.id): job.status.value for job in jobs},
    }
