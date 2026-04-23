from __future__ import annotations

from datetime import datetime
from typing import Any
import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM as PGEnum, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import (
    BillingProvider,
    DevicePlatform,
    EntitlementStatus,
    SupportTicketPriority,
    SupportTicketStatus,
)


class Entitlement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "entitlements"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", "entitlement_key", name="uq_entitlements_user_provider_key"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    provider: Mapped[BillingProvider] = mapped_column(
        PGEnum(BillingProvider, name="billing_provider"),
        nullable=False,
    )
    entitlement_key: Mapped[str] = mapped_column(String(120), nullable=False)
    product_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[EntitlementStatus] = mapped_column(
        PGEnum(EntitlementStatus, name="entitlement_status"),
        nullable=False,
        default=EntitlementStatus.TRIALING,
    )
    app_user_id: Mapped[str | None] = mapped_column(String(255), index=True)
    original_app_user_id: Mapped[str | None] = mapped_column(String(255))
    store: Mapped[str | None] = mapped_column(String(80))
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latest_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)

    user = relationship("User", back_populates="entitlements")


class SubscriptionEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "subscription_events"
    __table_args__ = (
        UniqueConstraint("provider", "external_event_id", name="uq_subscription_events_provider_event"),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    provider: Mapped[BillingProvider] = mapped_column(
        PGEnum(BillingProvider, name="subscription_event_provider"),
        nullable=False,
    )
    external_event_id: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DeviceSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "device_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    platform: Mapped[DevicePlatform] = mapped_column(
        PGEnum(DevicePlatform, name="device_platform"),
        nullable=False,
    )
    device_name: Mapped[str] = mapped_column(String(255), nullable=False)
    app_version: Mapped[str | None] = mapped_column(String(64))
    push_token: Mapped[str | None] = mapped_column(String(255))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="device_sessions")


class ExcelWorkbookBinding(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "excel_workbook_bindings"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_excel_workbook_bindings_user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    drive_id: Mapped[str] = mapped_column(String(255), nullable=False)
    item_id: Mapped[str] = mapped_column(String(255), nullable=False)
    workbook_name: Mapped[str | None] = mapped_column(String(255))
    worksheet_name: Mapped[str | None] = mapped_column(String(255))
    table_id: Mapped[str] = mapped_column(String(255), nullable=False)
    table_name: Mapped[str | None] = mapped_column(String(255))
    last_validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="workbook_binding")


class SupportTicket(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "support_tickets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipts.id", ondelete="SET NULL"),
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SupportTicketStatus] = mapped_column(
        PGEnum(SupportTicketStatus, name="support_ticket_status"),
        nullable=False,
        default=SupportTicketStatus.OPEN,
    )
    priority: Mapped[SupportTicketPriority] = mapped_column(
        PGEnum(SupportTicketPriority, name="support_ticket_priority"),
        nullable=False,
        default=SupportTicketPriority.NORMAL,
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="support_tickets")
