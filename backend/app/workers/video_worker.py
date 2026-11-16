"""Daemon worker systemd asinkron untuk Compress Video (CR-021 / VC-02).

Menjalankan:
- Recovery job `scanning`/`probing`/`encoding` yang terhenti pasca-restart worker
- Pemrosesan sekuensial antrean `queued`: ClamAV streaming -> ffprobe -> ffmpeg sandbox
- Heartbeat non-PII ke tabel `runtime_state` (`video_worker_heartbeat`)
- Sweeper TTL 15 menit, pembersihan berkas `claimed` > 60s, direktori yatim, & retensi 24 jam
"""

from __future__ import annotations

import logging
import shutil
import signal
import time
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, delete, select

from app.core.audit import audit_logger
from app.core.config import settings
from app.db.models import RuntimeState, VideoCompressionJob
from app.db.postgres import get_db_session
from app.db.repositories.video_compression_repository import (
    RUNNING_STATUSES,
    VideoCompressionRepository,
)
from app.services.transcription_service import process_transcription_job
from app.services.video_compressor import (
    VideoCompressionCancelledError,
    VideoCompressionError,
    compress_video_file,
    detect_ffmpeg_binaries,
    extract_audio_file,
    probe_audio_extraction,
    probe_video,
    scan_video_file,
)

logger = logging.getLogger("satukit.video_worker")

HEARTBEAT_STATE_KEY = "video_worker_heartbeat"
CLAIMED_CLEANUP_GRACE_SECONDS = 60.0
ORPHAN_DIR_GRACE_SECONDS = 60.0
STALE_UPLOADING_TIMEOUT_SECONDS = 3600.0
CLEANUP_ON_SWEEP_STATUSES: tuple[str, ...] = ("failed", "cancelled", "expired")
PURGE_TERMINAL_STATUSES: tuple[str, ...] = ("claimed", "failed", "cancelled", "expired")


def _resolve_workspace_dir(workspace_dir: Path | None) -> Path:
    return workspace_dir if workspace_dir is not None else settings.VIDEO_COMPRESSION_WORKSPACE_DIR


def _resolve_job_dir(
    job_id: str,
    input_path: str | None = None,
    output_path: str | None = None,
    workspace_dir: Path | None = None,
) -> Path:
    ws_dir = _resolve_workspace_dir(workspace_dir)
    for raw_path in (input_path, output_path):
        if raw_path:
            candidate = Path(raw_path).parent
            if candidate.name == job_id:
                return candidate
    return ws_dir / job_id


def _cleanup_job_workspace(
    job_id: str,
    input_path: str | None = None,
    output_path: str | None = None,
    workspace_dir: Path | None = None,
) -> None:
    ws_dir = _resolve_workspace_dir(workspace_dir)
    candidates = [ws_dir / job_id]
    resolved = _resolve_job_dir(job_id, input_path, output_path, ws_dir)
    if resolved not in candidates:
        candidates.append(resolved)

    for target in candidates:
        if target.name != job_id:
            continue
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)


def write_worker_heartbeat(
    engine_override: Engine | None = None,
    *,
    status: str = "idle",
    active_job_id: str | None = None,
    now: float | None = None,
) -> dict[str, Any]:
    """Menyimpan status heartbeat worker tanpa path filesystem atau PII ke `runtime_state`."""
    ts = time.time() if now is None else now
    ffmpeg_bin, ffprobe_bin = detect_ffmpeg_binaries()
    payload: dict[str, Any] = {
        "status": status,
        "last_heartbeat_at": ts,
        "ffmpeg_available": ffmpeg_bin is not None,
        "ffprobe_available": ffprobe_bin is not None,
        "has_active_job": active_job_id is not None,
    }

    with get_db_session(engine_override=engine_override) as session:
        state = session.get(RuntimeState, HEARTBEAT_STATE_KEY)
        if state is None:
            session.add(RuntimeState(key=HEARTBEAT_STATE_KEY, value=payload, updated_at=ts))
        else:
            state.value = payload
            state.updated_at = ts
        session.flush()
    return payload


