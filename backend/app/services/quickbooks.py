from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
import base64
import json
import uuid
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.category import Category
from app.models.enums import CategorySource, IntegrationProvider
from app.models.integration import IntegrationConnection
from app.models.receipt import Receipt, ReceiptFile
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
from app.services.storage import read_object_bytes

TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2"
EXPENSE_ACCOUNT_TYPES = {"Expense", "Other Expense", "Cost of Goods Sold"}
PAYMENT_ACCOUNT_TYPES = {"Bank", "Credit Card", "Other Current Asset"}
QBO_REQUEST_ID_MAX_LENGTH = 50


def build_quickbooks_authorization_url(state: str, redirect_uri: str | None) -> str:
    params = urlencode(
        {
            "client_id": settings.qbo_client_id or "YOUR_QBO_CLIENT_ID",
            "redirect_uri": redirect_uri or settings.qbo_redirect_uri,
            "response_type": "code",
            "scope": "com.intuit.quickbooks.accounting",
            "state": state,
        }
    )
    return f"{AUTHORIZE_URL}?{params}"


def begin_quickbooks_connection(db: Session, user: User, redirect_uri: str | None) -> tuple[str, str]:
    state = str(uuid.uuid4())
    save_pending_oauth_state(
        db,
        user,
        IntegrationProvider.QUICKBOOKS,
        state=state,
        redirect_uri=redirect_uri or settings.qbo_redirect_uri,
    )
    db.flush()
    return state, build_quickbooks_authorization_url(state, redirect_uri or settings.qbo_redirect_uri)


def _token_headers() -> dict[str, str]:
    if not settings.qbo_client_id or not settings.qbo_client_secret:
        raise ProviderError(
            "quickbooks_not_configured",
            "QuickBooks OAuth is not configured. Set QBO_CLIENT_ID and QBO_CLIENT_SECRET first.",
        )
    basic = base64.b64encode(f"{settings.qbo_client_id}:{settings.qbo_client_secret}".encode("utf-8")).decode("ascii")
    return {
        "Authorization": f"Basic {basic}",
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }


def _token_request(payload: dict[str, str]) -> dict:
    try:
        response = httpx.post(TOKEN_URL, data=payload, headers=_token_headers(), timeout=30.0)
    except httpx.HTTPError as exc:
        raise ProviderError(
            "quickbooks_oauth_transport_error",
            f"QuickBooks OAuth request failed: {exc}",
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
            "quickbooks_oauth_failed",
            f"QuickBooks OAuth failed: {detail}",
            needs_reauth=response.status_code in {400, 401},
        )
    return response.json()


def exchange_quickbooks_code(code: str, redirect_uri: str | None) -> dict:
    return _token_request(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri or settings.qbo_redirect_uri,
        }
    )


def refresh_quickbooks_tokens(refresh_token: str) -> dict:
    return _token_request({"grant_type": "refresh_token", "refresh_token": refresh_token})


def _quickbooks_request(
    method: str,
    *,
    access_token: str,
    realm_id: str,
    path: str,
    params: dict[str, str] | None = None,
    json: dict | None = None,
) -> dict:
    request_params = dict(params or {})
    request_params.setdefault("minorversion", str(settings.qbo_minor_version))
    url = f"{settings.qbo_base_url.rstrip('/')}/v3/company/{realm_id}/{path.lstrip('/')}"

    try:
        response = httpx.request(
            method,
            url,
            params=request_params,
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
            "quickbooks_transport_error",
            f"QuickBooks API request failed: {exc}",
            retryable=True,
        ) from exc

    if response.status_code >= 400:
        message = response.text
        payload = None
        try:
            payload = response.json()
            fault = payload.get("Fault", {})
            error_entries = fault.get("Error") or []
            if error_entries:
                first = error_entries[0]
                message = first.get("Detail") or first.get("Message") or message
        except ValueError:
            payload = None
        raise ProviderError(
            "quickbooks_api_failed",
            f"QuickBooks API error: {message}",
            retryable=response.status_code in {408, 409, 429, 500, 502, 503, 504},
            needs_reauth=response.status_code in {401, 403},
            details=payload if isinstance(payload, dict) else None,
        )

    return response.json()


