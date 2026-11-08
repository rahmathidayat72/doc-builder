from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Pastikan module app dapat di-import
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import (
    LEGACY_SESSION_COOKIE_NAME,
    SESSION_COOKIE_NAME,
)
from app.db.session import DatabaseManager
from app.main import app
from app.services.auth_service import auth_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Menyediakan basis data SQLite baru dan bersih untuk setiap pengujian API."""
    test_db = tmp_path / "test_api_auth.db"
    mgr = DatabaseManager(test_db)
    mgr.init_db()
    monkeypatch.setattr(auth_service, "db", mgr)


def test_register_login_and_me_flow():
    email = "api_user@example.com"
    password = "UserPassword123"

    # 1. Register
    reg_res = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": "API Tester"},
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["success"] is True
    assert reg_data["user"]["email"] == email
    csrf_token = reg_data["csrf_token"]
    assert len(csrf_token) >= 32

    # Ambil session cookie dari respon
    session_cookie = reg_res.cookies.get(SESSION_COOKIE_NAME)
    assert session_cookie is not None

    # 2. Get /me dengan session cookie
    me_res = client.get(
        "/api/auth/me",
        cookies={SESSION_COOKIE_NAME: session_cookie},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["authenticated"] is True
    assert me_data["mode"] == "user"
    assert me_data["user"]["email"] == email

    # 3. Logout
    logout_res = client.post(
        "/api/auth/logout",
        cookies={SESSION_COOKIE_NAME: session_cookie},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert logout_res.status_code == 200

    # 4. Akses /me setelah logout harus ditolak 401
    me_after = client.get(
        "/api/auth/me",
        cookies={SESSION_COOKIE_NAME: session_cookie},
    )
    assert me_after.status_code == 401

    # 5. Login ulang
    login_res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["success"] is True
    assert login_data["user"]["email"] == email


def test_anti_auto_merge_guard_api():
    """Memverifikasi penolakan HTTP 409 ACCOUNT_MERGE_REQUIRED saat login Google mencoba
    mengambil alih email yang telah terdaftar dengan kata sandi lokal (BRULE-013)."""
    email = "protected_merge@example.com"
    password = "SecurePassword123"

    # Registrasi via email/password
    reg = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": "Protected User"},
    )
    assert reg.status_code == 200

    # Percobaan login Google dengan email yang sama
    google_res = client.post(
        "/api/auth/google",
        json={
            "provider_user_id": "google-rogue-123",
            "email": email,
            "name": "Rogue Google User",
        },
    )
    assert google_res.status_code == 409
    assert google_res.headers.get("X-Error-Code") == "ACCOUNT_MERGE_REQUIRED"
    assert "penggabungan akun otomatis tidak diizinkan" in google_res.json()["detail"]


def test_link_google_account_and_unlink_api():
    email = "link_user@example.com"
    password = "LinkPassword123"

    reg = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": "Link User"},
    )
    session_cookie = reg.cookies.get(SESSION_COOKIE_NAME)
    csrf_token = reg.json()["csrf_token"]

    # Tautkan akun Google dengan password yang benar
    link_res = client.post(
        "/api/auth/link-google",
        json={
            "provider_user_id": "google-link-sub-456",
            "email": "link_user@gmail.com",
            "current_password": password,
        },
        cookies={SESSION_COOKIE_NAME: session_cookie},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert link_res.status_code == 200
    assert link_res.json()["success"] is True

    # Cek /me memuat akun Google di oauth_accounts
    me_res = client.get(
        "/api/auth/me",
        cookies={SESSION_COOKIE_NAME: session_cookie},
    )
    assert len(me_res.json()["oauth_accounts"]) == 1
    assert me_res.json()["oauth_accounts"][0]["provider"] == "google"

    # Putuskan tautan Google
    unlink_res = client.post(
        "/api/auth/unlink-google",
        cookies={SESSION_COOKIE_NAME: session_cookie},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert unlink_res.status_code == 200

    me_after = client.get(
        "/api/auth/me",
        cookies={SESSION_COOKIE_NAME: session_cookie},
    )
    assert len(me_after.json()["oauth_accounts"]) == 0


def test_change_password_and_csrf_protection_api():
    email = "change_pass@example.com"
    old_pw = "OldPassword123"
    new_pw = "NewPassword456"

    reg = client.post(
        "/api/auth/register",
        json={"email": email, "password": old_pw, "name": "Change User"},
    )
    session_cookie = reg.cookies.get(SESSION_COOKIE_NAME)
    csrf_token = reg.json()["csrf_token"]

    # 1. Request mutasi dengan CSRF token salah harus ditolak HTTP 403
    csrf_fail = client.post(
        "/api/auth/change-password",
        json={"old_password": old_pw, "new_password": new_pw},
        cookies={SESSION_COOKIE_NAME: session_cookie},
        headers={"X-CSRF-Token": "csrf_token_palsu"},
    )
    assert csrf_fail.status_code == 403
    assert "Token CSRF tidak valid" in csrf_fail.json()["error"]

    # 2. Request mutasi dengan CSRF benar berhasil
    change_res = client.post(
        "/api/auth/change-password",
        json={"old_password": old_pw, "new_password": new_pw},
        cookies={SESSION_COOKIE_NAME: session_cookie},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert change_res.status_code == 200
    assert change_res.json()["success"] is True

    # 3. Login dengan password lama gagal
    fail_login = client.post("/api/auth/login", json={"email": email, "password": old_pw})
    assert fail_login.status_code == 401

    # 4. Login dengan password baru sukses
    succ_login = client.post("/api/auth/login", json={"email": email, "password": new_pw})
    assert succ_login.status_code == 200


def test_forgot_and_reset_password_api():
    email = "reset_api@example.com"
    old_pw = "ResetOld123"
    new_pw = "ResetNew456"

    client.post(
        "/api/auth/register",
        json={"email": email, "password": old_pw, "name": "Reset API User"},
    )

    # Forgot password
    forgot_res = client.post(
        "/api/auth/forgot-password",
        json={"email": email},
    )
    assert forgot_res.status_code == 200
    reset_token = forgot_res.json().get("debug_reset_token")
    assert reset_token is not None

    # Reset password
    reset_res = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "new_password": new_pw},
    )
    assert reset_res.status_code == 200

    # Login dengan password baru
    login_res = client.post("/api/auth/login", json={"email": email, "password": new_pw})
    assert login_res.status_code == 200


def test_backward_compatibility_bootstrap_and_session():
    """Memastikan endpoint /api/auth/bootstrap dan mode guest tetap berfungsi normal."""
    boot_res = client.post("/api/auth/bootstrap", json={})
    assert boot_res.status_code == 200
    boot_cookie = boot_res.cookies.get(SESSION_COOKIE_NAME)
    assert boot_cookie is not None

    session_res = client.get(
        "/api/auth/session",
        cookies={SESSION_COOKIE_NAME: boot_cookie},
    )
    assert session_res.status_code == 200
    assert session_res.json()["authenticated"] is True

    # Endpoint /me dalam mode guest
    me_guest = client.get(
        "/api/auth/me",
        cookies={SESSION_COOKIE_NAME: boot_cookie},
    )
    assert me_guest.status_code == 200
    assert me_guest.json()["mode"] == "guest"


def test_dual_read_legacy_session_cookie_compatibility():
    """Memastikan cookie legacy docbuilder_session tetap valid untuk otentikasi dual-read."""
    email = "legacy_cookie_user@example.com"
    pw = "LegacyPass123"
    reg = client.post(
        "/api/auth/register",
        json={"email": email, "password": pw, "name": "Legacy Cookie User"},
    )
    assert reg.status_code == 200
    token = reg.cookies.get(SESSION_COOKIE_NAME)
    assert token is not None

    # Kirim request dengan nama cookie legacy `docbuilder_session`
    me_legacy = client.get(
        "/api/auth/me",
        cookies={LEGACY_SESSION_COOKIE_NAME: token},
    )
    assert me_legacy.status_code == 200
    assert me_legacy.json()["authenticated"] is True
    assert me_legacy.json()["user"]["email"] == email