def recover_stale_running_jobs(
    engine_override: Engine | None = None,
    workspace_dir: Path | None = None,
    now: float | None = None,
) -> int:
    """Memulihkan job yang tertinggal di status `scanning`/`probing`/`encoding` saat boot."""
    ts = time.time() if now is None else now
    recovered: list[tuple[str, str, str | None, str | None]] = []

    with get_db_session(engine_override=engine_override) as session:
        rows = list(
            session.execute(
                select(VideoCompressionJob).where(
                    VideoCompressionJob.status.in_(RUNNING_STATUSES)
                )
            )
            .scalars()
            .all()
        )
        for job in rows:
            prev_status = job.status
            recovered.append((job.id, prev_status, job.input_path, job.output_path))
            job.status = "failed"
            job.running_lock = None
            job.error_code = "WORKER_INTERRUPTED"
            job.error_message = (
                "Pemrosesan video terhenti karena layanan worker dimulai ulang. "
                "Silakan unggah ulang berkas Anda."
            )
            job.output_path = None
            job.completed_at = ts
            job.updated_at = ts
        session.flush()

    for job_id, prev_status, in_path, out_path in recovered:
        _cleanup_job_workspace(job_id, in_path, out_path, workspace_dir)
        audit_logger.record(
            "video_compression.worker",
            "recovered_stale",
            job_id=job_id,
            previous_status=prev_status,
        )

    return len(recovered)


def _is_job_cancelled(
    job_id: str,
    engine_override: Engine | None = None,
    stop_event: Any | None = None,
) -> bool:
    if stop_event is not None and stop_event.is_set():
        return True
    with get_db_session(engine_override=engine_override) as session:
        status = session.execute(
            select(VideoCompressionJob.status).where(VideoCompressionJob.id == job_id)
        ).scalar_one_or_none()
    return status is None or status == "cancelled"


def _transition_running_phase(
    job_id: str,
    *,
    next_status: str,
    progress_percent: float,
    engine_override: Engine | None = None,
    duration_sec: float | None = None,
    width: int | None = None,
    height: int | None = None,
    stop_event: Any | None = None,
) -> bool:
    """Memajukan status fase aktif jika job belum dibatalkan."""
    if stop_event is not None and stop_event.is_set():
        return False

    ts = time.time()
    with get_db_session(engine_override=engine_override) as session:
        job = session.get(VideoCompressionJob, job_id)
        if job is None or job.status == "cancelled":
            return False
        job.status = next_status
        job.running_lock = 1
        job.progress_percent = progress_percent
        if duration_sec is not None:
            job.input_duration_sec = duration_sec
        if width is not None:
            job.input_width = width
        if height is not None:
            job.input_height = height
        job.updated_at = ts
        session.flush()
    return True


def _update_encoding_progress(
    job_id: str,
    progress_percent: float,
    engine_override: Engine | None = None,
) -> None:
    ts = time.time()
    with get_db_session(engine_override=engine_override) as session:
        job = session.get(VideoCompressionJob, job_id)
        if job is None or job.status != "encoding":
            return
        job.progress_percent = progress_percent
        job.updated_at = ts
        session.flush()


def _mark_job_failed(
    job_id: str,
    *,
    error_code: str,
    error_message: str,
    engine_override: Engine | None = None,
    workspace_dir: Path | None = None,
) -> str:
    ts = time.time()
    in_path: str | None = None
    out_path: str | None = None
    final_status = "failed"

    with get_db_session(engine_override=engine_override) as session:
        job = session.get(VideoCompressionJob, job_id)
        if job is not None:
            in_path = job.input_path
            out_path = job.output_path
            if job.status == "cancelled":
                job.running_lock = None
                job.output_path = None
                if job.completed_at is None:
                    job.completed_at = ts
                job.updated_at = ts
                final_status = "cancelled"
            else:
                job.status = "failed"
                job.running_lock = None
                job.error_code = error_code
                job.error_message = error_message
                job.output_path = None
                job.completed_at = ts
                job.updated_at = ts
            session.flush()

    _cleanup_job_workspace(job_id, in_path, out_path, workspace_dir)
    return final_status


def _mark_job_cancelled(
    job_id: str,
    *,
    engine_override: Engine | None = None,
    workspace_dir: Path | None = None,
) -> None:
    ts = time.time()
    in_path: str | None = None
    out_path: str | None = None

    with get_db_session(engine_override=engine_override) as session:
        job = session.get(VideoCompressionJob, job_id)
        if job is not None:
            in_path = job.input_path
            out_path = job.output_path
            job.status = "cancelled"
            job.running_lock = None
            job.output_path = None
            if job.completed_at is None:
                job.completed_at = ts
            job.updated_at = ts
            session.flush()

    _cleanup_job_workspace(job_id, in_path, out_path, workspace_dir)


