from __future__ import annotations

from decimal import Decimal

from app.schemas.common import APIModel


class MonthlyCategorySpend(APIModel):
    category_name: str
    total: Decimal


class MonthlySpendBucket(APIModel):
    month: str
    currency: str
    total: Decimal
    categories: list[MonthlyCategorySpend]


class MonthlySpendResponse(APIModel):
    data: list[MonthlySpendBucket]

