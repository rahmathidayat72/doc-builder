from __future__ import annotations

import time
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import generate_secure_token, hash_token
from app.db.models import User, UserSession
from app.db.postgres import Base
from app.db.repositories.resume_draft_repository import (
    DraftNotFoundError,
    DraftQuotaExceededError,
    DraftSizeExceededError,
    ResumeDraftRepository,
)
from app.main import app
from app.services.auth_service import auth_service
from app.services.draft_cleaner import DraftCleanerWorker


@pytest.fixture
def repo(tmp_path: Path) -> ResumeDraftRepository:
    db_file = tmp_path / f"test_drafts_{uuid.uuid4().hex}.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return ResumeDraftRepository(session_factory=session_factory)


def test_create_and_get_draft(repo: ResumeDraftRepository) -> None:
    now = time.time()
    payload = {
        "title": "CV Insinyur",
        "templateId": "ats-clean",
        "colorTheme": "#0d9488",
        "data": {"contact": {"fullName": "Budi Santoso"}},
    }

    created = repo.create_draft(user_id="user-1", draft_dict=payload, now=now)
    assert created["id"] is not None
    assert created["title"] == "CV Insinyur"
    assert created["templateId"] == "ats-clean"
    assert created["colorTheme"] == "#0d9488"
    assert created["data"]["contact"]["fullName"] == "Budi Santoso"
    assert created["createdAt"] == int(now * 1000)
    assert created["updatedAt"] == int(now * 1000)
    assert created["expiresAt"] == int((now + 30 * 86400) * 1000)

    # Ambil detail
    fetched = repo.get_draft(created["id"], user_id="user-1", now=now + 100)
    assert fetched is not None
    assert fetched["id"] == created["id"]
    # Membaca draf TIDAK memperpanjang expiresAt
    assert fetched["expiresAt"] == created["expiresAt"]


def test_update_draft_extends_30_days_retention(repo: ResumeDraftRepository) -> None:
    t0 = time.time()
    created = repo.create_draft(
        user_id="user-1",
        draft_dict={"title": "Versi A", "data": {}},
        now=t0,
    )

    t1 = t0 + 10 * 86400  # 10 hari kemudian
    updated = repo.update_draft(
        draft_id=created["id"],
        user_id="user-1",
        draft_dict={"title": "Versi B", "data": {"skills": ["Python"]}},
        now=t1,
    )

    assert updated["title"] == "Versi B"
    assert updated["updatedAt"] == int(t1 * 1000)
    # Retensi diperpanjang 30 hari dari t1
    assert updated["expiresAt"] == int((t1 + 30 * 86400) * 1000)


def test_bola_isolation_between_accounts(repo: ResumeDraftRepository) -> None:
    now = time.time()
    draft_a = repo.create_draft(
        user_id="user-a",
        draft_dict={"title": "CV Rahasia User A", "data": {}},
        now=now,
    )

    # User B tidak boleh bisa melihat draf User A
    assert repo.get_draft(draft_a["id"], user_id="user-b", now=now) is None

    # User B tidak boleh bisa mengubah draf User A
    with pytest.raises(DraftNotFoundError):
        repo.update_draft(
            draft_id=draft_a["id"],
            user_id="user-b",
            draft_dict={"title": "Hacked"},
            now=now,
        )

    # User B tidak boleh bisa menghapus draf User A
    assert repo.soft_delete(draft_a["id"], user_id="user-b") is False

    # Daftar draf User B kosong
    assert len(repo.list_drafts(user_id="user-b", now=now)) == 0


def test_quota_max_5_drafts_per_account(repo: ResumeDraftRepository) -> None:
    now = time.time()
    for i in range(5):
        repo.create_draft(
            user_id="user-1",
            draft_dict={"title": f"Draf {i+1}", "data": {}},
            now=now,
        )

    # Draf ke-6 harus ditolak
    with pytest.raises(DraftQuotaExceededError, match="Batas kuota 5 draf"):
        repo.create_draft(
            user_id="user-1",
            draft_dict={"title": "Draf 6 Melebihi", "data": {}},
            now=now,
        )


