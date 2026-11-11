"""
Integration and Unit Tests for Satukit File Shelf API
Task: FS-06 (Phase File Shelf)
Tests authentication, raw stream upload, quota & in-flight limits, anti-BOLA,
on-the-fly download decryption with leases, soft-deletion, and metrics.
"""

from __future__ import annotations

import base64
import json
import os
import time
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.file_shelf import set_file_shelf_engine_override
from app.core.security import SESSION_COOKIE_NAME
from app.db.models import FileDeletionJob, FileShelfItem, RuntimeState, User
from app.db.postgres import Base
from app.db.repositories.auth_repository import AuthRepository
from app.main import app
from app.services.auth_service import auth_service
from app.services.file_crypto import (
    KeyringManager,
    encrypt_file_envelope,
    set_global_keyring_manager,
)
from app.services.r2_storage import InMemoryR2StorageClient, set_global_r2_storage


@pytest.fixture
def shelf_test_env(tmp_path: Path):
    # 1. Setup isolated SQLite database
    db_file = tmp_path / f"test_shelf_api_{uuid.uuid4().hex}.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    set_file_shelf_engine_override(engine)

    # 2. Wire AuthRepository to same DB
    auth_repo = AuthRepository(session_factory)
    orig_auth_repo = auth_service._repo
    auth_service._repo = auth_repo

    # 3. Setup test keyring & crypto
    key_bytes = b"01234567890123456789012345678901"
    keyring_doc = {
        "version": 1,
        "active_key_id": "k-test-1",
        "keys": [{"id": "k-test-1", "secret_b64": base64.b64encode(key_bytes).decode()}],
    }
    keyring = KeyringManager(keyring_doc=keyring_doc)
    set_global_keyring_manager(keyring)

    # 4. Setup InMemory R2 Storage
    r2_client = InMemoryR2StorageClient()
    set_global_r2_storage(r2_client)

    # 5. Setup quarantine dir in tmp_path
    quarantine_dir = tmp_path / "quarantine"
    quarantine_dir.mkdir(parents=True, exist_ok=True)
    orig_env_q = os.environ.get("SATUKIT_QUARANTINE_DIR")
    os.environ["SATUKIT_QUARANTINE_DIR"] = str(quarantine_dir)

    yield {
        "engine": engine,
        "session_factory": session_factory,
        "auth_repo": auth_repo,
        "keyring": keyring,
        "r2_client": r2_client,
        "quarantine_dir": quarantine_dir,
    }

    # Teardown
    auth_service._repo = orig_auth_repo
    set_file_shelf_engine_override(None)
    set_global_keyring_manager(None)
    set_global_r2_storage(None)
    if orig_env_q is not None:
        os.environ["SATUKIT_QUARANTINE_DIR"] = orig_env_q
    else:
        os.environ.pop("SATUKIT_QUARANTINE_DIR", None)


def create_authenticated_user(
    shelf_test_env: dict,
    email: str = "tester@example.com",
    name: str = "Tester Satukit",
    email_verified: bool = True,
) -> tuple[str, str, str]:
    session_factory: sessionmaker[Session] = shelf_test_env["session_factory"]
    now = time.time()
    user_id = str(uuid.uuid4())

    with session_factory() as session:
        user = User(
            id=user_id,
            email=email,
            name=name,
            password_hash="test-password-hash",
            email_verified=1 if email_verified else 0,
            created_at=now,
            updated_at=now,
        )
        session.add(user)
        session.commit()

    sess_token, csrf_token, _ = auth_service.create_session(user_id)
    return user_id, sess_token, csrf_token


def make_metadata_header(
    filename: str,
    content_type: str = "application/pdf",
    has_exif_warning: bool = False,
) -> str:
    payload = {
        "filename": filename,
        "content_type": content_type,
        "has_exif_warning": has_exif_warning,
    }
    raw = json.dumps(payload).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def test_unauthenticated_requests_blocked(shelf_test_env: dict):
    client = TestClient(app)
    assert client.get("/api/files").status_code == 401
    assert client.post("/api/files/upload").status_code == 401
    assert client.get("/api/files/test-id/download").status_code == 401
    assert client.delete("/api/files/test-id").status_code == 401
    assert client.get("/api/files/metrics").status_code == 401


