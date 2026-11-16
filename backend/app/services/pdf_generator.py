from __future__ import annotations

import html
import io
from typing import Any

import pymupdf

from app.services.docx_generator import parse_and_validate_photo

A4_WIDTH = 595.0
A4_HEIGHT = 842.0

RESUME_PDF_LABELS: dict[str, dict[str, str]] = {
    "id": {
        "full_name": "Nama Lengkap",
        "summary": "Ringkasan Profesional",
        "summary_profile": "Profil Profesional",
        "summary_about": "Tentang Saya",
        "experience": "Pengalaman Kerja",
        "experience_short": "Pengalaman",
        "job_title": "Jabatan",
        "present": "Sekarang",
        "education": "Pendidikan",
        "institution": "Universitas",
        "in_field": "dalam",
        "gpa": "IPK",
        "skills": "Keahlian & Kompetensi",
        "skills_technical": "Keahlian Teknis",
        "skills_short": "Keahlian",
        "languages": "Kemampuan Bahasa",
        "languages_short": "Bahasa",
        "contact": "Kontak",
        "custom_default": "Bagian Tambahan",
    },
    "en": {
        "full_name": "Full Name",
        "summary": "Professional Summary",
        "summary_profile": "Professional Profile",
        "summary_about": "About Me",
        "experience": "Work Experience",
        "experience_short": "Experience",
        "job_title": "Position",
        "present": "Present",
        "education": "Education",
        "institution": "University",
        "in_field": "in",
        "gpa": "GPA",
        "skills": "Skills & Competencies",
        "skills_technical": "Technical Skills",
        "skills_short": "Skills",
        "languages": "Language Proficiency",
        "languages_short": "Languages",
        "contact": "Contact",
        "custom_default": "Additional Section",
    },
}

VALID_SECTIONS = ("summary", "experience", "education", "skills", "languages", "custom")


def _esc(val: Any) -> str:
    return html.escape(str(val or ""), quote=False)


def _hex_to_rgb_norm(hex_color: str) -> tuple[float, float, float]:
    clean = str(hex_color or "").strip().lstrip("#")
    if len(clean) == 6:
        try:
            return (
                int(clean[0:2], 16) / 255.0,
                int(clean[2:4], 16) / 255.0,
                int(clean[4:6], 16) / 255.0,
            )
        except ValueError:
            pass
    return (0.12, 0.16, 0.23)


def _resolve_section_order(raw_order: Any) -> list[str]:
    section_order: list[str] = []
    if isinstance(raw_order, list):
        for value in raw_order:
            if isinstance(value, str) and value in VALID_SECTIONS and value not in section_order:
                section_order.append(value)
    for value in VALID_SECTIONS:
        if value not in section_order:
            section_order.append(value)
    return section_order


def _extract_websites(contact: dict[str, Any]) -> list[str]:
    websites = contact.get("websites")
    if not isinstance(websites, list):
        websites = []

    legacy_website = contact.get("website")
    has_website_value = any(isinstance(site, str) and site.strip() for site in websites)
    if not has_website_value and isinstance(legacy_website, str) and legacy_website.strip():
        websites = [legacy_website]

    result: list[str] = []
    seen: set[str] = set()
    for site in websites:
        if len(result) >= 3:
            break
        if not isinstance(site, str):
            continue
        normalized = site.strip()
        key = normalized.lower()
        if normalized and key not in seen:
            seen.add(key)
            result.append(normalized)
    return result


def _format_experience_bullets(exp: dict[str, Any]) -> str:
    achievement_values = exp.get("achievements")
    lines: list[str] = []
    if isinstance(achievement_values, list) and any(str(x).strip() for x in achievement_values):
        lines = [str(item).strip() for item in achievement_values if str(item).strip()]
    else:
        description = exp.get("description", "")
        if isinstance(description, str):
            lines = [
                line.strip().lstrip("•-* ").strip()
                for line in description.splitlines()
                if line.strip().lstrip("•-* ").strip()
            ]
    if not lines:
        return ""
    items_html = "".join(f"<li>{_esc(line)}</li>" for line in lines)
    return f"<ul>{items_html}</ul>"


