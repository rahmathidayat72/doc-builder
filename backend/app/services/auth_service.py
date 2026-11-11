from __future__ import annotations

import re
import time
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.security import (
    generate_secure_token,
    hash_password,
    hash_token,
    session_manager,
    verify_password,
)
from app.db.repositories.auth_repository import AuthRepository, UserRecord
from app.db.session import DatabaseManager


class UserAlreadyExistsError(HTTPException):
    def __init__(self, detail: str = "Email ini sudah terdaftar.") -> None:
        super().__init__(status_code=409, detail=detail)


class InvalidCredentialsError(HTTPException):
    def __init__(self, detail: str = "Email atau kata sandi tidak valid.") -> None:
        super().__init__(status_code=401, detail=detail)


class AccountMergeRequiredError(HTTPException):
    """Dilempar saat pengguna mencoba masuk via Google OAuth padahal akun dengan email
    yang sama telah memiliki kata sandi lokal, untuk mencegah Account Takeover (BRULE-013).
    """

    def __init__(
        self,
        detail: str = (
            "Akun dengan email ini telah terdaftar menggunakan kata sandi. "
            "Demi keamanan privasi Anda, penggabungan akun otomatis tidak diizinkan. "
            "Silakan masuk menggunakan kata sandi Anda terlebih dahulu, lalu tautkan akun "
            "Google Anda melalui menu pengaturan profil."
        ),
    ) -> None:
        super().__init__(
            status_code=409,
            detail=detail,
            headers={"X-Error-Code": "ACCOUNT_MERGE_REQUIRED"},
        )


class InvalidTokenError(HTTPException):
    def __init__(self, detail: str = "Token tidak valid atau telah kedaluwarsa.") -> None:
        super().__init__(status_code=400, detail=detail)


class SessionExpiredError(HTTPException):
    def __init__(self, detail: str = "Sesi telah kedaluwarsa. Silakan masuk kembali.") -> None:
        super().__init__(status_code=401, detail=detail)


class UserNotFoundError(HTTPException):
    def __init__(self, detail: str = "Pengguna tidak ditemukan.") -> None:
        super().__init__(status_code=404, detail=detail)


def validate_password_strength(password: str) -> None:
    """Memvalidasi kekuatan password (minimal 8 karakter, ada kombinasi huruf dan angka)."""
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Kata sandi harus terdiri dari minimal 8 karakter.",
        )
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        raise HTTPException(
            status_code=400,
            detail="Kata sandi harus memuat kombinasi huruf dan angka.",
        )


def normalize_email(email: str) -> str:
    """Menormalkan alamat email menjadi huruf kecil dan tanpa spasi luar."""
    cleaned = email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned):
        raise HTTPException(status_code=400, detail="Format alamat email tidak valid.")
    return cleaned


