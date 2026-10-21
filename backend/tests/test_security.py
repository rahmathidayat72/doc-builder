import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import SESSION_COOKIE_NAME, session_manager
from app.main import app

client = TestClient(app)


def test_public_health_accessible_without_auth():
    """Endpoint public /api/health harus dapat diakses tanpa autentikasi."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ready"


def test_untrusted_origin_is_rejected_403():
    """Request dari Origin eksternal/berbahaya harus ditolak dengan HTTP 403."""
    headers = {"Origin": "http://malicious-website.com"}
    resp = client.get("/api/health", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["error"] == "Forbidden: Origin tidak tepercaya"


def test_protected_endpoint_without_session_returns_401():
    """Endpoint terproteksi (/api/auth/session) tanpa session cookie
    harus mengembalikan HTTP 401."""
    resp = client.get("/api/auth/session")
    assert resp.status_code == 401
    assert resp.json()["error"] == "Unauthorized: Sesi lokal tidak valid"


def test_bootstrap_with_invalid_token_returns_401():
    """Bootstrap dengan token palsu harus ditolak HTTP 401."""
    resp = client.post("/api/auth/bootstrap", json={"bootstrap_token": "invalid_token_123"})
    assert resp.status_code == 401


def test_bootstrap_from_trusted_origin_without_token_succeeds():
    """Bootstrap dari origin lokal terpercaya tanpa token harus berhasil memperoleh sesi & CSRF."""
    resp = client.post(
        "/api/auth/bootstrap",
        json={},
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert "csrf_token" in resp.json()
    assert SESSION_COOKIE_NAME in resp.cookies


def test_full_bootstrap_session_and_csrf_flow():
    """Alur lengkap: Bootstrap valid -> dapat Cookie & CSRF -> Akses terproteksi sukses."""
    # 1. Lakukan bootstrap dengan token yang valid
    bootstrap_resp = client.post(
        "/api/auth/bootstrap", json={"bootstrap_token": session_manager.bootstrap_token}
    )
    assert bootstrap_resp.status_code == 200
    data = bootstrap_resp.json()
    assert data["success"] is True
    assert "csrf_token" in data
    csrf_token = data["csrf_token"]

    # Pastikan cookie sesi diset
    assert SESSION_COOKIE_NAME in bootstrap_resp.cookies
    session_cookie = bootstrap_resp.cookies[SESSION_COOKIE_NAME]

    # 2. Akses endpoint terproteksi dengan cookie sesi
    client.cookies.set(SESSION_COOKIE_NAME, session_cookie)
    session_resp = client.get("/api/auth/session")
    assert session_resp.status_code == 200
    assert session_resp.json()["authenticated"] is True

    # 3. Akses mutasi tanpa CSRF header harus ditolak 403
    # Tambahkan route dummy sementara atau uji mutasi bootstrap (bootstrap di-exclude)
    # Mari kita uji verifikasi CSRF helper langsung
    assert session_manager.verify_csrf(csrf_token) is True
    assert session_manager.verify_csrf("wrong_csrf") is False


def test_pdf_tools_mutation_without_csrf_is_rejected_403():
    """Akses mutasi POST ke /api/pdf-tools/split tanpa CSRF harus ditolak 403."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    files = {"file": ("test.pdf", b"%PDF-1.4 sample", "application/pdf")}
    data = {"pages": "1"}
    headers = {"Origin": "http://localhost:5173"}  # origin valid, tapi CSRF absen
    resp = client.post("/api/pdf-tools/split", files=files, data=data, headers=headers)
    assert resp.status_code == 403
    assert "CSRF" in resp.json().get("error", "")


def test_image_tools_mutation_without_csrf_is_rejected_403():
    """Akses mutasi POST ke /api/image-tools/resize tanpa CSRF harus ditolak 403."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    files = {"file": ("test.jpg", b"dummy image data", "image/jpeg")}
    data = {"target_kb": "50"}
    headers = {"Origin": "http://localhost:5173"}
    resp = client.post("/api/image-tools/resize", files=files, data=data, headers=headers)
    assert resp.status_code == 403
    assert "CSRF" in resp.json().get("error", "")
