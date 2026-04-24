from __future__ import annotations

from datetime import UTC, datetime
import uuid
from urllib.parse import quote
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
EXCEL_MIME_TYPES = {
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroenabled.12",
    "application/vnd.ms-excel.sheet.binary.macroenabled.12",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
EXCEL_EXTENSIONS = (".xlsx", ".xlsm", ".xlsb", ".xls")
EXCEL_SUPPORTED_COLUMN_LABELS = {
    "receiptid": "Receipt ID",
    "merchant": "Merchant",
    "vendor": "Vendor",
    "biller": "Biller",
    "receiptnumber": "Receipt Number",
    "date": "Date",
    "receiptdate": "Receipt Date",
    "transactiondate": "Transaction Date",
    "currency": "Currency",
    "category": "Category",
    "subtotal": "Subtotal",
    "tax": "Tax",
    "tip": "Tip",
    "total": "Total",
    "amount": "Amount",
    "amountdue": "Amount Due",
    "paymentmethod": "Payment Method",
    "notes": "Notes",
    "status": "Status",
    "approvedat": "Approved At",
    "createdat": "Created At",
}
EXCEL_RECOMMENDED_COLUMN_GROUPS = {
    "Vendor or Merchant": {"vendor", "merchant", "biller"},
    "Date": {"date", "receiptdate", "transactiondate"},
    "Total or Amount": {"total", "amount", "amountdue"},
    "Category": {"category"},
}


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
    return _list_table_column_names(
        access_token=access_token,
        drive_id=binding.drive_id,
        item_id=binding.item_id,
        table_id=binding.table_id,
    )


def _list_table_column_names(
    *,
    access_token: str,
    drive_id: str,
    item_id: str,
    table_id: str,
) -> list[str]:
    payload = _graph_request(
        "GET",
        access_token=access_token,
        path=f"drives/{drive_id}/items/{item_id}/workbook/tables/{table_id}/columns",
    )
    columns = payload.get("value") or []
    names = [str(column.get("name") or "").strip() for column in columns if str(column.get("name") or "").strip()]
    if not names:
        raise ProviderError(
            "excel_columns_missing",
            "The selected Excel table does not expose any column headers through Microsoft Graph.",
        )
    return names


def _normalize_drive_item(item: dict) -> dict | None:
    candidate = item.get("remoteItem") if isinstance(item.get("remoteItem"), dict) else item
    if not isinstance(candidate, dict):
        return None

    file_payload = candidate.get("file") if isinstance(candidate.get("file"), dict) else item.get("file")
    if not isinstance(file_payload, dict):
        return None

    name = str(candidate.get("name") or item.get("name") or "").strip()
    if not name:
        return None

    mime_type = str(file_payload.get("mimeType") or "").strip() or None
    lower_name = name.lower()
    if mime_type not in EXCEL_MIME_TYPES and not lower_name.endswith(EXCEL_EXTENSIONS):
        return None

    parent_reference = candidate.get("parentReference")
    if not isinstance(parent_reference, dict):
        parent_reference = item.get("parentReference")
    if not isinstance(parent_reference, dict):
        parent_reference = {}

    drive_id = str(parent_reference.get("driveId") or "").strip()
    item_id = str(candidate.get("id") or item.get("id") or "").strip()
    if not drive_id or not item_id:
        return None

    return {
        "drive_id": drive_id,
        "item_id": item_id,
        "name": name,
        "web_url": str(candidate.get("webUrl") or item.get("webUrl") or "").strip() or None,
        "path": str(parent_reference.get("path") or "").strip() or None,
        "last_modified_at": candidate.get("lastModifiedDateTime") or item.get("lastModifiedDateTime"),
        "mime_type": mime_type,
    }


def search_excel_workbooks(
    db: Session,
    connection: IntegrationConnection,
    *,
    query: str | None,
    limit: int = 8,
) -> list[dict[str, object]]:
    access_token = ensure_connection_access_token(db, connection)
    query_text = (query or "").strip() or "xlsx"
    encoded_query = quote(query_text, safe="")
    payload = _graph_request(
        "GET",
        access_token=access_token,
        path=f"me/drive/search(q='{encoded_query}')",
        params={
            "$top": str(limit),
            "$select": "id,name,webUrl,lastModifiedDateTime,parentReference,file,remoteItem",
        },
    )

    normalized: list[dict[str, object]] = []
    seen: set[tuple[str, str]] = set()
    for item in payload.get("value") or []:
        if not isinstance(item, dict):
            continue
        workbook = _normalize_drive_item(item)
        if workbook is None:
            continue
        key = (str(workbook["drive_id"]), str(workbook["item_id"]))
        if key in seen:
            continue
        seen.add(key)
        normalized.append(workbook)

    return normalized


def list_workbook_tables(
    db: Session,
    connection: IntegrationConnection,
    *,
    drive_id: str,
    item_id: str,
) -> list[dict[str, object]]:
    access_token = ensure_connection_access_token(db, connection)
    payload = _graph_request(
        "GET",
        access_token=access_token,
        path=f"drives/{drive_id}/items/{item_id}/workbook/tables",
        params={
            "$top": "50",
            "$expand": "worksheet($select=id,name)",
            "$select": "id,name",
        },
    )

    tables: list[dict[str, str | None]] = []
    for item in payload.get("value") or []:
        if not isinstance(item, dict):
            continue
        table_id = str(item.get("id") or "").strip()
        table_name = str(item.get("name") or "").strip()
        if not table_id or not table_name:
            continue
        worksheet = item.get("worksheet") if isinstance(item.get("worksheet"), dict) else {}
        worksheet_name = str(worksheet.get("name") or "").strip() or None
        try:
            columns = _list_table_column_names(
                access_token=access_token,
                drive_id=drive_id,
                item_id=item_id,
                table_id=table_id,
            )
        except ProviderError:
            columns = []
        compatibility = summarize_excel_columns(columns)
        tables.append(
            {
                "table_id": table_id,
                "table_name": table_name,
                "worksheet_name": worksheet_name,
                "columns": columns,
                **compatibility,
            }
        )

    return tables


def validate_workbook_binding(
    db: Session,
    connection: IntegrationConnection,
    binding: ExcelWorkbookBinding,
) -> list[str]:
    columns = list_table_columns(db, connection, binding)
    compatibility = summarize_excel_columns(columns)
    if not compatibility["supported_columns"]:
        raise ProviderError(
            "excel_columns_unrecognized",
            "The selected Excel table does not contain any supported receipt columns. Add columns such as Vendor, Date, Total, Category, Tax, or Notes.",
        )
    binding.last_validated_at = datetime.now(UTC)
    db.flush()
    return columns


def _canonical_header(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())


def summarize_excel_columns(columns: list[str]) -> dict[str, object]:
    canonical_columns = {_canonical_header(column): column for column in columns}
    supported_columns = [
        original_name for canonical, original_name in canonical_columns.items() if canonical in EXCEL_SUPPORTED_COLUMN_LABELS
    ]
    missing_recommended_columns = [
        label
        for label, aliases in EXCEL_RECOMMENDED_COLUMN_GROUPS.items()
        if not any(alias in canonical_columns for alias in aliases)
    ]
    return {
        "supported_columns": supported_columns,
        "missing_recommended_columns": missing_recommended_columns,
        "sync_ready": bool(supported_columns) and len(missing_recommended_columns) <= 2,
    }


def _column_value(receipt: Receipt, header: str) -> str:
    normalized = _canonical_header(header)
    values = {
        "receiptid": str(receipt.id),
        "merchant": receipt.merchant_name or "",
        "vendor": receipt.merchant_name or "",
        "biller": receipt.merchant_name or "",
        "receiptnumber": receipt.receipt_number or "",
        "date": receipt.transaction_date.isoformat() if receipt.transaction_date else "",
        "receiptdate": receipt.transaction_date.isoformat() if receipt.transaction_date else "",
        "transactiondate": receipt.transaction_date.isoformat() if receipt.transaction_date else "",
        "currency": receipt.currency,
        "category": receipt.category.name if receipt.category else "",
        "subtotal": str(receipt.subtotal_amount or ""),
        "tax": str(receipt.tax_amount or ""),
        "tip": str(receipt.tip_amount or ""),
        "total": str(receipt.total_amount or ""),
        "amount": str(receipt.total_amount or ""),
        "amountdue": str(receipt.total_amount or ""),
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
