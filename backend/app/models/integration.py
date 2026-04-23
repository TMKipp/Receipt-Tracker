from __future__ import annotations

from datetime import datetime
from typing import Any
import uuid

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, ENUM as PGEnum, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import IntegrationProvider, IntegrationStatus


class IntegrationConnection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integration_connections"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_integration_connections_user_provider"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    provider: Mapped[IntegrationProvider] = mapped_column(
        PGEnum(IntegrationProvider, name="integration_provider"),
        nullable=False,
    )
    status: Mapped[IntegrationStatus] = mapped_column(
        PGEnum(IntegrationStatus, name="integration_status"),
        nullable=False,
        default=IntegrationStatus.NOT_CONNECTED,
    )
    external_tenant_id: Mapped[str | None] = mapped_column(String(128))
    external_tenant_name: Mapped[str | None] = mapped_column(String(255))
    access_token_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    refresh_token_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scopes: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)

    user = relationship("User", back_populates="integration_connections")
    sync_jobs = relationship("SyncJob", back_populates="integration_connection")
