from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field

# ponytail: stdlib env loader handles .env & os.environ, add pydantic-settings when nested config trees needed.
def _find_and_load_env() -> None:
    candidates = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parent.parent.parent / ".env",
        Path(__file__).resolve().parent.parent.parent.parent / ".env",
    ]
    env_file = os.getenv("ENV_FILE")
    if env_file:
        candidates.insert(0, Path(env_file))
    for p in candidates:
        if p.is_file():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v
                break
            except Exception:
                pass


_find_and_load_env()


def _env_str(key: str, default: str) -> str:
    return os.getenv(key, default)


def _env_opt_str(key: str, default: str | None = None) -> str | None:
    return os.getenv(key, default)


def _env_bool(key: str, default: bool) -> bool:
    val = os.getenv(key)
    if val is None:
        return default
    return val.strip().lower() in ("true", "1", "yes", "on")


def _env_int(key: str, default: int) -> int:
    val = os.getenv(key)
    if val is None:
        return default
    try:
        return int(val)
    except ValueError:
        return default


def _env_float(key: str, default: float) -> float:
    val = os.getenv(key)
    if val is None:
        return default
    try:
        return float(val)
    except ValueError:
        return default


def _env_list(key: str, default: list[str]) -> list[str]:
    val = os.getenv(key)
    if not val:
        return default
    return [item.strip() for item in val.split(",") if item.strip()]


