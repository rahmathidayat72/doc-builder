from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, select, update
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import ShortUrl
from app.db.postgres import Base, SessionLocal


class ShortenerRepository:
    """Repository PostgreSQL / SQLAlchemy untuk local fallback URL shortener."""

    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self.session_factory = session_factory or SessionLocal

    @contextmanager
    def _session(self) -> Iterator[Session]:
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def from_engine(cls, engine: Engine) -> ShortenerRepository:
        """Membuat instance repository terikat ke engine tertentu (misal in-memory test)."""
        Base.metadata.create_all(engine)
        return cls(sessionmaker(autocommit=False, autoflush=False, bind=engine))

    @classmethod
    def from_db_path(cls, db_path: Path | str) -> ShortenerRepository:
        """Adapter kompatibilitas SQLite file path untuk fallback lokal/pengujian."""
        # ponytail: Adapter jembatan selama transisi migrasi SQLite ke PostgreSQL.
        # Upgrade path: hapus saat SQLite fallback digantikan PostgreSQL di DB-POSTGRES-007.
        engine = create_engine(
            f"sqlite:///{Path(db_path).as_posix()}",
            connect_args={"check_same_thread": False},
        )
        return cls.from_engine(engine)

    def get_by_slug(self, slug: str) -> dict[str, Any] | None:
        with self._session() as session:
            stmt = select(ShortUrl).where(ShortUrl.slug == slug)
            record = session.scalars(stmt).first()
            if not record:
                return None
            return {
                "id": record.id,
                "slug": record.slug,
                "destination_url": record.destination_url,
                "status": record.status,
                "click_count": record.click_count,
                "created_at": record.created_at,
                "revoked_at": record.revoked_at,
                "last_accessed_at": record.last_accessed_at,
            }

    def create(
        self,
        slug: str,
        destination_url: str,
        now: float | None = None,
    ) -> dict[str, Any]:
        created_time = now if now is not None else time.time()
        with self._session() as session:
            record = ShortUrl(
                slug=slug,
                destination_url=destination_url,
                status="active",
                click_count=0,
                created_at=created_time,
            )
            session.add(record)
            session.flush()
            return {
                "id": record.id,
                "slug": record.slug,
                "destination_url": record.destination_url,
                "status": record.status,
                "click_count": record.click_count,
                "created_at": record.created_at,
            }

    def record_click(self, slug: str, now: float | None = None) -> tuple[str, str] | None:
        """Mengambil URL tujuan dan menaikkan click_count secara atomik.
        Mengembalikan (destination_url, status) atau None jika tidak ditemukan.
        """
        access_time = now if now is not None else time.time()
        with self._session() as session:
            stmt = select(ShortUrl.destination_url, ShortUrl.status).where(ShortUrl.slug == slug)
            row = session.execute(stmt).first()
            if not row:
                return None

            dest_url, link_status = row
            if link_status == "active":
                update_stmt = (
                    update(ShortUrl)
                    .where(ShortUrl.slug == slug, ShortUrl.status == "active")
                    .values(
                        click_count=ShortUrl.click_count + 1,
                        last_accessed_at=access_time,
                    )
                )
                session.execute(update_stmt)

            return dest_url, link_status

    def revoke(self, slug: str, now: float | None = None) -> bool:
        revoke_time = now if now is not None else time.time()
        with self._session() as session:
            stmt = (
                update(ShortUrl)
                .where(ShortUrl.slug == slug)
                .values(status="revoked", revoked_at=revoke_time)
            )
            res = session.execute(stmt)
            return res.rowcount > 0
