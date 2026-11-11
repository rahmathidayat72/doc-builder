from __future__ import annotations

import time
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import SESSION_COOKIE_NAME
from app.main import app
from app.services.auth_service import auth_service
from app.services.brevo import brevo_service

client = TestClient(app, base_url="http://localhost:8000")


def test_verify_email_and_single_use_token() -> None:
    """Verifikasi email sukses dengan token valid dan gagal jika token digunakan ulang."""
    email = f"verify_{int(time.time())}@example.com"
    pwd = "VerifyPassword123"
    name = "Tester Verifikasi"

    # 1. Registrasi
    reg_res = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": name},
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    token = reg_data["user"].get("debug_verification_token")
    assert token is not None, "debug_verification_token harus ada di mode non-produksi"

    # Status awal: belum terverifikasi
    user_before = auth_service.repo.get_user_by_email(email)
    assert user_before is not None
    assert user_before.email_verified is False

    # 2. Verifikasi email pertama kali -> sukses
    verify_res = client.post("/api/auth/verify-email", json={"token": token})
    assert verify_res.status_code == 200
    assert verify_res.json()["success"] is True
    assert verify_res.json()["user"]["email_verified"] is True

    user_after = auth_service.repo.get_user_by_email(email)
    assert user_after is not None
    assert user_after.email_verified is True

    # 3. Verifikasi ulang dengan token yang sama -> gagal (single-use)
    verify_again = client.post("/api/auth/verify-email", json={"token": token})
    assert verify_again.status_code == 400


def test_resend_verification_flow() -> None:
    """Kirim ulang email verifikasi menerbitkan token baru dan bekerja valid."""
    email = f"resend_{int(time.time())}@example.com"
    pwd = "ResendPassword123"
    client.post("/api/auth/register", json={"email": email, "password": pwd, "name": "Resend Tester"})

    # Minta token verifikasi baru
    resend_res = client.post("/api/auth/resend-verification", json={"email": email})
    assert resend_res.status_code == 200
    resend_data = resend_res.json()
    assert resend_data["success"] is True
    new_token = resend_data.get("debug_verification_token")
    assert new_token is not None

    # Verifikasi dengan token baru
    v_res = client.post("/api/auth/verify-email", json={"token": new_token})
    assert v_res.status_code == 200
    assert v_res.json()["user"]["email_verified"] is True


def test_bootstrap_in_production_does_not_set_session_cookie() -> None:
    """Pada mode produksi, endpoint /api/auth/bootstrap tidak menyetel session cookie guest."""
    orig_prod = settings.IS_PRODUCTION
    try:
        settings.IS_PRODUCTION = True
        res = client.post(
            "/api/auth/bootstrap",
            json={},
            headers={"Origin": "http://localhost:5173"},
        )
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert "csrf_token" in res.json()
        assert SESSION_COOKIE_NAME not in res.cookies
    finally:
        settings.IS_PRODUCTION = orig_prod


def test_reset_password_invalidates_all_active_sessions() -> None:
    """Reset kata sandi mencabut seluruh sesi aktif milik akun terkait."""
    email = f"reset_{int(time.time())}@example.com"
    pwd = "OldPassword123"
    reg_res = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": "Reset Tester"},
    )
    assert reg_res.status_code == 200
    session_cookie = reg_res.cookies.get(SESSION_COOKIE_NAME)
    assert session_cookie is not None

    # Minta reset token
    forgot_res = client.post("/api/auth/forgot-password", json={"email": email})
    assert forgot_res.status_code == 200
    reset_token = forgot_res.json().get("debug_reset_token")
    assert reset_token is not None

    # Reset kata sandi
    new_pwd = "BrandNewPassword456"
    reset_res = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "new_password": new_pwd},
    )
    assert reset_res.status_code == 200

    # Sesi lama harus ditolak 401 setelah reset
    me_res = client.get("/api/auth/me", cookies={SESSION_COOKIE_NAME: session_cookie})
    assert me_res.status_code == 401


