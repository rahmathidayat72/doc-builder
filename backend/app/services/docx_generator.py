import io
from typing import Any

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor


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

    color_theme = resume.get("colorTheme", "#1e293b")
    accent_rgb = parse_color_hex(color_theme)
    font_family = resume.get("fontFamily", "sans")

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

    # 1. HEADER NAMA LENGKAP
    p_name = doc.add_paragraph()
    p_name.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_name = p_name.add_run(contact.get("fullName", "Nama Lengkap").upper())
    run_name.bold = True
    run_name.font.size = Pt(20)
    run_name.font.color.rgb = accent_rgb
    p_name.paragraph_format.space_after = Pt(2)

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
    if contact.get("website"):
        contact_parts.append(contact["website"])

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

    # 2. RINGKASAN PROFESIONAL
    if summary and summary.strip():
        add_section_heading("Ringkasan Profesional")
        p_sum = doc.add_paragraph()
        run_sum = p_sum.add_run(summary.strip())
        run_sum.font.size = Pt(9.5)
        p_sum.paragraph_format.space_after = Pt(6)

    # 3. PENGALAMAN KERJA
    if experiences:
        add_section_heading("Pengalaman Kerja")
        for exp in experiences:
            p_job = doc.add_paragraph()
            p_job.paragraph_format.space_before = Pt(4)
            p_job.paragraph_format.space_after = Pt(1)

            # Posisi & Periode
            run_title = p_job.add_run(exp.get("jobTitle", "Jabatan"))
            run_title.bold = True
            run_title.font.size = Pt(10)

            end_date = "Sekarang" if exp.get("current") else exp.get("endDate", "")
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

            # Butir Deskripsi
            desc = exp.get("description", "")
            if desc:
                for line in desc.split("\n"):
                    clean_line = line.strip()
                    if clean_line:
                        if clean_line.startswith("•") or clean_line.startswith("-"):
                            clean_line = clean_line.lstrip("•-").strip()
                        p_desc = doc.add_paragraph(style="List Bullet")
                        p_desc.paragraph_format.space_after = Pt(1)
                        run_desc = p_desc.add_run(clean_line)
                        run_desc.font.size = Pt(9)

    # 4. PENDIDIKAN
    if education:
        add_section_heading("Pendidikan")
        for edu in education:
            p_edu = doc.add_paragraph()
            p_edu.paragraph_format.space_before = Pt(4)
            p_edu.paragraph_format.space_after = Pt(1)

            run_school = p_edu.add_run(edu.get("institution", "Universitas"))
            run_school.bold = True
            run_school.font.size = Pt(10)

            edu_period = f"{edu.get('startDate', '')} - {edu.get('endDate', '')}"
            if edu_period.strip() != "-":
                run_edu_period = p_edu.add_run(f"\t{edu_period}")
                run_edu_period.font.size = Pt(9)
                run_edu_period.font.color.rgb = RGBColor(100, 116, 139)

            details = []
            if edu.get("degree"):
                details.append(edu.get("degree"))
            if edu.get("fieldOfStudy"):
                details.append(f"dalam {edu.get('fieldOfStudy')}")
            if edu.get("gpa"):
                details.append(f"IPK: {edu.get('gpa')}")

            if details:
                p_deg = doc.add_paragraph()
                p_deg.paragraph_format.space_after = Pt(2)
                run_deg = p_deg.add_run("  |  ".join(details))
                run_deg.font.size = Pt(9)
                run_deg.font.color.rgb = RGBColor(71, 85, 105)

    # 5. KEAHLIAN TEKNIS
    if skills:
        add_section_heading("Keahlian & Kompetensi")
        p_sk = doc.add_paragraph()
        p_sk.paragraph_format.space_after = Pt(4)
        skill_names = [s.get("name", "") for s in skills if s.get("name")]
        run_sk = p_sk.add_run(" • ".join(skill_names))
        run_sk.font.size = Pt(9)

    # 6. KEMAMPUAN BAHASA
    if languages:
        add_section_heading("Kemampuan Bahasa")
        p_lang = doc.add_paragraph()
        p_lang.paragraph_format.space_after = Pt(4)
        lang_strings = [
            f"{item.get('language', '')} ({item.get('proficiency', '')})"
            for item in languages
            if item.get("language")
        ]
        run_lang = p_lang.add_run("  |  ".join(lang_strings))
        run_lang.font.size = Pt(9)

    out = io.BytesIO()
    doc.save(out)
    out.seek(0)
    return out
