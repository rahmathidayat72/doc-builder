import io
import re
import uuid
from typing import Any

from docx import Document
from docx.document import Document as DocumentObject
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph
from pypdf import PdfReader

EMAIL_REGEX = r"[\w.-]+@[\w.-]+\.\w+"
PHONE_REGEX = r"(\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}"
LINKEDIN_REGEX = r"(?:https?://)?(?:www\.)?linkedin\.com/in/[\w_-]+"
WEBSITE_REGEX = r"(?:https?://)?(?:www\.)?[\w-]+\.(?:com|dev|id|org|io|me|net)(?:/[\w_-]+)?"
DATE_TOKEN_REGEX = (
    r"(?:(?:jan(?:uari|uary)?|feb(?:ruari|ruary)?|mar(?:et|ch)?|apr(?:il)?|mei|may|"
    r"jun(?:i|e)?|jul(?:i|y)?|agu(?:stus)?|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|"
    r"oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?)\s+)?(?:19|20)\d{2}"
    r"|sekarang|present|saat\s+ini|current"
)

SECTION_HEADERS = {
    "summary": [
        r"ringkasan(?: profesional)?",
        r"professional summary",
        r"career summary",
        r"executive summary",
        r"about(?: me)?",
        r"tentang(?: saya)?",
        r"profil(?: profesional)?",
        r"profile",
    ],
    "experience": [
        r"pengalaman(?: kerja| profesional)?",
        r"riwayat(?: pekerjaan| profesional)",
        r"work experience",
        r"professional experience",
        r"career history",
        r"employment(?: history)?",
        r"experience",
    ],
    "education": [
        r"pendidikan",
        r"riwayat pendidikan",
        r"education",
        r"academic(?: background| history)?",
        r"educational background",
    ],
    "skills": [
        r"keahlian(?: teknis| (?:dan|and) kompetensi)?",
        r"kompetensi(?: inti)?",
        r"skills",
        r"technical skills",
        r"tools and technologies",
        r"technologies",
        r"core competencies",
    ],
    "languages": [
        r"kemampuan bahasa",
        r"penguasaan bahasa",
        r"languages?",
        r"bahasa",
    ],
}

CUSTOM_SECTION_HEADERS = {
    "Proyek": [r"proyek", r"projects?", r"project portfolio", r"selected projects?"],
    "Sertifikasi": [
        r"sertifikasi(?: dan pelatihan)?",
        r"certifications?(?: and training)?",
        r"licenses? and certifications?",
    ],
    "Organisasi": [
        r"organisasi",
        r"pengalaman organisasi",
        r"organizations?",
        r"leadership(?: experience)?",
    ],
    "Penghargaan": [r"penghargaan", r"awards?(?: and honors)?", r"honors?"],
    "Kursus dan Pelatihan": [r"kursus(?: dan pelatihan)?", r"courses?", r"training"],
    "Publikasi": [r"publikasi", r"publications?"],
    "Kegiatan Sukarela": [r"kegiatan sukarela", r"volunteer(?:ing| experience)?"],
    "Referensi": [r"referensi", r"references?"],
    "Minat": [r"minat", r"interests?", r"hobbies"],
}

SECTION_LABELS = {
    "summary": "Ringkasan",
    "experience": "Pengalaman Kerja",
    "education": "Pendidikan",
    "skills": "Keahlian",
    "languages": "Bahasa",
}


def _normalize_heading(value: str) -> str:
    clean = value.strip().lower().rstrip(":")
    clean = re.sub(r"[&/]", " and ", clean)
    clean = re.sub(r"[^a-z0-9\s]", " ", clean)
    return re.sub(r"\s+", " ", clean).strip()


def _matches_any(value: str, patterns: list[str]) -> bool:
    return any(re.fullmatch(pattern, value, re.IGNORECASE) for pattern in patterns)


