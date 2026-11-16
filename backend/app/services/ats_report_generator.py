import html
import io
from datetime import datetime
from typing import Any

import pymupdf
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor

A4_WIDTH = 595.0
A4_HEIGHT = 842.0

COLOR_INDIGO = RGBColor(67, 56, 202)
COLOR_DARK = RGBColor(30, 41, 59)
COLOR_MUTED = RGBColor(100, 116, 139)
COLOR_GREEN = RGBColor(4, 120, 87)
COLOR_AMBER = RGBColor(180, 83, 9)


def generate_ats_report_docx(analysis: dict[str, Any], resume_title: str = "Resume") -> io.BytesIO:
    """
    Menghasilkan dokumen Microsoft Word (.docx) laporan resmi evaluasi keterbacaan format ATS.
    """
    doc = Document()

    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Style standar
    style_normal = doc.styles["Normal"]
    font_normal = style_normal.font
    font_normal.name = "Calibri"
    font_normal.size = Pt(10)
    font_normal.color.rgb = COLOR_DARK

    # 1. Judul Laporan
    p_title = doc.add_paragraph()
    run_title = p_title.add_run("LAPORAN EVALUASI KETERBACAAN ATS")
    run_title.bold = True
    run_title.font.size = Pt(18)
    run_title.font.color.rgb = COLOR_INDIGO
    p_title.paragraph_format.space_after = Pt(2)

    # Subjudul Dokumen
    now_str = datetime.now().strftime("%d %B %Y, %H:%M")
    p_sub = doc.add_paragraph()
    run_sub = p_sub.add_run(
        f"Dokumen: {resume_title}  |  Dihasilkan: {now_str}  |  Beresin by Satukit"
    )
    run_sub.font.size = Pt(9)
    run_sub.font.color.rgb = COLOR_MUTED
    p_sub.paragraph_format.space_after = Pt(14)

    # 2. Ringkasan Skor Keseluruhan
    score = analysis.get("score", 0)
    grade = analysis.get("grade", "D")
    passed_count = analysis.get("passedChecksCount", 0)
    total_count = analysis.get("totalChecksCount", 0)

    p_score_card = doc.add_paragraph()
    p_score_card.paragraph_format.space_before = Pt(6)
    p_score_card.paragraph_format.space_after = Pt(10)
    run_score_label = p_score_card.add_run(f"SKOR TOTAL: {score} / 100   —   GRADE: {grade}\n")
    run_score_label.bold = True
    run_score_label.font.size = Pt(13)
    run_score_label.font.color.rgb = COLOR_INDIGO

    run_summary_text = p_score_card.add_run(
        f"Status: {passed_count} dari {total_count} indikator keterbacaan lolos uji evaluasi."
    )
    run_summary_text.font.size = Pt(9.5)

    def add_section_header(title: str):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(title.upper())
        run.bold = True
        run.font.size = Pt(11)
        run.font.color.rgb = COLOR_INDIGO
        return p

    # 3. Rincian 5 Pilar Penilaian
    add_section_header("1. Rincian Skor 5 Pilar Penilaian")
    breakdown = analysis.get("breakdown", {})

    table_breakdown = doc.add_table(rows=1, cols=3)
    table_breakdown.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr_cells = table_breakdown.rows[0].cells
    hdr_cells[0].text = "Pilar Struktur"
    hdr_cells[1].text = "Skor Tercapai"
    hdr_cells[2].text = "Bobot Maksimum"

    # Styling header tabel
    for cell in hdr_cells:
        for p in cell.paragraphs:
            p.runs[0].bold = True
            p.runs[0].font.size = Pt(9.5)

    rows_data = [
        ("Kelengkapan Informasi Kontak", f"{breakdown.get('contact', 0)} poin", "25 poin"),
        ("Kelengkapan Struktur Bagian Inti", f"{breakdown.get('structure', 0)} poin", "25 poin"),
        ("Kepadatan & Kualitas Ringkasan", f"{breakdown.get('summary', 0)} poin", "20 poin"),
        ("Pengukuran Dampak & Metrik", f"{breakdown.get('quantified_impact', 0)} poin", "20 poin"),
        ("Integritas Konten & Anti-Stuffing", f"{breakdown.get('integrity', 0)} poin", "10 poin"),
    ]

    for item, actual, max_pts in rows_data:
        row = table_breakdown.add_row().cells
        row[0].text = item
        row[1].text = actual
        row[2].text = max_pts
        for cell in row:
            for p in cell.paragraphs:
                p.runs[0].font.size = Pt(9)

    # 4. Rekomendasi Tindakan Prioritas
    recommendations = analysis.get("recommendations", [])
    if recommendations:
        add_section_header("2. Rekomendasi Tindakan Prioritas")
        for rec in recommendations:
            p_rec = doc.add_paragraph(style="List Bullet")
            p_rec.paragraph_format.space_after = Pt(2)
            run_rec = p_rec.add_run(rec)
            run_rec.font.size = Pt(9)
    else:
        add_section_header("2. Rekomendasi Tindakan Prioritas")
        p_rec = doc.add_paragraph()
        run_rec = p_rec.add_run(
            "Selamat! Dokumen Anda telah memenuhi seluruh kriteria dasar format ATS."
        )
        run_rec.font.size = Pt(9)
        run_rec.font.color.rgb = COLOR_GREEN

    # 5. Checklist Indikator Detail
    checklist = analysis.get("checklist", [])
    if checklist:
        add_section_header("3. Status Checklist Indikator")
        table_chk = doc.add_table(rows=1, cols=4)
        table_chk.alignment = WD_TABLE_ALIGNMENT.CENTER
        chk_hdrs = table_chk.rows[0].cells
        chk_hdrs[0].text = "Kategori"
        chk_hdrs[1].text = "Indikator Pemeriksaan"
        chk_hdrs[2].text = "Status"
        chk_hdrs[3].text = "Catatan Panduan"

        for cell in chk_hdrs:
            for p in cell.paragraphs:
                p.runs[0].bold = True
                p.runs[0].font.size = Pt(9)

        for item in checklist:
            row = table_chk.add_row().cells
            row[0].text = item.get("category", "")
            row[1].text = item.get("item", "")
            status_text = "LOLOS" if item.get("passed") else "PERLU CEK"
            row[2].text = status_text
            row[3].text = item.get("tip", "")

            # Set ukuran font
            for idx, cell in enumerate(row):
                for p in cell.paragraphs:
                    p.runs[0].font.size = Pt(8.5)
                    if idx == 2:
                        p.runs[0].bold = True
                        is_pass = item.get("passed", False)
                        p.runs[0].font.color.rgb = COLOR_GREEN if is_pass else COLOR_AMBER

    # 6. Disclaimer Resmi
    p_disc = doc.add_paragraph()
    p_disc.paragraph_format.space_before = Pt(18)
    run_disc_hdr = p_disc.add_run("Catatan Penafian (Disclaimer):\n")
    run_disc_hdr.bold = True
    run_disc_hdr.font.size = Pt(8.5)
    run_disc = p_disc.add_run(
        analysis.get(
            "disclaimer",
            "Skor ATS bersifat heuristik untuk mengevaluasi keterbacaan format mesin "
            "dan bukan merupakan jaminan penerimaan kerja pada proses rekrutmen.",
        )
    )
    run_disc.font.size = Pt(8)
    run_disc.font.color.rgb = COLOR_MUTED

    out = io.BytesIO()
    doc.save(out)
    out.seek(0)
    return out


