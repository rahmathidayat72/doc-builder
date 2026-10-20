import io
import tempfile
import uuid
from pathlib import Path

from app.api.health import detect_libreoffice
from app.core.sandbox import SandboxConfig, run_sandboxed_subprocess

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
    di dalam sandbox subprocess terisolasi (tanpa akses jaringan, memori terikat, timeout 5m).
    """
    if not validate_docx_magic_bytes(file_bytes):
        raise ValueError("Header biner berkas tidak valid sebagai berkas Microsoft Word (.docx).")

    lo_available, lo_path = detect_libreoffice()
    if not lo_available or not lo_path:
        return None, "LIBREOFFICE_NOT_FOUND"

    clean_stem = Path(filename).stem
    safe_stem = "".join([c for c in clean_stem if c.isalnum() or c in ("-", "_")]) or "document"
    unique_prefix = f"conv_{uuid.uuid4().hex[:8]}"

    with tempfile.TemporaryDirectory(prefix="docbuilder_docx2pdf_") as tmpdir:
        work_dir = Path(tmpdir)
        input_docx = work_dir / f"{safe_stem}_{unique_prefix}.docx"
        input_docx.write_bytes(file_bytes)

        cmd = [
            lo_path,
            "--headless",
            "--norestore",
            "--nolockcheck",
            "--nologo",
            "--convert-to",
            "pdf",
            str(input_docx.name),
            "--outdir",
            str(work_dir),
        ]

        config = SandboxConfig(
            working_dir=work_dir,
            timeout_sec=300.0,  # SLA Timeout 5 menit
            max_memory_mb=1000,
            allow_network=False,
        )

        result = run_sandboxed_subprocess(cmd, config)

        expected_pdf = input_docx.with_suffix(".pdf")
        if result.exit_code == 0 and expected_pdf.exists():
            pdf_bytes = expected_pdf.read_bytes()
            out = io.BytesIO(pdf_bytes)
            out.seek(0)
            return out, None

        err_msg = result.error_message or result.stderr or "Gagal mengonversi berkas DOCX ke PDF."
        return None, f"CONVERSION_ERROR: {err_msg}"
