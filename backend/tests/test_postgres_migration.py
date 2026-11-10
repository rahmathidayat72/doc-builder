from __future__ import annotations

import sys
from pathlib import Path

# Pastikan direktori backend masuk sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, inspect  # noqa: E402

from alembic import command  # noqa: E402
from app.db.models import (  # noqa: E402
    AuthToken,
    MediaDownloadJob,
    MediaDownloadUsage,
    OAuthAccount,
    ShortUrl,
    User,
    UserSession,
)
from app.db.postgres import Base  # noqa: E402


def test_models_metadata_registration() -> None:
    expected_tables = {
        "users",
        "oauth_accounts",
        "user_sessions",
        "auth_tokens",
        "short_urls",
        "media_download_jobs",
        "media_download_usage",
    }
    assert expected_tables.issubset(set(Base.metadata.tables.keys()))
    assert User.__tablename__ == "users"
    assert OAuthAccount.__tablename__ == "oauth_accounts"
    assert UserSession.__tablename__ == "user_sessions"
    assert AuthToken.__tablename__ == "auth_tokens"
    assert ShortUrl.__tablename__ == "short_urls"
    assert MediaDownloadJob.__tablename__ == "media_download_jobs"
    assert MediaDownloadUsage.__tablename__ == "media_download_usage"


def test_alembic_upgrade_and_downgrade_lifecycle(tmp_path: Path) -> None:
    test_db = tmp_path / "migration_test.db"
    test_url = f"sqlite:///{test_db.as_posix()}"

    ini_path = backend_dir / "alembic.ini"
    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("sqlalchemy.url", test_url)

    engine = create_engine(test_url)

    # 1. Upgrade to head
    command.upgrade(alembic_cfg, "head")

    inspector = inspect(engine)
    created_tables = set(inspector.get_table_names())
    expected_tables = {
        "users",
        "oauth_accounts",
        "user_sessions",
        "auth_tokens",
        "short_urls",
        "media_download_jobs",
        "media_download_usage",
        "alembic_version",
    }
    assert expected_tables.issubset(created_tables)

    # Verifikasi kolom users
    user_cols = {c["name"]: c for c in inspector.get_columns("users")}
    assert "id" in user_cols
    assert "email" in user_cols
    assert "password_hash" in user_cols
    assert "name" in user_cols
    assert "email_verified" in user_cols
    assert "created_at" in user_cols
    assert "updated_at" in user_cols

    # Verifikasi foreign key oauth_accounts -> users
    fks = inspector.get_foreign_keys("oauth_accounts")
    assert any(fk["referred_table"] == "users" for fk in fks)

    # 2. Downgrade to base
    command.downgrade(alembic_cfg, "base")

    inspector_after = inspect(engine)
    remaining_tables = set(inspector_after.get_table_names())
    assert "users" not in remaining_tables
    assert "oauth_accounts" not in remaining_tables
    assert "user_sessions" not in remaining_tables
    assert "auth_tokens" not in remaining_tables
    assert "short_urls" not in remaining_tables
    assert "media_download_jobs" not in remaining_tables
    assert "media_download_usage" not in remaining_tables

    engine.dispose()
