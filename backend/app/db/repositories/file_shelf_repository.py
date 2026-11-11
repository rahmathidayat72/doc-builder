"""
Repository for Satukit File Shelf (Rak Berkas)
Task: FS-03 (Phase File Shelf)
Handles atomic slot reservations, rolling hour rate limits, download leases, and deletions.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.models import (
    DownloadLease,
    FileDeletionJob,
    FileRateEvent,
    FileShelfItem,
    RuntimeState,
)

MAX_SLOTS_PER_USER = 5
MAX_FILE_BYTES = 25_000_000  # 25 MB
MAX_UPLOADS_PER_HOUR = 10
MAX_DOWNLOADS_PER_HOUR = 30
MAX_ACTIVE_DOWNLOADS_PER_USER = 1
MAX_GLOBAL_ACTIVE_DOWNLOAD_LEASES = 2
DOWNLOAD_LEASE_TTL_SECONDS = 600  # 10 minutes
RETENTION_SECONDS = 30 * 86400  # 30 days


class FileShelfError(Exception):
    """Base exception for file shelf repository operations."""
    pass


class QuotaExceededError(FileShelfError):
    pass


class InFlightUploadExistsError(FileShelfError):
    pass


class RateLimitExceededError(FileShelfError):
    pass


class DownloadLeaseBusyError(FileShelfError):
    pass


class ItemNotFoundError(FileShelfError):
    pass


class FileShelfRepository:
    """Atomic repository for File Shelf operations."""

    def __init__(self, session: Session):
        self.session = session

    def reserve_upload_slot(
        self,
        user_id: str,
        filename: str,
        content_type: str,
        size_bytes: int,
        has_exif_warning: bool = False,
    ) -> FileShelfItem:
        """
        Atomically reserve 1 of 5 available slots.
        Enforces:
        - size_bytes <= 25,000,000
        - active slot count (AVAILABLE + CHECKING) < 5
        - in-flight upload count (CHECKING) == 0
        - rolling upload rate limit < 10 per hour
        """
        now = time.time()

        if size_bytes > MAX_FILE_BYTES:
            msg = f"Ukuran berkas ({size_bytes} byte) melebihi batas {MAX_FILE_BYTES} byte (25 MB)."
            raise QuotaExceededError(msg)

        # 1. Check rolling hour rate limit (10 uploads/hr)
        window_start = now - 3600.0
        upload_count = self.session.execute(
            select(func.count(FileRateEvent.id)).where(
                FileRateEvent.user_id == user_id,
                FileRateEvent.event_type == "UPLOAD",
                FileRateEvent.timestamp >= window_start,
            )
        ).scalar() or 0

        if upload_count >= MAX_UPLOADS_PER_HOUR:
            msg = (
                f"Batas upload tercapai ({upload_count}/{MAX_UPLOADS_PER_HOUR} per jam). "
                "Silakan coba lagi nanti."
            )
            raise RateLimitExceededError(msg)

        # 2. Count active slots (CHECKING or AVAILABLE)
        active_items_query = select(FileShelfItem).where(
            FileShelfItem.user_id == user_id,
            FileShelfItem.deleted_at.is_(None),
            FileShelfItem.status.in_(["CHECKING", "AVAILABLE"]),
        )
        # Use with_for_update if DB supports it (PostgreSQL)
        try:
            items = self.session.execute(active_items_query.with_for_update()).scalars().all()
            active_items = list(items)
        except Exception:
            active_items = list(self.session.execute(active_items_query).scalars().all())

        if len(active_items) >= MAX_SLOTS_PER_USER:
            raise QuotaExceededError(
                "Kuota rak berkas penuh (5 dari 5 slot terpakai). Hapus berkas lama."
            )

        # 3. Check for existing in-flight upload
        has_in_flight = any(item.status == "CHECKING" for item in active_items)
        if has_in_flight:
            raise InFlightUploadExistsError(
                "Masih ada berkas yang sedang diproses. Tunggu hingga proses selesai."
            )

        # 4. Create new item in CHECKING status
        item = FileShelfItem(
            id=str(uuid.uuid4()),
            user_id=user_id,
            filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            status="CHECKING",
            has_exif_warning=has_exif_warning,
            uploaded_at=now,
        )
        self.session.add(item)
        self.session.flush()
        return item

    def promote_item(
        self,
        item_id: str,
        sha256_hash: str,
        r2_object_key: str,
        r2_key_id: str,
        r2_etag: str | None = None,
    ) -> FileShelfItem:
        """Promote item from CHECKING to AVAILABLE after successful scan & encryption."""
        item = self.session.get(FileShelfItem, item_id)
        if not item:
            raise ItemNotFoundError(f"Item {item_id} tidak ditemukan.")

        now = time.time()
        item.status = "AVAILABLE"
        item.sha256_hash = sha256_hash
        item.r2_object_key = r2_object_key
        item.r2_key_id = r2_key_id
        item.r2_etag = r2_etag
        item.quarantine_path = None
        item.available_at = now
        item.expires_at = now + RETENTION_SECONDS

        # Record upload rate event upon successful promotion
        self.record_rate_event(item.user_id, "UPLOAD")
        self.session.flush()
        return item

    def mark_item_failed(self, item_id: str, error_message: str) -> FileShelfItem:
        """Mark item as FAILED when virus found, validation failed, or processing error."""
        item = self.session.get(FileShelfItem, item_id)
        if not item:
            raise ItemNotFoundError(f"Item {item_id} tidak ditemukan.")

        item.status = "FAILED"
        item.error_message = error_message
        item.quarantine_path = None
        self.session.flush()
        return item

    def get_item_by_id(self, item_id: str, user_id: str) -> FileShelfItem | None:
        """Fetch item strictly owned by user and not deleted (anti-BOLA)."""
        item = self.session.execute(
            select(FileShelfItem).where(
                FileShelfItem.id == item_id,
                FileShelfItem.user_id == user_id,
                FileShelfItem.deleted_at.is_(None),
            )
        ).scalar_one_or_none()
        return item

    def list_user_items(self, user_id: str) -> list[FileShelfItem]:
        """List active items for user (AVAILABLE and CHECKING), newest first."""
        items = self.session.execute(
            select(FileShelfItem).where(
                FileShelfItem.user_id == user_id,
                FileShelfItem.deleted_at.is_(None),
                FileShelfItem.status.in_(["AVAILABLE", "CHECKING"]),
            ).order_by(FileShelfItem.uploaded_at.desc())
        ).scalars().all()
        return list(items)

    def soft_delete_item(self, user_id: str, item_id: str) -> bool:
        """
        Soft delete item: immediately revoke user access and enqueue R2 deletion job.
        Returns True if deleted, False if item not found/not owned.
        """
        item = self.get_item_by_id(item_id, user_id)
        if not item:
            return False

        now = time.time()
        item.deleted_at = now
        item.status = "DELETED"

        # If file was already pushed to R2, create deletion job
        if item.r2_object_key:
            del_job = FileDeletionJob(
                id=str(uuid.uuid4()),
                file_id=item.id,
                user_id=user_id,
                r2_object_key=item.r2_object_key,
                status="PENDING",
                created_at=now,
                updated_at=now,
            )
            self.session.add(del_job)

        self.session.flush()
        return True

    def acquire_download_lease(self, user_id: str, item_id: str) -> DownloadLease:
        """
        Acquire a download lease.
        Enforces:
        - Item must exist, be AVAILABLE, and belong to user_id
        - User downloads in rolling hour < 30
        - User active leases < 1
        - Global active leases < 2
        """
        now = time.time()
        item = self.get_item_by_id(item_id, user_id)
        if not item or item.status != "AVAILABLE":
            raise ItemNotFoundError("Berkas tidak tersedia untuk diunduh.")

        # Clean expired leases
        self.session.execute(
            delete(DownloadLease).where(DownloadLease.expires_at <= now)
        )

        # 1. Check user rolling hour download count
        window_start = now - 3600.0
        dl_count = self.session.execute(
            select(func.count(FileRateEvent.id)).where(
                FileRateEvent.user_id == user_id,
                FileRateEvent.event_type == "DOWNLOAD",
                FileRateEvent.timestamp >= window_start,
            )
        ).scalar() or 0

        if dl_count >= MAX_DOWNLOADS_PER_HOUR:
            msg = (
                f"Batas unduh tercapai ({dl_count}/{MAX_DOWNLOADS_PER_HOUR} per jam). "
                "Silakan coba lagi nanti."
            )
            raise RateLimitExceededError(msg)

        # 2. Check user active lease
        user_leases = self.session.execute(
            select(func.count(DownloadLease.id)).where(
                DownloadLease.user_id == user_id,
                DownloadLease.expires_at > now,
            )
        ).scalar() or 0

        if user_leases >= MAX_ACTIVE_DOWNLOADS_PER_USER:
            raise DownloadLeaseBusyError(
                "Anda sedang mengunduh berkas lain. Tunggu hingga unduhan selesai."
            )

        # 3. Check global active leases
        global_leases = self.session.execute(
            select(func.count(DownloadLease.id)).where(
                DownloadLease.expires_at > now,
            )
        ).scalar() or 0

        if global_leases >= MAX_GLOBAL_ACTIVE_DOWNLOAD_LEASES:
            raise DownloadLeaseBusyError(
                "Kapasitas unduh server sedang sibuk. Silakan coba kembali dalam beberapa saat."
            )

        # 4. Create lease
        lease = DownloadLease(
            id=str(uuid.uuid4()),
            user_id=user_id,
            file_id=item_id,
            acquired_at=now,
            expires_at=now + DOWNLOAD_LEASE_TTL_SECONDS,
        )
        self.session.add(lease)

        # Record download rate event
        self.record_rate_event(user_id, "DOWNLOAD")
        self.session.flush()
        return lease

    def release_download_lease(self, lease_id: str) -> None:
        """Release download lease immediately upon completion or cancel."""
        self.session.execute(
            delete(DownloadLease).where(DownloadLease.id == lease_id)
        )
        self.session.flush()

    def record_rate_event(self, user_id: str, event_type: str) -> None:
        """Record rate event for rolling limit calculations."""
        event = FileRateEvent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            event_type=event_type,
            timestamp=time.time(),
        )
        self.session.add(event)

    def get_runtime_state(self, key: str) -> Any | None:
        state = self.session.get(RuntimeState, key)
        return state.value if state else None

    def set_runtime_state(self, key: str, value: Any) -> None:
        now = time.time()
        state = self.session.get(RuntimeState, key)
        if state:
            state.value = value
            state.updated_at = now
        else:
            state = RuntimeState(key=key, value=value, updated_at=now)
            self.session.add(state)
        self.session.flush()