def test_unverified_email_blocked(shelf_test_env: dict):
    _user, sess_token, csrf = create_authenticated_user(
        shelf_test_env,
        email="unverified@example.com",
        email_verified=False,
    )
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess_token)
    res = client.get("/api/files", headers={"X-CSRF-Token": csrf})
    assert res.status_code == 403
    assert "belum diverifikasi" in res.json().get("detail", "")


def test_upload_metadata_validation(shelf_test_env: dict):
    _user, sess_token, csrf = create_authenticated_user(shelf_test_env)
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess_token)
    headers = {"X-CSRF-Token": csrf}

    # 1. Missing metadata header
    res1 = client.post("/api/files/upload", content=b"content", headers=headers)
    assert res1.status_code == 400
    assert "X-File-Metadata" in res1.json()["detail"]

    # 2. Corrupt base64 header
    bad_headers = dict(headers, **{"X-File-Metadata": "!!!not_base64!!!"})
    res2 = client.post("/api/files/upload", content=b"content", headers=bad_headers)
    assert res2.status_code == 400

    # 3. Empty filename in metadata
    empty_fn_meta = make_metadata_header(filename="")
    res3 = client.post(
        "/api/files/upload",
        content=b"content",
        headers=dict(headers, **{"X-File-Metadata": empty_fn_meta}),
    )
    assert res3.status_code == 400

    # 4. Empty file content (0 byte)
    valid_meta = make_metadata_header(filename="doc.pdf")
    res4 = client.post(
        "/api/files/upload",
        content=b"",
        headers=dict(headers, **{"X-File-Metadata": valid_meta}),
    )
    assert res4.status_code == 400
    assert "kosong" in res4.json()["detail"]


def test_upload_success_and_quarantine(shelf_test_env: dict):
    _user, sess_token, csrf = create_authenticated_user(shelf_test_env)
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess_token)

    meta = make_metadata_header(filename="laporan_keuangan.pdf", content_type="application/pdf")
    headers = {"X-CSRF-Token": csrf, "X-File-Metadata": meta}
    file_bytes = b"%PDF-1.4 sample file content"

    res = client.post("/api/files/upload", content=file_bytes, headers=headers)
    assert res.status_code == 202
    data = res.json()["data"]
    assert data["status"] == "CHECKING"
    assert data["filename"] == "laporan_keuangan.pdf"
    assert data["size_bytes"] == len(file_bytes)
    item_id = data["id"]

    # Verify quarantine file created
    q_file = shelf_test_env["quarantine_dir"] / f"quarantine_{item_id}.bin"
    assert q_file.exists()
    assert q_file.read_bytes() == file_bytes


def test_upload_inflight_conflict_and_quota_limits(shelf_test_env: dict):
    user_id, sess_token, csrf = create_authenticated_user(shelf_test_env)
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess_token)

    meta1 = make_metadata_header(filename="file1.pdf")
    headers = {"X-CSRF-Token": csrf, "X-File-Metadata": meta1}

    # 1. First upload -> Accepted (Status: CHECKING)
    res1 = client.post("/api/files/upload", content=b"content-1", headers=headers)
    assert res1.status_code == 202
    item1_id = res1.json()["data"]["id"]

    # 2. Second upload while first is still CHECKING -> 409 Conflict
    meta2 = make_metadata_header(filename="file2.pdf")
    headers2 = {"X-CSRF-Token": csrf, "X-File-Metadata": meta2}
    res2 = client.post("/api/files/upload", content=b"content-2", headers=headers2)
    assert res2.status_code == 409
    assert "sedang diproses" in res2.json()["detail"]

    # 3. Simulate worker promoting item 1 to AVAILABLE
    session_factory: sessionmaker[Session] = shelf_test_env["session_factory"]
    with session_factory() as session:
        it = session.get(FileShelfItem, item1_id)
        it.status = "AVAILABLE"
        session.commit()

    # Now second upload succeeds
    res2_retry = client.post("/api/files/upload", content=b"content-2", headers=headers2)
    assert res2_retry.status_code == 202
    item2_id = res2_retry.json()["data"]["id"]

    # Promote item 2, and add 3 more items to reach 5 slots
    with session_factory() as session:
        it2 = session.get(FileShelfItem, item2_id)
        it2.status = "AVAILABLE"
        now = time.time()
        for idx in range(3, 6):
            extra = FileShelfItem(
                id=str(uuid.uuid4()),
                user_id=user_id,
                filename=f"file{idx}.pdf",
                content_type="application/pdf",
                size_bytes=1000,
                status="AVAILABLE",
                uploaded_at=now,
            )
            session.add(extra)
        session.commit()

    # 4. Attempt 6th upload -> 400 Bad Request (5 of 5 slots used)
    meta6 = make_metadata_header(filename="file6.pdf")
    headers6 = {"X-CSRF-Token": csrf, "X-File-Metadata": meta6}
    res6 = client.post("/api/files/upload", content=b"content-6", headers=headers6)
    assert res6.status_code == 400
    assert "penuh" in res6.json()["detail"].lower()


