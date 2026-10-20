import io
import re
import uuid
from typing import Any

from docx import Document
from pypdf import PdfReader

EMAIL_REGEX = r"[\w\.-]+@[\w\.-]+\.\w+"
PHONE_REGEX = r"(\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}"
LINKEDIN_REGEX = r"(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w\-_]+"
WEBSITE_REGEX = r"(?:https?:\/\/)?(?:www\.)?[\w\-]+\.(?:com|dev|id|org|io|me|net)(?:\/[\w\-_]+)?"

SECTION_HEADERS = {
    "summary": [
        r"ringkasan(\s+profesional)?",
        r"professional\s+summary",
        r"about(\s+me)?",
        r"tentang(\s+saya)?",
        r"profil(\s+profesional)?",
        r"profile",
    ],
    "experience": [
        r"pengalaman(\s+kerja)?",
        r"work\s+experience",
        r"experience",
        r"employment(\s+history)?",
        r"riwayat\s+pekerjaan",
    ],
    "education": [r"pendidikan", r"education", r"riwayat\s+pendidikan", r"academic\s+background"],
    "skills": [
        r"keahlian(\s+(teknis|kompetensi|dan\s+kompetensi))?",
        r"skills",
        r"technical\s+skills",
        r"kompetensi",
        r"core\s+competencies",
    ],
    "languages": [r"kemampuan\s+bahasa", r"languages", r"bahasa"],
}


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Mengekstrak teks mentah dari berkas PDF."""
    reader = PdfReader(io.BytesIO(file_bytes))
    text_chunks = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text_chunks.append(page_text)
    return "\n".join(text_chunks)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Mengekstrak teks mentah dari berkas DOCX."""
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    table_texts = []
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text.strip():
                    table_texts.append(cell.text.strip())
    return "\n".join(paragraphs + table_texts)


def extract_contact_info(
    lines: list[str], full_text: str
) -> tuple[dict[str, str], dict[str, float]]:
    """Mengekstrak info kontak dan menghitung skor confidence."""
    contact = {
        "fullName": "",
        "email": "",
        "phone": "",
        "location": "",
        "linkedin": "",
        "website": "",
    }
    confidence = {"fullName": 0.0, "email": 0.0, "phone": 0.0, "location": 0.0}

    # Email
    email_match = re.search(EMAIL_REGEX, full_text)
    if email_match:
        contact["email"] = email_match.group(0).strip()
        confidence["email"] = 0.95

    # Phone
    phone_match = re.search(PHONE_REGEX, full_text)
    if phone_match:
        found_phone = phone_match.group(0).strip()
        if len(re.sub(r"\D", "", found_phone)) >= 9:
            contact["phone"] = found_phone
            confidence["phone"] = 0.90

    # LinkedIn
    linkedin_match = re.search(LINKEDIN_REGEX, full_text, re.IGNORECASE)
    if linkedin_match:
        contact["linkedin"] = linkedin_match.group(0).strip()

    # Website
    website_match = re.search(WEBSITE_REGEX, full_text, re.IGNORECASE)
    if website_match:
        found_web = website_match.group(0).strip()
        if "linkedin.com" not in found_web.lower():
            contact["website"] = found_web

    # Full Name heuristic dari baris teratas
    for line in lines[:5]:
        clean = line.strip()
        # Lewati baris kontak jika ada email/phone
        if not clean or re.search(EMAIL_REGEX, clean) or re.search(PHONE_REGEX, clean):
            continue
        # Nama biasanya 2-5 kata, alfanumerik
        words = clean.split()
        if 1 <= len(words) <= 5 and not any(char in clean for char in [":", "|", "@", "/", "\\"]):
            contact["fullName"] = clean.title()
            confidence["fullName"] = 0.85
            break

    # Location heuristic
    loc_keywords = [
        "jakarta",
        "bandung",
        "surabaya",
        "yogyakarta",
        "semarang",
        "medan",
        "indonesia",
    ]
    for line in lines[:8]:
        for kw in loc_keywords:
            if kw in line.lower() and not contact["location"]:
                contact["location"] = line.strip()
                confidence["location"] = 0.70
                break

    return contact, confidence


