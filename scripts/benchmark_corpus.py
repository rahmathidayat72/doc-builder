import sys
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.docx_generator import generate_resume_docx
from app.services.resume_parser import parse_resume_document

# 5 diverse corpus samples across different roles, industries, and experience levels
CORPUS_SAMPLES = [
    {
        "id": "corpus-01-swe",
        "title": "Senior Software Engineer",
        "templateId": "ats-clean",
        "colorTheme": "#4338ca",
        "fontFamily": "sans",
        "data": {
            "contact": {
                "fullName": "Budi Rahardjo",
                "email": "budi.rahardjo@example.com",
                "phone": "+6281234567890",
                "location": "Bandung, Indonesia",
                "linkedin": "https://linkedin.com/in/budirahardjo",
                "website": "https://budi.dev",
            },
            "summary": "Software engineer berpengalaman lebih dari 8 tahun dalam arsitektur sistem terdistribusi, microservices, dan high-concurrency systems menggunakan Go, Python, dan PostgreSQL.",
            "experiences": [
                {
                    "id": "exp-1",
                    "company": "PT Solusi Cloud Nusantara",
                    "jobTitle": "Lead Backend Engineer",
                    "startDate": "2021",
                    "endDate": "Sekarang",
                    "current": True,
                    "description": (
                        "• Memimpin tim 6 insinyur backend mengembangkan core banking microservices.\n"
                        "• Meningkatkan throughput sistem hingga 300% melalui optimasi caching Redis dan indexing database.\n"
                        "• Merancang sistem idempotent event delivery berbasis Apache Kafka."
                    ),
                },
                {
                    "id": "exp-2",
                    "company": "Techno Inovasi Labs",
                    "jobTitle": "Senior Software Developer",
                    "startDate": "2018",
                    "endDate": "2020",
                    "current": False,
                    "description": (
                        "• Mengembangkan REST API dan GraphQL endpoint untuk portal e-commerce dengan 500k aktif pengguna bulanan.\n"
                        "• Mengimplementasikan pipeline CI/CD otomatis menggunakan Docker dan GitHub Actions."
                    ),
                },
            ],
            "education": [
                {
                    "id": "edu-1",
                    "institution": "Institut Teknologi Bandung",
                    "degree": "Sarjana",
                    "fieldOfStudy": "Teknik Informatika",
                    "startDate": "2013",
                    "endDate": "2017",
                    "gpa": "3.85",
                    "description": "",
                }
            ],
            "skills": [
                {"id": "sk-1", "name": "Python", "category": "Technical"},
                {"id": "sk-2", "name": "Go", "category": "Technical"},
                {"id": "sk-3", "name": "PostgreSQL", "category": "Technical"},
                {"id": "sk-4", "name": "Docker", "category": "Tools"},
                {"id": "sk-5", "name": "Kafka", "category": "Technical"},
            ],
            "languages": [
                {"id": "lang-1", "language": "Bahasa Indonesia", "proficiency": "Native"},
                {"id": "lang-2", "language": "English", "proficiency": "Professional"},
            ],
            "customSections": [],
        },
    },
    {
        "id": "corpus-02-data",
        "title": "Lead Data Scientist",
        "templateId": "ats-modern",
        "colorTheme": "#059669",
        "fontFamily": "sans",
        "data": {
            "contact": {
                "fullName": "Siti Nurhaliza",
                "email": "siti.data@example.org",
                "phone": "+628119876543",
                "location": "Jakarta Selatan, Indonesia",
                "linkedin": "https://linkedin.com/in/sitinurhaliza",
                "website": "",
            },
            "summary": "Praktisi data science dan kecerdasan buatan dengan keahlian predictive modeling, NLP, dan machine learning operations untuk efisiensi bisnis.",
            "experiences": [
                {
                    "id": "exp-1",
                    "company": "Fintech Data Analytics Ltd",
                    "jobTitle": "Principal Data Scientist",
                    "startDate": "2022",
                    "endDate": "Sekarang",
                    "current": True,
                    "description": (
                        "• Mengembangkan model credit scoring real-time yang menurunkan default rate sebesar 18%.\n"
                        "• Memelihara infrastructure retraining otomatis model berbasis MLflow dan Kubeflow."
                    ),
                }
            ],
            "education": [
                {
                    "id": "edu-1",
                    "institution": "Universitas Indonesia",
                    "degree": "Magister",
                    "fieldOfStudy": "Ilmu Komputer",
                    "startDate": "2019",
                    "endDate": "2021",
                    "gpa": "3.92",
                    "description": "",
                }
            ],
            "skills": [
                {"id": "sk-1", "name": "Python", "category": "Technical"},
                {"id": "sk-2", "name": "PyTorch", "category": "Technical"},
                {"id": "sk-3", "name": "SQL", "category": "Technical"},
                {"id": "sk-4", "name": "MLOps", "category": "Tools"},
            ],
            "languages": [
                {"id": "lang-1", "language": "Bahasa Indonesia", "proficiency": "Native"},
                {"id": "lang-2", "language": "English", "proficiency": "Professional"},
            ],
            "customSections": [],
        },
    },
    {
        "id": "corpus-03-fresh-grad",
        "title": "Junior Business Analyst",
        "templateId": "ats-compact",
        "colorTheme": "#2563eb",
        "fontFamily": "serif",
        "data": {
            "contact": {
                "fullName": "Ahmad Fauzi",
                "email": "ahmad.fauzi@alumni.ac.id",
                "phone": "+6285711223344",
                "location": "Surabaya, Indonesia",
                "linkedin": "https://linkedin.com/in/ahmadfauzi",
                "website": "",
            },
            "summary": "Lulusan Manajemen Bisnis berprestasi dengan pemahaman analitik data, riset pasar kuantitatif, dan pemodelan proses bisnis.",
            "experiences": [
                {
                    "id": "exp-1",
                    "company": "PT Retail Mega Perkasa",
                    "jobTitle": "Business Analyst Intern",
                    "startDate": "2023",
                    "endDate": "2023",
                    "current": False,
                    "description": (
                        "• Menganalisis pola perilaku belanja 50.000 pelanggan menggunakan Tableau dan Excel.\n"
                        "• Menyusun rekomendasi reorder point persediaan yang menghemat biaya simpan hingga 12%."
                    ),
                }
            ],
            "education": [
                {
                    "id": "edu-1",
                    "institution": "Universitas Airlangga",
                    "degree": "Sarjana",
                    "fieldOfStudy": "Manajemen Bisnis",
                    "startDate": "2019",
                    "endDate": "2023",
                    "gpa": "3.78",
                    "description": "",
                }
            ],
            "skills": [
                {"id": "sk-1", "name": "Tableau", "category": "Technical"},
                {"id": "sk-2", "name": "Excel", "category": "Tools"},
                {"id": "sk-3", "name": "BPMN", "category": "Technical"},
                {"id": "sk-4", "name": "Financial Modeling", "category": "Business"},
            ],
            "languages": [
                {"id": "lang-1", "language": "Bahasa Indonesia", "proficiency": "Native"},
                {"id": "lang-2", "language": "English", "proficiency": "Intermediate"},
            ],
            "customSections": [],
        },
    },
    {
        "id": "corpus-04-pm",
        "title": "Technical Product Manager",
        "templateId": "ats-clean",
        "colorTheme": "#0f766e",
        "fontFamily": "sans",
        "data": {
            "contact": {
                "fullName": "Dewi Anggraini",
                "email": "dewi.anggraini@product.id",
                "phone": "+6281344556677",
                "location": "Yogyakarta, Indonesia",
                "linkedin": "https://linkedin.com/in/dewianggraini",
                "website": "https://dewi.product.id",
            },
            "summary": "Product Manager dengan latar belakang teknologi informasi, berfokus pada produk B2B SaaS, API integrations, dan discovery.",
            "experiences": [
                {
                    "id": "exp-1",
                    "company": "SaaS Omnichannel Asia",
                    "jobTitle": "Senior Product Manager",
                    "startDate": "2020",
                    "endDate": "Sekarang",
                    "current": True,
                    "description": (
                        "• Memimpin roadmap platform integrasi CRM omnichannel yang digunakan 1.200 enterprise client.\n"
                        "• Mengurangi churn rate tahunan dari 8.5% menjadi 3.2% melalui penyempurnaan alur onboarding."
                    ),
                }
            ],
            "education": [
                {
                    "id": "edu-1",
                    "institution": "Universitas Gadjah Mada",
                    "degree": "Sarjana",
                    "fieldOfStudy": "Teknologi Informasi",
                    "startDate": "2014",
                    "endDate": "2018",
                    "gpa": "3.80",
                    "description": "",
                }
            ],
            "skills": [
                {"id": "sk-1", "name": "Product Strategy", "category": "Management"},
                {"id": "sk-2", "name": "Agile Scrum", "category": "Methodology"},
                {"id": "sk-3", "name": "API Design", "category": "Technical"},
                {"id": "sk-4", "name": "User Research", "category": "Research"},
            ],
            "languages": [
                {"id": "lang-1", "language": "Bahasa Indonesia", "proficiency": "Native"},
                {"id": "lang-2", "language": "English", "proficiency": "Professional"},
            ],
            "customSections": [],
        },
    },
    {
        "id": "corpus-05-designer",
        "title": "Senior UX Researcher & Designer",
        "templateId": "ats-modern",
        "colorTheme": "#b45309",
        "fontFamily": "sans",
        "data": {
            "contact": {
                "fullName": "Reza Rahadian Pratama",
                "email": "reza.ux@example.com",
                "phone": "+6281788990011",
                "location": "Denpasar, Indonesia",
                "linkedin": "https://linkedin.com/in/rezapratama",
                "website": "https://rezaux.design",
            },
            "summary": "Product Designer dengan pendekatan human-centered design, spesialisasi dalam usability testing, design systems, dan aksesibilitas.",
            "experiences": [
                {
                    "id": "exp-1",
                    "company": "Studio Kreasi Antarmuka",
                    "jobTitle": "Lead Product Designer",
                    "startDate": "2019",
                    "endDate": "Sekarang",
                    "current": True,
                    "description": (
                        "• Merancang design system multi-platform terpadu yang memangkas waktu delivery fitur sebesar 40%.\n"
                        "• Melakukan audit aksesibilitas menyeluruh mencapai skor kepatuhan WCAG 2.2 AA pada aplikasi publik."
                    ),
                }
            ],
            "education": [
                {
                    "id": "edu-1",
                    "institution": "Institut Seni Indonesia Denpasar",
                    "degree": "Sarjana",
                    "fieldOfStudy": "Desain Komunikasi Visual",
                    "startDate": "2015",
                    "endDate": "2019",
                    "gpa": "3.75",
                    "description": "",
                }
            ],
            "skills": [
                {"id": "sk-1", "name": "Figma", "category": "Design"},
                {"id": "sk-2", "name": "Design Systems", "category": "Design"},
                {"id": "sk-3", "name": "WCAG", "category": "Technical"},
                {"id": "sk-4", "name": "Usability Testing", "category": "Research"},
            ],
            "languages": [
                {"id": "lang-1", "language": "Bahasa Indonesia", "proficiency": "Native"},
                {"id": "lang-2", "language": "English", "proficiency": "Professional"},
            ],
            "customSections": [],
        },
    },
]


