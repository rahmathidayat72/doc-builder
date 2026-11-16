import io
import zipfile

from app.api.health import detect_libreoffice
from app.services.libreoffice import convert_bytes_to_pdf_sandboxed

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


def convert_spreadsheet_to_pdf_sandboxed(
    file_bytes: bytes, filename: str = "spreadsheet.xlsx"
) -> tuple[io.BytesIO | None, str | None]:
    """Mengonversi berkas Excel (.xlsx / .xls) menjadi PDF memakai LibreOffice headless."""
    if not validate_spreadsheet_magic_bytes(file_bytes, filename):
        raise ValueError("Header biner berkas tidak valid sebagai lembar kerja Excel.")

    lo_available, _ = detect_libreoffice()
    if not lo_available:
        return None, "LIBREOFFICE_NOT_FOUND"

    return convert_bytes_to_pdf_sandboxed(
        file_bytes=file_bytes,
        filename=filename,
        prefix="docbuilder_xls2pdf_",
        timeout_sec=300.0,
        max_memory_mb=1000,
        error_prefix="CONVERSION_ERROR",
    )
