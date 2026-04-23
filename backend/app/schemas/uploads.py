from __future__ import annotations

from app.schemas.common import APIModel


class PresignUploadRequest(APIModel):
    filename: str
    mime_type: str
    size_bytes: int
    sha256: str | None = None


class PresignUploadResponse(APIModel):
    upload_url: str
    object_key: str
    headers: dict[str, str]

