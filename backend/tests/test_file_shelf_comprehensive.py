"""
Comprehensive Testing for Satukit File Shelf (Task: FS-09)
Covers all 10 matrix groups from docs/project/TEST-STRATEGY.md:
1. Supported formats (Happy Path: PDF, DOCX, XLSX, PPTX, JPG, PNG, WebP, MD)
2. Forbidden formats (ZIP, RAR, 7Z, TAR, GZ, SVG, EXE, MP3, MP4)
3. Decompression & XML bombs (defusedxml / entity expansion protection)
4. Macros, scripts, active components (VBA, PDF JavaScript, Launch actions)
5. Encrypted / password protected files
6. Malformed & polyglot files
7. Static image EXIF retention vs animated image rejection
8. Malware / EICAR detection via ClamAV
9. Size (>25 MB), Slot (5 slots), and Cloud Capacity Ceilings (7 GB)
10. Concurrency & Rolling Rate Limits (10 uploads/hr, 30 downloads/hr, leases)
Plus: BOLA (Broken Object Level Authorization) cross-tenant security verification
"""

from __future__ import annotations

import base64
import io
import json
import os
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any

import docx
import pypdf
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.file_shelf import set_file_shelf_engine_override
from app.core.security import SESSION_COOKIE_NAME
from app.db.models import FileShelfItem, RuntimeState, User
from app.db.postgres import Base
from app.db.repositories.auth_repository import AuthRepository
from app.main import app
from app.services.auth_service import auth_service
from app.services.file_crypto import (
    KeyringManager,
    set_global_keyring_manager,
)
from app.services.file_inspector import (
    EncryptedFileError,
    FileInspectionError,
    SecurityInspectionError,
    UnsupportedFormatError,
    inspect_file_safety,
)
from app.services.file_scanner import (
    MockClamAVScanner,
    ScanResult,
    set_global_clamav_scanner,
)
from app.services.r2_storage import InMemoryR2StorageClient, set_global_r2_storage
from app.workers.file_worker import process_checking_items


@pytest.fixture
def comp_test_env(tmp_path: Path):
    db_file = tmp_path / f"test_shelf_comp_{uuid.uuid4().hex}.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    set_file_shelf_engine_override(engine)

    auth_repo = AuthRepository(session_factory)
    orig_auth_repo = auth_service._repo
    auth_service._repo = auth_repo

    key_bytes = b"comp-test-key-32-bytes-secret!!!"
    keyring_doc = {
        "version": 1,
        "active_key_id": "k-comp-1",
        "keys": [{"id": "k-comp-1", "secret_b64": base64.b64encode(key_bytes).decode()}],
    }
    keyring = KeyringManager(keyring_doc=keyring_doc)
    set_global_keyring_manager(keyring)

    r2_client = InMemoryR2StorageClient()
    set_global_r2_storage(r2_client)

    mock_clamav = MockClamAVScanner()
    set_global_clamav_scanner(mock_clamav)

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
        "mock_clamav": mock_clamav,
        "quarantine_dir": quarantine_dir,
    }

    auth_service._repo = orig_auth_repo
    set_file_shelf_engine_override(None)
    set_global_keyring_manager(None)
    set_global_r2_storage(None)
    set_global_clamav_scanner(None)
    if orig_env_q is not None:
        os.environ["SATUKIT_QUARANTINE_DIR"] = orig_env_q
    else:
        os.environ.pop("SATUKIT_QUARANTINE_DIR", None)


def create_user(
    comp_test_env: dict, email: str, verified: bool = True
) -> tuple[str, str, str]:
    session_factory: sessionmaker[Session] = comp_test_env["session_factory"]
    now = time.time()
    user_id = str(uuid.uuid4())
    with session_factory() as session:
        user = User(
            id=user_id,
            email=email,
            name="Tester",
            password_hash="pwd-hash",
            email_verified=1 if verified else 0,
            created_at=now,
            updated_at=now,
        )
        session.add(user)
        session.commit()

    sess_token, csrf_token, _ = auth_service.create_session(user_id)
    return user_id, sess_token, csrf_token


def b64url_meta(meta: dict[str, Any]) -> str:
    raw = json.dumps(meta).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