def _render_custom_sections_html(
    custom_sections: list[dict[str, Any]],
    h2_style: str,
    default_heading: str,
) -> str:
    blocks: list[str] = []
    for section in custom_sections:
        if not isinstance(section, dict):
            continue
        raw_title = str(section.get("sectionTitle") or section.get("title") or "").strip()
        raw_items = section.get("items")
        if not isinstance(raw_items, list):
            raw_items = []

        item_fragments: list[str] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or item.get("label") or "").strip()
            subtitle = str(item.get("subtitle") or "").strip()
            date = str(item.get("date") or "").strip()
            description = str(item.get("description") or item.get("value") or "").strip()
            if not any((title, subtitle, date, description)):
                continue

            parts: list[str] = []
            if title and date:
                parts.append(
                    f"<b>{_esc(title)}</b> <span style='color:#64748b;'>({_esc(date)})</span>"
                )
            elif title:
                parts.append(f"<b>{_esc(title)}</b>")
            elif date:
                parts.append(f"<span style='color:#64748b;'>{_esc(date)}</span>")

            if subtitle:
                parts.append(f"<i>{_esc(subtitle)}</i>")
            if description:
                desc_lines = "<br/>".join(
                    _esc(line.strip()) for line in description.splitlines() if line.strip()
                )
                if desc_lines:
                    parts.append(desc_lines)

            item_fragments.append("<p style='margin:2pt 0 4pt 0;'>" + "<br/>".join(parts) + "</p>")

        if not raw_title and not item_fragments:
            continue

        heading_text = _esc((raw_title or default_heading).upper())
        blocks.append(f"<h2 style='{h2_style}'>{heading_text}</h2>" + "".join(item_fragments))
    return "".join(blocks)


