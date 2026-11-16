"""Router HTTP untuk fitur Hapus Watermark (PDF, JPG/JPEG, PNG)."""

from __future__ import annotations

import io
import json
import time
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

from app.core import audit
from app.core.jobs import conversion_job_manager
from app.services.job_manager import JobBusyError
from app.services.watermark_remover import (
    MAX_WATERMARK_FILE_SIZE,
    MAX_WATERMARK_PDF_PAGES,
    WatermarkRemovalManifest,
    analyze_watermark_document,
    apply_watermark_removal,
    preview_watermark_removal,
)

router = APIRouter(prefix="/watermark-removal", tags=["Watermark Removal"])

MAX_MANIFEST_JSON_BYTES = 2 * 1024 * 1024  # 2 MB
_UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MiB


async def _read_bounded_upload(file: UploadFile) -> tuple[str, bytes]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nama berkas tidak valid.")

    buf = bytearray()
    while True:
        chunk = await file.read(_UPLOAD_CHUNK_SIZE)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > MAX_WATERMARK_FILE_SIZE:
            raise HTTPException(
                status_code=413, detail="Ukuran berkas melebihi batas maksimal 25 MB."
            )
    return file.filename, bytes(buf)


def _parse_manifest(manifest_json: str) -> WatermarkRemovalManifest:
    if len(manifest_json.encode("utf-8")) > MAX_MANIFEST_JSON_BYTES:
        raise HTTPException(status_code=422, detail="Payload manifest terlalu besar.")
    try:
        raw_payload = json.loads(manifest_json)
    except json.JSONDecodeError as exc:
        raise ValueError("Format JSON manifest tidak valid.") from exc

    try:
        return WatermarkRemovalManifest.model_validate(raw_payload)
    except ValidationError as exc:
        first_err = exc.errors()[0] if exc.errors() else {}
        msg = str(first_err.get("msg") or "Manifest penghapusan tidak valid.")
        raise ValueError(msg) from exc