def test_max_draft_size_and_total_size(repo: ResumeDraftRepository) -> None:
    now = time.time()
    # 1. Melebihi 10 MB per draf
    huge_data = {"text": "x" * (10 * 1024 * 1024 + 100)}
    with pytest.raises(DraftSizeExceededError, match="melebihi batas maksimum 10 MB"):
        repo.create_draft(
            user_id="user-1",
            draft_dict={"title": "Draf Raksasa", "data": huge_data},
            now=now,
        )


def test_soft_delete_and_10_seconds_undo(repo: ResumeDraftRepository) -> None:
    now = time.time()
    created = repo.create_draft(
        user_id="user-1",
        draft_dict={"title": "Draf Akan Dihapus", "data": {}},
        now=now,
    )

    # Soft delete
    assert repo.soft_delete(created["id"], user_id="user-1", now=now) is True

    # Tidak muncul di list aktif
    assert len(repo.list_drafts(user_id="user-1", now=now)) == 0
    # Tidak bisa di-get
    assert repo.get_draft(created["id"], user_id="user-1", now=now) is None

    # Undo berhasil jika masih dalam window 10 detik (misal 5 detik kemudian)
    restored = repo.restore_draft(created["id"], user_id="user-1", now=now + 5.0)
    assert restored is not None
    assert restored["id"] == created["id"]
    assert len(repo.list_drafts(user_id="user-1", now=now + 5.0)) == 1

    # Soft delete lagi
    repo.soft_delete(created["id"], user_id="user-1", now=now + 10.0)

    # Undo GAGAL jika telah melewati window 10 detik (misal 11 detik kemudian)
    failed_restore = repo.restore_draft(created["id"], user_id="user-1", now=now + 21.1)
    assert failed_restore is None

    # Dan draf telah dibersihkan permanen
    assert repo.get_draft(created["id"], user_id="user-1", now=now + 25.0) is None


def test_30_days_retention_auto_purge(repo: ResumeDraftRepository) -> None:
    t0 = time.time()
    draft = repo.create_draft(
        user_id="user-1",
        draft_dict={"title": "Draf Kedaluwarsa", "data": {}},
        now=t0,
    )

    # 29 hari kemudian: masih ada
    t_29d = t0 + 29 * 86400
    assert repo.get_draft(draft["id"], user_id="user-1", now=t_29d) is not None

    # 30 hari + 1 detik kemudian: kedaluwarsa -> get_draft mengembalikan None & menghapus
    t_30d = t0 + 30 * 86400 + 1
    assert repo.get_draft(draft["id"], user_id="user-1", now=t_30d) is None

    # Purge worker juga membersihkan
    repo.create_draft(
        user_id="user-1",
        draft_dict={"title": "Draf 2", "data": {}},
        now=t0,
    )
    purged_count = repo.purge_expired(now=t_30d)
    assert purged_count >= 1
    assert len(repo.list_drafts(user_id="user-1", now=t_30d)) == 0


def test_draft_cleaner_worker_lifecycle(repo: ResumeDraftRepository) -> None:
    worker = DraftCleanerWorker(repo=repo, interval_seconds=0.5)
    assert worker.is_running is False
    worker.start()
    assert worker.is_running is True
    # Stop cleanly
    worker.stop()
    assert worker.is_running is False


# --- API Endpoint Integration Tests ---

