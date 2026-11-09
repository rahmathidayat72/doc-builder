from __future__ import annotations

from typing import Any, Literal
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from app.services.media_downloader import (
    ActiveJobExistsError,
    InvalidMediaUrlError,
    JobNotFoundError,
    JobNotReadyError,
    QueueFullError,
    QuotaExceededError,
    RateLimitExceededError,
    SsrBlockedError,
    media_downloader,
)

router = APIRouter(prefix="/media-downloads", tags=["Media Downloader"])


class CreateMediaDownloadRequest(BaseModel):
    url: str = Field(..., description="URL publik dari YouTube, Instagram, atau TikTok")
    media_type: Literal["video", "image"] = Field(
        "video", description="Jenis media yang ingin diunduh ('video' atau 'image')"
    )
    rights_confirmed: bool = Field(
        ...,
        description="Pernyataan persetujuan bahwa konten milik sendiri, berlisensi, atau memiliki izin",
    )


def _get_client_ip(request: Request) -> str:
    """Mendapatkan alamat IP klien nyata dari header proxy loopback terpercaya."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded and client_ip in ("127.0.0.1", "::1", "localhost"):
        # Ambil IP pertama sebelum proxy lokal
        client_ip = forwarded.split(",")[0].strip()
    return client_ip


@router.post("")
async def create_media_download_job(
    req: CreateMediaDownloadRequest, request: Request
) -> JSONResponse:
    """Mendaftarkan proses unduhan media baru ke dalam antrean."""
    current_user = getattr(request.state, "current_user", None)
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Fitur pengunduh media membutuhkan akun terdaftar. Silakan masuk terlebih dahulu.",
        )

    client_ip = _get_client_ip(request)

    try:
        result = media_downloader.create_job(
            user_id=current_user.id,
            ip_address=client_ip,
            url=req.url,
            media_type=req.media_type,
            rights_confirmed=req.rights_confirmed,
        )
        return JSONResponse(status_code=202, content={"success": True, "data": result})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except InvalidMediaUrlError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except SsrBlockedError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except (QueueFullError, ActiveJobExistsError, RateLimitExceededError, QuotaExceededError) as exc:
        raise HTTPException(status_code=429, detail=str(exc))


@router.get("/{job_id}")
async def get_media_download_status(job_id: str, request: Request) -> JSONResponse:
    """Mendapatkan status, progres, dan tautan unduhan dari job media."""
    current_user = getattr(request.state, "current_user", None)
    if not current_user:
        raise HTTPException(status_code=401, detail="Sesi masuk tidak valid.")

    try:
        job_data = media_downloader.get_job(job_id=job_id, user_id=current_user.id)
        if job_data["status"] == "succeeded":
            job_data["download_url"] = f"/api/media-downloads/{job_id}/file"
        else:
            job_data["download_url"] = None

        return JSONResponse(status_code=200, content={"success": True, "data": job_data})
    except JobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{job_id}")
async def cancel_media_download_job(job_id: str, request: Request) -> JSONResponse:
    """Membatalkan job unduhan yang sedang berjalan atau mengantre."""
    current_user = getattr(request.state, "current_user", None)
    if not current_user:
        raise HTTPException(status_code=401, detail="Sesi masuk tidak valid.")

    try:
        cancelled = media_downloader.cancel_job(job_id=job_id, user_id=current_user.id)
        if cancelled:
            return JSONResponse(
                status_code=200, content={"success": True, "message": "Proses unduhan berhasil dibatalkan."}
            )
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Job tidak dapat dibatalkan karena sudah selesai atau gagal."},
        )
    except JobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


def _cleanup_delivered_file(file_path: Path) -> None:
    """Hapus file setelah berhasil disajikan kepada pengguna."""
    try:
        if file_path.is_file():
            file_path.unlink(missing_ok=True)
        # Hapus direktori pembungkus job jika kosong
        parent = file_path.parent
        if parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
    except OSError:
        pass


@router.get("/{job_id}/file")
async def download_media_file(
    job_id: str, request: Request, background_tasks: BackgroundTasks
) -> FileResponse:
    """Mengunduh berkas hasil media. Hanya dapat diunduh sekali (single-use delivery)."""
    current_user = getattr(request.state, "current_user", None)
    if not current_user:
        raise HTTPException(status_code=401, detail="Sesi masuk tidak valid.")

    try:
        file_path, filename = media_downloader.claim_file(job_id=job_id, user_id=current_user.id)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except JobNotReadyError as exc:
        raise HTTPException(status_code=410, detail=str(exc))

    background_tasks.add_task(_cleanup_delivered_file, file_path)

    media_type = "video/mp4" if filename.endswith(".mp4") else "image/jpeg"
    if filename.endswith(".png"):
        media_type = "image/png"
    elif filename.endswith(".webp"):
        media_type = "image/webp"

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=media_type,
        headers={
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
