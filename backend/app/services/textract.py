from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.config import settings
from app.services.provider_errors import ProviderError


@dataclass(slots=True)
class TextractAnalysis:
    provider: str
    raw_text: str
    payload: dict[str, Any]
    merchant_name: str | None
    transaction_date: str | None
    subtotal: str | None
    tax: str | None
    total: str | None
    payment_method: str | None
    currency: str | None
    line_items: list[dict[str, str | None]]
    confidence: dict[str, float]


SUMMARY_FIELD_ALIASES = {
    "merchant_name": ("VENDOR_NAME",),
    "transaction_date": ("INVOICE_RECEIPT_DATE",),
    "subtotal": ("SUBTOTAL",),
    "tax": ("TAX",),
    "total": ("TOTAL",),
    "payment_method": ("PAYMENT_METHOD",),
}


def textract_available() -> bool:
    return settings.textract_enabled


def _get_textract_client():
    try:
        import boto3
    except ImportError as exc:
        raise ProviderError(
            "textract_dependency_missing",
            "boto3 is not installed, so Textract OCR cannot run in this environment.",
        ) from exc

    return boto3.client("textract", region_name=settings.aws_region or settings.s3_region)


def _clean_value(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _summary_field_value(summary_fields: list[dict[str, Any]], aliases: tuple[str, ...]) -> tuple[str | None, float]:
    best_value = None
    best_confidence = 0.0
    for field in summary_fields:
        field_type = str((field.get("Type") or {}).get("Text") or "").upper()
        if field_type not in aliases:
            continue
        value_detection = field.get("ValueDetection") or {}
        value = _clean_value(value_detection.get("Text"))
        confidence = float(value_detection.get("Confidence") or field.get("Confidence") or 0.0) / 100.0
        if value and confidence >= best_confidence:
            best_value = value
            best_confidence = confidence
    return best_value, best_confidence


def _expense_currency(summary_fields: list[dict[str, Any]]) -> str | None:
    for field in summary_fields:
        currency = (field.get("Currency") or {}).get("Code")
        if currency:
            return str(currency).strip().upper()
    return None


def _line_items(expense_documents: list[dict[str, Any]]) -> list[dict[str, str | None]]:
    items: list[dict[str, str | None]] = []
    for document in expense_documents:
        for group in document.get("LineItemGroups") or []:
            for line_item in group.get("LineItems") or []:
                description = None
                quantity = None
                unit_price = None
                line_total = None
                for field in line_item.get("LineItemExpenseFields") or []:
                    field_type = str((field.get("Type") or {}).get("Text") or "").upper()
                    value = _clean_value((field.get("ValueDetection") or {}).get("Text"))
                    if field_type in {"ITEM", "DESCRIPTION", "ITEM_NAME"} and not description:
                        description = value
                    elif field_type == "QUANTITY":
                        quantity = value
                    elif field_type in {"PRICE", "UNIT_PRICE"}:
                        unit_price = value
                    elif field_type in {"AMOUNT", "LINE_TOTAL"}:
                        line_total = value
                if description or line_total or quantity or unit_price:
                    items.append(
                        {
                            "description": description,
                            "quantity": quantity,
                            "unitPrice": unit_price,
                            "lineTotal": line_total,
                        }
                    )
    return items


def analyze_receipt(file_bytes: bytes) -> TextractAnalysis | None:
    if not textract_available():
        return None

    client = _get_textract_client()
    try:
        response = client.analyze_expense(Document={"Bytes": file_bytes})
    except Exception as exc:
        raise ProviderError(
            "textract_failed",
            f"Textract failed to analyze the uploaded receipt: {exc}",
            retryable=True,
        ) from exc

    expense_documents = response.get("ExpenseDocuments") or []
    if not expense_documents:
        raise ProviderError("textract_empty", "Textract did not return any expense documents for this upload.")

    summary_fields = expense_documents[0].get("SummaryFields") or []
    merchant_name, merchant_confidence = _summary_field_value(summary_fields, SUMMARY_FIELD_ALIASES["merchant_name"])
    transaction_date, date_confidence = _summary_field_value(summary_fields, SUMMARY_FIELD_ALIASES["transaction_date"])
    subtotal, _ = _summary_field_value(summary_fields, SUMMARY_FIELD_ALIASES["subtotal"])
    tax, _ = _summary_field_value(summary_fields, SUMMARY_FIELD_ALIASES["tax"])
    total, total_confidence = _summary_field_value(summary_fields, SUMMARY_FIELD_ALIASES["total"])
    payment_method, payment_confidence = _summary_field_value(summary_fields, SUMMARY_FIELD_ALIASES["payment_method"])
    line_items = _line_items(expense_documents)

    raw_text_parts = [
        merchant_name,
        transaction_date,
        subtotal,
        tax,
        total,
        payment_method,
        *[
            " ".join(part for part in [item.get("description"), item.get("lineTotal")] if part)
            for item in line_items
        ],
    ]

    return TextractAnalysis(
        provider="aws_textract",
        raw_text="\n".join(part for part in raw_text_parts if part),
        payload=response,
        merchant_name=merchant_name,
        transaction_date=transaction_date,
        subtotal=subtotal,
        tax=tax,
        total=total,
        payment_method=payment_method,
        currency=_expense_currency(summary_fields),
        line_items=line_items,
        confidence={
            "vendor": merchant_confidence,
            "date": date_confidence,
            "total": total_confidence,
            "paymentMethod": payment_confidence,
        },
    )
