import shutil
from pathlib import Path

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["Health"])


def detect_libreoffice() -> tuple[bool, str | None]:
    """Mendeteksi apakah soffice / libreoffice tersedia di PATH atau path standar Windows."""
    # 1. Cek di PATH sistem
    cmd = shutil.which("soffice") or shutil.which("libreoffice")
    if cmd:
        return True, cmd

    # 2. Cek path instalasi standar di Windows
    common_paths = [
        Path(r"C:\Program Files\LibreOffice\program\soffice.exe"),
        Path(r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"),
    ]
    for p in common_paths:
        if p.exists():
            return True, str(p)

    return False, None


@router.get("/health")
def get_health():
    lo_available, lo_path = detect_libreoffice()
    return {
        "status": "ready",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": "localhost",
        "libreoffice_available": lo_available,
        "libreoffice_path": lo_path,
    }
