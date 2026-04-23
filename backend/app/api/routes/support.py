from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.commercial import SupportTicket
from app.models.user import User
from app.schemas.support import SupportTicketCreateRequest, SupportTicketListResponse, SupportTicketRead

router = APIRouter()


@router.get("/tickets", response_model=SupportTicketListResponse)
async def list_support_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SupportTicketListResponse:
    tickets = db.scalars(
        select(SupportTicket)
        .where(SupportTicket.user_id == current_user.id)
        .order_by(SupportTicket.created_at.desc())
    ).all()
    return SupportTicketListResponse(data=[SupportTicketRead.model_validate(ticket) for ticket in tickets])


@router.post("/tickets", response_model=SupportTicketRead, status_code=status.HTTP_201_CREATED)
async def create_support_ticket(
    payload: SupportTicketCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SupportTicketRead:
    ticket = SupportTicket(
        user_id=current_user.id,
        receipt_id=payload.receipt_id,
        subject=payload.subject,
        body=payload.body,
        priority=payload.priority,
        opened_at=datetime.now(UTC),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return SupportTicketRead.model_validate(ticket)