def identify_section_boundaries(lines: list[str]) -> dict[str, tuple[int, int]]:
    """Menemukan indeks baris awal dan akhir untuk tiap bagian standar."""
    positions = []
    for idx, line in enumerate(lines):
        clean = line.strip().lower()
        if not clean:
            continue
        # Normalisasi simbol seperti & atau /
        clean_norm = re.sub(r"[^a-zA-Z0-9\s]", " ", clean)
        clean_norm = re.sub(r"\s+", " ", clean_norm).strip()
        # Periksa apakah baris adalah judul bagian
        for section, patterns in SECTION_HEADERS.items():
            for pat in patterns:
                matches_clean = re.fullmatch(pat, clean) or re.fullmatch(f"{pat}[:]", clean)
                matches_norm = re.fullmatch(pat, clean_norm)
                if matches_clean or matches_norm:
                    positions.append((idx, section))
                    break

    # Urutkan berdasarkan urutan muncul di teks
    positions.sort(key=lambda x: x[0])

    sections_range = {}
    for i in range(len(positions)):
        sec_name = positions[i][1]
        start_idx = positions[i][0] + 1
        end_idx = positions[i + 1][0] if i + 1 < len(positions) else len(lines)
        sections_range[sec_name] = (start_idx, end_idx)

    return sections_range


def parse_experience_section(lines: list[str]) -> tuple[list[dict[str, Any]], float]:
    """Mengekstrak blok pengalaman kerja dan menghitung skor confidence."""
    experiences = []
    if not lines:
        return experiences, 0.0

    current_exp = None
    bullets = []

    for line in lines:
        clean = line.strip()
        if not clean:
            continue

        is_bullet = clean.startswith("•") or clean.startswith("-") or clean.startswith("*")
        date_match = re.search(r"(19\d\d|20\d\d|sekarang|present)", clean, re.IGNORECASE)

        if not is_bullet and date_match:
            # Kemungkinan baris header pekerjaan baru
            if current_exp:
                current_exp["description"] = "\n".join(bullets)
                experiences.append(current_exp)
                bullets = []

            parts = [p.strip() for p in re.split(r"[-–|•]", clean) if p.strip()]
            title = parts[0] if parts else clean
            company = parts[1] if len(parts) > 1 else ""

            current_exp = {
                "id": str(uuid.uuid4()),
                "jobTitle": title,
                "company": company,
                "location": "",
                "startDate": "",
                "endDate": "",
                "current": "sekarang" in clean.lower() or "present" in clean.lower(),
                "description": "",
            }
        elif is_bullet:
            bullet_text = clean.lstrip("•-* ").strip()
            bullets.append(f"• {bullet_text}")
        elif current_exp:
            bullets.append(clean)

    if current_exp:
        current_exp["description"] = "\n".join(bullets)
        experiences.append(current_exp)

    confidence = 0.85 if len(experiences) >= 1 else 0.40
    return experiences, confidence


def parse_education_section(lines: list[str]) -> tuple[list[dict[str, Any]], float]:
    """Mengekstrak blok riwayat pendidikan."""
    education = []
    if not lines:
        return education, 0.0

    current_edu = None
    for line in lines:
        clean = line.strip()
        if not clean:
            continue

        edu_keywords = ["universitas", "institut", "politeknik", "university", "college", "school"]
        if any(kw in clean.lower() for kw in edu_keywords):
            if current_edu:
                education.append(current_edu)
            current_edu = {
                "id": str(uuid.uuid4()),
                "institution": clean,
                "degree": "",
                "fieldOfStudy": "",
                "startDate": "",
                "endDate": "",
                "gpa": "",
                "description": "",
            }
        elif current_edu:
            degree_keywords = ["s1", "s2", "s3", "bachelor", "master", "sarjana"]
            if any(deg in clean.lower() for deg in degree_keywords):
                current_edu["degree"] = clean
            elif not current_edu["fieldOfStudy"]:
                current_edu["fieldOfStudy"] = clean

    if current_edu:
        education.append(current_edu)

    confidence = 0.85 if len(education) >= 1 else 0.40
    return education, confidence