def _iter_docx_blocks(document: DocumentObject):
    """Yield paragraf dan tabel sesuai urutan XML dokumen."""
    for child in document.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, document)
        elif isinstance(child, CT_Tbl):
            yield Table(child, document)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Ekstrak teks PDF. Layout mode dipakai bila didukung pypdf."""
    reader = PdfReader(io.BytesIO(file_bytes))
    text_chunks = []
    for page in reader.pages:
        try:
            page_text = page.extract_text(extraction_mode="layout")
        except TypeError:
            page_text = page.extract_text()
        if page_text:
            text_chunks.append(page_text)
    return "\n".join(text_chunks)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Ekstrak paragraf dan isi tabel DOCX tanpa memindahkan tabel ke akhir dokumen."""
    document = Document(io.BytesIO(file_bytes))
    lines: list[str] = []
    for block in _iter_docx_blocks(document):
        if isinstance(block, Paragraph):
            if block.text.strip():
                lines.append(block.text.strip())
            continue

        for row in block.rows:
            previous_cell = None
            for cell in row.cells:
                cell_text = "\n".join(
                    paragraph.text.strip()
                    for paragraph in cell.paragraphs
                    if paragraph.text.strip()
                )
                if cell_text and cell_text != previous_cell:
                    lines.extend(cell_text.splitlines())
                    previous_cell = cell_text
    return "\n".join(lines)


def extract_contact_info(
    lines: list[str], full_text: str
) -> tuple[dict[str, str], dict[str, float]]:
    contact = {
        "fullName": "",
        "email": "",
        "phone": "",
        "location": "",
        "linkedin": "",
        "website": "",
    }
    confidence = {"fullName": 0.0, "email": 0.0, "phone": 0.0, "location": 0.0}

    email_match = re.search(EMAIL_REGEX, full_text)
    if email_match:
        contact["email"] = email_match.group(0).strip()
        confidence["email"] = 0.95

    phone_match = re.search(PHONE_REGEX, full_text)
    if phone_match:
        found_phone = phone_match.group(0).strip()
        if len(re.sub(r"\D", "", found_phone)) >= 9:
            contact["phone"] = found_phone
            confidence["phone"] = 0.90

    linkedin_match = re.search(LINKEDIN_REGEX, full_text, re.IGNORECASE)
    if linkedin_match:
        contact["linkedin"] = linkedin_match.group(0).strip()

    website_match = re.search(WEBSITE_REGEX, full_text, re.IGNORECASE)
    if website_match:
        found_web = website_match.group(0).strip()
        if "linkedin.com" not in found_web.lower():
            contact["website"] = found_web

    for line in lines[:8]:
        clean = line.strip()
        if not clean or re.search(EMAIL_REGEX, clean) or re.search(PHONE_REGEX, clean):
            continue
        if _match_known_heading(clean) is not None:
            continue
        words = clean.split()
        if 1 <= len(words) <= 5 and not any(char in clean for char in [":", "|", "@", "/", "\\"]):
            contact["fullName"] = clean.title()
            confidence["fullName"] = 0.85
            break

    location_keywords = [
        "jakarta",
        "bandung",
        "surabaya",
        "yogyakarta",
        "semarang",
        "medan",
        "bali",
        "indonesia",
        "remote",
    ]
    for line in lines[:10]:
        if any(keyword in line.lower() for keyword in location_keywords):
            contact["location"] = line.strip()
            confidence["location"] = 0.70
            break

    return contact, confidence


def _match_known_heading(line: str) -> tuple[str, str] | None:
    normalized = _normalize_heading(line)
    for section, patterns in SECTION_HEADERS.items():
        if _matches_any(normalized, patterns):
            return section, SECTION_LABELS[section]
    for title, patterns in CUSTOM_SECTION_HEADERS.items():
        if _matches_any(normalized, patterns):
            return "custom", title
    return None