def _build_single_column_html(resume: dict[str, Any], template_id: str) -> str:
    data = resume.get("data", {}) if isinstance(resume.get("data"), dict) else {}
    contact = data.get("contact", {}) if isinstance(data.get("contact"), dict) else {}
    lang = str(resume.get("resumeLanguage") or "id")
    labels = RESUME_PDF_LABELS.get(lang, RESUME_PDF_LABELS["id"])
    accent = _esc(resume.get("colorTheme") or "#1e293b")
    font_family = str(resume.get("fontFamily") or "sans")
    css_font = (
        "serif"
        if font_family == "serif"
        else ("monospace" if font_family == "mono" else "sans-serif")
    )

    websites = _extract_websites(contact)
    contact_parts = [
        str(p).strip()
        for p in [
            contact.get("email"),
            contact.get("phone"),
            contact.get("location"),
            contact.get("linkedin"),
            *websites,
        ]
        if isinstance(p, str) and p.strip()
    ]
    sep = " • " if template_id == "visual-minimal" else "  |  "
    contact_line = sep.join(_esc(p) for p in contact_parts)

    header_align = "center" if template_id == "ats-clean" else "left"
    h2_style = (
        f"color:{accent};border-bottom:1pt solid #cbd5e1;font-size:10.5pt;margin:8pt 0 3pt 0;"
        if template_id == "ats-clean"
        else (
            f"color:{accent};border-left:3pt solid {accent};padding-left:5pt;"
            "font-size:10.5pt;margin:8pt 0 3pt 0;"
            if template_id == "ats-modern"
            else "color:#64748b;font-size:8.5pt;letter-spacing:1.2pt;margin:8pt 0 3pt 0;"
        )
    )

    sections_map: dict[str, str] = {}

    summary = str(data.get("summary") or "").strip()
    if summary:
        sum_heading = (
            labels["summary_about"]
            if template_id == "visual-minimal"
            else (labels["summary_profile"] if template_id == "ats-modern" else labels["summary"])
        )
        sections_map["summary"] = (
            f"<h2 style='{h2_style}'>{_esc(sum_heading.upper())}</h2>"
            f"<p style='margin:2pt 0 6pt 0;'>{_esc(summary)}</p>"
        )

    experiences = data.get("experiences")
    if isinstance(experiences, list) and experiences:
        exp_blocks: list[str] = []
        for exp in experiences:
            if not isinstance(exp, dict):
                continue
            job_title = _esc(exp.get("jobTitle") or labels["job_title"])
            end_date = (
                labels["present"] if exp.get("current") else str(exp.get("endDate") or "").strip()
            )
            start_date = str(exp.get("startDate") or "").strip()
            period = f"{start_date} - {end_date}" if (start_date or end_date) else ""
            period_html = (
                f" <span style='color:#64748b;font-size:8.5pt;'>({_esc(period)})</span>"
                if period and period.strip(" -")
                else ""
            )
            company = str(exp.get("company") or "").strip()
            location = str(exp.get("location") or "").strip()
            comp_line = (
                f"{company} • {location}" if (company and location) else (company or location)
            )
            comp_html = (
                f"<br/><i style='color:#475569;font-size:9pt;'>{_esc(comp_line)}</i>"
                if comp_line
                else ""
            )
            exp_blocks.append(
                f"<div style='margin:3pt 0 5pt 0;'><b>{job_title}</b>{period_html}"
                f"{comp_html}{_format_experience_bullets(exp)}</div>"
            )
        if exp_blocks:
            exp_heading = (
                labels["experience_short"]
                if template_id == "visual-minimal"
                else labels["experience"]
            )
            sections_map["experience"] = (
                f"<h2 style='{h2_style}'>{_esc(exp_heading.upper())}</h2>" + "".join(exp_blocks)
            )

    education = data.get("education") or data.get("educations")
    if isinstance(education, list) and education:
        edu_blocks: list[str] = []
        for edu in education:
            if not isinstance(edu, dict):
                continue
            inst = _esc(edu.get("institution") or edu.get("school") or labels["institution"])
            start_date = str(edu.get("startDate") or "").strip()
            end_date = str(edu.get("endDate") or "").strip()
            edu_period = (
                f"{start_date} - {end_date}"
                if (start_date and end_date)
                else (end_date or start_date)
            )
            period_html = (
                f" <span style='color:#64748b;font-size:8.5pt;'>({_esc(edu_period)})</span>"
                if edu_period
                else ""
            )
            details: list[str] = []
            if edu.get("degree"):
                details.append(_esc(edu["degree"]))
            if edu.get("fieldOfStudy"):
                details.append(f"{_esc(labels['in_field'])} {_esc(edu['fieldOfStudy'])}")
            if edu.get("gpa"):
                details.append(f"{_esc(labels['gpa'])}: {_esc(edu['gpa'])}")
            detail_html = (
                f"<br/><span style='color:#475569;font-size:9pt;'>{'  |  '.join(details)}</span>"
                if details
                else ""
            )
            edu_desc = str(edu.get("description") or "").strip()
            desc_html = (
                f"<br/><span style='color:#475569;font-size:9pt;'>{_esc(edu_desc)}</span>"
                if edu_desc
                else ""
            )
            edu_blocks.append(
                f"<p style='margin:3pt 0 5pt 0;'><b>{inst}</b>{period_html}"
                f"{detail_html}{desc_html}</p>"
            )
        if edu_blocks:
            sections_map["education"] = (
                f"<h2 style='{h2_style}'>{_esc(labels['education'].upper())}</h2>"
                + "".join(edu_blocks)
            )

    skills = data.get("skills")
    if isinstance(skills, list) and skills:
        skill_names = [
            _esc(s.get("name"))
            for s in skills
            if isinstance(s, dict) and str(s.get("name") or "").strip()
        ]
        if skill_names:
            sk_heading = (
                labels["skills_short"]
                if template_id == "visual-minimal"
                else (
                    labels["skills_technical"] if template_id == "ats-modern" else labels["skills"]
                )
            )
            sections_map["skills"] = (
                f"<h2 style='{h2_style}'>{_esc(sk_heading.upper())}</h2>"
                f"<p style='margin:2pt 0 6pt 0;'>{' • '.join(skill_names)}</p>"
            )

    languages = data.get("languages")
    if isinstance(languages, list) and languages:
        lang_items = [
            f"{_esc(item.get('language'))} ({_esc(item.get('proficiency'))})"
            if str(item.get("proficiency") or "").strip()
            else _esc(item.get("language"))
            for item in languages
            if isinstance(item, dict) and str(item.get("language") or "").strip()
        ]
        if lang_items:
            lg_heading = (
                labels["languages_short"]
                if template_id in ("visual-minimal", "ats-modern")
                else labels["languages"]
            )
            sections_map["languages"] = (
                f"<h2 style='{h2_style}'>{_esc(lg_heading.upper())}</h2>"
                f"<p style='margin:2pt 0 6pt 0;'>{'  |  '.join(lang_items)}</p>"
            )

    custom_sections = data.get("customSections")
    if isinstance(custom_sections, list) and custom_sections:
        custom_html = _render_custom_sections_html(
            custom_sections, h2_style, labels["custom_default"]
        )
        if custom_html:
            sections_map["custom"] = custom_html

    section_order = _resolve_section_order(data.get("sectionOrder"))
    ordered_body = "".join(sections_map[k] for k in section_order if k in sections_map)

    full_name = _esc(str(contact.get("fullName") or labels["full_name"]).upper())
    headline = str(contact.get("headline") or "").strip()
    headline_html = (
        f"<p style='margin:2pt 0;font-weight:bold;color:#475569;'>{_esc(headline)}</p>"
        if headline
        else ""
    )
    contact_html = (
        f"<p style='margin:2pt 0;font-size:8.5pt;color:#64748b;'>{contact_line}</p>"
        if contact_line
        else ""
    )

    header_box_style = (
        f"text-align:{header_align};border-bottom:1.5pt solid {accent};"
        "padding-bottom:6pt;margin-bottom:8pt;"
    )
    return f"""
    <html>
    <body style="font-family:{css_font};font-size:9.5pt;color:#1e293b;line-height:1.35;">
        <div style="{header_box_style}">
            <h1 style="color:{accent};font-size:18pt;margin:0;">{full_name}</h1>
            {headline_html}
            {contact_html}
        </div>
        {ordered_body}
    </body>
    </html>
    """


