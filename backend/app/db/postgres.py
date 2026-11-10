from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Base kelas deklaratif SQLAlchemy 2 untuk seluruh model PostgreSQL Satukit."""
    pass


# ponytail: Connection pool 5 & max_overflow 10 cukup untuk VPS 2.2 GiB RAM (DEC-021).
# Upgrade path: naikkan pool_size bila traffic multi-user butuh throughput lebih besar.
def create_postgres_engine(database_url: str | None = None) -> Engine:
    """Membuat SQLAlchemy engine untuk koneksi PostgreSQL via psycopg v3."""
    url = database_url or settings.DATABASE_URL
    return create_engine(
        url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )


engine: Engine = create_postgres_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db_session(engine_override: Engine | None = None) -> Iterator[Session]:
    """Context manager sesi database PostgreSQL untuk unit of work transaksi atomik."""
    maker = sessionmaker(autocommit=False, autoflush=False, bind=engine_override or engine)
    session: Session = maker()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Iterator[Session]:
    """FastAPI dependency injection provider untuk sesi database PostgreSQL."""
    with get_db_session() as session:
        yield session


def init_postgres_db(engine_override: Engine | None = None) -> None:
    """Menginisialisasi skema tabel PostgreSQL via metadata SQLAlchemy (DB-POSTGRES-007)."""
    try:
        eng = engine_override or engine
        Base.metadata.create_all(eng)
    except Exception:
        # Graceful fallback jika server PostgreSQL offline saat startup lokal
        pass

