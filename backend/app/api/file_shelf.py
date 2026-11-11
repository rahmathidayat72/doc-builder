"""
API Endpoints for Satukit File Shelf (Rak Berkas)
Task: FS-06 (Phase File Shelf)
Endpoints:
- POST   /api/files/upload      : Raw stream upload with base64url metadata header
- GET    /api/files             : List user files (anti-BOLA)
- GET    /api/files/{id}/download: Download with lease verification and on-the-fly decryption
- DELETE /api/files/{id}        : Soft delete (immediate access revocation + R2 cleanup queue)
- GET    /api/files/metrics     : User quota and cloud storage metrics
"""

from __future__ import annotations

import base64
import json
import os
import re
import time
from collections.abc import Iterator
from contextlib import contextmanager
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import FileRateEvent, RuntimeState
from app.db.postgres import get_db_session
from app.db.repositories.file_shelf_repository import (
    DownloadLeaseBusyError,
    FileShelfRepository,
    InFlightUploadExistsError,
    QuotaExceededError,
    RateLimitExceededError,
)
from app.services.file_crypto import decrypt_file_envelope
from app.services.file_inspector import QuarantineManager
from app.services.r2_storage import get_r2_storage

router = APIRouter(prefix="/files", tags=["Rak Berkas"])

_ENGINE_OVERRIDE: Engine | None = None


def set_file_shelf_engine_override(eng: Engine | None) -> None:
    global _ENGINE_OVERRIDE
    _ENGINE_OVERRIDE = eng


@contextmanager
def get_file_shelf_session() -> Iterator[Session]:
    with get_db_session(engine_override=_ENGINE_OVERRIDE) as session:
        yield session


def _require_user(request: Request):
    user = getattr(request.state, "current_user", None)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Autentikasi diperlukan untuk mengakses Rak Berkas.",
        )
    if not getattr(user, "email_verified", False):
        raise HTTPException(
            status_code=403,
            detail="Alamat email belum diverifikasi. Harap verifikasi email Anda terlebih dahulu.",
        )
    return user


def check_r2_storage_health(session: Session) -> tuple[str, bool, bool]:
    """
    Evaluates R2 metrics fail-closed status:
    Returns (status_str, can_upload, can_download)
    """
    r2_state = session.get(RuntimeState, "r2_metrics")
    now = time.time()
    if not r2_state:
        if settings.IS_PRODUCTION:
            return "BLOCKED_METRICS_UNAVAILABLE", False, False
        return "HEALTHY", True, True

    metrics = r2_state.value or {}
    last_polled = r2_state.updated_at or metrics.get("last_polled_at", 0)

    # Stale metrics > 30 minutes in production -> fail-closed
    if settings.IS_PRODUCTION and (now - last_polled > 1800):
        return "BLOCKED_STALE_METRICS", False, False

    storage_bytes = metrics.get("storage_bytes", 0)
    class_a_ops = metrics.get("class_a_operations", 0)
    class_b_ops = metrics.get("class_b_operations", 0)

    # Hard ceiling 7 GB
    HARD_CEILING_BYTES = 7 * 1024 * 1024 * 1024
    if storage_bytes >= HARD_CEILING_BYTES:
        return "BLOCKED_STORAGE_CEILING", False, True

    # Class A >= 800k blocks upload
    if class_a_ops >= 800_000:
        return "BLOCKED_CLASS_A_LIMIT", False, True

    # Class B >= 8M blocks download
    if class_b_ops >= 8_000_000:
        return "BLOCKED_CLASS_B_LIMIT", True, False

    # Warning alert threshold
    if class_a_ops >= 700_000 or class_b_ops >= 7_000_000:
        return "WARNING_APPROACHING_LIMIT", True, True

    return "HEALTHY", True, True


def _release_download_lease_bg(lease_id: str) -> None:
    try:
        with get_file_shelf_session() as session:
            repo = FileShelfRepository(session)
            repo.release_download_lease(lease_id)
    except Exception:
        pass