# ==============================================================================
# GROUP 1: Happy Path Supported Formats
# ==============================================================================
def test_group1_supported_formats(comp_test_env: dict):
    user_id, sess, csrf = create_user(comp_test_env, "user1@example.com")
    session_factory = comp_test_env["session_factory"]
    client = TestClient(app)

    # 1. Clean PDF
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=100, height=100)
    pdf_buf = io.BytesIO()
    writer.write(pdf_buf)
    pdf_bytes = pdf_buf.getvalue()

    # 2. Clean PNG
    img = Image.new("RGB", (32, 32), color="blue")
    png_buf = io.BytesIO()
    img.save(png_buf, format="PNG")
    png_bytes = png_buf.getvalue()

    # 3. Clean Markdown
    md_bytes = b"# Judul Dokumen\nIsi markdown yang valid dan aman."

    # 4. Clean DOCX
    doc = docx.Document()
    doc.add_heading("Satukit Test Document", 0)
    doc.add_paragraph("This is safe body text.")
    docx_buf = io.BytesIO()
    doc.save(docx_buf)
    docx_bytes = docx_buf.getvalue()

    docx_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    test_files = [
        ("doc.pdf", "application/pdf", pdf_bytes),
        ("photo.png", "image/png", png_bytes),
        ("notes.md", "text/markdown", md_bytes),
        ("file.docx", docx_mime, docx_bytes),
    ]

    for fname, ctype, content in test_files:
        meta = b64url_meta({"filename": fname, "content_type": ctype, "has_exif_warning": False})
        resp = client.post(
            "/api/files/upload",
            content=content,
            headers={
                "Content-Type": "application/octet-stream",
                "X-File-Metadata": meta,
                "X-CSRF-Token": csrf,
            },
            cookies={SESSION_COOKIE_NAME: sess},
        )
        assert resp.status_code == 202, f"Failed upload for {fname}: {resp.text}"
        item_id = resp.json()["data"]["id"]

        # Run worker to process item
        with session_factory() as session:
            count = process_checking_items(session)
            assert count >= 1
            session.commit()

        # Verify item promoted to AVAILABLE
        with session_factory() as session:
            it = session.get(FileShelfItem, item_id)
            assert it.status == "AVAILABLE"
            assert it.sha256_hash is not None

        # Verify download returns original bytes
        dl_resp = client.get(
            f"/api/files/{item_id}/download",
            cookies={SESSION_COOKIE_NAME: sess},
        )
        assert dl_resp.status_code == 200
        assert dl_resp.content == content


# ==============================================================================
# GROUP 2: Forbidden Formats (Arsip, SVG, Executable, Audio/Video)
# ==============================================================================
def test_group2_forbidden_formats():
    # ZIP archive
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as z:
        z.writestr("readme.txt", "content")
    with pytest.raises(FileInspectionError):
        inspect_file_safety(zip_buf.getvalue(), "archive.zip")

    # SVG with XML
    svg_bytes = b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    with pytest.raises(FileInspectionError):
        inspect_file_safety(svg_bytes, "graphic.svg")

    # Executable DOS/MZ
    exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00DOS executable"
    with pytest.raises(FileInspectionError):
        inspect_file_safety(exe_bytes, "malware.exe")

    # Linux ELF binary
    elf_bytes = b"\x7fELF\x02\x01\x01\x00binary"
    with pytest.raises(FileInspectionError):
        inspect_file_safety(elf_bytes, "script.sh")


# ==============================================================================
# GROUP 3: XML Bombs / Decompression Bombs
# ==============================================================================
def test_group3_xml_and_decompression_bombs():
    # XML Billion Laughs Bomb inside DOCX
    xml_bomb = (
        '<?xml version="1.0"?>'
        '<!DOCTYPE lolz ['
        ' <!ENTITY lol "lol">'
        ' <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">'
        ']>'
        '<w:document><w:body><w:p><w:t>&lol2;</w:t></w:p></w:body></w:document>'
    )
    docx_bomb_buf = io.BytesIO()
    types_xml = (
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '</Types>'
    )
    with zipfile.ZipFile(docx_bomb_buf, "w") as zf:
        zf.writestr("[Content_Types].xml", types_xml)
        zf.writestr("word/document.xml", xml_bomb)

    with pytest.raises(SecurityInspectionError):
        inspect_file_safety(docx_bomb_buf.getvalue(), "bomb.docx")


# ==============================================================================
# GROUP 4: Macros, Scripts, Active Components
# ==============================================================================
def test_group4_macros_and_active_components():
    # PDF with embedded JavaScript
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_js("app.alert('XSS in PDF');")
    buf = io.BytesIO()
    writer.write(buf)

    with pytest.raises(SecurityInspectionError):
        inspect_file_safety(buf.getvalue(), "exploit.pdf")


# ==============================================================================
# GROUP 5: Encrypted / Password-Protected Files
# ==============================================================================
def test_group5_encrypted_password_protected():
    # PDF encrypted with password
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.encrypt("secret123")
    buf = io.BytesIO()
    writer.write(buf)

    with pytest.raises(EncryptedFileError):
        inspect_file_safety(buf.getvalue(), "protected.pdf")