def _quickbooks_upload_attachment(
    *,
    access_token: str,
    realm_id: str,
    purchase_id: str,
    receipt_file: ReceiptFile,
    receipt_id: uuid.UUID,
) -> dict:
    file_bytes = read_object_bytes(receipt_file.object_key)
    filename = receipt_file.original_filename or receipt_file.object_key.rsplit("/", 1)[-1] or f"receipt-{receipt_id}.bin"
    content_type = receipt_file.mime_type or "application/octet-stream"
    metadata = {
        "FileName": filename,
        "ContentType": content_type,
        "Note": f"Receipt Tracker source image for receipt {receipt_id}",
        "AttachableRef": [
            {
                "EntityRef": {
                    "type": "Purchase",
                    "value": purchase_id,
                }
            }
        ],
    }
    url = f"{settings.qbo_base_url.rstrip('/')}/v3/company/{realm_id}/upload"

    try:
        response = httpx.post(
            url,
            params={"minorversion": str(settings.qbo_minor_version)},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            files={
                "file_metadata_01": ("attachment.json", json.dumps(metadata), "application/json"),
                "file_content_01": (filename, file_bytes, content_type),
            },
            timeout=60.0,
        )
    except httpx.HTTPError as exc:
        raise ProviderError(
            "quickbooks_attachment_transport_error",
            f"QuickBooks attachment upload failed: {exc}",
            retryable=True,
        ) from exc

    if response.status_code >= 400:
        message = response.text
        details = None
        try:
            details = response.json()
            fault = details.get("Fault", {}) if isinstance(details, dict) else {}
            error_entries = fault.get("Error") or []
            if error_entries:
                first = error_entries[0]
                message = first.get("Detail") or first.get("Message") or message
        except ValueError:
            details = None
        raise ProviderError(
            "quickbooks_attachment_failed",
            f"QuickBooks expense was created, but the receipt image could not be attached: {message}",
            retryable=response.status_code in {408, 409, 429, 500, 502, 503, 504},
            needs_reauth=response.status_code in {401, 403},
            details=details if isinstance(details, dict) else None,
        )

    payload = response.json()
    attachables = payload.get("AttachableResponse") or payload.get("Attachable") or []
    return {
        "status": "attached",
        "fileName": filename,
        "contentType": content_type,
        "fileSizeBytes": receipt_file.file_size_bytes,
        "responsePayload": payload,
        "attachmentCount": len(attachables) if isinstance(attachables, list) else 1,
    }


def _query(access_token: str, realm_id: str, query: str) -> dict:
    return _quickbooks_request(
        "GET",
        access_token=access_token,
        realm_id=realm_id,
        path="query",
        params={"query": query, "minorversion": str(settings.qbo_minor_version)},
    )


def _fetch_company_name(access_token: str, realm_id: str) -> str:
    payload = _quickbooks_request(
        "GET",
        access_token=access_token,
        realm_id=realm_id,
        path=f"companyinfo/{realm_id}",
    )
    info = payload.get("CompanyInfo") or {}
    return str(info.get("CompanyName") or info.get("LegalName") or f"QuickBooks realm {realm_id}")


