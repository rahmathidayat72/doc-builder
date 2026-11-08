from __future__ import annotations

from app.core.config import settings
from app.services.job_manager import BackgroundSweeper, ConversionJobManager

conversion_job_manager = ConversionJobManager(
    workspace_root=settings.TEMP_WORKSPACE_DIR / "conversion_jobs",
    ttl_seconds=settings.TEMP_FILE_TTL_SECONDS,
)

background_sweeper = BackgroundSweeper(
    manager=conversion_job_manager,
    interval_seconds=settings.DISK_SWEEPER_INTERVAL_SECONDS,
)
