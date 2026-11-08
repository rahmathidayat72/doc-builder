from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.core.security import (
    hash_password,
    verify_password,
)
from app.db.session import DatabaseManager
from app.services.auth_service import (
    AccountMergeRequiredError,
    AuthService,
    InvalidCredentialsError,
    InvalidTokenError,
    UserAlreadyExistsError,
)


@pytest.fixture
def auth_svc(tmp_path: Path) -> AuthService:
    """Membuat instance AuthService terisolasi dengan basis data SQLite baru."""
    db_file = tmp_path / "test_auth.db"
    mgr = DatabaseManager(db_file)
    mgr.init_db()
    return AuthService(database_manager=mgr)


def test_argon2id_hashing_and_verification():
    raw_pass = "RahasiaKu123"
    hashed = hash_password(raw_pass)

    assert hashed.startswith("$argon2id$")
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("SalahPassword", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password(raw_pass, None) is False


def test_register_user_success_and_duplicate_rejection(auth_svc: AuthService):
    user, verification_token = auth_svc.register_user(
        email="User.Test@example.com",
        password="Password123",
        name="Budi Santoso",
    )

    assert user.email == "user.test@example.com"
    assert user.name == "Budi Santoso"
    assert user.has_password is True
    assert user.email_verified is False
    assert len(verification_token) >= 32

    # Duplikasi dengan variasi huruf besar/kecil harus ditolak
    with pytest.raises(UserAlreadyExistsError, match="sudah terdaftar"):
        auth_svc.register_user(
            email="USER.TEST@EXAMPLE.COM",
            password="OtherPassword123",
            name="Peniru",
        )


def test_password_strength_and_email_validation(auth_svc: AuthService):
    # Kurang dari 8 karakter
    with pytest.raises(HTTPException, match="minimal 8 karakter"):
        auth_svc.register_user("a@b.com", "pass1", "Name")

    # Tanpa angka
    with pytest.raises(HTTPException, match="kombinasi huruf dan angka"):
        auth_svc.register_user("a@b.com", "passwordpanjang", "Name")

    # Format email rusak
    with pytest.raises(HTTPException, match="Format alamat email tidak valid"):
        auth_svc.register_user("bukan-email", "Password123", "Name")


def test_authenticate_user_success_and_invalid_credentials(auth_svc: AuthService):
    auth_svc.register_user("login@example.com", "Password123", "Login User")

    # Sukses
    user = auth_svc.authenticate_user("LOGIN@example.com", "Password123")
    assert user.email == "login@example.com"

    # Password salah
    with pytest.raises(InvalidCredentialsError):
        auth_svc.authenticate_user("login@example.com", "Salah12345")

    # User tidak ada
    with pytest.raises(InvalidCredentialsError):
        auth_svc.authenticate_user("tidak-ada@example.com", "Password123")


def test_anti_auto_merge_guard_brule_013(auth_svc: AuthService):
    """Pengguna mendaftar dengan email & password. Penyerang mencoba masuk via Google OAuth
    dengan email yang sama. Sistem WAJIB menolak auto-merge (AccountMergeRequiredError)."""
    auth_svc.register_user("target@example.com", "PasswordTarget123", "Target User")

    with pytest.raises(AccountMergeRequiredError) as exc_info:
        auth_svc.authenticate_or_register_google(
            provider_user_id="google-attacker-9999",
            email="target@example.com",
            name="Attacker Google",
            email_verified=True,
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.headers.get("X-Error-Code") == "ACCOUNT_MERGE_REQUIRED"
    assert "penggabungan akun otomatis tidak diizinkan" in exc_info.value.detail


def test_google_oauth_new_user_and_idempotent_login(auth_svc: AuthService):
    # 1. Pendaftaran baru via Google
    user1 = auth_svc.authenticate_or_register_google(
        provider_user_id="google-sub-1111",
        email="google.user@example.com",
        name="Google Newbie",
        email_verified=True,
    )
    assert user1.email == "google.user@example.com"
    assert user1.has_password is False
    assert user1.email_verified is True

    # 2. Login kembali dengan provider_user_id yang sama
    user2 = auth_svc.authenticate_or_register_google(
        provider_user_id="google-sub-1111",
        email="google.user@example.com",
        name="Google Newbie Updated",
        email_verified=True,
    )
    assert user2.id == user1.id


def test_link_google_account_requires_reauth_and_prevents_conflict(auth_svc: AuthService):
    user, _ = auth_svc.register_user("alice@example.com", "PasswordAlice123", "Alice")

    # Gagal jika password saat ini salah
    with pytest.raises(HTTPException, match="kata sandi saat ini tidak valid"):
        auth_svc.link_google_account(
            user_id=user.id,
            provider_user_id="google-alice-123",
            email="alice@gmail.com",
            current_password="SalahPassword123",
        )

    # Sukses dengan password benar
    auth_svc.link_google_account(
        user_id=user.id,
        provider_user_id="google-alice-123",
        email="alice@gmail.com",
        current_password="PasswordAlice123",
    )

    # Verifikasi akun Google sekarang dapat digunakan login langsung
    logged_in = auth_svc.authenticate_or_register_google(
        provider_user_id="google-alice-123",
        email="alice@gmail.com",
        name="Alice Google",
    )
    assert logged_in.id == user.id

    # User lain mencoba menautkan akun Google yang sama -> ditolak 409
    user_bob, _ = auth_svc.register_user("bob@example.com", "PasswordBob123", "Bob")
    with pytest.raises(HTTPException, match="telah ditautkan ke akun Satukit lainnya"):
        auth_svc.link_google_account(
            user_id=user_bob.id,
            provider_user_id="google-alice-123",
            email="bob@gmail.com",
            current_password="PasswordBob123",
        )


def test_unlink_google_account(auth_svc: AuthService):
    # User murni Google tanpa password tidak boleh memutuskan tautan
    g_user = auth_svc.authenticate_or_register_google(
        provider_user_id="google-only-user",
        email="guser@example.com",
        name="Google Only",
    )
    with pytest.raises(HTTPException, match="belum membuat kata sandi"):
        auth_svc.unlink_google_account(g_user.id)

    # Beri password ke user, lalu unlink
    auth_svc.change_password(g_user.id, old_password="", new_password="NewPassword123")
    auth_svc.unlink_google_account(g_user.id)
    assert len(auth_svc.get_oauth_accounts_for_user(g_user.id)) == 0


def test_session_lifecycle_and_expiry(auth_svc: AuthService):
    user, _ = auth_svc.register_user("session@example.com", "Password123", "Session User")

    # 1. Create session
    raw_token, csrf_token, expires_at = auth_svc.create_session(
        user_id=user.id, ip_address="127.0.0.1", user_agent="Pytest-Client"
    )
    assert len(raw_token) >= 32
    assert len(csrf_token) >= 32
    assert expires_at > time.time()

    # 2. Validate session
    val = auth_svc.validate_session(raw_token)
    assert val is not None
    validated_user, validated_csrf = val
    assert validated_user.id == user.id
    assert validated_csrf == csrf_token

    # 3. Token palsu/kosong
    assert auth_svc.validate_session("bukan_token_sah") is None
    assert auth_svc.validate_session("") is None

    # 4. Revoke session
    auth_svc.revoke_session(raw_token)
    assert auth_svc.validate_session(raw_token) is None


def test_password_reset_flow_and_single_use(auth_svc: AuthService):
    user, _ = auth_svc.register_user("reset@example.com", "PasswordLama123", "Reset User")
    raw_session, _, _ = auth_svc.create_session(user.id)
    assert auth_svc.validate_session(raw_session) is not None

    # 1. Buat token reset
    res = auth_svc.create_password_reset_token("reset@example.com")
    assert res is not None
    _, raw_reset_token = res

    # 2. Reset password
    updated_user = auth_svc.reset_password_with_token(raw_reset_token, "PasswordBaru456")
    assert updated_user.id == user.id

    # 3. Verifikasi login dengan password baru
    assert auth_svc.authenticate_user("reset@example.com", "PasswordBaru456") is not None
    with pytest.raises(InvalidCredentialsError):
        auth_svc.authenticate_user("reset@example.com", "PasswordLama123")

    # 4. Token reset bersifat single-use
    with pytest.raises(InvalidTokenError, match="sudah pernah digunakan"):
        auth_svc.reset_password_with_token(raw_reset_token, "PasswordKetiga789")

    # 5. Sesi aktif lama dicabut otomatis
    assert auth_svc.validate_session(raw_session) is None


def test_delete_user_account_cascades_instantly(auth_svc: AuthService):
    user, _ = auth_svc.register_user("delete@example.com", "Password123", "Delete Me")
    raw_session, _, _ = auth_svc.create_session(user.id)

    auth_svc.delete_user_account(user.id)

    assert auth_svc.get_user_by_id(user.id) is None
    assert auth_svc.validate_session(raw_session) is None