@router.post("/upload")
async def upload_file(request: Request):
    """
    Upload raw stream binary file into quarantine (0600) with status CHECKING.
    Enforces atomic 5-slot quota, 1 in-flight upload, and rolling hour limits.
    """
    user = _require_user(request)

    # 1. Parse base64url metadata header
    metadata_header = request.headers.get("X-File-Metadata") or request.headers.get("X-Metadata")
    if not metadata_header:
        raise HTTPException(
            status_code=400,
            detail="Header metadata berkas (X-File-Metadata) wajib disertakan.",
        )

    try:
        padding = "=" * ((4 - len(metadata_header) % 4) % 4)
        raw_meta = base64.urlsafe_b64decode((metadata_header + padding).encode("ascii"))
        meta_dict = json.loads(raw_meta.decode("utf-8"))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Format header X-File-Metadata base64url tidak valid.",
        ) from e

    filename = str(meta_dict.get("filename", "")).strip()
    # Sanitize filename (anti-path-traversal)
    clean_filename = os.path.basename(filename).replace("\x00", "")
    clean_filename = re.sub(r"[\r\n\t]", "", clean_filename).strip()
    if not clean_filename or len(clean_filename) > 255:
        raise HTTPException(
            status_code=400,
            detail="Nama berkas dalam metadata tidak valid (maksimal 255 karakter).",
        )

    content_type = str(meta_dict.get("content_type", "application/octet-stream")).strip()
    has_exif_warning = bool(meta_dict.get("has_exif_warning", False))

    # 2. Check Cloudflare R2 fail-closed health
    with get_file_shelf_session() as session:
        _status_str, can_upload, _ = check_r2_storage_health(session)
        if not can_upload:
            raise HTTPException(
                status_code=503,
                detail="Penyimpanan berkas sedang dalam pemeliharaan batas kuota cloud.",
            )

    # 3. Read raw stream body
    data = await request.body()
    size_bytes = len(data)

    if size_bytes > 25_000_000:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran berkas ({size_bytes} byte) melebihi batas 25 MB (25.000.000 byte).",
        )
    if size_bytes == 0:
        raise HTTPException(status_code=400, detail="Berkas kosong tidak dapat diunggah.")

    # 4. Atomically reserve slot and save to quarantine
    with get_file_shelf_session() as session:
        repo = FileShelfRepository(session)
        try:
            item = repo.reserve_upload_slot(
                user_id=user.id,
                filename=clean_filename,
                content_type=content_type,
                size_bytes=size_bytes,
                has_exif_warning=has_exif_warning,
            )
        except QuotaExceededError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except InFlightUploadExistsError as e:
            raise HTTPException(status_code=409, detail=str(e)) from e
        except RateLimitExceededError as e:
            raise HTTPException(status_code=429, detail=str(e)) from e

        # Write to quarantine mode 0600
        qm = QuarantineManager()
        qpath = qm.write_file(item.id, data)
        item.quarantine_path = qpath
        session.flush()

        resp_data = {
            "id": item.id,
            "filename": item.filename,
            "content_type": item.content_type,
            "size_bytes": item.size_bytes,
            "status": item.status,
            "has_exif_warning": item.has_exif_warning,
            "uploaded_at": item.uploaded_at,
        }

    return JSONResponse(status_code=202, content={"success": True, "data": resp_data})


@router.get("")
def list_user_files(request: Request):
    """List all active files for the authenticated user (anti-BOLA)."""
    user = _require_user(request)
    with get_file_shelf_session() as session:
        repo = FileShelfRepository(session)
        items = repo.list_user_items(user.id)
        data = [
            {
                "id": it.id,
                "filename": it.filename,
                "content_type": it.content_type,
                "size_bytes": it.size_bytes,
                "status": it.status,
                "has_exif_warning": it.has_exif_warning,
                "sha256_hash": it.sha256_hash,
                "uploaded_at": it.uploaded_at,
                "available_at": it.available_at,
                "expires_at": it.expires_at,
                "error_message": it.error_message,
            }
            for it in items
        ]
    return {"success": True, "data": data}


