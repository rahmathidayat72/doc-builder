"""
Unit tests for File Shelf Database Models & Repository
Task: FS-03 (Phase File Shelf)
"""

from __future__ import annotations

import time
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import User
from app.db.postgres import Base
from app.db.repositories.file_shelf_repository import (
    DownloadLeaseBusyError,
    FileShelfRepository,
    InFlightUploadExistsError,
    QuotaExceededError,
    RateLimitExceededError,
)


@pytest.fixture
def db_session(tmp_path: Path):
    db_file = tmp_path / f"test_shelf_{uuid.uuid4().hex}.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session: Session = session_factory()

    # Seed test users
    now = time.time()
    u1 = User(
        id="user-1",
        email="user1@example.com",
        name="User Satu",
        email_verified=1,
        created_at=now,
        updated_at=now,
    )
    u2 = User(
        id="user-2",
        email="user2@example.com",
        name="User Dua",
        email_verified=1,
        created_at=now,
        updated_at=now,
    )
    session.add_all([u1, u2])
    session.commit()

    try:
        yield session
    finally:
        session.close()


def test_reserve_upload_slot_success_and_in_flight_blocked(db_session: Session):
    repo = FileShelfRepository(db_session)

    # 1. Reserve first slot
    item1 = repo.reserve_upload_slot(
        user_id="user-1",
        filename="document.pdf",
        content_type="application/pdf",
        size_bytes=1024,
    )
    assert item1.id is not None
    assert item1.status == "CHECKING"
    assert item1.user_id == "user-1"
    db_session.commit()

    # 2. In-flight upload blocked when previous item is still CHECKING
    with pytest.raises(InFlightUploadExistsError):
        repo.reserve_upload_slot(
            user_id="user-1",
            filename="document2.pdf",
            content_type="application/pdf",
            size_bytes=2048,
        )

    # 3. Promote item 1 to AVAILABLE
    promoted = repo.promote_item(
        item_id=item1.id,
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        r2_object_key="user-1/doc1.enc",
        r2_key_id="k2026",
        r2_etag="etag123",
    )
    assert promoted.status == "AVAILABLE"
    assert promoted.expires_at > promoted.available_at
    db_session.commit()

    # 4. Now second slot can be reserved
    item2 = repo.reserve_upload_slot(
        user_id="user-1",
        filename="document2.pdf",
        content_type="application/pdf",
        size_bytes=2048,
    )
    assert item2.id is not None
    assert item2.status == "CHECKING"


def test_reserve_upload_slot_capacity_limit_5_slots(db_session: Session):
    repo = FileShelfRepository(db_session)

    # Fill 5 slots for user-1
    for i in range(1, 6):
        item = repo.reserve_upload_slot(
            user_id="user-1",
            filename=f"doc_{i}.pdf",
            content_type="application/pdf",
            size_bytes=1000,
        )
        repo.promote_item(
            item_id=item.id,
            sha256_hash=f"hash_{i}",
            r2_object_key=f"user-1/doc_{i}.enc",
            r2_key_id="k2026",
        )
        db_session.commit()

    items = repo.list_user_items("user-1")
    assert len(items) == 5

    # 6th slot must raise QuotaExceededError
    with pytest.raises(QuotaExceededError) as exc_info:
        repo.reserve_upload_slot(
            user_id="user-1",
            filename="doc_6.pdf",
            content_type="application/pdf",
            size_bytes=1000,
        )
    assert "5 dari 5 slot" in str(exc_info.value)


def test_reserve_upload_slot_size_limit(db_session: Session):
    repo = FileShelfRepository(db_session)

    with pytest.raises(QuotaExceededError) as exc:
        repo.reserve_upload_slot(
            user_id="user-1",
            filename="giant.pdf",
            content_type="application/pdf",
            size_bytes=25_000_001,  # 1 byte over 25 MB
        )
    assert "25 MB" in str(exc.value)