def calculate_fidelity(source: dict, parsed: dict) -> dict:
    """
    Hitung skor fidelitas struktural dan tekstual antara sumber asli
    dan hasil parsing dokumen yang di-generate.
    """
    src_data = source["data"]
    score_weights = {
        "contact_fullName": 15,
        "contact_email": 10,
        "contact_phone": 10,
        "summary": 15,
        "experiences": 20,
        "education": 15,
        "skills": 15,
    }

    achieved_scores = {}

    # 1. Contact Info
    parsed_contact = parsed.get("contact", {})
    src_name = src_data["contact"]["fullName"].lower()
    parsed_name = (parsed_contact.get("fullName") or "").lower()
    achieved_scores["contact_fullName"] = 100 if any(part in parsed_name for part in src_name.split()) else 0

    src_email = src_data["contact"]["email"].lower()
    parsed_email = (parsed_contact.get("email") or "").lower()
    achieved_scores["contact_email"] = 100 if src_email in parsed_email else 0

    src_clean_phone = "".join(c for c in src_data["contact"]["phone"] if c.isdigit())
    parsed_clean_phone = "".join(c for c in (parsed_contact.get("phone") or "") if c.isdigit())
    achieved_scores["contact_phone"] = 100 if src_clean_phone in parsed_clean_phone or parsed_clean_phone in src_clean_phone else 0

    # 2. Ringkasan / Summary
    parsed_summary = (parsed.get("summary") or "").lower()
    src_summary_words = set(src_data["summary"].lower().split())
    matched_words = sum(1 for w in src_summary_words if len(w) > 3 and w in parsed_summary)
    summary_ratio = matched_words / max(len([w for w in src_summary_words if len(w) > 3]), 1)
    achieved_scores["summary"] = min(100, int(summary_ratio * 100))

    # 3. Pengalaman Kerja / Experiences
    src_exp = src_data.get("experiences", [])
    parsed_exp = parsed.get("experiences", [])
    if not src_exp:
        achieved_scores["experiences"] = 100
    else:
        exp_matches = 0
        for exp in src_exp:
            exp_company = exp["company"].lower()
            exp_job = exp["jobTitle"].lower()
            found = any(
                exp_company in (pe.get("company") or "").lower()
                or (pe.get("company") or "").lower() in exp_company
                or exp_job in (pe.get("role") or pe.get("jobTitle") or "").lower()
                or (pe.get("role") or pe.get("jobTitle") or "").lower() in exp_job
                for pe in parsed_exp
            )
            if found:
                exp_matches += 1
        achieved_scores["experiences"] = min(100, int((exp_matches / len(src_exp)) * 100))

    # 4. Pendidikan / Education
    src_edu = src_data.get("education", [])
    parsed_edu = parsed.get("education", [])
    if not src_edu:
        achieved_scores["education"] = 100
    else:
        edu_matches = 0
        for edu in src_edu:
            inst = edu["institution"].lower()
            if any(inst in (pe.get("institution") or "").lower() or (pe.get("institution") or "").lower() in inst for pe in parsed_edu):
                edu_matches += 1
        achieved_scores["education"] = min(100, int((edu_matches / len(src_edu)) * 100))

    # 5. Keahlian / Skills
    src_skills = [s["name"].lower() for s in src_data.get("skills", [])]
    parsed_skills = [s["name"].lower() for s in parsed.get("skills", [])]
    if not src_skills:
        achieved_scores["skills"] = 100
    else:
        skill_matches = sum(1 for s in src_skills if any(s in ps or ps in s for ps in parsed_skills))
        achieved_scores["skills"] = min(100, int((skill_matches / len(src_skills)) * 100))

    total_score = sum(achieved_scores[k] * (score_weights[k] / 100) for k in score_weights)
    return {
        "total_score": round(total_score, 2),
        "breakdown": achieved_scores,
    }