def process_next_video_job(
    engine_override: Engine | None = None,
    workspace_dir: Path | None = None,
    scanner: Any | None = None,
    stop_event: Any | None = None,
    now: float | None = None,
    transcription_model: Any | None = None,
) -> str | None:
    """Mengambil 1 job `queued` dan memproses scan -> probe -> encode dalam transaksi singkat."""
    with get_db_session(engine_override=engine_override) as session:
        repo = VideoCompressionRepository(session)
        job = repo.claim_next_queued_job(now=now)
        if job is None:
            return None
        job_id = job.id
        user_id = job.user_id
        job_type = getattr(job, "job_type", "compress")
        preset = job.preset
        original_filename = job.original_filename
        original_ext = Path(job.original_filename).suffix.lower()
        input_path_str = job.input_path
        input_size_bytes = int(job.input_size_bytes)

    ws_dir = _resolve_workspace_dir(workspace_dir)
    job_dir = _resolve_job_dir(job_id, input_path_str, None, ws_dir)
    input_path = Path(input_path_str) if input_path_str else (job_dir / "input.bin")
    if job_type == "extract_audio":
        out_ext = ".mp3"
    elif job_type == "transcribe":
        out_ext = ".zip"
    else:
        out_ext = ".mp4"
    output_path = job_dir / f"output{out_ext}"

    write_worker_heartbeat(engine_override, status="processing", active_job_id=job_id)

    try:
        if _is_job_cancelled(job_id, engine_override, stop_event):
            _mark_job_cancelled(job_id, engine_override=engine_override, workspace_dir=ws_dir)
            audit_logger.record(
                "video_compression.worker",
                "cancelled",
                job_id=job_id,
                user_id=user_id,
                job_type=job_type,
            )
            return job_id

        if not input_path.is_file():
            _mark_job_failed(
                job_id,
                error_code="INPUT_MISSING",
                error_message="Berkas video unggahan tidak ditemukan pada workspace.",
                engine_override=engine_override,
                workspace_dir=ws_dir,
            )
            audit_logger.record(
                "video_compression.worker",
                "failed",
                job_id=job_id,
                user_id=user_id,
                job_type=job_type,
                error_code="INPUT_MISSING",
            )
            return job_id

        # Tahap 1: Scan ClamAV streaming 64 KiB fail-closed sebelum ffprobe
        scan_video_file(input_path, scanner=scanner)

        # Tahap 2: Transisi scanning -> probing
        if not _transition_running_phase(
            job_id,
            next_status="probing",
            progress_percent=10.0,
            engine_override=engine_override,
            stop_event=stop_event,
        ):
            _mark_job_cancelled(job_id, engine_override=engine_override, workspace_dir=ws_dir)
            audit_logger.record(
                "video_compression.worker",
                "cancelled",
                job_id=job_id,
                user_id=user_id,
                job_type=job_type,
            )
            return job_id

        if job_type in ("extract_audio", "transcribe"):
            audio_probe = probe_audio_extraction(input_path, job_dir, original_ext=original_ext)
            probe_duration = audio_probe.duration_sec
            probe_width = None
            probe_height = None
            video_probe = None
        else:
            video_probe = probe_video(input_path, job_dir, original_ext=original_ext)
            probe_duration = video_probe.duration_sec
            probe_width = video_probe.width
            probe_height = video_probe.height
            audio_probe = None

        # Tahap 3: Transisi probing -> encoding
        if not _transition_running_phase(
            job_id,
            next_status="encoding",
            progress_percent=15.0,
            duration_sec=probe_duration,
            width=probe_width,
            height=probe_height,
            engine_override=engine_override,
            stop_event=stop_event,
        ):
            _mark_job_cancelled(job_id, engine_override=engine_override, workspace_dir=ws_dir)
            audit_logger.record(
                "video_compression.worker",
                "cancelled",
                job_id=job_id,
                user_id=user_id,
                job_type=job_type,
            )
            return job_id

        last_heartbeat = time.monotonic()

        def _on_progress(pct: float) -> None:
            nonlocal last_heartbeat
            _update_encoding_progress(job_id, pct, engine_override=engine_override)
            mono_now = time.monotonic()
            if (mono_now - last_heartbeat) >= 15.0:
                write_worker_heartbeat(engine_override, status="processing", active_job_id=job_id)
                last_heartbeat = mono_now

        def _should_cancel() -> bool:
            return _is_job_cancelled(job_id, engine_override, stop_event)

        if job_type == "extract_audio":
            assert audio_probe is not None
            result = extract_audio_file(
                input_path,
                output_path,
                job_dir,
                preset=preset,
                probe=audio_probe,
                on_progress=_on_progress,
                should_cancel=_should_cancel,
            )
        elif job_type == "transcribe":
            assert audio_probe is not None
            result = process_transcription_job(
                input_path,
                output_path,
                job_dir,
                original_filename=original_filename,
                preset=preset,
                probe=audio_probe,
                on_progress=_on_progress,
                should_cancel=_should_cancel,
                model=transcription_model,
            )
        else:
            assert video_probe is not None
            result = compress_video_file(
                input_path,
                output_path,
                job_dir,
                preset=preset,
                input_size_bytes=input_size_bytes,
                probe=video_probe,
                on_progress=_on_progress,
                should_cancel=_should_cancel,
            )

        # Hapus berkas input segera untuk membebaskan kuota workspace
        input_path.unlink(missing_ok=True)

        # Tahap 4: Finalisasi succeeded + TTL 15 menit (jika belum dibatalkan saat selesai)
        done_ts = time.time()
        cancelled_at_end = False
        with get_db_session(engine_override=engine_override) as session:
            db_job = session.get(VideoCompressionJob, job_id)
            if db_job is None or db_job.status == "cancelled":
                cancelled_at_end = True
                if db_job is not None:
                    db_job.running_lock = None
                    db_job.output_path = None
                    if db_job.completed_at is None:
                        db_job.completed_at = done_ts
                    db_job.updated_at = done_ts
            else:
                db_job.status = "succeeded"
                db_job.running_lock = None
                db_job.progress_percent = 100.0
                db_job.input_path = None
                db_job.output_path = str(result.output_path)
                db_job.output_size_bytes = result.output_size_bytes
                db_job.output_width = getattr(result, "output_width", None)
                db_job.output_height = getattr(result, "output_height", None)
                db_job.completed_at = done_ts
                db_job.expires_at = done_ts + settings.VIDEO_COMPRESSION_FILE_TTL_SECONDS
                db_job.updated_at = done_ts
            session.flush()

        if cancelled_at_end:
            _cleanup_job_workspace(job_id, str(input_path), str(output_path), ws_dir)
            audit_logger.record(
                "video_compression.worker",
                "cancelled",
                job_id=job_id,
                user_id=user_id,
                job_type=job_type,
            )
        else:
            audit_logger.record(
                "video_compression.worker",
                "succeeded",
                job_id=job_id,
                user_id=user_id,
                job_type=job_type,
                preset=preset,
                input_size_bytes=input_size_bytes,
                output_size_bytes=result.output_size_bytes,
            )
        return job_id

    except VideoCompressionCancelledError:
        _mark_job_cancelled(job_id, engine_override=engine_override, workspace_dir=ws_dir)
        audit_logger.record(
            "video_compression.worker",
            "cancelled",
            job_id=job_id,
            user_id=user_id,
            job_type=job_type,
        )
        return job_id
    except VideoCompressionError as exc:
        final_status = _mark_job_failed(
            job_id,
            error_code=exc.error_code,
            error_message=exc.message,
            engine_override=engine_override,
            workspace_dir=ws_dir,
        )
        audit_logger.record(
            "video_compression.worker",
            final_status,
            job_id=job_id,
            user_id=user_id,
            job_type=job_type,
            error_code=exc.error_code,
        )
        return job_id
    except Exception as exc:
        logger.exception("Unexpected error processing video job %s: %s", job_id, type(exc).__name__)
        final_status = _mark_job_failed(
            job_id,
            error_code="INTERNAL_ERROR",
            error_message="Terjadi kegagalan internal saat memproses video.",
            engine_override=engine_override,
            workspace_dir=ws_dir,
        )
        audit_logger.record(
            "video_compression.worker",
            final_status,
            job_id=job_id,
            user_id=user_id,
            job_type=job_type,
            error_code="INTERNAL_ERROR",
            error_type=type(exc).__name__,
        )
        return job_id


