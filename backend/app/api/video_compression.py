"""Router HTTP untuk fitur Compress Video asinkron (CR-021)."""

from __future__ import annotations

import base64
import json
import os
import shutil
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import Engine
from sqlalchemy.orm import Session
from starlette.requests import ClientDisconnect

from app.core import audit
from app.core.config import settings
from app.core.disk_guard import DiskSpaceExhaustedError, check_disk_guard
from app.core.rate_limiter import get_client_ip
from app.db.models import VideoCompressionJob
from app.db.postgres import get_db_session
from app.db.repositories.video_compression_repository import (
    ActiveJobExistsError,
    InvalidJobStateError,
    JobNotFoundError,
    QueueFullError,
    RateLimitExceededError,
    VideoCompressionRepository,
    WorkspaceFullError,
    get_workspace_usage_bytes,
    sanitize_video_filenames,
)

router = APIRouter(prefix="/video-compressions", tags=["Video Compression"])

_ENGINE_OVERRIDE: Engine | None = None
_MAX_METADATA_HEADER_LEN = 4096


def set_video_compression_engine_override(eng: Engine | None) -> None:
    """Mengatur engine database override untuk pengujian terisolasi."""
    global _ENGINE_OVERRIDE
    _ENGINE_OVERRIDE = eng


@contextmanager
def get_video_compression_session() -> Iterator[Session]:
    """Menyediakan sesi database transaksi untuk operasi video compression."""
    with get_db_session(engine_override=_ENGINE_OVERRIDE) as session:
        yield session


def _require_user(request: Request):
    user = getattr(request.state, "current_user", None)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Autentikasi diperlukan untuk menggunakan layanan Compress Video.",
        )
    if settings.IS_PRODUCTION and not getattr(user, "email_verified", False):
        raise HTTPException(
            status_code=403,
            detail="Alamat email belum diverifikasi. Harap verifikasi email Anda terlebih dahulu.",
        )
    return user


