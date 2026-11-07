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
    assert "analysis_status" in data
    assert "score_breakdown" in data
    assert "role" in data["score_breakdown"]


def test_match_resume_insufficient_data():
    """Teks lowongan yang kosong atau terlalu pendek menghasilkan status insufficient_data."""
    res_empty = match_resume_to_job(SAMPLE_BACKEND_RESUME, "")
    assert res_empty["analysis_status"] == "insufficient_data"
    assert res_empty["match_score"] == 0.0
    assert len(res_empty["advice"]) >= 1

    res_short = match_resume_to_job(SAMPLE_BACKEND_RESUME, "halo cari kerja")
    assert res_short["analysis_status"] == "insufficient_data"
    assert res_short["match_score"] == 0.0


def test_match_resume_role_family_differentiation():
    """Peran sekeluarga bernilai tinggi, peran berbeda rumpun bernilai rendah."""
    job_desc = "Dibutuhkan Backend Developer. Menguasai Python dan PostgreSQL."

    # Kandidat 1: Backend Developer
    res_backend = match_resume_to_job(SAMPLE_BACKEND_RESUME, job_desc)
    assert res_backend["score_breakdown"]["role"]["score"] >= 85.0

    # Kandidat 2: Desainer Grafis yang kebetulan menyebut python
    graphic_designer_resume = {
        "title": "Graphic Designer",
        "data": {
            "contact": {"fullName": "Budi Santoso", "headline": "Graphic Designer & Illustrator"},
            "summary": "Desainer grafis kreatif dengan sedikit pengetahuan Python.",
            "experiences": [
                {
                    "jobTitle": "Graphic Designer",
                    "company": "Studio Kreatif",
                    "description": "Merancang logo dan aset visual.",
                }
            ],
            "skills": [{"name": "Photoshop"}, {"name": "Illustrator"}, {"name": "Python"}],
        },
    }
    res_designer = match_resume_to_job(graphic_designer_resume, job_desc)
    assert res_designer["score_breakdown"]["role"]["score"] < 40.0
    # Skor total backend developer harus jauh lebih tinggi daripada graphic designer
    assert res_backend["match_score"] > res_designer["match_score"]


def test_match_resume_capped_at_69_when_missing_required_qualification():
    """Skor dibatasi maksimal 69 bila ada kualifikasi wajib (required) yang belum terpenuhi."""
    job_with_strict_req = """
    Dibutuhkan Backend Engineer.
    Kualifikasi Wajib:
    - Menguasai Python dan Golang.
    - Menguasai PostgreSQL.
    """
    # SAMPLE_BACKEND_RESUME tidak memiliki 'golang'
    res = match_resume_to_job(SAMPLE_BACKEND_RESUME, job_with_strict_req)
    assert res["capped_by_required"] is True
    assert res["match_score"] <= 69.0
    assert any("Keahlian wajib: golang" in req for req in res["missing_requirements"])
    assert any("Skor dibatasi maksimal 69" in a for a in res["advice"])


def test_match_resume_not_capped_when_only_preferred_missing():
    """Nilai tambah (preferred) yang tidak terpenuhi tidak membatasi skor maksimal."""
    job_with_pref = """
    Dibutuhkan Backend Developer.
    Kualifikasi Wajib:
    - Menguasai Python dan PostgreSQL.
    Nilai Tambah:
    - Pengalaman dengan Docker.
    """
    res = match_resume_to_job(SAMPLE_BACKEND_RESUME, job_with_pref)
    # Calon punya Python & PostgreSQL, hanya kurang Docker (preferred)
    assert res["capped_by_required"] is False
    assert res["match_score"] >= 70.0


def test_match_resume_experience_and_education_breakdown():
    """Mengevaluasi kalkulasi durasi pengalaman dan jenjang pendidikan."""
    resume_with_edu_exp = {
        "title": "Senior Backend Engineer",
        "data": {
            "contact": {"fullName": "Dewi Sartika", "headline": "Senior Backend Developer"},
            "summary": "Senior engineer berpengalaman 5 tahun dengan Python dan FastAPI.",
            "experiences": [
                {
                    "jobTitle": "Backend Engineer",
                    "company": "Tech Corp",
                    "startDate": "2020-01",
                    "endDate": "2024-06",
                    "description": "Mengembangkan microservices Python.",
                }
            ],
            "educations": [
                {
                    "degree": "S1",
                    "fieldOfStudy": "Teknik Informatika",
                    "school": "Institut Teknologi",
                }
            ],
            "skills": [
                {"name": "Python"},
                {"name": "FastAPI"},
                {"name": "PostgreSQL"},
            ],
        },
    }

    job_text = """
    Dibutuhkan Senior Backend Engineer.
    Kualifikasi Wajib:
    - Minimal 3 tahun pengalaman kerja.
    - Pendidikan minimal S1 Teknik Informatika atau bidang terkait.
    - Menguasai Python dan FastAPI.
    """

    res = match_resume_to_job(resume_with_edu_exp, job_text)
    assert res["score_breakdown"]["experience"]["status"] == "evaluated"
    assert res["score_breakdown"]["experience"]["cv_years"] >= 3.0
    assert res["score_breakdown"]["education"]["status"] == "evaluated"
    assert res["score_breakdown"]["education"]["score"] >= 90.0
    assert res["capped_by_required"] is False
    assert res["match_score"] >= 80.0


