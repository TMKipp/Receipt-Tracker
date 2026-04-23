from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.category import Category
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.catalog import CategoryListResponse, VendorListResponse
from app.services.receipts import serialize_category, serialize_vendor

router = APIRouter()


@router.get("/categories", tags=["categories"], response_model=CategoryListResponse)
async def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CategoryListResponse:
    categories = db.scalars(
        select(Category)
        .where(Category.user_id == current_user.id)
        .order_by(Category.name.asc())
    ).all()
    return CategoryListResponse(data=[serialize_category(category) for category in categories])


@router.get("/vendors", tags=["vendors"], response_model=VendorListResponse)
async def list_vendors(
    q: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorListResponse:
    stmt = (
        select(Vendor)
        .where(Vendor.user_id == current_user.id)
        .order_by(Vendor.last_seen_at.desc().nullslast(), Vendor.display_name.asc())
    )
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(Vendor.display_name.ilike(pattern))
    vendors = db.scalars(stmt).all()
    return VendorListResponse(data=[serialize_vendor(db, vendor) for vendor in vendors])
