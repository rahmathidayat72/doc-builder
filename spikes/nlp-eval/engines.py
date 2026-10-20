"""
Implementasi Engine NLP Lokal Ringan:
1. Pure Python Rule-Based & Dictionary Matcher
2. Pure Python Okapi BM25 Scorer
Bilingual (Indonesia & Inggris), 100% offline, 0 dependensi eksternal.
"""

import re
import math
from collections import Counter
from typing import List, Set, Dict, Tuple, Any

# Stopwords dwibahasa (ID & EN)
STOPWORDS_ID = {
    "dan", "yang", "untuk", "pada", "ke", "di", "dari", "ini", "itu", "dengan", "adalah",
    "sebagai", "dalam", "atau", "oleh", "secara", "dapat", "kami", "saya", "anda", "dia",
    "mereka", "kita", "bisa", "akan", "telah", "sudah", "sedang", "harus", "hanya", "juga",
    "tentang", "atas", "bawah", "antara", "setelah", "sebelum", "karena", "jika", "maka",
    "seperti", "tahun", "bulan", "hari", "tersebut", "minimal", "bidang", "terkait", "bergabung",
    "mencari", "dibutuhkan", "memiliki", "kualifikasi", "kebutuhan", "ringkasan", "pengalaman",
    "kerja", "kantor", "sebelumnya", "pendidikan", "keahlian", "posisi", "tanggung", "jawab"
}

STOPWORDS_EN = {
    "and", "the", "for", "in", "to", "at", "from", "this", "that", "with", "is", "as",
    "on", "or", "by", "can", "we", "i", "you", "they", "our", "will", "have", "has",
    "been", "being", "must", "only", "also", "about", "over", "between", "after", "before",
    "because", "if", "then", "such", "year", "years", "month", "day", "minimum", "field",
    "related", "looking", "needed", "qualification", "requirements", "summary", "experience",
    "work", "education", "skills", "position", "responsibilities", "preferred", "plus", "strong"
}

ALL_STOPWORDS = STOPWORDS_ID | STOPWORDS_EN

# Kamus taksonomi keahlian & istilah teknis umum (Normalisasi ID/EN)
CANONICAL_SKILLS = {
    # Backend & Programming
    "python", "fastapi", "django", "flask", "typescript", "javascript", "golang", "go",
    "java", "c#", "c++", "rust", "php", "ruby", "sql", "bash", "shell",
    # Frontend & Design
    "react", "react.js", "next.js", "nextjs", "vue", "vue.js", "angular", "tailwind css",
    "tailwind", "html", "html5", "css", "css3", "figma", "adobe xd", "sketch",
    "prototyping", "wireframing", "user research", "usability testing", "design system",
    # Mobile
    "flutter", "react native", "swift", "kotlin", "android", "ios",
    # Data & Analytics
    "power bi", "tableau", "pandas", "numpy", "matplotlib", "seaborn", "excel",
    "data visualization", "data cleansing", "statistics", "bigquery", "snowflake", "dbt",
    # Databases & Caching
    "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch", "sqlite",
    # Architecture & DevOps
    "docker", "kubernetes", "git", "ci/cd", "rest api", "restful api", "rest", "graphql",
    "microservices", "linux", "aws", "gcp", "azure",
    # Testing
    "pytest", "unittest", "vitest", "jest", "playwright", "cypress", "automated testing",
    # Soft skills & concepts
    "analytical thinking", "communication", "problem solving", "team leadership"
}