def main():
    print("=" * 65)
    print("DOC-BUILDER CORPUS FIDELITY BENCHMARK (TARGET: >= 95.0%)")
    print("=" * 65)

    all_scores = []

    for idx, sample in enumerate(CORPUS_SAMPLES, start=1):
        # 1. Hasilkan dokumen DOCX dari payload resume
        docx_bytes = generate_resume_docx(sample)

        # 2. Parse kembali dokumen DOCX yang dihasilkan
        parse_resp = parse_resume_document(docx_bytes.getvalue(), f"{sample['id']}.docx")
        parsed_result = parse_resp.get("data", {})

        # 3. Hitung metrik fidelitas
        metrics = calculate_fidelity(sample, parsed_result)
        score = metrics["total_score"]
        all_scores.append(score)

        print(f"Sample {idx:02d}: [{sample['id']}] - {sample['title']}")
        print(f"  Skor Fidelitas: {score:.2f}% | Status: {'PASS' if score >= 95.0 else 'FAIL'}")
        for section, sec_score in metrics["breakdown"].items():
            print(f"    - {section:20s}: {sec_score}%")
        print("-" * 65)

    avg_fidelity = sum(all_scores) / len(all_scores)
    print(f"\nRata-rata Fidelitas Corpus ({len(CORPUS_SAMPLES)} Sampel): {avg_fidelity:.2f}%")
    print("Ambang Batas Target : >= 95.00%")

    if avg_fidelity >= 95.0:
        print("[OK] Kriteria fidelitas corpus terpenuhi (PASS).")
        return 0
    else:
        print("[FAIL] Kriteria fidelitas korpus di bawah target 95%!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
