import re
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.jobs import conversion_job_manager
from app.services.job_manager import JobBusyError
from app.services.pdf_tools import (
    images_to_pdf,
    merge_pdf_and_images,
    pdf_to_images_zip,
    split_pdf,
)

router = APIRouter(prefix="/pdf-tools", tags=["PDF Tools"])
MAX_TOTAL_UPLOAD_SIZE = 25 * 1024 * 1024


def sanitize_filename(filename: str) -> str:
    base = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    name_only = base.rsplit(".", 1)[0] if "." in base else base
    clean = re.sub(r"[^a-zA-Z0-9_-]", "_", name_only).strip("_")
    return clean or "document"


async def _read_uploads(files: list[UploadFile]) -> list[tuple[str, bytes]]:
    result: list[tuple[str, bytes]] = []
    total_size = 0
    for file in files:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Nama berkas tidak valid.")
        content = await file.read()
        total_size += len(content)
        if total_size > MAX_TOTAL_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="Total ukuran upload melebihi 25 MB.")
        result.append((file.filename, content))
    return result


@router.post("/merge")
async def merge_files(files: Annotated[list[UploadFile], File()]):
    try:
        uploads = await _read_uploads(files)
        with conversion_job_manager.run_job("pdf-merge") as job:
            output = merge_pdf_and_images(uploads)
            return StreamingResponse(
                output,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": 'attachment; filename="merged_document.pdf"',
                    "X-Job-ID": job.id,
                },
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/split")
async def split_file(
    file: Annotated[UploadFile, File()],
    pages: Annotated[str, Form()],
):
    try:
        uploads = await _read_uploads([file])
        with conversion_job_manager.run_job("pdf-split") as job:
            output = split_pdf(uploads[0][1], pages)
            clean_name = sanitize_filename(uploads[0][0])
            filename = f"{clean_name}_split.pdf"
            return StreamingResponse(
                output,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Job-ID": job.id,
                },
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/images-to-pdf")
async def convert_images_to_pdf(
    files: Annotated[list[UploadFile], File()],
    page_size: Annotated[Literal["A4", "LETTER"], Form()] = "A4",
    orientation: Annotated[Literal["portrait", "landscape"], Form()] = "portrait",
):
    try:
        uploads = await _read_uploads(files)
        with conversion_job_manager.run_job("images-to-pdf") as job:
            output = images_to_pdf(uploads, page_size, orientation)
            return StreamingResponse(
                output,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": 'attachment; filename="images.pdf"',
                    "X-Job-ID": job.id,
                },
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/pdf-to-images")
async def convert_pdf_to_images(
    file: Annotated[UploadFile, File()],
    image_format: Annotated[Literal["jpeg", "png"], Form()] = "png",
    dpi: Annotated[int, Form()] = 150,
):
    try:
        uploads = await _read_uploads([file])
        with conversion_job_manager.run_job("pdf-to-images") as job:
            output = pdf_to_images_zip(uploads[0][1], image_format, dpi)
            clean_name = sanitize_filename(uploads[0][0])
            filename = f"{clean_name}_images.zip"
            return StreamingResponse(
                output,
                media_type="application/zip",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Job-ID": job.id,
                },
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
