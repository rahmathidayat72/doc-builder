import io
import json
import re
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.jobs import conversion_job_manager
from app.services.job_manager import JobBusyError
from app.services.pdf_tools import (
    add_page_numbers_pdf,
    apply_pdf_editor_changes,
    compress_pdf,
    get_pdf_editor_pages,
    get_tesseract_status,
    images_to_pdf,
    merge_pdf_and_images,
    ocr_pdf,
    pdf_to_images_zip,
    pdf_to_markdown,
    protect_pdf,
    repair_pdf,
    split_pdf,
    split_pdf_ranges_zip,
    unlock_pdf,
    watermark_pdf,
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
        if "LIBREOFFICE_NOT_FOUND" in str(exc):
            return JSONResponse(
                status_code=422,
                content={
                    "success": False,
                    "error_code": "LIBREOFFICE_NOT_FOUND",
                    "message": (
                        "LibreOffice belum terpasang di komputer lokal untuk mengonversi "
                        "berkas DOCX. Silakan instal LibreOffice atau gabungkan berkas PDF "
                        "dan gambar saja."
                    ),
                },
            )
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/split")
async def split_file(
    file: Annotated[UploadFile, File()],
    pages: Annotated[str, Form()],
    output_mode: Annotated[Literal["combined", "ranges"], Form()] = "combined",
):
    try:
        uploads = await _read_uploads([file])
        clean_name = sanitize_filename(uploads[0][0])
        with conversion_job_manager.run_job("pdf-split") as job:
            if output_mode == "ranges":
                output = split_pdf_ranges_zip(uploads[0][1], pages)
                filename = f"{clean_name}_split.zip"
                media_type = "application/zip"
            else:
                output = split_pdf(uploads[0][1], pages)
                filename = f"{clean_name}_split.pdf"
                media_type = "application/pdf"

            return StreamingResponse(
                output,
                media_type=media_type,
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


@router.post("/compress")
async def compress_file(
    file: Annotated[UploadFile, File()],
    level: Annotated[Literal["light", "balanced", "maximum"], Form()] = "balanced",
):
    try:
        uploads = await _read_uploads([file])
        clean_name = sanitize_filename(uploads[0][0])
        with conversion_job_manager.run_job("pdf-compress") as job:
            output, applied, orig_size, out_size = compress_pdf(uploads[0][1], level)
            filename = f"{clean_name}_compressed.pdf"
            return StreamingResponse(
                output,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Job-ID": job.id,
                    "X-Compression-Applied": "true" if applied else "false",
                    "X-Original-Size": str(orig_size),
                    "X-Output-Size": str(out_size),
                },
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/editor/pages")
async def get_editor_pages(file: Annotated[UploadFile, File()]):
    try:
        uploads = await _read_uploads([file])
        with conversion_job_manager.run_job("pdf-editor-pages") as job:
            pages = get_pdf_editor_pages(uploads[0][1])
            return JSONResponse(
                content={
                    "success": True,
                    "filename": uploads[0][0],
                    "total_pages": len(pages),
                    "pages": pages,
                    "job_id": job.id,
                }
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/editor/apply")
async def apply_editor(
    file: Annotated[UploadFile, File()],
    manifest: Annotated[str, Form()],
    output_mode: Annotated[Literal["edited", "signed"], Form()] = "edited",
):
    try:
        uploads = await _read_uploads([file])
        try:
            manifest_data = json.loads(manifest)
            if not isinstance(manifest_data, dict):
                raise ValueError("Manifest harus berupa objek JSON.")
        except Exception as exc:
            raise HTTPException(
                status_code=422, detail=f"Format manifest tidak valid: {exc}"
            ) from exc

        clean_name = sanitize_filename(uploads[0][0])
        suffix = "signed" if output_mode == "signed" else "edited"
        with conversion_job_manager.run_job("pdf-editor-apply") as job:
            output = apply_pdf_editor_changes(uploads[0][1], manifest_data)
            filename = f"{clean_name}_{suffix}.pdf"
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


@router.post("/protect")
async def protect_file(
    file: Annotated[UploadFile, File()],
    password: Annotated[str, Form()],
):
    try:
        uploads = await _read_uploads([file])
        clean_name = sanitize_filename(uploads[0][0])
        with conversion_job_manager.run_job("pdf-protect") as job:
            output = protect_pdf(uploads[0][1], password)
            filename = f"{clean_name}_protected.pdf"
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


@router.post("/unlock")
async def unlock_file(
    file: Annotated[UploadFile, File()],
    password: Annotated[str, Form()],
):
    try:
        uploads = await _read_uploads([file])
        clean_name = sanitize_filename(uploads[0][0])
        with conversion_job_manager.run_job("pdf-unlock") as job:
            output = unlock_pdf(uploads[0][1], password)
            filename = f"{clean_name}_unlocked.pdf"
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


@router.post("/repair")
async def repair_file(
    file: Annotated[UploadFile, File()],
):
    try:
        uploads = await _read_uploads([file])
        clean_name = sanitize_filename(uploads[0][0])
        with conversion_job_manager.run_job("pdf-repair") as job:
            output, meta = repair_pdf(uploads[0][1])
            filename = f"{clean_name}_repaired.pdf"
            return StreamingResponse(
                output,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Job-ID": job.id,
                    "X-Pages-Recovered": str(meta.get("page_count", 0)),
                    "X-Original-Size": str(meta.get("original_size", 0)),
                    "X-Output-Size": str(meta.get("repaired_size", 0)),
                },
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/ocr/status")
async def get_ocr_engine_status():
    return get_tesseract_status()


@router.post("/ocr")
async def ocr_file(
    file: Annotated[UploadFile, File()],
    language: Annotated[str, Form()] = "eng",
):
    try:
        uploads = await _read_uploads([file])
        clean_name = sanitize_filename(uploads[0][0])
        with conversion_job_manager.run_job("pdf-ocr") as job:
            output, meta = ocr_pdf(uploads[0][1], language)
            filename = f"{clean_name}_searchable.pdf"
            return StreamingResponse(
                output,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Job-ID": job.id,
                    "X-OCR-Pages": str(meta.get("page_count", 0)),
                    "X-Original-Size": str(meta.get("original_size", 0)),
                    "X-Output-Size": str(meta.get("output_size", 0)),
                },
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/watermark")
async def watermark_file(
    file: Annotated[UploadFile, File()],
    mode: Annotated[str, Form()] = "text",
    text: Annotated[str, Form()] = "DRAFT",
    image: Annotated[UploadFile | None, File()] = None,
    opacity: Annotated[float, Form()] = 0.3,
    rotation: Annotated[float, Form()] = 45.0,
    position: Annotated[str, Form()] = "center",
    fontsize: Annotated[int, Form()] = 40,
    color: Annotated[str, Form()] = "#e11d48",
    pages: Annotated[str, Form()] = "all",
):
    try:
        uploads = await _read_uploads([file])
        clean_name = sanitize_filename(uploads[0][0])
        image_bytes: bytes | None = None
        if mode == "image":
            if image is not None and image.filename:
                image_bytes = await image.read()
                if len(image_bytes) > MAX_TOTAL_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=413, detail="Ukuran gambar melebihi batas 25 MB."
                    )

        with conversion_job_manager.run_job("pdf-watermark") as job:
            output, meta = watermark_pdf(
                file_bytes=uploads[0][1],
                mode=mode,  # type: ignore
                text=text,
                image_bytes=image_bytes,
                opacity=opacity,
                rotation=rotation,
                position=position,
                fontsize=fontsize,
                color_hex=color,
                pages_str=pages,
            )
            filename = f"{clean_name}_watermarked.pdf"
            return StreamingResponse(
                output,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Job-ID": job.id,
                    "X-Watermarked-Pages": str(meta.get("pages_watermarked", 0)),
                    "X-Original-Size": str(meta.get("original_size", 0)),
                    "X-Output-Size": str(meta.get("output_size", 0)),
                },
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/page-numbers")
async def add_page_numbers_file(
    file: Annotated[UploadFile, File()],
    format: Annotated[str, Form()] = "{n}",
    position: Annotated[str, Form()] = "bottom-center",
    margin: Annotated[int, Form()] = 30,
    start_page: Annotated[int, Form()] = 1,
    start_number: Annotated[int, Form()] = 1,
    fontsize: Annotated[int, Form()] = 10,
    color: Annotated[str, Form()] = "#000000",
    pages: Annotated[str, Form()] = "all",
):
    try:
        uploads = await _read_uploads([file])
        clean_name = sanitize_filename(uploads[0][0])
        with conversion_job_manager.run_job("pdf-page-numbers") as job:
            output, meta = add_page_numbers_pdf(
                file_bytes=uploads[0][1],
                format_pattern=format,
                position=position,
                margin=margin,
                start_page=start_page,
                start_number=start_number,
                fontsize=fontsize,
                color_hex=color,
                pages_str=pages,
            )
            filename = f"{clean_name}_numbered.pdf"
            return StreamingResponse(
                output,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Job-ID": job.id,
                    "X-Numbered-Pages": str(meta.get("pages_numbered", 0)),
                    "X-Original-Size": str(meta.get("original_size", 0)),
                    "X-Output-Size": str(meta.get("output_size", 0)),
                },
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/pdf-to-markdown")
async def pdf_to_markdown_file(
    file: Annotated[UploadFile, File()],
    pages: Annotated[str, Form()] = "all",
):
    try:
        uploads = await _read_uploads([file])
        clean_name = sanitize_filename(uploads[0][0])
        with conversion_job_manager.run_job("pdf-to-markdown") as job:
            md_text, meta = pdf_to_markdown(
                file_bytes=uploads[0][1],
                pages_str=pages,
            )
            filename = f"{clean_name}.md"
            stream = io.BytesIO(md_text.encode("utf-8"))
            return StreamingResponse(
                stream,
                media_type="text/markdown; charset=utf-8",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Job-ID": job.id,
                    "X-Total-Pages": str(meta.get("total_pages", 0)),
                    "X-Converted-Pages": str(meta.get("converted_pages", 0)),
                    "X-Markdown-Length": str(meta.get("markdown_length", 0)),
                    "X-Original-Size": str(meta.get("original_size", 0)),
                },
            )
    except JobBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


