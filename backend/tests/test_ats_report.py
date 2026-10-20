import sys
from pathlib import Path

import docx
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app
from app.services.ats_report_generator import generate_ats_report_docx

client = TestClient(app)

SAMPLE_ANALYSIS_DATA = {
    "score": 88,
    "grade": "A (Sangat Ramah ATS)",
    "gradeCode": "A",
    "passedChecksCount": 6,
    "totalChecksCount": 6,
    "breakdown": {
        "contact": 25,
        "structure": 25,
        "summary": 20,
        "quantified_impact": 20,
        "integrity": 10,
    },
    "recommendations": ["Pertimbangkan untuk memperbanyak metrik hasil pada posisi pertama."],
    "checklist": [
        {
            "category": "Kontak",
            "item": "Alamat Email Terdeteksi Valid",
            "passed": True,
            "impact": 10,
            "tip": "Email profesional memudahkan recruiter.",
        },
        {
            "category": "Integritas",
            "item": "Distribusi Kata Natural & Bebas Keyword Stuffing",
            "passed": True,
            "impact": 10,
            "tip": "Kepadatan kata kunci seimbang.",
        },
    ],
    "disclaimer": "Skor ATS bersifat heuristik untuk mengevaluasi format mesin.",
}


def test_generate_ats_report_docx_creates_valid_document():
    """Service generate_ats_report_docx menghasilkan berkas docx laporan terstruktur."""
    docx_io = generate_ats_report_docx(SAMPLE_ANALYSIS_DATA, "Resume Lead Engineer")
    assert docx_io is not None
    assert docx_io.getvalue()[:2] == b"PK"

    doc = docx.Document(docx_io)
    full_text = " ".join([p.text for p in doc.paragraphs])
    assert "LAPORAN EVALUASI KETERBACAAN ATS" in full_text
    assert "SKOR TOTAL: 88 / 100" in full_text
    assert "Catatan Penafian (Disclaimer)" in full_text
    assert len(doc.tables) >= 2


def test_export_report_docx_endpoint():
    """Endpoint POST /api/ats/export-report-docx merespons streaming docx attachment."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}

    resp = client.post(
        "/api/ats/export-report-docx",
        json={"analysis": SAMPLE_ANALYSIS_DATA, "resume_title": "Resume Budi"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]
    assert "Laporan_ATS_Resume_Budi.docx" in resp.headers["content-disposition"]
    assert resp.content[:2] == b"PK"


def test_export_report_pdf_endpoint():
    """Endpoint POST /api/ats/export-report-pdf mengembalikan 422 edukatif atau 200 PDF."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}

    resp = client.post(
        "/api/ats/export-report-pdf",
        json={"analysis": SAMPLE_ANALYSIS_DATA, "resume_title": "Resume Budi"},
        headers=headers,
    )
    if resp.status_code == 422:
        data = resp.json()
        assert data["error_code"] == "LIBREOFFICE_NOT_FOUND"
    else:
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
