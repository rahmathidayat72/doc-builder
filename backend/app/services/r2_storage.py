"""
Cloudflare R2 Storage Service Adapter for Satukit File Shelf
Task: FS-04 (Phase File Shelf)
Provides production Boto3 S3-compatible client and isolated in-memory test double.
"""

from __future__ import annotations

import hashlib
import os
from typing import Any


class R2StorageError(Exception):
    """Base exception for R2 storage operations."""
    pass


class R2ObjectNotFoundError(R2StorageError):
    pass


class R2StorageClient:
    """Abstract interface for Cloudflare R2 object storage operations."""

    def upload_object(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        raise NotImplementedError

    def get_object(self, key: str) -> bytes:
        raise NotImplementedError

    def delete_object(self, key: str) -> bool:
        raise NotImplementedError

    def head_object(self, key: str) -> dict[str, Any] | None:
        raise NotImplementedError

    def list_objects(self, prefix: str = "") -> list[str]:
        raise NotImplementedError


class InMemoryR2StorageClient(R2StorageClient):
    """Thread-safe in-memory test double simulating Cloudflare R2 Standard bucket."""

    def __init__(self) -> None:
        self._objects: dict[str, dict[str, Any]] = {}

    def upload_object(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        etag = f'"{hashlib.md5(data).hexdigest()}"'
        self._objects[key] = {
            "data": data,
            "content_type": content_type,
            "size": len(data),
            "etag": etag,
        }
        return etag

    def get_object(self, key: str) -> bytes:
        obj = self._objects.get(key)
        if obj is None:
            raise R2ObjectNotFoundError(f"Objek '{key}' tidak ditemukan di storage R2.")
        return obj["data"]

    def delete_object(self, key: str) -> bool:
        if key in self._objects:
            del self._objects[key]
            return True
        return False

    def head_object(self, key: str) -> dict[str, Any] | None:
        obj = self._objects.get(key)
        if obj is None:
            return None
        return {
            "key": key,
            "size": obj["size"],
            "content_type": obj["content_type"],
            "etag": obj["etag"],
        }

    def list_objects(self, prefix: str = "") -> list[str]:
        return [k for k in self._objects if k.startswith(prefix)]

    def clear(self) -> None:
        self._objects.clear()


class Boto3R2StorageClient(R2StorageClient):
    """Cloudflare R2 Standard S3-compatible client powered by Boto3."""

    def __init__(
        self,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket_name: str,
    ) -> None:
        import boto3
        from botocore.config import Config

        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
        self.bucket_name = bucket_name
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name="auto",
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )

    def upload_object(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        try:
            resp = self.client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            return resp.get("ETag", "").strip('"')
        except Exception as e:
            raise R2StorageError(f"Gagal mengunggah objek ke R2 ({key}): {e}") from e

    def get_object(self, key: str) -> bytes:
        try:
            resp = self.client.get_object(Bucket=self.bucket_name, Key=key)
            return resp["Body"].read()
        except self.client.exceptions.NoSuchKey as e:
            raise R2ObjectNotFoundError(f"Objek '{key}' tidak ditemukan di R2.") from e
        except Exception as e:
            if "NoSuchKey" in type(e).__name__ or "404" in str(e):
                raise R2ObjectNotFoundError(f"Objek '{key}' tidak ditemukan di R2.") from e
            raise R2StorageError(f"Gagal mengunduh objek dari R2 ({key}): {e}") from e

    def delete_object(self, key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except Exception as e:
            raise R2StorageError(f"Gagal menghapus objek dari R2 ({key}): {e}") from e

    def head_object(self, key: str) -> dict[str, Any] | None:
        try:
            resp = self.client.head_object(Bucket=self.bucket_name, Key=key)
            return {
                "key": key,
                "size": resp.get("ContentLength", 0),
                "content_type": resp.get("ContentType", ""),
                "etag": resp.get("ETag", "").strip('"'),
            }
        except Exception as e:
            if "NoSuchKey" in type(e).__name__ or "404" in str(e):
                return None
            raise R2StorageError(f"Gagal membaca metadata objek R2 ({key}): {e}") from e

    def list_objects(self, prefix: str = "") -> list[str]:
        try:
            resp = self.client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
            contents = resp.get("Contents", [])
            return [item["Key"] for item in contents if "Key" in item]
        except Exception as e:
            raise R2StorageError(f"Gagal membaca daftar objek R2: {e}") from e


_GLOBAL_R2_STORAGE: R2StorageClient | None = None


def get_r2_storage() -> R2StorageClient:
    """
    Get or initialize global R2 storage client.
    Automatically returns InMemoryR2StorageClient if credentials are absent or in test mode.
    """
    global _GLOBAL_R2_STORAGE
    if _GLOBAL_R2_STORAGE is not None:
        return _GLOBAL_R2_STORAGE

    account_id = os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")
    access_key = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    bucket_name = os.environ.get("CLOUDFLARE_R2_BUCKET_NAME")
    use_in_memory = os.environ.get("USE_IN_MEMORY_R2", "").lower() in ("1", "true", "yes")

    if use_in_memory or not (account_id and access_key and secret_key and bucket_name):
        _GLOBAL_R2_STORAGE = InMemoryR2StorageClient()
    else:
        _GLOBAL_R2_STORAGE = Boto3R2StorageClient(
            account_id=account_id,
            access_key_id=access_key,
            secret_access_key=secret_key,
            bucket_name=bucket_name,
        )

    return _GLOBAL_R2_STORAGE


def set_global_r2_storage(storage: R2StorageClient | None) -> None:
    global _GLOBAL_R2_STORAGE
    _GLOBAL_R2_STORAGE = storage
