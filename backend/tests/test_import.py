import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app
from app.services.docx_generator import generate_resume_docx
from app.services.resume_parser import parse_resume_document

client = TestClient(app)

SAMPLE_PDF_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "spikes"
    / "pdf2docx-eval"
    / "samples"
    / "01_cv_sample.pdf"
)

SAMPLE_RESUME_PAYLOAD = {
    "title": "Resume Test",
    "data": {
        "contact": {
            "fullName": "Siti Nurhaliza",
            "email": "siti.nurhaliza@example.id",
            "phone": "+6281234567890",
            "location": "Jakarta, Indonesia",
            "linkedin": "",
            "website": "",
        },
        "summary": "Full Stack Developer berpengalaman membangun aplikasi enterprise.",
        "experiences": [
            {
                "id": "1",
                "jobTitle": "Lead Developer",
                "company": "PT Digital Solusi",
                "startDate": "2021",
                "endDate": "Sekarang",
                "current": True,
                "description": (
                    "• Mengelola tim 5 engineer.\n• Menerapkan arsitektur microservices."
                ),
            }
        ],
        "education": [
            {
                "id": "1",
                "institution": "Universitas Indonesia",
                "degree": "S1",
                "fieldOfStudy": "Ilmu Komputer",
            }
        ],
        "skills": [
            {"id": "1", "name": "Python"},
            {"id": "2", "name": "TypeScript"},
            {"id": "3", "name": "FastAPI"},
        ],
    },
}


def test_parse_resume_document_from_pdf():
    """Menguji parsing berkas PDF menghasilkan kontak, ringkasan, dan confidence."""
    assert SAMPLE_PDF_PATH.exists(), f"Berkas sample tidak ditemukan: {SAMPLE_PDF_PATH}"
    pdf_bytes = SAMPLE_PDF_PATH.read_bytes()

    result = parse_resume_document(pdf_bytes, "01_cv_sample.pdf")
    assert result["success"] is True
    data = result["data"]

    # Verifikasi kontak
    assert "budi" in data["contact"]["fullName"].lower()
    assert "budi.sample@example.com" in data["contact"]["email"]
    assert result["confidence"]["email"] >= 0.90
    assert result["confidence"]["overall"] > 0.60


def test_parse_resume_document_from_docx():
    """Menguji parsing berkas DOCX menghasilkan struktur data CV."""
    docx_io = generate_resume_docx(SAMPLE_RESUME_PAYLOAD)
    docx_bytes = docx_io.getvalue()

    result = parse_resume_document(docx_bytes, "resume_sample.docx")
    assert result["success"] is True
    data = result["data"]

    assert "siti nurhaliza" in data["contact"]["fullName"].lower()
    assert "siti.nurhaliza@example.id" in data["contact"]["email"]
    assert len(data["experiences"]) >= 1
    assert len(data["skills"]) >= 1


def test_import_resume_endpoint_requires_auth():
    """Endpoint upload /api/import/resume wajib memiliki sesi aktif."""
    files = {"file": ("test.pdf", b"%PDF-1.4 mock content", "application/pdf")}
    resp = client.post("/api/import/resume", files=files)
    assert resp.status_code == 401


def test_import_resume_endpoint_rejects_unsupported_extensions():
    """Endpoint menolak format file selain .pdf dan .docx."""
    # Set autentikasi
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}

    files = {"file": ("malicious.exe", b"binary content", "application/octet-stream")}
    resp = client.post("/api/import/resume", files=files, headers=headers)
    assert resp.status_code == 400
    assert "Format berkas tidak didukung" in resp.json()["detail"]


def test_import_resume_endpoint_success_with_docx():
    """Endpoint berhasil mem-parsing DOCX valid dan mengembalikan data serta confidence."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}

    docx_io = generate_resume_docx(SAMPLE_RESUME_PAYLOAD)
    files = {"file": ("test_resume.docx", docx_io.getvalue(), "application/vnd.openxmlformats")}

    resp = client.post("/api/import/resume", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "confidence" in data
    assert data["confidence"]["email"] >= 0.90
    assert "Siti Nurhaliza" in data["data"]["contact"]["fullName"]