# Pemetaan sinonim / ekuivalensi istilah bilingual
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
    """Normalisasi teks: lowercase, ganti non-alfanumerik terpilih, rapikan spasi."""
    text = text.lower()
    # Ganti karakter pemisah khusus tapi simpan titik pada nama tech seperti c# atau .js
    text = re.sub(r'[/\\,\(\)\[\]\{\}:;*•\-\–\|]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_tokens(text: str, remove_stopwords: bool = True) -> List[str]:
    """Ekstraksi token kata (unigram) bersih."""
    norm = normalize_text(text)
    words = [w.strip() for w in norm.split() if len(w.strip()) > 1]
    if remove_stopwords:
        words = [w for w in words if w not in ALL_STOPWORDS]
    return words

def extract_ngrams(tokens: List[str], n: int) -> List[str]:
    """Ekstraksi n-gram berurutan."""
    if len(tokens) < n:
        return []
    return [" ".join(tokens[i:i+n]) for i in range(len(tokens) - n + 1)]

def extract_skills_from_text(text: str) -> Set[str]:
    """
    Ekstraksi keahlian terstandar menggunakan kamus taksonomi dan n-gram matching.
    Mendukung unigram (misal: 'python'), bigram ('rest api', 'power bi'), dan trigram ('user research').
    """
    norm = normalize_text(text)
    tokens_raw = [w.strip() for w in norm.split() if w.strip()]
    
    found_skills = set()
    
    # Periksa 1-gram, 2-gram, dan 3-gram
    unigrams = tokens_raw
    bigrams = extract_ngrams(tokens_raw, 2)
    trigrams = extract_ngrams(tokens_raw, 3)
    
    all_candidates = set(unigrams + bigrams + trigrams)
    
    for cand in all_candidates:
        mapped = SYNONYM_MAP.get(cand, cand)
        if mapped in CANONICAL_SKILLS:
            found_skills.add(mapped)
            
    return found_skills

class LightweightRuleMatcher:
    """
    Engine 1: Rule-Based & Dictionary Matching
    Deterministik, transparan, tanpa ketergantungan library luar.
    """
    
    @staticmethod
    def match(cv_text: str, job_desc: str) -> Dict[str, Any]:
        cv_skills = extract_skills_from_text(cv_text)
        job_skills = extract_skills_from_text(job_desc)
        
        matched = cv_skills.intersection(job_skills)
        missing = job_skills - cv_skills
        
        # Hitung skor recall skill: berapa persen kebutuhan lowongan yang terpenuhi
        if job_skills:
            skill_score = (len(matched) / len(job_skills)) * 100.0
        else:
            skill_score = 100.0
            
        # Hitung skor keterbacaan struktur ATS CV
        ats_structure = LightweightRuleMatcher.evaluate_ats_structure(cv_text)
        
        return {
            "engine": "LightweightRuleMatcher",
            "matched_skills": sorted(list(matched)),
            "missing_skills": sorted(list(missing)),
            "job_skills_count": len(job_skills),
            "matched_skills_count": len(matched),
            "job_match_score": round(skill_score, 1),
            "ats_structure_score": ats_structure["score"],
            "ats_checklist": ats_structure["checklist"],
            "recommendations": ats_structure["recommendations"]
        }
        
    @staticmethod
    def evaluate_ats_structure(cv_text: str) -> Dict[str, Any]:
        """Evaluasi kepatuhan tata letak standar ATS (heading, kontak, dsb)."""
        lower = cv_text.lower()
        score = 100
        checklist = []
        recommendations = []
        
        # 1. Periksa bagian kontak (Email & Phone)
        has_email = bool(re.search(r'[\w\.-]+@[\w\.-]+\.\w+', cv_text))
        checklist.append({"item": "Informasi Email Terdeteksi", "status": has_email})
        if not has_email:
            score -= 15
            recommendations.append("Tambahkan alamat email profesional di bagian atas CV.")
            
        has_phone = bool(re.search(r'(\+62|08|\+1)[\d\s\-]{8,15}', cv_text))
        checklist.append({"item": "Nomor Kontak Terdeteksi", "status": has_phone})
        if not has_phone:
            score -= 10
            recommendations.append("Tambahkan nomor telepon aktif yang mudah dihubungi.")
            
        # 2. Periksa Heading Standar (Pengalaman / Experience)
        has_exp = any(h in lower for h in ["pengalaman", "experience", "riwayat kerja", "employment"])
        checklist.append({"item": "Bagian Pengalaman Kerja", "status": has_exp})
        if not has_exp:
            score -= 25
            recommendations.append("Gunakan judul bagian standar seperti 'Pengalaman Kerja' atau 'Experience'.")
            
        # 3. Periksa Heading Pendidikan (Pendidikan / Education)
        has_edu = any(h in lower for h in ["pendidikan", "education", "akademik"])
        checklist.append({"item": "Bagian Pendidikan", "status": has_edu})
        if not has_edu:
            score -= 15
            recommendations.append("Gunakan judul bagian standar seperti 'Pendidikan' atau 'Education'.")
            
        # 4. Periksa Heading Keahlian (Keahlian / Skills)
        has_skills = any(h in lower for h in ["keahlian", "skills", "kompetensi", "technical skills"])
        checklist.append({"item": "Bagian Keahlian/Skills", "status": has_skills})
        if not has_skills:
            score -= 15
            recommendations.append("Cantumkan daftar keahlian pada section khusus 'Keahlian' atau 'Skills'.")
            
        # 5. Peringatan Keyword Stuffing (Pengulangan tidak natural)
        tokens = extract_tokens(cv_text, remove_stopwords=True)
        counts = Counter(tokens)
        top_word, top_count = counts.most_common(1)[0] if counts else ("", 0)
        stuffing_detected = top_count > 15 and len(tokens) > 50
        checklist.append({"item": "Bebas dari Keyword Stuffing Ekstrem", "status": not stuffing_detected})
        if stuffing_detected:
            score -= 10
            recommendations.append(f"Kata '{top_word}' muncul {top_count} kali. Hindari pengulangan kata berlebih.")
            
        return {
            "score": max(0, score),
            "checklist": checklist,
            "recommendations": recommendations
        }

class PureBM25Ranker:
    """
    Engine 2: Pure Python Okapi BM25
    Menghitung skor relevansi informasi probabilitik dokumen terhadap query/lowongan.
    """
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b

    def score(self, cv_text: str, job_desc: str) -> float:
        """Menghitung skor kecocokan BM25 antara CV dan Job Description."""
        query_tokens = extract_tokens(job_desc, remove_stopwords=True)
        doc_tokens = extract_tokens(cv_text, remove_stopwords=True)
        
        if not query_tokens or not doc_tokens:
            return 0.0
            
        doc_len = len(doc_tokens)
        doc_freq = Counter(doc_tokens)
        
        # Perkiraan IDF sederhana berbasis query token overlap
        score = 0.0
        for token in query_tokens:
            f = doc_freq.get(token, 0)
            if f > 0:
                # BM25 term frequency saturation
                num = f * (self.k1 + 1)
                denom = f + self.k1 * (1 - self.b + self.b * (doc_len / 150.0))
                score += num / denom
                
        # Normalisasi ke skala 0 - 100 berdasarkan panjang query
        max_possible = len(query_tokens) * (self.k1 + 1)
        normalized = (score / max_possible) * 100.0 if max_possible > 0 else 0.0
        return round(min(100.0, normalized * 2.2), 1)  # scaling factor