def _looks_like_custom_heading(line: str, has_seen_section: bool) -> bool:
    clean = line.strip().rstrip(":")
    if not has_seen_section or not clean or len(clean) > 60 or len(clean.split()) > 7:
        return False
    if re.search(EMAIL_REGEX, clean) or re.search(DATE_TOKEN_REGEX, clean, re.IGNORECASE):
        return False
    letters = [char for char in clean if char.isalpha()]
    uppercase = bool(letters) and sum(char.isupper() for char in letters) / len(letters) >= 0.8
    return line.strip().endswith(":") or uppercase


def identify_sections(lines: list[str]) -> list[dict[str, Any]]:
    positions: list[dict[str, Any]] = []
    has_seen_section = False
    for index, line in enumerate(lines):
        matched = _match_known_heading(line)
        if matched:
            section, title = matched
            positions.append({"section": section, "title": title, "header": index})
            has_seen_section = True
        elif _looks_like_custom_heading(line, has_seen_section):
            positions.append(
                {"section": "custom", "title": line.strip().rstrip(":"), "header": index}
            )

    for index, position in enumerate(positions):
        position["start"] = position["header"] + 1
        position["end"] = (
            positions[index + 1]["header"] if index + 1 < len(positions) else len(lines)
        )
    return positions


def identify_section_boundaries(lines: list[str]) -> dict[str, tuple[int, int]]:
    """Kompatibilitas API lama: kembalikan batas section standar pertama."""
    boundaries: dict[str, tuple[int, int]] = {}
    for section in identify_sections(lines):
        if section["section"] != "custom" and section["section"] not in boundaries:
            boundaries[section["section"]] = (section["start"], section["end"])
    return boundaries


def _is_bullet(line: str) -> bool:
    return bool(re.match(r"^[•●▪◦*-]\s*", line.strip()))


def _clean_bullet(line: str) -> str:
    return re.sub(r"^[•●▪◦*-]\s*", "", line.strip()).strip()


def _extract_period(line: str) -> tuple[str, str, bool, str]:
    matches = [
        match.group(0).strip() for match in re.finditer(DATE_TOKEN_REGEX, line, re.IGNORECASE)
    ]
    if not matches:
        return "", "", False, line.strip()

    current = any(
        value.lower() in {"sekarang", "present", "saat ini", "current"} for value in matches
    )
    start_date = matches[0] if not current or len(matches) > 1 else ""
    end_date = matches[-1] if len(matches) > 1 else ("Sekarang" if current else "")
    residual = re.sub(DATE_TOKEN_REGEX, " ", line, flags=re.IGNORECASE)
    residual = re.sub(r"\s+(?:s/d|to|hingga|sampai)\s+", " ", residual, flags=re.IGNORECASE)
    residual = re.sub(r"^[\s|•–—-]+|[\s|•–—-]+$", "", residual)
    residual = re.sub(r"\s{2,}", " ", residual).strip()
    return start_date, end_date, current, residual


def _split_header_fields(value: str) -> list[str]:
    return [part.strip() for part in re.split(r"\t|\s+[|•–—-]\s+", value) if part.strip()]


