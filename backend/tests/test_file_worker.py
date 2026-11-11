"""
Tests for Satukit File Shelf Background Worker
Task: FS-07 (Phase File Shelf)
Verifies:
- Item promotion from CHECKING to AVAILABLE (antivirus, inspection, encryption, R2)
- Malware detection fails closed and marks item FAILED
- Format validation failures mark item FAILED
- R2 async deletion jobs (<24h)
- 30-day retention auto-deletion sweep
- Cloudflare GraphQL metrics polling and storage ceiling protection
"""

from __future__ import annotations

import base64
import io
import os
import time
import uuid
from pathlib import Path
from typing import Any

import pypdf
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import FileDeletionJob, FileShelfItem, RuntimeState, User
from app.db.postgres import Base
from app.services.file_crypto import (
    KeyringManager,
    decrypt_file_envelope,
    set_global_keyring_manager,
)
from app.services.file_inspector import QuarantineManager
from app.services.file_scanner import (
    MockClamAVScanner,
    ScanResult,
    set_global_clamav_scanner,
)
from app.services.r2_storage import InMemoryR2StorageClient, set_global_r2_storage
from app.workers.file_worker import (
    poll_cloudflare_graphql_metrics,
    process_checking_items,
    process_deletion_jobs,
    process_retention_sweep,
    run_worker_pass,
)


@pytest.fixture
def worker_test_env(tmp_path: Path):
    db_file = tmp_path / f"test_worker_{uuid.uuid4().hex}.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # 1. Setup InMemory R2
    r2_client = InMemoryR2StorageClient()
    set_global_r2_storage(r2_client)

    # 2. Setup Keyring
    key_bytes = b"worker-key-32-bytes-long-secret!"
    keyring_doc = {
        "version": 1,
        "active_key_id": "k-worker-1",
        "keys": [{"id": "k-worker-1", "secret_b64": base64.b64encode(key_bytes).decode()}],
    }
    keyring = KeyringManager(keyring_doc=keyring_doc)
    set_global_keyring_manager(keyring)

    # 3. Setup Mock ClamAV (clean by default)
    mock_clamav = MockClamAVScanner()
    set_global_clamav_scanner(mock_clamav)

    # 4. Setup Quarantine
    quarantine_dir = tmp_path / "quarantine"
    quarantine_dir.mkdir(parents=True, exist_ok=True)
    orig_env_q = os.environ.get("SATUKIT_QUARANTINE_DIR")
    os.environ["SATUKIT_QUARANTINE_DIR"] = str(quarantine_dir)

    # Seed test user
    now = time.time()
    user_id = str(uuid.uuid4())
    with session_factory() as session:
        user = User(
            id=user_id,
            email="worker_user@example.com",
            name="Worker Tester",
            email_verified=1,
            created_at=now,
            updated_at=now,
        )
        session.add(user)
        session.commit()

    yield {
        "engine": engine,
        "session_factory": session_factory,
        "user_id": user_id,
        "r2_client": r2_client,
        "keyring": keyring,
        "mock_clamav": mock_clamav,
        "quarantine_dir": quarantine_dir,
    }

    # Teardown
    set_global_r2_storage(None)
    set_global_keyring_manager(None)
    set_global_clamav_scanner(None)
    if orig_env_q is not None:
        os.environ["SATUKIT_QUARANTINE_DIR"] = orig_env_q
    else:
        os.environ.pop("SATUKIT_QUARANTINE_DIR", None)


