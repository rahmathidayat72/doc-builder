import io
import tempfile
import uuid
from pathlib import Path
from typing import Any

from app.api.health import detect_libreoffice
from app.core.sandbox import SandboxConfig, run_sandboxed_subprocess
from app.services.docx_generator import generate_resume_docx


def generate_resume_pdf(resume: dict[str, Any]) -> tuple[io.BytesIO | None, str | None]:
    """
    Mengonversi data resume menjadi dokumen PDF melalui LibreOffice headless.
    Jika LibreOffice tidak tersedia di sistem host, mengembalikan (None, 'LIBREOFFICE_NOT_FOUND').
    """
    lo_available, lo_path = detect_libreoffice()
    if not lo_available or not lo_path:
        return None, "LIBREOFFICE_NOT_FOUND"

    # 1. Hasilkan berkas DOCX di memori
    docx_io = generate_resume_docx(resume)

    # 2. Siapkan direktori kerja temporer terisolasi
    with tempfile.TemporaryDirectory(prefix="docbuilder_pdf_") as tmpdir:
        work_dir = Path(tmpdir)
        input_docx = work_dir / f"resume_{uuid.uuid4().hex[:8]}.docx"
        input_docx.write_bytes(docx_io.getvalue())

        # 3. Jalankan LibreOffice headless via sandbox adapter (tanpa akses jaringan)
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
            working_dir=work_dir, timeout_sec=60.0, max_memory_mb=500, allow_network=False
        )

        result = run_sandboxed_subprocess(cmd, config)

        expected_pdf = input_docx.with_suffix(".pdf")
        if result.exit_code == 0 and expected_pdf.exists():
            pdf_bytes = expected_pdf.read_bytes()
            out = io.BytesIO(pdf_bytes)
            out.seek(0)
            return out, None

        error_detail = result.error_message or result.stderr or "Gagal mengonversi dokumen ke PDF."
        return None, f"CONVERSION_FAILED: {error_detail}"