def parse_experience_section(lines: list[str]) -> tuple[list[dict[str, Any]], float]:
    experiences: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    pending: list[str] = []
    descriptions: list[str] = []

    def finish_current() -> None:
        nonlocal current, descriptions
        if not current:
            return
        if descriptions:
            current["description"] = "\n".join(f"• {item}" for item in descriptions if item)
        if current["jobTitle"] or current["company"]:
            experiences.append(current)
        current = None
        descriptions = []

    for raw_line in lines:
        clean = raw_line.strip()
        if not clean:
            continue
        start_date, end_date, is_current, residual = _extract_period(clean)

        if start_date or end_date or is_current:
            header_lines = pending[-2:]
            if current and len(pending) > len(header_lines):
                descriptions.extend(pending[: -len(header_lines)])
            finish_current()
            fields: list[str] = []
            for header in header_lines:
                fields.extend(_split_header_fields(header))
            fields.extend(_split_header_fields(residual))
            pending = []
            current = {
                "id": str(uuid.uuid4()),
                "jobTitle": fields[0] if fields else "",
                "company": fields[1] if len(fields) > 1 else "",
                "location": fields[2] if len(fields) > 2 else "",
                "startDate": start_date,
                "endDate": "Sekarang" if is_current else end_date,
                "current": is_current,
                "description": "",
            }
            continue

        if _is_bullet(clean):
            if current:
                descriptions.append(_clean_bullet(clean))
            else:
                pending.append(_clean_bullet(clean))
            continue

        if current and not current["company"] and not descriptions and len(clean) <= 100:
            fields = _split_header_fields(clean)
            current["company"] = fields[0] if fields else clean
            if len(fields) > 1:
                current["location"] = fields[1]
        else:
            pending.append(clean)

    if current:
        if pending:
            descriptions.extend(pending)
        finish_current()
    elif pending:
        fields = pending[:2]
        fallback = {
            "id": str(uuid.uuid4()),
            "jobTitle": fields[0] if fields else "",
            "company": fields[1] if len(fields) > 1 else "",
            "location": "",
            "startDate": "",
            "endDate": "",
            "current": False,
            "description": "\n".join(f"• {item}" for item in pending[2:]),
        }
        if fallback["jobTitle"]:
            experiences.append(fallback)

    complete = sum(bool(item["jobTitle"] and item["company"]) for item in experiences)
    confidence = (
        0.90 if experiences and complete == len(experiences) else (0.65 if experiences else 0.0)
    )
    return experiences, confidence


def _apply_education_details(education: dict[str, Any], lines: list[str]) -> None:
    for line in lines:
        clean = _clean_bullet(line)
        if not clean:
            continue
        gpa_match = re.search(
            r"(?:IPK|GPA)\s*[: ]\s*([0-9.,]+(?:\s*/\s*[0-9.,]+)?)", clean, re.IGNORECASE
        )
        if gpa_match:
            education["gpa"] = gpa_match.group(1)
            clean = re.sub(
                r"(?:IPK|GPA)\s*[: ]\s*[0-9.,]+(?:\s*/\s*[0-9.,]+)?", "", clean, flags=re.IGNORECASE
            ).strip(" |-")
        parts = [part.strip() for part in re.split(r"\s+[|•]\s+", clean) if part.strip()]
        for part in parts:
            if re.search(
                r"\b(SMA|SMK|D[1-4]|S[1-3]|bachelor|master|doktor|doctor|sarjana|diploma)\b",
                part,
                re.IGNORECASE,
            ):
                education["degree"] = part
            elif part.lower().startswith(("dalam ", "in ")):
                education["fieldOfStudy"] = re.sub(
                    r"^(?:dalam|in)\s+", "", part, flags=re.IGNORECASE
                )
            elif not education["fieldOfStudy"]:
                education["fieldOfStudy"] = part
            else:
                education["description"] = "\n".join(filter(None, [education["description"], part]))


def parse_education_section(lines: list[str]) -> tuple[list[dict[str, Any]], float]:
    education_items: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    pending: list[str] = []
    institution_keywords = [
        "universitas",
        "institut",
        "politeknik",
        "akademi",
        "sekolah",
        "university",
        "college",
        "school",
        "academy",
    ]

    def new_item(institution: str, start: str = "", end: str = "") -> dict[str, Any]:
        return {
            "id": str(uuid.uuid4()),
            "institution": institution,
            "degree": "",
            "fieldOfStudy": "",
            "startDate": start,
            "endDate": end,
            "gpa": "",
            "description": "",
        }

    def finish_current() -> None:
        nonlocal current, pending
        if not current:
            return
        _apply_education_details(current, pending)
        if current["institution"]:
            education_items.append(current)
        current = None
        pending = []

    for raw_line in lines:
        clean = raw_line.strip()
        if not clean:
            continue
        start_date, end_date, _, residual = _extract_period(clean)
        has_institution = any(keyword in clean.lower() for keyword in institution_keywords)

        if start_date or end_date:
            if current and not current["startDate"] and not residual:
                current["startDate"] = start_date
                current["endDate"] = end_date
            else:
                institution = residual
                if not institution and pending:
                    institution = pending.pop(0)
                finish_current()
                current = new_item(institution, start_date, end_date)
        elif has_institution:
            finish_current()
            current = new_item(clean)
        elif current:
            pending.append(clean)
        else:
            pending.append(clean)

    if current:
        finish_current()
    elif pending:
        current = new_item(pending.pop(0))
        finish_current()

    complete = sum(
        bool(item["institution"] and (item["degree"] or item["fieldOfStudy"]))
        for item in education_items
    )
    confidence = (
        0.90
        if education_items and complete == len(education_items)
        else (0.65 if education_items else 0.0)
    )
    return education_items, confidence


