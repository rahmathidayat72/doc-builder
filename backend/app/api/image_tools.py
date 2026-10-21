from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.jobs import conversion_job_manager
from app.services.image_resizer import (
    MAX_IMAGE_FILE_SIZE,
    resize_image_to_target,
    sanitize_filename,
)
from app.services.job_manager import JobBusyError

router = APIRouter(prefix="/image-tools", tags=["Image Tools"])


@router.post("/resize")
async def resize_image_endpoint(
    file: Annotated[UploadFile, File(...)],
    target_kb: Annotated[int, Form(...)],
    output_format: Annotated[Literal["jpeg", "png", "webp"], Form()] = "jpeg",
    strip_exif: Annotated[bool, Form()] = True,
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nama berkas gambar tidak valid.")

    content = await file.read()
    if len(content) > MAX_IMAGE_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Ukuran upload melebihi 25 MB.")

    try:
        with conversion_job_manager.run_job("image-resize") as job:
            output_buf, orig_size, final_size = resize_image_to_target(
                file_bytes=content,
                target_kb=target_kb,
                output_format=output_format,
                strip_exif_data=strip_exif,
            )

            clean_name = sanitize_filename(file.filename)
            ext = "jpg" if output_format == "jpeg" else output_format
            filename = f"{clean_name}_resized.{ext}"
            media_type = f"image/{'jpeg' if ext == 'jpg' else ext}"

            return StreamingResponse(
                output_buf,
                media_type=media_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Original-Size": str(orig_size),
                    "X-Optimized-Size": str(final_size),
                    "X-Job-ID": job.id,
                },
            )
    except JobBusyError as exc:
        msg = f"Sistem sedang sibuk ({exc.active_job_id}). Coba sesaat lagi."
        raise HTTPException(status_code=429, detail=msg) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Gagal memproses pengubahan ukuran citra: {exc}"
        ) from exc
