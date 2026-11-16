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


def test_google_oidc_start_and_callback_flow(monkeypatch: pytest.MonkeyPatch):
    """Menguji alur lengkap Google OIDC start dan callback login/register."""
    from urllib.parse import parse_qs, urlparse

    from app.core.config import settings
    from app.services.google_oidc import google_oidc_service

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "mock-client-secret")

    # 1. Start flow: redirect ke accounts.google.com dengan parameter PKCE
    start_res = client.get("/api/auth/google/start", follow_redirects=False)
    assert start_res.status_code == 303
    loc = start_res.headers["location"]
    assert "accounts.google.com" in loc
    tx_cookie = start_res.cookies.get(settings.GOOGLE_OAUTH_COOKIE_NAME)
    assert tx_cookie is not None

    parsed_url = urlparse(loc)
    qs = parse_qs(parsed_url.query)
    assert "state" in qs
    assert "code_challenge" in qs
    assert qs["prompt"] == ["select_account"]
    state = qs["state"][0]

    # Mock exchange & token verification
    def mock_exchange(*args, **kwargs):
        return {"id_token": "mock.jwt.token"}

    def mock_verify(*args, **kwargs):
        return {
            "sub": "google-sub-9999",
            "email": "newgoogleuser@example.com",
            "name": "New Google User",
            "avatar_url": "https://lh3.googleusercontent.com/a/mock-pic",
        }

    monkeypatch.setattr(google_oidc_service, "exchange_code_for_tokens", mock_exchange)
    monkeypatch.setattr(google_oidc_service, "verify_id_token", mock_verify)

    # 2. Callback dengan error / cancelled dari Google
    cb_err = client.get(
        "/api/auth/google/callback",
        params={"error": "access_denied"},
        cookies={settings.GOOGLE_OAUTH_COOKIE_NAME: tx_cookie},
        follow_redirects=False,
    )
    assert cb_err.status_code == 303
    assert "auth_status=google_cancelled" in cb_err.headers["location"]

    # 3. Callback dengan sukses
    cb_succ = client.get(
        "/api/auth/google/callback",
        params={"code": "valid-auth-code", "state": state},
        cookies={settings.GOOGLE_OAUTH_COOKIE_NAME: tx_cookie},
        follow_redirects=False,
    )
    assert cb_succ.status_code == 303
    assert "auth_status=google_login_success" in cb_succ.headers["location"]
    new_sess = cb_succ.cookies.get(SESSION_COOKIE_NAME)
    assert new_sess is not None

    # Verifikasi profil user yang baru terdaftar melalui Google
    me_res = client.get("/api/auth/me", cookies={SESSION_COOKIE_NAME: new_sess})
    assert me_res.status_code == 200
    user_info = me_res.json()["user"]
    assert user_info["email"] == "newgoogleuser@example.com"
    assert user_info["avatar_url"] == "https://lh3.googleusercontent.com/a/mock-pic"
    assert len(me_res.json()["oauth_accounts"]) == 1


def test_google_oidc_anti_auto_merge(monkeypatch: pytest.MonkeyPatch):
    """Menguji penolakan auto-merge jika email telah memiliki password lokal (BRULE-013)."""
    from urllib.parse import parse_qs, urlparse

    from app.core.config import settings
    from app.services.google_oidc import google_oidc_service

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "mock-client-secret")

    # Daftarkan akun lokal dengan password
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "existing@example.com",
            "password": "LocalPassword123",
            "name": "Local User",
        },
    )
    assert reg.status_code == 200

    # Start Google OAuth
    start_res = client.get("/api/auth/google/start", follow_redirects=False)
    tx_cookie = start_res.cookies.get(settings.GOOGLE_OAUTH_COOKIE_NAME)
    state = parse_qs(urlparse(start_res.headers["location"]).query)["state"][0]

    # Mock Google mengembalikan email yang sama persis
    monkeypatch.setattr(
        google_oidc_service,
        "exchange_code_for_tokens",
        lambda *a, **k: {"id_token": "mock"},
    )
    monkeypatch.setattr(
        google_oidc_service,
        "verify_id_token",
        lambda *a, **k: {
            "sub": "google-sub-collide",
            "email": "existing@example.com",
            "name": "Collide",
            "avatar_url": None,
        },
    )

    cb = client.get(
        "/api/auth/google/callback",
        params={"code": "code", "state": state},
        cookies={settings.GOOGLE_OAUTH_COOKIE_NAME: tx_cookie},
        follow_redirects=False,
    )
    assert cb.status_code == 303
    assert "auth_status=account_merge_required" in cb.headers["location"]


