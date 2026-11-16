"""Repository PostgreSQL/SQLAlchemy untuk antrean dan klaim Compress Video (CR-021)."""

from __future__ import annotations

import os
import re
import time
import uuid
from pathlib import Path

from sqlalchemy import delete, func, or_, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import VideoCompressionJob

ACTIVE_STATUSES: tuple[str, ...] = ("uploading", "queued", "scanning", "probing", "encoding")
RUNNING_STATUSES: tuple[str, ...] = ("scanning", "probing", "encoding")
TERMINAL_STATUSES: tuple[str, ...] = ("succeeded", "claimed", "failed", "cancelled", "expired")
VALID_PRESETS: tuple[str, ...] = ("light", "balanced", "maximum")
VALID_MP3_PRESETS: tuple[str, ...] = ("128k", "192k", "320k")
VALID_TRANSCRIPTION_PRESETS: tuple[str, ...] = ("auto", "id", "en")
VALID_JOB_TYPES: tuple[str, ...] = ("compress", "extract_audio", "transcribe")
ALLOWED_VIDEO_EXTENSIONS: frozenset[str] = frozenset({".mp4", ".mov", ".webm"})
VIDEO_QUEUE_ADVISORY_LOCK_KEY = 599941628391042


class VideoCompressionRepoError(Exception):
    """Base error operasi repository kompresi video."""


class ActiveJobExistsError(VideoCompressionRepoError):
    """Pengguna sudah memiliki tugas kompresi video aktif."""


class RateLimitExceededError(VideoCompressionRepoError):
    """Batas jumlah tugas per jam (akun atau IP) tercapai."""

    def __init__(self, message: str, retry_after: int = 3600) -> None:
        super().__init__(message)
        self.retry_after = max(1, int(retry_after))


class QueueFullError(VideoCompressionRepoError):
    """Kapasitas antrean global kompresi video penuh."""

    def __init__(self, message: str, retry_after: int = 30) -> None:
        super().__init__(message)
        self.retry_after = max(1, int(retry_after))


class WorkspaceFullError(VideoCompressionRepoError):
    """Kapasitas total workspace video mencapai atau melebihi batas global."""


class JobNotFoundError(VideoCompressionRepoError):
    """Tugas kompresi tidak ditemukan atau bukan milik pengguna."""


