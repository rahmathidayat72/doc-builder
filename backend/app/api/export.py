import re
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from app.services.docx_generator import generate_resume_docx
from app.services.pdf_generator import generate_resume_pdf

router = APIRouter(prefix="/export", tags=["Export"])

_INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def sanitize_export_filename(raw_title: Any, extension: str) -> str:
    """Membersihkan judul pengguna sebelum dipakai pada header Content-Disposition."""
    title = str(raw_title or "").strip()
    title = re.sub(r"\.(pdf|docx)$", "", title, flags=re.IGNORECASE)
    title = _INVALID_FILENAME_CHARS.sub(" ", title)
    title = re.sub(r"\s+", " ", title).strip(" .")
    if not title:
        title = "resume"
    return f"{title[:120].strip() or 'resume'}.{extension}"


@router.post("/docx")
def export_docx(payload: dict[str, Any]):
    """
    Mengekspor data CV menjadi berkas Microsoft Word (.docx).
    """
    try:
        filename = sanitize_export_filename(payload.get("title", "resume"), "docx")

        docx_io = generate_resume_docx(payload)

        return StreamingResponse(
            docx_io,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengekspor DOCX: {e}") from e


@router.post("/pdf")
def export_pdf(payload: dict[str, Any]):
    """
    Mengekspor data CV menjadi berkas PDF via LibreOffice headless.
    Jika LibreOffice tidak terpasang, mengembalikan status 422 dengan pesan panduan.
    """
    try:
        filename = sanitize_export_filename(payload.get("title", "resume"), "pdf")

        pdf_io, err_code = generate_resume_pdf(payload)

        if err_code == "LIBREOFFICE_NOT_FOUND":
            return JSONResponse(
                status_code=422,
                content={
                    "success": False,
                    "error_code": "LIBREOFFICE_NOT_FOUND",
                    "message": (
                        "LibreOffice belum terpasang di komputer lokal. Anda dapat mencetak PDF "
                        "langsung dari antarmuka browser atau menginstal LibreOffice."
                    ),
                },
            )

        if not pdf_io or err_code:
            raise HTTPException(status_code=500, detail=err_code or "Gagal membuat PDF.")

        return StreamingResponse(
            pdf_io,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengekspor PDF: {e}") from e