def sweep_expired_and_terminal_jobs(
    engine_override: Engine | None = None,
    workspace_dir: Path | None = None,
    now: float | None = None,
) -> dict[str, int]:
    """Menyapukan TTL 15 menit, berkas `claimed` > 60s, direktori yatim, & baris > 24 jam."""
    ts = time.time() if now is None else now
    ws_dir = _resolve_workspace_dir(workspace_dir)

    expired_targets: list[tuple[str, str | None, str | None]] = []
    claimed_cleanup_targets: list[tuple[str, str | None, str | None]] = []
    stale_upload_targets: list[tuple[str, str | None, str | None]] = []
    purged_rows = 0
    orphan_dirs_removed = 0

    with get_db_session(engine_override=engine_override) as session:
        # 1. Job `succeeded` yang melewati TTL 15 menit
        expired_jobs = list(
            session.execute(
                select(VideoCompressionJob).where(
                    VideoCompressionJob.status == "succeeded",
                    VideoCompressionJob.expires_at.is_not(None),
                    VideoCompressionJob.expires_at <= ts,
                )
            )
            .scalars()
            .all()
        )
        for job in expired_jobs:
            expired_targets.append((job.id, job.input_path, job.output_path))
            job.status = "expired"
            job.running_lock = None
            job.output_path = None
            job.updated_at = ts

        # 2. Job `claimed` melewati masa tenggang 60 detik agar stream unduhan rampung
        claimed_cutoff = ts - CLAIMED_CLEANUP_GRACE_SECONDS
        claimed_jobs = list(
            session.execute(
                select(VideoCompressionJob).where(
                    VideoCompressionJob.status == "claimed",
                    VideoCompressionJob.claimed_at.is_not(None),
                    VideoCompressionJob.claimed_at <= claimed_cutoff,
                    VideoCompressionJob.output_path.is_not(None),
                )
            )
            .scalars()
            .all()
        )
        for job in claimed_jobs:
            claimed_cleanup_targets.append((job.id, job.input_path, job.output_path))
            job.input_path = None
            job.output_path = None
            job.updated_at = ts

        # 3. Upload yang menggantung > 1 jam karena klien/API terputus paksa
        stale_upload_cutoff = ts - STALE_UPLOADING_TIMEOUT_SECONDS
        stale_uploads = list(
            session.execute(
                select(VideoCompressionJob).where(
                    VideoCompressionJob.status == "uploading",
                    VideoCompressionJob.updated_at <= stale_upload_cutoff,
                )
            )
            .scalars()
            .all()
        )
        for job in stale_uploads:
            stale_upload_targets.append((job.id, job.input_path, job.output_path))
            job.status = "failed"
            job.running_lock = None
            job.error_code = "UPLOAD_INCOMPLETE"
            job.error_message = "Unggahan video terputus sebelum selesai."
            job.completed_at = ts
            job.updated_at = ts

        session.flush()

        # 4. Bersihkan direktori workspace yatim / terminal yang tersisa
        if ws_dir.exists():
            for child in ws_dir.iterdir():
                if not child.is_dir():
                    continue
                db_job = session.get(VideoCompressionJob, child.name)
                if db_job is None:
                    try:
                        if child.stat().st_mtime <= (ts - ORPHAN_DIR_GRACE_SECONDS):
                            shutil.rmtree(child, ignore_errors=True)
                            orphan_dirs_removed += 1
                    except OSError:
                        continue
                elif db_job.status in CLEANUP_ON_SWEEP_STATUSES:
                    shutil.rmtree(child, ignore_errors=True)
                elif (
                    db_job.status == "claimed"
                    and (db_job.claimed_at or db_job.updated_at) <= claimed_cutoff
                ):
                    shutil.rmtree(child, ignore_errors=True)

        # 5. Hapus baris terminal > 24 jam (menjaga histori rate-limit 60 menit tetap utuh)
        retention_cutoff = ts - float(settings.VIDEO_COMPRESSION_ROW_RETENTION_SECONDS)
        del_res = session.execute(
            delete(VideoCompressionJob).where(
                VideoCompressionJob.status.in_(PURGE_TERMINAL_STATUSES),
                VideoCompressionJob.created_at < retention_cutoff,
            )
        )
        purged_rows = int(del_res.rowcount or 0)
        session.flush()

    for job_id, in_path, out_path in expired_targets:
        _cleanup_job_workspace(job_id, in_path, out_path, ws_dir)
        audit_logger.record("video_compression.worker", "expired", job_id=job_id)

    for job_id, in_path, out_path in claimed_cleanup_targets:
        _cleanup_job_workspace(job_id, in_path, out_path, ws_dir)

    for job_id, in_path, out_path in stale_upload_targets:
        _cleanup_job_workspace(job_id, in_path, out_path, ws_dir)
        audit_logger.record(
            "video_compression.worker",
            "failed",
            job_id=job_id,
            error_code="UPLOAD_INCOMPLETE",
        )

    return {
        "expired": len(expired_targets),
        "claimed_cleaned": len(claimed_cleanup_targets),
        "stale_uploads_failed": len(stale_upload_targets),
        "orphan_dirs_removed": orphan_dirs_removed,
        "purged_rows": purged_rows,
    }


