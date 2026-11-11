from __future__ import annotations

import re
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


def make_login_payload(email: str, password: str, wrong_challenge: bool = False) -> dict:
    """Helper membuat payload login yang memuat token dan jawaban tantangan bot matematika SD."""
    ch = client.post("/api/auth/challenge").json()
    token = ch["challenge_token"]
    question = ch["question"]
    nums = [int(n) for n in re.findall(r"\d+", question)]
    ans = (
        (nums[0] - nums[1])
        if ("-" in question or "dikurangi" in question)
        else (nums[0] + nums[1])
    )
    if wrong_challenge:
        ans = ans + 1 if ans < 20 else ans - 1
    return {
        "email": email,
        "password": password,
        "challenge_token": token,
        "challenge_answer": ans,
    }


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

    # 5. Login ulang dengan bot challenge valid
    login_res = client.post(
        "/api/auth/login",
        json=make_login_payload(email, password),
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["success"] is True
    assert login_data["user"]["email"] == email


def test_google_auth_and_linking_endpoints_are_disabled():
    """Memverifikasi seluruh endpoint Google auth publik dan linking dinonaktifkan."""
    # 1. Pastikan route tidak terdaftar di FastAPI router
    route_paths = [r.path for r in app.routes if hasattr(r, "path")]
    assert "/api/auth/google" not in route_paths
    assert "/api/auth/link-google" not in route_paths
    assert "/api/auth/unlink-google" not in route_paths

    # 2. /api/auth/google dinonaktifkan (HTTP 401 diblokir middleware / 404 / 405)
    res_login = client.post(
        "/api/auth/google",
        json={
            "provider_user_id": "google-sub-123",
            "email": "disabled@example.com",
            "name": "Disabled Google",
        },
    )
    assert res_login.status_code in (401, 404, 405)

    # 3. /api/auth/link-google dinonaktifkan
    res_link = client.post(
        "/api/auth/link-google",
        json={
            "provider_user_id": "google-sub-123",
            "email": "disabled@example.com",
        },
    )
    assert res_link.status_code in (401, 404, 405)

    # 4. /api/auth/unlink-google dinonaktifkan
    res_unlink = client.post("/api/auth/unlink-google")
    assert res_unlink.status_code in (401, 404, 405)


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
    fail_login = client.post(
        "/api/auth/login",
        json=make_login_payload(email, old_pw),
    )
    assert fail_login.status_code == 401

    # 4. Login dengan password baru sukses
    succ_login = client.post(
        "/api/auth/login",
        json=make_login_payload(email, new_pw),
    )
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
    login_res = client.post(
        "/api/auth/login",
        json=make_login_payload(email, new_pw),
    )
    assert login_res.status_code == 200


def test_login_requires_valid_bot_challenge():
    """Memverifikasi login menolak jika tantangan bot salah atau tidak disertakan."""
    email = "challenge_guard@example.com"
    pw = "ChallengePassword123"
    client.post(
        "/api/auth/register",
        json={"email": email, "password": pw, "name": "Challenge Guard User"},
    )

    # 1. Login tanpa bot challenge -> 422 Unprocessable Entity
    no_ch = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert no_ch.status_code == 422

    # 2. Login dengan jawaban bot challenge salah -> 400 Bad Request
    wrong_payload = make_login_payload(email, pw, wrong_challenge=True)
    wrong_ch = client.post("/api/auth/login", json=wrong_payload)
    assert wrong_ch.status_code == 400
    assert "Jawaban soal anti-bot salah" in wrong_ch.json()["detail"]

    # 3. Login dengan jawaban bot challenge benar -> 200 OK
    valid_payload = make_login_payload(email, pw, wrong_challenge=False)
    succ = client.post("/api/auth/login", json=valid_payload)
    assert succ.status_code == 200


def test_two_step_login_flow_credentials_first_then_math():
    """Memverifikasi alur login dua tahap: cek kredensial dulu, baru muncul soal anti-bot."""
    email = "twostep@example.com"
    pw = "TwoStepPass123"
    client.post(
        "/api/auth/register",
        json={"email": email, "password": pw, "name": "TwoStep User"},
    )

    # 1. Step 1 dengan kata sandi salah -> 401, soal TIDAK muncul
    fail_init = client.post(
        "/api/auth/login-init",
        json={"email": email, "password": "WrongPassword999"},
    )
    assert fail_init.status_code == 401
    assert "tidak valid" in fail_init.json()["detail"].lower()

    # 2. Step 1 dengan kata sandi benar -> 200, mengembalikan challenge token terikat user
    ok_init = client.post(
        "/api/auth/login-init",
        json={"email": email, "password": pw},
    )
    assert ok_init.status_code == 200
    init_data = ok_init.json()
    assert init_data["step"] == "challenge_required"
    token = init_data["challenge_token"]
    question = init_data["question"]
    assert init_data["email"] == email
    assert "user_id" in init_data

    # 3. Refresh challenge soal jika pengguna meminta
    ref_res = client.post(
        "/api/auth/login-challenge-refresh",
        json={"challenge_token": token},
    )
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    assert "challenge_token" in ref_data
    assert "question" in ref_data
    token = ref_data["challenge_token"]
    question = ref_data["question"]

    # 4. Step 2 dengan jawaban salah -> 400
    nums = [int(n) for n in re.findall(r"\d+", question)]
    correct_ans = (
        (nums[0] - nums[1])
        if ("-" in question or "dikurangi" in question)
        else (nums[0] + nums[1])
    )
    wrong_ans = correct_ans + 1 if correct_ans < 20 else correct_ans - 1
    fail_verify = client.post(
        "/api/auth/login-verify",
        json={"challenge_token": token, "challenge_answer": wrong_ans},
    )
    assert fail_verify.status_code == 400
    assert "Jawaban soal anti-bot salah" in fail_verify.json()["detail"]

    # 5. Step 2 dengan jawaban benar -> 200 & terbitkan sesi aktif
    ok_verify = client.post(
        "/api/auth/login-verify",
        json={"challenge_token": token, "challenge_answer": correct_ans},
    )
    assert ok_verify.status_code == 200
    verify_data = ok_verify.json()
    assert verify_data["success"] is True
    assert verify_data["user"]["email"] == email
    session_cookie = ok_verify.cookies.get(SESSION_COOKIE_NAME)
    assert session_cookie is not None

    # Verifikasi sesi dapat dipakai mengakses /api/auth/me
    me_res = client.get("/api/auth/me", cookies={SESSION_COOKIE_NAME: session_cookie})
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == email


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
