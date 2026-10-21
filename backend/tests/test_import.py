import io
import sys
from pathlib import Path

from docx import Document
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


def test_parse_docx_preserves_table_order_and_extra_sections():
    """DOCX bertabel tetap berurutan; bahasa dan section tambahan tidak dibuang."""
    document = Document()
    document.add_paragraph("Rina Wijaya")
    document.add_paragraph("rina@example.com | +628123456789 | Jakarta, Indonesia")
    document.add_paragraph("PENGALAMAN KERJA")
    experience_table = document.add_table(rows=3, cols=1)
    experience_table.cell(0, 0).text = "Senior Engineer"
    experience_table.cell(1, 0).text = "PT Maju Digital"
    experience_table.cell(2, 0).text = "Jan 2021 - Sekarang"
    document.add_paragraph("BAHASA")
    document.add_paragraph("Bahasa Indonesia (Native) | English: Professional")
    document.add_paragraph("SERTIFIKASI")
    document.add_paragraph("AWS Certified Developer")

    output = io.BytesIO()
    document.save(output)
    result = parse_resume_document(output.getvalue(), "resume_table.docx")

    assert len(result["data"]["experiences"]) == 1
    experience = result["data"]["experiences"][0]
    assert experience["jobTitle"] == "Senior Engineer"
    assert experience["company"] == "PT Maju Digital"
    assert experience["current"] is True
    assert [item["language"] for item in result["data"]["languages"]] == [
        "Bahasa Indonesia",
        "English",
    ]
    assert result["data"]["customSections"][0]["sectionTitle"] == "Sertifikasi"
    assert (
        "AWS Certified Developer" in result["data"]["customSections"][0]["items"][0]["description"]
    )


def test_parse_multiline_experience_and_education():
    """Header jabatan/perusahaan sebelum periode dan pendidikan multi-baris terpetakan."""
    document = Document()
    document.add_paragraph("Dimas Pratama")
    document.add_paragraph("dimas@example.com")
    document.add_paragraph("PROFESSIONAL EXPERIENCE")
    document.add_paragraph("Backend Engineer")
    document.add_paragraph("Acme Technology | Bandung")
    document.add_paragraph("Feb 2020 - Dec 2023")
    document.add_paragraph("• Mengurangi latency API 35%")
    document.add_paragraph("EDUCATION")
    document.add_paragraph("Universitas Gadjah Mada")
    document.add_paragraph("2015 - 2019")
    document.add_paragraph("S1 Teknik Informatika | IPK: 3.75 / 4.00")

    output = io.BytesIO()
    document.save(output)
    result = parse_resume_document(output.getvalue(), "resume_multiline.docx")

    experience = result["data"]["experiences"][0]
    assert experience["jobTitle"] == "Backend Engineer"
    assert experience["company"] == "Acme Technology"
    assert experience["location"] == "Bandung"
    assert experience["startDate"].lower() == "feb 2020"
    assert experience["endDate"].lower() == "dec 2023"
    assert "Mengurangi latency API 35%" in experience["description"]

    education = result["data"]["education"][0]
    assert education["institution"] == "Universitas Gadjah Mada"
    assert education["startDate"] == "2015"
    assert education["endDate"] == "2019"
    assert "S1" in education["degree"]
    assert education["gpa"] == "3.75 / 4.00"


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
