import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app
from app.services.pdf2docx_converter import (
    convert_pdf_to_docx_sandboxed,
    validate_pdf_magic_bytes,
)

client = TestClient(app)

SAMPLE_PDF_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "spikes"
    / "pdf2docx-eval"
    / "samples"
    / "01_cv_sample.pdf"
)

def test_validate_pdf_magic_bytes():
    """Validasi magic bytes mengenali header %PDF-."""
    assert validate_pdf_magic_bytes(b"%PDF-1.4\n...") is True
    assert validate_pdf_magic_bytes(b"PK\x03\x04") is False
    assert validate_pdf_magic_bytes(b"PDF") is False

def test_convert_pdf_to_docx_sandboxed_rejects_invalid_magic_bytes():
    """Fungsi melempar ValueError jika header berkas bukan %PDF."""
    with pytest.raises(ValueError, match="Header biner berkas tidak valid"):
        convert_pdf_to_docx_sandboxed(b"NOT_A_VALID_PDF_FILE", "document.pdf")

def test_convert_pdf_to_docx_sandboxed_with_sample_pdf():
    """Menguji konversi berkas PDF nyata menghasilkan biner DOCX valid (PK)."""
    assert SAMPLE_PDF_PATH.exists(), f"Sample PDF tidak ditemukan di: {SAMPLE_PDF_PATH}"
    pdf_bytes = SAMPLE_PDF_PATH.read_bytes()

    docx_io, err = convert_pdf_to_docx_sandboxed(pdf_bytes, "cv_sample.pdf")
    assert err is None
    assert docx_io is not None
    assert docx_io.getvalue()[:2] == b"PK"

def test_convert_pdf_to_docx_endpoint_requires_auth():
    """Endpoint POST /api/converter/pdf-to-docx menolak request tanpa session cookie."""
    files = {"file": ("document.pdf", b"%PDF-1.4 mock", "application/pdf")}
    resp = client.post("/api/converter/pdf-to-docx", files=files)
    assert resp.status_code == 401

def test_convert_pdf_to_docx_endpoint_rejects_non_pdf():
    """Endpoint menolak berkas dengan ekstensi selain .pdf."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {
        CSRF_HEADER_NAME: session_manager.csrf_token,
        "Origin": "http://localhost:5173",
    }

    files = {"file": ("data.docx", b"PK\x03\x04", "application/vnd.openxmlformats")}
    resp = client.post("/api/converter/pdf-to-docx", files=files, headers=headers)
    assert resp.status_code == 400
    assert "Harap unggah berkas .pdf" in resp.json()["detail"]

def test_convert_pdf_to_docx_endpoint_converts_successfully():
    """Endpoint menerima PDF valid dan mengalirkan attachment berkas .docx."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {
        CSRF_HEADER_NAME: session_manager.csrf_token,
        "Origin": "http://localhost:5173",
    }

    pdf_bytes = SAMPLE_PDF_PATH.read_bytes()
    files = {"file": ("my_resume.pdf", pdf_bytes, "application/pdf")}

    resp = client.post("/api/converter/pdf-to-docx", files=files, headers=headers)
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]
    assert "my_resume.docx" in resp.headers["content-disposition"]
    assert resp.content[:2] == b"PK"