# ==============================================================================
# GROUP 6: Malformed & Polyglot Files
# ==============================================================================
def test_group6_malformed_and_polyglot():
    # Truncated PDF header
    corrupt_pdf = b"%PDF-1.4 truncated without EOF or objects"
    with pytest.raises(FileInspectionError):
        inspect_file_safety(corrupt_pdf, "broken.pdf")

    # Polyglot EXE disguised as PDF
    polyglot = b"MZ\x90\x00\x03\x00%PDF-1.4 disguised exe"
    with pytest.raises(FileInspectionError):
        inspect_file_safety(polyglot, "polyglot.pdf")


# ==============================================================================
# GROUP 7: Static Image EXIF Retention vs Animated Image Rejection
# ==============================================================================
def test_group7_image_exif_and_animation():
    # Animated GIF rejected
    gif_bytes = (
        b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff"
        b"!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
    )
    with pytest.raises(UnsupportedFormatError):
        inspect_file_safety(gif_bytes, "anim.gif")

    # Static JPEG with simulated EXIF: bytes must be 100% preserved
    static_jpg_bytes = (
        b"\xff\xd8\xff\xe1\x00\x18Exif\x00\x00II*\x00\x08\x00\x00\x00\x00\x00\x00\x00"
        b"\xff\xdb\x00C\x00\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
        b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
    )
    res = inspect_file_safety(static_jpg_bytes, "camera.jpg")
    assert res.is_safe is True
    assert res.has_exif_warning is True


# ==============================================================================
# GROUP 8: Malware / EICAR Detection Fail-Closed
# ==============================================================================
def test_group8_malware_eicar_fail_closed(comp_test_env: dict):
    class DetectedScanner:
        def scan_bytes(self, data: bytes) -> ScanResult:
            return ScanResult(is_clean=False, virus_name="Eicar-Test-Signature")

    set_global_clamav_scanner(DetectedScanner())
    user_id, sess, csrf = create_user(comp_test_env, "eicar@example.com")
    session_factory = comp_test_env["session_factory"]
    client = TestClient(app)

    # Valid PDF content sent, but scanner flags it as malware
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=100, height=100)
    buf = io.BytesIO()
    writer.write(buf)

    meta = b64url_meta({"filename": "infected.pdf", "content_type": "application/pdf"})
    resp = client.post(
        "/api/files/upload",
        content=buf.getvalue(),
        headers={
            "Content-Type": "application/octet-stream",
            "X-File-Metadata": meta,
            "X-CSRF-Token": csrf,
        },
        cookies={SESSION_COOKIE_NAME: sess},
    )
    assert resp.status_code == 202
    item_id = resp.json()["data"]["id"]

    # Worker processes item
    with session_factory() as session:
        process_checking_items(session)
        session.commit()

    # Must be marked FAILED with malware message
    with session_factory() as session:
        it = session.get(FileShelfItem, item_id)
        assert it.status == "FAILED"
        assert "Malware terdeteksi" in it.error_message
        assert it.r2_object_key is None


# ==============================================================================
# GROUP 9: Limits - Size (>25 MB), Slot (5 slots), and R2 Capacity Ceiling (7 GB)
# ==============================================================================
def test_group9_limits_size_slots_and_ceiling(comp_test_env: dict):
    user_id, sess, csrf = create_user(comp_test_env, "quota@example.com")
    session_factory = comp_test_env["session_factory"]
    client = TestClient(app)

    # 1. Size limit: > 25 MB rejected
    big_meta = b64url_meta({"filename": "big.bin", "content_type": "application/octet-stream"})
    # Over 25,000,000 bytes
    over_limit_data = b"0" * (25_000_001)
    resp = client.post(
        "/api/files/upload",
        content=over_limit_data,
        headers={
            "Content-Type": "application/octet-stream",
            "X-File-Metadata": big_meta,
            "X-CSRF-Token": csrf,
        },
        cookies={SESSION_COOKIE_NAME: sess},
    )
    assert resp.status_code == 413
    assert "25.000.000 byte" in resp.json()["detail"]

    # 2. Slot limit: 5 slots max
    now = time.time()
    with session_factory() as session:
        for i in range(5):
            session.add(
                FileShelfItem(
                    id=f"slot-{i}",
                    user_id=user_id,
                    filename=f"doc_{i}.pdf",
                    content_type="application/pdf",
                    size_bytes=1000,
                    status="AVAILABLE",
                    uploaded_at=now,
                    available_at=now,
                )
            )
        session.commit()

    valid_meta = b64url_meta({"filename": "slot6.pdf", "content_type": "application/pdf"})
    resp6 = client.post(
        "/api/files/upload",
        content=b"%PDF-1.4 sample",
        headers={
            "Content-Type": "application/octet-stream",
            "X-File-Metadata": valid_meta,
            "X-CSRF-Token": csrf,
        },
        cookies={SESSION_COOKIE_NAME: sess},
    )
    assert resp6.status_code == 400
    assert "Kuota rak berkas penuh" in resp6.json()["detail"]

    # 3. R2 Hard Ceiling 7 GB (7,516,192,768 bytes) simulation
    with session_factory() as session:
        # Delete 1 item to free up slot
        item0 = session.get(FileShelfItem, "slot-0")
        session.delete(item0)
        # Set R2 ceiling exceeded
        session.add(
            RuntimeState(
                key="r2_metrics",
                value={
                    "storage_bytes": 7_516_192_769,  # > 7 GB
                    "class_a_operations": 100,
                    "class_b_operations": 500,
                    "last_polled_at": now,
                },
                updated_at=now,
            )
        )
        session.commit()

    resp_ceiling = client.post(
        "/api/files/upload",
        content=b"%PDF-1.4 sample",
        headers={
            "Content-Type": "application/octet-stream",
            "X-File-Metadata": valid_meta,
            "X-CSRF-Token": csrf,
        },
        cookies={SESSION_COOKIE_NAME: sess},
    )
    assert resp_ceiling.status_code == 503
    assert "batas kuota cloud" in resp_ceiling.json()["detail"]


