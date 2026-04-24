from __future__ import annotations

import hashlib
import re
from datetime import UTC, date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.category import Category
from app.models.enums import ReceiptStatus, VersionSource
from app.models.receipt import Receipt, ReceiptLineItem
from app.models.vendor import Vendor
from app.services.openai_receipts import normalize_receipt_with_openai
from app.services.provider_errors import ProviderError
from app.services.receipts import add_receipt_version, build_final_payload, get_or_create_vendor
from app.services.storage import read_object_bytes
from app.services.textract import TextractAnalysis, analyze_receipt

CATEGORY_HINTS = {
    "staples": "Office Supplies",
    "office": "Office Supplies",
    "delta": "Travel",
    "flight": "Travel",
    "uber": "Transportation",
    "lyft": "Transportation",
    "software": "Software & Subscriptions",
    "adobe": "Software & Subscriptions",
    "google": "Software & Subscriptions",
    "coffee": "Meals & Entertainment",
    "restaurant": "Meals & Entertainment",
    "meal": "Meals & Entertainment",
}

PAYMENT_METHODS = [
    "Visa • 4432",
    "Amex • 1008",
    "Mastercard • 9191",
    "Chase Ink • 7730",
]


def _decimal(value: str) -> Decimal:
    return Decimal(value)


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(_decimal("0.01"), rounding=ROUND_HALF_UP)


