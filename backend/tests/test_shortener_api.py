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


def test_shortener_config():
    """Memverifikasi endpoint /api/shortener/config merespons URL layanan."""
    response = client.get("/api/shortener/config", headers=auth_headers())
    assert response.status_code == 200
    data = response.json()
    assert "base_url" in data
    assert "admin_portal_url" in data
    assert "/admin" in data["admin_portal_url"]


def test_shortener_create_rejects_non_https():
    """Memverifikasi penolakan URL non-HTTPS sesuai NFR-SEC-008."""
    response = client.post(
        "/api/shortener/create",
        json={"destination_url": "http://insecure.com/page"},
        headers=auth_headers(),
    )
    assert response.status_code == 422
    assert "HTTPS" in response.json()["detail"]


def test_shortener_create_rejects_credentials_in_url():
    """Memverifikasi penolakan kredensial pengguna di URL."""
    response = client.post(
        "/api/shortener/create",
        json={"destination_url": "https://admin:secret@example.com/api"},
        headers=auth_headers(),
    )
    assert response.status_code == 422
    assert "kredensial" in response.json()["detail"]


def test_shortener_create_rejects_localhost_and_internal_ip():
    """Memverifikasi penolakan localhost dan IP loopback/private (Anti-SSRF)."""
    blocked_urls = [
        "https://localhost/admin",
        "https://127.0.0.1:8000",
        "https://169.254.169.254/latest/meta-data/",
        "https://192.168.1.1",
        "https://10.0.0.1",
    ]
    for url in blocked_urls:
        response = client.post(
            "/api/shortener/create",
            json={"destination_url": url},
            headers=auth_headers(),
        )
        assert response.status_code == 422


def test_shortener_create_valid_url_with_custom_slug(tmp_path: Path, monkeypatch):
    """Memverifikasi pembuatan tautan valid dengan slug kustom."""
    test_db = tmp_path / "shortener_test.db"
    monkeypatch.setattr(settings, "SHORTENER_FALLBACK_DB_PATH", test_db)

    payload = {
        "destination_url": "https://porto.rahmath72.cloud/cv-2026",
        "slug": "cv-rahmat-custom",
    }
    response = client.post("/api/shortener/create", json=payload, headers=auth_headers())
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["slug"] == "cv-rahmat-custom"
    assert "short_url" in data

    # Duplikasi slug harus ditolak 409
    dup_res = client.post("/api/shortener/create", json=payload, headers=auth_headers())
    assert dup_res.status_code == 409


def test_shortener_create_valid_url_with_random_slug(tmp_path: Path, monkeypatch):
    """Memverifikasi pembuatan tautan valid dengan auto random slug."""
    test_db = tmp_path / "shortener_test_random.db"
    monkeypatch.setattr(settings, "SHORTENER_FALLBACK_DB_PATH", test_db)

    payload = {
        "destination_url": "https://docs.cloudflare.com/workers",
    }
    response = client.post("/api/shortener/create", json=payload, headers=auth_headers())
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["slug"]) == 6


def test_shortener_local_redirect_success_and_atomic_counter(tmp_path: Path, monkeypatch):
    """Memverifikasi HTTP 302 Redirect lokal dan kenaikan atomik click_count."""
    test_db = tmp_path / "shortener_redirect.db"
    monkeypatch.setattr(settings, "SHORTENER_FALLBACK_DB_PATH", test_db)

    # 1. Buat tautan
    dest_url = "https://example.com/target-redirect-page"
    create_res = client.post(
        "/api/shortener/create",
        json={"destination_url": dest_url, "slug": "test-redirect"},
        headers=auth_headers(),
    )
    assert create_res.status_code == 200

    # 2. Redirect GET /s/test-redirect (Follow redirects disabled untuk cek 302)
    redirect_res = client.get("/s/test-redirect", follow_redirects=False)
    assert redirect_res.status_code == 302
    assert redirect_res.headers["location"] == dest_url

    # 3. Klik kedua via /api/s/test-redirect
    redirect_api_res = client.get("/api/s/test-redirect", follow_redirects=False)
    assert redirect_api_res.status_code == 302
    assert redirect_api_res.headers["location"] == dest_url

    # 4. Verifikasi click_count tercatat 2 kali
    repo = ShortenerRepository.from_db_path(test_db)
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

    # Mencoba buat kembali dengan slug yang sama harus ditolak 409
    recreate_res = client.post(
        "/api/shortener/create",
        json={"destination_url": "https://example.com/new-dest", "slug": "slug-dicabut"},
        headers=auth_headers(),
    )
    assert recreate_res.status_code == 409
    assert "dilarang digunakan kembali" in recreate_res.json()["detail"]


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
