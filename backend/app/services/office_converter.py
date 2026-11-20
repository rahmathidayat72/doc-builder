import io
import logging
import zipfile
from pathlib import Path
from typing import Any, Literal

import openpyxl
from openpyxl.utils import get_column_letter, range_boundaries

from app.api.health import detect_libreoffice
from app.services.libreoffice import (
    convert_bytes_to_format_sandboxed,
    convert_bytes_to_pdf_sandboxed,
)

logger = logging.getLogger("satukit.office_converter")

ZIP_MAGIC_BYTES = b"PK\x03\x04"
OLE_MAGIC_BYTES = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
SpreadsheetOrientation = Literal["auto", "portrait", "landscape"]

_LANDSCAPE_MIN_COLS = 7
_LANDSCAPE_MIN_TOTAL_WIDTH = 75.0
_DEFAULT_COL_WIDTH = 10.0
_MAX_STYLE_EXPAND_COLS = 15
_MAX_STYLE_EXPAND_ROWS = 30
_MAX_STYLE_ONLY_COL = 200
_MAX_STYLE_ONLY_ROW = 5000


def validate_presentation_magic_bytes(file_bytes: bytes, filename: str) -> bool:
    """Memvalidasi magic bytes berkas presentasi PowerPoint (.pptx atau .ppt)."""
    if len(file_bytes) < 4:
        return False

    name_lower = filename.lower()
    if name_lower.endswith(".pptx"):
        if file_bytes[:4] != ZIP_MAGIC_BYTES:
            return False
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
                names = archive.namelist()
                return any(n.startswith("ppt/") for n in names) or "[Content_Types].xml" in names
        except Exception:
            return False

    if name_lower.endswith(".ppt"):
        return len(file_bytes) >= 8 and file_bytes[:8] == OLE_MAGIC_BYTES

    return False


def validate_spreadsheet_magic_bytes(file_bytes: bytes, filename: str) -> bool:
    """Memvalidasi magic bytes berkas lembar kerja Excel (.xlsx atau .xls)."""
    if len(file_bytes) < 4:
        return False

    name_lower = filename.lower()
    if name_lower.endswith(".xlsx"):
        if file_bytes[:4] != ZIP_MAGIC_BYTES:
            return False
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
                names = archive.namelist()
                return any(n.startswith("xl/") for n in names) or "[Content_Types].xml" in names
        except Exception:
            return False

    if name_lower.endswith(".xls"):
        return len(file_bytes) >= 8 and file_bytes[:8] == OLE_MAGIC_BYTES

    return False


def convert_presentation_to_pdf_sandboxed(
    file_bytes: bytes, filename: str = "presentation.pptx"
) -> tuple[io.BytesIO | None, str | None]:
    """Mengonversi berkas PowerPoint (.pptx / .ppt) menjadi PDF memakai LibreOffice headless."""
    if not validate_presentation_magic_bytes(file_bytes, filename):
        raise ValueError("Header biner berkas tidak valid sebagai presentasi PowerPoint.")

    lo_available, _ = detect_libreoffice()
    if not lo_available:
        return None, "LIBREOFFICE_NOT_FOUND"

    return convert_bytes_to_pdf_sandboxed(
        file_bytes=file_bytes,
        filename=filename,
        prefix="docbuilder_ppt2pdf_",
        timeout_sec=300.0,
        max_memory_mb=1000,
        error_prefix="CONVERSION_ERROR",
    )


def _cell_has_content(cell: Any) -> bool:
    """Periksa apakah sel terisi nilai/formula; angka 0 tetap dianggap terisi."""
    val = cell.value
    if val is None:
        return False
    if isinstance(val, str):
        return val.strip() != ""
    return True


def _cell_has_formula(cell: Any) -> bool:
    value = cell.value
    return isinstance(value, str) and value.startswith("=")


def _cached_formula_is_meaningful(cached_cell: Any | None) -> bool:
    """Nilai formula cache kosong atau nol bukan penanda baris data nyata."""
    if cached_cell is None:
        return False
    value = cached_cell.value
    if value is None or value is False:
        return False
    if isinstance(value, str):
        return value.strip() not in ("", "0")
    if isinstance(value, (int, float)):
        return value != 0
    return True


