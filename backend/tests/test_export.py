import sys
from pathlib import Path

import docx
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app
from app.services.docx_generator import generate_resume_docx

client = TestClient(app)

SAMPLE_RESUME_PAYLOAD = {
    "id": "77777777-7777-4777-8777-777777777777",
    "title": "Resume Software Architect",
    "templateId": "ats-clean",
    "colorTheme": "#4338ca",
    "fontFamily": "sans",
    "data": {
        "contact": {
            "fullName": "Bambang Pamungkas",
            "email": "bambang@example.id",
            "phone": "081234567890",
            "location": "Jakarta, Indonesia",
            "linkedin": "linkedin.com/in/bambang",
            "website": "bambang.id",
        },
        "summary": "Software Architect berpengalaman 8 tahun dalam sistem skala besar.",
        "experiences": [
            {
                "id": "exp-1",
                "jobTitle": "Principal Architect",
                "company": "PT Mega Finansial",
                "location": "Jakarta",
                "startDate": "Jan 2021",
                "endDate": "Sekarang",
                "current": True,
                "description": (
                    "• Memimpin arsitektur sistem core banking microservices.\n"
                    "• Mengoptimalkan throughput sistem 50%."
                ),
            }
        ],
        "education": [
            {
                "id": "edu-1",
                "institution": "Institut Teknologi Bandung",
                "degree": "S2",
                "fieldOfStudy": "Sistem Informasi",
                "startDate": "2018",
                "endDate": "2020",
                "gpa": "3.88",
                "description": "",
            }
        ],
        "skills": [
            {"id": "sk-1", "name": "Python", "category": "Technical"},
            {"id": "sk-2", "name": "TypeScript", "category": "Technical"},
            {"id": "sk-3", "name": "Docker", "category": "Tools"},
        ],
        "languages": [
            {"id": "lang-1", "language": "Bahasa Indonesia", "proficiency": "Native"},
            {"id": "lang-2", "language": "English", "proficiency": "Fluent"},
        ],
        "customSections": [
            {
                "id": "custom-1",
                "sectionTitle": "Sertifikasi",
                "items": [
                    {
                        "id": "custom-item-1",
                        "title": "AWS Certified Developer",
                        "subtitle": "Amazon Web Services",
                        "date": "2025",
                        "description": "Validasi kompetensi pengembangan aplikasi cloud.",
                    }
                ],
            }
        ],
    },
}


def test_generate_resume_docx_creates_valid_document():
    """Unit test service generate_resume_docx menghasilkan berkas docx
    yang valid dan dapat dibaca."""
    docx_io = generate_resume_docx(SAMPLE_RESUME_PAYLOAD)
    assert docx_io is not None
    assert docx_io.getvalue()[:2] == b"PK"  # ZIP/DOCX Magic Bytes

    # Buka dengan python-docx untuk verifikasi integritas
    doc = docx.Document(docx_io)
    text = " ".join([p.text for p in doc.paragraphs])
    assert "BAMBANG PAMUNGKAS" in text
    assert "bambang@example.id" in text
    assert "PT Mega Finansial" in text
    assert "Principal Architect" in text
    assert "Python • TypeScript • Docker" in text
    assert "SERTIFIKASI" in text
    assert "AWS Certified Developer" in text
    assert "Amazon Web Services" in text
    assert "Validasi kompetensi pengembangan aplikasi cloud." in text


def test_export_docx_endpoint_requires_auth():
    """Memanggil endpoint POST /api/export/docx tanpa session cookie
    harus mengembalikan HTTP 401."""
    resp = client.post("/api/export/docx", json=SAMPLE_RESUME_PAYLOAD)
    assert resp.status_code == 401


def test_export_docx_endpoint_with_auth_and_csrf_returns_file():
    """Memanggil endpoint POST /api/export/docx dengan session & CSRF valid
    mengembalikan berkas docx."""
    # 1. Bootstrap sesi
    boot_resp = client.post(
        "/api/auth/bootstrap", json={"bootstrap_token": session_manager.bootstrap_token}
    )
    assert boot_resp.status_code == 200
    csrf_token = boot_resp.json()["csrf_token"]
    cookie_val = boot_resp.cookies[SESSION_COOKIE_NAME]

    # 2. Panggil export dengan Cookie & CSRF header
    client.cookies.set(SESSION_COOKIE_NAME, cookie_val)
    headers = {CSRF_HEADER_NAME: csrf_token, "Origin": "http://localhost:5173"}

    resp = client.post("/api/export/docx", json=SAMPLE_RESUME_PAYLOAD, headers=headers)
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]
    assert "attachment; filename=" in resp.headers["content-disposition"]
    assert resp.content[:2] == b"PK"


def test_export_pdf_endpoint_returns_422_when_libreoffice_not_installed():
    """Memanggil endpoint POST /api/export/pdf mengembalikan HTTP 422
    jika LibreOffice belum terpasang."""
    # Pastikan sesi aktif
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)

    resp = client.post("/api/export/pdf", json=SAMPLE_RESUME_PAYLOAD, headers=headers)
    # Di Windows environment tanpa LibreOffice, harus mengembalikan 422
    if resp.status_code == 422:
        data = resp.json()
        assert data["error_code"] == "LIBREOFFICE_NOT_FOUND"
        assert "LibreOffice belum terpasang" in data["message"]
    else:
        # Jika LibreOffice terpasang, harus 200 PDF
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
