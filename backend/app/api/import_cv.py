from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.resume_parser import parse_resume_document

router = APIRouter(prefix="/import", tags=["Import"])

MAX_IMPORT_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


@router.post("/resume")
async def import_resume(file: Annotated[UploadFile, File()]):
    """
    Menerima unggahan berkas CV (PDF atau DOCX), mengekstrak teks ke bagian terstruktur,
    dan menghitung skor kepastian (confidence) per bidang.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nama berkas tidak valid.")

    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".pdf") or filename_lower.endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail="Format berkas tidak didukung. Harap unggah berkas .pdf atau .docx.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMPORT_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran berkas melebihi batas maksimum 25 MB ({len(file_bytes)} bytes).",
        )

    try:
        result = parse_resume_document(file_bytes, file.filename)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve)) from ve
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mem-parsing dokumen CV: {e}") from e
