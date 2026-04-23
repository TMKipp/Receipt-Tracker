from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
import uuid

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM as PGEnum, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ReceiptSource, ReceiptStatus, VersionSource


class Receipt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "receipts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vendors.id", ondelete="SET NULL"),
        index=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        index=True,
    )
    status: Mapped[ReceiptStatus] = mapped_column(
        PGEnum(ReceiptStatus, name="receipt_status"),
        default=ReceiptStatus.UPLOADED,
        nullable=False,
    )
    source: Mapped[ReceiptSource] = mapped_column(
        PGEnum(ReceiptSource, name="receipt_source"),
        default=ReceiptSource.CAMERA,
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    merchant_name: Mapped[str | None] = mapped_column(String(255), index=True)
    receipt_number: Mapped[str | None] = mapped_column(String(64))
    transaction_date: Mapped[date | None] = mapped_column(Date)
    payment_method: Mapped[str | None] = mapped_column(String(120))
    subtotal_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    tax_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    tip_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    raw_ocr_text: Mapped[str | None] = mapped_column(Text)
    ocr_provider: Mapped[str | None] = mapped_column(String(120))
    ocr_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    normalized_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    final_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    field_confidence: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    overall_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    duplicate_of_receipt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipts.id", ondelete="SET NULL"),
    )
    auto_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processing_error: Mapped[str | None] = mapped_column(Text)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="receipts")
    vendor = relationship("Vendor", back_populates="receipts")
    category = relationship("Category", back_populates="receipts")
    files = relationship(
        "ReceiptFile",
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="ReceiptFile.page_index",
    )
    line_items = relationship(
        "ReceiptLineItem",
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="ReceiptLineItem.line_number",
    )
    versions = relationship(
        "ReceiptVersion",
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="ReceiptVersion.version_number",
    )
    sync_jobs = relationship(
        "SyncJob",
        back_populates="receipt",
        cascade="all, delete-orphan",
    )


class ReceiptFile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "receipt_files"

    receipt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipts.id", ondelete="CASCADE"),
        index=True,
    )
    object_key: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    sha256_hash: Mapped[str | None] = mapped_column(String(128))
    page_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    receipt = relationship("Receipt", back_populates="files")


class ReceiptLineItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "receipt_line_items"

    receipt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipts.id", ondelete="CASCADE"),
        index=True,
    )
    line_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    unit_price_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    line_total_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    tax_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)

    receipt = relationship("Receipt", back_populates="line_items")


class ReceiptVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "receipt_versions"
    __table_args__ = (
        UniqueConstraint("receipt_id", "version_number", name="uq_receipt_versions_receipt_version"),
    )

    receipt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipts.id", ondelete="CASCADE"),
        index=True,
    )
    source: Mapped[VersionSource] = mapped_column(
        PGEnum(VersionSource, name="version_source"),
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    confidence_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    receipt = relationship("Receipt", back_populates="versions")
