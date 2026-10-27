import base64
import io
import re
from typing import Any

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from PIL import Image

MAX_PHOTO_BASE64_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_PHOTO_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PHOTO_PIXELS = 10_000_000  # decompression bomb defense


def parse_and_validate_photo(photo_url: str) -> io.BytesIO:
    """Memvalidasi dan mengonversi Base64 Data URL foto menjadi stream JPEG aman."""
    if not isinstance(photo_url, str) or not photo_url.strip():
        raise ValueError("URL foto profil kosong.")

    pattern = r"^data:image/(jpeg|jpg|png|webp);base64,(.+)$"
    match = re.match(pattern, photo_url, re.IGNORECASE | re.DOTALL)
    if not match:
        raise ValueError("Format URL foto profil tidak valid. Harus data URL base64.")

    b64_data = match.group(2)
    if len(b64_data) > MAX_PHOTO_BASE64_BYTES:
        raise ValueError("Ukuran data foto profil melebihi batas maksimal.")

    try:
        raw_bytes = base64.b64decode(b64_data, validate=True)
    except Exception as e:
        raise ValueError("Gagal membaca enkoding Base64 foto.") from e

    try:
        stream = io.BytesIO(raw_bytes)
        img = Image.open(stream)
        img.load()

        if img.format not in ALLOWED_PHOTO_FORMATS and img.format != "MPO":
            raise ValueError(f"Format gambar {img.format} tidak didukung.")

        w, h = img.size
        if w * h > MAX_PHOTO_PIXELS:
            raise ValueError("Dimensi gambar foto profil melebihi batas keselamatan.")

        rgb_img = img.convert("RGB")
        out_stream = io.BytesIO()
        rgb_img.save(out_stream, format="JPEG", quality=90)
        out_stream.seek(0)
        return out_stream
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Gambar foto profil tidak dapat diproses: {e}") from e

RESUME_LABELS = {
    "id": {
        "full_name": "Nama Lengkap",
        "summary": "Ringkasan Profesional",
        "experience": "Pengalaman Kerja",
        "job_title": "Jabatan",
        "present": "Sekarang",
        "education": "Pendidikan",
        "institution": "Universitas",
        "in_field": "dalam",
        "gpa": "IPK",
        "skills": "Keahlian & Kompetensi",
        "languages": "Kemampuan Bahasa",
        "custom_default": "Bagian Tambahan",
    },
    "en": {
        "full_name": "Full Name",
        "summary": "Professional Summary",
        "experience": "Work Experience",
        "job_title": "Position",
        "present": "Present",
        "education": "Education",
        "institution": "University",
        "in_field": "in",
        "gpa": "GPA",
        "skills": "Skills & Competencies",
        "languages": "Language Proficiency",
        "custom_default": "Additional Section",
    },
}


def parse_color_hex(hex_str: str) -> RGBColor:
    """Mengonversi string hex (#4338ca) menjadi RGBColor docx."""
    try:
        clean = hex_str.lstrip("#")
        if len(clean) == 6:
            r = int(clean[0:2], 16)
            g = int(clean[2:4], 16)
            b = int(clean[4:6], 16)
            return RGBColor(r, g, b)
    except Exception:
        pass
    return RGBColor(30, 41, 59)  # Slate default


