import os
import shutil
import time
from pathlib import Path

from fastapi import APIRouter, Response
from sqlalchemy import Engine, text

from app.core.config import settings
from app.core.disk_guard import get_disk_space_info
from app.db.models import RuntimeState
from app.db.postgres import get_db_session
from app.services.video_compressor import detect_ffmpeg_binaries
from app.workers.heartbeat import (
    FILE_WORKER_HEARTBEAT_KEY,
    FILE_WORKER_HEARTBEAT_STALE_SECONDS,
    evaluate_worker_heartbeat,
)
from app.workers.video_worker import HEARTBEAT_STATE_KEY

router = APIRouter(tags=["Health"])

VIDEO_WORKER_HEARTBEAT_STALE_SECONDS = 60.0
LIBREOFFICE_LEASE_STATE_KEY = "libreoffice_active_lease"
_ENGINE_OVERRIDE: Engine | None = None


def set_health_engine_override(eng: Engine | None) -> None:
    """Mengatur engine database override untuk pengujian terisolasi."""
    global _ENGINE_OVERRIDE
    _ENGINE_OVERRIDE = eng


def check_database() -> bool:
    """Memeriksa konektivitas basis data PostgreSQL."""
    try:
        from app.db.postgres import engine

        target_engine = _ENGINE_OVERRIDE or engine
        with target_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def _read_worker_health(
    state_key: str,
    *,
    stale_seconds: float,
    db_ok: bool,
    now: float | None = None,
    include_active_job: bool = False,
) -> dict[str, object]:
    """Membaca kesegaran heartbeat worker dari `runtime_state` tanpa path internal."""
    if not db_ok and _ENGINE_OVERRIDE is None:
        return evaluate_worker_heartbeat(
            None,
            stale_seconds=stale_seconds,
            now=now,
            include_active_job=include_active_job,
        )

    try:
        with get_db_session(engine_override=_ENGINE_OVERRIDE) as session:
            state = session.get(RuntimeState, state_key)
            return evaluate_worker_heartbeat(
                state,
                stale_seconds=stale_seconds,
                now=now,
                include_active_job=include_active_job,
            )
    except Exception:
        return evaluate_worker_heartbeat(
            None,
            stale_seconds=stale_seconds,
            now=now,
            include_active_job=include_active_job,
        )


def get_video_worker_health(
    *,
    db_ok: bool,
    now: float | None = None,
) -> dict[str, object]:
    """Mengambil kesegaran heartbeat worker video tanpa path filesystem internal."""
    return _read_worker_health(
        HEARTBEAT_STATE_KEY,
        stale_seconds=VIDEO_WORKER_HEARTBEAT_STALE_SECONDS,
        db_ok=db_ok,
        now=now,
        include_active_job=True,
    )


def get_file_worker_health(
    *,
    db_ok: bool,
    now: float | None = None,
) -> dict[str, object]:
    """Mengambil kesegaran heartbeat worker Rak Berkas tanpa path filesystem internal."""
    return _read_worker_health(
        FILE_WORKER_HEARTBEAT_KEY,
        stale_seconds=FILE_WORKER_HEARTBEAT_STALE_SECONDS,
        db_ok=db_ok,
        now=now,
        include_active_job=False,
    )


def get_libreoffice_lease_health(
    *,
    db_ok: bool,
    now: float | None = None,
) -> dict[str, object]:
    """Mengambil status lease tunggal LibreOffice tanpa membocorkan PID atau path."""
    fallback: dict[str, object] = {
        "busy": False,
        "job_type": None,
        "lease_expires_in_seconds": None,
    }
    if not db_ok and _ENGINE_OVERRIDE is None:
        return fallback

    try:
        with get_db_session(engine_override=_ENGINE_OVERRIDE) as session:
            state = session.get(RuntimeState, LIBREOFFICE_LEASE_STATE_KEY)
            if state is None or not isinstance(state.value, dict):
                return fallback
            active = bool(state.value.get("active", False))
            expires_at = float(state.value.get("expires_at", 0.0))
            ts = time.time() if now is None else now
            if not active or expires_at <= ts:
                return fallback
            job_type = str(state.value.get("job_type") or "pdf_conversion")
            return {
                "busy": True,
                "job_type": job_type,
                "lease_expires_in_seconds": round(expires_at - ts, 2),
            }
    except Exception:
        return fallback


def detect_libreoffice() -> tuple[bool, str | None]:
    """Mendeteksi apakah soffice / libreoffice tersedia di direktori portable lokal,
    environment variable, path standar Windows, atau PATH sistem."""
    # 1. Cek direktori portable lokal repositori (prioritas utama saat pindah perangkat)
    portable_paths = [
        settings.BASE_DIR / "bin" / "libreoffice" / "program" / "soffice.exe",
        settings.BASE_DIR.parent / "bin" / "libreoffice" / "program" / "soffice.exe",
    ]
    for p in portable_paths:
        if p.exists():
            return True, str(p)

    # 2. Cek environment variable khusus
    for env_var in ("LIBREOFFICE_PATH", "SOFFICE_PATH"):
        custom_path = os.environ.get(env_var)
        if custom_path and Path(custom_path).exists():
            return True, str(Path(custom_path))

    # 3. Cek path instalasi standar di Windows
    local_app_data = os.environ.get("LOCALAPPDATA")
    common_paths = [
        Path(r"C:\Program Files\LibreOffice\program\soffice.exe"),
        Path(r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"),
    ]
    if local_app_data:
        p_user = Path(local_app_data) / "Programs" / "LibreOffice" / "program" / "soffice.exe"
        common_paths.insert(0, p_user)

    for p in common_paths:
        if p.exists():
            return True, str(p)

    # 4. Cek di PATH sistem
    cmd = shutil.which("soffice") or shutil.which("libreoffice")
    if cmd:
        return True, cmd

    return False, None


@router.get("/health")
def get_health(response: Response):
    lo_available, lo_path = detect_libreoffice()
    ffmpeg_bin, ffprobe_bin = detect_ffmpeg_binaries()
    disk_info = get_disk_space_info()
    db_ok = check_database()
    worker_health = get_video_worker_health(db_ok=db_ok)
    file_worker_health = get_file_worker_health(db_ok=db_ok)
    lo_lease_health = get_libreoffice_lease_health(db_ok=db_ok)

    is_healthy = db_ok
    if not is_healthy and settings.IS_PRODUCTION:
        response.status_code = 503
        status_str = "unhealthy"
    elif not is_healthy:
        status_str = "degraded"
    else:
        status_str = "ready"

    return {
        "status": status_str,
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database_connected": db_ok,
        "libreoffice_available": lo_available,
        "libreoffice_path": None if settings.IS_PRODUCTION else lo_path,
        "libreoffice_worker": lo_lease_health,
        "ffmpeg_available": ffmpeg_bin is not None,
        "ffprobe_available": ffprobe_bin is not None,
        "video_worker": worker_health,
        "file_worker": file_worker_health,
        "disk": disk_info.to_dict(),
    }