class InvalidJobStateError(VideoCompressionRepoError):
    """Status tugas tidak mengizinkan transisi yang diminta."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 409,
        reason: str = "invalid_state",
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.reason = reason


def get_workspace_usage_bytes(workspace_dir: Path) -> int:
    """Menghitung total ukuran byte berkas aktual di dalam workspace video."""
    if not workspace_dir.exists():
        return 0
    total = 0
    for root, _, files in os.walk(workspace_dir):
        for fname in files:
            fpath = os.path.join(root, fname)
            try:
                total += os.path.getsize(fpath)
            except OSError:
                continue
    return total


def sanitize_video_filenames(raw_filename: str) -> tuple[str, str]:
    """Memvalidasi nama berkas video dan membentuk nama output `<nama>_compressed.mp4`."""
    base = raw_filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].replace("\x00", "")
    clean = re.sub(r"[\r\n\t]", "", base).strip()
    if not clean or len(clean) > 255 or clean in (".", ".."):
        raise ValueError("Nama berkas dalam metadata tidak valid (maksimal 255 karakter).")

    ext = Path(clean).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError("Format berkas tidak didukung. Gunakan berkas MP4, MOV, atau WebM.")

    stem = clean[: -len(ext)]
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "_", stem).strip("_-") or "video"
    suffix = "_compressed.mp4"
    max_stem_len = 255 - len(suffix)
    return clean, f"{safe_stem[:max_stem_len]}{suffix}"


class VideoCompressionRepository:
    """Repository atomik lintas-worker untuk antrean & klaim Compress Video."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def _is_postgresql(self) -> bool:
        bind = self.session.get_bind()
        return bind is not None and bind.dialect.name == "postgresql"

    def _acquire_queue_lock(self) -> None:
        """Mengunci antrean secara transaksional di PostgreSQL lintas 2 worker Uvicorn + daemon."""
        if self._is_postgresql():
            self.session.execute(
                text("SELECT pg_advisory_xact_lock(:lock_key)"),
                {"lock_key": VIDEO_QUEUE_ADVISORY_LOCK_KEY},
            )

    def reserve_upload_job(
        self,
        *,
        user_id: str,
        ip_address: str,
        original_filename: str,
        output_filename: str,
        preset: str = "balanced",
        job_type: str = "compress",
        workspace_dir: Path | None = None,
        max_workspace_bytes: int | None = None,
        hourly_limit: int | None = None,
        global_running_limit: int | None = None,
        queue_capacity: int | None = None,
        content_length: int | None = None,
        now: float | None = None,
    ) -> VideoCompressionJob:
        """Mereservasi satu slot tugas `uploading` secara atomik dengan seluruh guard kuota."""
        if job_type not in VALID_JOB_TYPES:
            raise ValueError(
                f"Tipe tugas '{job_type}' tidak valid. "
                "Pilih compress, extract_audio, atau transcribe."
            )
        if job_type == "compress" and preset not in VALID_PRESETS:
            raise ValueError("Preset kompresi tidak valid. Pilih light, balanced, atau maximum.")
        if job_type == "extract_audio" and preset not in VALID_MP3_PRESETS:
            raise ValueError("Preset audio tidak valid. Pilih 128k, 192k, atau 320k.")
        if job_type == "transcribe" and preset not in VALID_TRANSCRIPTION_PRESETS:
            raise ValueError("Preset transkripsi tidak valid. Pilih auto, id, atau en.")

        ts = time.time() if now is None else now
        ws_dir = workspace_dir or settings.VIDEO_COMPRESSION_WORKSPACE_DIR
        ws_cap = (
            settings.VIDEO_COMPRESSION_WORKSPACE_MAX_BYTES
            if max_workspace_bytes is None
            else max_workspace_bytes
        )
        limit_per_hour = (
            settings.VIDEO_COMPRESSION_HOURLY_JOB_LIMIT
            if hourly_limit is None
            else hourly_limit
        )
        run_limit = (
            settings.VIDEO_COMPRESSION_GLOBAL_RUNNING_LIMIT
            if global_running_limit is None
            else global_running_limit
        )
        wait_limit = (
            settings.VIDEO_COMPRESSION_QUEUE_CAPACITY
            if queue_capacity is None
            else queue_capacity
        )

        self._acquire_queue_lock()

        # 1. Maksimal 1 job aktif per akun
        active_user_job = self.session.execute(
            select(VideoCompressionJob.id)
            .where(
                VideoCompressionJob.user_id == user_id,
                VideoCompressionJob.status.in_(ACTIVE_STATUSES),
            )
            .limit(1)
        ).scalar_one_or_none()
        if active_user_job is not None:
            raise ActiveJobExistsError(
                "Anda masih memiliki tugas kompresi video yang sedang diproses. "
                "Tunggu hingga selesai atau batalkan terlebih dahulu."
            )

        # 2. Rate limit rolling 60 menit per akun
        window_start = ts - 3600.0
        user_recent_times = list(
            self.session.execute(
                select(VideoCompressionJob.created_at)
                .where(
                    VideoCompressionJob.user_id == user_id,
                    VideoCompressionJob.created_at >= window_start,
                )
                .order_by(VideoCompressionJob.created_at.asc())
            ).scalars()
        )
        if len(user_recent_times) >= limit_per_hour:
            retry_after = max(1, int((user_recent_times[0] + 3600.0) - ts) + 1)
            raise RateLimitExceededError(
                f"Batas kompresi per akun tercapai ({limit_per_hour} tugas per jam). "
                "Silakan coba lagi nanti.",
                retry_after=retry_after,
            )

        # 3. Rate limit rolling 60 menit per IP
        ip_recent_times = list(
            self.session.execute(
                select(VideoCompressionJob.created_at)
                .where(
                    VideoCompressionJob.ip_address == ip_address,
                    VideoCompressionJob.created_at >= window_start,
                )
                .order_by(VideoCompressionJob.created_at.asc())
            ).scalars()
        )
        if len(ip_recent_times) >= limit_per_hour:
            retry_after = max(1, int((ip_recent_times[0] + 3600.0) - ts) + 1)
            raise RateLimitExceededError(
                f"Batas kompresi dari jaringan ini tercapai ({limit_per_hour} tugas per jam). "
                "Silakan coba lagi nanti.",
                retry_after=retry_after,
            )

        # 4. Antrean global maksimal 1 running + 2 waiting (= 3 aktif)
        global_active_count = (
            self.session.execute(
                select(func.count(VideoCompressionJob.id)).where(
                    VideoCompressionJob.status.in_(ACTIVE_STATUSES)
                )
            ).scalar()
            or 0
        )
        if global_active_count >= (run_limit + wait_limit):
            raise QueueFullError(
                "Antrean kompresi video server sedang penuh. "
                "Silakan coba kembali dalam beberapa saat.",
                retry_after=30,
            )

        # 5. Batas global workspace video 1.25 GiB
        used_bytes = get_workspace_usage_bytes(ws_dir)
        if used_bytes >= ws_cap or (
            content_length is not None and used_bytes + content_length > ws_cap
        ):
            raise WorkspaceFullError(
                "Ruang penyimpanan sementara pemrosesan video penuh. "
                "Silakan coba kembali setelah tugas lain selesai."
            )

        job_id = str(uuid.uuid4())
        input_path = str(ws_dir / job_id / "input.bin")
        job = VideoCompressionJob(
            id=job_id,
            user_id=user_id,
            ip_address=ip_address,
            original_filename=original_filename,
            output_filename=output_filename,
            job_type=job_type,
            preset=preset,
            status="uploading",
            running_lock=None,
            progress_percent=0.0,
            input_path=input_path,
            input_size_bytes=0,
            created_at=ts,
            updated_at=ts,
        )
        self.session.add(job)
        try:
            self.session.flush()
        except IntegrityError as exc:
            raise ActiveJobExistsError(
                "Anda masih memiliki tugas kompresi video yang sedang diproses."
            ) from exc
        return job

    def finalize_upload_queued(
        self, job_id: str, input_size_bytes: int, now: float | None = None
    ) -> VideoCompressionJob:
        """Memindahkan tugas `uploading` -> `queued` setelah stream selesai ditulis ke disk."""
        if input_size_bytes <= 0:
            raise InvalidJobStateError("Ukuran berkas unggahan harus lebih dari 0 byte.")
        job = self.session.get(VideoCompressionJob, job_id)
        if job is None:
            raise JobNotFoundError("Tugas kompresi video tidak ditemukan.")
        if job.status != "uploading":
            raise InvalidJobStateError(
                f"Tugas tidak berada pada status uploading (saat ini: {job.status})."
            )

        ts = time.time() if now is None else now
        job.status = "queued"
        job.running_lock = None
        job.input_size_bytes = input_size_bytes
        job.progress_percent = 0.0
        job.updated_at = ts
        self.session.flush()
        return job

    def discard_uploading_job(self, job_id: str) -> None:
        """Menghapus baris `uploading` saat stream gagal atau ditolak sebelum antre."""
        self.session.execute(
            delete(VideoCompressionJob).where(
                VideoCompressionJob.id == job_id,
                VideoCompressionJob.status == "uploading",
            )
        )
        self.session.flush()

    def claim_next_queued_job(self, now: float | None = None) -> VideoCompressionJob | None:
        """Mengambil 1 tugas `queued` tertua secara atomik (`FOR UPDATE SKIP LOCKED`)."""
        self._acquire_queue_lock()

        running_exists = self.session.execute(
            select(VideoCompressionJob.id)
            .where(VideoCompressionJob.running_lock.is_not(None))
            .limit(1)
        ).scalar_one_or_none()
        if running_exists is not None:
            return None

        stmt = (
            select(VideoCompressionJob)
            .where(VideoCompressionJob.status == "queued")
            .order_by(VideoCompressionJob.created_at.asc())
            .limit(1)
        )
        if self._is_postgresql():
            stmt = stmt.with_for_update(skip_locked=True)

        job = self.session.execute(stmt).scalar_one_or_none()
        if job is None:
            return None

        ts = time.time() if now is None else now
        job.status = "scanning"
        job.running_lock = 1
        job.started_at = ts
        job.updated_at = ts
        job.progress_percent = 5.0
        try:
            self.session.flush()
        except IntegrityError:
            self.session.rollback()
            return None
        return job

    def get_job_for_user(self, job_id: str, user_id: str) -> VideoCompressionJob | None:
        """Mengambil tugas milik `user_id` tertentu (anti-BOLA)."""
        return self.session.execute(
            select(VideoCompressionJob).where(
                VideoCompressionJob.id == job_id,
                VideoCompressionJob.user_id == user_id,
            )
        ).scalar_one_or_none()

    def claim_succeeded_job_for_download(
        self, job_id: str, user_id: str, now: float | None = None
    ) -> VideoCompressionJob:
        """Transisi atomik single-use `succeeded -> claimed` untuk mencegah double download."""
        ts = time.time() if now is None else now
        result = self.session.execute(
            update(VideoCompressionJob)
            .where(
                VideoCompressionJob.id == job_id,
                VideoCompressionJob.user_id == user_id,
                VideoCompressionJob.status == "succeeded",
                or_(
                    VideoCompressionJob.expires_at.is_(None),
                    VideoCompressionJob.expires_at > ts,
                ),
            )
            .values(
                status="claimed",
                claimed_at=ts,
                updated_at=ts,
            )
        )
        if result.rowcount == 1:
            self.session.expire_all()
            claimed_job = self.get_job_for_user(job_id, user_id)
            if claimed_job is None:
                raise JobNotFoundError("Tugas kompresi video tidak ditemukan.")
            return claimed_job

        existing = self.get_job_for_user(job_id, user_id)
        if existing is None:
            raise JobNotFoundError("Tugas kompresi video tidak ditemukan.")
        if existing.status == "claimed":
            raise InvalidJobStateError(
                "Berkas hasil kompresi sudah pernah diunduh.",
                status_code=409,
                reason="already_claimed",
            )
        if existing.status == "expired" or (
            existing.expires_at is not None and existing.expires_at <= ts
        ):
            raise InvalidJobStateError(
                "Berkas hasil kompresi sudah kedaluwarsa.",
                status_code=410,
                reason="expired",
            )
        raise InvalidJobStateError(
            "Berkas hasil kompresi belum siap untuk diunduh.",
            status_code=409,
            reason="not_ready",
        )

    def mark_job_expired(self, job_id: str, now: float | None = None) -> None:
        """Menandai job `succeeded` yang melewati TTL menjadi `expired`."""
        ts = time.time() if now is None else now
        self.session.execute(
            update(VideoCompressionJob)
            .where(
                VideoCompressionJob.id == job_id,
                VideoCompressionJob.status == "succeeded",
                VideoCompressionJob.expires_at.is_not(None),
                VideoCompressionJob.expires_at <= ts,
            )
            .values(
                status="expired",
                running_lock=None,
                output_path=None,
                updated_at=ts,
            )
        )
        self.session.flush()

    def clear_claimed_job_paths(self, job_id: str, now: float | None = None) -> None:
        """Mengosongkan path workspace di DB setelah unduhan streaming selesai ditutup."""
        ts = time.time() if now is None else now
        self.session.execute(
            update(VideoCompressionJob)
            .where(
                VideoCompressionJob.id == job_id,
                VideoCompressionJob.status == "claimed",
            )
            .values(input_path=None, output_path=None, updated_at=ts)
        )
        self.session.flush()

    def cancel_job_for_user(
        self, job_id: str, user_id: str, now: float | None = None
    ) -> tuple[VideoCompressionJob, str, str | None, str | None]:
        """Membatalkan tugas aktif milik `user_id` tanpa menghapus histori rate limit."""
        self._acquire_queue_lock()
        job = self.get_job_for_user(job_id, user_id)
        if job is None:
            raise JobNotFoundError("Tugas kompresi video tidak ditemukan.")
        if job.status not in ACTIVE_STATUSES:
            raise InvalidJobStateError(
                "Tugas kompresi sudah selesai atau dibatalkan sehingga tidak dapat dibatalkan.",
                status_code=409,
                reason="not_cancellable",
            )

        ts = time.time() if now is None else now
        prev_status = job.status
        in_path = job.input_path
        out_path = job.output_path
        job.status = "cancelled"
        job.running_lock = None
        job.input_path = None
        job.output_path = None
        job.completed_at = ts
        job.updated_at = ts
        self.session.flush()
        return job, prev_status, in_path, out_path
