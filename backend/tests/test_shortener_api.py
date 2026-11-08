from fastapi.testclient import TestClient

from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
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


def test_shortener_create_valid_url_with_custom_slug(tmp_path, monkeypatch):
    """Memverifikasi pembuatan tautan valid dengan slug kustom."""
    test_db = tmp_path / "shortener_test.db"
    from app.core.config import settings

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


def test_shortener_create_valid_url_with_random_slug(tmp_path, monkeypatch):
    """Memverifikasi pembuatan tautan valid dengan auto random slug."""
    test_db = tmp_path / "shortener_test_random.db"
    from app.core.config import settings

    monkeypatch.setattr(settings, "SHORTENER_FALLBACK_DB_PATH", test_db)

    payload = {
        "destination_url": "https://docs.cloudflare.com/workers",
    }
    response = client.post("/api/shortener/create", json=payload, headers=auth_headers())
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["slug"]) == 6