def test_upload_rolling_rate_limit(db_session: Session):
    repo = FileShelfRepository(db_session)

    # Simulate 10 upload events in the last hour
    for _ in range(10):
        repo.record_rate_event("user-1", "UPLOAD")
    db_session.commit()

    # 11th upload should be rejected by rolling rate limit
    with pytest.raises(RateLimitExceededError):
        repo.reserve_upload_slot(
            user_id="user-1",
            filename="doc_rate.pdf",
            content_type="application/pdf",
            size_bytes=1000,
        )


def test_download_lease_concurrency_and_rate_limit(db_session: Session):
    repo = FileShelfRepository(db_session)

    # Create available items
    item1 = repo.reserve_upload_slot(
        user_id="user-1",
        filename="file1.pdf",
        content_type="application/pdf",
        size_bytes=500,
    )
    repo.promote_item(item1.id, "hash1", "u1/f1.enc", "k1")

    item2 = repo.reserve_upload_slot(
        user_id="user-2",
        filename="file2.pdf",
        content_type="application/pdf",
        size_bytes=500,
    )
    repo.promote_item(item2.id, "hash2", "u2/f2.enc", "k1")
    db_session.commit()

    # 1. Acquire lease 1 for user-1
    lease1 = repo.acquire_download_lease("user-1", item1.id)
    assert lease1.id is not None
    db_session.commit()

    # 2. Attempting 2nd concurrent download for same user raises DownloadLeaseBusyError
    with pytest.raises(DownloadLeaseBusyError):
        repo.acquire_download_lease("user-1", item1.id)

    # 3. User 2 acquires 2nd global lease
    lease2 = repo.acquire_download_lease("user-2", item2.id)
    assert lease2.id is not None
    db_session.commit()

    # 4. Global limit reached (2 leases). Attempting 3rd global lease raises DownloadLeaseBusyError
    item3 = repo.reserve_upload_slot(
        user_id="user-1",
        filename="file3.pdf",
        content_type="application/pdf",
        size_bytes=500,
    )
    repo.promote_item(item3.id, "hash3", "u1/f3.enc", "k1")
    db_session.commit()

    # Release lease1 for user-1 first so user-level limit doesn't trigger
    repo.release_download_lease(lease1.id)
    db_session.commit()

    # Re-acquire lease 1 to have 2 active leases again
    repo.acquire_download_lease("user-1", item1.id)
    db_session.commit()

    # Now both user-1 and user-2 have 1 lease (total 2 global)
    # Attempting to get lease on item3 while global = 2 must raise DownloadLeaseBusyError
    with pytest.raises(DownloadLeaseBusyError):
        repo.acquire_download_lease("user-1", item3.id)


def test_soft_delete_and_anti_bola(db_session: Session):
    repo = FileShelfRepository(db_session)

    item = repo.reserve_upload_slot(
        user_id="user-1",
        filename="secret.pdf",
        content_type="application/pdf",
        size_bytes=1000,
    )
    repo.promote_item(item.id, "hash", "u1/secret.enc", "k1")
    db_session.commit()

    # Anti-BOLA: user-2 cannot get user-1's file
    assert repo.get_item_by_id(item.id, "user-2") is None

    # Anti-BOLA: user-2 cannot delete user-1's file
    assert not repo.soft_delete_item("user-2", item.id)

    # User 1 can delete their own file
    assert repo.soft_delete_item("user-1", item.id)
    db_session.commit()

    # Deleted item is no longer returned
    assert repo.get_item_by_id(item.id, "user-1") is None
    assert len(repo.list_user_items("user-1")) == 0


def test_runtime_state_upsert(db_session: Session):
    repo = FileShelfRepository(db_session)

    assert repo.get_runtime_state("r2_metrics") is None

    repo.set_runtime_state("r2_metrics", {"class_a": 120, "class_b": 450, "storage_bytes": 1024})
    db_session.commit()

    state = repo.get_runtime_state("r2_metrics")
    assert state == {"class_a": 120, "class_b": 450, "storage_bytes": 1024}

    # Update state
    repo.set_runtime_state("r2_metrics", {"class_a": 200, "class_b": 600, "storage_bytes": 2048})
    db_session.commit()

    updated = repo.get_runtime_state("r2_metrics")
    assert updated["class_a"] == 200
    assert updated["storage_bytes"] == 2048
