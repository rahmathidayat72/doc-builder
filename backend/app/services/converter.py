import io

from app.api.health import detect_libreoffice
from app.services.libreoffice import convert_bytes_to_pdf_sandboxed

DOCX_MAGIC_BYTES = b"PK\x03\x04"


def validate_docx_magic_bytes(file_bytes: bytes) -> bool:
    """Memvalidasi apakah berkas memiliki header magic bytes ZIP/DOCX yang valid."""
    if len(file_bytes) < 4:
        return False
    return file_bytes[:4] == DOCX_MAGIC_BYTES


def convert_docx_to_pdf_sandboxed(
    file_bytes: bytes, filename: str = "document.docx"
) -> tuple[io.BytesIO | None, str | None]:
    """
    Mengonversi berkas Microsoft Word (.docx) menjadi PDF menggunakan LibreOffice headless
    di dalam sandbox subprocess terisolasi (tanpa akses jaringan, profil terisolasi, timeout 5m).
    """
    if not validate_docx_magic_bytes(file_bytes):
        raise ValueError("Header biner berkas tidak valid sebagai berkas Microsoft Word (.docx).")

    lo_available, _ = detect_libreoffice()
    if not lo_available:
        return None, "LIBREOFFICE_NOT_FOUND"

    return convert_bytes_to_pdf_sandboxed(
        file_bytes=file_bytes,
        filename=filename,
        prefix="docbuilder_docx2pdf_",
        timeout_sec=300.0,
        max_memory_mb=1000,
        error_prefix="CONVERSION_ERROR",
    )
