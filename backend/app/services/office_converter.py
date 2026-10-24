import io
import tempfile
import uuid
import zipfile
from pathlib import Path

from app.api.health import detect_libreoffice
from app.core.sandbox import SandboxConfig, run_sandboxed_subprocess

ZIP_MAGIC_BYTES = b"PK\x03\x04"
OLE_MAGIC_BYTES = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


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

    lo_available, lo_path = detect_libreoffice()
    if not lo_available or not lo_path:
        return None, "LIBREOFFICE_NOT_FOUND"

    clean_stem = Path(filename).stem
    safe_stem = "".join([c for c in clean_stem if c.isalnum() or c in ("-", "_")]) or "presentation"
    ext = Path(filename).suffix.lower() or ".pptx"
    unique_prefix = f"ppt2pdf_{uuid.uuid4().hex[:8]}"

    with tempfile.TemporaryDirectory(prefix="docbuilder_ppt2pdf_") as tmpdir:
        work_dir = Path(tmpdir)
        input_file = work_dir / f"{safe_stem}_{unique_prefix}{ext}"
        input_file.write_bytes(file_bytes)

        cmd = [
            lo_path,
            "--headless",
            "--norestore",
            "--nolockcheck",
            "--nologo",
            "--convert-to",
            "pdf",
            str(input_file.name),
            "--outdir",
            str(work_dir),
        ]

        config = SandboxConfig(
            working_dir=work_dir,
            timeout_sec=300.0,
            max_memory_mb=1000,
            allow_network=False,
        )

        result = run_sandboxed_subprocess(cmd, config)
        expected_pdf = input_file.with_suffix(".pdf")
        if result.exit_code == 0 and expected_pdf.exists():
            pdf_bytes = expected_pdf.read_bytes()
            out = io.BytesIO(pdf_bytes)
            out.seek(0)
            return out, None

        err_msg = (
            result.error_message or result.stderr or "Gagal mengonversi berkas presentasi ke PDF."
        )
        return None, f"CONVERSION_ERROR: {err_msg}"


def convert_spreadsheet_to_pdf_sandboxed(
    file_bytes: bytes, filename: str = "spreadsheet.xlsx"
) -> tuple[io.BytesIO | None, str | None]:
    """Mengonversi berkas Excel (.xlsx / .xls) menjadi PDF memakai LibreOffice headless."""
    if not validate_spreadsheet_magic_bytes(file_bytes, filename):
        raise ValueError("Header biner berkas tidak valid sebagai lembar kerja Excel.")

    lo_available, lo_path = detect_libreoffice()
    if not lo_available or not lo_path:
        return None, "LIBREOFFICE_NOT_FOUND"

    clean_stem = Path(filename).stem
    safe_stem = "".join([c for c in clean_stem if c.isalnum() or c in ("-", "_")]) or "spreadsheet"
    ext = Path(filename).suffix.lower() or ".xlsx"
    unique_prefix = f"xls2pdf_{uuid.uuid4().hex[:8]}"

    with tempfile.TemporaryDirectory(prefix="docbuilder_xls2pdf_") as tmpdir:
        work_dir = Path(tmpdir)
        input_file = work_dir / f"{safe_stem}_{unique_prefix}{ext}"
        input_file.write_bytes(file_bytes)

        cmd = [
            lo_path,
            "--headless",
            "--norestore",
            "--nolockcheck",
            "--nologo",
            "--convert-to",
            "pdf",
            str(input_file.name),
            "--outdir",
            str(work_dir),
        ]

        config = SandboxConfig(
            working_dir=work_dir,
            timeout_sec=300.0,
            max_memory_mb=1000,
            allow_network=False,
        )

        result = run_sandboxed_subprocess(cmd, config)
        expected_pdf = input_file.with_suffix(".pdf")
        if result.exit_code == 0 and expected_pdf.exists():
            pdf_bytes = expected_pdf.read_bytes()
            out = io.BytesIO(pdf_bytes)
            out.seek(0)
            return out, None

        err_msg = (
            result.error_message or result.stderr or "Gagal mengonversi berkas spreadsheet ke PDF."
        )
        return None, f"CONVERSION_ERROR: {err_msg}"