def _cell_has_table_style(cell: Any) -> bool:
    """Memeriksa apakah sel memiliki border atau fill non-putih khas sel tabel."""
    if not getattr(cell, "has_style", False):
        return False

    border = getattr(cell, "border", None)
    if border is not None:
        for side_name in ("left", "right", "top", "bottom"):
            side = getattr(border, side_name, None)
            if side is not None and getattr(side, "style", None):
                return True

    fill = getattr(cell, "fill", None)
    if fill is not None and getattr(fill, "fill_type", None) == "solid":
        fg = getattr(fill, "fgColor", None)
        if fg is not None:
            fg_type = getattr(fg, "type", None)
            if fg_type == "rgb":
                rgb = str(getattr(fg, "rgb", "") or "").upper()
                if rgb and rgb not in ("00000000", "FFFFFFFF", "00FFFFFF"):
                    return True
            elif fg_type == "theme":
                return True
            elif fg_type == "indexed" and getattr(fg, "indexed", None) not in (None, 64, 65):
                return True

    return False


def _find_worksheet_used_range(
    ws: Any,
    cached_ws: Any | None = None,
) -> tuple[int, int, int, int] | None:
    """
    Menentukan rentang data nyata tanpa tertipu formatting jauh atau formula kosong/nol
    yang disalin ke ribuan baris di bawah tabel.
    """
    content_coords: list[tuple[int, int]] = []
    formula_coords: list[tuple[int, int]] = []
    style_coords: list[tuple[int, int]] = []
    non_formula_rows: set[int] = set()

    raw_cells = getattr(ws, "_cells", None)
    cell_iter = raw_cells.values() if isinstance(raw_cells, dict) else ()
    for cell in cell_iter:
        if _cell_has_content(cell):
            if _cell_has_formula(cell):
                formula_coords.append((cell.row, cell.column))
            else:
                content_coords.append((cell.row, cell.column))
                non_formula_rows.add(cell.row)
        elif _cell_has_table_style(cell):
            style_coords.append((cell.row, cell.column))

    cached_cells = getattr(cached_ws, "_cells", None)
    for row, col in formula_coords:
        cached_cell = cached_cells.get((row, col)) if isinstance(cached_cells, dict) else None
        if row in non_formula_rows or _cached_formula_is_meaningful(cached_cell):
            content_coords.append((row, col))

    # Sertakan batas tabel resmi Excel (ws.tables)
    tables = getattr(ws, "tables", None)
    if tables:
        for table in tables.values():
            ref = getattr(table, "ref", None)
            if ref:
                try:
                    t_min_col, t_min_row, t_max_col, t_max_row = range_boundaries(ref)
                    content_coords.append((t_min_row, t_min_col))
                    content_coords.append((t_max_row, t_max_col))
                except Exception:
                    pass

    # Sertakan merged cells yang anchor-nya berisi konten atau style tabel
    merged_ranges = list(getattr(ws.merged_cells, "ranges", []))
    for m_range in merged_ranges:
        anchor = ws.cell(row=m_range.min_row, column=m_range.min_col)
        if _cell_has_content(anchor):
            content_coords.append((m_range.min_row, m_range.min_col))
            content_coords.append((m_range.max_row, m_range.max_col))
        elif _cell_has_table_style(anchor):
            style_coords.append((m_range.min_row, m_range.min_col))
            style_coords.append((m_range.max_row, m_range.max_col))

    if content_coords:
        c_min_row = min(r for r, _ in content_coords)
        c_max_row = max(r for r, _ in content_coords)
        c_min_col = min(c for _, c in content_coords)
        c_max_col = max(c for _, c in content_coords)

        min_row, max_row = c_min_row, c_max_row
        min_col, max_col = c_min_col, c_max_col

        # Perluas dengan sel ber-style tabel di sekitar area konten
        # (hindari jebakan format satu baris/kolom penuh hingga XFD/1048576)
        row_lo = max(1, c_min_row - 5)
        row_hi = c_max_row + _MAX_STYLE_EXPAND_ROWS
        col_lo = max(1, c_min_col - 5)
        col_hi = c_max_col + _MAX_STYLE_EXPAND_COLS
        for r, c in style_coords:
            if row_lo <= r <= row_hi and col_lo <= c <= col_hi:
                if r < min_row:
                    min_row = r
                if r > max_row:
                    max_row = r
                if c < min_col:
                    min_col = c
                if c > max_col:
                    max_col = c
    elif style_coords:
        bounded = [
            (r, c) for r, c in style_coords if r <= _MAX_STYLE_ONLY_ROW and c <= _MAX_STYLE_ONLY_COL
        ]
        if not bounded:
            return None
        min_row = min(r for r, _ in bounded)
        max_row = max(r for r, _ in bounded)
        min_col = min(c for _, c in bounded)
        max_col = max(c for _, c in bounded)
    else:
        return None

    # Pastikan merged cell yang bersinggungan dengan area cetak tidak terpotong di tepi
    for m_range in merged_ranges:
        overlaps = not (
            m_range.max_row < min_row
            or m_range.min_row > max_row
            or m_range.max_col < min_col
            or m_range.min_col > max_col
        )
        if overlaps:
            min_row = min(min_row, m_range.min_row)
            max_row = max(max_row, m_range.max_row)
            min_col = min(min_col, m_range.min_col)
            max_col = max(max_col, m_range.max_col)

    return min_row, max_row, min_col, max_col


