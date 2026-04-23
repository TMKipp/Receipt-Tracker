from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.uploads import PresignUploadRequest, PresignUploadResponse
from app.services.provider_errors import ProviderError
from app.services.storage import create_presigned_receipt_upload, write_local_upload

router = APIRouter()


@router.post("/receipts/presign", response_model=PresignUploadResponse)
async def presign_receipt_upload(
    payload: PresignUploadRequest,
    request: Request,
) -> PresignUploadResponse:
    try:
        target = create_presigned_receipt_upload(
            filename=payload.filename,
            mime_type=payload.mime_type,
            base_url=str(request.base_url),
        )
    except ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=exc.message) from exc

    return PresignUploadResponse(upload_url=target.upload_url, object_key=target.object_key, headers=target.headers)


@router.put("/receipts/mock/{object_key:path}", status_code=status.HTTP_201_CREATED)
async def mock_receipt_upload(object_key: str, request: Request) -> dict[str, int | str]:
    body = await request.body()
    write_local_upload(object_key, body)
    return {"objectKey": object_key, "sizeBytes": len(body)}
