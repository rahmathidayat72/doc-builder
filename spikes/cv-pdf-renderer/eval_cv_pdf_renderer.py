"""
Eksperimen Kelayakan (Feasibility Spike) CVR-01:
Evaluasi Direct PDF Renderer (PyMuPDF Story + Canvas) terhadap Canonical Baseline
4 Template Preview Frontend (`ats-clean`, `ats-modern`, `visual-executive`, `visual-minimal`)
serta Laporan Evaluasi ATS (`ats-report`).
"""

from __future__ import annotations

import base64
import html
import io
import statistics
import sys
import time
import tracemalloc
import unicodedata
from pathlib import Path
from typing import Any

import pymupdf
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.services.docx_generator import parse_and_validate_photo

A4_WIDTH = 595.0
A4_HEIGHT = 842.0
TEMPLATE_IDS = ("ats-clean", "ats-modern", "visual-executive", "visual-minimal")


def _make_sample_photo_data_url() -> str:
    img = Image.new("RGB", (120, 120), color=(20, 90, 110))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def build_canonical_resume_payload(template_id: str) -> dict[str, Any]:
    return {
        "title": f"CV Canonical {template_id}",
        "templateId": template_id,
        "colorTheme": "#0f766e",
        "fontFamily": "sans",
        "resumeLanguage": "id",
        "data": {
            "sectionOrder": [
                "summary",
                "experience",
                "education",
                "skills",
                "languages",
                "custom",
            ],
            "contact": {
                "fullName": "Rani Kusuma Putri",
                "headline": "Senior Product & Document Systems Engineer",
                "email": "rani.putri@example.id",
                "phone": "+62 812-3456-7890",
                "location": "Jakarta, Indonesia",
                "linkedin": "linkedin.com/in/ranikusuma",
                "website": "https://ranikusuma.dev",
                "websites": [
                    "https://ranikusuma.dev",
                    "https://github.com/ranikusuma",
                ],
                "usePhoto": True,
                "photoUrl": _make_sample_photo_data_url(),
            },
            "summary": (
                "Insinyur perangkat lunak dengan pengalaman 7+ tahun membangun sistem pemrosesan "
                "dokumen berkinerja tinggi dan arsitektur web hemat sumber daya."
            ),
            "experiences": [
                {
                    "id": "exp-1",
                    "jobTitle": "Lead Document Engineer",
                    "company": "PT Nusantara Digital",
                    "location": "Jakarta",
                    "startDate": "2022-01",
                    "endDate": "",
                    "current": True,
                    "achievements": [
                        "Menurunkan konsumsi RAM konversi PDF sebesar 78% pada VPS 1 vCPU.",
                        "Meningkatkan akurasi pencocokan ATS lintas 4 template menjadi 99%.",
                    ],
                },
                {
                    "id": "exp-2",
                    "jobTitle": "Backend Software Engineer",
                    "company": "CV Karya Mandiri",
                    "location": "Bandung",
                    "startDate": "2019-06",
                    "endDate": "2021-12",
                    "current": False,
                    "description": (
                        "Merancang layanan REST API Python/FastAPI dan integrasi PostgreSQL."
                    ),
                },
            ],
            "education": [
                {
                    "id": "edu-1",
                    "institution": "Institut Teknologi Bandung",
                    "degree": "Sarjana Teknik Informatika",
                    "fieldOfStudy": "Rekayasa Perangkat Lunak",
                    "startDate": "2015",
                    "endDate": "2019",
                    "gpa": "3.85/4.00",
                    "description": "Fokus riset optimasi sistem terdistribusi.",
                }
            ],
            "skills": [
                {"id": "sk-1", "name": "Python", "level": "Expert"},
                {"id": "sk-2", "name": "FastAPI", "level": "Expert"},
                {"id": "sk-3", "name": "PostgreSQL", "level": "Advanced"},
                {"id": "sk-4", "name": "TypeScript", "level": "Advanced"},
            ],
            "languages": [
                {"id": "lg-1", "language": "Bahasa Indonesia", "proficiency": "Native"},
                {"id": "lg-2", "language": "English", "proficiency": "Professional"},
            ],
            "customSections": [
                {
                    "id": "cs-1",
                    "title": "Sertifikasi & Penghargaan",
                    "items": [
                        {
                            "id": "csi-1",
                            "label": "AWS Certified Developer",
                            "value": "2024 <script>alert('xss')</script>",
                        }
                    ],
                }
            ],
        },
    }


