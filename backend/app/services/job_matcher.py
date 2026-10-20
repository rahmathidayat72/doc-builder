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
    tokens_raw = [w.strip(".!,?") for w in norm.split() if w.strip(".!,?")]

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


def match_resume_to_job(resume_dict: dict[str, Any], job_text: str) -> dict[str, Any]:
    """
    Membandingkan data resume pengguna dengan teks lowongan kerja (Job Description).
    Menghasilkan skor kecocokan keahlian, skor BM25, serta daftar matched & missing skills.
    """
    data = resume_dict.get("data", {})
    contact = data.get("contact", {})
    summary = data.get("summary", "")
    experiences = data.get("experiences", [])
    skills_list = data.get("skills", [])

    # Kumpulkan seluruh teks dari CV
    cv_chunks = [
        contact.get("fullName", ""),
        summary,
        " ".join([e.get("jobTitle", "") + " " + e.get("description", "") for e in experiences]),
        " ".join([s.get("name", "") for s in skills_list]),
    ]
    cv_full_text = " ".join(cv_chunks)

    # Ekstrak skills dari CV dan Job Description
    cv_skills = extract_skills_from_text(cv_full_text)
    # Tambahkan nama skill eksplisit yang ada di list skills
    for s in skills_list:
        name_clean = s.get("name", "").strip().lower()
        if name_clean in CANONICAL_SKILLS:
            cv_skills.add(name_clean)

    job_skills = extract_skills_from_text(job_text)

    matched = cv_skills.intersection(job_skills)
    missing = job_skills - cv_skills

    if job_skills:
        match_score = round((len(matched) / len(job_skills)) * 100.0, 1)
    else:
        match_score = 100.0

    bm25 = PureBM25Ranker()
    bm25_score = bm25.score(cv_full_text, job_text)

    # Susun panduan penyesuaian (advice)
    advice = []
    if missing:
        missing_sample = ", ".join(sorted(list(missing))[:4])
        advice.append(
            f"Lowongan meminta keahlian: {missing_sample}. "
            "Jika relevan, cantumkan secara eksplisit pada ringkasan atau keahlian."
        )

    if match_score >= 80:
        advice.append(
            "Tingkat kecocokan sangat tinggi! Profil Anda memenuhi sebagian besar kata kunci."
        )
    elif match_score >= 50:
        advice.append(
            "Kecocokan moderat. Pertimbangkan menyelaraskan istilah dengan kata kunci lowongan."
        )
    else:
        advice.append(
            "Tingkat kecocokan rendah. Pastikan Anda menyertakan keahlian inti yang dicari."
        )

    return {
        "match_score": match_score,
        "bm25_score": bm25_score,
        "matched_skills": sorted(list(matched)),
        "missing_skills": sorted(list(missing)),
        "matched_count": len(matched),
        "total_job_skills": len(job_skills),
        "advice": advice,
    }
