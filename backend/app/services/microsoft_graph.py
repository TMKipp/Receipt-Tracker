from __future__ import annotations

from datetime import UTC, datetime
import uuid
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.commercial import ExcelWorkbookBinding
from app.models.enums import IntegrationProvider
from app.models.integration import IntegrationConnection
from app.models.receipt import Receipt
from app.models.user import User
from app.services.integration_oauth import (
    ensure_connection_access_token,
    get_connection,
    parse_scopes,
    resolve_redirect_uri,
    save_pending_oauth_state,
    store_oauth_tokens,
    validate_pending_oauth_state,
)
from app.services.provider_errors import ProviderError

MS_SCOPE = "offline_access Files.ReadWrite.All User.Read"


def build_microsoft_authorization_url(state: str, redirect_uri: str | None) -> str:
    params = urlencode(
        {
            "client_id": settings.ms_client_id or "YOUR_MS_CLIENT_ID",
            "redirect_uri": redirect_uri or settings.ms_redirect_uri,
            "response_type": "code",
            "response_mode": "query",
            "scope": MS_SCOPE,
            "state": state,
        }
    )
    return f"https://login.microsoftonline.com/{settings.ms_tenant_id}/oauth2/v2.0/authorize?{params}"


def begin_microsoft_connection(db: Session, user: User, redirect_uri: str | None) -> tuple[str, str]:
    state = str(uuid.uuid4())
    save_pending_oauth_state(
        db,
        user,
        IntegrationProvider.MICROSOFT,
        state=state,
        redirect_uri=redirect_uri or settings.ms_redirect_uri,
    )
    db.flush()
    return state, build_microsoft_authorization_url(state, redirect_uri or settings.ms_redirect_uri)


def _token_url() -> str:
    return f"https://login.microsoftonline.com/{settings.ms_tenant_id}/oauth2/v2.0/token"


def _token_request(payload: dict[str, str]) -> dict:
    if not settings.ms_client_id or not settings.ms_client_secret:
        raise ProviderError(
            "microsoft_not_configured",
            "Microsoft OAuth is not configured. Set MS_CLIENT_ID and MS_CLIENT_SECRET first.",
        )

    payload = {
        **payload,
        "client_id": settings.ms_client_id,
        "client_secret": settings.ms_client_secret,
    }
    try:
        response = httpx.post(_token_url(), data=payload, timeout=30.0)
    except httpx.HTTPError as exc:
        raise ProviderError(
            "microsoft_oauth_transport_error",
            f"Microsoft OAuth request failed: {exc}",
            retryable=True,
        ) from exc

    if response.status_code >= 400:
        detail = response.text
        try:
            error_payload = response.json()
            detail = error_payload.get("error_description") or error_payload.get("error") or detail
        except ValueError:
            pass
        raise ProviderError(
            "microsoft_oauth_failed",
            f"Microsoft OAuth failed: {detail}",
            needs_reauth=response.status_code in {400, 401},
        )
    return response.json()


def exchange_microsoft_code(code: str, redirect_uri: str | None) -> dict:
    return _token_request(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri or settings.ms_redirect_uri,
            "scope": MS_SCOPE,
        }
    )


def refresh_microsoft_tokens(refresh_token: str) -> dict:
    return _token_request(
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "scope": MS_SCOPE,
        }
    )


def _graph_request(
    method: str,
    *,
    access_token: str,
    path: str,
    params: dict[str, str] | None = None,
    json: dict | None = None,
) -> dict:
    url = f"{settings.ms_graph_base_url.rstrip('/')}/{path.lstrip('/')}"
    try:
        response = httpx.request(
            method,
            url,
            params=params,
            json=json,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=45.0,
        )
    except httpx.HTTPError as exc:
        raise ProviderError(
            "microsoft_graph_transport_error",
            f"Microsoft Graph request failed: {exc}",
            retryable=True,
        ) from exc

    if response.status_code >= 400:
        detail = response.text
        payload = None
        try:
            payload = response.json()
            detail = payload.get("error", {}).get("message") or detail
        except ValueError:
            payload = None
        raise ProviderError(
            "microsoft_graph_failed",
            f"Microsoft Graph error: {detail}",
            retryable=response.status_code in {408, 409, 429, 500, 502, 503, 504},
            needs_reauth=response.status_code in {401, 403},
            details=payload if isinstance(payload, dict) else None,
        )

    if response.status_code == 204 or not response.content:
        return {}
    return response.json()