class AuthService:
    """Layanan autentikasi multi-user, hashing Argon2id, OAuth, dan manajemen sesi."""

    def __init__(
        self,
        repository: AuthRepository | None = None,
        database_manager: DatabaseManager | None = None,
    ) -> None:
        self._db = database_manager
        if repository is not None:
            self._repo = repository
        elif database_manager is not None:
            self._repo = AuthRepository.from_db_manager(database_manager)
        else:
            self._repo = AuthRepository()

    @property
    def db(self) -> Any:
        return self._db

    @db.setter
    def db(self, val: Any) -> None:
        self._db = val
        self._repo = AuthRepository.from_db_manager(val)

    @property
    def repo(self) -> AuthRepository:
        return self._repo

    def register_user(self, email: str, password: str, name: str) -> tuple[UserRecord, str]:
        """Mendaftarkan pengguna baru dengan email dan kata sandi."""
        norm_email = normalize_email(email)
        validate_password_strength(password)
        cleaned_name = name.strip()
        if not cleaned_name:
            raise HTTPException(status_code=400, detail="Nama tidak boleh kosong.")

        if self.repo.get_user_by_email(norm_email) is not None:
            raise UserAlreadyExistsError("Alamat email ini sudah terdaftar.")

        now = time.time()
        user_id = str(uuid.uuid4())
        hashed_pw = hash_password(password)

        raw_verification_token = generate_secure_token(32)
        token_hash = hash_token(raw_verification_token)
        token_expires_at = now + (settings.AUTH_TOKEN_TTL_MINUTES * 60)

        try:
            user = self.repo.create_user_with_token(
                user_id=user_id,
                email=norm_email,
                password_hash=hashed_pw,
                name=cleaned_name,
                email_verified=False,
                token_hash=token_hash,
                token_type="email_verification",
                token_expires_at=token_expires_at,
                now=now,
            )
        except IntegrityError:
            raise UserAlreadyExistsError("Alamat email ini sudah terdaftar.") from None

        return user, raw_verification_token

    def authenticate_user(self, email: str, password: str) -> UserRecord:
        """Memvalidasi kredensial login email dan password secara timing-safe."""
        norm_email = normalize_email(email)
        user = self.repo.get_user_by_email(norm_email)
        if not user or not user.password_hash:
            raise InvalidCredentialsError()

        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()

        return user

    def authenticate_or_register_google(
        self,
        provider_user_id: str,
        email: str,
        name: str,
        email_verified: bool = True,
    ) -> UserRecord:
        """Menangani login/registrasi Google OAuth dengan penegakan Anti-Auto-Merge (BRULE-013)."""
        norm_email = normalize_email(email)
        cleaned_name = name.strip() or "Google User"
        now = time.time()

        # 1. Cek apakah provider_user_id sudah tertaut ke akun di tabel oauth_accounts
        oauth_user = self.repo.get_user_by_google_oauth(provider_user_id)
        if oauth_user:
            return oauth_user

        # 2. Akun Google belum tertaut. Cek apakah ada akun pengguna dengan email yang sama
        existing_user = self.repo.get_user_by_email(norm_email)
        if existing_user:
            # BRULE-013 / NFR-SEC-007: DILARANG auto-merge jika akun memiliki password lokal
            if existing_user.has_password:
                raise AccountMergeRequiredError()

            # Jika akun ada tapi belum punya password (misal dari OAuth lain), tautkan
            oauth_id = str(uuid.uuid4())
            self.repo.link_google_oauth(
                oauth_id=oauth_id,
                user_id=existing_user.id,
                provider_user_id=provider_user_id,
                email=norm_email,
                now=now,
            )
            return existing_user

        # 3. User baru mendaftar via Google OAuth
        user_id = str(uuid.uuid4())
        return self.repo.create_google_user(
            user_id=user_id,
            email=norm_email,
            name=cleaned_name,
            email_verified=email_verified,
            provider_user_id=provider_user_id,
            now=now,
        )

    def link_google_account(
        self,
        user_id: str,
        provider_user_id: str,
        email: str,
        current_password: str | None = None,
    ) -> None:
        """Menautkan akun Google ke user yang sedang login dengan verifikasi password sadar."""
        norm_email = normalize_email(email)
        now = time.time()

        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise UserNotFoundError()

        # Jika akun memiliki password, wajib verifikasi password saat ini
        if user.has_password:
            valid_pw = current_password is not None and verify_password(
                current_password, user.password_hash or ""
            )
            if not valid_pw:
                raise HTTPException(
                    status_code=400,
                    detail="Konfirmasi kata sandi saat ini tidak valid untuk menautkan akun.",
                )

        # Pastikan provider_user_id belum dipakai oleh user lain
        conflict_user_id = self.repo.get_google_oauth_user_id(provider_user_id)
        if conflict_user_id and conflict_user_id != user_id:
            raise HTTPException(
                status_code=409,
                detail="Akun Google ini telah ditautkan ke akun Satukit lainnya.",
            )

        # Hapus jika ada tautan google lama untuk user ini lalu pasang yang baru
        self.repo.link_google_oauth(
            oauth_id=str(uuid.uuid4()),
            user_id=user_id,
            provider_user_id=provider_user_id,
            email=norm_email,
            now=now,
        )

    def unlink_google_account(self, user_id: str) -> None:
        """Memutuskan tautan akun Google. Pengguna wajib memiliki password lokal."""
        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise UserNotFoundError()

        if not user.has_password:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Tidak dapat memutuskan akun Google karena Anda belum membuat kata sandi. "
                    "Silakan buat kata sandi terlebih dahulu di pengaturan profil."
                ),
            )

        self.repo.unlink_google_oauth(user_id)

    def create_session(
        self,
        user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[str, str, float]:
        """Membuat sesi baru di basis data.
        Mengembalikan (raw_session_token, csrf_token, expires_at).
        """
        raw_session_token = generate_secure_token(32)
        token_hash = hash_token(raw_session_token)
        csrf_token = generate_secure_token(32)
        now = time.time()
        expires_at = now + (settings.SESSION_TTL_DAYS * 86400)

        self.repo.create_session(
            token_hash=token_hash,
            user_id=user_id,
            csrf_token=csrf_token,
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=now,
            expires_at=expires_at,
        )

        return raw_session_token, csrf_token, expires_at

    def validate_session(self, raw_session_token: str) -> tuple[UserRecord, str] | None:
        """Memvalidasi sesi database. Mengembalikan (UserRecord, csrf_token) jika valid."""
        if not raw_session_token or session_manager.verify_session(raw_session_token):
            return None

        token_hash = hash_token(raw_session_token)
        now = time.time()

        try:
            res = self.repo.get_session_with_user(token_hash)
        except Exception:
            return None

        if not res:
            return None

        user, csrf_token, expires_at = res
        if expires_at <= now:
            self.revoke_session(raw_session_token)
            return None

        return user, csrf_token

    def revoke_session(self, raw_session_token: str) -> None:
        """Menghapus sesi saat logout."""
        token_hash = hash_token(raw_session_token)
        self.repo.revoke_session(token_hash)

    def revoke_all_user_sessions(self, user_id: str) -> None:
        """Menghapus seluruh sesi pengguna (saat reset password atau logout semua perangkat)."""
        self.repo.revoke_all_user_sessions(user_id)

    def create_password_reset_token(self, email: str) -> tuple[UserRecord, str] | None:
        """Membuat token reset kata sandi baru (single-use, TTL 15 menit)."""
        norm_email = normalize_email(email)
        now = time.time()

        user = self.repo.get_user_by_email(norm_email)
        if not user:
            return None

        raw_reset_token = generate_secure_token(32)
        token_hash = hash_token(raw_reset_token)
        expires_at = now + (settings.AUTH_TOKEN_TTL_MINUTES * 60)

        self.repo.create_password_reset_token(
            user_id=user.id,
            token_hash=token_hash,
            created_at=now,
            expires_at=expires_at,
        )

        return user, raw_reset_token

    def reset_password_with_token(self, raw_token: str, new_password: str) -> UserRecord:
        """Mereset kata sandi dengan token reset, memverifikasi single-use & invalidasi sesi."""
        validate_password_strength(new_password)
        token_hash = hash_token(raw_token)
        now = time.time()

        token_info = self.repo.get_password_reset_token(token_hash)
        if not token_info:
            raise InvalidTokenError("Token reset kata sandi tidak valid.")

        user_id, used_at, expires_at = token_info

        if used_at is not None:
            raise InvalidTokenError("Token reset kata sandi sudah pernah digunakan.")

        if expires_at <= now:
            raise InvalidTokenError("Token reset kata sandi telah kedaluwarsa.")

        new_hash = hash_password(new_password)
        return self.repo.consume_password_reset_token(
            user_id=user_id,
            new_hash=new_hash,
            token_hash=token_hash,
            now=now,
        )

    def verify_email_with_token(self, raw_token: str) -> UserRecord:
        """Memverifikasi email menggunakan token verifikasi single-use."""
        token_hash = hash_token(raw_token)
        now = time.time()

        token_info = self.repo.get_email_verification_token(token_hash)
        if not token_info:
            raise InvalidTokenError("Token verifikasi tidak valid atau telah kedaluwarsa.")

        user_id, used_at, expires_at = token_info
        if used_at is not None:
            raise InvalidTokenError("Token verifikasi ini sudah pernah digunakan sebelumnya.")

        if expires_at <= now:
            raise InvalidTokenError("Token verifikasi telah kedaluwarsa. Silakan minta tautan baru.")

        return self.repo.consume_email_verification_token(
            user_id=user_id,
            token_hash=token_hash,
            now=now,
        )

    def resend_verification_token(self, email: str) -> tuple[UserRecord, str] | None:
        """Menghasilkan token verifikasi email baru jika akun terdaftar dan belum terverifikasi."""
        norm_email = normalize_email(email)
        user = self.repo.get_user_by_email(norm_email)
        if not user or user.email_verified:
            return None

        now = time.time()
        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)
        token_expires_at = now + (settings.AUTH_TOKEN_TTL_MINUTES * 60)

        self.repo.create_email_verification_token(
            user_id=user.id,
            token_hash=token_hash,
            created_at=now,
            expires_at=token_expires_at,
        )
        return user, raw_token

    def change_password(self, user_id: str, old_password: str, new_password: str) -> None:
        """Mengganti kata sandi dengan verifikasi kata sandi lama."""
        validate_password_strength(new_password)
        now = time.time()

        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise UserNotFoundError()

        if user.has_password and not verify_password(old_password, user.password_hash or ""):
            raise HTTPException(status_code=400, detail="Kata sandi saat ini salah.")

        new_hash = hash_password(new_password)
        self.repo.update_user_password(user_id, new_hash, now)

    def get_user_by_id(self, user_id: str) -> UserRecord | None:
        """Mengambil profil pengguna berdasarkan ID."""
        return self.repo.get_user_by_id(user_id)

    def get_oauth_accounts_for_user(self, user_id: str) -> list[dict[str, Any]]:
        """Mengambil daftar akun OAuth tertaut untuk pengguna tertentu."""
        return self.repo.get_oauth_accounts_for_user(user_id)

    def delete_user_account(self, user_id: str) -> None:
        """Menghapus akun pengguna dan seluruh data terkait secara instan (self-delete)."""
        self.repo.delete_user(user_id)


auth_service = AuthService()
