import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Response

from app.core.config import settings
from app.core.disk_guard import get_disk_space_info

router = APIRouter(tags=["Health"])


def check_database() -> bool:
    """Memeriksa konektivitas basis data PostgreSQL."""
    try:
        from sqlalchemy import text
        from app.db.postgres import engine

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


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
    disk_info = get_disk_space_info()
    db_ok = check_database()

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
        "disk": disk_info.to_dict(),
    }