def _sync_chart_of_accounts(db: Session, user: User, access_token: str, realm_id: str, connection: IntegrationConnection) -> None:
    payload = _query(access_token, realm_id, "select * from Account where Active = true MAXRESULTS 1000")
    accounts = (payload.get("QueryResponse") or {}).get("Account") or []
    expense_accounts = [account for account in accounts if account.get("AccountType") in EXPENSE_ACCOUNT_TYPES]
    payment_accounts = [account for account in accounts if account.get("AccountType") in PAYMENT_ACCOUNT_TYPES]

    existing_categories = db.scalars(select(Category).where(Category.user_id == user.id)).all()
    existing_by_external = {
        category.external_account_id: category
        for category in existing_categories
        if category.external_account_id
    }
    existing_by_name = {category.name.lower(): category for category in existing_categories}

    for account in expense_accounts:
        account_id = str(account.get("Id"))
        account_name = str(account.get("FullyQualifiedName") or account.get("Name") or "").strip()
        if not account_id or not account_name:
            continue
        category = existing_by_external.get(account_id) or existing_by_name.get(account_name.lower())
        if category is None:
            category = Category(
                user_id=user.id,
                name=account_name,
                source=CategorySource.QUICKBOOKS,
            )
            db.add(category)
        category.name = account_name
        category.source = CategorySource.QUICKBOOKS
        category.external_account_id = account_id
        category.external_account_type = account.get("AccountType")
        category.is_active = bool(account.get("Active", True))

    payment_refs = [
        {
            "id": str(account.get("Id")),
            "name": str(account.get("FullyQualifiedName") or account.get("Name") or ""),
            "type": str(account.get("AccountType") or ""),
        }
        for account in payment_accounts
        if account.get("Id")
    ]

    metadata = dict(connection.metadata_json or {})
    metadata["importedChartOfAccountsAt"] = datetime.now(UTC).isoformat()
    metadata["paymentAccounts"] = payment_refs
    if payment_refs and not metadata.get("defaultPaymentAccountId"):
        metadata["defaultPaymentAccountId"] = payment_refs[0]["id"]
    connection.metadata_json = metadata
    db.flush()


def complete_quickbooks_callback(
    db: Session,
    *,
    user: User,
    code: str,
    state: str,
    realm_id: str | None,
) -> IntegrationConnection:
    if not realm_id:
        raise ProviderError("quickbooks_realm_missing", "QuickBooks did not return a realm ID for this connection.")

    connection = get_connection(db, user.id, IntegrationProvider.QUICKBOOKS)
    validate_pending_oauth_state(connection, state)
    redirect_uri = resolve_redirect_uri(connection, settings.qbo_redirect_uri)
    token_payload = exchange_quickbooks_code(code, redirect_uri)
    access_token = str(token_payload.get("access_token") or "")
    if not access_token:
        raise ProviderError("quickbooks_access_token_missing", "QuickBooks did not return an access token.")

    company_name = _fetch_company_name(access_token, realm_id)
    store_oauth_tokens(
        connection,
        token_payload=token_payload,
        external_tenant_id=realm_id,
        external_tenant_name=company_name,
        scopes=parse_scopes(token_payload.get("scope")),
        metadata_updates={"realmId": realm_id, "companyName": company_name},
    )
    _sync_chart_of_accounts(db, user, access_token, realm_id, connection)
    db.flush()
    return connection


def _escape_query_value(value: str) -> str:
    return value.replace("'", "''")


def _ensure_vendor(access_token: str, realm_id: str, vendor_name: str | None) -> str | None:
    if not vendor_name:
        return None
    query = f"select * from Vendor where DisplayName = '{_escape_query_value(vendor_name)}' MAXRESULTS 1"
    payload = _query(access_token, realm_id, query)
    vendors = (payload.get("QueryResponse") or {}).get("Vendor") or []
    if vendors:
        return str(vendors[0].get("Id"))

    created = _quickbooks_request(
        "POST",
        access_token=access_token,
        realm_id=realm_id,
        path="vendor",
        json={"DisplayName": vendor_name},
    )
    vendor = created.get("Vendor") or {}
    return str(vendor.get("Id")) if vendor.get("Id") else None


def _payment_type(payment_method: str | None) -> str:
    haystack = (payment_method or "").lower()
    if any(token in haystack for token in ("visa", "amex", "mastercard", "discover", "card")):
        return "CreditCard"
    return "Cash"


def _money(value: Decimal | None) -> float:
    return float(value or Decimal("0.00"))