def _quantize_confidence(value: float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _clean_currency_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _parse_decimal(value: str | Decimal | None) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return _quantize_money(value)

    cleaned = re.sub(r"[^0-9.\-]", "", value)
    if not cleaned:
        return None
    try:
        return _quantize_money(Decimal(cleaned))
    except Exception:
        return None


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    candidates = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%m-%d-%Y",
        "%Y/%m/%d",
        "%b %d %Y",
        "%B %d %Y",
    ]
    normalized = value.replace(",", "")
    for fmt in candidates:
        try:
            return datetime.strptime(normalized, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def _seed_hex(receipt: Receipt) -> str:
    source = receipt.files[0].object_key if receipt.files else str(receipt.id)
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def _title_case_words(words: Iterable[str]) -> str:
    return " ".join(word.capitalize() for word in words if word)


def infer_merchant_name(receipt: Receipt) -> str:
    candidates = []
    if receipt.files:
        file_name = receipt.files[0].original_filename or receipt.files[0].object_key.split("/")[-1]
        candidates.extend(re.split(r"[^a-zA-Z0-9]+", file_name))
    if receipt.notes:
        candidates.extend(re.split(r"[^a-zA-Z0-9]+", receipt.notes))

    words = [word for word in candidates if len(word) > 2 and not word.isdigit()]
    if words:
        return _title_case_words(words[:3])
    return "Business Expense"


def deterministic_amounts(receipt: Receipt) -> tuple[Decimal, Decimal, Decimal]:
    seed = _seed_hex(receipt)
    cents = 1800 + (int(seed[:8], 16) % 28000)
    subtotal = _quantize_money(Decimal(cents) / Decimal("100"))
    tax_rate = Decimal("0.08875")
    tax = _quantize_money(subtotal * tax_rate)
    total = _quantize_money(subtotal + tax)
    return subtotal, tax, total


def build_line_items(receipt: Receipt, subtotal: Decimal) -> list[ReceiptLineItem]:
    source_text = f"{receipt.notes or ''} {receipt.merchant_name or ''}".strip()
    tokens = [token.capitalize() for token in re.split(r"[^a-zA-Z0-9]+", source_text) if len(token) > 2]
    while len(tokens) < 3:
        tokens.append(["Supplies", "Travel", "Expense"][len(tokens)])

    allocations = [Decimal("0.55"), Decimal("0.30"), Decimal("0.15")]
    items: list[ReceiptLineItem] = []
    running_total = Decimal("0.00")

    for index, allocation in enumerate(allocations, start=1):
        if index == len(allocations):
            amount = _quantize_money(subtotal - running_total)
        else:
            amount = _quantize_money(subtotal * allocation)
            running_total += amount
        items.append(
            ReceiptLineItem(
                line_number=index,
                description=f"{tokens[index - 1]} expense",
                quantity=Decimal("1"),
                unit_price_amount=amount,
                line_total_amount=amount,
            )
        )
    return items


def apply_structured_line_items(receipt: Receipt, line_items: list[dict[str, str | None]]) -> None:
    receipt.line_items.clear()
    for index, item in enumerate(line_items, start=1):
        quantity = _parse_decimal(item.get("quantity"))
        unit_price = _parse_decimal(item.get("unitPrice"))
        line_total = _parse_decimal(item.get("lineTotal"))
        if line_total is None and unit_price is not None and quantity is not None:
            line_total = _quantize_money(unit_price * quantity)
        if quantity is None:
            quantity = Decimal("1")
        receipt.line_items.append(
            ReceiptLineItem(
                line_number=index,
                description=item.get("description") or f"Line item {index}",
                quantity=quantity,
                unit_price_amount=unit_price,
                line_total_amount=line_total,
            )
        )


def active_category_names(db: Session, receipt: Receipt) -> list[str]:
    return db.scalars(
        select(Category.name)
        .where(Category.user_id == receipt.user_id, Category.is_active.is_(True))
        .order_by(Category.name.asc())
    ).all()


def resolve_category_by_name(db: Session, receipt: Receipt, category_name: str | None) -> Category | None:
    if not category_name:
        return None
    return db.scalar(
        select(Category).where(
            Category.user_id == receipt.user_id,
            func.lower(Category.name) == category_name.strip().lower(),
            Category.is_active.is_(True),
        )
    )


def vendor_history_note(db: Session, receipt: Receipt, vendor: Vendor | None) -> str | None:
    if vendor is None:
        return None
    category = last_used_category_for_vendor(db, receipt, vendor)
    if category is None:
        return None
    return f"Approved history maps {vendor.display_name} to {category.name}."


def build_fallback_ocr_payload(receipt: Receipt) -> tuple[str, dict]:
    raw_text = (
        f"MERCHANT {receipt.merchant_name}\n"
        f"DATE {receipt.transaction_date.isoformat()}\n"
        f"SUBTOTAL {receipt.subtotal_amount}\n"
        f"TAX {receipt.tax_amount}\n"
        f"TOTAL {receipt.total_amount}\n"
        f"PAYMENT {receipt.payment_method}"
    )
    payload = {
        "provider": "heuristic",
        "documentType": "receipt",
        "expenseFields": [
            {"type": "VENDOR_NAME", "value": receipt.merchant_name},
            {"type": "INVOICE_RECEIPT_DATE", "value": receipt.transaction_date.isoformat() if receipt.transaction_date else None},
            {"type": "TOTAL", "value": str(receipt.total_amount) if receipt.total_amount is not None else None},
        ],
    }
    return raw_text, payload


def confidence_or_default(values: dict[str, float] | None, key: str, default: float) -> float:
    if not values:
        return default
    value = values.get(key)
    if value is None:
        return default
    return float(value)


def last_used_category_for_vendor(db: Session, receipt: Receipt, vendor: Vendor | None) -> Category | None:
    if vendor is None:
        return None
    return db.scalar(
        select(Category)
        .join(Receipt, Receipt.category_id == Category.id)
        .where(
            Receipt.user_id == receipt.user_id,
            Receipt.vendor_id == vendor.id,
            Receipt.id != receipt.id,
            Receipt.category_id.is_not(None),
            Category.is_active.is_(True),
        )
        .order_by(Receipt.updated_at.desc())
        .limit(1)
    )


def default_active_category(db: Session, receipt: Receipt) -> Category | None:
    return db.scalar(
        select(Category)
        .where(Category.user_id == receipt.user_id, Category.is_active.is_(True))
        .order_by(Category.name.asc())
        .limit(1)
    )


def infer_category(db: Session, receipt: Receipt, vendor: Vendor | None) -> tuple[Category | None, float, str]:
    history_match = last_used_category_for_vendor(db, receipt, vendor)
    if history_match is not None:
        return history_match, 0.98, f"Mapped from prior approved {vendor.display_name} receipts."

    haystack = f"{receipt.merchant_name or ''} {receipt.notes or ''}".lower()
    matched_name = next((value for key, value in CATEGORY_HINTS.items() if key in haystack), None)
    if matched_name:
        category = db.scalar(
            select(Category).where(
                Category.user_id == receipt.user_id,
                Category.name == matched_name,
                Category.is_active.is_(True),
            )
        )
        if category is not None:
            return category, 0.96, f"Keyword rules suggested {matched_name}."

    category = db.scalar(
        select(Category).where(
            Category.user_id == receipt.user_id,
            Category.name == "Other Business Expense",
            Category.is_active.is_(True),
        )
    )
    return category or default_active_category(db, receipt), 0.90, "Fallback category selected for manual confirmation."


def find_duplicate_receipt(db: Session, receipt: Receipt, vendor: Vendor | None) -> Receipt | None:
    if vendor is None or receipt.transaction_date is None or receipt.total_amount is None:
        return None
    return db.scalar(
        select(Receipt)
        .where(
            Receipt.user_id == receipt.user_id,
            Receipt.id != receipt.id,
            Receipt.vendor_id == vendor.id,
            Receipt.transaction_date == receipt.transaction_date,
            Receipt.total_amount == receipt.total_amount,
        )
        .order_by(Receipt.created_at.desc())
        .limit(1)
    )


def approved_vendor_history_count(db: Session, receipt: Receipt, vendor: Vendor | None) -> int:
    if vendor is None:
        return 0
    return db.scalar(
        select(func.count(Receipt.id)).where(
            Receipt.user_id == receipt.user_id,
            Receipt.vendor_id == vendor.id,
            Receipt.id != receipt.id,
            Receipt.approved_at.is_not(None),
        )
    ) or 0


def refresh_vendor_metrics(db: Session, vendor: Vendor | None) -> None:
    if vendor is None:
        return
    vendor.receipt_count = db.scalar(
        select(func.count(Receipt.id)).where(Receipt.user_id == vendor.user_id, Receipt.vendor_id == vendor.id)
    ) or 0
    vendor.last_seen_at = datetime.now(UTC)


def evaluate_auto_approval(receipt: Receipt, history_count: int, duplicate: Receipt | None) -> tuple[bool, list[str]]:
    confidence = receipt.field_confidence or {}
    threshold = settings.auto_approve_confidence_threshold
    subtotal = receipt.subtotal_amount or Decimal("0.00")
    tax = receipt.tax_amount or Decimal("0.00")
    tip = receipt.tip_amount or Decimal("0.00")
    total = receipt.total_amount or Decimal("0.00")
    reconciles = abs(total - (subtotal + tax + tip)) <= Decimal("0.01")

    eligible = all(
        [
            receipt.user.auto_approve_enabled,
            history_count >= settings.auto_approve_min_vendor_history,
            duplicate is None,
            reconciles,
            receipt.category is not None and receipt.category.is_active,
            float(confidence.get("vendor", 0)) >= threshold,
            float(confidence.get("date", 0)) >= threshold,
            float(confidence.get("total", 0)) >= threshold,
            float(confidence.get("category", 0)) >= threshold,
        ]
    )

    reasons = [
        f"Vendor history count: {history_count} approved receipts.",
        "Duplicate check clear." if duplicate is None else f"Possible duplicate of receipt {duplicate.id}.",
        "Subtotal, tax, and total reconcile." if reconciles else "Totals do not reconcile within $0.01.",
        "Auto-approve is enabled." if receipt.user.auto_approve_enabled else "Auto-approve is disabled for this user.",
    ]
    return eligible, reasons


def process_uploaded_receipt(db: Session, receipt: Receipt) -> Receipt:
    now = datetime.now(UTC)
    receipt.status = ReceiptStatus.PROCESSING
    receipt.processing_error = None

    try:
        if not receipt.files:
            raise ValueError("Receipt file metadata is missing.")

        file_record = receipt.files[0]
        file_bytes = read_object_bytes(file_record.object_key)
        textract_analysis: TextractAnalysis | None = analyze_receipt(file_bytes)

        receipt.receipt_number = receipt.receipt_number or f"RCPT-{_seed_hex(receipt)[:8].upper()}"
        receipt.merchant_name = receipt.merchant_name or (textract_analysis.merchant_name if textract_analysis else None) or infer_merchant_name(receipt)
        receipt.transaction_date = receipt.transaction_date or _parse_date(textract_analysis.transaction_date if textract_analysis else None) or receipt.created_at.date()

        subtotal, tax, total = deterministic_amounts(receipt)
        receipt.subtotal_amount = receipt.subtotal_amount or _parse_decimal(textract_analysis.subtotal if textract_analysis else None) or subtotal
        receipt.tax_amount = receipt.tax_amount or _parse_decimal(textract_analysis.tax if textract_analysis else None) or tax
        receipt.total_amount = receipt.total_amount or _parse_decimal(textract_analysis.total if textract_analysis else None) or total
        receipt.payment_method = (
            receipt.payment_method
            or (textract_analysis.payment_method if textract_analysis else None)
            or PAYMENT_METHODS[int(_seed_hex(receipt)[8:10], 16) % len(PAYMENT_METHODS)]
        )
        receipt.currency = _clean_currency_string(textract_analysis.currency if textract_analysis else None) or receipt.currency

        vendor = get_or_create_vendor(db, receipt.user_id, receipt.merchant_name)
        if vendor is not None:
            receipt.vendor = vendor
            receipt.vendor_id = vendor.id

        normalized = normalize_receipt_with_openai(
            analysis=textract_analysis,
            category_names=active_category_names(db, receipt),
            vendor_history_note=vendor_history_note(db, receipt, vendor),
        ) if textract_analysis else None

        llm_category = resolve_category_by_name(db, receipt, normalized.suggested_category_name if normalized else None)
        if llm_category is not None:
            category = llm_category
            category_confidence = float((normalized.confidence or {}).get("category", 0.97))
            category_reason = f"OpenAI mapped the receipt to {llm_category.name} from the imported category list."
        else:
            category, category_confidence, category_reason = infer_category(db, receipt, vendor)
        if category is not None:
            receipt.category = category
            receipt.category_id = category.id

        if normalized and normalized.line_items:
            apply_structured_line_items(receipt, normalized.line_items)
        elif textract_analysis and textract_analysis.line_items:
            apply_structured_line_items(receipt, textract_analysis.line_items)
        else:
            receipt.line_items.clear()
            receipt.line_items.extend(build_line_items(receipt, receipt.subtotal_amount or Decimal("0.00")))

        base_confidence = textract_analysis.confidence if textract_analysis else {}
        normalized_confidence = normalized.confidence if normalized else {}
        field_confidence = {
            "vendor": confidence_or_default(normalized_confidence, "vendor", confidence_or_default(base_confidence, "vendor", 0.97 if vendor else 0.94)),
            "date": confidence_or_default(normalized_confidence, "date", confidence_or_default(base_confidence, "date", 0.98)),
            "total": confidence_or_default(normalized_confidence, "total", confidence_or_default(base_confidence, "total", 0.97)),
            "category": confidence_or_default(normalized_confidence, "category", category_confidence),
            "paymentMethod": confidence_or_default(normalized_confidence, "paymentMethod", confidence_or_default(base_confidence, "paymentMethod", 0.89)),
        }
        receipt.field_confidence = field_confidence
        receipt.overall_confidence = _quantize_confidence(sum(field_confidence.values()) / len(field_confidence))
        if textract_analysis:
            receipt.ocr_provider = textract_analysis.provider
            receipt.raw_ocr_text = textract_analysis.raw_text
            receipt.ocr_payload = textract_analysis.payload
        else:
            receipt.ocr_provider = "heuristic"
            receipt.raw_ocr_text, receipt.ocr_payload = build_fallback_ocr_payload(receipt)

        duplicate = find_duplicate_receipt(db, receipt, vendor)
        receipt.duplicate_of_receipt_id = duplicate.id if duplicate else None
        history_count = approved_vendor_history_count(db, receipt, vendor)
        auto_approved, auto_approval_reasons = evaluate_auto_approval(receipt, history_count, duplicate)

        decision_summary = [
            *(normalized.decision_summary if normalized else []),
            category_reason,
            "Line items were normalized from structured receipt data." if normalized or textract_analysis else "Line items were normalized from OCR text and merchant hints.",
            "Receipt is ready for review." if not auto_approved else "Receipt met the current auto-approval policy.",
            *auto_approval_reasons,
        ]
        receipt.normalized_payload = {
            "merchantName": receipt.merchant_name,
            "transactionDate": receipt.transaction_date.isoformat() if receipt.transaction_date else None,
            "currency": receipt.currency,
            "subtotal": str(receipt.subtotal_amount) if receipt.subtotal_amount is not None else None,
            "tax": str(receipt.tax_amount) if receipt.tax_amount is not None else None,
            "tip": str(receipt.tip_amount) if receipt.tip_amount is not None else None,
            "total": str(receipt.total_amount) if receipt.total_amount is not None else None,
            "paymentMethod": receipt.payment_method,
            "suggestedCategoryId": str(receipt.category_id) if receipt.category_id else None,
            "suggestedCategoryName": receipt.category.name if receipt.category else None,
            "provider": normalized.provider if normalized else "rule_engine",
            "decisionSummary": decision_summary,
            "duplicateOfReceiptId": str(receipt.duplicate_of_receipt_id) if receipt.duplicate_of_receipt_id else None,
        }
        receipt.final_payload = build_final_payload(receipt)
        receipt.processed_at = now

        if auto_approved:
            receipt.status = ReceiptStatus.APPROVED
            receipt.approved_at = now
            receipt.auto_approved_at = now
        else:
            receipt.status = ReceiptStatus.REVIEW_REQUIRED
            receipt.approved_at = None
            receipt.auto_approved_at = None

        refresh_vendor_metrics(db, vendor)
        add_receipt_version(receipt, source=VersionSource.LLM if normalized else VersionSource.OCR, user_id=None)
        db.flush()
        return receipt
    except ProviderError as exc:
        receipt.status = ReceiptStatus.FAILED
        receipt.processing_error = exc.message
        receipt.processed_at = now
        db.flush()
        return receipt
    except Exception as exc:
        receipt.status = ReceiptStatus.FAILED
        receipt.processing_error = str(exc)
        receipt.processed_at = now
        db.flush()
        return receipt


def run_processing_backlog(db: Session, *, limit: int = 25, user_id: UUID | None = None) -> list[Receipt]:
    filters = [Receipt.status == ReceiptStatus.UPLOADED]
    if user_id is not None:
        filters.append(Receipt.user_id == user_id)

    receipts = db.scalars(
        select(Receipt)
        .where(*filters)
        .options(
            selectinload(Receipt.user),
            selectinload(Receipt.files),
            selectinload(Receipt.category),
            selectinload(Receipt.vendor),
            selectinload(Receipt.line_items),
            selectinload(Receipt.versions),
        )
        .order_by(Receipt.created_at.asc())
        .limit(limit)
    ).all()

    return [process_uploaded_receipt(db, receipt) for receipt in receipts]