@router.post("/analyze")
async def analyze_watermark_endpoint(
    file: Annotated[UploadFile, File(...)],
    owner_confirmed: Annotated[bool, Form()] = False,
    include_ocr: Annotated[bool, Form()] = True,
):
    started = time.perf_counter()
    try:
        filename, content = await _read_bounded_upload(file)
        with conversion_job_manager.run_job("watermark-analyze") as job:
            result = analyze_watermark_document(
                content,
                filename=filename,
                owner_confirmed=owner_confirmed,
                include_ocr=include_ocr,
            )
            audit.audit_logger.record(
                "watermark_removal.analyze",
                "succeeded",
                file_kind=result["file_kind"],
                page_count=result["page_count"],
                ocr_status=result["ocr_status"],
                owner_confirmed=bool(owner_confirmed),
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            return JSONResponse(
                status_code=200,
                content={"success": True, "data": result},
                headers={"X-Job-ID": job.id},
            )
    except HTTPException as exc:
        audit.audit_logger.record(
            "watermark_removal.analyze",
            "failed",
            status=exc.status_code,
            error_type="HTTPException",
            owner_confirmed=bool(owner_confirmed),
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise
    except JobBusyError as exc:
        audit.audit_logger.record(
            "watermark_removal.analyze",
            "failed",
            status=429,
            error_type="JobBusyError",
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        audit.audit_logger.record(
            "watermark_removal.analyze",
            "failed",
            status=422,
            error_type="ValueError",
            owner_confirmed=bool(owner_confirmed),
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        audit.audit_logger.record(
            "watermark_removal.analyze",
            "failed",
            status=500,
            error_type=type(exc).__name__,
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise HTTPException(
            status_code=500,
            detail="Gagal menganalisis kandidat watermark dokumen.",
        ) from exc


@router.post("/preview")
async def preview_watermark_endpoint(
    file: Annotated[UploadFile, File(...)],
    manifest_json: Annotated[str, Form(...)],
    page_index: Annotated[int, Form()] = 0,
):
    started = time.perf_counter()
    try:
        if page_index < 0 or page_index >= MAX_WATERMARK_PDF_PAGES:
            raise ValueError(
                f"page_index harus berada pada rentang 0..{MAX_WATERMARK_PDF_PAGES - 1}."
            )
        _, content = await _read_bounded_upload(file)
        manifest = _parse_manifest(manifest_json)
        with conversion_job_manager.run_job("watermark-preview") as job:
            result = preview_watermark_removal(content, manifest, page_index=page_index)
            audit.audit_logger.record(
                "watermark_removal.preview",
                "succeeded",
                file_kind=result["file_kind"],
                page_index=page_index,
                removal_mode=result["removal_mode"],
                owner_confirmed=True,
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            return JSONResponse(
                status_code=200,
                content={"success": True, "data": result},
                headers={"X-Job-ID": job.id},
            )
    except HTTPException as exc:
        audit.audit_logger.record(
            "watermark_removal.preview",
            "failed",
            status=exc.status_code,
            error_type="HTTPException",
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise
    except JobBusyError as exc:
        audit.audit_logger.record(
            "watermark_removal.preview",
            "failed",
            status=429,
            error_type="JobBusyError",
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        audit.audit_logger.record(
            "watermark_removal.preview",
            "failed",
            status=422,
            error_type="ValueError",
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        audit.audit_logger.record(
            "watermark_removal.preview",
            "failed",
            status=500,
            error_type=type(exc).__name__,
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise HTTPException(
            status_code=500,
            detail="Gagal membuat pratinjau penghapusan watermark.",
        ) from exc


@router.post("/apply")
async def apply_watermark_endpoint(
    file: Annotated[UploadFile, File(...)],
    manifest_json: Annotated[str, Form(...)],
):
    started = time.perf_counter()
    try:
        filename, content = await _read_bounded_upload(file)
        manifest = _parse_manifest(manifest_json)
        with conversion_job_manager.run_job("watermark-apply") as job:
            result = apply_watermark_removal(content, manifest, filename=filename)
            audit.audit_logger.record(
                "watermark_removal.apply",
                "succeeded",
                file_kind=result["file_kind"],
                page_count=result["page_count"],
                structural_pages=result["structural_pages"],
                rasterized_pages=result["rasterized_pages"],
                annots_removed=result["annots_removed"],
                owner_confirmed=True,
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            return StreamingResponse(
                io.BytesIO(result["output_bytes"]),
                media_type=result["media_type"],
                headers={
                    "Content-Disposition": f'attachment; filename="{result["filename"]}"',
                    "X-Job-ID": job.id,
                    "X-Original-Size": str(result["original_size_bytes"]),
                    "X-Output-Size": str(result["output_size_bytes"]),
                    "X-Total-Pages": str(result["page_count"]),
                    "X-Structural-Pages": str(result["structural_pages"]),
                    "X-Rasterized-Pages": str(result["rasterized_pages"]),
                    "X-Annots-Removed": str(result["annots_removed"]),
                },
            )
    except HTTPException as exc:
        audit.audit_logger.record(
            "watermark_removal.apply",
            "failed",
            status=exc.status_code,
            error_type="HTTPException",
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise
    except JobBusyError as exc:
        audit.audit_logger.record(
            "watermark_removal.apply",
            "failed",
            status=429,
            error_type="JobBusyError",
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ValueError as exc:
        audit.audit_logger.record(
            "watermark_removal.apply",
            "failed",
            status=422,
            error_type="ValueError",
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        audit.audit_logger.record(
            "watermark_removal.apply",
            "failed",
            status=500,
            error_type=type(exc).__name__,
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        raise HTTPException(
            status_code=500,
            detail="Gagal memproses penghapusan watermark dokumen.",
        ) from exc