def parse_skills_section(lines: list[str]) -> tuple[list[dict[str, str]], float]:
    text = "\n".join(lines)
    raw_tokens = re.split(r"[,;•|:\n]", text)
    skills: list[dict[str, str]] = []
    seen: set[str] = set()
    for token in raw_tokens:
        clean = _clean_bullet(token)
        key = clean.lower()
        if 2 <= len(clean) <= 50 and key not in seen:
            seen.add(key)
            skills.append({"id": str(uuid.uuid4()), "name": clean, "category": "Technical"})
    confidence = 0.90 if len(skills) >= 3 else (0.60 if skills else 0.0)
    return skills, confidence


def _normalize_proficiency(value: str) -> str:
    normalized = value.lower()
    if any(word in normalized for word in ["native", "bilingual", "penutur asli"]):
        return "Native / Bilingual"
    if any(word in normalized for word in ["professional", "fluent", "mahir", "lancar"]):
        return "Professional"
    if any(word in normalized for word in ["intermediate", "menengah"]):
        return "Intermediate"
    if any(word in normalized for word in ["elementary", "basic", "dasar"]):
        return "Elementary"
    return value.strip() or "Professional"


def parse_languages_section(lines: list[str]) -> tuple[list[dict[str, str]], float]:
    languages: list[dict[str, str]] = []
    seen: set[str] = set()
    for token in re.split(r"[|•;\n]", "\n".join(lines)):
        clean = _clean_bullet(token)
        if not clean:
            continue
        match = re.match(r"(.+?)(?:\s*\((.+)\)|\s*[:–—-]\s*(.+))?$", clean)
        if not match:
            continue
        language = match.group(1).strip()
        proficiency = _normalize_proficiency(match.group(2) or match.group(3) or "Professional")
        if language.lower() not in seen:
            seen.add(language.lower())
            languages.append(
                {"id": str(uuid.uuid4()), "language": language, "proficiency": proficiency}
            )
    confidence = 0.85 if languages else 0.0
    return languages, confidence


def _custom_section(title: str, lines: list[str]) -> dict[str, Any] | None:
    content = "\n".join(line.strip() for line in lines if line.strip())
    if not content:
        return None
    return {
        "id": str(uuid.uuid4()),
        "sectionTitle": title,
        "items": [
            {
                "id": str(uuid.uuid4()),
                "title": "",
                "subtitle": "",
                "date": "",
                "description": content,
            }
        ],
    }