def parse_skills_section(lines: list[str]) -> tuple[list[dict[str, str]], float]:
    """Mengekstrak daftar keahlian dari bagian skills."""
    skills = []
    if not lines:
        return skills, 0.0

    text = " ".join(lines)
    # Pisahkan berdasarkan koma, bullet, titik dua, atau baris baru
    raw_tokens = re.split(r"[,•|:\n]", text)
    seen = set()

    for token in raw_tokens:
        clean = token.strip()
        # Hanya ambil kata kunci wajar (2-30 karakter)
        if 2 <= len(clean) <= 30 and clean.lower() not in seen:
            seen.add(clean.lower())
            skills.append({"id": str(uuid.uuid4()), "name": clean, "category": "Technical"})

    confidence = 0.90 if len(skills) >= 3 else (0.50 if skills else 0.0)
    return skills, confidence


def parse_resume_document(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """
    Fungsi orkestrator utama untuk mengekstrak dan mem-parsing berkas CV (PDF/DOCX).
    Mengembalikan data terstruktur, skor kepastian (confidence), dan peringatan.
    """
    ext = filename.lower().split(".")[-1]
    if ext == "pdf":
        raw_text = extract_text_from_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        raw_text = extract_text_from_docx(file_bytes)
    else:
        raise ValueError(f"Format berkas '.{ext}' tidak didukung. Harap gunakan PDF atau DOCX.")

    lines = [item.strip() for item in raw_text.splitlines() if item.strip()]
    if not lines:
        raise ValueError(
            "Berkas tidak memuat teks yang dapat diekstrak (kemungkinan berupa pindaian/gambar)."
        )

    # 1. Ekstrak Info Kontak
    contact, contact_conf = extract_contact_info(lines, raw_text)

    # 2. Identifikasi Batas Bagian
    boundaries = identify_section_boundaries(lines)

    # 3. Ekstrak Ringkasan
    summary = ""
    summary_conf = 0.0
    if "summary" in boundaries:
        s_start, s_end = boundaries["summary"]
        summary_lines = lines[s_start:s_end]
        summary = " ".join(summary_lines)
        summary_conf = 0.85 if len(summary.split()) >= 15 else 0.50

    # 4. Ekstrak Pengalaman
    experiences = []
    exp_conf = 0.0
    if "experience" in boundaries:
        e_start, e_end = boundaries["experience"]
        experiences, exp_conf = parse_experience_section(lines[e_start:e_end])

    # 5. Ekstrak Pendidikan
    education = []
    edu_conf = 0.0
    if "education" in boundaries:
        ed_start, ed_end = boundaries["education"]
        education, edu_conf = parse_education_section(lines[ed_start:ed_end])

    # 6. Ekstrak Keahlian
    skills = []
    skills_conf = 0.0
    if "skills" in boundaries:
        sk_start, sk_end = boundaries["skills"]
        skills, skills_conf = parse_skills_section(lines[sk_start:sk_end])

    # 7. Hitung Skor Confidence Keseluruhan
    weights = [
        contact_conf["fullName"] * 0.20,
        contact_conf["email"] * 0.20,
        summary_conf * 0.15,
        exp_conf * 0.25,
        edu_conf * 0.10,
        skills_conf * 0.10,
    ]
    overall_conf = round(sum(weights), 2)

    # 8. Hasilkan Peringatan Edukatif
    warnings = []
    if contact_conf["fullName"] < 0.7:
        warnings.append("Nama lengkap terdeteksi dengan kepastian rendah. Harap periksa kembali.")
    if contact_conf["email"] < 0.5:
        warnings.append("Alamat email tidak ditemukan secara otomatis.")
    if exp_conf < 0.5:
        warnings.append("Bagian pengalaman kerja tidak terdeteksi dengan jelas.")
    if skills_conf < 0.5:
        warnings.append("Daftar keahlian tidak terdeteksi secara terpisah.")

    return {
        "success": True,
        "filename": filename,
        "data": {
            "contact": contact,
            "summary": summary,
            "experiences": experiences,
            "education": education,
            "skills": skills,
            "languages": [],
            "customSections": [],
        },
        "confidence": {
            "overall": overall_conf,
            "fullName": contact_conf["fullName"],
            "email": contact_conf["email"],
            "phone": contact_conf["phone"],
            "summary": summary_conf,
            "experiences": exp_conf,
            "education": edu_conf,
            "skills": skills_conf,
        },
        "warnings": warnings,
    }