def _hex_to_rgb_norm(hex_color: str) -> tuple[float, float, float]:
    clean = hex_color.lstrip("#")
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


def _esc(val: Any) -> str:
    return html.escape(str(val or ""), quote=False)


def _format_exp_bullets(exp: dict[str, Any]) -> str:
    achievements = exp.get("achievements")
    lines: list[str] = []
    if isinstance(achievements, list) and achievements:
        lines = [str(a).strip() for a in achievements if str(a).strip()]
    elif exp.get("description"):
        lines = [
            line.strip("•- \t")
            for line in str(exp["description"]).splitlines()
            if line.strip()
        ]
    if not lines:
        return ""
    items_html = "".join(f"<li>{_esc(line)}</li>" for line in lines)
    return f"<ul>{items_html}</ul>"


def _build_single_column_html(resume: dict[str, Any], template_id: str) -> str:
    data = resume.get("data", {})
    contact = data.get("contact", {})
    accent = _esc(resume.get("colorTheme") or "#1e293b")
    section_order = data.get("sectionOrder") or [
        "summary",
        "experience",
        "education",
        "skills",
        "languages",
        "custom",
    ]

    websites = contact.get("websites") or (
        [contact.get("website")] if contact.get("website") else []
    )
    contact_parts = [
        p
        for p in [
            contact.get("email"),
            contact.get("phone"),
            contact.get("location"),
            contact.get("linkedin"),
            *websites,
        ]
        if p
    ]
    sep = " • " if template_id == "visual-minimal" else " | "
    contact_line = sep.join(_esc(p) for p in contact_parts)

    header_align = "center" if template_id == "ats-clean" else "left"
    h2_style = (
        f"color:{accent};border-bottom:1pt solid #cbd5e1;text-transform:uppercase;font-size:10pt;"
        if template_id == "ats-clean"
        else (
            f"color:{accent};border-left:3pt solid {accent};padding-left:5pt;"
            "text-transform:uppercase;font-size:10pt;"
            if template_id == "ats-modern"
            else "color:#64748b;text-transform:uppercase;letter-spacing:1.5pt;font-size:8.5pt;"
        )
    )

    sections_map: dict[str, str] = {}
    if data.get("summary"):
        heading = (
            "TENTANG" if template_id == "visual-minimal" else "RINGKASAN PROFESIONAL"
        )
        sections_map["summary"] = (
            f"<h2 style='{h2_style}'>{heading}</h2><p>{_esc(data['summary'])}</p>"
        )

    if data.get("experiences"):
        exp_blocks = []
        for exp in data["experiences"]:
            end_label = "Sekarang" if exp.get("current") else _esc(exp.get("endDate"))
            period = f"{_esc(exp.get('startDate'))} - {end_label}"
            exp_blocks.append(
                f"<div><b>{_esc(exp.get('jobTitle'))}</b> ({period})<br/>"
                f"<i>{_esc(exp.get('company'))} | {_esc(exp.get('location'))}</i>"
                f"{_format_exp_bullets(exp)}</div>"
            )
        heading = (
            "PENGALAMAN" if template_id == "visual-minimal" else "PENGALAMAN KERJA"
        )
        sections_map["experience"] = f"<h2 style='{h2_style}'>{heading}</h2>" + "".join(
            exp_blocks
        )

    if data.get("education"):
        edu_blocks = []
        for edu in data["education"]:
            gpa_str = f" (IPK: {_esc(edu.get('gpa'))})" if edu.get("gpa") else ""
            desc_str = (
                f"<br/><span>{_esc(edu.get('description'))}</span>"
                if edu.get("description")
                else ""
            )
            edu_blocks.append(
                f"<p><b>{_esc(edu.get('institution'))}</b> — {_esc(edu.get('degree'))} "
                f"dalam {_esc(edu.get('fieldOfStudy'))}{gpa_str} "
                f"[{_esc(edu.get('startDate'))} - {_esc(edu.get('endDate'))}]{desc_str}</p>"
            )
        sections_map["education"] = f"<h2 style='{h2_style}'>PENDIDIKAN</h2>" + "".join(
            edu_blocks
        )

    if data.get("skills"):
        sk_list = ", ".join(
            f"{_esc(s.get('name'))} ({_esc(s.get('level'))})"
            if s.get("level")
            else _esc(s.get("name"))
            for s in data["skills"]
        )
        sections_map["skills"] = f"<h2 style='{h2_style}'>KEAHLIAN</h2><p>{sk_list}</p>"

    if data.get("languages"):
        lg_list = ", ".join(
            f"{_esc(l.get('language'))} ({_esc(l.get('proficiency'))})"
            for l in data["languages"]
        )
        sections_map["languages"] = (
            f"<h2 style='{h2_style}'>BAHASA</h2><p>{lg_list}</p>"
        )

    if data.get("customSections"):
        c_blocks = []
        for sec in data["customSections"]:
            items = "".join(
                f"<li><b>{_esc(it.get('label'))}:</b> {_esc(it.get('value'))}</li>"
                for it in sec.get("items", [])
            )
            sec_title = _esc(str(sec.get("title") or "").upper())
            c_blocks.append(f"<h2 style='{h2_style}'>{sec_title}</h2><ul>{items}</ul>")
        sections_map["custom"] = "".join(c_blocks)

    ordered_body = "".join(sections_map[k] for k in section_order if k in sections_map)
    full_name = _esc(str(contact.get("fullName", "Nama Lengkap")).upper())
    headline = _esc(contact.get("headline"))
    return f"""
    <html>
    <body style="font-family:sans-serif;font-size:9.5pt;color:#1e293b;line-height:1.35;">
        <div style="text-align:{header_align};border-bottom:1.5pt solid {accent};padding-bottom:6pt;margin-bottom:8pt;">
            <h1 style="color:{accent};font-size:18pt;margin:0;">{full_name}</h1>
            <p style="margin:2pt 0;font-weight:bold;color:#475569;">{headline}</p>
            <p style="margin:2pt 0;font-size:8.5pt;color:#64748b;">{contact_line}</p>
        </div>
        {ordered_body}
    </body>
    </html>
    """


