from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.billing import WorkbookBindingRead
from app.schemas.common import APIModel


class ConnectUrlRequest(APIModel):
    redirect_uri: str


class ConnectUrlResponse(APIModel):
    authorization_url: str
    state: str


class OAuthCallbackRequest(APIModel):
    code: str
    state: str
    realm_id: str | None = None


class IntegrationStatusRead(APIModel):
    provider: str
    status: str
    connected_at: datetime | None = None
    external_tenant_name: str | None = None
    scopes: list[str] = Field(default_factory=list)


class IntegrationHealthResponse(APIModel):
    quickbooks: IntegrationStatusRead
    microsoft: IntegrationStatusRead
    workbook_binding: WorkbookBindingRead | None = None
    sync_ready_targets: list[str] = Field(default_factory=list)


class MicrosoftWorkbookCandidateRead(APIModel):
    drive_id: str
    item_id: str
    name: str
    web_url: str | None = None
    path: str | None = None
    last_modified_at: datetime | None = None
    mime_type: str | None = None


class MicrosoftWorkbookSearchResponse(APIModel):
    data: list[MicrosoftWorkbookCandidateRead] = Field(default_factory=list)


class MicrosoftWorkbookTableRead(APIModel):
    table_id: str
    table_name: str
    worksheet_name: str | None = None


class MicrosoftWorkbookTableListResponse(APIModel):
    data: list[MicrosoftWorkbookTableRead] = Field(default_factory=list)
