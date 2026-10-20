import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app
from app.services.converter import convert_docx_to_pdf_sandboxed, validate_docx_magic_bytes
from app.services.docx_generator import generate_resume_docx

client = TestClient(app)

DUMMY_RESUME_PAYLOAD = {
    "title": "Test Doc",
    "data": {
        "contact": {"fullName": "Budi Test", "email": "budi@test.id"},
        "summary": "Sample summary text",
        "experiences": [],
        "education": [],
        "skills": [],
    },
}


def test_validate_docx_magic_bytes():
    """Validasi magic bytes mengenali kontainer ZIP/DOCX PK\\x03\\x04."""
    valid_bytes = b"PK\x03\x04\x14\x00\x06\x00"
    invalid_bytes = b"%PDF-1.4 mock content"
    short_bytes = b"PK"

    assert validate_docx_magic_bytes(valid_bytes) is True
    assert validate_docx_magic_bytes(invalid_bytes) is False
    assert validate_docx_magic_bytes(short_bytes) is False


def test_convert_docx_to_pdf_sandboxed_rejects_invalid_magic_bytes():
    """Fungsi melempar ValueError jika header berkas tidak valid."""
    with pytest.raises(ValueError, match="Header biner berkas tidak valid"):
        convert_docx_to_pdf_sandboxed(b"NOT_A_VALID_DOCX_FILE", "test.docx")


def test_convert_docx_endpoint_requires_auth():
    """Endpoint POST /api/converter/docx-to-pdf menolak request tanpa session cookie."""
    files = {"file": ("test.docx", b"PK\x03\x04dummy", "application/vnd.openxmlformats")}
    resp = client.post("/api/converter/docx-to-pdf", files=files)
    assert resp.status_code == 401


def test_convert_docx_endpoint_rejects_non_docx_extension():
    """Endpoint menolak berkas dengan ekstensi selain .docx."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}

    files = {"file": ("report.pdf", b"%PDF-1.4", "application/pdf")}
    resp = client.post("/api/converter/docx-to-pdf", files=files, headers=headers)
    assert resp.status_code == 400
    assert "Harap unggah berkas .docx" in resp.json()["detail"]


def test_convert_docx_endpoint_with_valid_docx():
    """Endpoint menerima DOCX valid dan mengembalikan PDF atau 422
    jika LibreOffice belum terinstal."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}

    docx_io = generate_resume_docx(DUMMY_RESUME_PAYLOAD)
    files = {"file": ("sample_report.docx", docx_io.getvalue(), "application/vnd.openxmlformats")}

    resp = client.post("/api/converter/docx-to-pdf", files=files, headers=headers)
    if resp.status_code == 422:
        data = resp.json()
        assert data["error_code"] == "LIBREOFFICE_NOT_FOUND"
        assert "LibreOffice belum terpasang" in data["message"]
    else:
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert "sample_report.pdf" in resp.headers["content-disposition"]
