from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.jobs import conversion_job_manager
from app.services.converter import convert_docx_to_pdf_sandboxed
from app.services.job_manager import JobBusyError
from app.services.pdf2docx_converter import convert_pdf_to_docx_sandboxed

router = APIRouter(prefix="/converter", tags=["Converter"])

MAX_CONVERSION_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


@router.post("/docx-to-pdf")
async def convert_docx_to_pdf(file: Annotated[UploadFile, File()]):
    """
    Mengonversi berkas Microsoft Word (.docx) menjadi PDF secara aman di dalam sandbox.
    Maksimum ukuran berkas adalah 25 MB.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nama berkas tidak valid.")

    filename_lower = file.filename.lower()
    if not filename_lower.endswith(".docx"):
        raise HTTPException(
            status_code=400, detail="Format berkas tidak didukung. Harap unggah berkas .docx."
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_CONVERSION_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran berkas melebihi batas maksimum 25 MB ({len(file_bytes)} bytes).",
        )

    try:
        with conversion_job_manager.run_job("docx-to-pdf") as job:
            pdf_io, err_code = convert_docx_to_pdf_sandboxed(file_bytes, file.filename)

            if err_code == "LIBREOFFICE_NOT_FOUND":
                return JSONResponse(
                    status_code=422,
                    content={
                        "success": False,
                        "job_id": job.id,
                        "error_code": "LIBREOFFICE_NOT_FOUND",
                        "message": (
                            "LibreOffice belum terpasang di komputer lokal. "
                            "Silakan instal LibreOffice gratis untuk mengaktifkan konversi."
                        ),
                    },
                )

            if not pdf_io or err_code:
                raise HTTPException(
                    status_code=500, detail=err_code or "Gagal mengonversi berkas."
                )

            output_filename = f"{file.filename.rsplit('.', 1)[0]}.pdf"
            return StreamingResponse(
                pdf_io,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{output_filename}"',
                    "X-Job-ID": job.id,
                },
            )
    except JobBusyError as busy:
        raise HTTPException(status_code=429, detail=str(busy)) from busy
    except ValueError as value_error:
        raise HTTPException(status_code=422, detail=str(value_error)) from value_error
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Gagal memproses konversi dokumen: {exc}"
        ) from exc


@router.post("/pdf-to-docx")
async def convert_pdf_to_docx(file: Annotated[UploadFile, File()]):
    """
    Mengonversi berkas PDF menjadi Microsoft Word (.docx) secara aman di dalam sandbox.
    Maksimum ukuran berkas adalah 25 MB.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nama berkas tidak valid.")

    filename_lower = file.filename.lower()
    if not filename_lower.endswith(".pdf"):
        raise HTTPException(
            status_code=400, detail="Format berkas tidak didukung. Harap unggah berkas .pdf."
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_CONVERSION_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran berkas melebihi batas maksimum 25 MB ({len(file_bytes)} bytes).",
        )

    try:
        with conversion_job_manager.run_job("pdf-to-docx") as job:
            docx_io, err_code = convert_pdf_to_docx_sandboxed(file_bytes, file.filename)

            if not docx_io or err_code:
                raise HTTPException(
                    status_code=500,
                    detail=err_code or "Gagal merekonstruksi berkas PDF ke DOCX.",
                )

            output_filename = f"{file.filename.rsplit('.', 1)[0]}.docx"
            return StreamingResponse(
                docx_io,
                media_type=(
                    "application/vnd.openxmlformats-officedocument."
                    "wordprocessingml.document"
                ),
                headers={
                    "Content-Disposition": f'attachment; filename="{output_filename}"',
                    "X-Job-ID": job.id,
                },
            )
    except JobBusyError as busy:
        raise HTTPException(status_code=429, detail=str(busy)) from busy
    except ValueError as value_error:
        raise HTTPException(status_code=422, detail=str(value_error)) from value_error
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Gagal merekonstruksi dokumen PDF ke DOCX: {exc}"
        ) from exc