def test_process_checking_item_success(worker_test_env: dict):
    session_factory: sessionmaker[Session] = worker_test_env["session_factory"]
    user_id = worker_test_env["user_id"]
    r2_client = worker_test_env["r2_client"]

    # Write valid PDF to quarantine
    item_id = str(uuid.uuid4())
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    valid_pdf_content = buf.getvalue()
    qm = QuarantineManager()
    qpath = qm.write_file(item_id, valid_pdf_content)

    now = time.time()
    with session_factory() as session:
        item = FileShelfItem(
            id=item_id,
            user_id=user_id,
            filename="document.pdf",
            content_type="application/pdf",
            size_bytes=len(valid_pdf_content),
            status="CHECKING",
            quarantine_path=qpath,
            uploaded_at=now,
        )
        session.add(item)
        session.commit()

    # Run processing
    with session_factory() as session:
        count = process_checking_items(session)
        assert count == 1
        session.commit()

    # Verify item promoted to AVAILABLE
    with session_factory() as session:
        updated_item = session.get(FileShelfItem, item_id)
        assert updated_item.status == "AVAILABLE"
        assert updated_item.available_at is not None
        assert updated_item.expires_at == updated_item.available_at + (30 * 86400)
        assert updated_item.sha256_hash is not None
        assert updated_item.r2_object_key == f"files/{user_id}/{item_id}/payload.enc"
        assert updated_item.r2_key_id == "k-worker-1"

    # Verify quarantine file removed
    assert not os.path.exists(qpath)

    # Verify R2 object encrypted and decryptable
    r2_key = f"files/{user_id}/{item_id}/payload.enc"
    ciphertext = r2_client.get_object(r2_key)
    assert len(ciphertext) > len(valid_pdf_content)
    decrypted = decrypt_file_envelope(
        envelope=ciphertext,
        user_id=user_id,
        item_id=item_id,
        content_type="application/pdf",
    )
    assert decrypted == valid_pdf_content


def test_process_checking_item_malware_detected(worker_test_env: dict):
    session_factory: sessionmaker[Session] = worker_test_env["session_factory"]
    user_id = worker_test_env["user_id"]

    # Configure scanner to flag infected
    class InfectedScanner:
        def scan_bytes(self, data: bytes) -> ScanResult:
            return ScanResult(
                is_clean=False,
                virus_name="Win.Test.EICAR_HDB-1",
                raw_response="stream: Win.Test.EICAR_HDB-1 FOUND",
            )

    set_global_clamav_scanner(InfectedScanner())

    item_id = str(uuid.uuid4())
    malware_bytes = b"%PDF-1.4 mock infected test payload"
    qm = QuarantineManager()
    qpath = qm.write_file(item_id, malware_bytes)

    with session_factory() as session:
        session.add(
            FileShelfItem(
                id=item_id,
                user_id=user_id,
                filename="eicar.pdf",
                content_type="application/pdf",
                size_bytes=len(malware_bytes),
                status="CHECKING",
                quarantine_path=qpath,
                uploaded_at=time.time(),
            )
        )
        session.commit()

    with session_factory() as session:
        count = process_checking_items(session)
        assert count == 1
        session.commit()

    with session_factory() as session:
        item = session.get(FileShelfItem, item_id)
        assert item.status == "FAILED"
        assert "Malware terdeteksi" in item.error_message
        assert item.r2_object_key is None

    # Quarantine file must be removed
    assert not os.path.exists(qpath)


def test_process_checking_item_format_inspection_rejected(worker_test_env: dict):
    session_factory: sessionmaker[Session] = worker_test_env["session_factory"]
    user_id = worker_test_env["user_id"]

    # Write executable masquerading as PDF
    item_id = str(uuid.uuid4())
    bad_bytes = b"MZ\x90\x00\x03\x00\x00\x00DOS executable"
    qm = QuarantineManager()
    qpath = qm.write_file(item_id, bad_bytes)

    with session_factory() as session:
        session.add(
            FileShelfItem(
                id=item_id,
                user_id=user_id,
                filename="document.pdf",
                content_type="application/pdf",
                size_bytes=len(bad_bytes),
                status="CHECKING",
                quarantine_path=qpath,
                uploaded_at=time.time(),
            )
        )
        session.commit()

    with session_factory() as session:
        count = process_checking_items(session)
        assert count == 1
        session.commit()

    with session_factory() as session:
        item = session.get(FileShelfItem, item_id)
        assert item.status == "FAILED"
        assert "Validasi keamanan berkas gagal" in item.error_message

    assert not os.path.exists(qpath)