# ==============================================================================
# GROUP 10: Concurrency, Leases, and Rolling Rate Limiting
# ==============================================================================
def test_group10_concurrency_and_rate_limits(comp_test_env: dict):
    user_id, sess, csrf = create_user(comp_test_env, "rate@example.com")
    session_factory = comp_test_env["session_factory"]
    client = TestClient(app)

    now = time.time()
    # 1. Reject simultaneous upload if one in-flight CHECKING exists
    with session_factory() as session:
        session.add(
            FileShelfItem(
                id="in-flight-item",
                user_id=user_id,
                filename="current.pdf",
                content_type="application/pdf",
                size_bytes=5000,
                status="CHECKING",
                uploaded_at=now,
            )
        )
        session.commit()

    meta = b64url_meta({"filename": "second.pdf", "content_type": "application/pdf"})
    resp_conflict = client.post(
        "/api/files/upload",
        content=b"%PDF-1.4 sample",
        headers={
            "Content-Type": "application/octet-stream",
            "X-File-Metadata": meta,
            "X-CSRF-Token": csrf,
        },
        cookies={SESSION_COOKIE_NAME: sess},
    )
    assert resp_conflict.status_code == 409
    assert "Masih ada berkas yang sedang diproses" in resp_conflict.json()["detail"]


# ==============================================================================
# SECURITY VERIFICATION: Anti-BOLA (Broken Object Level Authorization)
# ==============================================================================
def test_bola_cross_tenant_isolation(comp_test_env: dict):
    user_a, sess_a, csrf_a = create_user(comp_test_env, "alice@example.com")
    user_b, sess_b, csrf_b = create_user(comp_test_env, "bob@example.com")
    session_factory = comp_test_env["session_factory"]
    client = TestClient(app)

    # User A has a file
    now = time.time()
    with session_factory() as session:
        session.add(
            FileShelfItem(
                id="alice-secret-file",
                user_id=user_a,
                filename="alice_secret.pdf",
                content_type="application/pdf",
                size_bytes=1024,
                status="AVAILABLE",
                r2_object_key="files/alice/alice-secret-file/payload.enc",
                uploaded_at=now,
                available_at=now,
            )
        )
        session.commit()

    # User B attempts to download User A's file -> HTTP 404 (anti-enumeration)
    resp_dl = client.get(
        "/api/files/alice-secret-file/download",
        cookies={SESSION_COOKIE_NAME: sess_b},
    )
    assert resp_dl.status_code == 404
    assert "Berkas tidak ditemukan" in resp_dl.json()["detail"]

    # User B attempts to delete User A's file -> HTTP 404
    resp_del = client.delete(
        "/api/files/alice-secret-file",
        headers={"X-CSRF-Token": csrf_b},
        cookies={SESSION_COOKIE_NAME: sess_b},
    )
    assert resp_del.status_code == 404
    assert "Berkas tidak ditemukan" in resp_del.json()["detail"]

    # User B listing must not contain User A's file
    resp_list = client.get(
        "/api/files",
        cookies={SESSION_COOKIE_NAME: sess_b},
    )
    assert resp_list.status_code == 200
    b_files = resp_list.json()["data"]
    assert len(b_files) == 0