def _build_purchase_payload(
    receipt: Receipt,
    *,
    vendor_id: str | None,
    expense_account_id: str,
    payment_account_id: str,
) -> dict:
    line_items = []
    for item in receipt.line_items:
        amount = item.line_total_amount or item.unit_price_amount or Decimal("0.00")
        if amount <= Decimal("0.00"):
            continue
        line_items.append(
            {
                "Amount": _money(amount),
                "Description": item.description,
                "DetailType": "AccountBasedExpenseLineDetail",
                "AccountBasedExpenseLineDetail": {
                    "AccountRef": {"value": expense_account_id},
                    "BillableStatus": "NotBillable",
                },
            }
        )

    if not line_items:
        line_items.append(
            {
                "Amount": _money(receipt.total_amount),
                "Description": receipt.notes or receipt.merchant_name or "Receipt expense",
                "DetailType": "AccountBasedExpenseLineDetail",
                "AccountBasedExpenseLineDetail": {
                    "AccountRef": {"value": expense_account_id},
                    "BillableStatus": "NotBillable",
                },
            }
        )

    payload = {
        "PaymentType": _payment_type(receipt.payment_method),
        "AccountRef": {"value": payment_account_id},
        "PrivateNote": f"Synced from Receipt Tracker receipt {receipt.id}",
        "Line": line_items,
    }
    if receipt.transaction_date:
        payload["TxnDate"] = receipt.transaction_date.isoformat()
    if vendor_id:
        payload["EntityRef"] = {"value": vendor_id, "type": "Vendor"}
    return payload


def _quickbooks_request_id(idempotency_key: str) -> str:
    return idempotency_key.replace(":", "-")[:QBO_REQUEST_ID_MAX_LENGTH]


def _attach_receipt_image(
    *,
    access_token: str,
    realm_id: str,
    purchase_id: str,
    receipt: Receipt,
) -> dict:
    if not purchase_id:
        return {
            "status": "skipped",
            "reason": "QuickBooks did not return a purchase ID to attach the source file to.",
        }
    if not receipt.files:
        return {
            "status": "skipped",
            "reason": "No source receipt image is available for attachment.",
        }
    try:
        return _quickbooks_upload_attachment(
            access_token=access_token,
            realm_id=realm_id,
            purchase_id=purchase_id,
            receipt_file=receipt.files[0],
            receipt_id=receipt.id,
        )
    except ProviderError as exc:
        return {
            "status": "failed",
            "errorCode": exc.code,
            "message": exc.message,
            "retryable": exc.retryable,
            "needsReauth": exc.needs_reauth,
            "details": exc.details,
        }


def sync_receipt_to_quickbooks(
    db: Session,
    connection: IntegrationConnection,
    receipt: Receipt,
    *,
    idempotency_key: str,
) -> dict:
    realm_id = connection.external_tenant_id or str((connection.metadata_json or {}).get("realmId") or "")
    if not realm_id:
        raise ProviderError("quickbooks_realm_missing", "QuickBooks realm information is missing from this connection.", needs_reauth=True)

    access_token = ensure_connection_access_token(db, connection)
    expense_account_id = receipt.category.external_account_id if receipt.category else None
    if not expense_account_id:
        raise ProviderError(
            "quickbooks_category_unmapped",
            "The selected category is not mapped to a QuickBooks expense account yet.",
        )

    payment_account_id = str((connection.metadata_json or {}).get("defaultPaymentAccountId") or "")
    if not payment_account_id:
        raise ProviderError(
            "quickbooks_payment_account_missing",
            "QuickBooks connected successfully, but no payment account was imported for expense sync.",
        )

    vendor_id = _ensure_vendor(access_token, realm_id, receipt.vendor.display_name if receipt.vendor else receipt.merchant_name)
    payload = _build_purchase_payload(
        receipt,
        vendor_id=vendor_id,
        expense_account_id=expense_account_id,
        payment_account_id=payment_account_id,
    )
    response = _quickbooks_request(
        "POST",
        access_token=access_token,
        realm_id=realm_id,
        path="purchase",
        params={"requestid": _quickbooks_request_id(idempotency_key), "minorversion": str(settings.qbo_minor_version)},
        json=payload,
    )
    purchase = response.get("Purchase") or {}
    purchase_id = str(purchase.get("Id") or "")
    attachment = _attach_receipt_image(
        access_token=access_token,
        realm_id=realm_id,
        purchase_id=purchase_id,
        receipt=receipt,
    )
    return {
        "externalObjectId": purchase_id,
        "provider": "quickbooks",
        "requestId": _quickbooks_request_id(idempotency_key),
        "requestPayload": payload,
        "responsePayload": response,
        "attachment": attachment,
    }