def _parse_video_metadata(request: Request) -> tuple[str, str, str, str]:
    raw_header = request.headers.get("X-Video-Metadata")
    if not raw_header:
        raise HTTPException(
            status_code=400,
            detail="Header metadata video (X-Video-Metadata) wajib disertakan.",
        )
    if len(raw_header) > _MAX_METADATA_HEADER_LEN:
        raise HTTPException(
            status_code=400,
            detail="Header X-Video-Metadata melebihi batas ukuran yang diizinkan.",
        )

    try:
        padding = "=" * ((4 - len(raw_header) % 4) % 4)
        decoded = base64.urlsafe_b64decode((raw_header + padding).encode("ascii"))
        meta_obj = json.loads(decoded.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Format header X-Video-Metadata base64url tidak valid.",
        ) from exc

    if not isinstance(meta_obj, dict):
        raise HTTPException(
            status_code=400,
            detail="Payload X-Video-Metadata harus berupa objek JSON.",
        )

    raw_job_type = meta_obj.get("job_type", "compress")
    job_type = "compress" if raw_job_type is None else str(raw_job_type).strip().lower()
    if job_type not in ("compress", "extract_audio"):
        raise HTTPException(
            status_code=400,
            detail="Tipe tugas tidak valid. Pilih compress atau extract_audio.",
        )

    raw_filename = str(meta_obj.get("filename", "")).strip()
    ext = Path(raw_filename).suffix.lower()
    if job_type == "extract_audio" and ext != ".mp4":
        raise HTTPException(
            status_code=422,
            detail="Hanya berkas berekstensi .mp4 yang didukung untuk ekstraksi audio MP3.",
        )

    try:
        clean_filename, default_output_filename = sanitize_video_filenames(raw_filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if job_type == "extract_audio":
        owner_confirmed = meta_obj.get("owner_confirmed")
        if owner_confirmed is not True:
            raise HTTPException(
                status_code=422,
                detail="Konfirmasi kepemilikan atau hak penggunaan audio wajib dicentang.",
            )
        output_filename = f"{Path(clean_filename).stem}_audio.mp3"
    else:
        output_filename = default_output_filename

    raw_preset = meta_obj.get("preset")
    if job_type == "extract_audio":
        preset = "192k" if raw_preset is None else str(raw_preset).strip().lower()
        if preset not in ("128k", "192k", "320k"):
            raise HTTPException(
                status_code=400,
                detail="Preset audio tidak valid. Pilih 128k, 192k, atau 320k.",
            )
    else:
        preset = "balanced" if raw_preset is None else str(raw_preset).strip().lower()
        if preset not in ("light", "balanced", "maximum"):
            raise HTTPException(
                status_code=400,
                detail="Preset kompresi tidak valid. Pilih light, balanced, atau maximum.",
            )

    return clean_filename, output_filename, preset, job_type


def _parse_content_length(request: Request) -> int | None:
    raw_len = request.headers.get("content-length")
    if raw_len is None:
        return None
    try:
        parsed = int(raw_len)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Header Content-Length tidak valid.") from exc
    if parsed < 0:
        raise HTTPException(status_code=400, detail="Header Content-Length tidak valid.")
    return parsed


def _write_all(fd: int, data: bytes) -> None:
    view = memoryview(data)
    written = 0
    while written < len(view):
        written += os.write(fd, view[written:])


def _ensure_dir_secure(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        os.chmod(path, 0o700)
    except OSError:
        pass


def _cleanup_job_dir(job_dir: Path) -> None:
    shutil.rmtree(job_dir, ignore_errors=True)


def _cleanup_job_workspace(
    job_id: str,
    input_path: str | None = None,
    output_path: str | None = None,
) -> None:
    ws_dir = settings.VIDEO_COMPRESSION_WORKSPACE_DIR
    candidates: list[Path] = [ws_dir / job_id]
    for raw_path in (input_path, output_path):
        if raw_path:
            parent = Path(raw_path).parent
            if parent.name == job_id and parent not in candidates:
                candidates.append(parent)
    for target in candidates:
        if target.name == job_id and target.exists():
            _cleanup_job_dir(target)


def _safe_discard_uploading_job(job_id: str) -> None:
    try:
        with get_video_compression_session() as session:
            VideoCompressionRepository(session).discard_uploading_job(job_id)
    except Exception:
        pass


def _safe_clear_claimed_paths(job_id: str) -> None:
    try:
        with get_video_compression_session() as session:
            VideoCompressionRepository(session).clear_claimed_job_paths(job_id)
    except Exception:
        pass


def _safe_mark_job_expired(job_id: str) -> None:
    try:
        with get_video_compression_session() as session:
            VideoCompressionRepository(session).mark_job_expired(job_id)
    except Exception:
        pass


def serialize_video_job(job: VideoCompressionJob) -> dict[str, object]:
    """Serialisasi job kompresi video tanpa membocorkan path internal maupun IP."""
    return {
        "id": job.id,
        "job_type": getattr(job, "job_type", "compress"),
        "status": job.status,
        "preset": job.preset,
        "original_filename": job.original_filename,
        "output_filename": job.output_filename,
        "progress_percent": job.progress_percent,
        "input_size_bytes": job.input_size_bytes,
        "output_size_bytes": job.output_size_bytes,
        "input_duration_sec": job.input_duration_sec,
        "input_width": job.input_width,
        "input_height": job.input_height,
        "output_width": job.output_width,
        "output_height": job.output_height,
        "error_code": job.error_code,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "expires_at": job.expires_at,
        "download_url": (
            f"/api/video-compressions/{job.id}/download" if job.status == "succeeded" else None
        ),
    }


@router.post("")
async def create_video_compression_job(request: Request) -> JSONResponse:
    """Menerima upload video streaming ke workspace terisolasi dan mendaftarkan antrean."""
    user = _require_user(request)
    client_ip = get_client_ip(request)

    raw_ct = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if raw_ct and raw_ct != "application/octet-stream":
        raise HTTPException(
            status_code=415,
            detail="Tipe konten harus application/octet-stream untuk unggahan video streaming.",
        )

    clean_filename, output_filename, preset, job_type = _parse_video_metadata(request)
    declared_length = _parse_content_length(request)

    max_file_bytes = settings.VIDEO_COMPRESSION_MAX_FILE_BYTES
    max_workspace_bytes = settings.VIDEO_COMPRESSION_WORKSPACE_MAX_BYTES
    if declared_length == 0:
        raise HTTPException(status_code=400, detail="Berkas video kosong tidak dapat diunggah.")
    if declared_length is not None and declared_length > max_file_bytes:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Ukuran berkas ({declared_length} byte) melebihi batas maksimal "
                f"250 MB ({max_file_bytes} byte)."
            ),
        )

    workspace_dir = settings.VIDEO_COMPRESSION_WORKSPACE_DIR
    _ensure_dir_secure(workspace_dir)

    try:
        check_disk_guard(workspace_dir)
    except DiskSpaceExhaustedError:
        audit.audit_logger.record(
            "video_compression.upload",
            "rejected",
            status=507,
            user_id=user.id,
            reason="disk_guard",
        )
        raise

    # 1. Reservasi atomik slot `uploading` di PostgreSQL sebelum menyentuh disk
    with get_video_compression_session() as session:
        repo = VideoCompressionRepository(session)
        try:
            job = repo.reserve_upload_job(
                user_id=user.id,
                ip_address=client_ip,
                original_filename=clean_filename,
                output_filename=output_filename,
                preset=preset,
                job_type=job_type,
                workspace_dir=workspace_dir,
                max_workspace_bytes=max_workspace_bytes,
                content_length=declared_length,
            )
            job_id = job.id
        except ActiveJobExistsError as exc:
            audit.audit_logger.record(
                "video_compression.upload",
                "rejected",
                status=409,
                user_id=user.id,
                reason="active_job_exists",
            )
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except RateLimitExceededError as exc:
            audit.audit_logger.record(
                "video_compression.upload",
                "rejected",
                status=429,
                user_id=user.id,
                reason="rate_limit",
            )
            raise HTTPException(
                status_code=429,
                detail=str(exc),
                headers={"Retry-After": str(exc.retry_after)},
            ) from exc
        except QueueFullError as exc:
            audit.audit_logger.record(
                "video_compression.upload",
                "rejected",
                status=503,
                user_id=user.id,
                reason="queue_full",
            )
            raise HTTPException(
                status_code=503,
                detail=str(exc),
                headers={"Retry-After": str(exc.retry_after)},
            ) from exc
        except WorkspaceFullError as exc:
            audit.audit_logger.record(
                "video_compression.upload",
                "rejected",
                status=507,
                user_id=user.id,
                reason="workspace_full",
            )
            raise HTTPException(status_code=507, detail=str(exc)) from exc

    # 2. Stream byte request per chunk langsung ke disk (`0700`/`0600`) tanpa `request.body()`
    job_dir = workspace_dir / job_id
    input_file = job_dir / "input.bin"
    base_workspace_bytes = get_workspace_usage_bytes(workspace_dir)
    total_bytes = 0
    fd: int | None = None

    try:
        _ensure_dir_secure(job_dir)
        fd = os.open(input_file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        try:
            os.fchmod(fd, 0o600)
        except (AttributeError, OSError):
            pass

        async for chunk in request.stream():
            if not chunk:
                continue
            chunk_len = len(chunk)
            if total_bytes + chunk_len > max_file_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"Ukuran unggahan melebihi batas maksimal "
                        f"250 MB ({max_file_bytes} byte)."
                    ),
                )
            if base_workspace_bytes + total_bytes + chunk_len > max_workspace_bytes:
                raise HTTPException(
                    status_code=507,
                    detail="Ruang penyimpanan sementara pemrosesan video penuh.",
                )
            _write_all(fd, chunk)
            total_bytes += chunk_len

        os.close(fd)
        fd = None

        if total_bytes == 0:
            raise HTTPException(status_code=400, detail="Berkas video kosong tidak dapat diunggah.")

        if get_workspace_usage_bytes(workspace_dir) > max_workspace_bytes:
            raise HTTPException(
                status_code=507,
                detail="Ruang penyimpanan sementara pemrosesan video penuh.",
            )
    except HTTPException as exc:
        if fd is not None:
            os.close(fd)
        _cleanup_job_dir(job_dir)
        _safe_discard_uploading_job(job_id)
        audit.audit_logger.record(
            "video_compression.upload",
            "rejected",
            status=exc.status_code,
            job_id=job_id,
            user_id=user.id,
            reason="stream_limit_or_empty",
        )
        raise
    except ClientDisconnect as exc:
        if fd is not None:
            os.close(fd)
        _cleanup_job_dir(job_dir)
        _safe_discard_uploading_job(job_id)
        audit.audit_logger.record(
            "video_compression.upload",
            "aborted",
            status=499,
            job_id=job_id,
            user_id=user.id,
            reason="client_disconnect",
        )
        raise HTTPException(
            status_code=400, detail="Koneksi terputus sebelum unggahan video selesai."
        ) from exc
    except Exception as exc:
        if fd is not None:
            os.close(fd)
        _cleanup_job_dir(job_dir)
        _safe_discard_uploading_job(job_id)
        audit.audit_logger.record(
            "video_compression.upload",
            "error",
            status=500,
            job_id=job_id,
            user_id=user.id,
            error_type=type(exc).__name__,
        )
        raise HTTPException(
            status_code=500,
            detail="Gagal menyimpan unggahan video sementara.",
        ) from exc

    # 3. Transisi atomik `uploading -> queued`
    try:
        with get_video_compression_session() as session:
            repo = VideoCompressionRepository(session)
            queued_job = repo.finalize_upload_queued(job_id, total_bytes)
            job_payload = serialize_video_job(queued_job)
    except Exception as exc:
        _cleanup_job_dir(job_dir)
        _safe_discard_uploading_job(job_id)
        raise HTTPException(
            status_code=500,
            detail="Gagal mendaftarkan tugas kompresi video ke antrean.",
        ) from exc

    audit.audit_logger.record(
        "video_compression.upload",
        "queued",
        job_id=job_id,
        user_id=user.id,
        preset=preset,
        job_type=job_type,
        input_size_bytes=total_bytes,
    )
    return JSONResponse(status_code=202, content={"success": True, "data": job_payload})


