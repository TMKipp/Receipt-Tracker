from __future__ import annotations

from datetime import datetime
from typing import Any
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ENUM as PGEnum, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import IntegrationProvider, SyncStatus, SyncTarget


class SyncJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "sync_jobs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    receipt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipts.id", ondelete="CASCADE"),
        index=True,
    )
    integration_connection_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integration_connections.id", ondelete="SET NULL"),
        index=True,
    )
    target: Mapped[SyncTarget] = mapped_column(
        PGEnum(SyncTarget, name="sync_target"),
        nullable=False,
    )
    status: Mapped[SyncStatus] = mapped_column(
        PGEnum(SyncStatus, name="sync_status"),
        default=SyncStatus.QUEUED,
        nullable=False,
    )
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    external_object_id: Mapped[str | None] = mapped_column(String(128))
    request_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    response_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error_code: Mapped[str | None] = mapped_column(String(64))
    last_error_message: Mapped[str | None] = mapped_column(String(2048))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="sync_jobs")
    receipt = relationship("Receipt", back_populates="sync_jobs")
    integration_connection = relationship("IntegrationConnection", back_populates="sync_jobs")


class WebhookEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "webhook_events"

    provider: Mapped[IntegrationProvider] = mapped_column(
        PGEnum(IntegrationProvider, name="webhook_provider"),
        nullable=False,
    )
    external_event_id: Mapped[str | None] = mapped_column(String(255), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
