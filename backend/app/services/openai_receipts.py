from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any

import httpx

from app.core.config import settings
from app.services.provider_errors import ProviderError
from app.services.textract import TextractAnalysis


@dataclass(slots=True)
class NormalizedReceipt:
    provider: str
    merchant_name: str | None
    transaction_date: str | None
    currency: str | None
    subtotal: str | None
    tax: str | None
    tip: str | None
    total: str | None
    payment_method: str | None
    line_items: list[dict[str, str | None]]
    suggested_category_name: str | None
    decision_summary: list[str]
    confidence: dict[str, float]


def openai_available() -> bool:
    return settings.openai_enabled and bool(settings.openai_api_key.strip())


def _normalization_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "merchantName": {"type": ["string", "null"]},
            "transactionDate": {"type": ["string", "null"]},
            "currency": {"type": ["string", "null"]},
            "subtotal": {"type": ["string", "null"]},
            "tax": {"type": ["string", "null"]},
            "tip": {"type": ["string", "null"]},
            "total": {"type": ["string", "null"]},
            "paymentMethod": {"type": ["string", "null"]},
            "suggestedCategoryName": {"type": ["string", "null"]},
            "decisionSummary": {
                "type": "array",
                "items": {"type": "string"},
            },
            "confidence": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "vendor": {"type": "number"},
                    "date": {"type": "number"},
                    "total": {"type": "number"},
                    "category": {"type": "number"},
                    "paymentMethod": {"type": "number"},
                },
                "required": ["vendor", "date", "total", "category", "paymentMethod"],
            },
            "lineItems": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "description": {"type": ["string", "null"]},
                        "quantity": {"type": ["string", "null"]},
                        "unitPrice": {"type": ["string", "null"]},
                        "lineTotal": {"type": ["string", "null"]},
                    },
                    "required": ["description", "quantity", "unitPrice", "lineTotal"],
                },
            },
        },
        "required": [
            "merchantName",
            "transactionDate",
            "currency",
            "subtotal",
            "tax",
            "tip",
            "total",
            "paymentMethod",
            "suggestedCategoryName",
            "decisionSummary",
            "confidence",
            "lineItems",
        ],
    }


def _extract_output_text(payload: dict[str, Any]) -> str:
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct

    chunks: list[str] = []
    for item in payload.get("output") or []:
        if item.get("type") != "message":
            continue
        for content in item.get("content") or []:
            text = content.get("text")
            if isinstance(text, str):
                chunks.append(text)
    merged = "".join(chunks).strip()
    if merged:
        return merged
    raise ProviderError("openai_empty_output", "OpenAI returned an empty structured response for this receipt.")


def normalize_receipt_with_openai(
    *,
    analysis: TextractAnalysis,
    category_names: list[str],
    vendor_history_note: str | None,
) -> NormalizedReceipt | None:
    if not openai_available():
        return None

    prompt = {
        "task": "Normalize this receipt OCR into strict structured JSON. Only suggest a category from the allowed list.",
        "allowedCategories": category_names,
        "vendorHistoryNote": vendor_history_note,
        "ocrSummary": {
            "merchantName": analysis.merchant_name,
            "transactionDate": analysis.transaction_date,
            "subtotal": analysis.subtotal,
            "tax": analysis.tax,
            "total": analysis.total,
            "paymentMethod": analysis.payment_method,
            "currency": analysis.currency,
            "lineItems": analysis.line_items,
        },
        "rawOcrText": analysis.raw_text,
    }

    body = {
        "model": settings.openai_receipt_model,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You normalize receipt OCR for small-business bookkeeping. "
                            "Return only JSON that matches the supplied schema. "
                            "If a field is not supported by the OCR evidence, return null instead of inventing it."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": json.dumps(prompt, ensure_ascii=True)}],
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "receipt_normalization",
                "schema": _normalization_schema(),
                "strict": True,
            }
        },
    }

    try:
        response = httpx.post(
            f"{settings.openai_base_url.rstrip('/')}/responses",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=60.0,
        )
    except httpx.HTTPError as exc:
        raise ProviderError(
            "openai_transport_error",
            f"OpenAI normalization request failed: {exc}",
            retryable=True,
        ) from exc

    if response.status_code >= 400:
        message = response.text
        try:
            payload = response.json()
            message = payload.get("error", {}).get("message") or payload.get("message") or message
        except ValueError:
            pass
        raise ProviderError(
            "openai_request_failed",
            f"OpenAI normalization failed: {message}",
            retryable=response.status_code in {408, 409, 429, 500, 502, 503, 504},
        )

    payload = response.json()
    parsed = json.loads(_extract_output_text(payload))
    return NormalizedReceipt(
        provider="openai_responses",
        merchant_name=parsed.get("merchantName"),
        transaction_date=parsed.get("transactionDate"),
        currency=parsed.get("currency"),
        subtotal=parsed.get("subtotal"),
        tax=parsed.get("tax"),
        tip=parsed.get("tip"),
        total=parsed.get("total"),
        payment_method=parsed.get("paymentMethod"),
        line_items=list(parsed.get("lineItems") or []),
        suggested_category_name=parsed.get("suggestedCategoryName"),
        decision_summary=list(parsed.get("decisionSummary") or []),
        confidence={
            key: float(value)
            for key, value in (parsed.get("confidence") or {}).items()
            if value is not None
        },
    )
