import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app
from app.services.job_matcher import match_resume_to_job

client = TestClient(app)

SAMPLE_BACKEND_RESUME = {
    "title": "Backend Engineer",
    "data": {
        "contact": {
            "fullName": "Arief Wicaksono",
            "email": "arief@example.com",
            "phone": "08123456789",
        },
        "summary": "Backend developer berpengalaman dengan Python, FastAPI, dan PostgreSQL.",
        "experiences": [
            {
                "id": "1",
                "jobTitle": "Backend Developer",
                "company": "PT Solusi Cloud",
                "description": (
                    "• Mengembangkan REST API dengan Python FastAPI.\n"
                    "• Mengelola database PostgreSQL."
                ),
            }
        ],
        "skills": [
            {"id": "1", "name": "Python"},
            {"id": "2", "name": "FastAPI"},
            {"id": "3", "name": "PostgreSQL"},
            {"id": "4", "name": "Git"},
        ],
    },
}

JOB_DESCRIPTION_TEXT = """
Dibutuhkan Senior Backend Engineer.
Kualifikasi yang dicari:
- Menguasai Python dan framework FastAPI.
- Mahir dalam perancangan database PostgreSQL.
- Berpengalaman dengan Git dan REST API.
- Memiliki pengalaman dengan Docker dan Redis merupakan nilai tambah.
"""


def test_match_resume_to_job_finds_matched_and_missing_skills():
    """Menguji kalkulasi kecocokan skill dan deteksi missing skills."""
    res = match_resume_to_job(SAMPLE_BACKEND_RESUME, JOB_DESCRIPTION_TEXT)
    assert res["match_score"] > 50.0
    assert "python" in res["matched_skills"]
    assert "fastapi" in res["matched_skills"]
    assert "postgresql" in res["matched_skills"]
    assert "docker" in res["missing_skills"]
    assert "redis" in res["missing_skills"]
    assert res["bm25_score"] > 20.0
    assert len(res["advice"]) >= 1


def test_match_job_endpoint_requires_auth():
    """Endpoint POST /api/ats/match-job harus menolak akses tanpa session cookie."""
    resp = client.post(
        "/api/ats/match-job",
        json={"resume": SAMPLE_BACKEND_RESUME, "job_text": JOB_DESCRIPTION_TEXT},
    )
    assert resp.status_code == 401


def test_match_job_endpoint_with_auth_returns_match_data():
    """Endpoint POST /api/ats/match-job mengembalikan skor kecocokan dengan autentikasi."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}

    resp = client.post(
        "/api/ats/match-job",
        json={"resume": SAMPLE_BACKEND_RESUME, "job_text": JOB_DESCRIPTION_TEXT},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "match_score" in data
    assert "bm25_score" in data
    assert "matched_skills" in data
    assert "missing_skills" in data
    assert "python" in data["matched_skills"]
    assert "docker" in data["missing_skills"]
