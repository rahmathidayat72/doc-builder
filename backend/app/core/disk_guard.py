from __future__ import annotations

import shutil
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

from fastapi import HTTPException

from app.core.config import settings

DiskHealthStatus = Literal["healthy", "warning", "critical"]


class DiskSpaceExhaustedError(HTTPException):
    """Dilempar ketika kapasitas disk mencapai atau melampaui ambang batas kritis (80%)."""

    def __init__(self, detail: str) -> None:
        super().__init__(status_code=507, detail=detail)


@dataclass(frozen=True)
class DiskSpaceInfo:
    total_bytes: int
    used_bytes: int
    free_bytes: int
    used_percent: float
    status: DiskHealthStatus

    @property
    def total_mb(self) -> float:
        return round(self.total_bytes / (1024 * 1024), 2)

    @property
    def used_mb(self) -> float:
        return round(self.used_bytes / (1024 * 1024), 2)

    @property
    def free_mb(self) -> float:
        return round(self.free_bytes / (1024 * 1024), 2)

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["total_mb"] = self.total_mb
        data["used_mb"] = self.used_mb
        data["free_mb"] = self.free_mb
        return data


def get_disk_space_info(path: Path | str | None = None) -> DiskSpaceInfo:
    """Mengambil informasi kapasitas disk aktual pada path tertentu."""
    target_path = Path(path) if path is not None else settings.TEMP_WORKSPACE_DIR
    target_path.mkdir(parents=True, exist_ok=True)

    try:
        usage = shutil.disk_usage(str(target_path))
        total = usage.total
        used = usage.used
        free = usage.free
    except OSError:
        # Fallback jika sistem file tidak mendukung statvfs
        total, used, free = 1, 0, 1

    used_percent = round((used / total) * 100.0, 2) if total > 0 else 0.0

    if used_percent >= settings.DISK_USAGE_CRITICAL_PERCENT:
        status: DiskHealthStatus = "critical"
    elif used_percent >= settings.DISK_USAGE_WARNING_PERCENT:
        status = "warning"
    else:
        status = "healthy"

    return DiskSpaceInfo(
        total_bytes=total,
        used_bytes=used,
        free_bytes=free,
        used_percent=used_percent,
        status=status,
    )


def check_disk_guard(path: Path | str | None = None) -> DiskSpaceInfo:
    """Memeriksa ambang disk dan melempar DiskSpaceExhaustedError jika kritis."""
    info = get_disk_space_info(path)
    if info.status == "critical":
        raise DiskSpaceExhaustedError(
            f"Penyimpanan server hampir penuh ({info.used_percent:.1f}% terpakai, "
            f"ambang batas {settings.DISK_USAGE_CRITICAL_PERCENT:.1f}%). "
            "Penerimaan dan pemrosesan berkas sementara dihentikan demi menjaga stabilitas sistem."
        )
    return info
