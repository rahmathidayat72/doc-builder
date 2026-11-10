from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app


def test_startup_does_not_create_sqlite_db(tmp_path: Path, monkeypatch) -> None:
    """Verifikasi DB-POSTGRES-007: create_app() tidak lagi menginisialisasi docbuilder.db."""
    isolated_data_dir = tmp_path / "data"
    isolated_data_dir.mkdir(parents=True, exist_ok=True)
    fake_db_file = isolated_data_dir / "docbuilder.db"

    monkeypatch.setattr(settings, "DATABASE_PATH", fake_db_file)
    monkeypatch.setattr(settings, "BASE_DIR", tmp_path)

    # Inisialisasi app baru via create_app
    app = create_app()
    with TestClient(app) as client:
        res = client.get("/api/health")
        assert res.status_code == 200

    # Pastikan file docbuilder.db TIDAK diciptakan oleh startup
    assert not fake_db_file.exists(), (
        f"File SQLite {fake_db_file} masih diciptakan saat startup! "
        "SQLite retirement gate gagal."
    )