def test_list_files_anti_bola(shelf_test_env: dict):
    u1_id, tok1, csrf1 = create_authenticated_user(shelf_test_env, email="u1@example.com")
    u2_id, tok2, csrf2 = create_authenticated_user(shelf_test_env, email="u2@example.com")

    session_factory: sessionmaker[Session] = shelf_test_env["session_factory"]
    now = time.time()
    with session_factory() as session:
        # User 1 has 2 items
        session.add(
            FileShelfItem(
                id="item-u1-1",
                user_id=u1_id,
                filename="doc1.pdf",
                content_type="application/pdf",
                size_bytes=500,
                status="AVAILABLE",
                uploaded_at=now,
            )
        )
        session.add(
            FileShelfItem(
                id="item-u1-2",
                user_id=u1_id,
                filename="doc2.pdf",
                content_type="application/pdf",
                size_bytes=800,
                status="CHECKING",
                uploaded_at=now + 1,
            )
        )
        # User 2 has 1 item
        session.add(
            FileShelfItem(
                id="item-u2-1",
                user_id=u2_id,
                filename="secret_u2.pdf",
                content_type="application/pdf",
                size_bytes=1200,
                status="AVAILABLE",
                uploaded_at=now,
            )
        )
        session.commit()

    client = TestClient(app)

    # User 1 queries
    client.cookies.set(SESSION_COOKIE_NAME, tok1)
    res1 = client.get("/api/files", headers={"X-CSRF-Token": csrf1})
    assert res1.status_code == 200
    u1_items = res1.json()["data"]
    assert len(u1_items) == 2
    u1_ids = [it["id"] for it in u1_items]
    assert "item-u1-1" in u1_ids
    assert "item-u1-2" in u1_ids
    assert "item-u2-1" not in u1_ids

    # User 2 queries
    client.cookies.set(SESSION_COOKIE_NAME, tok2)
    res2 = client.get("/api/files", headers={"X-CSRF-Token": csrf2})
    assert res2.status_code == 200
    u2_items = res2.json()["data"]
    assert len(u2_items) == 1
    assert u2_items[0]["id"] == "item-u2-1"


def test_download_flow_and_anti_bola(shelf_test_env: dict):
    u1_id, tok1, csrf1 = create_authenticated_user(shelf_test_env, email="u1@example.com")
    _u2_id, tok2, _csrf2 = create_authenticated_user(shelf_test_env, email="u2@example.com")

    session_factory: sessionmaker[Session] = shelf_test_env["session_factory"]
    r2_client = shelf_test_env["r2_client"]

    # Seed encrypted file in R2 for User 1
    item_id = "download-item-1"
    raw_content = b"Confidential financial statement 2026"
    content_type = "application/pdf"
    encrypted_bytes, _ = encrypt_file_envelope(
        plaintext=raw_content,
        user_id=u1_id,
        item_id=item_id,
        content_type=content_type,
    )

    r2_key = f"files/{u1_id}/{item_id}/payload.enc"
    r2_client.upload_object(r2_key, encrypted_bytes)

    now = time.time()
    with session_factory() as session:
        session.add(
            FileShelfItem(
                id=item_id,
                user_id=u1_id,
                filename="financials.pdf",
                content_type=content_type,
                size_bytes=len(raw_content),
                status="AVAILABLE",
                r2_object_key=r2_key,
                r2_key_id="k-test-1",
                uploaded_at=now,
                available_at=now,
            )
        )
        session.commit()

    client = TestClient(app)

    # 1. User 2 tries to download User 1's item -> Anti-BOLA: 404 Not Found
    client.cookies.set(SESSION_COOKIE_NAME, tok2)
    res_bola = client.get(f"/api/files/{item_id}/download")
    assert res_bola.status_code == 404

    # 2. User 1 downloads own item -> 200 OK with decrypted bytes
    client.cookies.set(SESSION_COOKIE_NAME, tok1)
    res_ok = client.get(f"/api/files/{item_id}/download")
    assert res_ok.status_code == 200
    assert res_ok.content == raw_content
    assert "financials.pdf" in res_ok.headers.get("Content-Disposition", "")
    assert res_ok.headers.get("Content-Type") == "application/pdf"