def render_resume_pdf_direct(resume: dict[str, Any]) -> bytes:
    """Merender payload CV menjadi PDF biner secara langsung sesuai templateId."""
    template_id = str(resume.get("templateId") or "ats-clean")
    data = resume.get("data", {})
    contact = data.get("contact", {})
    accent_hex = str(resume.get("colorTheme") or "#1e293b")
    accent_rgb = _hex_to_rgb_norm(accent_hex)

    photo_bytes: bytes | None = None
    if contact.get("usePhoto") and contact.get("photoUrl"):
        photo_bytes = parse_and_validate_photo(contact["photoUrl"]).getvalue()

    if template_id == "visual-executive":
        return _render_visual_executive_pdf(resume, accent_hex, accent_rgb, photo_bytes)

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

    out = pdf_doc.tobytes(garbage=3, deflate=True)
    pdf_doc.close()
    return out


def _render_visual_executive_pdf(
    resume: dict[str, Any],
    accent_hex: str,
    accent_rgb: tuple[float, float, float],
    photo_bytes: bytes | None,
) -> bytes:
    """Merender tata letak 2-kolom Visual Executive (Sidebar Kiri 35% + Kolom Utama Kanan 65%)."""
    data = resume.get("data", {})
    contact = data.get("contact", {})
    accent = _esc(accent_hex)
    websites = contact.get("websites") or (
        [contact.get("website")] if contact.get("website") else []
    )
    edu_sidebar = "".join(
        f"<p><b>{_esc(e.get('degree'))}</b><br/>{_esc(e.get('institution'))}<br/>"
        f"{_esc(e.get('startDate'))}-{_esc(e.get('endDate'))} (IPK: {_esc(e.get('gpa'))})<br/>"
        f"{_esc(e.get('description'))}</p>"
        for e in data.get("education", [])
    )
    lang_sidebar = "<br/>".join(
        f"{_esc(l.get('language'))}: {_esc(l.get('proficiency'))}"
        for l in data.get("languages", [])
    )
    web_sidebar = "<br/>".join(_esc(u) for u in websites if u)

    sidebar_html = f"""
    <html>
    <body style="font-family:sans-serif;font-size:8.5pt;color:#1e293b;line-height:1.35;">
        <h3 style="color:{accent};border-bottom:1pt solid {accent};">KONTAK</h3>
        <p>{_esc(contact.get("email"))}<br/>{_esc(contact.get("phone"))}<br/>
        {_esc(contact.get("location"))}<br/>{_esc(contact.get("linkedin"))}<br/>
        {web_sidebar}</p>
        <h3 style="color:{accent};border-bottom:1pt solid {accent};">PENDIDIKAN</h3>
        {edu_sidebar}
        <h3 style="color:{accent};border-bottom:1pt solid {accent};">KEAHLIAN</h3>
        <p>{", ".join(_esc(s.get("name")) for s in data.get("skills", []))}</p>
        <h3 style="color:{accent};border-bottom:1pt solid {accent};">BAHASA</h3>
        <p>{lang_sidebar}</p>
        <p style="color:#64748b;font-size:7.5pt;">Satukit Executive</p>
    </body>
    </html>
    """

    exp_main = "".join(
        f"<div><b>{_esc(exp.get('jobTitle'))}</b> "
        f"({_esc(exp.get('startDate'))} - {'Sekarang' if exp.get('current') else _esc(exp.get('endDate'))})<br/>"
        f"<i>{_esc(exp.get('company'))} | {_esc(exp.get('location'))}</i>"
        f"{_format_exp_bullets(exp)}</div>"
        for exp in data.get("experiences", [])
    )
    custom_main = "".join(
        f"<h2 style='color:{accent};font-size:10pt;'>{_esc(str(sec.get('title') or '').upper())}</h2><ul>"
        + "".join(
            f"<li><b>{_esc(it.get('label'))}:</b> {_esc(it.get('value'))}</li>"
            for it in sec.get("items", [])
        )
        + "</ul>"
        for sec in data.get("customSections", [])
    )
    full_name = _esc(str(contact.get("fullName", "Nama Lengkap")).upper())
    headline = _esc(contact.get("headline"))

    main_html = f"""
    <html>
    <body style="font-family:sans-serif;font-size:9.5pt;color:#1e293b;line-height:1.35;">
        <h1 style="color:{accent};font-size:18pt;margin:0;">{full_name}</h1>
        <p style="font-weight:bold;color:#475569;margin-top:2pt;">{headline}</p>
        <h2 style="color:{accent};font-size:10pt;">PROFIL PROFESIONAL</h2>
        <p>{_esc(data.get("summary"))}</p>
        <h2 style="color:{accent};font-size:10pt;">PENGALAMAN KERJA</h2>
        {exp_main}
        {custom_main}
    </body>
    </html>
    """

    buf = io.BytesIO()
    writer = pymupdf.DocumentWriter(buf)
    story_left = pymupdf.Story(html=sidebar_html)
    story_right = pymupdf.Story(html=main_html)
    mediabox = pymupdf.Rect(0, 0, A4_WIDTH, A4_HEIGHT)
    sidebar_width = A4_WIDTH * 0.34
    left_rect = pymupdf.Rect(
        24, 96 if photo_bytes else 36, sidebar_width - 14, A4_HEIGHT - 36
    )
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


