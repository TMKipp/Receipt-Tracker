from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    auth_subject: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    company_name: Mapped[str | None] = mapped_column(String(255))
    default_currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="America/New_York", nullable=False)
    country_code: Mapped[str] = mapped_column(String(2), default="US", nullable=False)
    auto_approve_enabled: Mapped[bool] = mapped_column(default=False, nullable=False)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    receipts = relationship("Receipt", back_populates="user")
    vendors = relationship("Vendor", back_populates="user")
    categories = relationship("Category", back_populates="user")
    integration_connections = relationship("IntegrationConnection", back_populates="user")
    sync_jobs = relationship("SyncJob", back_populates="user")
    entitlements = relationship("Entitlement", back_populates="user")
    device_sessions = relationship("DeviceSession", back_populates="user")
    workbook_binding = relationship("ExcelWorkbookBinding", back_populates="user", uselist=False)
    support_tickets = relationship("SupportTicket", back_populates="user")