def _render_visual_executive_pdf(
    resume: dict[str, Any],
    accent_hex: str,
    accent_rgb: tuple[float, float, float],
    photo_bytes: bytes | None,
) -> bytes:
    data = resume.get("data", {}) if isinstance(resume.get("data"), dict) else {}
    contact = data.get("contact", {}) if isinstance(data.get("contact"), dict) else {}
    lang = str(resume.get("resumeLanguage") or "id")
    labels = RESUME_PDF_LABELS.get(lang, RESUME_PDF_LABELS["id"])
    accent = _esc(accent_hex)
    font_family = str(resume.get("fontFamily") or "sans")
    css_font = (
        "serif"
        if font_family == "serif"
        else ("monospace" if font_family == "mono" else "sans-serif")
    )

    websites = _extract_websites(contact)
    contact_lines = [
        _esc(str(p).strip())
        for p in [
            contact.get("email"),
            contact.get("phone"),
            contact.get("location"),
            contact.get("linkedin"),
            *websites,
        ]
        if isinstance(p, str) and p.strip()
    ]
    h3_side = f"color:{accent};border-bottom:1pt solid {accent};font-size:9.5pt;margin:8pt 0 3pt 0;"

    side_sections: dict[str, str] = {}
    education = data.get("education") or data.get("educations")
    if isinstance(education, list) and education:
        edu_items: list[str] = []
        for edu in education:
            if not isinstance(edu, dict):
                continue
            inst = _esc(edu.get("institution") or edu.get("school") or labels["institution"])
            deg_parts: list[str] = []
            if edu.get("degree"):
                deg_parts.append(_esc(edu["degree"]))
            if edu.get("fieldOfStudy"):
                deg_parts.append(f"{_esc(labels['in_field'])} {_esc(edu['fieldOfStudy'])}")
            if edu.get("gpa"):
                deg_parts.append(f"{_esc(labels['gpa'])}: {_esc(edu['gpa'])}")
            start_d = str(edu.get("startDate") or "").strip()
            end_d = str(edu.get("endDate") or "").strip()
            period = f"{start_d} - {end_d}" if (start_d and end_d) else (end_d or start_d)
            desc = str(edu.get("description") or "").strip()
            edu_items.append(
                f"<p style='margin:2pt 0 5pt 0;'><b>{inst}</b>"
                + (f"<br/>{' | '.join(deg_parts)}" if deg_parts else "")
                + (f"<br/><span style='color:#64748b;'>{_esc(period)}</span>" if period else "")
                + (f"<br/>{_esc(desc)}" if desc else "")
                + "</p>"
            )
        if edu_items:
            side_sections["education"] = (
                f"<h3 style='{h3_side}'>{_esc(labels['education'].upper())}</h3>"
                + "".join(edu_items)
            )

    skills = data.get("skills")
    if isinstance(skills, list) and skills:
        skill_names = [
            _esc(s.get("name"))
            for s in skills
            if isinstance(s, dict) and str(s.get("name") or "").strip()
        ]
        if skill_names:
            side_sections["skills"] = (
                f"<h3 style='{h3_side}'>{_esc(labels['skills_short'].upper())}</h3>"
                f"<p style='margin:2pt 0 5pt 0;'>{' • '.join(skill_names)}</p>"
            )

    languages = data.get("languages")
    if isinstance(languages, list) and languages:
        lang_lines = [
            f"<b>{_esc(lang_item.get('language'))}</b>: {_esc(lang_item.get('proficiency'))}"
            if str(lang_item.get("proficiency") or "").strip()
            else f"<b>{_esc(lang_item.get('language'))}</b>"
            for lang_item in languages
            if isinstance(lang_item, dict) and str(lang_item.get("language") or "").strip()
        ]
        if lang_lines:
            side_sections["languages"] = (
                f"<h3 style='{h3_side}'>{_esc(labels['languages_short'].upper())}</h3>"
                f"<p style='margin:2pt 0 5pt 0;'>{'<br/>'.join(lang_lines)}</p>"
            )

    section_order = _resolve_section_order(data.get("sectionOrder"))
    ordered_side = "".join(side_sections[k] for k in section_order if k in side_sections)

    sidebar_html = f"""
    <html>
    <body style="font-family:{css_font};font-size:8.5pt;color:#1e293b;line-height:1.35;">
        <h3 style="{h3_side}">{_esc(labels["contact"].upper())}</h3>
        <p style="margin:2pt 0 6pt 0;">{"<br/>".join(contact_lines)}</p>
        {ordered_side}
        <p style="color:#64748b;font-size:7.5pt;margin-top:10pt;">Beresin Executive</p>
    </body>
    </html>
    """

    h2_main = f"color:{accent};border-bottom:1pt solid #e2e8f0;font-size:10.5pt;margin:8pt 0 3pt 0;"
    main_sections: dict[str, str] = {}

    summary = str(data.get("summary") or "").strip()
    if summary:
        main_sections["summary"] = (
            f"<h2 style='{h2_main}'>{_esc(labels['summary_profile'].upper())}</h2>"
            f"<p style='margin:2pt 0 6pt 0;'>{_esc(summary)}</p>"
        )

    experiences = data.get("experiences")
    if isinstance(experiences, list) and experiences:
        exp_blocks: list[str] = []
        for exp in experiences:
            if not isinstance(exp, dict):
                continue
            job_title = _esc(exp.get("jobTitle") or labels["job_title"])
            end_date = (
                labels["present"] if exp.get("current") else str(exp.get("endDate") or "").strip()
            )
            start_date = str(exp.get("startDate") or "").strip()
            period = f"{start_date} - {end_date}" if (start_date or end_date) else ""
            period_html = (
                f" <span style='color:#64748b;font-size:8.5pt;'>({_esc(period)})</span>"
                if period and period.strip(" -")
                else ""
            )
            company = str(exp.get("company") or "").strip()
            location = str(exp.get("location") or "").strip()
            comp_line = (
                f"{company} • {location}" if (company and location) else (company or location)
            )
            comp_html = (
                f"<br/><i style='color:#475569;font-size:9pt;'>{_esc(comp_line)}</i>"
                if comp_line
                else ""
            )
            exp_blocks.append(
                f"<div style='margin:3pt 0 5pt 0;'><b>{job_title}</b>{period_html}"
                f"{comp_html}{_format_experience_bullets(exp)}</div>"
            )
        if exp_blocks:
            main_sections["experience"] = (
                f"<h2 style='{h2_main}'>{_esc(labels['experience'].upper())}</h2>"
                + "".join(exp_blocks)
            )

    custom_sections = data.get("customSections")
    if isinstance(custom_sections, list) and custom_sections:
        custom_html = _render_custom_sections_html(
            custom_sections, h2_main, labels["custom_default"]
        )
        if custom_html:
            main_sections["custom"] = custom_html

    ordered_main = "".join(main_sections[k] for k in section_order if k in main_sections)
    full_name = _esc(str(contact.get("fullName") or labels["full_name"]).upper())
    headline = str(contact.get("headline") or "").strip()
    headline_html = (
        f"<p style='font-weight:bold;color:#475569;margin:2pt 0 6pt 0;'>{_esc(headline)}</p>"
        if headline
        else ""
    )

    main_html = f"""
    <html>
    <body style="font-family:{css_font};font-size:9.5pt;color:#1e293b;line-height:1.35;">
        <h1 style="color:{accent};font-size:18pt;margin:0;">{full_name}</h1>
        {headline_html}
        {ordered_main}
    </body>
    </html>
    """

    buf = io.BytesIO()
    writer = pymupdf.DocumentWriter(buf)
    story_left = pymupdf.Story(html=sidebar_html)
    story_right = pymupdf.Story(html=main_html)
    mediabox = pymupdf.Rect(0, 0, A4_WIDTH, A4_HEIGHT)
    sidebar_width = A4_WIDTH * 0.34
    left_rect = pymupdf.Rect(24, 96 if photo_bytes else 36, sidebar_width - 14, A4_HEIGHT - 36)
    right_rect = pymupdf.Rect(sidebar_width + 18, 36, A4_WIDTH - 32, A4_HEIGHT - 36)

    more_left = True
    more_right = True
    while more_left or more_right:
        device = writer.begin_page(mediabox)
        if more_left:
            more_left, _ = story_left.place(left_rect)
            story_left.draw(device)
        if more_right:
            more_right, _ = story_right.place(right_rect)
            story_right.draw(device)
        writer.end_page()
    writer.close()

    pdf_doc = pymupdf.open("pdf", buf.getvalue())
    tint = (
        1.0 - (1.0 - accent_rgb[0]) * 0.10,
        1.0 - (1.0 - accent_rgb[1]) * 0.10,
        1.0 - (1.0 - accent_rgb[2]) * 0.10,
    )
    for idx, page in enumerate(pdf_doc):
        shape = page.new_shape()
        shape.draw_rect(pymupdf.Rect(0, 0, sidebar_width, A4_HEIGHT))
        shape.finish(fill=tint, color=accent_rgb, width=0.8)
        shape.commit(overlay=False)
        if idx == 0 and photo_bytes:
            page.insert_image(pymupdf.Rect(24, 28, 76, 80), stream=photo_bytes)

    out = pdf_doc.tobytes(garbage=3, deflate=True)
    pdf_doc.close()
    return out