def render_ats_report_pdf_direct(analysis: dict[str, Any], resume_title: str) -> bytes:
    """Merender laporan evaluasi ATS secara langsung ke PDF tanpa LibreOffice."""
    score = int(analysis.get("score", analysis.get("overall_score", 0)))
    checklist = analysis.get("checklist", [])
    recommendations = analysis.get("recommendations", [])

    items_html = "".join(
        f"<li><b>[{'LULUS' if c.get('passed') else 'PERLU PERBAIKAN'}] {_esc(c.get('label'))}:</b> "
        f"{_esc(c.get('message'))}</li>"
        for c in checklist
    )
    rec_html = "".join(f"<li>{_esc(r)}</li>" for r in recommendations)

    html_doc = f"""
    <html>
    <body style="font-family:sans-serif;font-size:10pt;color:#1e293b;line-height:1.4;">
        <h1 style="color:#0f766e;margin-bottom:2pt;">LAPORAN EVALUASI STRUKTUR ATS</h1>
        <p style="color:#475569;margin-top:0;">Dokumen: <b>{_esc(resume_title)}</b> | Skor Kepatuhan: <b>{score}/100</b></p>
        <hr/>
        <h2 style="color:#0f766e;font-size:11pt;">1. Checklist Kepatuhan Struktur</h2>
        <ul>{items_html}</ul>
        <h2 style="color:#0f766e;font-size:11pt;">2. Rekomendasi Perbaikan</h2>
        <ul>{rec_html}</ul>
    </body>
    </html>
    """
    buf = io.BytesIO()
    writer = pymupdf.DocumentWriter(buf)
    story = pymupdf.Story(html=html_doc)
    mediabox = pymupdf.Rect(0, 0, A4_WIDTH, A4_HEIGHT)
    body_rect = pymupdf.Rect(42, 42, A4_WIDTH - 42, A4_HEIGHT - 42)
    more = True
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(body_rect)
        story.draw(device)
        writer.end_page()
    writer.close()
    return buf.getvalue()