def run_video_worker_pass(
    engine_override: Engine | None = None,
    workspace_dir: Path | None = None,
    scanner: Any | None = None,
    stop_event: Any | None = None,
    now: float | None = None,
    transcription_model: Any | None = None,
) -> dict[str, Any]:
    """Menjalankan satu siklus sweep + pemrosesan maksimal 1 antrean + heartbeat."""
    sweep_stats = sweep_expired_and_terminal_jobs(
        engine_override=engine_override,
        workspace_dir=workspace_dir,
        now=now,
    )
    processed_job_id = process_next_video_job(
        engine_override=engine_override,
        workspace_dir=workspace_dir,
        scanner=scanner,
        stop_event=stop_event,
        now=now,
        transcription_model=transcription_model,
    )
    write_worker_heartbeat(engine_override=engine_override, status="idle", now=now)
    return {
        "processed_job_id": processed_job_id,
        **sweep_stats,
    }


def run_daemon_loop(
    interval_seconds: float = 2.0,
    heartbeat_interval_seconds: float = 15.0,
    stop_event: Any | None = None,
    engine_override: Engine | None = None,
    workspace_dir: Path | None = None,
) -> None:
    """Loop daemon jangka panjang untuk `satukit-video-worker.service`."""
    logger.info("Starting Satukit Video Compression Worker daemon...")
    recovered = recover_stale_running_jobs(
        engine_override=engine_override,
        workspace_dir=workspace_dir,
    )
    if recovered > 0:
        logger.warning("Recovered %d interrupted video job(s) from prior run.", recovered)

    write_worker_heartbeat(engine_override=engine_override, status="idle")
    last_heartbeat_mono = time.monotonic()

    try:
        while True:
            if stop_event is not None and stop_event.is_set():
                logger.info("Stop event received. Exiting video worker loop.")
                break

            try:
                sweep_expired_and_terminal_jobs(
                    engine_override=engine_override,
                    workspace_dir=workspace_dir,
                )
                processed_id = process_next_video_job(
                    engine_override=engine_override,
                    workspace_dir=workspace_dir,
                    stop_event=stop_event,
                )
                mono_now = time.monotonic()
                heartbeat_due = (mono_now - last_heartbeat_mono) >= heartbeat_interval_seconds
                if processed_id is not None or heartbeat_due:
                    write_worker_heartbeat(engine_override=engine_override, status="idle")
                    last_heartbeat_mono = mono_now
            except Exception as exc:
                logger.error("Error in video worker pass: %s", type(exc).__name__)

            if stop_event is not None and stop_event.is_set():
                break
            time.sleep(interval_seconds)
    finally:
        try:
            write_worker_heartbeat(engine_override=engine_override, status="stopped")
        except Exception:
            pass


def main() -> None:
    """Entry point untuk `python -m app.workers.video_worker`."""
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] [satukit.video_worker] %(message)s",
    )
    settings.validate_production()

    class GracefulKiller:
        kill_now = False

        def __init__(self) -> None:
            signal.signal(signal.SIGINT, self.exit_gracefully)
            signal.signal(signal.SIGTERM, self.exit_gracefully)

        def exit_gracefully(self, signum: int, frame: Any) -> None:
            self.kill_now = True

        def is_set(self) -> bool:
            return self.kill_now

    killer = GracefulKiller()
    run_daemon_loop(interval_seconds=2.0, stop_event=killer)


if __name__ == "__main__":
    main()
