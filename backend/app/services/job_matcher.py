import datetime
import re
from collections import Counter
from typing import Any

STOPWORDS_ID = {
    "dan",
    "yang",
    "untuk",
    "pada",
    "ke",
    "di",
    "dari",
    "ini",
    "itu",
    "dengan",
    "adalah",
    "sebagai",
    "dalam",
    "atau",
    "oleh",
    "secara",
    "dapat",
    "kami",
    "saya",
    "anda",
    "dia",
    "mereka",
    "kita",
    "bisa",
    "akan",
    "telah",
    "sudah",
    "sedang",
    "harus",
    "hanya",
    "juga",
    "tentang",
    "atas",
    "bawah",
    "antara",
    "setelah",
    "sebelum",
    "karena",
    "jika",
    "maka",
    "seperti",
    "tahun",
    "bulan",
    "hari",
    "tersebut",
    "minimal",
    "bidang",
    "terkait",
    "bergabung",
    "mencari",
    "dibutuhkan",
    "memiliki",
    "kualifikasi",
    "kebutuhan",
    "ringkasan",
    "pengalaman",
    "kerja",
    "kantor",
    "sebelumnya",
    "pendidikan",
    "keahlian",
    "posisi",
    "tanggung",
    "jawab",
}

STOPWORDS_EN = {
    "and",
    "the",
    "for",
    "in",
    "to",
    "at",
    "from",
    "this",
    "that",
    "with",
    "is",
    "as",
    "on",
    "or",
    "by",
    "can",
    "we",
    "i",
    "you",
    "they",
    "our",
    "will",
    "have",
    "has",
    "been",
    "being",
    "must",
    "only",
    "also",
    "about",
    "over",
    "between",
    "after",
    "before",
    "because",
    "if",
    "then",
    "such",
    "year",
    "years",
    "month",
    "day",
    "minimum",
    "field",
    "related",
    "looking",
    "needed",
    "qualification",
    "requirements",
    "summary",
    "experience",
    "work",
    "education",
    "skills",
    "position",
    "responsibilities",
    "preferred",
    "plus",
    "strong",
}

ALL_STOPWORDS = STOPWORDS_ID | STOPWORDS_EN

CANONICAL_SKILLS = {
    # Backend & Programming
    "python",
    "fastapi",
    "django",
    "flask",
    "typescript",
    "javascript",
    "golang",
    "go",
    "java",
    "c#",
    "c++",
    "rust",
    "php",
    "ruby",
    "sql",
    "bash",
    "shell",
    # Frontend & Design
    "react",
    "react.js",
    "next.js",
    "nextjs",
    "vue",
    "vue.js",
    "angular",
    "tailwind css",
    "tailwind",
    "html",
    "html5",
    "css",
    "css3",
    "figma",
    "adobe xd",
    "sketch",
    "prototyping",
    "wireframing",
    "user research",
    "usability testing",
    "design system",
    # Mobile
    "flutter",
    "react native",
    "swift",
    "kotlin",
    "android",
    "ios",
    # Data & Analytics
    "power bi",
    "tableau",
    "pandas",
    "numpy",
    "matplotlib",
    "seaborn",
    "excel",
    "data visualization",
    "data cleansing",
    "statistics",
    "bigquery",
    "snowflake",
    "dbt",
    # Databases & Caching
    "postgresql",
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "elasticsearch",
    "sqlite",
    # Architecture & DevOps
    "docker",
    "kubernetes",
    "git",
    "ci/cd",
    "rest api",
    "restful api",
    "rest",
    "graphql",
    "microservices",
    "linux",
    "aws",
    "gcp",
    "azure",
    # Testing
    "pytest",
    "unittest",
    "vitest",
    "jest",
    "playwright",
    "cypress",
    "automated testing",
    # Soft skills & concepts
    "analytical thinking",
    "communication",
    "problem solving",
    "team leadership",
}

SYNONYM_MAP = {
    "react.js": "react",
    "next.js": "nextjs",
    "postgres": "postgresql",
    "restful api": "rest api",
    "rest": "rest api",
    "automated testing": "unit testing",
    "user interview": "user research",
    "tailwind": "tailwind css",
    "html5": "html",
    "css3": "css",
}

