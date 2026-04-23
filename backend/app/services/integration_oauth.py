from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import IntegrationProvider, IntegrationStatus
from app.models.integration import IntegrationConnection
from app.models.user import User
from app.services.crypto import open_secret, seal_secret
from app.services.provider_errors import ProviderError

TOKEN_REFRESH_SKEW = timedelta(minutes=5)


def get_connection(db: Session, user_id: uuid.UUID, provider: IntegrationProvider) -> IntegrationConnection | None:
    return db.scalar(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.provider == provider,
        )
    )


def get_or_create_connection(
    db: Session,
    user: User,
    provider: IntegrationProvider,
) -> IntegrationConnection:
    connection = get_connection(db, user.id, provider)
    if connection is None:
        connection = IntegrationConnection(user_id=user.id, provider=provider)
        db.add(connection)
        db.flush()
    return connection


def save_pending_oauth_state(
    db: Session,
    user: User,
    provider: IntegrationProvider,
    *,
    state: str,
    redirect_uri: str | None,
) -> IntegrationConnection:
    connection = get_or_create_connection(db, user, provider)
    metadata = dict(connection.metadata_json or {})
    metadata["pendingOAuthState"] = state
    metadata["pendingRedirectUri"] = redirect_uri
    metadata["tokenStorage"] = "fernet"
    connection.metadata_json = metadata
    db.flush()
    return connection


def validate_pending_oauth_state(connection: IntegrationConnection | None, state: str) -> None:
    expected = str((connection.metadata_json or {}).get("pendingOAuthState") or "").strip() if connection else ""
    if expected and expected == state:
        return
    raise ProviderError("oauth_state_mismatch", "The OAuth callback state did not match the pending connection request.")


def resolve_redirect_uri(connection: IntegrationConnection | None, fallback: str | None) -> str | None:
    pending_redirect = str((connection.metadata_json or {}).get("pendingRedirectUri") or "").strip() if connection else ""
    return pending_redirect or fallback


def parse_scopes(scope_value: str | list[str] | None) -> list[str]:
    if scope_value is None:
        return []
    if isinstance(scope_value, list):
        return [str(item).strip() for item in scope_value if str(item).strip()]
    return [part for part in str(scope_value).split(" ") if part]


def store_oauth_tokens(
    connection: IntegrationConnection,
    *,
    token_payload: dict[str, Any],
    external_tenant_id: str,
    external_tenant_name: str,
    scopes: list[str] | None = None,
    metadata_updates: dict[str, Any] | None = None,
) -> None:
    metadata = dict(connection.metadata_json or {})
    metadata.pop("pendingOAuthState", None)
    metadata.pop("pendingRedirectUri", None)
    metadata["tokenStorage"] = "fernet"
    metadata["tokenType"] = token_payload.get("token_type")
    if metadata_updates:
        metadata.update(metadata_updates)

    expires_in = int(token_payload.get("expires_in") or 0)
    access_token = token_payload.get("access_token")
    refresh_token = token_payload.get("refresh_token")
    if not access_token:
        raise ProviderError("access_token_missing", "The OAuth provider did not return an access token.")
    if not refresh_token:
        refresh_token = get_refresh_token(connection)

    connection.status = IntegrationStatus.CONNECTED
    connection.external_tenant_id = external_tenant_id
    connection.external_tenant_name = external_tenant_name
    connection.access_token_encrypted = seal_secret(access_token)
    connection.refresh_token_encrypted = seal_secret(refresh_token)
    connection.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in) if expires_in else None
    connection.scopes = scopes or parse_scopes(token_payload.get("scope"))
    connection.metadata_json = metadata


def get_access_token(connection: IntegrationConnection) -> str | None:
    return open_secret(connection.access_token_encrypted)


def get_refresh_token(connection: IntegrationConnection) -> str | None:
    return open_secret(connection.refresh_token_encrypted)


def ensure_connection_access_token(db: Session, connection: IntegrationConnection) -> str:
    now = datetime.now(UTC)
    current_token = get_access_token(connection)
    if current_token and connection.token_expires_at and connection.token_expires_at > now + TOKEN_REFRESH_SKEW:
        return current_token
    if current_token and connection.token_expires_at is None:
        return current_token

    refresh_token = get_refresh_token(connection)
    if not refresh_token:
        connection.status = IntegrationStatus.EXPIRED
        db.flush()
        raise ProviderError(
            "refresh_token_missing",
            f"{connection.provider.value} requires the user to reconnect before syncing again.",
            needs_reauth=True,
        )

    if connection.provider == IntegrationProvider.QUICKBOOKS:
        from app.services.quickbooks import refresh_quickbooks_tokens

        token_payload = refresh_quickbooks_tokens(refresh_token)
    elif connection.provider == IntegrationProvider.MICROSOFT:
        from app.services.microsoft_graph import refresh_microsoft_tokens

        token_payload = refresh_microsoft_tokens(refresh_token)
    else:
        raise ProviderError("unsupported_provider", f"{connection.provider.value} token refresh is not implemented.")

    store_oauth_tokens(
        connection,
        token_payload=token_payload,
        external_tenant_id=connection.external_tenant_id or "",
        external_tenant_name=connection.external_tenant_name or connection.provider.value.title(),
        scopes=parse_scopes(token_payload.get("scope")) or list(connection.scopes or []),
        metadata_updates={"refreshedAt": now.isoformat()},
    )
    db.flush()
    refreshed_token = get_access_token(connection)
    if not refreshed_token:
        raise ProviderError(
            "token_refresh_failed",
            f"{connection.provider.value} refresh completed without returning an access token.",
            needs_reauth=True,
        )
    return refreshed_token
