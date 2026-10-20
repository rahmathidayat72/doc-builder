import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app
from app.services.ats_analyzer import evaluate_ats_structure

client = TestClient(app)

HIGH_SCORE_RESUME = {
    "title": "Senior Engineer Resume",
    "data": {
        "contact": {
            "fullName": "Ridwan Kamil",
            "email": "ridwan.kamil@example.com",
            "phone": "+6281234567890",
            "location": "Bandung, Indonesia",
            "linkedin": "linkedin.com/in/ridwankamil",
            "website": "ridwankamil.id",
        },
        "summary": (
            "Software Architect berdedikasi dengan lebih dari 8 tahun pengalaman "
            "dalam memimpin transformasi sistem microservices berskala tinggi. Terbiasa "
            "mengoptimalkan throughput backend, memelihara infrastruktur terdistribusi, "
            "dan mengelola tim rekayasa perangkat lunak berkinerja tinggi."
        ),
        "experiences": [
            {
                "id": "exp-1",
                "jobTitle": "Lead Architect",
                "company": "PT Mega Solusi",
                "startDate": "2020",
                "endDate": "Sekarang",
                "current": True,
                "description": (
                    "• Meningkatkan throughput transaksi sistem hingga 45% "
                    "menggunakan redis caching.\n"
                    "• Memimpin 12 insinyur perangkat lunak dalam migrasi 20 microservices."
                ),
            },
            {
                "id": "exp-2",
                "jobTitle": "Senior Backend Developer",
                "company": "PT Data Nusantara",
                "startDate": "2017",
                "endDate": "2020",
                "current": False,
                "description": (
                    "• Mengurangi downtime server sebesar 99.9% "
                    "dengan arsitektur failover otomatis.\n"
                    "• Menghemat biaya server bulanan hingga 30%."
                ),
            },
        ],
        "education": [
            {
                "id": "edu-1",
                "institution": "Institut Teknologi Bandung",
                "degree": "S1",
                "fieldOfStudy": "Teknik Informatika",
                "startDate": "2013",
                "endDate": "2017",
                "gpa": "3.85",
            }
        ],
        "skills": [
            {"id": "1", "name": "Python"},
            {"id": "2", "name": "TypeScript"},
            {"id": "3", "name": "FastAPI"},
            {"id": "4", "name": "Docker"},
            {"id": "5", "name": "PostgreSQL"},
        ],
        "languages": [
            {"id": "1", "language": "Bahasa Indonesia", "proficiency": "Native"},
            {"id": "2", "language": "English", "proficiency": "Professional"},
        ],
    },
}

LOW_SCORE_RESUME = {
    "title": "CV Kosong",
    "data": {
        "contact": {"fullName": "Si Fulan", "email": "", "phone": "", "location": ""},
        "summary": "",
        "experiences": [],
        "education": [],
        "skills": [],
    },
}

STUFFED_RESUME = {
    "title": "Stuffed CV",
    "data": {
        "contact": {
            "fullName": "John Spammer",
            "email": "spammer@example.com",
            "phone": "+6281234567890",
            "location": "Jakarta",
        },
        "summary": (
            "Python developer python python python python python expert "
            "python python python python python specialist python python python."
        ),
        "experiences": [
            {
                "id": "1",
                "jobTitle": "Python Dev",
                "company": "Python Inc",
                "startDate": "2022",
                "endDate": "2023",
                "description": "python python python python python python 100%.",
            }
        ],
        "education": [],
        "skills": [{"id": "1", "name": "Python"}],
    },
}


def test_evaluate_ats_structure_high_score():
    """Resume lengkap dengan metrik dan format standar harus memperoleh skor >= 85 (Grade A)."""
    res = evaluate_ats_structure(HIGH_SCORE_RESUME)
    assert res["score"] >= 85
    assert res["gradeCode"] == "A"
    assert res["breakdown"]["contact"] == 25
    assert res["breakdown"]["structure"] == 25
    assert res["breakdown"]["summary"] == 20
    assert res["breakdown"]["quantified_impact"] == 20
    assert res["breakdown"]["integrity"] == 10
    assert "disclaimer" in res
    assert len(res["recommendations"]) == 0


def test_evaluate_ats_structure_low_score_has_recommendations():
    """Resume yang tidak lengkap harus menghasilkan skor rendah dan rekomendasi perbaikan."""
    res = evaluate_ats_structure(LOW_SCORE_RESUME)
    assert res["score"] < 40
    assert res["gradeCode"] == "D"
    assert len(res["recommendations"]) >= 3
    failed_items = [c for c in res["checklist"] if not c["passed"]]
    assert len(failed_items) >= 4


def test_evaluate_ats_structure_detects_keyword_stuffing():
    """Pengulangan kata berlebih ekstrem harus membatalkan poin pilar integritas."""
    res = evaluate_ats_structure(STUFFED_RESUME)
    assert res["breakdown"]["integrity"] == 0
    stuffing_checks = [
        c for c in res["checklist"] if "Keyword Stuffing" in c["item"] or "Pengulangan" in c["item"]
    ]
    assert len(stuffing_checks) >= 1
    assert stuffing_checks[0]["passed"] is False


def test_analyze_structure_endpoint_with_auth():
    """Endpoint POST /api/ats/analyze-structure harus merespons 200 dengan struktur JSON lengkap."""
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}

    resp = client.post("/api/ats/analyze-structure", json=HIGH_SCORE_RESUME, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "score" in data
    assert "breakdown" in data
    assert "checklist" in data
    assert "disclaimer" in data
    assert data["score"] >= 85
