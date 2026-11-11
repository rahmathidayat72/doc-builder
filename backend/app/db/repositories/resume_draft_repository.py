from __future__ import annotations

import json
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.models import ResumeDraft
from app.db.postgres import Base, SessionLocal


class DraftQuotaExceededError(ValueError):
    """Batas kuota draf (jumlah atau total ukuran) per akun terlampaui."""


class DraftSizeExceededError(ValueError):
    """Ukuran draf melebihi batas per draf."""


class DraftNotFoundError(LookupError):
    """Draf tidak ditemukan atau bukan milik pengguna."""


class DraftExpiredError(LookupError):
    """Draf telah kedaluwarsa (retensi 30 hari berakhir)."""


class ResumeDraftRepository:
    """Repository database PostgreSQL untuk isolasi draf CV per akun dan retensi 30 hari."""

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
    def from_engine(cls, engine: Engine) -> ResumeDraftRepository:
        Base.metadata.create_all(engine)
        return cls(sessionmaker(autocommit=False, autoflush=False, bind=engine))

    def _calculate_size_bytes(self, payload: dict[str, Any]) -> int:
        return len(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

    def list_drafts(self, user_id: str, now: float | None = None) -> list[dict[str, Any]]:
        current_time = now if now is not None else time.time()
        with self._session() as session:
            stmt = (
                select(ResumeDraft)
                .where(
                    ResumeDraft.user_id == user_id,
                    ResumeDraft.deleted_at.is_(None),
                    ResumeDraft.expires_at > current_time,
                )
                .order_by(ResumeDraft.updated_at.desc())
            )
            drafts = session.scalars(stmt).all()
            summaries = []
            for d in drafts:
                payload = d.payload if isinstance(d.payload, dict) else {}
                summaries.append({
                    "id": d.id,
                    "title": d.title,
                    "templateId": payload.get("templateId", "ats-clean"),
                    "updatedAt": int(d.updated_at * 1000),
                    "createdAt": int(d.created_at * 1000),
                    "favorite": bool(d.favorite),
                    "targetJobTitle": d.target_job_title,
                    "expiresAt": int(d.expires_at * 1000),
                    "sizeBytes": d.size_bytes,
                    "version": d.version,
                })
            return summaries

    def get_draft(
        self, draft_id: str, user_id: str, now: float | None = None
    ) -> dict[str, Any] | None:
        current_time = now if now is not None else time.time()
        with self._session() as session:
            stmt = select(ResumeDraft).where(
                ResumeDraft.id == draft_id,
                ResumeDraft.user_id == user_id,
            )
            d = session.scalars(stmt).first()
            if not d:
                return None
            if d.deleted_at is not None:
                return None
            if d.expires_at <= current_time:
                session.delete(d)
                return None

            payload = d.payload if isinstance(d.payload, dict) else {}
            return {
                "id": d.id,
                "title": d.title,
                "templateId": payload.get("templateId", "ats-clean"),
                "colorTheme": payload.get("colorTheme", "#1e293b"),
                "fontFamily": payload.get("fontFamily", "sans"),
                "resumeLanguage": payload.get("resumeLanguage", "id"),
                "data": payload.get("data", {}),
                "createdAt": int(d.created_at * 1000),
                "updatedAt": int(d.updated_at * 1000),
                "expiresAt": int(d.expires_at * 1000),
                "favorite": bool(d.favorite),
                "targetJob": payload.get("targetJob"),
                "version": d.version,
            }

    def create_draft(
        self,
        user_id: str,
        draft_dict: dict[str, Any],
        now: float | None = None,
    ) -> dict[str, Any]:
        current_time = now if now is not None else time.time()
        draft_id = draft_dict.get("id") or str(uuid.uuid4())
        title = (draft_dict.get("title") or "CV Tanpa Judul")[:140].strip() or "CV Tanpa Judul"
        favorite = bool(draft_dict.get("favorite", False))
        version = int(draft_dict.get("version", 1))

        target_job = draft_dict.get("targetJob")
        target_job_title = None
        if isinstance(target_job, dict) and target_job.get("title"):
            target_job_title = str(target_job["title"])[:140].strip()

        payload = {
            "templateId": draft_dict.get("templateId", "ats-clean"),
            "colorTheme": draft_dict.get("colorTheme", "#1e293b"),
            "fontFamily": draft_dict.get("fontFamily", "sans"),
            "resumeLanguage": draft_dict.get("resumeLanguage", "id"),
            "data": draft_dict.get("data", {}),
            "targetJob": target_job,
        }

        size_bytes = self._calculate_size_bytes(payload)
        if size_bytes > settings.DRAFT_MAX_SIZE_BYTES:
            mb = round(size_bytes / (1024 * 1024), 2)
            raise DraftSizeExceededError(
                f"Ukuran draf ({mb} MB) melebihi batas maksimum 10 MB."
            )

        retention_seconds = settings.DRAFT_RETENTION_DAYS * 86400
        expires_at = current_time + retention_seconds

        with self._session() as session:
            count_stmt = select(func.count(ResumeDraft.id)).where(
                ResumeDraft.user_id == user_id,
                ResumeDraft.expires_at > current_time,
                (
                    ResumeDraft.deleted_at.is_(None)
                    | (ResumeDraft.deleted_at > current_time - settings.DRAFT_UNDO_WINDOW_SECONDS)
                ),
            )
            active_count = session.scalar(count_stmt) or 0
            if active_count >= settings.DRAFT_MAX_COUNT_PER_USER:
                raise DraftQuotaExceededError(
                    f"Batas kuota {settings.DRAFT_MAX_COUNT_PER_USER} draf per akun telah tercapai."
                )

            total_size_stmt = select(func.coalesce(func.sum(ResumeDraft.size_bytes), 0)).where(
                ResumeDraft.user_id == user_id,
                ResumeDraft.expires_at > current_time,
                (
                    ResumeDraft.deleted_at.is_(None)
                    | (ResumeDraft.deleted_at > current_time - settings.DRAFT_UNDO_WINDOW_SECONDS)
                ),
            )
            total_size = session.scalar(total_size_stmt) or 0
            if total_size + size_bytes > settings.DRAFT_MAX_TOTAL_BYTES_PER_USER:
                raise DraftQuotaExceededError(
                    "Batas total penyimpanan 50 MB per akun telah tercapai."
                )

            draft = ResumeDraft(
                id=draft_id,
                user_id=user_id,
                title=title,
                payload=payload,
                favorite=favorite,
                target_job_title=target_job_title,
                size_bytes=size_bytes,
                version=version,
                created_at=current_time,
                updated_at=current_time,
                expires_at=expires_at,
                deleted_at=None,
            )
            session.add(draft)
            session.flush()

            return {
                "id": draft.id,
                "title": draft.title,
                "templateId": payload["templateId"],
                "colorTheme": payload["colorTheme"],
                "fontFamily": payload["fontFamily"],
                "resumeLanguage": payload["resumeLanguage"],
                "data": payload["data"],
                "createdAt": int(draft.created_at * 1000),
                "updatedAt": int(draft.updated_at * 1000),
                "expiresAt": int(draft.expires_at * 1000),
                "favorite": bool(draft.favorite),
                "targetJob": payload["targetJob"],
                "version": draft.version,
            }

    def update_draft(
        self,
        draft_id: str,
        user_id: str,
        draft_dict: dict[str, Any],
        now: float | None = None,
    ) -> dict[str, Any]:
        current_time = now if now is not None else time.time()
        with self._session() as session:
            d = session.scalars(
                select(ResumeDraft).where(
                    ResumeDraft.id == draft_id,
                    ResumeDraft.user_id == user_id,
                )
            ).first()
            if not d:
                raise DraftNotFoundError("Draf tidak ditemukan atau bukan milik pengguna.")
            if d.deleted_at is not None:
                raise DraftNotFoundError("Draf berada di tempat sampah.")
            if d.expires_at <= current_time:
                session.delete(d)
                raise DraftExpiredError("Draf telah kedaluwarsa dan dihapus permanen.")

            title = (draft_dict.get("title") or d.title)[:140].strip() or "CV Tanpa Judul"
            favorite = bool(draft_dict.get("favorite", d.favorite))
            version = int(draft_dict.get("version", d.version + 1))

            existing_payload = d.payload if isinstance(d.payload, dict) else {}
            target_job = draft_dict.get("targetJob", existing_payload.get("targetJob"))
            target_job_title = None
            if isinstance(target_job, dict) and target_job.get("title"):
                target_job_title = str(target_job["title"])[:140].strip()

            payload = {
                "templateId": draft_dict.get(
                    "templateId", existing_payload.get("templateId", "ats-clean")
                ),
                "colorTheme": draft_dict.get(
                    "colorTheme", existing_payload.get("colorTheme", "#1e293b")
                ),
                "fontFamily": draft_dict.get(
                    "fontFamily", existing_payload.get("fontFamily", "sans")
                ),
                "resumeLanguage": draft_dict.get(
                    "resumeLanguage", existing_payload.get("resumeLanguage", "id")
                ),
                "data": draft_dict.get("data", existing_payload.get("data", {})),
                "targetJob": target_job,
            }

            size_bytes = self._calculate_size_bytes(payload)
            if size_bytes > settings.DRAFT_MAX_SIZE_BYTES:
                mb = round(size_bytes / (1024 * 1024), 2)
                raise DraftSizeExceededError(
                    f"Ukuran draf ({mb} MB) melebihi batas maksimum 10 MB."
                )

            total_size_stmt = select(func.coalesce(func.sum(ResumeDraft.size_bytes), 0)).where(
                ResumeDraft.user_id == user_id,
                ResumeDraft.id != draft_id,
                ResumeDraft.expires_at > current_time,
                (
                    ResumeDraft.deleted_at.is_(None)
                    | (ResumeDraft.deleted_at > current_time - settings.DRAFT_UNDO_WINDOW_SECONDS)
                ),
            )
            other_size = session.scalar(total_size_stmt) or 0
            if other_size + size_bytes > settings.DRAFT_MAX_TOTAL_BYTES_PER_USER:
                raise DraftQuotaExceededError(
                    "Batas total penyimpanan 50 MB per akun telah tercapai."
                )

            d.title = title
            d.payload = payload
            d.favorite = favorite
            d.target_job_title = target_job_title
            d.size_bytes = size_bytes
            d.version = version
            d.updated_at = current_time
            d.expires_at = current_time + (settings.DRAFT_RETENTION_DAYS * 86400)

            session.flush()

            return {
                "id": d.id,
                "title": d.title,
                "templateId": payload["templateId"],
                "colorTheme": payload["colorTheme"],
                "fontFamily": payload["fontFamily"],
                "resumeLanguage": payload["resumeLanguage"],
                "data": payload["data"],
                "createdAt": int(d.created_at * 1000),
                "updatedAt": int(d.updated_at * 1000),
                "expiresAt": int(d.expires_at * 1000),
                "favorite": bool(d.favorite),
                "targetJob": payload["targetJob"],
                "version": d.version,
            }

    def soft_delete(self, draft_id: str, user_id: str, now: float | None = None) -> bool:
        current_time = now if now is not None else time.time()
        with self._session() as session:
            d = session.scalars(
                select(ResumeDraft).where(
                    ResumeDraft.id == draft_id,
                    ResumeDraft.user_id == user_id,
                )
            ).first()
            if not d:
                return False
            d.deleted_at = current_time
            return True

    def restore_draft(
        self,
        draft_id: str,
        user_id: str,
        now: float | None = None,
        max_undo_seconds: float | None = None,
    ) -> dict[str, Any] | None:
        current_time = now if now is not None else time.time()
        undo_window = (
            max_undo_seconds
            if max_undo_seconds is not None
            else float(settings.DRAFT_UNDO_WINDOW_SECONDS)
        )

        with self._session() as session:
            d = session.scalars(
                select(ResumeDraft).where(
                    ResumeDraft.id == draft_id,
                    ResumeDraft.user_id == user_id,
                )
            ).first()
            if not d:
                return None

            if d.deleted_at is None:
                return self.get_draft(draft_id, user_id, now=current_time)

            if current_time - d.deleted_at > undo_window or d.expires_at <= current_time:
                session.delete(d)
                return None

            d.deleted_at = None
            session.flush()

            payload = d.payload if isinstance(d.payload, dict) else {}
            return {
                "id": d.id,
                "title": d.title,
                "templateId": payload.get("templateId", "ats-clean"),
                "colorTheme": payload.get("colorTheme", "#1e293b"),
                "fontFamily": payload.get("fontFamily", "sans"),
                "resumeLanguage": payload.get("resumeLanguage", "id"),
                "data": payload.get("data", {}),
                "createdAt": int(d.created_at * 1000),
                "updatedAt": int(d.updated_at * 1000),
                "expiresAt": int(d.expires_at * 1000),
                "favorite": bool(d.favorite),
                "targetJob": payload.get("targetJob"),
                "version": d.version,
            }

    def hard_delete(self, draft_id: str, user_id: str) -> bool:
        with self._session() as session:
            d = session.scalars(
                select(ResumeDraft).where(
                    ResumeDraft.id == draft_id,
                    ResumeDraft.user_id == user_id,
                )
            ).first()
            if not d:
                return False
            session.delete(d)
            return True

    def purge_expired(self, now: float | None = None) -> int:
        current_time = now if now is not None else time.time()
        undo_cutoff = current_time - settings.DRAFT_UNDO_WINDOW_SECONDS

        with self._session() as session:
            stmt = select(ResumeDraft).where(
                (ResumeDraft.expires_at <= current_time)
                | (ResumeDraft.deleted_at.is_not(None) & (ResumeDraft.deleted_at <= undo_cutoff))
            )
            expired_drafts = session.scalars(stmt).all()
            count = len(expired_drafts)
            for d in expired_drafts:
                session.delete(d)
            return count


resume_draft_repo = ResumeDraftRepository()