def parse_resume_document(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """Ekstrak PDF/DOCX berbasis teks menjadi data editor yang dapat ditinjau pengguna."""
    extension = filename.lower().rsplit(".", 1)[-1]
    if extension == "pdf":
        raw_text = extract_text_from_pdf(file_bytes)
    elif extension == "docx":
        raw_text = extract_text_from_docx(file_bytes)
    else:
        raise ValueError(
            f"Format berkas '.{extension}' tidak didukung. Harap gunakan PDF atau DOCX."
        )

    lines = [item.strip() for item in raw_text.splitlines() if item.strip()]
    if not lines:
        raise ValueError(
            "Berkas tidak memuat teks yang dapat diekstrak. "
            "PDF hasil scan memerlukan OCR yang belum tersedia."
        )

    contact, contact_confidence = extract_contact_info(lines, raw_text)
    sections = identify_sections(lines)
    by_type: dict[str, list[dict[str, Any]]] = {}
    for section in sections:
        by_type.setdefault(section["section"], []).append(section)

    def section_lines(section_name: str) -> list[str]:
        found = by_type.get(section_name, [])
        return [line for section in found for line in lines[section["start"] : section["end"]]]

    summary_lines = section_lines("summary")
    summary = " ".join(summary_lines)
    summary_confidence = 0.85 if len(summary.split()) >= 15 else (0.55 if summary else 0.0)

    experiences, experience_confidence = parse_experience_section(section_lines("experience"))
    education, education_confidence = parse_education_section(section_lines("education"))
    skills, skills_confidence = parse_skills_section(section_lines("skills"))
    languages, languages_confidence = parse_languages_section(section_lines("languages"))

    custom_sections = []
    for section in by_type.get("custom", []):
        parsed = _custom_section(section["title"], lines[section["start"] : section["end"]])
        if parsed:
            custom_sections.append(parsed)

    confidence_values = [
        (contact_confidence["fullName"], 0.15),
        (contact_confidence["email"], 0.15),
        (summary_confidence, 0.15),
        (experience_confidence, 0.25),
        (education_confidence, 0.10),
        (skills_confidence, 0.10),
        (languages_confidence, 0.05),
        (0.85 if custom_sections else 0.0, 0.05),
    ]
    overall_confidence = round(sum(value * weight for value, weight in confidence_values), 2)

    warnings = [
        "Desain, font, warna, gambar, dan posisi kolom asli tidak ikut diimpor; "
        "hanya data teks yang dipetakan ke editor."
    ]
    if extension == "pdf":
        warnings.append(
            "PDF dua kolom dapat memiliki urutan teks berbeda. "
            "PDF hasil scan/gambar belum didukung tanpa OCR."
        )
    if contact_confidence["fullName"] < 0.7:
        warnings.append("Nama lengkap terdeteksi dengan kepastian rendah. Harap periksa kembali.")
    if contact_confidence["email"] < 0.5:
        warnings.append("Alamat email tidak ditemukan secara otomatis.")
    if experience_confidence < 0.5:
        warnings.append("Bagian pengalaman kerja tidak terdeteksi dengan jelas.")
    if skills_confidence < 0.5:
        warnings.append("Daftar keahlian tidak terdeteksi secara terpisah.")

    detected_sections = [
        SECTION_LABELS[section_name] for section_name in SECTION_LABELS if by_type.get(section_name)
    ] + [section["title"] for section in by_type.get("custom", [])]
    missing_sections = [label for key, label in SECTION_LABELS.items() if not by_type.get(key)]

    return {
        "success": True,
        "filename": filename,
        "data": {
            "contact": contact,
            "summary": summary,
            "experiences": experiences,
            "education": education,
            "skills": skills,
            "languages": languages,
            "customSections": custom_sections,
        },
        "confidence": {
            "overall": overall_confidence,
            "fullName": contact_confidence["fullName"],
            "email": contact_confidence["email"],
            "phone": contact_confidence["phone"],
            "summary": summary_confidence,
            "experiences": experience_confidence,
            "education": education_confidence,
            "skills": skills_confidence,
            "languages": languages_confidence,
            "customSections": 0.85 if custom_sections else 0.0,
        },
        "extraction": {
            "sourceFormat": extension.upper(),
            "lineCount": len(lines),
            "textCharacters": len(raw_text),
            "detectedSections": detected_sections,
            "missingSections": missing_sections,
            "layoutPreserved": False,
        },
        "warnings": warnings,
    }
