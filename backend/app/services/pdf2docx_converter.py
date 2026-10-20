import io
import sys
import tempfile
import uuid
from pathlib import Path

from app.core.sandbox import SandboxConfig, run_sandboxed_subprocess

PDF_MAGIC_BYTES = b"%PDF"


def validate_pdf_magic_bytes(file_bytes: bytes) -> bool:
    """Memvalidasi apakah berkas memiliki header magic bytes PDF (%PDF)."""
    if len(file_bytes) < 4:
        return False
    return file_bytes[:4] == PDF_MAGIC_BYTES


def convert_pdf_to_docx_sandboxed(
    file_bytes: bytes, filename: str = "document.pdf"
) -> tuple[io.BytesIO | None, str | None]:
    """
    Mengonversi PDF menjadi Word memakai pdf2docx di dalam sandbox subprocess.
    """
    if not validate_pdf_magic_bytes(file_bytes):
        raise ValueError("Header biner berkas tidak valid sebagai berkas dokumen PDF (%PDF).")

    clean_stem = Path(filename).stem
    safe_stem = "".join(
        char for char in clean_stem if char.isalnum() or char in ("-", "_")
    ) or "document"
    unique_prefix = f"pdf2docx_{uuid.uuid4().hex[:8]}"

    with tempfile.TemporaryDirectory(prefix="docbuilder_p2d_") as tmpdir:
        work_dir = Path(tmpdir)
        input_pdf = work_dir / f"{safe_stem}_{unique_prefix}.pdf"
        output_docx = work_dir / f"{safe_stem}_{unique_prefix}.docx"
        input_pdf.write_bytes(file_bytes)

        worker_code = (
            "import sys\n"
            "from pdf2docx import Converter\n"
            "pdf_in = sys.argv[1]\n"
            "docx_out = sys.argv[2]\n"
            "cv = Converter(pdf_in)\n"
            "cv.convert(docx_out, start=0, end=None)\n"
            "cv.close()\n"
        )
        command = [
            sys.executable,
            "-c",
            worker_code,
            str(input_pdf),
            str(output_docx),
        ]
        config = SandboxConfig(
            working_dir=work_dir,
            timeout_sec=300.0,
            max_memory_mb=1000,
            allow_network=False,
        )

        result = run_sandboxed_subprocess(command, config)
        if result.exit_code == 0 and output_docx.exists():
            output = io.BytesIO(output_docx.read_bytes())
            output.seek(0)
            return output, None

        error_message = (
            result.error_message
            or result.stderr
            or "Gagal merekonstruksi berkas PDF ke DOCX."
        )
        return None, f"PDF2DOCX_ERROR: {error_message}"
