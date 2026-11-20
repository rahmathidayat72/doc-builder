"""Skrip satu-kali untuk memendekkan TTL sesi pengguna lama menjadi maksimal 6 jam."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.db.repositories.auth_repository import AuthRepository
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker


def _migrate_engine(
    engine_url: str,
    *,
    label: str,
    ttl_hours: int,
    delete_expired: bool,
    connect_args: dict | None = None,
) -> dict[str, int] | None:
    eng = create_engine(engine_url, connect_args=connect_args or {})
    try:
        if not inspect(eng).has_table("user_sessions"):
            print(f"[SKIP] {label}: tabel user_sessions belum ada.")
            return None
        repo = AuthRepository(sessionmaker(autocommit=False, autoflush=False, bind=eng))
        stats = repo.shorten_existing_sessions(
            ttl_hours=ttl_hours,
            delete_expired=delete_expired,
        )
        print(
            f"[OK] {label}: shortened={stats['shortened']}, "
            f"expired={stats['expired']}, deleted={stats['deleted']}"
        )
        return stats
    finally:
        eng.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Memendekkan TTL seluruh sesi user_sessions lama menjadi maksimal N jam."
    )
    parser.add_argument(
        "--ttl-hours",
        type=int,
        default=settings.SESSION_TTL_HOURS,
        help="Batas TTL sesi baru dalam jam (default: settings.SESSION_TTL_HOURS).",
    )
    parser.add_argument(
        "--database-url",
        default=settings.DATABASE_URL,
        help="URL database SQLAlchemy target (default: settings.DATABASE_URL).",
    )
    parser.add_argument(
        "--sqlite-path",
        default=str(BACKEND_DIR / "data" / "docbuilder.db"),
        help="Opsional path SQLite lokal lama untuk ikut dimigrasikan jika ada.",
    )
    parser.add_argument(
        "--skip-sqlite",
        action="store_true",
        help="Lewati migrasi berkas SQLite lokal.",
    )
    parser.add_argument(
        "--delete-expired",
        action="store_true",
        help="Sekaligus hapus baris sesi yang sudah kedaluwarsa setelah pemendekan.",
    )
    args = parser.parse_args()

    _migrate_engine(
        args.database_url,
        label="primary-db",
        ttl_hours=args.ttl_hours,
        delete_expired=args.delete_expired,
    )

    if not args.skip_sqlite and args.sqlite_path:
        sqlite_file = Path(args.sqlite_path)
        if sqlite_file.is_file():
            sqlite_url = f"sqlite:///{sqlite_file.as_posix()}"
            _migrate_engine(
                sqlite_url,
                label=f"sqlite:{sqlite_file.name}",
                ttl_hours=args.ttl_hours,
                delete_expired=args.delete_expired,
                connect_args={"check_same_thread": False},
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