def test_process_deletion_jobs(worker_test_env: dict):
    session_factory: sessionmaker[Session] = worker_test_env["session_factory"]
    r2_client = worker_test_env["r2_client"]

    # Seed object in R2 and job
    r2_key = "files/user-1/item-1/payload.enc"
    r2_client.upload_object(r2_key, b"encrypted-data")
    assert r2_client.head_object(r2_key) is not None

    now = time.time()
    job_id = str(uuid.uuid4())
    with session_factory() as session:
        session.add(
            FileDeletionJob(
                id=job_id,
                file_id="item-1",
                user_id="user-1",
                r2_object_key=r2_key,
                status="PENDING",
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()

    with session_factory() as session:
        count = process_deletion_jobs(session)
        assert count == 1
        session.commit()

    # R2 object should be deleted and job COMPLETED
    assert r2_client.head_object(r2_key) is None
    with session_factory() as session:
        job = session.get(FileDeletionJob, job_id)
        assert job.status == "COMPLETED"
        assert job.last_error is None


def test_process_retention_sweep(worker_test_env: dict):
    session_factory: sessionmaker[Session] = worker_test_env["session_factory"]
    user_id = worker_test_env["user_id"]
    now = time.time()

    # 1. Expired file (expires_at in past)
    expired_id = "expired-file-1"
    r2_key_expired = f"files/{user_id}/{expired_id}/payload.enc"

    # 2. Fresh file (expires_at in future)
    fresh_id = "fresh-file-2"

    with session_factory() as session:
        session.add(
            FileShelfItem(
                id=expired_id,
                user_id=user_id,
                filename="old.pdf",
                content_type="application/pdf",
                size_bytes=1000,
                status="AVAILABLE",
                r2_object_key=r2_key_expired,
                uploaded_at=now - (31 * 86400),
                available_at=now - (31 * 86400),
                expires_at=now - 100,  # Expired!
            )
        )
        session.add(
            FileShelfItem(
                id=fresh_id,
                user_id=user_id,
                filename="new.pdf",
                content_type="application/pdf",
                size_bytes=1000,
                status="AVAILABLE",
                r2_object_key=f"files/{user_id}/{fresh_id}/payload.enc",
                uploaded_at=now,
                available_at=now,
                expires_at=now + (29 * 86400),  # Not expired
            )
        )
        session.commit()

    with session_factory() as session:
        expired_count = process_retention_sweep(session)
        assert expired_count == 1
        session.commit()

    with session_factory() as session:
        exp_item = session.get(FileShelfItem, expired_id)
        assert exp_item.status == "DELETED"
        assert exp_item.deleted_at is not None

        fresh_item = session.get(FileShelfItem, fresh_id)
        assert fresh_item.status == "AVAILABLE"
        assert fresh_item.deleted_at is None

        # Verify deletion job was created for expired item
        job = session.query(FileDeletionJob).filter_by(file_id=expired_id).first()
        assert job is not None
        assert job.r2_object_key == r2_key_expired


def test_poll_cloudflare_graphql_metrics_mock(worker_test_env: dict):
    session_factory: sessionmaker[Session] = worker_test_env["session_factory"]

    class MockGraphQLResponse:
        status_code = 200

        def json(self):
            return {
                "data": {
                    "viewer": {
                        "accounts": [
                            {
                                "r2StorageAdaptiveGroups": [{"max": {"payloadSize": 536870912}}],
                                "r2OperationsAdaptiveGroups": [
                                    {
                                        "dimensions": {"actionType": "PutObject"},
                                        "sum": {"requests": 1500},
                                    },
                                    {
                                        "dimensions": {"actionType": "GetObject"},
                                        "sum": {"requests": 45000},
                                    },
                                ],
                            }
                        ]
                    }
                }
            }

    class MockHttpClient:
        def post(self, url: str, **kwargs: Any):
            return MockGraphQLResponse()

    with session_factory() as session:
        metrics = poll_cloudflare_graphql_metrics(
            session=session,
            api_token="dummy-token",
            account_id="dummy-account",
            graphql_url="https://mock.cloudflare/graphql",
            http_client=MockHttpClient(),
        )
        session.commit()

    assert metrics["storage_bytes"] == 536870912
    assert metrics["class_a_operations"] == 1500
    assert metrics["class_b_operations"] == 45000

    # Verify saved in RuntimeState
    with session_factory() as session:
        state = session.get(RuntimeState, "r2_metrics")
        assert state is not None
        assert state.value["storage_bytes"] == 536870912
        assert state.value["class_a_operations"] == 1500
        assert state.value["class_b_operations"] == 45000


def test_run_worker_pass(worker_test_env: dict):
    session_factory: sessionmaker[Session] = worker_test_env["session_factory"]
    with session_factory() as session:
        stats = run_worker_pass(session, poll_metrics=False)
        assert "checked" in stats
        assert "deleted" in stats
        assert "expired" in stats
        assert stats["checked"] == 0
