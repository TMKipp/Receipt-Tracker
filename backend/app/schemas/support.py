from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.models.enums import SupportTicketPriority, SupportTicketStatus
from app.schemas.common import APIModel


class SupportTicketCreateRequest(APIModel):
    subject: str
    body: str
    receipt_id: UUID | None = None
    priority: SupportTicketPriority = SupportTicketPriority.NORMAL


class SupportTicketRead(APIModel):
    id: UUID
    subject: str
    body: str
    receipt_id: UUID | None = None
    status: SupportTicketStatus
    priority: SupportTicketPriority
    resolution_notes: str | None = None
    opened_at: datetime | None = None
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SupportTicketListResponse(APIModel):
    data: list[SupportTicketRead]

