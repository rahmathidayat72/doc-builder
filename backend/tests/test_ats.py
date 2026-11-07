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


def test_evaluate_ats_structure_with_canonical_frontend_schema():
    """Memastikan payload canonical frontend (achievements & education) dinilai secara akurat."""
    canonical_resume = {
        "title": "Canonical Frontend Schema Resume",
        "data": {
            "contact": {
                "fullName": "Siti Nurhaliza",
                "email": "siti.nurhaliza@example.com",
                "phone": "+6281298765432",
                "location": "Jakarta Selatan, Indonesia",
                "linkedin": "linkedin.com/in/sitinurhaliza",
            },
            "summary": (
                "Senior Frontend Engineer berdedikasi dengan lebih dari 6 tahun pengalaman "
                "dalam merancang arsitektur aplikasi web modern berskala besar, memimpin tim "
                "frontend, serta mengoptimalkan Core Web Vitals hingga mencapai performa "
                "optimal, responsif, dan efisien."
            ),
            "experiences": [
                {
                    "id": "exp-c1",
                    "jobTitle": "Lead Frontend Engineer",
                    "company": "PT Digital Solusindo",
                    "startDate": "2021",
                    "endDate": "Sekarang",
                    "current": True,
                    "achievements": [
                        "Mengoptimalkan performa halaman awal hingga mempercepat LCP sebesar 42%.",
                        "Memimpin tim 8 engineer dalam implementasi design system.",
                    ],
                },
                {
                    "id": "exp-c2",
                    "jobTitle": "Frontend Developer",
                    "company": "PT Aplikasi Nusantara",
                    "startDate": "2018",
                    "endDate": "2021",
                    "current": False,
                    "achievements": [
                        "Meningkatkan konversi checkout sebesar 28% lewat refactor UI/UX.",
                        "Mengurangi bundle size JavaScript hingga 35%.",
                    ],
                },
            ],
            "education": [
                {
                    "id": "edu-c1",
                    "institution": "Universitas Indonesia",
                    "degree": "S1",
                    "fieldOfStudy": "Ilmu Komputer",
                    "startDate": "2014",
                    "endDate": "2018",
                }
            ],
            "skills": [
                {"id": "1", "name": "React"},
                {"id": "2", "name": "TypeScript"},
                {"id": "3", "name": "Next.js"},
                {"id": "4", "name": "Tailwind CSS"},
            ],
            "languages": [
                {"id": "1", "language": "Bahasa Indonesia", "proficiency": "Native"},
                {"id": "2", "language": "English", "proficiency": "Professional"},
            ],
        },
    }

    res = evaluate_ats_structure(canonical_resume)
    assert res["score"] >= 85
    assert res["gradeCode"] == "A"
    assert res["breakdown"]["contact"] == 25
    assert res["breakdown"]["structure"] == 25
    assert res["breakdown"]["summary"] == 20
    assert res["breakdown"]["quantified_impact"] == 20
    assert res["breakdown"]["integrity"] == 10

    # Pastikan endpoint /api/ats/analyze-structure juga sukses menerima payload ini
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}
    resp = client.post("/api/ats/analyze-structure", json=canonical_resume, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] >= 85
    assert data["breakdown"]["quantified_impact"] == 20


def test_evaluate_ats_structure_supports_legacy_educations_fallback():
    """Memastikan payload lama dengan key 'educations' tetap diakui pada pilar struktur."""
    legacy_resume = {
        "title": "Legacy Educations Schema Resume",
        "data": {
            "contact": {
                "fullName": "Budi Hartono",
                "email": "budi.hartono@example.com",
                "phone": "+628111222333",
                "location": "Surabaya, Indonesia",
            },
            "summary": (
                "Database Administrator profesional dengan 5 tahun pengalaman dalam "
                "merawat stabilitas kluster PostgreSQL, optimasi query replikasi, dan "
                "keamanan basis data skala enterprise."
            ),
            "experiences": [
                {
                    "id": "exp-l1",
                    "jobTitle": "Database Administrator",
                    "company": "PT Fintek Jaya",
                    "description": "Mengelola 20 node PostgreSQL dengan uptime 99.99%.",
                }
            ],
            "educations": [
                {
                    "id": "edu-l1",
                    "school": "Institut Teknologi Sepuluh Nopember",
                    "degree": "S1",
                    "fieldOfStudy": "Sistem Informasi",
                }
            ],
            "skills": [
                {"id": "1", "name": "PostgreSQL"},
                {"id": "2", "name": "Linux"},
                {"id": "3", "name": "Docker"},
            ],
        },
    }

    res = evaluate_ats_structure(legacy_resume)
    # Pilar struktur harus mendeteksi riwayat pendidikan (5 poin)
    edu_checks = [c for c in res["checklist"] if c["item"] == "Riwayat Pendidikan Tersedia"]
    assert len(edu_checks) == 1
    assert edu_checks[0]["passed"] is True
    assert res["breakdown"]["structure"] >= 25
