from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "Satukit Backend API"
    VERSION: str = "0.1.0"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    MAX_FILE_SIZE_MB: int = 25
    TEMP_DIR_GLOBAL_LIMIT_MB: int = 500
    TEMP_FILE_TTL_MINUTES: int = 5
    TEMP_FILE_TTL_SECONDS: int = 3600  # 1 jam (BRULE-003)
    DISK_USAGE_WARNING_PERCENT: float = 70.0  # Ambang peringatan (BRULE-014)
    DISK_USAGE_CRITICAL_PERCENT: float = 80.0  # Ambang penolakan fail-closed (BRULE-014)
    DISK_SWEEPER_INTERVAL_SECONDS: int = 300  # 5 menit siklus background sweeper

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
    DATA_DIR: Path = BASE_DIR / "data"
    DATABASE_PATH: Path = BASE_DIR / "data" / "docbuilder.db"
    MODELS_DIR: Path = BASE_DIR / "models"
    U2NETP_MODEL_PATH: Path = BASE_DIR / "models" / "u2netp.onnx"

    # Konfigurasi Remove Background (U2NetP ONNX)
    BG_REMOVER_TIMEOUT_SECONDS: int = 30
    BG_REMOVER_MAX_IMAGE_MB: int = 10
    BG_REMOVER_CONCURRENCY: int = 1
    BG_REMOVER_QUEUE_CAPACITY: int = 2

    # Konfigurasi autentikasi & sesi
    SESSION_COOKIE_NAME: str = "satukit_session"
    LEGACY_SESSION_COOKIE_NAME: str = "docbuilder_session"
    SESSION_TTL_DAYS: int = 30  # 30 hari sesi aktif
    AUTH_TOKEN_TTL_MINUTES: int = 15  # TTL token reset password / verifikasi 15 menit (NFR-SEC-006)
    GOOGLE_CLIENT_ID: str | None = None
    IS_PRODUCTION: bool = False

    # Audit trail lokal
    AUDIT_LOG_DIR: Path = BASE_DIR / "logs"
    AUDIT_LOG_RETENTION_DAYS: int = 7

    # Konfigurasi Pemendek URL Serverless (Cloudflare Workers + D1 / Local fallback)
    SHORTENER_EDGE_URL: str = "https://s.satukit.local"
    SHORTENER_ADMIN_HMAC_SECRET: str = "satukit-shortener-secret-local"
    SHORTENER_FALLBACK_DB_PATH: Path = BASE_DIR / "data" / "shortener_fallback.db"

    # Konfigurasi Pengunduh Media (YouTube, Instagram, TikTok)
    MEDIA_DOWNLOAD_MAX_FILE_SIZE_MB: int = 250
    MEDIA_DOWNLOAD_TIMEOUT_SECONDS: int = 1200
    MEDIA_DOWNLOAD_HOURLY_JOB_LIMIT: int = 3
    MEDIA_DOWNLOAD_DAILY_QUOTA_MB: int = 1024
    MEDIA_DOWNLOAD_FILE_TTL_SECONDS: int = 900
    MEDIA_DOWNLOAD_GLOBAL_RUNNING_LIMIT: int = 1
    MEDIA_DOWNLOAD_QUEUE_CAPACITY: int = 2


settings = Settings()
