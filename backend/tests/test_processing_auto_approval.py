from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.services.processing import evaluate_auto_approval


def _make_receipt(
    *,
    auto_approve_enabled: bool = True,
    confidences: dict[str, float] | None = None,
    category_active: bool = True,
    subtotal: Decimal = Decimal("100.00"),
    tax: Decimal = Decimal("8.00"),
    tip: Decimal = Decimal("0.00"),
    total: Decimal = Decimal("108.00"),
) -> SimpleNamespace:
    return SimpleNamespace(
        user=SimpleNamespace(auto_approve_enabled=auto_approve_enabled),
        field_confidence=confidences
        or {
            "vendor": 0.99,
            "date": 0.99,
            "total": 0.99,
            "category": 0.99,
        },
        subtotal_amount=subtotal,
        tax_amount=tax,
        tip_amount=tip,
        total_amount=total,
        category=SimpleNamespace(is_active=category_active),
    )


def test_evaluate_auto_approval_passes_with_policy_match() -> None:
    receipt = _make_receipt()
    eligible, reasons = evaluate_auto_approval(receipt, history_count=4, duplicate=None)
    assert eligible is True
    assert any("Auto-approve is enabled." in reason for reason in reasons)
    assert any("Duplicate check clear." in reason for reason in reasons)


def test_evaluate_auto_approval_fails_on_duplicate() -> None:
    receipt = _make_receipt()
    duplicate = SimpleNamespace(id=uuid4())
    eligible, reasons = evaluate_auto_approval(receipt, history_count=8, duplicate=duplicate)
    assert eligible is False
    assert any(str(duplicate.id) in reason for reason in reasons)


def test_evaluate_auto_approval_fails_when_confidence_below_threshold() -> None:
    receipt = _make_receipt(confidences={"vendor": 0.90, "date": 0.99, "total": 0.99, "category": 0.99})
    eligible, reasons = evaluate_auto_approval(receipt, history_count=8, duplicate=None)
    assert eligible is False
    assert any("Duplicate check clear." in reason for reason in reasons)


def test_evaluate_auto_approval_fails_when_totals_do_not_reconcile() -> None:
    receipt = _make_receipt(total=Decimal("109.00"))
    eligible, reasons = evaluate_auto_approval(receipt, history_count=8, duplicate=None)
    assert eligible is False
    assert any("Totals do not reconcile within $0.01." in reason for reason in reasons)
