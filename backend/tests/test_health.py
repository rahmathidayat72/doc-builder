import json
import sys
import time
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Pastikan module app dapat di-import
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.api.health import set_health_engine_override
from app.db.models import RuntimeState
from app.db.postgres import Base
from app.main import app
from app.workers.heartbeat import FILE_WORKER_HEARTBEAT_KEY
from app.workers.video_worker import HEARTBEAT_STATE_KEY

client = TestClient(app)


def test_health_check_returns_ready():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ready", "degraded")
    assert data["service"] == "Beresin by Satukit API"
    assert data["environment"] in ("localhost", "development")
    assert "database_connected" in data
    assert "libreoffice_available" in data
    assert isinstance(data["ffmpeg_available"], bool)
    assert isinstance(data["ffprobe_available"], bool)
    assert data["video_worker"]["status"] in ("healthy", "stale", "unavailable")
    assert data["file_worker"]["status"] in ("healthy", "stale", "unavailable")
    assert "heartbeat_age_seconds" in data["file_worker"]
    assert "disk" in data
    assert data["disk"]["status"] in ("healthy", "warning", "critical")
    assert "used_percent" in data["disk"]
    assert "free_mb" in data["disk"]


def test_health_reports_ffmpeg_and_worker_heartbeat_without_internal_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    db_file = tmp_path / f"health_{uuid.uuid4().hex}.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    set_health_engine_override(engine)

    try:
        secret_ffmpeg = "/opt/internal-bin/ffmpeg"
        secret_ffprobe = "/opt/internal-bin/ffprobe"
        monkeypatch.setattr(
            "app.api.health.detect_ffmpeg_binaries",
            lambda: (secret_ffmpeg, secret_ffprobe),
        )

        # 1. Missing heartbeat -> unavailable (tetap HTTP 200)
        res_missing = client.get("/api/health")
        assert res_missing.status_code == 200
        d_missing = res_missing.json()
        assert d_missing["database_connected"] is True
        assert d_missing["ffmpeg_available"] is True
        assert d_missing["ffprobe_available"] is True
        assert d_missing["video_worker"]["status"] == "unavailable"
        assert d_missing["video_worker"]["fresh"] is False
        assert d_missing["file_worker"]["status"] == "unavailable"
        assert d_missing["file_worker"]["fresh"] is False
        assert d_missing["file_worker"]["heartbeat_age_seconds"] is None
        assert "/opt/internal-bin" not in json.dumps(d_missing)

        # 2. Fresh heartbeat -> healthy
        now = time.time()
        with session_factory() as session:
            session.add(
                RuntimeState(
                    key=HEARTBEAT_STATE_KEY,
                    value={
                        "status": "processing",
                        "last_heartbeat_at": now - 5.0,
                        "ffmpeg_available": True,
                        "ffprobe_available": True,
                        "has_active_job": True,
                    },
                    updated_at=now - 5.0,
                )
            )
            session.add(
                RuntimeState(
                    key=FILE_WORKER_HEARTBEAT_KEY,
                    value={
                        "status": "idle",
                        "last_heartbeat_at": now - 3.0,
                    },
                    updated_at=now - 3.0,
                )
            )
            session.commit()

        res_fresh = client.get("/api/health")
        assert res_fresh.status_code == 200
        d_fresh = res_fresh.json()
        assert d_fresh["video_worker"]["status"] == "healthy"
        assert d_fresh["video_worker"]["fresh"] is True
        assert d_fresh["video_worker"]["worker_status"] == "processing"
        assert d_fresh["video_worker"]["has_active_job"] is True
        assert d_fresh["file_worker"]["status"] == "healthy"
        assert d_fresh["file_worker"]["fresh"] is True
        assert isinstance(d_fresh["file_worker"]["heartbeat_age_seconds"], (int, float))
        assert d_fresh["file_worker"]["heartbeat_age_seconds"] < 60.0
        assert "/opt/internal-bin" not in json.dumps(d_fresh)

        # 3. Stale heartbeat + binary absen -> stale & False
        monkeypatch.setattr("app.api.health.detect_ffmpeg_binaries", lambda: (None, None))
        with session_factory() as session:
            row = session.get(RuntimeState, HEARTBEAT_STATE_KEY)
            assert row is not None
            row.value = {
                "status": "idle",
                "last_heartbeat_at": now - 180.0,
                "ffmpeg_available": False,
                "ffprobe_available": False,
                "has_active_job": False,
            }
            row.updated_at = now - 180.0
            session.commit()

        res_stale = client.get("/api/health")
        assert res_stale.status_code == 200
        d_stale = res_stale.json()
        assert d_stale["ffmpeg_available"] is False
        assert d_stale["ffprobe_available"] is False
        assert d_stale["video_worker"]["status"] == "stale"
        assert d_stale["video_worker"]["fresh"] is False
    finally:
        set_health_engine_override(None)
        engine.dispose()
