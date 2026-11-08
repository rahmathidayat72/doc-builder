from __future__ import annotations

import re
import time
import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException

from app.core.config import settings
from app.core.security import (
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.db.session import DatabaseManager, db_manager


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


@dataclass
class UserRecord:
    id: str
    email: str
    password_hash: str | None
    name: str
    email_verified: bool
    created_at: float
    updated_at: float

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None and len(self.password_hash) > 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "email_verified": self.email_verified,
            "has_password": self.has_password,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


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

    def __init__(self, database_manager: DatabaseManager | None = None) -> None:
        self.db = database_manager or db_manager

    def register_user(self, email: str, password: str, name: str) -> tuple[UserRecord, str]:
        """Mendaftarkan pengguna baru dengan email dan kata sandi."""
        norm_email = normalize_email(email)
        validate_password_strength(password)
        cleaned_name = name.strip()
        if not cleaned_name:
            raise HTTPException(status_code=400, detail="Nama tidak boleh kosong.")

        now = time.time()
        user_id = str(uuid.uuid4())
        hashed_pw = hash_password(password)

        raw_verification_token = generate_secure_token(32)
        token_hash = hash_token(raw_verification_token)
        token_expires_at = now + (settings.AUTH_TOKEN_TTL_MINUTES * 60)

        with self.db.transaction() as conn:
            # Periksa apakah email sudah terdaftar
            existing = conn.execute(
                "SELECT id FROM users WHERE email = ?;", (norm_email,)
            ).fetchone()
            if existing:
                raise UserAlreadyExistsError("Alamat email ini sudah terdaftar.")

            conn.execute(
                """
                INSERT INTO users (
                    id, email, password_hash, name, email_verified, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, 0, ?, ?);
                """,
                (user_id, norm_email, hashed_pw, cleaned_name, now, now),
            )

            conn.execute(
                """
                INSERT INTO auth_tokens (token_hash, user_id, token_type, created_at, expires_at)
                VALUES (?, ?, 'email_verification', ?, ?);
                """,
                (token_hash, user_id, now, token_expires_at),
            )

        user = UserRecord(
            id=user_id,
            email=norm_email,
            password_hash=hashed_pw,
            name=cleaned_name,
            email_verified=False,
            created_at=now,
            updated_at=now,
        )
        return user, raw_verification_token

    def authenticate_user(self, email: str, password: str) -> UserRecord:
        """Memvalidasi kredensial login email dan password secara timing-safe."""
        norm_email = normalize_email(email)

        with self.db.connection() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?;", (norm_email,)).fetchone()

        if not row or not row["password_hash"]:
            raise InvalidCredentialsError()

        if not verify_password(password, row["password_hash"]):
            raise InvalidCredentialsError()

        return UserRecord(
            id=row["id"],
            email=row["email"],
            password_hash=row["password_hash"],
            name=row["name"],
            email_verified=bool(row["email_verified"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

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

        with self.db.transaction() as conn:
            # 1. Cek apakah provider_user_id sudah tertaut ke akun di tabel oauth_accounts
            oauth_row = conn.execute(
                """
                SELECT u.* FROM users u
                JOIN oauth_accounts oa ON u.id = oa.user_id
                WHERE oa.provider = 'google' AND oa.provider_user_id = ?;
                """,
                (provider_user_id,),
            ).fetchone()

            if oauth_row:
                return UserRecord(
                    id=oauth_row["id"],
                    email=oauth_row["email"],
                    password_hash=oauth_row["password_hash"],
                    name=oauth_row["name"],
                    email_verified=bool(oauth_row["email_verified"]),
                    created_at=oauth_row["created_at"],
                    updated_at=oauth_row["updated_at"],
                )

            # 2. Akun Google belum tertaut. Cek apakah ada akun pengguna dengan email yang sama
            existing_user = conn.execute(
                "SELECT * FROM users WHERE email = ?;", (norm_email,)
            ).fetchone()

            if existing_user:
                # BRULE-013 / NFR-SEC-007: DILARANG auto-merge jika akun memiliki password lokal
                if existing_user["password_hash"]:
                    raise AccountMergeRequiredError()

                # Jika akun ada tapi belum punya password (misal dari OAuth lain), tautkan
                oauth_id = str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO oauth_accounts (
                        id, user_id, provider, provider_user_id, email, created_at
                    )
                    VALUES (?, ?, 'google', ?, ?, ?);
                    """,
                    (oauth_id, existing_user["id"], provider_user_id, norm_email, now),
                )
                return UserRecord(
                    id=existing_user["id"],
                    email=existing_user["email"],
                    password_hash=existing_user["password_hash"],
                    name=existing_user["name"],
                    email_verified=bool(existing_user["email_verified"]),
                    created_at=existing_user["created_at"],
                    updated_at=existing_user["updated_at"],
                )

            # 3. User baru mendaftar via Google OAuth
            user_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO users (
                    id, email, password_hash, name, email_verified, created_at, updated_at
                )
                VALUES (?, ?, NULL, ?, ?, ?, ?);
                """,
                (user_id, norm_email, cleaned_name, 1 if email_verified else 0, now, now),
            )

            oauth_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO oauth_accounts (
                    id, user_id, provider, provider_user_id, email, created_at
                )
                VALUES (?, ?, 'google', ?, ?, ?);
                """,
                (oauth_id, user_id, provider_user_id, norm_email, now),
            )

        return UserRecord(
            id=user_id,
            email=norm_email,
            password_hash=None,
            name=cleaned_name,
            email_verified=email_verified,
            created_at=now,
            updated_at=now,
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

        with self.db.transaction() as conn:
            user = conn.execute("SELECT * FROM users WHERE id = ?;", (user_id,)).fetchone()
            if not user:
                raise UserNotFoundError()

            # Jika akun memiliki password, wajib verifikasi password saat ini
            if user["password_hash"]:
                valid_pw = current_password is not None and verify_password(
                    current_password, user["password_hash"]
                )
                if not valid_pw:
                    raise HTTPException(
                        status_code=400,
                        detail="Konfirmasi kata sandi saat ini tidak valid untuk menautkan akun.",
                    )

            # Pastikan provider_user_id belum dipakai oleh user lain
            conflict = conn.execute(
                """
                SELECT user_id FROM oauth_accounts
                WHERE provider = 'google' AND provider_user_id = ?;
                """,
                (provider_user_id,),
            ).fetchone()
            if conflict and conflict["user_id"] != user_id:
                raise HTTPException(
                    status_code=409,
                    detail="Akun Google ini telah ditautkan ke akun Satukit lainnya.",
                )

            # Hapus jika ada tautan google lama untuk user ini lalu pasang yang baru
            conn.execute(
                "DELETE FROM oauth_accounts WHERE user_id = ? AND provider = 'google';",
                (user_id,),
            )

            conn.execute(
                """
                INSERT INTO oauth_accounts (
                    id, user_id, provider, provider_user_id, email, created_at
                )
                VALUES (?, ?, 'google', ?, ?, ?);
                """,
                (str(uuid.uuid4()), user_id, provider_user_id, norm_email, now),
            )

    def unlink_google_account(self, user_id: str) -> None:
        """Memutuskan tautan akun Google. Pengguna wajib memiliki password lokal."""
        with self.db.transaction() as conn:
            user = conn.execute("SELECT * FROM users WHERE id = ?;", (user_id,)).fetchone()
            if not user:
                raise UserNotFoundError()

            if not user["password_hash"]:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Tidak dapat memutuskan akun Google karena Anda belum membuat kata sandi. "
                        "Silakan buat kata sandi terlebih dahulu di pengaturan profil."
                    ),
                )

            conn.execute(
                "DELETE FROM oauth_accounts WHERE user_id = ? AND provider = 'google';",
                (user_id,),
            )

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

        with self.db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO user_sessions (
                    token_hash, user_id, csrf_token, ip_address, user_agent, created_at, expires_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?);
                """,
                (token_hash, user_id, csrf_token, ip_address, user_agent, now, expires_at),
            )

        return raw_session_token, csrf_token, expires_at

    def validate_session(self, raw_session_token: str) -> tuple[UserRecord, str] | None:
        """Memvalidasi sesi database. Mengembalikan (UserRecord, csrf_token) jika valid."""
        if not raw_session_token:
            return None

        token_hash = hash_token(raw_session_token)
        now = time.time()

        with self.db.connection() as conn:
            row = conn.execute(
                """
                SELECT s.csrf_token, s.expires_at, u.*
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token_hash = ?;
                """,
                (token_hash,),
            ).fetchone()

        if not row:
            return None

        if row["expires_at"] <= now:
            # Sesi kedaluwarsa, bersihkan dari database
            self.revoke_session(raw_session_token)
            return None

        user = UserRecord(
            id=row["id"],
            email=row["email"],
            password_hash=row["password_hash"],
            name=row["name"],
            email_verified=bool(row["email_verified"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        return user, row["csrf_token"]

    def revoke_session(self, raw_session_token: str) -> None:
        """Menghapus sesi saat logout."""
        token_hash = hash_token(raw_session_token)
        with self.db.transaction() as conn:
            conn.execute("DELETE FROM user_sessions WHERE token_hash = ?;", (token_hash,))

    def revoke_all_user_sessions(self, user_id: str) -> None:
        """Menghapus seluruh sesi pengguna (saat reset password atau logout semua perangkat)."""
        with self.db.transaction() as conn:
            conn.execute("DELETE FROM user_sessions WHERE user_id = ?;", (user_id,))

    def create_password_reset_token(self, email: str) -> tuple[UserRecord, str] | None:
        """Membuat token reset kata sandi baru (single-use, TTL 15 menit)."""
        norm_email = normalize_email(email)
        now = time.time()

        with self.db.connection() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?;", (norm_email,)).fetchone()

        if not row:
            return None

        user = UserRecord(
            id=row["id"],
            email=row["email"],
            password_hash=row["password_hash"],
            name=row["name"],
            email_verified=bool(row["email_verified"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

        raw_reset_token = generate_secure_token(32)
        token_hash = hash_token(raw_reset_token)
        expires_at = now + (settings.AUTH_TOKEN_TTL_MINUTES * 60)

        with self.db.transaction() as conn:
            # Hapus token reset lama yang belum dipakai untuk user ini
            conn.execute(
                "DELETE FROM auth_tokens WHERE user_id = ? AND token_type = 'password_reset';",
                (user.id,),
            )
            conn.execute(
                """
                INSERT INTO auth_tokens (token_hash, user_id, token_type, created_at, expires_at)
                VALUES (?, ?, 'password_reset', ?, ?);
                """,
                (token_hash, user.id, now, expires_at),
            )

        return user, raw_reset_token

    def reset_password_with_token(self, raw_token: str, new_password: str) -> UserRecord:
        """Mereset kata sandi dengan token reset, memverifikasi single-use & invalidasi sesi."""
        validate_password_strength(new_password)
        token_hash = hash_token(raw_token)
        now = time.time()

        with self.db.transaction() as conn:
            token_row = conn.execute(
                """
                SELECT * FROM auth_tokens
                WHERE token_hash = ? AND token_type = 'password_reset';
                """,
                (token_hash,),
            ).fetchone()

            if not token_row:
                raise InvalidTokenError("Token reset kata sandi tidak valid.")

            if token_row["used_at"] is not None:
                raise InvalidTokenError("Token reset kata sandi sudah pernah digunakan.")

            if token_row["expires_at"] <= now:
                raise InvalidTokenError("Token reset kata sandi telah kedaluwarsa.")

            user_id = token_row["user_id"]
            new_hash = hash_password(new_password)

            # Perbarui password user
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?;",
                (new_hash, now, user_id),
            )

            # Tandai token sudah digunakan (single-use)
            conn.execute(
                "UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?;",
                (now, token_hash),
            )

            # Cabut seluruh sesi aktif demi keamanan pasca reset password
            conn.execute("DELETE FROM user_sessions WHERE user_id = ?;", (user_id,))

            user_row = conn.execute("SELECT * FROM users WHERE id = ?;", (user_id,)).fetchone()

        return UserRecord(
            id=user_row["id"],
            email=user_row["email"],
            password_hash=user_row["password_hash"],
            name=user_row["name"],
            email_verified=bool(user_row["email_verified"]),
            created_at=user_row["created_at"],
            updated_at=user_row["updated_at"],
        )

    def change_password(self, user_id: str, old_password: str, new_password: str) -> None:
        """Mengganti kata sandi dengan verifikasi kata sandi lama."""
        validate_password_strength(new_password)
        now = time.time()

        with self.db.transaction() as conn:
            user = conn.execute("SELECT * FROM users WHERE id = ?;", (user_id,)).fetchone()
            if not user:
                raise UserNotFoundError()

            if user["password_hash"] and not verify_password(old_password, user["password_hash"]):
                raise HTTPException(status_code=400, detail="Kata sandi saat ini salah.")

            new_hash = hash_password(new_password)
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?;",
                (new_hash, now, user_id),
            )

    def get_user_by_id(self, user_id: str) -> UserRecord | None:
        """Mengambil profil pengguna berdasarkan ID."""
        with self.db.connection() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?;", (user_id,)).fetchone()
        if not row:
            return None
        return UserRecord(
            id=row["id"],
            email=row["email"],
            password_hash=row["password_hash"],
            name=row["name"],
            email_verified=bool(row["email_verified"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def get_oauth_accounts_for_user(self, user_id: str) -> list[dict[str, Any]]:
        """Mengambil daftar akun OAuth tertaut untuk pengguna tertentu."""
        with self.db.connection() as conn:
            rows = conn.execute(
                "SELECT provider, email, created_at FROM oauth_accounts WHERE user_id = ?;",
                (user_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_user_account(self, user_id: str) -> None:
        """Menghapus akun pengguna dan seluruh data terkait secara instan (self-delete)."""
        with self.db.transaction() as conn:
            conn.execute("DELETE FROM users WHERE id = ?;", (user_id,))


auth_service = AuthService()
