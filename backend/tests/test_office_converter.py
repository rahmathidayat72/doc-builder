import io
import sys
from pathlib import Path
from unittest.mock import patch

import openpyxl
import pymupdf
import pytest
from fastapi.testclient import TestClient
from openpyxl.styles import Border, Font, PatternFill, Side
from openpyxl.worksheet.pagebreak import Break
from pptx import Presentation

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.api.health import detect_libreoffice
from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app
from app.services.libreoffice import convert_bytes_to_format_sandboxed
from app.services.office_converter import (
    OLE_MAGIC_BYTES,
    convert_presentation_to_pdf_sandboxed,
    convert_spreadsheet_to_pdf_sandboxed,
    normalize_spreadsheet_workbook_bytes,
    validate_presentation_magic_bytes,
    validate_spreadsheet_magic_bytes,
)

client = TestClient(app)


def auth_headers() -> dict[str, str]:
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    return {
        CSRF_HEADER_NAME: session_manager.csrf_token,
        "Origin": "http://localhost:5173",
    }


def make_dummy_pptx_bytes() -> bytes:
    prs = Presentation()
    prs.slides.add_slide(prs.slide_layouts[6])
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def make_dummy_xlsx_bytes() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.cell(row=1, column=1, value="Test")
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def make_test_pdf_bytes(page_count: int = 2) -> bytes:
    doc = pymupdf.open()
    for i in range(page_count):
        page = doc.new_page(width=600, height=800)
        page.insert_text((50, 50), f"Page {i + 1} Content")
    data = doc.tobytes()
    doc.close()
    return data


def make_pdf_with_table_bytes() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=600, height=800)
    # Draw table border lines
    for x in [50, 150, 250]:
        page.draw_line((x, 50), (x, 110))
    for y in [50, 80, 110]:
        page.draw_line((50, y), (250, y))
    page.insert_text((60, 70), "Header1")
    page.insert_text((160, 70), "Header2")
    page.insert_text((60, 100), "Value1")
    page.insert_text((160, 100), "=cmd|' /C calc'!A0")  # Formula injection payload
    data = doc.tobytes()
    doc.close()
    return data


# --- VALIDATION TESTS ---


def test_validate_presentation_magic_bytes():
    pptx_bytes = make_dummy_pptx_bytes()
    assert validate_presentation_magic_bytes(pptx_bytes, "demo.pptx") is True
    assert validate_presentation_magic_bytes(OLE_MAGIC_BYTES + b"\x00" * 10, "demo.ppt") is True
    assert validate_presentation_magic_bytes(b"INVALID_HEADER", "demo.pptx") is False
    assert validate_presentation_magic_bytes(pptx_bytes, "demo.txt") is False


def test_validate_spreadsheet_magic_bytes():
    xlsx_bytes = make_dummy_xlsx_bytes()
    assert validate_spreadsheet_magic_bytes(xlsx_bytes, "report.xlsx") is True
    assert validate_spreadsheet_magic_bytes(OLE_MAGIC_BYTES + b"\x00" * 10, "report.xls") is True
    assert validate_spreadsheet_magic_bytes(b"INVALID_HEADER", "report.xlsx") is False
    assert validate_spreadsheet_magic_bytes(xlsx_bytes, "report.doc") is False


def test_convert_office_services_reject_corrupt_bytes():
    with pytest.raises(ValueError, match="tidak valid"):
        convert_presentation_to_pdf_sandboxed(b"CORRUPT", "slide.pptx")

    with pytest.raises(ValueError, match="tidak valid"):
        convert_spreadsheet_to_pdf_sandboxed(b"CORRUPT", "sheet.xlsx")


# --- PRESENTATION TO PDF TESTS ---


def test_convert_presentation_endpoint_accessible_without_auth():
    files = {"file": ("demo.pptx", make_dummy_pptx_bytes(), "application/vnd.openxmlformats")}
    response = client.post("/api/converter/presentation-to-pdf", files=files)
    assert response.status_code not in (401, 403)


def test_convert_presentation_endpoint_rejects_wrong_extension():
    files = {"file": ("demo.pdf", b"%PDF-1.4 dummy", "application/pdf")}
    response = client.post(
        "/api/converter/presentation-to-pdf", files=files, headers=auth_headers()
    )
    assert response.status_code == 400
    assert "Harap unggah berkas .pptx atau .ppt" in response.json()["detail"]


