from __future__ import annotations

import time
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.core.config import settings
from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.db.repositories.shortener_repository import ShortenerRepository
from app.main import app

client = TestClient(app)


def auth_headers() -> dict[str, str]:
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    return {
        CSRF_HEADER_NAME: session_manager.csrf_token,
        "Origin": "http://localhost:5173",
    }


def test_shortener_management_endpoints_are_disabled():
    """Memverifikasi endpoint konfigurasi dan pembuatan short link diblokir."""
    # 1. Pastikan route management tidak terdaftar di FastAPI router
    route_paths = [r.path for r in app.routes if hasattr(r, "path")]
    assert "/api/shortener/config" not in route_paths
    assert "/api/shortener/create" not in route_paths

    # 2. GET /api/shortener/config dinonaktifkan (HTTP 404/405)
    cfg_res = client.get("/api/shortener/config", headers=auth_headers())
    assert cfg_res.status_code in (404, 405)

    # 3. POST /api/shortener/create dinonaktifkan (HTTP 404/405)
    payload = {"destination_url": "https://example.com/target", "slug": "test-slug"}
    create_res = client.post("/api/shortener/create", json=payload, headers=auth_headers())
    assert create_res.status_code in (404, 405)


def test_shortener_local_redirect_success_and_atomic_counter(tmp_path: Path, monkeypatch):
    """Memverifikasi HTTP 302 Redirect lokal dan kenaikan atomik click_count."""
    test_db = tmp_path / "shortener_redirect.db"
    monkeypatch.setattr(settings, "SHORTENER_FALLBACK_DB_PATH", test_db)

    # 1. Seed tautan langsung ke repository
    dest_url = "https://example.com/target-redirect-page"
    repo = ShortenerRepository.from_db_path(test_db)
    repo.create(slug="test-redirect", destination_url=dest_url)

    # 2. Redirect GET /s/test-redirect (Follow redirects disabled untuk cek 302)
    redirect_res = client.get("/s/test-redirect", follow_redirects=False)
    assert redirect_res.status_code == 302
    assert redirect_res.headers["location"] == dest_url

    # 3. Klik kedua via /api/s/test-redirect
    redirect_api_res = client.get("/api/s/test-redirect", follow_redirects=False)
    assert redirect_api_res.status_code == 302
    assert redirect_api_res.headers["location"] == dest_url

    # 4. Verifikasi click_count tercatat 2 kali
    record = repo.get_by_slug("test-redirect")
    assert record is not None
    assert record["click_count"] == 2
    assert record["last_accessed_at"] is not None


def test_shortener_local_redirect_not_found_returns_404(tmp_path: Path, monkeypatch):
    """Memverifikasi penanganan slug yang tidak terdaftar menghasilkan HTTP 404."""
    test_db = tmp_path / "shortener_404.db"
    monkeypatch.setattr(settings, "SHORTENER_FALLBACK_DB_PATH", test_db)

    response = client.get("/s/slug-tidak-ada", follow_redirects=False)
    assert response.status_code == 404
    assert "tidak ditemukan" in response.json()["detail"]


def test_shortener_local_redirect_revoked_returns_410(tmp_path: Path, monkeypatch):
    """Memverifikasi penanganan slug yang telah dicabut (revoked) menghasilkan HTTP 410."""
    test_db = tmp_path / "shortener_410.db"
    monkeypatch.setattr(settings, "SHORTENER_FALLBACK_DB_PATH", test_db)

    # Buat tautan
    repo = ShortenerRepository.from_db_path(test_db)
    repo.create(slug="slug-dicabut", destination_url="https://example.com/revoked-target")

    # Cabut tautan
    revoked = repo.revoke("slug-dicabut", now=time.time())
    assert revoked is True

    # Panggilan redirect harus menghasilkan 410 Gone
    response = client.get("/s/slug-dicabut", follow_redirects=False)
    assert response.status_code == 410
    assert "dicabut" in response.json()["detail"]


def test_shortener_repository_engine_lifecycle(tmp_path: Path):
    """Pengujian langsung repository dengan SQLAlchemy engine."""
    db_file = tmp_path / "shortener_engine.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    repo = ShortenerRepository.from_engine(engine)

    # 1. Create
    created = repo.create(slug="slug-lifecycle", destination_url="https://satukit.local")
    assert created["slug"] == "slug-lifecycle"
    assert created["status"] == "active"

    # 2. Record Click
    now = time.time()
    dest, st = repo.record_click("slug-lifecycle", now=now)
    assert dest == "https://satukit.local"
    assert st == "active"

    # 3. Revoke
    assert repo.revoke("slug-lifecycle") is True
    assert repo.get_by_slug("slug-lifecycle")["status"] == "revoked"

    engine.dispose()
