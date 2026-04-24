from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException
import pytest

from app.models.enums import EntitlementStatus
from app.services.billing import map_revenuecat_status, parse_ms_timestamp, verify_revenuecat_authorization
from app.core.config import settings


def test_verify_revenuecat_authorization_accepts_exact_and_bearer(monkeypatch) -> None:
    monkeypatch.setattr(settings, "revenuecat_webhook_authorization", "secret-key")
    verify_revenuecat_authorization("secret-key")
    verify_revenuecat_authorization("Bearer secret-key")


def test_verify_revenuecat_authorization_rejects_missing_or_invalid(monkeypatch) -> None:
    monkeypatch.setattr(settings, "revenuecat_webhook_authorization", "")
    with pytest.raises(HTTPException) as missing_exc:
        verify_revenuecat_authorization("anything")
    assert missing_exc.value.status_code == 503

    monkeypatch.setattr(settings, "revenuecat_webhook_authorization", "expected")
    with pytest.raises(HTTPException) as invalid_exc:
        verify_revenuecat_authorization("wrong")
    assert invalid_exc.value.status_code == 401


def test_map_revenuecat_status_transitions() -> None:
    assert map_revenuecat_status("INITIAL_PURCHASE", None) == EntitlementStatus.ACTIVE
    assert map_revenuecat_status("RENEWAL", datetime.now(UTC)) == EntitlementStatus.ACTIVE
    assert map_revenuecat_status("BILLING_ISSUE", datetime.now(UTC)) == EntitlementStatus.GRACE_PERIOD
    assert map_revenuecat_status("CANCELLATION", datetime.now(UTC)) == EntitlementStatus.CANCELED
    assert map_revenuecat_status("EXPIRATION", datetime.now(UTC)) == EntitlementStatus.EXPIRED
    assert map_revenuecat_status("UNKNOWN", datetime.now(UTC)) == EntitlementStatus.TRIALING


def test_parse_ms_timestamp_supports_epoch_millis_and_empty_values() -> None:
    parsed = parse_ms_timestamp(1713916800000)
    assert parsed is not None
    assert parsed.tzinfo is not None
    assert parse_ms_timestamp(None) is None
    assert parse_ms_timestamp("") is None
    assert parse_ms_timestamp(0) is None