def _estimate_sheet_print_width(
    ws: Any, min_row: int, max_row: int, min_col: int, max_col: int
) -> tuple[int, float]:
    """Menghitung jumlah kolom terlihat dan estimasi total lebar karakter tabel."""
    visible_cols = 0
    total_width = 0.0

    # Kumpulkan panjang tampilan maksimum per kolom dari sel yang terisi (tanpa iterasi grid kosong)
    col_text_len: dict[int, int] = {}
    raw_cells = getattr(ws, "_cells", None)
    if isinstance(raw_cells, dict):
        for cell in raw_cells.values():
            if not (min_row <= cell.row <= max_row and min_col <= cell.column <= max_col):
                continue
            val = cell.value
            if val is None:
                continue
            text = str(val)
            # Formula biasanya lebih panjang daripada teks tampilannya; beri estimasi moderat
            disp_len = 12 if text.startswith("=") else len(text)
            prev = col_text_len.get(cell.column, 0)
            if disp_len > prev:
                col_text_len[cell.column] = disp_len

    for col_idx in range(min_col, max_col + 1):
        col_letter = get_column_letter(col_idx)
        col_dim = ws.column_dimensions.get(col_letter)
        if col_dim is not None and getattr(col_dim, "hidden", False):
            continue
        visible_cols += 1

        explicit_width = getattr(col_dim, "width", None) if col_dim is not None else None
        if explicit_width is not None and explicit_width > 0:
            width = float(explicit_width)
        else:
            est = float(col_text_len.get(col_idx, 0) + 2)
            width = max(_DEFAULT_COL_WIDTH, min(35.0, est))
        total_width += width

    return visible_cols, total_width


def _normalize_worksheet_print_setup(
    ws: Any,
    used_range: tuple[int, int, int, int],
    *,
    orientation: SpreadsheetOrientation = "auto",
) -> None:
    """Menormalkan print area, manual page break, skala fitToWidth, orientasi, dan margin."""
    min_row, max_row, min_col, max_col = used_range

    # 1. Hapus manual page break agar tidak memicu halaman kosong
    if hasattr(ws, "row_breaks") and ws.row_breaks is not None:
        ws.row_breaks.brk = []
    if hasattr(ws, "col_breaks") and ws.col_breaks is not None:
        ws.col_breaks.brk = []

    # 2. Set ulang print_area ke rentang data nyata
    start_ref = f"{get_column_letter(min_col)}{min_row}"
    end_ref = f"{get_column_letter(max_col)}{max_row}"
    ws.print_area = f"{start_ref}:{end_ref}"

    # 3. Aktifkan fitToPage + fitToWidth=1, tinggi bebas (fitToHeight=0), hapus scale lama
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_setup.scale = None
    if not ws.page_setup.paperSize:
        ws.page_setup.paperSize = ws.PAPERSIZE_A4

    # 4. Orientasi otomatis atau sesuai pilihan pengguna
    if orientation == "landscape":
        ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    elif orientation == "portrait":
        ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT
    else:
        visible_cols, total_width = _estimate_sheet_print_width(
            ws, min_row, max_row, min_col, max_col
        )
        if visible_cols >= _LANDSCAPE_MIN_COLS or total_width >= _LANDSCAPE_MIN_TOTAL_WIDTH:
            ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
        else:
            ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT

    # 5. Set margin cetak wajar (dalam inci)
    ws.page_margins.left = 0.4
    ws.page_margins.right = 0.4
    ws.page_margins.top = 0.5
    ws.page_margins.bottom = 0.5
    ws.page_margins.header = 0.25
    ws.page_margins.footer = 0.25