def test_brevo_service_simulated_when_no_api_key() -> None:
    """Brevo service berjalan mulus dalam mode simulasi saat API key tidak disetel."""
    orig_key = settings.BREVO_API_KEY
    try:
        settings.BREVO_API_KEY = None
        ok_v = brevo_service.send_verification_email(
            "user@example.com", "Test", "token123", "https://satukit.id"
        )
        assert ok_v is True

        ok_p = brevo_service.send_password_reset_email(
            "user@example.com", "Test", "token123", "https://satukit.id"
        )
        assert ok_p is True

        ok_r = brevo_service.send_draft_retention_warning_email(
            "user@example.com", "Test", 7, "https://satukit.id"
        )
        assert ok_r is True
    finally:
        settings.BREVO_API_KEY = orig_key


def test_auth_rate_limiting_triggers_429() -> None:
    """Rate limiter aktif dan mengembalikan HTTP 429 jika melebihi batas request per window."""
    from app.core.rate_limiter import rate_limiter

    test_ip = "192.168.100.99"
    key = f"test_abuse:{test_ip}"

    # Kuota 3 per 60 detik
    assert rate_limiter.check(key, max_requests=3, window_seconds=60) is True
    assert rate_limiter.check(key, max_requests=3, window_seconds=60) is True
    assert rate_limiter.check(key, max_requests=3, window_seconds=60) is True
    # Ke-4 harus ditolak
    assert rate_limiter.check(key, max_requests=3, window_seconds=60) is False

    with pytest.raises(Exception) as exc:
        rate_limiter.enforce(key, max_requests=3, window_seconds=60)
    assert "429" in str(exc.value) or exc.value.status_code == 429


def test_production_computing_endpoints_require_verified_account() -> None:
    """Di mode produksi, komputasi VPS server-side wajib akun terdaftar & terverifikasi email."""
    orig_prod = settings.IS_PRODUCTION
    try:
        settings.IS_PRODUCTION = True

        # 1. Permintaan anonim ke endpoint komputasi server -> 401 Unauthorized
        res_anon = client.post(
            "/api/pdf-tools/merge",
            headers={"Origin": "http://localhost:5173"},
        )
        assert res_anon.status_code == 401
        assert "Unauthorized" in res_anon.json()["error"]

        # 2. Buat akun baru (status email_verified: False)
        email = f"unverified_{int(time.time())}@example.com"
        reg = client.post(
            "/api/auth/register",
            json={"email": email, "password": "Password123!", "name": "Unverified User"},
            headers={"Origin": "http://localhost:5173"},
        )
        assert reg.status_code == 200
        session_cookie = reg.cookies.get(SESSION_COOKIE_NAME)
        csrf_token = reg.json()["csrf_token"]
        assert session_cookie is not None

        # Panggil endpoint komputasi server dengan akun belum verifikasi -> 403 Forbidden
        res_unverified = client.post(
            "/api/pdf-tools/merge",
            cookies={SESSION_COOKIE_NAME: session_cookie},
            headers={"Origin": "http://localhost:5173", "X-CSRF-Token": csrf_token},
        )
        assert res_unverified.status_code == 403
        assert "belum diverifikasi" in res_unverified.json()["error"]

        # 3. Verifikasi akun
        user = auth_service.repo.get_user_by_email(email)
        assert user is not None
        auth_service.repo.consume_email_verification_token(user.id, "dummy_hash", time.time())

        # Panggil lagi setelah verifikasi -> lolos guard autentikasi (bukan 401/403)
        res_verified = client.post(
            "/api/pdf-tools/merge",
            cookies={SESSION_COOKIE_NAME: session_cookie},
            headers={"Origin": "http://localhost:5173", "X-CSRF-Token": csrf_token},
        )
        assert res_verified.status_code not in (401, 403)
    finally:
        settings.IS_PRODUCTION = orig_prod
