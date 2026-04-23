from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.reports import MonthlyCategorySpend, MonthlySpendBucket, MonthlySpendResponse
from app.services.receipts import monthly_spend_query

router = APIRouter()


@router.get("/monthly-spend", response_model=MonthlySpendResponse)
async def monthly_spend(
    from_month: str | None = None,
    to_month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MonthlySpendResponse:
    receipts = monthly_spend_query(db, current_user.id, from_month, to_month)
    buckets: dict[str, dict] = defaultdict(
        lambda: {"currency": current_user.default_currency, "total": 0, "categories": defaultdict(int)}
    )
    for receipt in receipts:
        if receipt.transaction_date is None or receipt.total_amount is None:
            continue
        month = receipt.transaction_date.strftime("%Y-%m")
        buckets[month]["currency"] = receipt.currency
        buckets[month]["total"] += receipt.total_amount
        category_name = receipt.category.name if receipt.category else "Uncategorized"
        buckets[month]["categories"][category_name] += receipt.total_amount

    data = [
        MonthlySpendBucket(
            month=month,
            currency=value["currency"],
            total=value["total"],
            categories=[
                MonthlyCategorySpend(category_name=name, total=total)
                for name, total in sorted(value["categories"].items())
            ],
        )
        for month, value in sorted(buckets.items())
    ]
    return MonthlySpendResponse(data=data)