def run_spike_evaluation() -> dict[str, Any]:
    tracemalloc.start()
    results: dict[str, Any] = {"templates": {}}

    for tpl_id in TEMPLATE_IDS:
        payload = build_canonical_resume_payload(tpl_id)
        latencies_ms: list[float] = []
        pdf_bytes = b""
        for _ in range(5):
            t0 = time.perf_counter()
            pdf_bytes = render_resume_pdf_direct(payload)
            latencies_ms.append((time.perf_counter() - t0) * 1000.0)

        assert pdf_bytes.startswith(b"%PDF-"), f"{tpl_id}: header PDF tidak valid"
        doc = pymupdf.open("pdf", pdf_bytes)
        assert len(doc) >= 1, f"{tpl_id}: halaman kosong"
        rect = doc[0].rect
        assert abs(rect.width - A4_WIDTH) < 1.0 and abs(rect.height - A4_HEIGHT) < 1.0
        full_text = unicodedata.normalize(
            "NFKC", "\n".join(p.get_text("text") for p in doc)
        )
        normalized_text = " ".join(full_text.split())
        compact_text = full_text.replace("\n", "")

        for expected_token in (
            "RANI KUSUMA PUTRI",
            "Senior Product & Document Systems Engineer",
            "rani.putri@example.id",
            "https://github.com/ranikusuma",
            "Lead Document Engineer",
            "Menurunkan konsumsi RAM konversi PDF sebesar 78%",
            "Institut Teknologi Bandung",
            "3.85/4.00",
            "FastAPI",
            "Bahasa Indonesia",
            "AWS Certified Developer",
        ):
            assert (
                expected_token in normalized_text or expected_token in compact_text
            ), f"{tpl_id}: token hilang -> {expected_token}"

        assert "2024 <script>alert('xss')</script>" in normalized_text

        if tpl_id == "visual-executive":
            assert "Satukit Executive" in normalized_text
            drawings = doc[0].get_drawings()
            assert len(drawings) >= 1, (
                "visual-executive wajib memiliki drawing sidebar 2-kolom"
            )
        elif tpl_id == "visual-minimal":
            assert "TENTANG" in normalized_text and "PENGALAMAN" in normalized_text

        doc.close()
        results["templates"][tpl_id] = {
            "avg_ms": round(statistics.mean(latencies_ms), 2),
            "max_ms": round(max(latencies_ms), 2),
            "size_bytes": len(pdf_bytes),
        }

    sample_analysis = {
        "score": 92,
        "checklist": [
            {
                "label": "Informasi Kontak",
                "passed": True,
                "message": "Email & telepon lengkap.",
            },
            {
                "label": "Kuantifikasi Capaian",
                "passed": True,
                "message": "Terdapat metrik %.",
            },
        ],
        "recommendations": [
            "Pertahankan kata kerja aktif pada setiap pengalaman kerja."
        ],
    }
    t0 = time.perf_counter()
    ats_pdf = render_ats_report_pdf_direct(sample_analysis, "CV Rani Kusuma")
    ats_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    assert ats_pdf.startswith(b"%PDF-")
    ats_doc = pymupdf.open("pdf", ats_pdf)
    ats_text = ats_doc[0].get_text("text")
    assert "LAPORAN EVALUASI STRUKTUR ATS" in ats_text
    assert "92/100" in ats_text
    ats_doc.close()

    _, peak_bytes = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    peak_mib = round(peak_bytes / (1024 * 1024), 2)
    assert peak_mib < 50.0, f"Peak heap terlalu besar: {peak_mib} MiB"

    results["ats_report"] = {"latency_ms": ats_ms, "size_bytes": len(ats_pdf)}
    results["peak_heap_mib"] = peak_mib
    return results


if __name__ == "__main__":
    summary = run_spike_evaluation()
    print("SPIKE CVR-01 PASS:", summary)