def _esc(val: Any) -> str:
    return html.escape(str(val or ""), quote=False)


def generate_ats_report_pdf(
    analysis: dict[str, Any], resume_title: str = "Resume"
) -> tuple[io.BytesIO | None, str | None]:
    """
    Merender laporan evaluasi ATS secara langsung menjadi berkas PDF menggunakan PyMuPDF.
    """
    now_str = datetime.now().strftime("%d %B %Y, %H:%M")
    score = analysis.get("score", analysis.get("overall_score", 0))
    grade = analysis.get("grade", "D")
    passed_count = analysis.get("passedChecksCount", 0)
    total_count = analysis.get("totalChecksCount", 0)
    breakdown = analysis.get("breakdown", {}) if isinstance(analysis.get("breakdown"), dict) else {}
    recommendations = (
        analysis.get("recommendations", [])
        if isinstance(analysis.get("recommendations"), list)
        else []
    )
    checklist = analysis.get("checklist", []) if isinstance(analysis.get("checklist"), list) else []
    disclaimer = analysis.get(
        "disclaimer",
        "Skor ATS bersifat heuristik untuk mengevaluasi keterbacaan format mesin "
        "dan bukan merupakan jaminan penerimaan kerja pada proses rekrutmen.",
    )

    pilar_rows = [
        ("Kelengkapan Informasi Kontak", f"{breakdown.get('contact', 0)} poin", "25 poin"),
        ("Kelengkapan Struktur Bagian Inti", f"{breakdown.get('structure', 0)} poin", "25 poin"),
        ("Kepadatan & Kualitas Ringkasan", f"{breakdown.get('summary', 0)} poin", "20 poin"),
        ("Pengukuran Dampak & Metrik", f"{breakdown.get('quantified_impact', 0)} poin", "20 poin"),
        ("Integritas Konten & Anti-Stuffing", f"{breakdown.get('integrity', 0)} poin", "10 poin"),
    ]
    pilar_html = "".join(
        f"<tr><td style='padding:3pt;'>{_esc(name)}</td>"
        f"<td style='padding:3pt;'>{_esc(actual)}</td>"
        f"<td style='padding:3pt;'>{_esc(max_pts)}</td></tr>"
        for name, actual, max_pts in pilar_rows
    )

    if recommendations:
        rec_html = (
            "<ul>"
            + "".join(f"<li>{_esc(rec)}</li>" for rec in recommendations if str(rec).strip())
            + "</ul>"
        )
    else:
        rec_html = (
            "<p style='color:#047857;'>"
            "Selamat! Dokumen Anda telah memenuhi seluruh kriteria dasar format ATS.</p>"
        )

    h2_style = "color:#4338ca;font-size:11pt;margin:10pt 0 4pt 0;"
    tbl_style = "font-size:8.5pt;border-color:#cbd5e1;width:100%;"
    chk_rows_html = ""
    if checklist:
        chk_rows = []
        for item in checklist:
            if not isinstance(item, dict):
                continue
            cat = _esc(item.get("category", ""))
            ind = _esc(item.get("item") or item.get("label") or "")
            is_pass = bool(item.get("passed"))
            status_text = "LOLOS" if is_pass else "PERLU CEK"
            status_color = "#047857" if is_pass else "#b45309"
            tip = _esc(item.get("tip") or item.get("message") or "")
            chk_rows.append(
                f"<tr><td style='padding:3pt;'>{cat}</td>"
                f"<td style='padding:3pt;'>{ind}</td>"
                f"<td style='padding:3pt;color:{status_color};font-weight:bold;'>{status_text}</td>"
                f"<td style='padding:3pt;'>{tip}</td></tr>"
            )
        chk_rows_html = f"""
        <h2 style="{h2_style}">3. STATUS CHECKLIST INDIKATOR</h2>
        <table border="1" cellspacing="0" cellpadding="3" style="{tbl_style}">
            <tr style="background-color:#f8fafc;font-weight:bold;">
                <td>Kategori</td>
                <td>Indikator Pemeriksaan</td>
                <td>Status</td>
                <td>Catatan Panduan</td>
            </tr>
            {"".join(chk_rows)}
        </table>
        """

    score_line = f"SKOR TOTAL: {_esc(score)} / 100   —   GRADE: {_esc(grade)}"
    status_line = (
        f"Status: {_esc(passed_count)} dari {_esc(total_count)} "
        "indikator keterbacaan lolos uji evaluasi."
    )
    html_doc = f"""
    <html>
    <body style="font-family:sans-serif;font-size:9.5pt;color:#1e293b;line-height:1.35;">
        <h1 style="color:#4338ca;font-size:17pt;margin:0 0 2pt 0;">
            LAPORAN EVALUASI KETERBACAAN ATS
        </h1>
        <p style="color:#64748b;font-size:8.5pt;margin:0 0 10pt 0;">
            Dokumen: {_esc(resume_title)}  |  Dihasilkan: {_esc(now_str)}  |  Beresin by Satukit
        </p>
        <p style="margin:4pt 0 8pt 0;">
            <b style="color:#4338ca;font-size:12pt;">{score_line}</b><br/>
            <span>{status_line}</span>
        </p>
        <h2 style="{h2_style}">1. RINCIAN SKOR 5 PILAR PENILAIAN</h2>
        <table border="1" cellspacing="0" cellpadding="3" style="{tbl_style}">
            <tr style="background-color:#f8fafc;font-weight:bold;">
                <td>Pilar Struktur</td>
                <td>Skor Tercapai</td>
                <td>Bobot Maksimum</td>
            </tr>
            {pilar_html}
        </table>
        <h2 style="{h2_style}">2. REKOMENDASI TINDAKAN PRIORITAS</h2>
        {rec_html}
        {chk_rows_html}
        <p style="color:#64748b;font-size:8pt;margin-top:14pt;">
            <b>Catatan Penafian (Disclaimer):</b><br/>
            {_esc(disclaimer)}
        </p>
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

    pdf_doc = pymupdf.open("pdf", buf.getvalue())
    out_bytes = pdf_doc.tobytes(garbage=3, deflate=True)
    pdf_doc.close()
    return io.BytesIO(out_bytes), None