class Settings(BaseModel):
    PROJECT_NAME: str = Field(
        default_factory=lambda: _env_str("PROJECT_NAME", "Satukit Backend API")
    )
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = Field(default_factory=lambda: _env_str("ENVIRONMENT", "development"))
    IS_PRODUCTION: bool = Field(
        default_factory=lambda: _env_bool("IS_PRODUCTION", False)
        or (_env_str("ENVIRONMENT", "development").lower() in ("production", "prod"))
    )
    PUBLIC_BASE_URL: str = Field(
        default_factory=lambda: _env_str("PUBLIC_BASE_URL", "http://localhost:5173")
    )
    HOST: str = Field(default_factory=lambda: _env_str("HOST", "127.0.0.1"))
    PORT: int = Field(default_factory=lambda: _env_int("PORT", 8000))
    MAX_FILE_SIZE_MB: int = Field(default_factory=lambda: _env_int("MAX_FILE_SIZE_MB", 25))
    TEMP_DIR_GLOBAL_LIMIT_MB: int = Field(
        default_factory=lambda: _env_int("TEMP_DIR_GLOBAL_LIMIT_MB", 500)
    )
    TEMP_FILE_TTL_MINUTES: int = Field(default_factory=lambda: _env_int("TEMP_FILE_TTL_MINUTES", 5))
    TEMP_FILE_TTL_SECONDS: int = Field(
        default_factory=lambda: _env_int("TEMP_FILE_TTL_SECONDS", 3600)
    )  # 1 jam (BRULE-003)
    DISK_USAGE_WARNING_PERCENT: float = Field(
        default_factory=lambda: _env_float("DISK_USAGE_WARNING_PERCENT", 70.0)
    )  # Ambang peringatan (BRULE-014)
    DISK_USAGE_CRITICAL_PERCENT: float = Field(
        default_factory=lambda: _env_float("DISK_USAGE_CRITICAL_PERCENT", 80.0)
    )  # Ambang penolakan fail-closed (BRULE-014)
    DISK_SWEEPER_INTERVAL_SECONDS: int = Field(
        default_factory=lambda: _env_int("DISK_SWEEPER_INTERVAL_SECONDS", 300)
    )  # 5 menit siklus background sweeper

    # Keamanan Origin & Host
    ALLOWED_ORIGINS: list[str] = Field(
        default_factory=lambda: _env_list(
            "ALLOWED_ORIGINS",
            [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:4173",
                "http://127.0.0.1:4173",
                "http://localhost:8000",
                "http://127.0.0.1:8000",
            ],
        )
    )
    TRUSTED_HOSTS: list[str] = Field(
        default_factory=lambda: _env_list(
            "TRUSTED_HOSTS",
            ["localhost", "127.0.0.1", "testserver"],
        )
    )
    DOCS_ENABLED: bool = Field(
        default_factory=lambda: _env_bool(
            "DOCS_ENABLED",
            not (
                _env_bool("IS_PRODUCTION", False)
                or _env_str("ENVIRONMENT", "development").lower() in ("production", "prod")
            ),
        )
    )

    # Path konfigurasi
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    TEMP_WORKSPACE_DIR: Path = BASE_DIR / "temp_workspace"
    DATA_DIR: Path = BASE_DIR / "data"
    DATABASE_PATH: Path = BASE_DIR / "data" / "docbuilder.db"
    DATABASE_URL: str = Field(
        default_factory=lambda: _env_str(
            "DATABASE_URL",
            "postgresql+psycopg://satukit_user:satukit_pass@127.0.0.1:5432/satukit",
        )
    )
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
    GOOGLE_CLIENT_ID: str | None = Field(default_factory=lambda: _env_opt_str("GOOGLE_CLIENT_ID"))
    BOT_CHALLENGE_SECRET: str = Field(
        default_factory=lambda: _env_str(
            "BOT_CHALLENGE_SECRET", "satukit-bot-challenge-secret-local-2026"
        )
    )
    BOT_CHALLENGE_TTL_SECONDS: int = 300  # 5 menit

    # Audit trail
    AUDIT_LOG_DIR: Path = BASE_DIR / "logs"
    AUDIT_LOG_RETENTION_DAYS: int = 7

    # Konfigurasi Pemendek URL Serverless (Cloudflare Workers + D1 / Local fallback)
    SHORTENER_EDGE_URL: str = Field(
        default_factory=lambda: _env_str("SHORTENER_EDGE_URL", "https://s.satukit.local")
    )
    SHORTENER_ADMIN_HMAC_SECRET: str = Field(
        default_factory=lambda: _env_str(
            "SHORTENER_ADMIN_HMAC_SECRET", "satukit-shortener-secret-local"
        )
    )
    SHORTENER_FALLBACK_DB_PATH: Path = BASE_DIR / "data" / "shortener_fallback.db"

    # Konfigurasi Pengunduh Media (YouTube, Instagram, TikTok)
    MEDIA_DOWNLOAD_MAX_FILE_SIZE_MB: int = 250
    MEDIA_DOWNLOAD_TIMEOUT_SECONDS: int = 1200
    MEDIA_DOWNLOAD_HOURLY_JOB_LIMIT: int = 3
    MEDIA_DOWNLOAD_DAILY_QUOTA_MB: int = 1024
    MEDIA_DOWNLOAD_FILE_TTL_SECONDS: int = 900
    MEDIA_DOWNLOAD_GLOBAL_RUNNING_LIMIT: int = 1
    MEDIA_DOWNLOAD_QUEUE_CAPACITY: int = 2

    # Konfigurasi Draf CV Multi-Akun & Retensi 30 Hari
    DRAFT_RETENTION_DAYS: int = 30
    DRAFT_MAX_COUNT_PER_USER: int = 5
    DRAFT_MAX_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB per draf
    DRAFT_MAX_TOTAL_BYTES_PER_USER: int = 50 * 1024 * 1024  # 50 MB total per akun
    DRAFT_UNDO_WINDOW_SECONDS: int = 10  # Window undo manual delete
    DRAFT_CLEANER_INTERVAL_SECONDS: int = 300  # 5 menit worker cleaner

    # Konfigurasi Email Transaksional (Brevo API)
    BREVO_API_KEY: str | None = Field(default_factory=lambda: _env_opt_str("BREVO_API_KEY"))
    BREVO_SENDER_EMAIL: str | None = Field(default_factory=lambda: _env_opt_str("BREVO_SENDER_EMAIL"))
    BREVO_SENDER_NAME: str = Field(
        default_factory=lambda: _env_str("BREVO_SENDER_NAME", "Satukit")
    )

    # Konfigurasi Backup Terenkripsi Cloudflare R2
    R2_ENDPOINT_URL: str | None = Field(default_factory=lambda: _env_opt_str("R2_ENDPOINT_URL"))
    R2_BUCKET: str | None = Field(default_factory=lambda: _env_opt_str("R2_BUCKET"))
    R2_ACCESS_KEY_ID: str | None = Field(default_factory=lambda: _env_opt_str("R2_ACCESS_KEY_ID"))
    R2_SECRET_ACCESS_KEY: str | None = Field(
        default_factory=lambda: _env_opt_str("R2_SECRET_ACCESS_KEY")
    )
    CLOUDFLARE_API_TOKEN: str | None = Field(
        default_factory=lambda: _env_opt_str("CLOUDFLARE_API_TOKEN")
    )
    CLOUDFLARE_ACCOUNT_ID: str | None = Field(
        default_factory=lambda: _env_opt_str("CLOUDFLARE_ACCOUNT_ID")
    )
    CLOUDFLARE_GRAPHQL_URL: str = Field(
        default_factory=lambda: _env_str(
            "CLOUDFLARE_GRAPHQL_URL", "https://api.cloudflare.com/client/v4/graphql"
        )
    )
    BACKUP_ENCRYPTION_KEY_FILE: Path | None = Field(
        default_factory=lambda: Path(_env_str("BACKUP_ENCRYPTION_KEY_FILE", ""))
        if _env_opt_str("BACKUP_ENCRYPTION_KEY_FILE")
        else None
    )

    def validate_production(self) -> None:
        """Memvalidasi parameter keamanan wajib saat mode produksi aktif (fail-fast)."""
        if not self.IS_PRODUCTION:
            return
        errors: list[str] = []
        if (
            not self.BOT_CHALLENGE_SECRET
            or self.BOT_CHALLENGE_SECRET == "satukit-bot-challenge-secret-local-2026"
        ):
            errors.append("BOT_CHALLENGE_SECRET wajib diatur dengan secret acak di produksi")
        if (
            not self.SHORTENER_ADMIN_HMAC_SECRET
            or self.SHORTENER_ADMIN_HMAC_SECRET == "satukit-shortener-secret-local"
        ):
            errors.append("SHORTENER_ADMIN_HMAC_SECRET wajib diatur dengan secret acak di produksi")
        if "satukit_pass@" in self.DATABASE_URL:
            errors.append(
                "DATABASE_URL dilarang menggunakan kata sandi default development di produksi"
            )
        if not self.PUBLIC_BASE_URL.startswith("https://"):
            errors.append("PUBLIC_BASE_URL wajib menggunakan protokol HTTPS di produksi")
        if errors:
            raise ValueError("Konfigurasi produksi tidak valid:\n- " + "\n- ".join(errors))


settings = Settings()
