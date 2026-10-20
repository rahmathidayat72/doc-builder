from app.core.config import settings
from app.services.job_manager import ConversionJobManager

conversion_job_manager = ConversionJobManager(
    workspace_root=settings.TEMP_WORKSPACE_DIR / "conversion_jobs",
    ttl_seconds=settings.TEMP_FILE_TTL_MINUTES * 60,
)
