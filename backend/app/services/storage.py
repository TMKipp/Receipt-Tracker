from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import uuid

from app.core.config import settings
from app.services.provider_errors import ProviderError


@dataclass(slots=True)
class UploadTarget:
    upload_url: str
    object_key: str
    headers: dict[str, str]
    storage_provider: str


def storage_provider_name() -> str:
    return "s3" if settings.storage_provider.strip().lower() == "s3" else "local"


def build_receipt_object_key(filename: str) -> str:
    suffix = Path(filename).suffix or ".bin"
    return f"receipts/{uuid.uuid4()}{suffix.lower()}"


def get_local_object_path(object_key: str) -> Path:
    return Path(settings.local_uploads_dir) / object_key


def _get_s3_client():
    try:
        import boto3
    except ImportError as exc:
        raise ProviderError(
            "s3_dependency_missing",
            "boto3 is not installed, so S3 uploads cannot be used in this environment.",
        ) from exc

    kwargs: dict[str, str] = {
        "region_name": settings.s3_region,
    }
    if settings.s3_endpoint:
        kwargs["endpoint_url"] = settings.s3_endpoint
    if settings.s3_access_key_id:
        kwargs["aws_access_key_id"] = settings.s3_access_key_id
    if settings.s3_secret_access_key:
        kwargs["aws_secret_access_key"] = settings.s3_secret_access_key
    return boto3.client("s3", **kwargs)


def create_presigned_receipt_upload(
    *,
    filename: str,
    mime_type: str,
    base_url: str,
) -> UploadTarget:
    object_key = build_receipt_object_key(filename)
    if storage_provider_name() != "s3":
        upload_url = base_url.rstrip("/") + f"/api/v1/uploads/receipts/mock/{object_key}"
        return UploadTarget(
            upload_url=upload_url,
            object_key=object_key,
            headers={"Content-Type": mime_type},
            storage_provider="local",
        )

    if not settings.s3_bucket:
        raise ProviderError("s3_bucket_missing", "S3 storage is enabled but S3_BUCKET is not configured.")

    client = _get_s3_client()
    upload_url = client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": object_key,
            "ContentType": mime_type,
        },
        ExpiresIn=settings.s3_presign_expiry_seconds,
    )
    return UploadTarget(
        upload_url=upload_url,
        object_key=object_key,
        headers={"Content-Type": mime_type},
        storage_provider="s3",
    )


def write_local_upload(object_key: str, body: bytes) -> Path:
    target = get_local_object_path(object_key)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    return target


def read_object_bytes(object_key: str) -> bytes:
    if storage_provider_name() != "s3":
        target = get_local_object_path(object_key)
        if not target.exists():
            raise ProviderError("file_missing", f"Receipt file {object_key} was not found in local storage.")
        return target.read_bytes()

    client = _get_s3_client()
    response = client.get_object(Bucket=settings.s3_bucket, Key=object_key)
    return response["Body"].read()