def normalize_spreadsheet_workbook_bytes(
    file_bytes: bytes,
    *,
    orientation: SpreadsheetOrientation = "auto",
) -> bytes:
    """
    Menormalkan pengaturan cetak workbook .xlsx sebelum diserahkan ke LibreOffice:
    - Print area diset ulang ke data nyata; ekor formula kosong/nol tanpa input diabaikan
    - Manual page break dihapus
    - Sheet kosong tersembunyi bila ada sheet lain berisi data agar halaman 1 tidak kosong
    - fitToWidth=1, fitToHeight=0, fitToPage=True, orientasi otomatis/terpilih, margin wajar
    - Formula, format, merged cells, dan lebar kolom tetap dipertahankan
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=False)
    cached_wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    try:
        cached_sheets = {ws.title: ws for ws in cached_wb.worksheets}
        visible_sheets = [ws for ws in wb.worksheets if ws.sheet_state == "visible"]
        sheet_ranges = {
            ws.title: _find_worksheet_used_range(ws, cached_sheets.get(ws.title))
            for ws in visible_sheets
        }
        has_any_populated_sheet = any(rng is not None for rng in sheet_ranges.values())

        first_populated_idx: int | None = None
        for idx, ws in enumerate(wb.worksheets):
            if ws.sheet_state != "visible":
                continue

            used_range = sheet_ranges[ws.title]
            if used_range is None:
                if has_any_populated_sheet:
                    ws.sheet_state = "hidden"
                    if ws.views and ws.views.sheetView:
                        ws.views.sheetView[0].tabSelected = False
                else:
                    if hasattr(ws, "row_breaks") and ws.row_breaks is not None:
                        ws.row_breaks.brk = []
                    if hasattr(ws, "col_breaks") and ws.col_breaks is not None:
                        ws.col_breaks.brk = []
                    ws.print_area = None
                continue

            if first_populated_idx is None:
                first_populated_idx = idx
            _normalize_worksheet_print_setup(ws, used_range, orientation=orientation)

        if first_populated_idx is not None:
            active_ws = wb.active
            if active_ws is None or active_ws.sheet_state != "visible":
                wb.active = first_populated_idx
                target_ws = wb.worksheets[first_populated_idx]
                if target_ws.views and target_ws.views.sheetView:
                    target_ws.views.sheetView[0].tabSelected = True

        out = io.BytesIO()
        wb.save(out)
        return out.getvalue()
    finally:
        cached_wb.close()
        wb.close()


def convert_spreadsheet_to_pdf_sandboxed(
    file_bytes: bytes,
    filename: str = "spreadsheet.xlsx",
    orientation: SpreadsheetOrientation = "auto",
) -> tuple[io.BytesIO | None, str | None]:
    """Mengonversi berkas Excel (.xlsx / .xls) menjadi PDF dengan normalisasi cetak."""
    if not validate_spreadsheet_magic_bytes(file_bytes, filename):
        raise ValueError("Header biner berkas tidak valid sebagai lembar kerja Excel.")

    lo_available, _ = detect_libreoffice()
    if not lo_available:
        return None, "LIBREOFFICE_NOT_FOUND"

    target_bytes = file_bytes
    target_filename = filename

    # Jalur .xls: konversi sementara ke .xlsx via LibreOffice agar bisa dinormalisasi openpyxl
    if filename.lower().endswith(".xls"):
        converted_xlsx, pre_err = convert_bytes_to_format_sandboxed(
            file_bytes=file_bytes,
            filename=filename,
            target_format="xlsx",
            expected_ext=".xlsx",
            validator=lambda data: validate_spreadsheet_magic_bytes(data, "converted.xlsx"),
            prefix="docbuilder_xls2pdf_",
            timeout_sec=300.0,
            max_memory_mb=1000,
            error_prefix="CONVERSION_ERROR",
            job_type="spreadsheet_preconvert",
        )
        if pre_err or not converted_xlsx:
            return None, pre_err or "CONVERSION_ERROR: Gagal mengonversi .xls ke .xlsx sementara."
        target_bytes = converted_xlsx
        target_filename = f"{Path(filename).stem}.xlsx"

    try:
        normalized_bytes = normalize_spreadsheet_workbook_bytes(
            target_bytes,
            orientation=orientation,
        )
    except Exception as exc:
        logger.warning(
            "Gagal menormalkan workbook spreadsheet; melanjutkan konversi berkas asli: %s",
            exc,
        )
        normalized_bytes = target_bytes

    return convert_bytes_to_pdf_sandboxed(
        file_bytes=normalized_bytes,
        filename=target_filename,
        prefix="docbuilder_xls2pdf_",
        timeout_sec=300.0,
        max_memory_mb=1000,
        error_prefix="CONVERSION_ERROR",
    )
