import io
import sys
import tempfile
import uuid
from pathlib import Path

import pymupdf

from app.core.sandbox import SandboxConfig, run_sandboxed_subprocess
from app.services.pdf2docx_converter import validate_pdf_magic_bytes

MAX_PDF_PAGES = 500


def _check_pdf_preconditions(file_bytes: bytes) -> None:
    """Memvalidasi integritas dasar PDF sebelum dieksekusi di subprocess."""
    if not validate_pdf_magic_bytes(file_bytes):
        raise ValueError("Header biner berkas tidak valid sebagai berkas dokumen PDF (%PDF).")

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Gagal membaca struktur berkas PDF: {exc}") from exc

    try:
        if doc.is_encrypted:
            raise ValueError("Berkas PDF terenkripsi password tidak didukung.")
        if doc.page_count == 0:
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if doc.page_count > MAX_PDF_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas maksimum {MAX_PDF_PAGES} halaman.")
    finally:
        doc.close()


def convert_pdf_to_pptx_sandboxed(
    file_bytes: bytes, filename: str = "document.pdf"
) -> tuple[io.BytesIO | None, str | None]:
    """
    Mengonversi PDF menjadi presentasi PowerPoint (.pptx) berfidelitas visual presisi (144 DPI)
    di dalam sandbox subprocess terisolasi.
    """
    _check_pdf_preconditions(file_bytes)

    clean_stem = Path(filename).stem
    safe_stem = "".join(c for c in clean_stem if c.isalnum() or c in ("-", "_")) or "document"
    unique_prefix = f"pdf2pptx_{uuid.uuid4().hex[:8]}"

    with tempfile.TemporaryDirectory(prefix="docbuilder_p2p_") as tmpdir:
        work_dir = Path(tmpdir)
        input_pdf = work_dir / f"{safe_stem}_{unique_prefix}.pdf"
        output_pptx = work_dir / f"{safe_stem}_{unique_prefix}.pptx"
        input_pdf.write_bytes(file_bytes)

        worker_code = (
            "import io, sys\n"
            "from pptx import Presentation\n"
            "from pptx.util import Pt\n"
            "import pymupdf\n"
            "\n"
            "pdf_in = sys.argv[1]\n"
            "pptx_out = sys.argv[2]\n"
            "\n"
            "doc = pymupdf.open(pdf_in)\n"
            "if doc.page_count == 0:\n"
            "    sys.exit(1)\n"
            "\n"
            "prs = Presentation()\n"
            "blank_layout = prs.slide_layouts[6]\n"
            "\n"
            "page0 = doc[0]\n"
            "slide_w = float(page0.rect.width)\n"
            "slide_h = float(page0.rect.height)\n"
            "prs.slide_width = Pt(slide_w)\n"
            "prs.slide_height = Pt(slide_h)\n"
            "\n"
            "for page in doc:\n"
            "    pix = page.get_pixmap(dpi=144, alpha=False)\n"
            "    img_bytes = pix.tobytes('jpeg')\n"
            "    slide = prs.slides.add_slide(blank_layout)\n"
            "    pw = float(page.rect.width)\n"
            "    ph = float(page.rect.height)\n"
            "    scale = min(slide_w / pw, slide_h / ph) if pw > 0 and ph > 0 else 1.0\n"
            "    fit_w = pw * scale\n"
            "    fit_h = ph * scale\n"
            "    left = (slide_w - fit_w) / 2.0\n"
            "    top = (slide_h - fit_h) / 2.0\n"
            "    slide.shapes.add_picture(\n"
            "        io.BytesIO(img_bytes),\n"
            "        Pt(left),\n"
            "        Pt(top),\n"
            "        width=Pt(fit_w),\n"
            "        height=Pt(fit_h)\n"
            "    )\n"
            "\n"
            "doc.close()\n"
            "prs.save(pptx_out)\n"
        )

        command = [
            sys.executable,
            "-c",
            worker_code,
            str(input_pdf),
            str(output_pptx),
        ]

        config = SandboxConfig(
            working_dir=work_dir,
            timeout_sec=300.0,
            max_memory_mb=1000,
            allow_network=False,
        )

        result = run_sandboxed_subprocess(command, config)
        if result.exit_code == 0 and output_pptx.exists():
            out = io.BytesIO(output_pptx.read_bytes())
            out.seek(0)
            return out, None

        err_msg = result.error_message or result.stderr or "Gagal mengonversi berkas PDF ke PPTX."
        return None, f"PDF2PPTX_ERROR: {err_msg}"