def generate_resume_docx(resume: dict[str, Any]) -> io.BytesIO:
    """
    Menghasilkan berkas Microsoft Word (.docx) terstruktur standar ATS
    dari payload kamus data resume.
    """
    doc = Document()

    # Atur Margin Halaman A4 standar (0.75 inci untuk ATS & ruang maksimal)
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    data = resume.get("data", {})
    contact = data.get("contact", {})
    summary = data.get("summary", "")
    experiences = data.get("experiences", [])
    education = data.get("education", [])
    skills = data.get("skills", [])
    languages = data.get("languages", [])
    custom_sections = data.get("customSections", [])

    color_theme = resume.get("colorTheme", "#1e293b")
    accent_rgb = parse_color_hex(color_theme)
    font_family = resume.get("fontFamily", "sans")
    lang = resume.get("resumeLanguage", "id")
    labels = RESUME_LABELS.get(lang, RESUME_LABELS["id"])

    primary_font = "Calibri"
    if font_family == "serif":
        primary_font = "Georgia"
    elif font_family == "mono":
        primary_font = "Consolas"

    # Set font standar pada document styles
    style_normal = doc.styles["Normal"]
    font_normal = style_normal.font
    font_normal.name = primary_font
    font_normal.size = Pt(10)
    font_normal.color.rgb = RGBColor(51, 65, 85)

    # 1. HEADER NAMA LENGKAP & FOTO PROFIL
    use_photo = bool(contact.get("usePhoto"))
    photo_url = contact.get("photoUrl")
    if use_photo and photo_url and photo_url.strip():
        photo_stream = parse_and_validate_photo(photo_url)
        p_photo = doc.add_paragraph()
        p_photo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_photo.paragraph_format.space_before = Pt(0)
        p_photo.paragraph_format.space_after = Pt(4)
        run_photo = p_photo.add_run()
        run_photo.add_picture(photo_stream, width=Inches(1.1))

    p_name = doc.add_paragraph()
    p_name.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_name = p_name.add_run(contact.get("fullName", labels["full_name"]).upper())
    run_name.bold = True
    run_name.font.size = Pt(20)
    run_name.font.color.rgb = accent_rgb
    p_name.paragraph_format.space_after = Pt(2)

    headline = contact.get("headline", "")
    if isinstance(headline, str) and headline.strip():
        p_headline = doc.add_paragraph()
        p_headline.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_headline.paragraph_format.space_after = Pt(4)
        run_headline = p_headline.add_run(headline.strip())
        run_headline.font.size = Pt(10)
        run_headline.font.color.rgb = RGBColor(71, 85, 105)

    # KONTAK DETAIL
    contact_parts = []
    if contact.get("email"):
        contact_parts.append(contact["email"])
    if contact.get("phone"):
        contact_parts.append(contact["phone"])
    if contact.get("location"):
        contact_parts.append(contact["location"])
    if contact.get("linkedin"):
        contact_parts.append(contact["linkedin"])

    websites = contact.get("websites")
    if not isinstance(websites, list):
        websites = []

    legacy_website = contact.get("website")
    has_website_value = any(
        isinstance(site, str) and site.strip() for site in websites
    )
    if not has_website_value and isinstance(legacy_website, str) and legacy_website.strip():
        websites = [legacy_website]

    added_websites: set[str] = set()
    for site in websites:
        if len(added_websites) >= 3:
            break
        if not isinstance(site, str):
            continue
        normalized_site = site.strip()
        site_key = normalized_site.lower()
        if normalized_site and site_key not in added_websites:
            added_websites.add(site_key)
            contact_parts.append(normalized_site)

    if contact_parts:
        p_contact = doc.add_paragraph()
        p_contact.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run_contact = p_contact.add_run("  |  ".join(contact_parts))
        run_contact.font.size = Pt(9)
        run_contact.font.color.rgb = RGBColor(100, 116, 139)
        p_contact.paragraph_format.space_after = Pt(12)

    def add_section_heading(title: str):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(title.upper())
        run.bold = True
        run.font.size = Pt(11)
        run.font.color.rgb = accent_rgb
        # Tambahkan pembatas horizontal tipis (atau border)
        return p

    valid_sections = [
        "summary",
        "experience",
        "education",
        "skills",
        "languages",
        "custom",
    ]
    raw_order = data.get("sectionOrder")
    section_order: list[str] = []
    if isinstance(raw_order, list):
        for value in raw_order:
            if (
                isinstance(value, str)
                and value in valid_sections
                and value not in section_order
            ):
                section_order.append(value)
    for value in valid_sections:
        if value not in section_order:
            section_order.append(value)

    for section_id in section_order:
        # 2. RINGKASAN PROFESIONAL
        if section_id == "summary" and summary and summary.strip():
            add_section_heading(labels["summary"])
            p_sum = doc.add_paragraph()
            run_sum = p_sum.add_run(summary.strip())
            run_sum.font.size = Pt(9.5)
            p_sum.paragraph_format.space_after = Pt(6)

        # 3. PENGALAMAN KERJA
        elif section_id == "experience" and experiences:
            add_section_heading(labels["experience"])
            for exp in experiences:
                p_job = doc.add_paragraph()
                p_job.paragraph_format.space_before = Pt(4)
                p_job.paragraph_format.space_after = Pt(1)

                # Posisi & Periode
                run_title = p_job.add_run(exp.get("jobTitle", labels["job_title"]))
                run_title.bold = True
                run_title.font.size = Pt(10)

                end_date = (
                    labels["present"] if exp.get("current") else exp.get("endDate", "")
                )
                period = f"{exp.get('startDate', '')} - {end_date}"
                if period.strip() != "-":
                    run_period = p_job.add_run(f"\t{period}")
                    run_period.font.size = Pt(9)
                    run_period.font.color.rgb = RGBColor(100, 116, 139)

                # Perusahaan & Lokasi
                company_line = exp.get("company", "")
                if exp.get("location"):
                    company_line += f" • {exp.get('location')}"
                if company_line:
                    p_comp = doc.add_paragraph()
                    p_comp.paragraph_format.space_after = Pt(2)
                    run_comp = p_comp.add_run(company_line)
                    run_comp.font.size = Pt(9)
                    run_comp.font.italic = True
                    run_comp.font.color.rgb = RGBColor(71, 85, 105)

                # Butir pencapaian terstruktur, dengan fallback ke deskripsi lama.
                achievement_values = exp.get("achievements")
                if isinstance(achievement_values, list):
                    achievement_lines = [
                        str(item) for item in achievement_values if str(item).strip()
                    ]
                else:
                    description = exp.get("description", "")
                    achievement_lines = (
                        description.splitlines() if isinstance(description, str) else []
                    )

                for line in achievement_lines:
                    clean_line = line.strip().lstrip("•-* ").strip()
                    if clean_line:
                        p_desc = doc.add_paragraph(style="List Bullet")
                        p_desc.paragraph_format.space_after = Pt(1)
                        run_desc = p_desc.add_run(clean_line)
                        run_desc.font.size = Pt(9)

        # 4. PENDIDIKAN
        elif section_id == "education" and education:
            add_section_heading(labels["education"])
            for edu in education:
                p_edu = doc.add_paragraph()
                p_edu.paragraph_format.space_before = Pt(4)
                p_edu.paragraph_format.space_after = Pt(1)

                run_school = p_edu.add_run(
                    edu.get("institution", labels["institution"])
                )
                run_school.bold = True
                run_school.font.size = Pt(10)

                start_date = edu.get("startDate", "").strip()
                end_date = edu.get("endDate", "").strip()
                if start_date and end_date:
                    edu_period = f"{start_date} - {end_date}"
                elif end_date:
                    edu_period = end_date
                elif start_date:
                    edu_period = start_date
                else:
                    edu_period = ""

                if edu_period:
                    run_edu_period = p_edu.add_run(f"\t{edu_period}")
                    run_edu_period.font.size = Pt(9)
                    run_edu_period.font.color.rgb = RGBColor(100, 116, 139)

                details = []
                if edu.get("degree"):
                    details.append(edu.get("degree"))
                if edu.get("fieldOfStudy"):
                    details.append(f"{labels['in_field']} {edu.get('fieldOfStudy')}")
                if edu.get("gpa"):
                    details.append(f"{labels['gpa']}: {edu.get('gpa')}")

                if details:
                    p_deg = doc.add_paragraph()
                    p_deg.paragraph_format.space_after = Pt(2)
                    run_deg = p_deg.add_run("  |  ".join(details))
                    run_deg.font.size = Pt(9)
                    run_deg.font.color.rgb = RGBColor(71, 85, 105)

                edu_description = edu.get("description", "")
                if isinstance(edu_description, str) and edu_description.strip():
                    p_edu_desc = doc.add_paragraph()
                    p_edu_desc.paragraph_format.space_after = Pt(3)
                    run_edu_desc = p_edu_desc.add_run(edu_description.strip())
                    run_edu_desc.font.size = Pt(9)
                    run_edu_desc.font.color.rgb = RGBColor(71, 85, 105)

        # 5. KEAHLIAN TEKNIS
        elif section_id == "skills" and skills:
            add_section_heading(labels["skills"])
            p_sk = doc.add_paragraph()
            p_sk.paragraph_format.space_after = Pt(4)
            skill_names = [s.get("name", "") for s in skills if s.get("name")]
            run_sk = p_sk.add_run(" • ".join(skill_names))
            run_sk.font.size = Pt(9)

        # 6. KEMAMPUAN BAHASA
        elif section_id == "languages" and languages:
            add_section_heading(labels["languages"])
            p_lang = doc.add_paragraph()
            p_lang.paragraph_format.space_after = Pt(4)
            lang_strings = [
                f"{item.get('language', '')} ({item.get('proficiency', '')})"
                for item in languages
                if item.get("language")
            ]
            run_lang = p_lang.add_run("  |  ".join(lang_strings))
            run_lang.font.size = Pt(9)

        # 7. BAGIAN TAMBAHAN
        elif section_id == "custom":
            for custom_section in custom_sections:
                section_title = custom_section.get("sectionTitle", "").strip()
                visible_items = [
                    item
                    for item in custom_section.get("items", [])
                    if any(
                        str(item.get(field, "")).strip()
                        for field in ("title", "subtitle", "date", "description")
                    )
                ]
                if not section_title and not visible_items:
                    continue

                add_section_heading(section_title or labels["custom_default"])
                for item in visible_items:
                    title = item.get("title", "").strip()
                    subtitle = item.get("subtitle", "").strip()
                    date = item.get("date", "").strip()
                    description = item.get("description", "").strip()

                    if title or date:
                        p_item = doc.add_paragraph()
                        p_item.paragraph_format.space_before = Pt(4)
                        p_item.paragraph_format.space_after = Pt(1)
                        if title:
                            run_title = p_item.add_run(title)
                            run_title.bold = True
                            run_title.font.size = Pt(10)
                        if date:
                            run_date = p_item.add_run(f"\t{date}" if title else date)
                            run_date.font.size = Pt(9)
                            run_date.font.color.rgb = RGBColor(100, 116, 139)

                    if subtitle:
                        p_subtitle = doc.add_paragraph()
                        p_subtitle.paragraph_format.space_after = Pt(2)
                        run_subtitle = p_subtitle.add_run(subtitle)
                        run_subtitle.font.size = Pt(9)
                        run_subtitle.font.italic = True
                        run_subtitle.font.color.rgb = RGBColor(71, 85, 105)

                    if description:
                        for line in description.splitlines():
                            clean_line = line.strip()
                            if not clean_line:
                                continue
                            p_description = doc.add_paragraph()
                            p_description.paragraph_format.space_after = Pt(1)
                            run_description = p_description.add_run(clean_line)
                            run_description.font.size = Pt(9)

    out = io.BytesIO()
    doc.save(out)
    out.seek(0)
    return out