def test_google_link_and_unlink_api_flow(monkeypatch: pytest.MonkeyPatch):
    """Menguji endpoint start link dan unlink dengan verifikasi password sadar."""
    from urllib.parse import parse_qs, urlparse

    from app.core.config import settings
    from app.services.google_oidc import google_oidc_service

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "mock-client-secret")

    # Register user lokal
    reg = client.post(
        "/api/auth/register",
        json={"email": "linker@example.com", "password": "LinkerPassword123", "name": "Linker"},
    )
    sess = reg.cookies.get(SESSION_COOKIE_NAME)
    csrf = reg.json()["csrf_token"]

    # 1. Start link dengan password salah -> 400
    fail_start = client.post(
        "/api/auth/google/link/start",
        json={"current_password": "WrongPassword"},
        cookies={SESSION_COOKIE_NAME: sess},
        headers={"X-CSRF-Token": csrf},
    )
    assert fail_start.status_code == 400

    # 2. Start link dengan password benar -> 200 dengan auth_url
    succ_start = client.post(
        "/api/auth/google/link/start",
        json={"current_password": "LinkerPassword123"},
        cookies={SESSION_COOKIE_NAME: sess},
        headers={"X-CSRF-Token": csrf},
    )
    assert succ_start.status_code == 200
    auth_url = succ_start.json()["auth_url"]
    tx_cookie = succ_start.cookies.get(settings.GOOGLE_OAUTH_COOKIE_NAME)
    state = parse_qs(urlparse(auth_url).query)["state"][0]

    # Mock Google token
    monkeypatch.setattr(
        google_oidc_service,
        "exchange_code_for_tokens",
        lambda *a, **k: {"id_token": "mock"},
    )
    monkeypatch.setattr(
        google_oidc_service,
        "verify_id_token",
        lambda *a, **k: {
            "sub": "google-linker-sub",
            "email": "linker@example.com",
            "name": "Linker",
            "avatar_url": "https://lh3.googleusercontent.com/a/linker-avatar",
        },
    )

    # Callback link intent
    cb = client.get(
        "/api/auth/google/callback",
        params={"code": "code", "state": state},
        cookies={
            SESSION_COOKIE_NAME: sess,
            settings.GOOGLE_OAUTH_COOKIE_NAME: tx_cookie,
        },
        follow_redirects=False,
    )
    assert cb.status_code == 303
    assert "auth_status=google_link_success" in cb.headers["location"]

    # Verifikasi Google tertaut
    me = client.get("/api/auth/me", cookies={SESSION_COOKIE_NAME: sess})
    assert len(me.json()["oauth_accounts"]) == 1
    assert me.json()["user"]["avatar_url"] == "https://lh3.googleusercontent.com/a/linker-avatar"

    # 3. Unlink dengan password salah -> 400
    fail_unlink = client.post(
        "/api/auth/google/unlink",
        json={"current_password": "WrongPassword"},
        cookies={SESSION_COOKIE_NAME: sess},
        headers={"X-CSRF-Token": csrf},
    )
    assert fail_unlink.status_code == 400

    # 4. Unlink dengan password benar -> 200
    succ_unlink = client.post(
        "/api/auth/google/unlink",
        json={"current_password": "LinkerPassword123"},
        cookies={SESSION_COOKIE_NAME: sess},
        headers={"X-CSRF-Token": csrf},
    )
    assert succ_unlink.status_code == 200

    # Verifikasi Google terputus dan avatar google dibersihkan
    me_after = client.get("/api/auth/me", cookies={SESSION_COOKIE_NAME: sess})
    assert len(me_after.json()["oauth_accounts"]) == 0
    assert me_after.json()["user"]["avatar_url"] is None


def test_google_oidc_handles_unconfigured_credentials(monkeypatch: pytest.MonkeyPatch):
    """Menguji graceful redirect dan HTTP 503 jika Google Client ID belum dikonfigurasi."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", None)
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", None)

    # 1. Start flow mengalihkan ke /#/login?auth_status=google_not_configured (bukan 500)
    res = client.get("/api/auth/google/start", follow_redirects=False)
    assert res.status_code == 303
    assert "auth_status=google_not_configured" in res.headers["location"]

    # 2. Link start dengan user terautentikasi menghasilkan 503 dengan detail yang jelas
    reg = client.post(
        "/api/auth/register",
        json={"email": "unconfig@example.com", "password": "Password123", "name": "Unconfig"},
    )
    sess = reg.cookies.get(SESSION_COOKIE_NAME)
    csrf = reg.json()["csrf_token"]

    link_res = client.post(
        "/api/auth/google/link/start",
        json={"current_password": "Password123"},
        cookies={SESSION_COOKIE_NAME: sess},
        headers={"X-CSRF-Token": csrf},
    )
    assert link_res.status_code == 503
    assert "Layanan autentikasi Google belum dikonfigurasi" in link_res.json()["detail"]


def test_google_oidc_resolves_host_header_in_dev(monkeypatch: pytest.MonkeyPatch):
    """Menguji bahwa di development mode, redirect_uri menyesuaikan host header jika 127.0.0.1:8000."""
    from urllib.parse import parse_qs, urlparse

    from app.core.config import settings

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "mock-client-secret")
    monkeypatch.setattr(settings, "IS_PRODUCTION", False)

    res = client.get(
        "/api/auth/google/start", headers={"host": "127.0.0.1:8000"}, follow_redirects=False
    )
    assert res.status_code == 303
    loc = res.headers["location"]
    qs = parse_qs(urlparse(loc).query)
    assert qs["redirect_uri"] == ["http://127.0.0.1:8000/api/auth/google/callback"]