@router.get("/{job_id}")
def get_video_compression_job(job_id: str, request: Request) -> JSONResponse:
    """Mengambil status dan progres tugas kompresi video milik pengguna."""
    user = _require_user(request)
    with get_video_compression_session() as session:
        job = VideoCompressionRepository(session).get_job_for_user(job_id, user.id)
        if job is None:
            raise HTTPException(status_code=404, detail="Tugas kompresi video tidak ditemukan.")
        payload = serialize_video_job(job)

    return JSONResponse(status_code=200, content={"success": True, "data": payload})


@router.get("/{job_id}/download")
def download_video_compression_job(job_id: str, request: Request) -> StreamingResponse:
    """Mengunduh berkas hasil kompresi sekali pakai (`succeeded -> claimed`)."""
    user = _require_user(request)
    state_exc: InvalidJobStateError | None = None
    output_path_str: str | None = None
    download_name = "video_compressed.mp4"
    input_size_bytes = 0
    output_size_bytes: int | None = None
    job_type = "compress"

    with get_video_compression_session() as session:
        repo = VideoCompressionRepository(session)
        try:
            claimed_job = repo.claim_succeeded_job_for_download(job_id, user.id)
            output_path_str = claimed_job.output_path
            job_type = getattr(claimed_job, "job_type", "compress")
            out_fn = claimed_job.output_filename or ""
            is_audio = job_type == "extract_audio" or out_fn.endswith(".mp3")
            default_download_name = "audio.mp3" if is_audio else "video_compressed.mp4"
            download_name = claimed_job.output_filename or default_download_name
            input_size_bytes = int(claimed_job.input_size_bytes)
            output_size_bytes = claimed_job.output_size_bytes
        except JobNotFoundError as exc:
            audit.audit_logger.record(
                "video_compression.download",
                "rejected",
                status=404,
                job_id=job_id,
                user_id=user.id,
                reason="not_found",
            )
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except InvalidJobStateError as exc:
            state_exc = exc

    if state_exc is not None:
        if state_exc.reason == "expired":
            _cleanup_job_workspace(job_id)
            _safe_mark_job_expired(job_id)
        audit.audit_logger.record(
            "video_compression.download",
            "rejected",
            status=state_exc.status_code,
            job_id=job_id,
            user_id=user.id,
            reason=state_exc.reason,
        )
        raise HTTPException(status_code=state_exc.status_code, detail=str(state_exc)) from state_exc

    file_handle = None
    file_size = 0
    if output_path_str:
        candidate = Path(output_path_str)
        try:
            if candidate.is_file() and not candidate.is_symlink():
                file_handle = candidate.open("rb")
                file_size = os.fstat(file_handle.fileno()).st_size
        except OSError:
            if file_handle is not None:
                file_handle.close()
                file_handle = None

    if file_handle is None:
        _cleanup_job_workspace(job_id, None, output_path_str)
        _safe_clear_claimed_paths(job_id)
        audit.audit_logger.record(
            "video_compression.download",
            "rejected",
            status=410,
            job_id=job_id,
            user_id=user.id,
            reason="file_missing",
        )
        raise HTTPException(
            status_code=410,
            detail="Berkas hasil kompresi tidak lagi tersedia atau sudah kedaluwarsa.",
        )

    audit.audit_logger.record(
        "video_compression.download",
        "claimed",
        job_id=job_id,
        user_id=user.id,
        input_size_bytes=input_size_bytes,
        output_size_bytes=output_size_bytes or file_size,
    )

    chunk_size = settings.VIDEO_COMPRESSION_CHUNK_SIZE

    def _iter_and_cleanup() -> Iterator[bytes]:
        try:
            while True:
                chunk = file_handle.read(chunk_size)
                if not chunk:
                    break
                yield chunk
        finally:
            file_handle.close()
            _cleanup_job_workspace(job_id, None, output_path_str)
            _safe_clear_claimed_paths(job_id)

    fallback_ascii = "audio.mp3" if is_audio else "video_compressed.mp4"
    ascii_name = download_name.encode("ascii", "ignore").decode("ascii") or fallback_ascii
    quoted_name = quote(download_name)
    disp = f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quoted_name}'
    headers = {
        "Content-Disposition": disp,
        "Content-Length": str(file_size),
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "X-Job-ID": job_id,
        "X-Original-Size": str(input_size_bytes),
        "X-Output-Size": str(output_size_bytes or file_size),
    }
    media_type = "audio/mpeg" if is_audio else "video/mp4"
    try:
        return StreamingResponse(
            _iter_and_cleanup(),
            media_type=media_type,
            headers=headers,
        )
    except Exception:
        file_handle.close()
        _cleanup_job_workspace(job_id, None, output_path_str)
        _safe_clear_claimed_paths(job_id)
        raise


@router.delete("/{job_id}")
def cancel_video_compression_job(job_id: str, request: Request) -> JSONResponse:
    """Membatalkan tugas kompresi video aktif milik pengguna."""
    user = _require_user(request)
    with get_video_compression_session() as session:
        repo = VideoCompressionRepository(session)
        try:
            job, prev_status, in_path, out_path = repo.cancel_job_for_user(job_id, user.id)
            payload = serialize_video_job(job)
        except JobNotFoundError as exc:
            audit.audit_logger.record(
                "video_compression.cancel",
                "rejected",
                status=404,
                job_id=job_id,
                user_id=user.id,
                reason="not_found",
            )
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except InvalidJobStateError as exc:
            audit.audit_logger.record(
                "video_compression.cancel",
                "rejected",
                status=exc.status_code,
                job_id=job_id,
                user_id=user.id,
                reason=exc.reason,
            )
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    _cleanup_job_workspace(job_id, in_path, out_path)
    audit.audit_logger.record(
        "video_compression.cancel",
        "cancelled",
        job_id=job_id,
        user_id=user.id,
        previous_status=prev_status,
    )
    return JSONResponse(status_code=200, content={"success": True, "data": payload})