# Taksonomi Keluarga Peran / Jabatan
ROLE_TAXONOMY: dict[str, dict[str, Any]] = {
    "backend_engineer": {
        "title": "Backend Engineer",
        "family": "backend",
        "aliases": [
            "backend engineer",
            "backend developer",
            "pengembang backend",
            "rekayasawan backend",
            "python developer",
            "golang developer",
            "java developer",
            "api engineer",
            "api developer",
        ],
    },
    "frontend_engineer": {
        "title": "Frontend Engineer",
        "family": "frontend",
        "aliases": [
            "frontend engineer",
            "frontend developer",
            "pengembang frontend",
            "rekayasawan frontend",
            "react developer",
            "vue developer",
            "web developer",
            "ui engineer",
        ],
    },
    "fullstack_engineer": {
        "title": "Fullstack Engineer",
        "family": "fullstack",
        "aliases": [
            "fullstack engineer",
            "fullstack developer",
            "full stack engineer",
            "full stack developer",
            "software engineer",
            "software developer",
            "programmer",
            "rekayasawan perangkat lunak",
            "pengembang perangkat lunak",
        ],
    },
    "mobile_developer": {
        "title": "Mobile Developer",
        "family": "mobile",
        "aliases": [
            "mobile developer",
            "mobile engineer",
            "android developer",
            "ios developer",
            "flutter developer",
            "react native developer",
            "pengembang aplikasi mobile",
        ],
    },
    "devops_engineer": {
        "title": "DevOps Engineer",
        "family": "devops",
        "aliases": [
            "devops engineer",
            "cloud engineer",
            "site reliability engineer",
            "sre",
            "infrastructure engineer",
            "platform engineer",
            "system administrator",
            "sysadmin",
        ],
    },
    "data_engineer": {
        "title": "Data Engineer",
        "family": "data",
        "aliases": [
            "data engineer",
            "big data engineer",
            "etl developer",
            "rekayasawan data",
        ],
    },
    "data_scientist": {
        "title": "Data Scientist / Analyst",
        "family": "data",
        "aliases": [
            "data scientist",
            "data analyst",
            "business intelligence analyst",
            "bi analyst",
            "analis data",
            "machine learning engineer",
            "ai engineer",
        ],
    },
    "qa_engineer": {
        "title": "QA Engineer",
        "family": "qa",
        "aliases": [
            "qa engineer",
            "quality assurance engineer",
            "software tester",
            "test automation engineer",
            "sdet",
            "quality assurance",
            "penguji perangkat lunak",
        ],
    },
    "ui_ux_designer": {
        "title": "UI/UX Designer",
        "family": "ui_ux",
        "aliases": [
            "ui/ux designer",
            "product designer",
            "ux designer",
            "ui designer",
            "desainer ui/ux",
            "desainer produk",
            "ux researcher",
        ],
    },
    "product_manager": {
        "title": "Product Manager",
        "family": "product",
        "aliases": [
            "product manager",
            "associate product manager",
            "technical product manager",
            "product owner",
            "manajer produk",
        ],
    },
    "project_manager": {
        "title": "Project Manager",
        "family": "project",
        "aliases": [
            "project manager",
            "project coordinator",
            "scrum master",
            "technical project manager",
            "manajer proyek",
        ],
    },
    "marketing_specialist": {
        "title": "Digital Marketing Specialist",
        "family": "marketing",
        "aliases": [
            "digital marketing specialist",
            "seo specialist",
            "content writer",
            "social media specialist",
            "copywriter",
            "marketing specialist",
            "spesialis pemasaran",
        ],
    },
    "finance_officer": {
        "title": "Finance / Accounting",
        "family": "finance",
        "aliases": [
            "accounting officer",
            "akuntan",
            "finance officer",
            "financial analyst",
            "staf akuntansi",
            "staf keuangan",
        ],
    },
    "hr_officer": {
        "title": "Human Resources Officer",
        "family": "hr",
        "aliases": [
            "hr officer",
            "human resources officer",
            "talent acquisition specialist",
            "recruiter",
            "hr generalist",
            "staf sdm",
        ],
    },
}

# Hubungan kedekatan keluarga peran (Role Family Affinity)
ROLE_FAMILY_AFFINITY: dict[tuple[str, str], float] = {
    ("backend", "fullstack"): 0.85,
    ("fullstack", "backend"): 0.85,
    ("frontend", "fullstack"): 0.85,
    ("fullstack", "frontend"): 0.85,
    ("backend", "devops"): 0.65,
    ("devops", "backend"): 0.65,
    ("backend", "data"): 0.55,
    ("data", "backend"): 0.55,
    ("frontend", "ui_ux"): 0.65,
    ("ui_ux", "frontend"): 0.65,
    ("backend", "qa"): 0.50,
    ("qa", "backend"): 0.50,
    ("frontend", "backend"): 0.45,
    ("backend", "frontend"): 0.45,
    ("fullstack", "mobile"): 0.70,
    ("mobile", "fullstack"): 0.70,
    ("frontend", "mobile"): 0.60,
    ("mobile", "frontend"): 0.60,
    ("product", "project"): 0.75,
    ("project", "product"): 0.75,
}

SENIORITY_RANKS = {
    "intern": 1,
    "magang": 1,
    "junior": 2,
    "entry": 2,
    "fresh graduate": 2,
    "freshgrad": 2,
    "lulusan baru": 2,
    "mid": 3,
    "associate": 3,
    "intermediate": 3,
    "senior": 4,
    "sr": 4,
    "lead": 5,
    "principal": 5,
    "staff": 5,
    "kepala": 5,
    "manager": 6,
    "head": 6,
    "director": 6,
}

EDUCATION_LEVEL_RANKS = {
    "smk": 1,
    "sma": 1,
    "high school": 1,
    "d3": 2,
    "diploma": 2,
    "d4": 3,
    "s1": 3,
    "sarjana": 3,
    "bachelor": 3,
    "undergraduate": 3,
    "s2": 4,
    "magister": 4,
    "master": 4,
    "postgraduate": 4,
    "s3": 5,
    "doktor": 5,
    "phd": 5,
}

TECH_FIELDS_OF_STUDY = {
    "teknik informatika",
    "ilmu komputer",
    "sistem informasi",
    "computer science",
    "information technology",
    "software engineering",
    "teknik elektro",
    "teknik komputer",
    "rekayasa perangkat lunak",
}

LANGUAGE_TAXONOMY = {
    "inggris": ["inggris", "english", "toefl", "ielts", "toeic"],
    "indonesia": ["indonesia", "indonesian"],
    "mandarin": ["mandarin", "chinese", "hsk"],
    "jepang": ["jepang", "japanese", "jlpt"],
}


