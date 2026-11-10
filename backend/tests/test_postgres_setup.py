from __future__ import annotations

import sys
from pathlib import Path

# Pastikan direktori backend masuk sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from alembic.config import Config  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402
from sqlalchemy.engine import Engine  # noqa: E402

from app.core.config import Settings, settings  # noqa: E402
from app.db.postgres import Base, create_postgres_engine  # noqa: E402


def test_postgres_dependencies_installed() -> None:
    import psycopg
    import sqlalchemy

    import alembic

    assert sqlalchemy.__version__ >= "2.0.0"
    assert alembic.__version__ >= "1.14.0"
    assert psycopg.__version__ >= "3.0.0"


def test_database_url_configuration(monkeypatch) -> None:
    assert settings.DATABASE_URL.startswith("postgresql+psycopg://")

    custom_url = "postgresql+psycopg://custom_user:custom_pass@db.internal:5432/custom_satukit"
    monkeypatch.setenv("DATABASE_URL", custom_url)
    custom_settings = Settings()
    assert custom_settings.DATABASE_URL == custom_url


def test_postgres_engine_builder() -> None:
    test_url = "postgresql+psycopg://test_user:test_pass@127.0.0.1:5432/test_db"
    pg_engine = create_postgres_engine(test_url)
    assert isinstance(pg_engine, Engine)
    assert pg_engine.dialect.name == "postgresql"
    assert pg_engine.dialect.driver == "psycopg"
    assert pg_engine.pool.size() == 5


def test_alembic_configuration_and_script_directory() -> None:
    ini_path = backend_dir / "alembic.ini"
    assert ini_path.exists(), "alembic.ini harus berada di root direktori backend"

    alembic_cfg = Config(str(ini_path))
    script_loc = alembic_cfg.get_main_option("script_location")
    assert script_loc is not None
    assert "alembic" in script_loc

    env_path = backend_dir / "alembic" / "env.py"
    assert env_path.exists(), "alembic/env.py harus ada"

    script = ScriptDirectory.from_config(alembic_cfg)
    assert script.dir == str(backend_dir / "alembic")
    assert (Path(script.dir) / "versions").exists()
    assert hasattr(Base, "metadata")
