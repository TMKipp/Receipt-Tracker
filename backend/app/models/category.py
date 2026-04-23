from __future__ import annotations

from decimal import Decimal
import uuid

from sqlalchemy import ForeignKey, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM as PGEnum, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import CategorySource


class Category(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_categories_user_name"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    source: Mapped[CategorySource] = mapped_column(
        PGEnum(CategorySource, name="category_source"),
        nullable=False,
        default=CategorySource.USER,
    )
    external_account_id: Mapped[str | None] = mapped_column(String(128))
    external_account_type: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    user = relationship("User", back_populates="categories")
    receipts = relationship("Receipt", back_populates="category")
    category_rules = relationship("VendorCategoryRule", back_populates="category")


class VendorCategoryRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "vendor_category_rules"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vendors.id", ondelete="CASCADE"),
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
    )
    match_pattern: Mapped[str | None] = mapped_column(String(255))
    priority: Mapped[int] = mapped_column(SmallInteger, default=100, nullable=False)
    confidence_boost: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))

    vendor = relationship("Vendor", back_populates="category_rules")
    category = relationship("Category", back_populates="category_rules")