def test_convert_presentation_endpoint_libreoffice_handling():
    with patch("app.services.office_converter.detect_libreoffice", return_value=(False, None)):
        files = {
            "file": (
                "demo.pptx",
                make_dummy_pptx_bytes(),
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            )
        }
        response = client.post(
            "/api/converter/presentation-to-pdf", files=files, headers=auth_headers()
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error_code"] == "LIBREOFFICE_NOT_FOUND"
        assert "LibreOffice belum terpasang" in data["message"]


# --- SPREADSHEET TO PDF TESTS ---


def test_convert_spreadsheet_endpoint_accessible_without_auth():
    files = {"file": ("data.xlsx", make_dummy_xlsx_bytes(), "application/vnd.openxmlformats")}
    response = client.post("/api/converter/spreadsheet-to-pdf", files=files)
    assert response.status_code not in (401, 403)


def test_convert_spreadsheet_endpoint_rejects_wrong_extension():
    files = {"file": ("data.docx", b"PK\x03\x04dummy", "application/vnd.openxmlformats")}
    response = client.post("/api/converter/spreadsheet-to-pdf", files=files, headers=auth_headers())
    assert response.status_code == 400
    assert "Harap unggah berkas .xlsx atau .xls" in response.json()["detail"]


def test_convert_spreadsheet_endpoint_libreoffice_handling():
    with patch("app.services.office_converter.detect_libreoffice", return_value=(False, None)):
        files = {
            "file": (
                "data.xlsx",
                make_dummy_xlsx_bytes(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        }
        response = client.post(
            "/api/converter/spreadsheet-to-pdf", files=files, headers=auth_headers()
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error_code"] == "LIBREOFFICE_NOT_FOUND"
        assert "LibreOffice belum terpasang" in data["message"]


def make_messy_xlsx_bytes() -> bytes:
    """Workbook dengan sheet awal kosong, print_area rusak, page break manual, formula, style."""
    wb = openpyxl.Workbook()
    empty_ws = wb.active
    empty_ws.title = "KosongAwal"

    ws = wb.create_sheet("Laporan")
    ws.print_area = "Z80:AB95"
    ws.row_breaks.append(Break(id=1))
    ws.col_breaks.append(Break(id=1))
    ws.page_setup.scale = 45

    thin = Side(style="thin", color="334155")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    header_fill = PatternFill(fill_type="solid", fgColor="D1FAE5")
    header_font = Font(bold=True)

    ws.merge_cells("B2:E2")
    title_cell = ws["B2"]
    title_cell.value = "REKAP PENJUALAN"
    title_cell.font = header_font
    title_cell.fill = header_fill

    headers = ["Produk", "Qty", "Harga", "Total"]
    for offset, title in enumerate(headers):
        cell = ws.cell(row=3, column=2 + offset, value=title)
        cell.font = header_font
        cell.border = border

    ws.cell(row=4, column=2, value="Item A").border = border
    ws.cell(row=4, column=3, value=0).border = border
    ws.cell(row=4, column=4, value=15000).border = border
    ws.cell(row=4, column=5, value="=D4*C4").border = border

    ws.cell(row=5, column=2, value="Item B").border = border
    ws.cell(row=5, column=3, value=3).border = border
    ws.cell(row=5, column=4, value=20000).border = border
    ws.cell(row=5, column=5, value="=C5*D5").border = border

    ws.cell(row=6, column=2, value="Grand Total").font = header_font
    ws.cell(row=6, column=5, value="=SUM(E4:E5)").border = border

    ws.column_dimensions["B"].width = 24.0
    # Simulasikan accidental formatting sangat jauh (kolom 500)
    ws.cell(row=2, column=500).border = border

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def make_formula_tail_xlsx_bytes() -> bytes:
    """Formula nol tersalin jauh ke bawah tanpa data input tidak boleh memperpanjang print area."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "RAB"

    headers = ["Uraian", "Satuan", "Harga (Rp)", "Jumlah (Rp)", "Keterangan"]
    for col, title in enumerate(headers, start=1):
        ws.cell(row=2, column=col, value=title)

    ws.cell(row=3, column=1, value="Pekerjaan A")
    ws.cell(row=3, column=2, value="unit")
    ws.cell(row=3, column=3, value=10000)
    ws.cell(row=3, column=4, value="=C3*1")

    for row in range(4, 204):
        ws.cell(row=row, column=4, value=f"=IF(A{row}=\"\",0,C{row})")

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def make_wide_xlsx_bytes(col_count: int = 10) -> bytes:
    """Workbook tabel lebar dengan banyak kolom untuk menguji orientasi otomatis landscape."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "TabelLebar"
    ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT
    ws.print_area = "A1:C2"

    for col in range(1, col_count + 1):
        col_letter = openpyxl.utils.get_column_letter(col)
        ws.column_dimensions[col_letter].width = 14.0
        ws.cell(row=1, column=col, value=f"Kolom{col:02d}")
        ws.cell(row=2, column=col, value=col * 100)
        ws.cell(row=3, column=col, value=f"Val{col:02d}")

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_normalize_spreadsheet_resets_broken_print_area_breaks_and_hides_empty_sheet():
    normalized = normalize_spreadsheet_workbook_bytes(make_messy_xlsx_bytes())
    wb = openpyxl.load_workbook(io.BytesIO(normalized), data_only=False)
    try:
        assert wb["KosongAwal"].sheet_state == "hidden"
        assert wb.active.title == "Laporan"

        ws = wb["Laporan"]
        assert ws.print_area == "'Laporan'!$B$2:$E$6"
        assert len(ws.row_breaks.brk) == 0
        assert len(ws.col_breaks.brk) == 0
        assert ws.sheet_properties.pageSetUpPr.fitToPage is True
        assert ws.page_setup.fitToWidth == 1
        assert ws.page_setup.fitToHeight == 0
        assert ws.page_setup.scale is None
        assert ws.page_margins.left == pytest.approx(0.4)
        assert ws.page_margins.right == pytest.approx(0.4)
        assert ws.page_margins.top == pytest.approx(0.5)
        assert ws.page_margins.bottom == pytest.approx(0.5)

        # Formula, angka 0, style, merged cells, dan lebar kolom tetap utuh
        assert ws["C4"].value == 0
        assert ws["E4"].value == "=D4*C4"
        assert ws["E6"].value == "=SUM(E4:E5)"
        assert ws["B2"].font.bold is True
        assert ws["B4"].border.left.style == "thin"
        assert "B2:E2" in {str(r) for r in ws.merged_cells.ranges}
        assert ws.column_dimensions["B"].width == pytest.approx(24.0)
    finally:
        wb.close()


def test_normalize_spreadsheet_ignores_zero_formula_tail_without_row_input():
    normalized = normalize_spreadsheet_workbook_bytes(make_formula_tail_xlsx_bytes())
    wb = openpyxl.load_workbook(io.BytesIO(normalized), data_only=False)
    try:
        ws = wb["RAB"]
        assert ws.print_area == "'RAB'!$A$2:$E$3"
        assert ws["D203"].value == '=IF(A203="",0,C203)'
    finally:
        wb.close()


def test_normalize_spreadsheet_auto_and_explicit_orientation():
    narrow_auto = openpyxl.load_workbook(
        io.BytesIO(
            normalize_spreadsheet_workbook_bytes(make_dummy_xlsx_bytes(), orientation="auto")
        )
    )
    assert narrow_auto.active.page_setup.orientation == narrow_auto.active.ORIENTATION_PORTRAIT
    narrow_auto.close()

    narrow_landscape = openpyxl.load_workbook(
        io.BytesIO(
            normalize_spreadsheet_workbook_bytes(make_dummy_xlsx_bytes(), orientation="landscape")
        )
    )
    assert (
        narrow_landscape.active.page_setup.orientation
        == narrow_landscape.active.ORIENTATION_LANDSCAPE
    )
    narrow_landscape.close()

    wide_auto = openpyxl.load_workbook(
        io.BytesIO(
            normalize_spreadsheet_workbook_bytes(make_wide_xlsx_bytes(10), orientation="auto")
        )
    )
    assert wide_auto.active.page_setup.orientation == wide_auto.active.ORIENTATION_LANDSCAPE
    wide_auto.close()

    wide_portrait = openpyxl.load_workbook(
        io.BytesIO(
            normalize_spreadsheet_workbook_bytes(make_wide_xlsx_bytes(10), orientation="portrait")
        )
    )
    assert wide_portrait.active.page_setup.orientation == wide_portrait.active.ORIENTATION_PORTRAIT
    wide_portrait.close()


def test_convert_spreadsheet_xls_preconverts_normalizes_then_renders_pdf():
    messy_xlsx = make_messy_xlsx_bytes()
    captured: dict[str, object] = {}

    def fake_pdf_convert(file_bytes: bytes, filename: str, **_kwargs):
        captured["bytes"] = file_bytes
        captured["filename"] = filename
        return io.BytesIO(b"%PDF-1.4\n%%EOF"), None

    with (
        patch("app.services.office_converter.detect_libreoffice", return_value=(True, "soffice")),
        patch(
            "app.services.office_converter.convert_bytes_to_format_sandboxed",
            return_value=(messy_xlsx, None),
        ) as mock_preconvert,
        patch(
            "app.services.office_converter.convert_bytes_to_pdf_sandboxed",
            side_effect=fake_pdf_convert,
        ),
    ):
        pdf_io, err = convert_spreadsheet_to_pdf_sandboxed(
            OLE_MAGIC_BYTES + b"\x00" * 64,
            "rekap_lama.xls",
            orientation="landscape",
        )

    assert err is None
    assert pdf_io is not None
    assert mock_preconvert.call_count == 1
    assert mock_preconvert.call_args.kwargs["target_format"] == "xlsx"
    assert captured["filename"] == "rekap_lama.xlsx"

    wb = openpyxl.load_workbook(io.BytesIO(captured["bytes"]), data_only=False)
    try:
        ws = wb["Laporan"]
        assert ws.print_area == "'Laporan'!$B$2:$E$6"
        assert ws.page_setup.orientation == ws.ORIENTATION_LANDSCAPE
        assert ws.page_setup.fitToWidth == 1
    finally:
        wb.close()


def test_convert_spreadsheet_endpoint_orientation_validation_and_forwarding():
    files = {
        "file": (
            "data.xlsx",
            make_dummy_xlsx_bytes(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    }
    bad_resp = client.post(
        "/api/converter/spreadsheet-to-pdf",
        files=files,
        data={"orientation": "diagonal"},
        headers=auth_headers(),
    )
    assert bad_resp.status_code == 400
    assert "Orientasi halaman tidak valid" in bad_resp.json()["detail"]

    with patch(
        "app.api.converter.convert_spreadsheet_to_pdf_sandboxed",
        return_value=(io.BytesIO(b"%PDF-1.4\n%%EOF"), None),
    ) as mock_conv:
        ok_resp = client.post(
            "/api/converter/spreadsheet-to-pdf",
            files=files,
            data={"orientation": "landscape"},
            headers=auth_headers(),
        )
    assert ok_resp.status_code == 200
    assert mock_conv.call_args.kwargs["orientation"] == "landscape"


@pytest.mark.skipif(
    not detect_libreoffice()[0], reason="LibreOffice tidak terpasang di lingkungan uji"
)
def test_convert_spreadsheet_to_pdf_real_page1_has_table_no_blank_first_page():
    pdf_io, err = convert_spreadsheet_to_pdf_sandboxed(make_messy_xlsx_bytes(), "laporan.xlsx")
    assert err is None
    assert pdf_io is not None

    doc = pymupdf.open(stream=pdf_io.getvalue(), filetype="pdf")
    try:
        assert len(doc) >= 1
        page1_text = doc[0].get_text()
        assert "REKAP PENJUALAN" in page1_text
        assert "Item A" in page1_text
        assert "Grand Total" in page1_text
    finally:
        doc.close()


@pytest.mark.skipif(
    not detect_libreoffice()[0], reason="LibreOffice tidak terpasang di lingkungan uji"
)
def test_convert_spreadsheet_to_pdf_real_wide_table_auto_landscape_no_column_split():
    pdf_io, err = convert_spreadsheet_to_pdf_sandboxed(
        make_wide_xlsx_bytes(10),
        "tabel_lebar.xlsx",
        orientation="auto",
    )
    assert err is None
    assert pdf_io is not None

    doc = pymupdf.open(stream=pdf_io.getvalue(), filetype="pdf")
    try:
        assert len(doc) == 1
        page1 = doc[0]
        assert page1.rect.width > page1.rect.height
        page1_text = page1.get_text()
        for col in range(1, 11):
            assert f"Kolom{col:02d}" in page1_text
    finally:
        doc.close()


@pytest.mark.skipif(
    not detect_libreoffice()[0], reason="LibreOffice tidak terpasang di lingkungan uji"
)
def test_convert_spreadsheet_to_pdf_real_xls_end_to_end():
    xls_bytes, xls_err = convert_bytes_to_format_sandboxed(
        file_bytes=make_messy_xlsx_bytes(),
        filename="seed_legacy.xlsx",
        target_format="xls",
        expected_ext=".xls",
        prefix="docbuilder_xls2pdf_",
        timeout_sec=120.0,
        job_type="test_xls_seed",
    )
    assert xls_err is None
    assert xls_bytes is not None
    assert validate_spreadsheet_magic_bytes(xls_bytes, "legacy.xls") is True

    pdf_io, err = convert_spreadsheet_to_pdf_sandboxed(xls_bytes, "legacy.xls")
    assert err is None
    assert pdf_io is not None

    doc = pymupdf.open(stream=pdf_io.getvalue(), filetype="pdf")
    try:
        assert len(doc) >= 1
        page1_text = doc[0].get_text()
        assert "REKAP PENJUALAN" in page1_text
        assert "Item A" in page1_text
    finally:
        doc.close()


# --- PDF TO PPTX TESTS ---


def test_pdf_to_pptx_endpoint_accessible_without_auth():
    files = {"file": ("doc.pdf", make_test_pdf_bytes(1), "application/pdf")}
    response = client.post("/api/converter/pdf-to-pptx", files=files)
    assert response.status_code not in (401, 403)
    assert response.status_code == 200


def test_pdf_to_pptx_endpoint_success():
    pdf_bytes = make_test_pdf_bytes(2)
    files = {"file": ("laporan_tahunan.pdf", pdf_bytes, "application/pdf")}
    response = client.post("/api/converter/pdf-to-pptx", files=files, headers=auth_headers())
    assert response.status_code == 200
    assert "presentationml.presentation" in response.headers["content-type"]
    assert "laporan_tahunan.pptx" in response.headers["content-disposition"]

    # Validasi bahwa berkas output adalah PPTX valid dengan 2 slide
    prs = Presentation(io.BytesIO(response.content))
    assert len(prs.slides) == 2


# --- PDF TO XLSX TESTS ---


def test_pdf_to_xlsx_endpoint_accessible_without_auth():
    files = {"file": ("doc.pdf", make_test_pdf_bytes(1), "application/pdf")}
    response = client.post("/api/converter/pdf-to-xlsx", files=files)
    assert response.status_code not in (401, 403)


def test_pdf_to_xlsx_endpoint_with_tables_and_formula_defense():
    pdf_bytes = make_pdf_with_table_bytes()
    files = {"file": ("rekap_keuangan.pdf", pdf_bytes, "application/pdf")}
    response = client.post("/api/converter/pdf-to-xlsx", files=files, headers=auth_headers())
    assert response.status_code == 200
    assert "spreadsheetml.sheet" in response.headers["content-type"]
    assert "rekap_keuangan.xlsx" in response.headers["content-disposition"]

    # Validasi openpyxl membaca workbook dan formula injection dinetralisasi
    wb = openpyxl.load_workbook(io.BytesIO(response.content))
    assert "Page 1" in wb.sheetnames
    ws = wb["Page 1"]
    # Periksa nilai sel (formula injection harus diawali kutip tunggal)
    val = ws.cell(row=2, column=2).value
    assert val is not None
    assert str(val).startswith("'=")


def test_pdf_to_xlsx_endpoint_returns_422_when_no_tables():
    # PDF hanya teks biasa tanpa tabel
    doc = pymupdf.open()
    p = doc.new_page()
    p.insert_text((50, 50), "Paragraf narasi biasa tanpa tabel apapun.")
    pdf_no_tables = doc.tobytes()
    doc.close()

    files = {"file": ("artikel.pdf", pdf_no_tables, "application/pdf")}
    response = client.post("/api/converter/pdf-to-xlsx", files=files, headers=auth_headers())
    assert response.status_code == 422
    data = response.json()
    assert data["error_code"] == "NO_TABLES_FOUND"
    assert "Tidak ditemukan tabel" in data["message"]


def test_pdf_converters_reject_corrupt_and_empty():
    corrupt_files = {"file": ("bad.pdf", b"%PDF-corrupt", "application/pdf")}
    resp_pptx = client.post(
        "/api/converter/pdf-to-pptx", files=corrupt_files, headers=auth_headers()
    )
    assert resp_pptx.status_code == 422

    resp_xlsx = client.post(
        "/api/converter/pdf-to-xlsx", files=corrupt_files, headers=auth_headers()
    )
    assert resp_xlsx.status_code == 422
