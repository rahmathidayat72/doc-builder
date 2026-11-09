from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from app.core.config import settings

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at REAL NOT NULL,
    UNIQUE(provider, provider_user_id),
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_uid
    ON oauth_accounts(provider, provider_user_id);

CREATE TABLE IF NOT EXISTS user_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_type TEXT NOT NULL,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL,
    used_at REAL
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_type ON auth_tokens(user_id, token_type);

CREATE TABLE IF NOT EXISTS media_download_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address TEXT,
    url TEXT NOT NULL,
    platform TEXT NOT NULL,
    media_type TEXT NOT NULL,
    status TEXT NOT NULL,
    progress_percent REAL DEFAULT 0.0,
    file_path TEXT,
    filename TEXT,
    file_size_bytes INTEGER DEFAULT 0,
    error_message TEXT,
    error_code TEXT,
    reserved_bytes INTEGER DEFAULT 0,
    actual_bytes INTEGER DEFAULT 0,
    created_at REAL NOT NULL,
    started_at REAL,
    completed_at REAL,
    expires_at REAL
);

CREATE INDEX IF NOT EXISTS idx_media_jobs_user_status ON media_download_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_download_jobs(status);
CREATE INDEX IF NOT EXISTS idx_media_jobs_expires_at ON media_download_jobs(expires_at);

CREATE TABLE IF NOT EXISTS media_download_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    job_id TEXT NOT NULL,
    bytes_used INTEGER NOT NULL,
    timestamp REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_usage_user_time ON media_download_usage(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_media_usage_ip_time ON media_download_usage(ip_address, timestamp);
"""


def _ensure_secure_db_path(db_path: Path) -> Path:
    """Membuat direktori data dengan izin 0700 dan memastikan file db aman."""
    data_dir = db_path.parent
    data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        os.chmod(data_dir, 0o700)
    except OSError:
        pass

    if db_path.exists():
        try:
            os.chmod(db_path, 0o600)
        except OSError:
            pass

    return db_path


class DatabaseManager:
    """Manajer koneksi dan inisialisasi basis data SQLite berkinerja tinggi (WAL mode)."""

    def __init__(self, db_path: Path | str | None = None) -> None:
        self.db_path = Path(db_path) if db_path is not None else settings.DATABASE_PATH
        self._initialized = False

    def get_connection(self) -> sqlite3.Connection:
        _ensure_secure_db_path(self.db_path)
        conn = sqlite3.connect(
            str(self.db_path),
            timeout=5.0,
            check_same_thread=False,
            isolation_level=None,  # Autocommit mode, transaksi manual via BEGIN/COMMIT
        )
        conn.row_factory = sqlite3.Row

        # Konfigurasi optimasi SQLite untuk konkurensi web
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA busy_timeout = 5000;")

        # Pastikan izin berkas 0600 setelah berkas dibuat
        try:
            os.chmod(self.db_path, 0o600)
        except OSError:
            pass

        return conn

    def init_db(self) -> None:
        conn = self.get_connection()
        try:
            conn.executescript(SCHEMA_SQL)
            self._initialized = True
        finally:
            conn.close()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        conn = self.get_connection()
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        conn = self.get_connection()
        try:
            conn.execute("BEGIN IMMEDIATE;")
            yield conn
            conn.execute("COMMIT;")
        except Exception:
            conn.execute("ROLLBACK;")
            raise
        finally:
            conn.close()


db_manager = DatabaseManager()


def init_db(db_path: Path | str | None = None) -> DatabaseManager:
    manager = DatabaseManager(db_path) if db_path is not None else db_manager
    manager.init_db()
    return manager