def generate_resume_pdf(resume: dict[str, Any]) -> tuple[io.BytesIO | None, str | None]:
    """
    Merender data resume menjadi dokumen PDF secara langsung menggunakan PyMuPDF
    sesuai 4 template canonical (`ats-clean`, `ats-modern`, `visual-executive`, `visual-minimal`).
    """
    data = resume.get("data", {}) if isinstance(resume.get("data"), dict) else {}
    contact = data.get("contact", {}) if isinstance(data.get("contact"), dict) else {}

    photo_bytes: bytes | None = None
    use_photo = bool(contact.get("usePhoto"))
    photo_url = contact.get("photoUrl")
    if use_photo and isinstance(photo_url, str) and photo_url.strip():
        photo_bytes = parse_and_validate_photo(photo_url).getvalue()

    template_id = str(resume.get("templateId") or "ats-clean")
    accent_hex = str(resume.get("colorTheme") or "#1e293b")
    accent_rgb = _hex_to_rgb_norm(accent_hex)

    if template_id == "visual-executive":
        pdf_bytes = _render_visual_executive_pdf(resume, accent_hex, accent_rgb, photo_bytes)
        return io.BytesIO(pdf_bytes), None

    html_content = _build_single_column_html(resume, template_id)
    buf = io.BytesIO()
    writer = pymupdf.DocumentWriter(buf)
    story = pymupdf.Story(html=html_content)
    mediabox = pymupdf.Rect(0, 0, A4_WIDTH, A4_HEIGHT)
    body_rect = pymupdf.Rect(42, 42, A4_WIDTH - 42, A4_HEIGHT - 42)

    more = True
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(body_rect)
        story.draw(device)
        writer.end_page()
    writer.close()

    pdf_doc = pymupdf.open("pdf", buf.getvalue())
    if len(pdf_doc) > 0:
        first_page = pdf_doc[0]
        if template_id == "ats-modern":
            shape = first_page.new_shape()
            shape.draw_rect(pymupdf.Rect(34, 42, 37, 110))
            shape.finish(fill=accent_rgb, color=accent_rgb)
            shape.commit()
        if photo_bytes:
            rect = (
                pymupdf.Rect(A4_WIDTH - 96, 40, A4_WIDTH - 42, 94)
                if template_id in ("ats-modern", "visual-minimal")
                else pymupdf.Rect(42, 40, 90, 88)
            )
            first_page.insert_image(rect, stream=photo_bytes)

    out_bytes = pdf_doc.tobytes(garbage=3, deflate=True)
    pdf_doc.close()
    return io.BytesIO(out_bytes), None
