from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "Doc-builder Backend"
    VERSION: str = "0.1.0"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    MAX_FILE_SIZE_MB: int = 25
    TEMP_DIR_GLOBAL_LIMIT_MB: int = 500
    TEMP_FILE_TTL_MINUTES: int = 5

    # Keamanan Origin
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Path konfigurasi lokal
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    TEMP_WORKSPACE_DIR: Path = BASE_DIR / "temp_workspace"

    # Audit trail lokal
    AUDIT_LOG_DIR: Path = BASE_DIR / "logs"
    AUDIT_LOG_RETENTION_DAYS: int = 7


settings = Settings()