def _profile_name(access_token: str) -> str:
    profile = _graph_request("GET", access_token=access_token, path="me", params={"$select": "displayName"})
    return str(profile.get("displayName") or "Microsoft 365")


def complete_microsoft_callback(
    db: Session,
    *,
    user: User,
    code: str,
    state: str,
) -> IntegrationConnection:
    connection = get_connection(db, user.id, IntegrationProvider.MICROSOFT)
    validate_pending_oauth_state(connection, state)
    redirect_uri = resolve_redirect_uri(connection, settings.ms_redirect_uri)
    token_payload = exchange_microsoft_code(code, redirect_uri)
    access_token = str(token_payload.get("access_token") or "")
    if not access_token:
        raise ProviderError("microsoft_access_token_missing", "Microsoft did not return an access token.")

    tenant_name = _profile_name(access_token)
    store_oauth_tokens(
        connection,
        token_payload=token_payload,
        external_tenant_id=settings.ms_tenant_id,
        external_tenant_name=tenant_name,
        scopes=parse_scopes(token_payload.get("scope")),
        metadata_updates={"connectedProfile": tenant_name, "connectedAt": datetime.now(UTC).isoformat()},
    )
    db.flush()
    return connection


def list_table_columns(
    db: Session,
    connection: IntegrationConnection,
    binding: ExcelWorkbookBinding,
) -> list[str]:
    access_token = ensure_connection_access_token(db, connection)
    payload = _graph_request(
        "GET",
        access_token=access_token,
        path=f"drives/{binding.drive_id}/items/{binding.item_id}/workbook/tables/{binding.table_id}/columns",
    )
    columns = payload.get("value") or []
    names = [str(column.get("name") or "").strip() for column in columns if str(column.get("name") or "").strip()]
    if not names:
        raise ProviderError(
            "excel_columns_missing",
            "The selected Excel table does not expose any column headers through Microsoft Graph.",
        )
    return names


def validate_workbook_binding(
    db: Session,
    connection: IntegrationConnection,
    binding: ExcelWorkbookBinding,
) -> list[str]:
    columns = list_table_columns(db, connection, binding)
    binding.last_validated_at = datetime.now(UTC)
    db.flush()
    return columns


def _canonical_header(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())


def _column_value(receipt: Receipt, header: str) -> str:
    normalized = _canonical_header(header)
    values = {
        "receiptid": str(receipt.id),
        "merchant": receipt.merchant_name or "",
        "vendor": receipt.merchant_name or "",
        "receiptnumber": receipt.receipt_number or "",
        "date": receipt.transaction_date.isoformat() if receipt.transaction_date else "",
        "transactiondate": receipt.transaction_date.isoformat() if receipt.transaction_date else "",
        "currency": receipt.currency,
        "category": receipt.category.name if receipt.category else "",
        "subtotal": str(receipt.subtotal_amount or ""),
        "tax": str(receipt.tax_amount or ""),
        "tip": str(receipt.tip_amount or ""),
        "total": str(receipt.total_amount or ""),
        "paymentmethod": receipt.payment_method or "",
        "notes": receipt.notes or "",
        "status": receipt.status.value,
        "approvedat": receipt.approved_at.isoformat() if receipt.approved_at else "",
        "createdat": receipt.created_at.isoformat(),
    }
    return values.get(normalized, "")


def append_receipt_row(
    db: Session,
    connection: IntegrationConnection,
    binding: ExcelWorkbookBinding,
    receipt: Receipt,
) -> dict:
    columns = validate_workbook_binding(db, connection, binding)
    recognized = sum(1 for column in columns if _column_value(receipt, column) != "")
    if recognized == 0:
        raise ProviderError(
            "excel_columns_unrecognized",
            "The selected Excel table does not contain any supported receipt columns.",
        )

    access_token = ensure_connection_access_token(db, connection)
    row = [_column_value(receipt, column) for column in columns]
    payload = _graph_request(
        "POST",
        access_token=access_token,
        path=f"drives/{binding.drive_id}/items/{binding.item_id}/workbook/tables/{binding.table_id}/rows/add",
        json={"values": [row]},
    )
    return {
        "provider": "microsoft_graph",
        "tableId": binding.table_id,
        "rowCount": len(payload.get("value") or []),
        "responsePayload": payload,
    }