def convert_pdf_to_xlsx_sandboxed(
    file_bytes: bytes, filename: str = "document.pdf"
) -> tuple[io.BytesIO | None, str | None]:
    """
    Mengonversi tabel-tabel terstruktur dari PDF menjadi buku kerja Excel (.xlsx)
    di dalam sandbox subprocess terisolasi.
    """
    _check_pdf_preconditions(file_bytes)

    clean_stem = Path(filename).stem
    safe_stem = "".join(c for c in clean_stem if c.isalnum() or c in ("-", "_")) or "document"
    unique_prefix = f"pdf2xlsx_{uuid.uuid4().hex[:8]}"

    with tempfile.TemporaryDirectory(prefix="docbuilder_p2x_") as tmpdir:
        work_dir = Path(tmpdir)
        input_pdf = work_dir / f"{safe_stem}_{unique_prefix}.pdf"
        output_xlsx = work_dir / f"{safe_stem}_{unique_prefix}.xlsx"
        input_pdf.write_bytes(file_bytes)

        worker_code = (
            "import sys\n"
            "import openpyxl\n"
            "import pymupdf\n"
            "\n"
            "pdf_in = sys.argv[1]\n"
            "xlsx_out = sys.argv[2]\n"
            "\n"
            "def sanitize_cell_value(val):\n"
            "    if val is None:\n"
            "        return ''\n"
            "    s = str(val).strip()\n"
            "    if not s:\n"
            "        return ''\n"
            "    if s[0] in ('=', '+', '-', '@', '\\t', '\\r'):\n"
            "        try:\n"
            "            float(s)\n"
            "            return s\n"
            "        except ValueError:\n"
            "            return \"'\" + s\n"
            "    return s\n"
            "\n"
            "doc = pymupdf.open(pdf_in)\n"
            "wb = openpyxl.Workbook()\n"
            "wb.remove(wb.active)\n"
            "total_tables = 0\n"
            "\n"
            "for page_idx, page in enumerate(doc, start=1):\n"
            "    tabs = page.find_tables()\n"
            "    t_list = tabs.tables if tabs else []\n"
            "    if not t_list:\n"
            "        tabs_text = page.find_tables(strategy='text')\n"
            "        if tabs_text and tabs_text.tables:\n"
            "            t_list = tabs_text.tables\n"
            "    if not t_list:\n"
            "        continue\n"
            "    ws = wb.create_sheet(title=f'Page {page_idx}'[:31])\n"
            "    current_row = 1\n"
            "    for t in t_list:\n"
            "        rows = t.extract()\n"
            "        if not rows:\n"
            "            continue\n"
            "        total_tables += 1\n"
            "        for row_data in rows:\n"
            "            for col_idx, cell_data in enumerate(row_data, start=1):\n"
            "                clean_val = sanitize_cell_value(cell_data)\n"
            "                if clean_val != '':\n"
            "                    ws.cell(row=current_row, column=col_idx, value=clean_val)\n"
            "            current_row += 1\n"
            "        current_row += 1\n"
            "\n"
            "doc.close()\n"
            "if total_tables == 0:\n"
            "    sys.exit(42)\n"
            "\n"
            "wb.save(xlsx_out)\n"
        )

        command = [
            sys.executable,
            "-c",
            worker_code,
            str(input_pdf),
            str(output_xlsx),
        ]

        config = SandboxConfig(
            working_dir=work_dir,
            timeout_sec=300.0,
            max_memory_mb=1000,
            allow_network=False,
        )

        result = run_sandboxed_subprocess(command, config)
        if result.exit_code == 42:
            return None, "NO_TABLES_FOUND"

        if result.exit_code == 0 and output_xlsx.exists():
            out = io.BytesIO(output_xlsx.read_bytes())
            out.seek(0)
            return out, None

        err_msg = result.error_message or result.stderr or "Gagal mengekstrak tabel PDF ke Excel."
        return None, f"PDF2XLSX_ERROR: {err_msg}"