def normalize_text(text: str) -> str:
    """Normalisasi teks dasar untuk tokenisasi."""
    text = text.lower()
    text = re.sub(r"[/\\,\(\)\[\]\{\}:;*•\-\–\|\!\?]", " ", text)
    text = re.sub(r"\.(?=\s|$)", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_tokens(text: str, remove_stopwords: bool = True) -> list[str]:
    """Ekstraksi token kata (unigram) bersih."""
    norm = normalize_text(text)
    words = [w.strip(".!,?") for w in norm.split() if len(w.strip(".!,?")) > 1]
    if remove_stopwords:
        words = [w for w in words if w not in ALL_STOPWORDS]
    return words


def extract_ngrams(tokens: list[str], n: int) -> list[str]:
    """Ekstraksi n-gram berurutan."""
    if len(tokens) < n:
        return []
    return [" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)]


def extract_skills_from_text(text: str) -> set[str]:
    """
    Ekstraksi keahlian terstandar menggunakan kamus taksonomi dan n-gram matching.
    """
    norm = normalize_text(text)
    tokens_raw = [w.strip(".!,?") for w in norm.split() if len(w.strip(".!,?")) > 0]

    found_skills = set()
    unigrams = tokens_raw
    bigrams = extract_ngrams(tokens_raw, 2)
    trigrams = extract_ngrams(tokens_raw, 3)

    all_candidates = set(unigrams + bigrams + trigrams)

    for cand in all_candidates:
        mapped = SYNONYM_MAP.get(cand, cand)
        if mapped in CANONICAL_SKILLS:
            found_skills.add(mapped)

    return found_skills


class PureBM25Ranker:
    """
    Menghitung skor relevansi informasi probabilitik dokumen terhadap deskripsi lowongan.
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b

    def score(self, cv_text: str, job_desc: str) -> float:
        query_tokens = extract_tokens(job_desc, remove_stopwords=True)
        doc_tokens = extract_tokens(cv_text, remove_stopwords=True)

        if not query_tokens or not doc_tokens:
            return 0.0

        doc_len = len(doc_tokens)
        doc_freq = Counter(doc_tokens)

        score = 0.0
        for token in query_tokens:
            f = doc_freq.get(token, 0)
            if f > 0:
                num = f * (self.k1 + 1)
                denom = f + self.k1 * (1 - self.b + self.b * (doc_len / 150.0))
                score += num / denom

        max_possible = len(query_tokens) * (self.k1 + 1)
        normalized = (score / max_possible) * 100.0 if max_possible > 0 else 0.0
        return round(min(100.0, normalized * 2.2), 1)


def parse_date_to_year_month(val: Any) -> tuple[int, int] | None:
    """Mengubah string tanggal fleksibel ke (tahun, bulan)."""
    if not val or not isinstance(val, str):
        return None
    cleaned = val.strip().lower()
    if cleaned in ("present", "sekarang", "saat ini", "current"):
        now = datetime.datetime.now()
        return (now.year, now.month)

    # YYYY-MM atau YYYY/MM
    m1 = re.search(r"(\d{4})[-/.](\d{1,2})", cleaned)
    if m1:
        return (int(m1.group(1)), int(m1.group(2)))

    # MM-YYYY atau MM/YYYY
    m2 = re.search(r"(\d{1,2})[-/.](\d{4})", cleaned)
    if m2:
        return (int(m2.group(2)), int(m2.group(1)))

    # YYYY saja
    m3 = re.search(r"\b(19\d{2}|20\d{2})\b", cleaned)
    if m3:
        return (int(m3.group(1)), 1)

    return None


def calculate_cv_experience_months(experiences: list[dict[str, Any]]) -> int:
    """Menghitung total bulan durasi pengalaman kerja unik tanpa double-counting."""
    now = datetime.datetime.now()
    active_months: set[tuple[int, int]] = set()

    for exp in experiences:
        start = parse_date_to_year_month(exp.get("startDate"))
        end = parse_date_to_year_month(exp.get("endDate"))
        if exp.get("current") and not end:
            end = (now.year, now.month)
        if start and not end:
            end = (now.year, now.month)

        if start and end:
            s_yr, s_mo = start
            e_yr, e_mo = end
            if (e_yr, e_mo) < (s_yr, s_mo):
                e_yr, e_mo = s_yr, s_mo
            curr_y, curr_m = s_yr, s_mo
            while (curr_y, curr_m) <= (e_yr, e_mo):
                active_months.add((curr_y, curr_m))
                curr_m += 1
                if curr_m > 12:
                    curr_m = 1
                    curr_y += 1
                if len(active_months) >= 600:  # 50 tahun guard
                    break

    return len(active_months)


def detect_target_role(job_text: str) -> tuple[str | None, str | None, int | None, str]:
    """
    Mendeteksi posisi target, keluarga peran, tingkat senioritas, dan judul mentah dari lowongan.
    Returns: (role_key, role_family, seniority_rank, detected_title)
    """
    lines = [line.strip() for line in job_text.splitlines() if line.strip()]
    header_chunk = " ".join(lines[:4]).lower() if lines else job_text.lower()

    # Cek senioritas
    detected_seniority_rank: int | None = None
    for kw, rank in sorted(SENIORITY_RANKS.items(), key=lambda x: -len(x[0])):
        if re.search(r"\b" + re.escape(kw) + r"\b", header_chunk):
            detected_seniority_rank = rank
            break

    # Cek pencocokan alias peran
    best_role_key: str | None = None
    best_family: str | None = None
    detected_title: str = ""
    longest_match_len = 0

    full_norm = normalize_text(header_chunk)
    for r_key, r_info in ROLE_TAXONOMY.items():
        for alias in r_info["aliases"]:
            if re.search(r"\b" + re.escape(alias) + r"\b", full_norm):
                if len(alias) > longest_match_len:
                    longest_match_len = len(alias)
                    best_role_key = r_key
                    best_family = r_info["family"]
                    detected_title = r_info["title"]

    # Jika belum ditemukan di header, coba cari di seluruh teks
    if not best_role_key:
        body_norm = normalize_text(job_text)
        for r_key, r_info in ROLE_TAXONOMY.items():
            for alias in r_info["aliases"]:
                if re.search(r"\b" + re.escape(alias) + r"\b", body_norm):
                    if len(alias) > longest_match_len:
                        longest_match_len = len(alias)
                        best_role_key = r_key
                        best_family = r_info["family"]
                        detected_title = r_info["title"]

    return best_role_key, best_family, detected_seniority_rank, detected_title


def extract_candidate_roles(resume_dict: dict[str, Any]) -> list[dict[str, Any]]:
    """Mengekstrak seluruh peran/jabatan kandidat dari headline dan riwayat pengalaman."""
    data = resume_dict.get("data", {})
    contact = data.get("contact", {})
    experiences = data.get("experiences", [])

    candidate_roles: list[dict[str, Any]] = []

    # 1. Headline
    headline = contact.get("headline", "").strip()
    if headline:
        hl_norm = normalize_text(headline)
        for r_key, r_info in ROLE_TAXONOMY.items():
            for alias in r_info["aliases"]:
                if re.search(r"\b" + re.escape(alias) + r"\b", hl_norm):
                    # Check seniority
                    sr_rank = 3
                    for kw, rank in SENIORITY_RANKS.items():
                        if re.search(r"\b" + re.escape(kw) + r"\b", hl_norm):
                            sr_rank = rank
                            break
                    candidate_roles.append(
                        {
                            "source": "headline",
                            "raw": headline,
                            "role_key": r_key,
                            "family": r_info["family"],
                            "seniority": sr_rank,
                        }
                    )
                    break

    # 2. Experiences jobTitles
    for exp in experiences:
        title = exp.get("jobTitle", "").strip()
        if not title:
            continue
        t_norm = normalize_text(title)
        for r_key, r_info in ROLE_TAXONOMY.items():
            for alias in r_info["aliases"]:
                if re.search(r"\b" + re.escape(alias) + r"\b", t_norm):
                    sr_rank = 3
                    for kw, rank in SENIORITY_RANKS.items():
                        if re.search(r"\b" + re.escape(kw) + r"\b", t_norm):
                            sr_rank = rank
                            break
                    candidate_roles.append(
                        {
                            "source": "experience",
                            "raw": title,
                            "role_key": r_key,
                            "family": r_info["family"],
                            "seniority": sr_rank,
                        }
                    )
                    break

    return candidate_roles


def parse_job_qualifications_sections(job_text: str) -> tuple[set[str], set[str], set[str]]:
    """
    Memisahkan kriteria lowongan menjadi:
    - required_skills (syarat wajib)
    - preferred_skills (nilai tambah / preferred)
    - general_skills (keahlian umum yang disebut)
    """
    lines = job_text.splitlines()

    current_mode = "general"
    required_lines: list[str] = []
    preferred_lines: list[str] = []
    general_lines: list[str] = []

    for line in lines:
        cleaned = line.strip().lower()
        if not cleaned:
            continue

        # Header detection: hanya jika baris berupa judul/header pendek atau diakhiri titik dua
        is_header_format = cleaned.endswith(":") or (
            len(cleaned.split()) <= 4 and not cleaned.startswith(("-", "•", "*"))
        )

        if is_header_format and any(
            h in cleaned
            for h in [
                "kualifikasi wajib",
                "persyaratan wajib",
                "must have",
                "requirements",
                "persyaratan minimum",
                "kualifikasi minimum",
                "persyaratan",
                "kualifikasi",
            ]
        ):
            current_mode = "required"
            continue
        elif is_header_format and any(
            h in cleaned
            for h in [
                "nilai tambah",
                "nice to have",
                "preferred",
                "bonus points",
                "keuntungan",
                "diutamakan",
            ]
        ):
            current_mode = "preferred"
            continue
        elif is_header_format and any(
            h in cleaned
            for h in [
                "tanggung jawab",
                "job description",
                "responsibilities",
                "tentang perusahaan",
            ]
        ):
            current_mode = "general"
            continue

        # In-line indicator override
        if any(w in cleaned for w in ["wajib", "harus", "mandatory", "must", "diwajibkan"]):
            required_lines.append(cleaned)
        elif any(w in cleaned for w in ["nilai tambah", "nice to have", "plus", "diutamakan"]):
            preferred_lines.append(cleaned)
        elif current_mode == "required":
            required_lines.append(cleaned)
        elif current_mode == "preferred":
            preferred_lines.append(cleaned)
        else:
            general_lines.append(cleaned)

    required_skills = extract_skills_from_text(" ".join(required_lines))
    preferred_skills = extract_skills_from_text(" ".join(preferred_lines))
    general_skills = extract_skills_from_text(" ".join(general_lines))

    # Pastikan skills yang ada di required tidak dobel di preferred
    preferred_skills = preferred_skills - required_skills

    return required_skills, preferred_skills, general_skills


def detect_required_experience_years(job_text: str) -> float | None:
    """Mendeteksi syarat minimum tahun pengalaman kerja dari teks lowongan."""
    norm = normalize_text(job_text)
    # Contoh: "minimal 3 tahun", "min 2 years", "at least 3 years"
    patterns = [
        r"(?:minimal|min|at\s*least|pengalaman\s*minimal)\s*(\d+)(?:\+|\s*-\s*\d+)?\s*(?:tahun|thn|years?|yrs?)",
        r"(\d+)(?:\+|\s*-\s*\d+)?\s*(?:tahun|thn|years?|yrs?)\s*(?:pengalaman|experience)",
    ]
    for pat in patterns:
        m = re.search(pat, norm)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                pass
    return None


def detect_education_requirements(job_text: str) -> tuple[int | None, bool]:
    """
    Mendeteksi jenjang pendidikan minimum dan apakah bidang IT/Teknik diwajibkan.
    Returns: (min_degree_rank, tech_field_requested)
    """
    norm = normalize_text(job_text)
    detected_rank: int | None = None

    for deg, rank in sorted(EDUCATION_LEVEL_RANKS.items(), key=lambda x: -len(x[0])):
        if re.search(r"\b" + re.escape(deg) + r"\b", norm):
            if detected_rank is None or rank > detected_rank:
                detected_rank = rank

    tech_field_requested = any(field in norm for field in TECH_FIELDS_OF_STUDY) or any(
        kw in norm
        for kw in [
            "jurusan teknik",
            "jurusan komputer",
            "bidang terkait",
            "computer science",
            "it field",
        ]
    )

    return detected_rank, tech_field_requested


def detect_language_requirements(job_text: str) -> set[str]:
    """Mendeteksi persyaratan bahasa dari lowongan."""
    norm = normalize_text(job_text)
    required_langs = set()

    for lang_code, aliases in LANGUAGE_TAXONOMY.items():
        for alias in aliases:
            # Periksa apakah ada indikasi kebutuhan bahasa
            if re.search(
                r"(?:bahasa\s+|fluent\s+|fasih\s+|proficient\s+)" + re.escape(alias), norm
            ) or re.search(
                r"\b" + re.escape(alias) + r"\s+(?:aktif|pasif|fluent|proficient)\b", norm
            ):
                required_langs.add(lang_code)
                break

    return required_langs


def match_resume_to_job(resume_dict: dict[str, Any], job_text: str) -> dict[str, Any]:
    """
    Membandingkan data resume pengguna dengan teks lowongan kerja secara komprehensif:
    1. Posisi & Keluarga Peran (25%)
    2. Keahlian Terstandar Wajib vs Preferred (30%)
    3. Tanggung Jawab & Bukti Pengalaman (20%)
    4. Senioritas & Durasi Pengalaman (10%)
    5. Pendidikan & Bidang Studi (10%)
    6. Kemampuan Bahasa & Tambahan (5%)

    Aturan:
    - Normalisasi dinamis jika lowongan tidak menyebut kriteria tertentu.
    - Pembatasan skor maksimal 69 jika syarat kualifikasi wajib (required) tidak terpenuhi.
    - Status 'insufficient_data' jika lowongan tidak memiliki kriteria yang dapat dievaluasi.
    """
    clean_job_text = job_text.strip() if job_text else ""

    # Guard: data tidak cukup jika teks terlalu pendek (<15 char) atau tanpa karakter alfabetik
    alpha_chars = re.findall(r"[a-zA-Z]", clean_job_text)
    if len(clean_job_text) < 15 or len(alpha_chars) < 10:
        return {
            "match_score": 0.0,
            "bm25_score": 0.0,
            "matched_skills": [],
            "missing_skills": [],
            "matched_count": 0,
            "total_job_skills": 0,
            "advice": [
                "Deskripsi lowongan belum memuat informasi kualifikasi atau posisi yang "
                "memadai untuk dievaluasi. Tempel teks deskripsi lowongan yang memuat "
                "kualifikasi, tanggung jawab, atau keahlian yang dibutuhkan."
            ],
            "analysis_status": "insufficient_data",
            "confidence": "low",
            "capped_by_required": False,
            "target_role": None,
            "detected_seniority": None,
            "score_breakdown": {},
            "required_criteria": [],
            "missing_requirements": [],
        }

    data = resume_dict.get("data", {})
    contact = data.get("contact", {})
    summary = data.get("summary", "")
    experiences = data.get("experiences", [])
    skills_list = data.get("skills", [])
    educations = data.get("educations", [])
    languages_list = data.get("languages", [])

    # Kumpulkan seluruh teks dari CV
    cv_chunks = [
        contact.get("fullName", ""),
        contact.get("headline", ""),
        summary,
        " ".join([e.get("jobTitle", "") + " " + e.get("description", "") for e in experiences]),
        " ".join([s.get("name", "") for s in skills_list]),
        " ".join([ed.get("degree", "") + " " + ed.get("fieldOfStudy", "") for ed in educations]),
        " ".join([lang.get("name", "") for lang in languages_list]),
    ]
    cv_full_text = " ".join(cv_chunks)

    # 1. Parsing Kriteria Lowongan
    target_role_key, target_family, target_seniority, detected_role_title = detect_target_role(
        clean_job_text
    )
    req_skills, pref_skills, gen_skills = parse_job_qualifications_sections(clean_job_text)
    all_job_skills = req_skills | pref_skills | gen_skills

    req_exp_years = detect_required_experience_years(clean_job_text)
    req_degree_rank, tech_field_req = detect_education_requirements(clean_job_text)
    req_languages = detect_language_requirements(clean_job_text)

    # Cek apakah lowongan benar-benar punya kriteria terdeteksi
    has_any_criteria = bool(
        target_role_key or all_job_skills or req_exp_years or req_degree_rank or req_languages
    )
    if not has_any_criteria:
        return {
            "match_score": 0.0,
            "bm25_score": 0.0,
            "matched_skills": [],
            "missing_skills": [],
            "matched_count": 0,
            "total_job_skills": 0,
            "advice": [
                "Tidak ditemukan kata kunci kualifikasi atau posisi yang dapat dievaluasi. "
                "Pastikan deskripsi lowongan mencakup persyaratan keahlian atau jabatan kerja."
            ],
            "analysis_status": "insufficient_data",
            "confidence": "low",
            "capped_by_required": False,
            "target_role": None,
            "detected_seniority": None,
            "score_breakdown": {},
            "required_criteria": [],
            "missing_requirements": [],
        }

    missing_requirements: list[str] = []
    required_criteria_list: list[str] = []

    # -------------------------------------------------------------
    # DIMENSI 1: Posisi & Keluarga Peran (Default Weight: 25%)
    # -------------------------------------------------------------
    candidate_roles = extract_candidate_roles(resume_dict)
    role_score = 0.0
    role_status = "not_evaluated"
    role_evidence = None

    if target_family:
        role_status = "evaluated"
        target_role_display = detected_role_title or target_family.title()
        required_criteria_list.append(f"Posisi: {target_role_display}")

        if not candidate_roles:
            role_score = 15.0  # Tidak ada judul eksplisit di headline/pengalaman
            role_evidence = "Belum mencantumkan jabatan terkait di headline atau riwayat kerja."
            missing_requirements.append(
                f"Peran/jabatan '{target_role_display}' belum tampak di profil"
            )
        else:
            best_r_score = 10.0
            best_match_info = ""
            for cr in candidate_roles:
                # 1. Identik / alias langsung
                if cr["role_key"] == target_role_key:
                    best_r_score = max(best_r_score, 100.0)
                    best_match_info = f"Jabatan identik ({cr['raw']})"
                    break
                # 2. Satu keluarga peran
                elif cr["family"] == target_family:
                    best_r_score = max(best_r_score, 85.0)
                    best_match_info = f"Keluarga peran serumpun ({cr['raw']})"
                # 3. Keluarga berelasi
                else:
                    affinity = ROLE_FAMILY_AFFINITY.get((cr["family"], target_family), 0.15)
                    score_cand = affinity * 100.0
                    if score_cand > best_r_score:
                        best_r_score = score_cand
                        best_match_info = f"Peran berdekatan ({cr['raw']})"

            role_score = best_r_score
            role_evidence = best_match_info

            if role_score < 40.0:
                missing_requirements.append(
                    f"Keluarga peran target '{target_role_display}' berbeda dari riwayat jabatan"
                )

    # -------------------------------------------------------------
    # DIMENSI 2: Keahlian (Default Weight: 30%)
    # -------------------------------------------------------------
    cv_skills = extract_skills_from_text(cv_full_text)
    for s in skills_list:
        name_clean = s.get("name", "").strip().lower()
        if name_clean in CANONICAL_SKILLS:
            cv_skills.add(name_clean)
        mapped = SYNONYM_MAP.get(name_clean)
        if mapped:
            cv_skills.add(mapped)

    matched_skills = cv_skills.intersection(all_job_skills)
    missing_skills = all_job_skills - cv_skills

    skills_score = 0.0
    skills_status = "not_evaluated"
    if all_job_skills:
        skills_status = "evaluated"
        # Bobot ekstra untuk required skills
        if req_skills:
            matched_req = req_skills.intersection(cv_skills)
            missing_req_skills = req_skills - cv_skills
            req_ratio = len(matched_req) / len(req_skills)

            pref_matched = (pref_skills | gen_skills).intersection(cv_skills)
            pref_total = len(pref_skills | gen_skills)
            pref_ratio = (len(pref_matched) / pref_total) if pref_total > 0 else 1.0

            skills_score = (req_ratio * 70.0) + (pref_ratio * 30.0)

            for rs in sorted(list(req_skills)):
                required_criteria_list.append(f"Keahlian wajib: {rs}")
            for mrs in sorted(list(missing_req_skills)):
                missing_requirements.append(f"Keahlian wajib: {mrs}")
        else:
            skills_score = (len(matched_skills) / len(all_job_skills)) * 100.0

    # -------------------------------------------------------------
    # DIMENSI 3: Tanggung Jawab & Bukti Pengalaman (Default Weight: 20%)
    # -------------------------------------------------------------
    bm25 = PureBM25Ranker()
    bm25_score = bm25.score(cv_full_text, clean_job_text)

    # Evaluasi kecocokan aksi tanggung jawab di riwayat pekerjaan
    resp_tokens_job = extract_tokens(clean_job_text, remove_stopwords=True)
    exp_tokens = []
    for exp in experiences:
        desc = exp.get("description", "")
        achievements = exp.get("achievements", [])
        exp_tokens.extend(
            extract_tokens(desc + " " + " ".join(achievements), remove_stopwords=True)
        )

    resp_overlap_score = 0.0
    if resp_tokens_job and exp_tokens:
        job_counter = Counter(resp_tokens_job)
        exp_set = set(exp_tokens)
        matched_resp_tokens = [tok for tok in job_counter if tok in exp_set]
        resp_overlap_score = min(
            100.0, (len(matched_resp_tokens) / max(5, min(30, len(job_counter)))) * 100.0
        )

    responsibilities_score = round(0.5 * bm25_score + 0.5 * resp_overlap_score, 1)
    resp_status = (
        "evaluated"
        if (resp_tokens_job and experiences)
        else ("partial" if experiences else "not_evaluated")
    )

    # -------------------------------------------------------------
    # DIMENSI 4: Senioritas & Durasi Pengalaman (Default Weight: 10%)
    # -------------------------------------------------------------
    cv_exp_months = calculate_cv_experience_months(experiences)
    cv_exp_years = round(cv_exp_months / 12.0, 1)

    exp_score = 100.0
    exp_status = "not_evaluated"
    exp_evidence = f"Pengalaman kerja terakumulasi: {cv_exp_years} tahun"

    if req_exp_years is not None:
        exp_status = "evaluated"
        required_criteria_list.append(f"Pengalaman kerja minimum {req_exp_years:g} tahun")
        if cv_exp_years >= req_exp_years:
            exp_score = 100.0
        elif cv_exp_years > 0:
            exp_score = round((cv_exp_years / req_exp_years) * 100.0, 1)
            missing_requirements.append(
                f"Durasi kerja ({cv_exp_years:g} thn) kurang dari syarat ({req_exp_years:g} thn)"
            )
        else:
            exp_score = 15.0
            missing_requirements.append(
                f"Belum memiliki durasi pengalaman {req_exp_years:g} tahun yang dipersyaratkan"
            )

    # Evaluasi kesesuaian ranking senioritas
    if target_seniority and target_seniority >= 4:  # Senior / Lead / Manager
        seniority_name = [k for k, v in SENIORITY_RANKS.items() if v == target_seniority][0].title()
        required_criteria_list.append(f"Tingkat senioritas: {seniority_name}")
        # Cari senioritas tertinggi yang pernah dimiliki kandidat
        max_candidate_sr = max(
            [cr["seniority"] for cr in candidate_roles], default=2 if experiences else 1
        )
        if max_candidate_sr < target_seniority:
            # Kandidat junior/entry melamar posisi senior
            sr_gap_penalty = (target_seniority - max_candidate_sr) * 20.0
            exp_score = max(10.0, exp_score - sr_gap_penalty)
            exp_status = "evaluated"
            missing_requirements.append(
                f"Tingkat posisi belum setara dengan senioritas {seniority_name} yang diminta"
            )

    # -------------------------------------------------------------
    # DIMENSI 5: Pendidikan & Bidang Studi (Default Weight: 10%)
    # -------------------------------------------------------------
    edu_score = 100.0
    edu_status = "not_evaluated"
    edu_evidence = None

    if req_degree_rank is not None or tech_field_req:
        edu_status = "evaluated"
        best_cand_rank = 0
        cand_has_tech_field = False
        cand_edu_desc = []

        for ed in educations:
            deg = ed.get("degree", "").lower()
            field = ed.get("fieldOfStudy", "").lower()
            cand_edu_desc.append(f"{ed.get('degree', '')} {ed.get('fieldOfStudy', '')}".strip())

            for d_name, rank in EDUCATION_LEVEL_RANKS.items():
                if d_name in deg:
                    best_cand_rank = max(best_cand_rank, rank)

            if any(tf in field for tf in TECH_FIELDS_OF_STUDY):
                cand_has_tech_field = True

        target_degree_name = "Perguruan Tinggi / Sarjana"
        if req_degree_rank:
            target_degree_name = [
                k for k, v in EDUCATION_LEVEL_RANKS.items() if v == req_degree_rank
            ][0].upper()
            required_criteria_list.append(f"Pendidikan minimum: {target_degree_name}")

        edu_evidence = ", ".join([d for d in cand_edu_desc if d]) or "Belum ada riwayat pendidikan"

        if req_degree_rank and best_cand_rank < req_degree_rank:
            if best_cand_rank > 0:
                edu_score = 50.0
            else:
                edu_score = 25.0
            missing_requirements.append(
                f"Jenjang pendidikan belum memenuhi kriteria minimum ({target_degree_name})"
            )
        else:
            edu_score = 100.0

        if tech_field_req and not cand_has_tech_field:
            edu_score = max(30.0, edu_score - 30.0)
            missing_requirements.append(
                "Bidang studi belum teridentifikasi dalam rumpun teknik/komputer yang dicari"
            )

    # -------------------------------------------------------------
    # DIMENSI 6: Kemampuan Bahasa & Kriteria Lain (Default Weight: 5%)
    # -------------------------------------------------------------
    lang_score = 100.0
    lang_status = "not_evaluated"
    lang_evidence = None

    if req_languages:
        lang_status = "evaluated"
        cand_langs = set()
        for lang_item in languages_list:
            cand_langs.add(lang_item.get("name", "").strip().lower())
        # Ekstrak juga dari cv_full_text
        for l_code, aliases in LANGUAGE_TAXONOMY.items():
            for alias in aliases:
                if re.search(r"\b" + re.escape(alias) + r"\b", cv_full_text.lower()):
                    cand_langs.add(l_code)

        matched_langs = set()
        for rl in req_languages:
            required_criteria_list.append(f"Bahasa: {rl.title()}")
            for alias in LANGUAGE_TAXONOMY[rl]:
                if any(alias in cl for cl in cand_langs):
                    matched_langs.add(rl)
                    break

        missing_langs = req_languages - matched_langs
        if matched_langs:
            lang_score = (len(matched_langs) / len(req_languages)) * 100.0
        else:
            lang_score = 20.0

        lang_evidence = f"Bahasa terdeteksi: {', '.join(sorted(list(cand_langs))) or 'None'}"
        for ml in sorted(list(missing_langs)):
            missing_requirements.append(
                f"Persyaratan kemampuan bahasa {ml.title()} belum tertera di CV"
            )

    # -------------------------------------------------------------
    # Normalisasi Dinamis Bobot (Dynamic Normalization)
    # -------------------------------------------------------------
    dimension_weights = {
        "role": 0.25 if role_status == "evaluated" else 0.0,
        "skills": 0.30 if skills_status == "evaluated" else 0.0,
        "responsibilities": 0.20 if resp_status in ("evaluated", "partial") else 0.0,
        "experience": 0.10 if exp_status == "evaluated" else 0.0,
        "education": 0.10 if edu_status == "evaluated" else 0.0,
        "languages": 0.05 if lang_status == "evaluated" else 0.0,
    }

    dimension_scores = {
        "role": role_score,
        "skills": skills_score,
        "responsibilities": responsibilities_score,
        "experience": exp_score,
        "education": edu_score,
        "languages": lang_score,
    }

    total_active_weight = sum(dimension_weights.values())

    if total_active_weight > 0:
        raw_weighted_score = (
            sum(dimension_scores[dim] * dimension_weights[dim] for dim in dimension_weights)
            / total_active_weight
        )
    else:
        # Fallback jika tidak ada kriteria formal terdeteksi
        raw_weighted_score = bm25_score

    # -------------------------------------------------------------
    # Aturan Cap Skor Maksimal 69 Jika Syarat Wajib Tidak Terpenuhi
    # -------------------------------------------------------------
    capped_by_required = False
    if missing_requirements and raw_weighted_score > 69.0:
        capped_by_required = True
        final_match_score = 69.0
    else:
        final_match_score = round(raw_weighted_score, 1)

    # Susun Panduan Penyesuaian CV (Advice)
    advice: list[str] = []
    if capped_by_required:
        advice.append(
            "Perhatian: Skor dibatasi maksimal 69 karena ada kualifikasi wajib (required) "
            "yang belum terpenuhi di CV."
        )

    if missing_requirements:
        sample_missing = "; ".join(missing_requirements[:3])
        advice.append(f"Kualifikasi utama yang belum ditemukan: {sample_missing}.")

    if missing_skills:
        missing_sample = ", ".join(sorted(list(missing_skills))[:4])
        advice.append(
            f"Keahlian teknis yang diminta lowongan: {missing_sample}. "
            "Jika Anda memiliki pengalaman terkait, cantumkan secara eksplisit pada riwayat kerja."
        )

    if final_match_score >= 80.0:
        advice.append(
            "Tingkat kecocokan profil sangat tinggi! CV Anda memenuhi mayoritas kualifikasi utama."
        )
    elif final_match_score >= 50.0:
        advice.append(
            "Kecocokan moderat. Pertimbangkan menyelaraskan istilah jabatan dan keahlian di CV."
        )
    else:
        advice.append(
            "Tingkat kecocokan rendah. Pastikan Anda menyertakan posisi relevan dan keahlian inti."
        )

    score_breakdown = {
        "role": {
            "score": round(role_score, 1),
            "status": role_status,
            "weight": round(dimension_weights["role"], 2),
            "evidence": role_evidence,
            "target": detected_role_title,
        },
        "skills": {
            "score": round(skills_score, 1),
            "status": skills_status,
            "weight": round(dimension_weights["skills"], 2),
            "matched_count": len(matched_skills),
            "total_job_skills": len(all_job_skills),
        },
        "responsibilities": {
            "score": round(responsibilities_score, 1),
            "status": resp_status,
            "weight": round(dimension_weights["responsibilities"], 2),
            "bm25_score": bm25_score,
        },
        "experience": {
            "score": round(exp_score, 1),
            "status": exp_status,
            "weight": round(dimension_weights["experience"], 2),
            "cv_years": cv_exp_years,
            "required_years": req_exp_years,
            "evidence": exp_evidence,
        },
        "education": {
            "score": round(edu_score, 1),
            "status": edu_status,
            "weight": round(dimension_weights["education"], 2),
            "evidence": edu_evidence,
        },
        "languages": {
            "score": round(lang_score, 1),
            "status": lang_status,
            "weight": round(dimension_weights["languages"], 2),
            "evidence": lang_evidence,
        },
    }

    confidence = (
        "high" if (target_role_key and all_job_skills) else ("medium" if all_job_skills else "low")
    )

    return {
        "match_score": final_match_score,
        "bm25_score": bm25_score,
        "matched_skills": sorted(list(matched_skills)),
        "missing_skills": sorted(list(missing_skills)),
        "matched_count": len(matched_skills),
        "total_job_skills": len(all_job_skills),
        "advice": advice,
        "analysis_status": "success",
        "confidence": confidence,
        "capped_by_required": capped_by_required,
        "target_role": detected_role_title or (target_family.title() if target_family else None),
        "detected_seniority": [k for k, v in SENIORITY_RANKS.items() if v == target_seniority][
            0
        ].title()
        if target_seniority
        else None,
        "score_breakdown": score_breakdown,
        "required_criteria": required_criteria_list,
        "missing_requirements": missing_requirements,
    }