@router.get("/{item_id}/download")
def download_file(item_id: str, request: Request, background_tasks: BackgroundTasks):
    """
    Download and decrypt file on-the-fly from R2 storage.
    Enforces active download lease and rolling hour rate limits.
    """
    user = _require_user(request)

    # 1. Check R2 Class B download quota
    with get_file_shelf_session() as session:
        _status_str, _, can_download = check_r2_storage_health(session)
        if not can_download:
            msg = "Unduhan dibatasi sementara karena kuota operasi Class B cloud tercapai."
            raise HTTPException(status_code=503, detail=msg)

        repo = FileShelfRepository(session)
        # 2. Anti-BOLA: retrieve item owned strictly by this user
        item = repo.get_item_by_id(item_id, user.id)
        if not item or item.status == "DELETED":
            raise HTTPException(status_code=404, detail="Berkas tidak ditemukan.")

        if item.status != "AVAILABLE":
            if item.status == "CHECKING":
                raise HTTPException(
                    status_code=400,
                    detail="Berkas sedang dalam proses pemindaian keamanan dan belum siap diunduh.",
                )
            raise HTTPException(status_code=400, detail="Berkas tidak tersedia untuk diunduh.")

        # 3. Acquire download lease
        try:
            lease = repo.acquire_download_lease(user.id, item.id)
        except RateLimitExceededError as e:
            raise HTTPException(status_code=429, detail=str(e)) from e
        except DownloadLeaseBusyError as e:
            raise HTTPException(status_code=429, detail=str(e)) from e

        lease_id = lease.id
        r2_key = item.r2_object_key
        item_user_id = item.user_id
        item_id_val = item.id
        item_content_type = item.content_type
        item_filename = item.filename

    # 4. Fetch encrypted ciphertext from R2
    r2_client = get_r2_storage()
    try:
        encrypted_bytes = r2_client.get_object(r2_key)
    except Exception as e:
        _release_download_lease_bg(lease_id)
        raise HTTPException(
            status_code=502,
            detail=f"Gagal mengambil objek berkas dari cloud storage: {e}",
        ) from e

    # 5. Decrypt envelope with canonical identity AAD
    try:
        decrypted_bytes = decrypt_file_envelope(
            envelope=encrypted_bytes,
            user_id=item_user_id,
            item_id=item_id_val,
            content_type=item_content_type,
        )
    except Exception as e:
        _release_download_lease_bg(lease_id)
        raise HTTPException(
            status_code=500,
            detail=f"Kegagalan dekripsi integritas data berkas: {e}",
        ) from e

    # 6. Schedule release of download lease in background
    background_tasks.add_task(_release_download_lease_bg, lease_id)

    # 7. Build RFC 5987 Content-Disposition header
    ascii_name = item_filename.encode("ascii", "ignore").decode("ascii") or "download.bin"
    quoted_name = quote(item_filename)
    disp = f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quoted_name}'
    headers = {
        "Content-Disposition": disp,
        "Content-Length": str(len(decrypted_bytes)),
    }

    return Response(
        content=decrypted_bytes,
        media_type=item_content_type,
        headers=headers,
        background=background_tasks,
    )


@router.delete("/{item_id}")
def delete_file(item_id: str, request: Request):
    """
    Soft-delete file item: immediately revokes access and enqueues R2 deletion.
    """
    user = _require_user(request)
    with get_file_shelf_session() as session:
        repo = FileShelfRepository(session)
        deleted = repo.soft_delete_item(user.id, item_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Berkas tidak ditemukan.")

    return {"success": True, "message": "Berkas berhasil dihapus dari Rak Berkas."}


@router.get("/metrics")
def get_user_file_metrics(request: Request):
    """
    Returns user slot usage, rolling limits, and R2 storage health metrics.
    """
    user = _require_user(request)
    now = time.time()
    with get_file_shelf_session() as session:
        repo = FileShelfRepository(session)
        items = repo.list_user_items(user.id)
        slots_used = len(items)
        storage_used_bytes = sum(it.size_bytes for it in items)

        window_start = now - 3600.0
        upload_count = (
            session.execute(
                select(func.count(FileRateEvent.id)).where(
                    FileRateEvent.user_id == user.id,
                    FileRateEvent.event_type == "UPLOAD",
                    FileRateEvent.timestamp >= window_start,
                )
            ).scalar()
            or 0
        )

        download_count = (
            session.execute(
                select(func.count(FileRateEvent.id)).where(
                    FileRateEvent.user_id == user.id,
                    FileRateEvent.event_type == "DOWNLOAD",
                    FileRateEvent.timestamp >= window_start,
                )
            ).scalar()
            or 0
        )

        r2_status, _, _ = check_r2_storage_health(session)

    return {
        "success": True,
        "data": {
            "slots_used": slots_used,
            "slots_total": 5,
            "storage_used_bytes": storage_used_bytes,
            "max_storage_bytes": 125_000_000,
            "uploads_rolling_count": upload_count,
            "max_uploads_per_hour": 10,
            "downloads_rolling_count": download_count,
            "max_downloads_per_hour": 30,
            "r2_storage_status": r2_status,
            "retention_days": 30,
        },
    }