def test_match_resume_with_canonical_frontend_schema():
    """Memastikan payload canonical frontend (education, achievements, language)
    berfungsi optimal.
    """
    canonical_resume = {
        "title": "Staff Backend Engineer",
        "data": {
            "contact": {
                "fullName": "Dian Sastro",
                "headline": "Lead Backend Engineer & Cloud Architect",
                "email": "dian.sastro@example.com",
                "phone": "08123456789",
            },
            "summary": (
                "Lead Backend Engineer berpengalaman memimpin microservices "
                "Python dan Go skala tinggi."
            ),
            "experiences": [
                {
                    "id": "exp-1",
                    "jobTitle": "Lead Backend Engineer",
                    "company": "PT Skala Global",
                    "startDate": "2020-01",
                    "endDate": "2024-05",
                    "achievements": [
                        (
                            "Mengembangkan REST API performa tinggi berbasis "
                            "Python FastAPI dan PostgreSQL."
                        ),
                        (
                            "Mengurangi latensi transaksi hingga 40% menggunakan "
                            "arsitektur caching Redis."
                        ),
                    ],
                }
            ],
            "education": [
                {
                    "id": "edu-1",
                    "institution": "Institut Teknologi Bandung",
                    "degree": "S1",
                    "fieldOfStudy": "Teknik Informatika",
                }
            ],
            "skills": [
                {"id": "1", "name": "Python"},
                {"id": "2", "name": "FastAPI"},
                {"id": "3", "name": "PostgreSQL"},
                {"id": "4", "name": "Redis"},
            ],
            "languages": [
                {"id": "lang-1", "language": "English", "proficiency": "Fluent"},
                {"id": "lang-2", "language": "Indonesian", "proficiency": "Native"},
            ],
        },
    }

    job_text = """
    Dibutuhkan Lead Backend Engineer.
    Kualifikasi Wajib:
    - Minimal S1 Teknik Informatika atau Ilmu Komputer.
    - Menguasai Python dan framework FastAPI.
    - Mahir berbahasa English aktif / fluent.
    Kualifikasi Tambahan:
    - Berpengalaman dengan Redis caching dan PostgreSQL.
    """

    res = match_resume_to_job(canonical_resume, job_text)

    # Verifikasi dimensi pendidikan (canonical 'education')
    assert res["score_breakdown"]["education"]["status"] == "evaluated"
    assert res["score_breakdown"]["education"]["score"] >= 90.0

    # Verifikasi dimensi bahasa (canonical 'language')
    assert res["score_breakdown"]["languages"]["status"] == "evaluated"
    assert res["score_breakdown"]["languages"]["score"] == 100.0

    # Verifikasi dimensi keahlian & tanggung jawab (dari achievements)
    assert "python" in res["matched_skills"]
    assert "fastapi" in res["matched_skills"]
    assert "redis" in res["matched_skills"]
    assert res["match_score"] >= 80.0
    assert res["capped_by_required"] is False

    # Verifikasi via API endpoint
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {CSRF_HEADER_NAME: session_manager.csrf_token, "Origin": "http://localhost:5173"}
    resp = client.post(
        "/api/ats/match-job",
        json={"resume": canonical_resume, "job_text": job_text},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["match_score"] >= 80.0
    assert data["score_breakdown"]["languages"]["status"] == "evaluated"


def test_match_resume_supports_legacy_educations_and_language_name_aliases():
    """Memastikan payload legacy dengan key 'educations' dan 'name' pada bahasa tetap didukung."""
    legacy_resume = {
        "title": "Legacy Backend Engineer",
        "data": {
            "contact": {
                "fullName": "Hendro Pratama",
                "headline": "Backend Developer",
            },
            "summary": "Backend developer handal dengan keahlian Python.",
            "experiences": [
                {
                    "jobTitle": "Backend Developer",
                    "company": "PT Solusi Kode",
                    "startDate": "2021-01",
                    "endDate": "2023-12",
                    "description": "Membangun sistem API backend dengan Python dan PostgreSQL.",
                }
            ],
            "educations": [
                {
                    "degree": "S1",
                    "fieldOfStudy": "Sistem Informasi",
                    "school": "Universitas Bina Nusantara",
                }
            ],
            "skills": [
                {"name": "Python"},
                {"name": "PostgreSQL"},
            ],
            "languages": [
                {"name": "English", "proficiency": "Professional"},
            ],
        },
    }

    job_text = """
    Dibutuhkan Backend Developer.
    Kualifikasi Wajib:
    - Pendidikan S1 Sistem Informasi atau terkait.
    - Menguasai Python.
    - Fasih berbahasa English.
    """

    res = match_resume_to_job(legacy_resume, job_text)
    assert res["score_breakdown"]["education"]["status"] == "evaluated"
    assert res["score_breakdown"]["education"]["score"] >= 90.0
    assert res["score_breakdown"]["languages"]["status"] == "evaluated"
    assert res["score_breakdown"]["languages"]["score"] == 100.0
    assert res["capped_by_required"] is False
