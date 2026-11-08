from __future__ import annotations

import hashlib
import hmac
import secrets
from pathlib import Path

import argon2
import argon2.exceptions

SESSION_COOKIE_NAME = "satukit_session"
LEGACY_SESSION_COOKIE_NAME = "docbuilder_session"
CSRF_HEADER_NAME = "X-CSRF-Token"

# Parameter Argon2id standar OWASP: time_cost=3, memory_cost=64MB (65536 KiB), parallelism=4
_password_hasher = argon2.PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    type=argon2.Type.ID,
)


def hash_password(plain_password: str) -> str:
    """Melakukan hashing password menggunakan algoritma Argon2id."""
    return _password_hasher.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """Memverifikasi password terhadap hash Argon2id secara timing-safe."""
    if not hashed_password or not plain_password:
        return False
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (
        argon2.exceptions.VerifyMismatchError,
        argon2.exceptions.VerificationError,
        argon2.exceptions.InvalidHashError,
    ):
        return False


def needs_rehash(hashed_password: str) -> bool:
    """Memeriksa apakah hash password perlu diperbarui parameter keamanannya."""
    try:
        return _password_hasher.check_needs_rehash(hashed_password)
    except Exception:
        return True


def hash_token(raw_token: str) -> str:
    """Menghasilkan representasi SHA-256 dari token acak untuk penyimpanan aman di database."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_secure_token(nbytes: int = 32) -> str:
    """Menghasilkan token URL-safe acak berentropi tinggi."""
    return secrets.token_urlsafe(nbytes)


def timing_safe_compare(val1: str, val2: str) -> bool:
    """Membandingkan dua string secara timing-safe (anti timing-attack)."""
    return hmac.compare_digest(val1, val2)


class LocalSessionManager:
    """Mengelola token sesi dan token CSRF untuk autentikasi localhost yang aman."""

    def __init__(self):
        self._bootstrap_token: str = secrets.token_urlsafe(32)
        self._session_token: str = secrets.token_urlsafe(32)
        self._csrf_token: str = secrets.token_urlsafe(32)
        self._token_file_path: Path | None = None

    def initialize_token_file(self, base_dir: Path) -> Path:
        """Menyimpan token bootstrap ke file lokal yang hanya dapat dibaca oleh user lokal."""
        token_dir = base_dir / ".local_security"
        token_dir.mkdir(parents=True, exist_ok=True)
        self._token_file_path = token_dir / "bootstrap.token"

        # Tulis token
        self._token_file_path.write_text(self._bootstrap_token, encoding="utf-8")

        # Di Linux/Unix, set izin 0600 (read/write hanya owner)
        try:
            self._token_file_path.chmod(0o600)
        except Exception:
            pass

        return self._token_file_path

    @property
    def bootstrap_token(self) -> str:
        return self._bootstrap_token

    @property
    def session_token(self) -> str:
        return self._session_token

    @property
    def csrf_token(self) -> str:
        return self._csrf_token

    def verify_bootstrap(self, token: str) -> bool:
        if not token:
            return False
        return hmac.compare_digest(self._bootstrap_token, token)

    def verify_session(self, token: str) -> bool:
        if not token:
            return False
        return hmac.compare_digest(self._session_token, token)

    def verify_csrf(self, token: str) -> bool:
        if not token:
            return False
        return hmac.compare_digest(self._csrf_token, token)


session_manager = LocalSessionManager()