def test_api_drafts_auth_and_crud(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_file = tmp_path / "test_api_drafts.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    test_repo = ResumeDraftRepository(session_factory=session_factory)
    monkeypatch.setattr("app.api.drafts.resume_draft_repo", test_repo)

    # Buat dua user uji
    now = time.time()
    with session_factory() as session:
        u1 = User(
            id="uid-alice",
            email="alice@example.com",
            password_hash="hashed",
            name="Alice",
            email_verified=1,
            created_at=now,
            updated_at=now,
        )
        u2 = User(
            id="uid-bob",
            email="bob@example.com",
            password_hash="hashed",
            name="Bob",
            email_verified=1,
            created_at=now,
            updated_at=now,
        )
        session.add_all([u1, u2])

        # Sesi Alice
        raw_token_alice = generate_secure_token()
        session_alice = UserSession(
            token_hash=hash_token(raw_token_alice),
            user_id="uid-alice",
            csrf_token="csrf-alice-123",
            created_at=now,
            expires_at=now + 86400,
        )
        # Sesi Bob
        raw_token_bob = generate_secure_token()
        session_bob = UserSession(
            token_hash=hash_token(raw_token_bob),
            user_id="uid-bob",
            csrf_token="csrf-bob-123",
            created_at=now,
            expires_at=now + 86400,
        )
        session.add_all([session_alice, session_bob])
        session.commit()

    # Monkeypatch auth_service repo agar middleware memvalidasi sesi
    from app.db.repositories.auth_repository import AuthRepository
    auth_repo = AuthRepository(session_factory=session_factory)
    monkeypatch.setattr(auth_service, "_repo", auth_repo)

    client = TestClient(app)

    # 1. Akses tanpa auth -> 401
    res = client.get("/api/drafts")
    assert res.status_code == 401

    # 2. Alice membuat draf (dengan cookie sesi + header CSRF)
    alice_cookies = {"satukit_session": raw_token_alice}
    alice_headers = {"X-CSRF-Token": "csrf-alice-123"}

    res = client.post(
        "/api/drafts",
        json={"title": "CV Pertama Alice", "data": {"contact": {"fullName": "Alice"}}},
        cookies=alice_cookies,
        headers=alice_headers,
    )
    assert res.status_code == 200
    created = res.json()
    assert created["id"] is not None
    assert created["title"] == "CV Pertama Alice"
    draft_id = created["id"]

    # 3. Alice membaca list -> ada 1 draf
    res = client.get("/api/drafts", cookies=alice_cookies)
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["id"] == draft_id
    assert items[0]["title"] == "CV Pertama Alice"

    # 4. Bob membaca list -> 0 draf (isolasi penuh)
    bob_cookies = {"satukit_session": raw_token_bob}
    res = client.get("/api/drafts", cookies=bob_cookies)
    assert res.status_code == 200
    assert len(res.json()) == 0

    # 5. Bob mencoba membaca draf Alice -> 404 (BOLA guard)
    res = client.get(f"/api/drafts/{draft_id}", cookies=bob_cookies)
    assert res.status_code == 404

    # 6. Alice memperbarui draf
    res = client.put(
        f"/api/drafts/{draft_id}",
        json={"title": "CV Revisi Alice", "data": {"contact": {"fullName": "Alice Updated"}}},
        cookies=alice_cookies,
        headers=alice_headers,
    )
    assert res.status_code == 200
    assert res.json()["title"] == "CV Revisi Alice"

    # 7. Alice soft delete
    res = client.delete(
        f"/api/drafts/{draft_id}",
        cookies=alice_cookies,
        headers=alice_headers,
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    # 8. Alice restore sebelum 10 detik
    res = client.post(
        f"/api/drafts/{draft_id}/restore",
        cookies=alice_cookies,
        headers=alice_headers,
    )
    assert res.status_code == 200
    assert res.json()["id"] == draft_id

    # 9. Hard delete
    res = client.delete(
        f"/api/drafts/{draft_id}/permanent",
        cookies=alice_cookies,
        headers=alice_headers,
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    # 10. Sekarang sudah tidak ada sama sekali
    res = client.get(f"/api/drafts/{draft_id}", cookies=alice_cookies)
    assert res.status_code == 404