def test_delete_file_anti_bola_and_r2_job(shelf_test_env: dict):
    u1_id, tok1, csrf1 = create_authenticated_user(shelf_test_env, email="u1@example.com")
    _u2_id, tok2, csrf2 = create_authenticated_user(shelf_test_env, email="u2@example.com")

    session_factory: sessionmaker[Session] = shelf_test_env["session_factory"]
    item_id = "del-item-1"
    r2_key = f"files/{u1_id}/{item_id}/payload.enc"

    with session_factory() as session:
        session.add(
            FileShelfItem(
                id=item_id,
                user_id=u1_id,
                filename="to_delete.pdf",
                content_type="application/pdf",
                size_bytes=500,
                status="AVAILABLE",
                r2_object_key=r2_key,
                uploaded_at=time.time(),
            )
        )
        session.commit()

    client = TestClient(app)

    # 1. User 2 cannot delete User 1's file -> 404
    client.cookies.set(SESSION_COOKIE_NAME, tok2)
    res_del_u2 = client.delete(f"/api/files/{item_id}", headers={"X-CSRF-Token": csrf2})
    assert res_del_u2.status_code == 404

    # 2. User 1 deletes file -> 200 OK
    client.cookies.set(SESSION_COOKIE_NAME, tok1)
    res_del_u1 = client.delete(f"/api/files/{item_id}", headers={"X-CSRF-Token": csrf1})
    assert res_del_u1.status_code == 200

    # Verify item status DELETED and deletion job enqueued
    with session_factory() as session:
        it = session.get(FileShelfItem, item_id)
        assert it.status == "DELETED"
        assert it.deleted_at is not None

        job = session.query(FileDeletionJob).filter_by(file_id=item_id).first()
        assert job is not None
        assert job.r2_object_key == r2_key


def test_metrics_endpoint(shelf_test_env: dict):
    u1_id, tok1, _csrf = create_authenticated_user(shelf_test_env)
    session_factory: sessionmaker[Session] = shelf_test_env["session_factory"]

    with session_factory() as session:
        session.add(
            FileShelfItem(
                id="item-metric-1",
                user_id=u1_id,
                filename="file.pdf",
                content_type="application/pdf",
                size_bytes=2500,
                status="AVAILABLE",
                uploaded_at=time.time(),
            )
        )
        session.commit()

    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, tok1)
    res = client.get("/api/files/metrics")
    assert res.status_code == 200
    m = res.json()["data"]
    assert m["slots_used"] == 1
    assert m["slots_total"] == 5
    assert m["storage_used_bytes"] == 2500
    assert m["r2_storage_status"] == "HEALTHY"


def test_r2_storage_fail_closed_blocking(shelf_test_env: dict):
    u1, tok1, csrf1 = create_authenticated_user(shelf_test_env)
    session_factory: sessionmaker[Session] = shelf_test_env["session_factory"]

    # 1. Set Class A operations >= 800k in RuntimeState
    with session_factory() as session:
        state = RuntimeState(
            key="r2_metrics",
            value={
                "storage_bytes": 100_000,
                "class_a_operations": 850_000,
                "class_b_operations": 10_000,
                "last_polled_at": time.time(),
            },
            updated_at=time.time(),
        )
        session.merge(state)
        session.commit()

    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, tok1)
    meta = make_metadata_header(filename="blocked.pdf")
    headers = {"X-CSRF-Token": csrf1, "X-File-Metadata": meta}

    # Upload should be blocked with 503
    res_up = client.post("/api/files/upload", content=b"data", headers=headers)
    assert res_up.status_code == 503

    # 2. Reset Class A to normal, set Class B operations >= 8M
    with session_factory() as session:
        state = RuntimeState(
            key="r2_metrics",
            value={
                "storage_bytes": 100_000,
                "class_a_operations": 10_000,
                "class_b_operations": 8_500_000,
                "last_polled_at": time.time(),
            },
            updated_at=time.time(),
        )
        session.merge(state)
        session.commit()

    # Download should be blocked with 503
    res_dl = client.get("/api/files/any-id/download")
    assert res_dl.status_code == 503
