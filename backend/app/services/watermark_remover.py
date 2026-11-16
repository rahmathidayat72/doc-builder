"""Layanan analisis kandidat watermark, validasi manifest 0..1, dan guard keamanan."""

from __future__ import annotations

import base64
import hashlib
import io
import math
import re
from collections import defaultdict
from typing import Any, Literal

import cv2
import numpy as np
import pymupdf
from PIL import Image, ImageOps
from pydantic import BaseModel, Field, field_validator, model_validator

from app.services.pdf_tools import (
    detect_image_format,
    get_tesseract_status,
    has_digital_signature,
    validate_pdf,
)

MAX_WATERMARK_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
MAX_WATERMARK_PDF_PAGES = 50
MAX_PIXELS = 50_000_000
PDF_RASTER_DPI = 150
DEFAULT_INPAINT_RADIUS = 5
DEFAULT_BRUSH_DILATE_PX = 3
MAX_PREVIEW_WIDTH = 960
MAX_STROKES_PER_PAGE = 200
MAX_POINTS_PER_STROKE = 2000
MAX_CANDIDATE_BOXES_PER_PAGE = 64
MAX_TOTAL_MANIFEST_PAGES = 50
SAFE_ANNOT_TYPES = frozenset({"Stamp", "Watermark", "FreeText"})
_WATERMARK_KEYWORDS = (
    "DRAFT",
    "CONFIDENTIAL",
    "SAMPLE",
    "WATERMARK",
    "RAHASIA",
    "PREVIEW",
    "SATUKIT",
    "COPY",
    "SPECIMEN",
    "INTERNAL",
)
_SHA256_HEX_RE = re.compile(r"^[0-9a-f]{64}$")


def compute_file_sha256(file_bytes: bytes) -> str:
    """Menghitung SHA-256 hex lowercase dari payload berkas."""
    return hashlib.sha256(file_bytes).hexdigest()


def _sanitize_name(filename: str) -> str:
    base = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    name_only = base.rsplit(".", 1)[0] if "." in base else base
    clean = re.sub(r"[^a-zA-Z0-9_-]", "_", name_only).strip("_")
    return clean or "document"


def _check_unit_float(value: float, field_name: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{field_name} harus berupa angka.")
    val = float(value)
    if not math.isfinite(val):
        raise ValueError(f"{field_name} tidak boleh NaN atau Infinity.")
    if val < 0.0 or val > 1.0:
        raise ValueError(f"{field_name} harus berada pada rentang ternormalisasi 0.0..1.0.")
    return val


class NormalizedPoint(BaseModel):
    x: float
    y: float

    @field_validator("x", "y")
    @classmethod
    def validate_coord(cls, v: float, info: Any) -> float:
        return _check_unit_float(v, str(info.field_name))


class NormalizedBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float

    @field_validator("x0", "y0", "x1", "y1")
    @classmethod
    def validate_coord(cls, v: float, info: Any) -> float:
        return _check_unit_float(v, str(info.field_name))

    @model_validator(mode="after")
    def validate_bounds(self) -> NormalizedBox:
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise ValueError("Koordinat NormalizedBox tidak valid (x1 > x0 dan y1 > y0 wajib).")
        return self


class BrushStroke(BaseModel):
    mode: Literal["add", "erase"]
    brush_radius_norm: float
    points: list[NormalizedPoint] = Field(min_length=1, max_length=MAX_POINTS_PER_STROKE)

    @field_validator("brush_radius_norm")
    @classmethod
    def validate_radius(cls, v: float) -> float:
        val = _check_unit_float(v, "brush_radius_norm")
        if val <= 0.0 or val > 0.25:
            raise ValueError("brush_radius_norm harus berada pada rentang (0.0, 0.25].")
        return val


class PageRemovalInstruction(BaseModel):
    page_index: int = Field(ge=0, lt=MAX_WATERMARK_PDF_PAGES)
    annot_xrefs: list[int] = Field(default_factory=list, max_length=MAX_CANDIDATE_BOXES_PER_PAGE)
    selected_boxes: list[NormalizedBox] = Field(
        default_factory=list, max_length=MAX_CANDIDATE_BOXES_PER_PAGE
    )
    strokes: list[BrushStroke] = Field(default_factory=list, max_length=MAX_STROKES_PER_PAGE)

    @field_validator("annot_xrefs")
    @classmethod
    def validate_xrefs(cls, v: list[int]) -> list[int]:
        seen: set[int] = set()
        for xref in v:
            if xref <= 0:
                raise ValueError("annot_xref harus berupa bilangan bulat positif.")
            if xref in seen:
                raise ValueError("Duplikat annot_xref tidak diperbolehkan pada halaman yang sama.")
            seen.add(xref)
        return v


class WatermarkRemovalManifest(BaseModel):
    file_sha256: str
    owner_confirmed: bool
    confirm_pdf_rasterization: bool = False
    inpaint_radius: int = Field(default=DEFAULT_INPAINT_RADIUS, ge=1, le=15)
    pages: list[PageRemovalInstruction] = Field(
        min_length=1, max_length=MAX_TOTAL_MANIFEST_PAGES
    )

    @field_validator("file_sha256")
    @classmethod
    def validate_sha256(cls, v: str) -> str:
        clean = v.strip().lower()
        if not _SHA256_HEX_RE.match(clean):
            raise ValueError("file_sha256 harus berupa digest SHA-256 hex 64 karakter.")
        return clean

    @field_validator("owner_confirmed")
    @classmethod
    def validate_owner_confirmed(cls, v: bool) -> bool:
        if not v:
            raise ValueError(
                "Harap centang konfirmasi hak kepemilikan atau izin modifikasi dokumen."
            )
        return v

    @model_validator(mode="after")
    def validate_pages_and_actions(self) -> WatermarkRemovalManifest:
        seen_pages: set[int] = set()
        has_any_action = False
        for page_item in self.pages:
            if page_item.page_index in seen_pages:
                raise ValueError(f"Duplikat instruksi untuk page_index={page_item.page_index}.")
            seen_pages.add(page_item.page_index)
            if page_item.annot_xrefs or page_item.selected_boxes or page_item.strokes:
                has_any_action = True
        if not has_any_action:
            raise ValueError(
                "Pilih minimal satu kandidat watermark atau goresan kuas sebelum memproses."
            )
        return self


def detect_supported_file_kind(file_bytes: bytes) -> Literal["pdf", "jpeg", "png"]:
    """Memvalidasi ukuran non-kosong, batas 25 MB, dan magic bytes PDF/JPG/PNG."""
    if not file_bytes:
        raise ValueError("Berkas kosong (0 byte).")
    if len(file_bytes) > MAX_WATERMARK_FILE_SIZE:
        raise ValueError("Ukuran berkas melebihi batas maksimal 25 MB.")
    if validate_pdf(file_bytes):
        return "pdf"
    img_fmt = detect_image_format(file_bytes)
    if img_fmt == "JPEG":
        return "jpeg"
    if img_fmt == "PNG":
        return "png"
    raise ValueError("Format berkas tidak didukung. Gunakan berkas PDF, JPG/JPEG, atau PNG.")


def _open_validated_image(
    file_bytes: bytes, expected_kind: Literal["jpeg", "png"]
) -> dict[str, Any]:
    """Memvalidasi integritas gambar Pillow, pixel bomb, animasi, dan mode alpha."""
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        with Image.open(io.BytesIO(file_bytes)) as verified:
            verified.verify()
    except Image.DecompressionBombError as exc:
        raise ValueError("Resolusi gambar melebihi batas keamanan 50 megapiksel.") from exc
    except Exception as exc:
        raise ValueError(f"Berkas gambar rusak atau tidak valid: {exc}") from exc

    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            actual_fmt = (img.format or "").upper()
            expected_fmt = "JPEG" if expected_kind == "jpeg" else "PNG"
            if actual_fmt != expected_fmt:
                raise ValueError("Header biner gambar tidak sesuai dengan konten berkas.")
            if getattr(img, "is_animated", False) or getattr(img, "n_frames", 1) > 1:
                raise ValueError("PNG animasi (APNG) tidak didukung.")
            try:
                transposed = ImageOps.exif_transpose(img)
            except Exception:
                transposed = img
            width, height = transposed.size
            if width <= 0 or height <= 0 or width * height > MAX_PIXELS:
                raise ValueError("Resolusi gambar melebihi batas keamanan 50 megapiksel.")

            has_alpha = expected_kind == "png" and (
                "A" in transposed.mode
                or (transposed.mode == "P" and "transparency" in transposed.info)
            )

            # Buat gambar preview bersih tanpa EXIF untuk canvas UI
            prev_scale = min(1.0, MAX_PREVIEW_WIDTH / max(1, width))
            prev_w = max(1, int(round(width * prev_scale)))
            prev_h = max(1, int(round(height * prev_scale)))

            if has_alpha:
                clean_prev = Image.new("RGBA", transposed.size)
                rgba_src = transposed.convert("RGBA")
                clean_prev.paste(rgba_src)
                if (prev_w, prev_h) != transposed.size:
                    clean_prev = clean_prev.resize((prev_w, prev_h), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                clean_prev.save(buf, format="PNG")
                mime = "image/png"
            else:
                rgb_src = transposed.convert("RGB")
                clean_prev = Image.new("RGB", transposed.size)
                clean_prev.paste(rgb_src)
                if (prev_w, prev_h) != transposed.size:
                    clean_prev = clean_prev.resize((prev_w, prev_h), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                clean_prev.save(buf, format="JPEG", quality=85)
                mime = "image/jpeg"

            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            return {
                "width": width,
                "height": height,
                "preview_width": prev_w,
                "preview_height": prev_h,
                "has_alpha": has_alpha,
                "preview_data_url": f"data:{mime};base64,{b64}",
            }
    except Image.DecompressionBombError as exc:
        raise ValueError("Resolusi gambar melebihi batas keamanan 50 megapiksel.") from exc


def _open_validated_pdf(file_bytes: bytes) -> pymupdf.Document:
    """Membuka PDF dan menegakkan penolakan fail-closed untuk encrypted, signed, & >50 hal."""
    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Berkas PDF rusak atau gagal dibuka: {exc}") from exc

    try:
        if doc.is_encrypted or doc.needs_pass:
            raise ValueError(
                "Berkas PDF terenkripsi password tidak didukung. "
                "Buka kunci PDF terlebih dahulu."
            )
        if doc.page_count == 0:
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if doc.page_count > MAX_WATERMARK_PDF_PAGES:
            raise ValueError(
                f"Analisis interaktif Hapus Watermark dibatasi maksimal "
                f"{MAX_WATERMARK_PDF_PAGES} halaman per proses."
            )
        if has_digital_signature(doc):
            raise ValueError(
                "Berkas PDF memuat tanda tangan digital. "
                "Pemrosesan ditolak untuk menjaga keabsahan tanda tangan."
            )
        return doc
    except Exception:
        doc.close()
        raise


def _normalize_rect(rect: pymupdf.Rect, page_rect: pymupdf.Rect) -> list[float]:
    w = max(1.0, float(page_rect.width))
    h = max(1.0, float(page_rect.height))
    x0 = max(0.0, min(1.0, float(rect.x0) / w))
    y0 = max(0.0, min(1.0, float(rect.y0) / h))
    x1 = max(x0 + 1e-4, min(1.0, float(rect.x1) / w))
    y1 = max(y0 + 1e-4, min(1.0, float(rect.y1) / h))
    return [round(x0, 5), round(y0, 5), round(min(1.0, x1), 5), round(min(1.0, y1), 5)]


def _quantize_box(box: list[float], step: float = 0.04) -> tuple[int, int, int, int]:
    return (
        round(box[0] / step),
        round(box[1] / step),
        round(box[2] / step),
        round(box[3] / step),
    )


def _is_watermark_like_span(span: dict[str, Any], text: str) -> bool:
    """Heuristik DEC-025 untuk membedakan teks watermark dari teks paragraf/tabel biasa."""
    size = float(span.get("size", 0.0))
    dx, dy = span.get("dir", (1.0, 0.0))
    is_rotated = abs(float(dx) - 1.0) > 0.05 or abs(float(dy)) > 0.05
    color_int = int(span.get("color", 0))
    r = (color_int >> 16) & 0xFF
    g = (color_int >> 8) & 0xFF
    b = color_int & 0xFF
    is_light_or_tinted = (r > 180 and g > 180 and b > 180) or (r > 170 and g < 110 and b < 110)
    upper = text.upper()
    has_kw = any(kw in upper for kw in _WATERMARK_KEYWORDS)
    return is_rotated or size >= 20.0 or (is_light_or_tinted and size >= 14.0) or (
        has_kw and size >= 14.0
    )


def _pick_ocr_language(available_langs: list[str]) -> str:
    lang_set = set(available_langs)
    if "ind" in lang_set and "eng" in lang_set:
        return "ind+eng"
    if "eng" in lang_set:
        return "eng"
    if "ind" in lang_set:
        return "ind"
    return available_langs[0] if available_langs else "eng"


def _extract_ocr_candidates_from_pixmap(
    pix: pymupdf.Pixmap,
    page_index: int,
    tessdata: str,
    language: str,
    id_start: int,
) -> list[dict[str, Any]]:
    """Menjalankan OCR lokal via PyMuPDF pdfocr_tobytes untuk menemukan kandidat teks watermark."""
    ocr_pdf_bytes = pix.pdfocr_tobytes(compress=False, language=language, tessdata=tessdata)
    ocr_doc = pymupdf.open(stream=ocr_pdf_bytes, filetype="pdf")
    candidates: list[dict[str, Any]] = []
    try:
        if ocr_doc.page_count == 0:
            return candidates
        ocr_page = ocr_doc[0]
        prect = ocr_page.rect
        text_dict = ocr_page.get_text("dict")
        idx_counter = id_start
        for block in text_dict.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                line_dir = line.get("dir", (1.0, 0.0))
                is_rotated = abs(float(line_dir[0]) - 1.0) > 0.05 or abs(float(line_dir[1])) > 0.05
                for span in line.get("spans", []):
                    txt = (span.get("text") or "").strip()
                    if len(txt) < 3:
                        continue
                    nbox = _normalize_rect(pymupdf.Rect(span["bbox"]), prect)
                    box_h = nbox[3] - nbox[1]
                    has_kw = any(kw in txt.upper() for kw in _WATERMARK_KEYWORDS)
                    if has_kw or is_rotated or (0.045 <= box_h <= 0.45):
                        idx_counter += 1
                        candidates.append({
                            "id": f"p{page_index}-ocr-{idx_counter}",
                            "page_index": page_index,
                            "source": "ocr_text",
                            "label": f"Teks OCR: {txt[:32]}",
                            "confidence": 0.78 if has_kw or is_rotated else 0.62,
                            "removal_mode": "raster",
                            "annot_xref": None,
                            "bbox_norm": nbox,
                            "requires_rasterization": True,
                        })
                        if len(candidates) >= MAX_CANDIDATE_BOXES_PER_PAGE:
                            return candidates
        return candidates
    finally:
        ocr_doc.close()


def _detect_pdf_structural_candidates(doc: pymupdf.Document) -> dict[int, list[dict[str, Any]]]:
    """Mendeteksi kandidat struktural PDF: annotation aman & objek berulang."""
    per_page: dict[int, list[dict[str, Any]]] = defaultdict(list)
    text_occ: dict[tuple[str, tuple[int, int, int, int]], list[tuple[int, list[float], str]]] = (
        defaultdict(list)
    )
    img_occ: dict[tuple[str, tuple[int, int, int, int]], list[tuple[int, list[float]]]] = (
        defaultdict(list)
    )

    for p_idx in range(doc.page_count):
        page = doc[p_idx]
        prect = page.rect

        # 1. Annotation Stamp / Watermark / FreeText (dapat dihapus struktural tanpa rasterisasi)
        annot_counter = 0
        for annot in page.annots():
            atype = annot.type[1] if annot.type else "Unknown"
            if atype in SAFE_ANNOT_TYPES:
                annot_counter += 1
                per_page[p_idx].append({
                    "id": f"p{p_idx}-annot-{annot.xref}",
                    "page_index": p_idx,
                    "source": "pdf_annotation",
                    "label": f"Annotation {atype} (#{annot_counter})",
                    "confidence": 0.96,
                    "removal_mode": "structural",
                    "annot_xref": int(annot.xref),
                    "bbox_norm": _normalize_rect(annot.rect, prect),
                    "requires_rasterization": False,
                })

        # 2. Teks berulang dengan heuristik watermark DEC-025
        text_dict = page.get_text("dict")
        for block in text_dict.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                line_dir = line.get("dir", (1.0, 0.0))
                for span in line.get("spans", []):
                    txt = (span.get("text") or "").strip()
                    if len(txt) < 3:
                        continue
                    span_with_dir = {**span, "dir": span.get("dir", line_dir)}
                    if not _is_watermark_like_span(span_with_dir, txt):
                        continue
                    nbox = _normalize_rect(pymupdf.Rect(span["bbox"]), prect)
                    key = (txt.lower(), _quantize_box(nbox))
                    text_occ[key].append((p_idx, nbox, txt))

        # 3. Gambar berulang antarhalaman (kecuali gambar latar scan >85% halaman)
        for img_info in page.get_images(full=True):
            xref = int(img_info[0])
            try:
                img_dict = doc.extract_image(xref)
                digest = hashlib.sha256(img_dict["image"]).hexdigest()[:16]
            except Exception:
                digest = f"xref:{xref}"
            for irect in page.get_image_rects(xref):
                nbox = _normalize_rect(irect, prect)
                area_ratio = (nbox[2] - nbox[0]) * (nbox[3] - nbox[1])
                if area_ratio > 0.85:
                    continue
                key = (digest, _quantize_box(nbox))
                img_occ[key].append((p_idx, nbox))

    if doc.page_count >= 2:
        txt_id = 0
        for occs in text_occ.values():
            if len({p for p, _, _ in occs}) >= 2:
                for p_idx, nbox, raw_txt in occs:
                    if len(per_page[p_idx]) >= MAX_CANDIDATE_BOXES_PER_PAGE:
                        continue
                    txt_id += 1
                    per_page[p_idx].append({
                        "id": f"p{p_idx}-rtxt-{txt_id}",
                        "page_index": p_idx,
                        "source": "repeated_text",
                        "label": f"Teks berulang: {raw_txt[:32]}",
                        "confidence": 0.9,
                        "removal_mode": "raster",
                        "annot_xref": None,
                        "bbox_norm": nbox,
                        "requires_rasterization": True,
                    })

        img_id = 0
        for occs in img_occ.values():
            if len({p for p, _ in occs}) >= 2:
                for p_idx, nbox in occs:
                    if len(per_page[p_idx]) >= MAX_CANDIDATE_BOXES_PER_PAGE:
                        continue
                    img_id += 1
                    per_page[p_idx].append({
                        "id": f"p{p_idx}-rimg-{img_id}",
                        "page_index": p_idx,
                        "source": "repeated_image",
                        "label": f"Logo/gambar berulang #{img_id}",
                        "confidence": 0.88,
                        "removal_mode": "raster",
                        "annot_xref": None,
                        "bbox_norm": nbox,
                        "requires_rasterization": True,
                    })

    return per_page


def analyze_watermark_document(
    file_bytes: bytes,
    filename: str = "document",
    owner_confirmed: bool = False,
    include_ocr: bool = True,
) -> dict[str, Any]:
    """
    Menganalisis PDF/JPG/PNG untuk mendeteksi kandidat watermark & menghasilkan preview aman.
    Kegagalan atau ketiadaan OCR Tesseract bersifat non-blocking.
    """
    if not owner_confirmed:
        raise ValueError("Harap centang konfirmasi hak kepemilikan atau izin modifikasi dokumen.")

    file_kind = detect_supported_file_kind(file_bytes)
    file_sha256 = compute_file_sha256(file_bytes)
    safe_name = _sanitize_name(filename)

    ocr_status = "skipped"
    ocr_message = "Deteksi OCR dilewati sesuai pilihan."
    tessdata_path: str | None = None
    ocr_lang = "eng"

    if include_ocr:
        try:
            t_status = get_tesseract_status()
            if t_status.get("available") and t_status.get("tessdata"):
                tessdata_path = str(t_status["tessdata"])
                ocr_lang = _pick_ocr_language(list(t_status.get("languages") or []))
                ocr_status = "completed"
                ocr_message = "Deteksi OCR lokal tersedia dan dijalankan."
            else:
                ocr_status = "unavailable"
                ocr_message = (
                    "Engine OCR server tidak tersedia; gunakan kandidat struktural "
                    "atau kuas manual."
                )
        except Exception:
            ocr_status = "unavailable"
            ocr_message = "Pemeriksaan OCR gagal; gunakan kuas manual."

    if file_kind in {"jpeg", "png"}:
        img_meta = _open_validated_image(file_bytes, file_kind)
        candidates: list[dict[str, Any]] = []
        if include_ocr and tessdata_path:
            try:
                pix = pymupdf.Pixmap(file_bytes)
                try:
                    candidates = _extract_ocr_candidates_from_pixmap(
                        pix, page_index=0, tessdata=tessdata_path, language=ocr_lang, id_start=0
                    )
                finally:
                    pix = None
            except Exception:
                ocr_status = "failed"
                ocr_message = "Deteksi OCR pada gambar gagal; lanjutkan dengan kuas manual."

        return {
            "file_sha256": file_sha256,
            "file_kind": file_kind,
            "filename": safe_name,
            "page_count": 1,
            "ocr_status": ocr_status,
            "ocr_message": ocr_message,
            "pages": [
                {
                    "page_index": 0,
                    "page_number": 1,
                    "width": img_meta["width"],
                    "height": img_meta["height"],
                    "preview_width": img_meta["preview_width"],
                    "preview_height": img_meta["preview_height"],
                    "has_alpha": img_meta["has_alpha"],
                    "has_vector_content": False,
                    "preview_data_url": img_meta["preview_data_url"],
                    "candidates": candidates,
                }
            ],
        }

    # Jalur PDF
    doc = _open_validated_pdf(file_bytes)
    try:
        structural_map = _detect_pdf_structural_candidates(doc)
        pages_out: list[dict[str, Any]] = []

        for p_idx in range(doc.page_count):
            page = doc[p_idx]
            prect = page.rect
            prev_scale = min(2.0, MAX_PREVIEW_WIDTH / max(1.0, prect.width))
            prev_pix = page.get_pixmap(matrix=pymupdf.Matrix(prev_scale, prev_scale), alpha=False)
            prev_jpg = prev_pix.tobytes("jpeg")
            b64_prev = base64.b64encode(prev_jpg).decode("ascii")

            page_candidates = list(structural_map.get(p_idx, []))
            can_ocr = (
                include_ocr
                and tessdata_path
                and len(page_candidates) < MAX_CANDIDATE_BOXES_PER_PAGE
            )
            if can_ocr:
                try:
                    ocr_pix = page.get_pixmap(dpi=PDF_RASTER_DPI, alpha=False)
                    ocr_items = _extract_ocr_candidates_from_pixmap(
                        ocr_pix,
                        page_index=p_idx,
                        tessdata=tessdata_path,
                        language=ocr_lang,
                        id_start=len(page_candidates),
                    )
                    remaining_slots = MAX_CANDIDATE_BOXES_PER_PAGE - len(page_candidates)
                    page_candidates.extend(ocr_items[:remaining_slots])
                except Exception:
                    ocr_status = "failed"
                    ocr_message = (
                        "Sebagian deteksi OCR halaman PDF gagal; lanjutkan dengan kandidat "
                        "struktural atau kuas manual."
                    )

            has_vector = bool(
                page.get_text().strip() or page.get_drawings() or list(page.get_links())
            )
            pages_out.append({
                "page_index": p_idx,
                "page_number": p_idx + 1,
                "width": round(float(prect.width), 2),
                "height": round(float(prect.height), 2),
                "preview_width": int(prev_pix.width),
                "preview_height": int(prev_pix.height),
                "has_alpha": False,
                "has_vector_content": has_vector,
                "preview_data_url": f"data:image/jpeg;base64,{b64_prev}",
                "candidates": page_candidates,
            })

        return {
            "file_sha256": file_sha256,
            "file_kind": "pdf",
            "filename": safe_name,
            "page_count": doc.page_count,
            "ocr_status": ocr_status,
            "ocr_message": ocr_message,
            "pages": pages_out,
        }
    finally:
        doc.close()


def validate_manifest_against_document(
    file_bytes: bytes,
    manifest: WatermarkRemovalManifest,
) -> dict[str, Any]:
    """
    Memvalidasi kesesuaian SHA-256 berkas, batas halaman, keabsahan annot_xref per halaman,
    serta penegakan konfirmasi rasterisasi eksplisit jika halaman PDF harus diraster ulang.
    """
    if not manifest.owner_confirmed:
        raise ValueError("Harap centang konfirmasi hak kepemilikan atau izin modifikasi dokumen.")

    file_kind = detect_supported_file_kind(file_bytes)
    actual_sha256 = compute_file_sha256(file_bytes)
    if actual_sha256 != manifest.file_sha256:
        raise ValueError(
            "Manifest penghapusan tidak cocok dengan berkas aktif (SHA-256 tidak sesuai)."
        )

    if file_kind in {"jpeg", "png"}:
        _open_validated_image(file_bytes, file_kind)
        if len(manifest.pages) != 1 or manifest.pages[0].page_index != 0:
            raise ValueError("Instruksi gambar hanya boleh menargetkan page_index=0.")
        if manifest.pages[0].annot_xrefs:
            raise ValueError("Berkas gambar tidak mendukung annot_xref PDF.")
        return {
            "file_kind": file_kind,
            "page_count": 1,
            "structural_pages": [],
            "raster_target_pages": [0],
            "requires_rasterization": False,
        }

    doc = _open_validated_pdf(file_bytes)
    try:
        structural_pages: list[int] = []
        raster_target_pages: list[int] = []

        for page_instr in manifest.pages:
            p_idx = page_instr.page_index
            if p_idx < 0 or p_idx >= doc.page_count:
                raise ValueError(
                    f"page_index={p_idx} berada di luar jumlah halaman PDF ({doc.page_count})."
                )

            page = doc[p_idx]
            if page_instr.annot_xrefs:
                valid_annot_xrefs = {
                    int(a.xref)
                    for a in page.annots()
                    if a.type and a.type[1] in SAFE_ANNOT_TYPES
                }
                for req_xref in page_instr.annot_xrefs:
                    if req_xref not in valid_annot_xrefs:
                        raise ValueError(
                            f"annot_xref={req_xref} tidak valid atau bukan annotation "
                            f"Stamp/Watermark pada halaman {p_idx + 1}."
                        )

            needs_raster = bool(page_instr.selected_boxes or page_instr.strokes)
            if needs_raster:
                raster_target_pages.append(p_idx)
            elif page_instr.annot_xrefs:
                structural_pages.append(p_idx)

        requires_rasterization = len(raster_target_pages) > 0
        if requires_rasterization and not manifest.confirm_pdf_rasterization:
            raise ValueError(
                "Halaman PDF terpilih akan diraster ulang untuk inpainting sehingga teks "
                "selectable, vektor, dan tautan di halaman tersebut tidak lagi interaktif. "
                "Setujui konfirmasi rasterisasi terlebih dahulu."
            )

        return {
            "file_kind": "pdf",
            "page_count": doc.page_count,
            "structural_pages": structural_pages,
            "raster_target_pages": raster_target_pages,
            "requires_rasterization": requires_rasterization,
        }
    finally:
        doc.close()


def _decode_image_arrays(
    file_bytes: bytes, expected_kind: Literal["jpeg", "png"]
) -> tuple[np.ndarray, np.ndarray | None]:
    """Mendekode citra JPG/PNG tervalidasi ke array (bgr, alpha_or_none) pasca EXIF transpose."""
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        with Image.open(io.BytesIO(file_bytes)) as verified:
            verified.verify()
    except Image.DecompressionBombError as exc:
        raise ValueError("Resolusi gambar melebihi batas keamanan 50 megapiksel.") from exc
    except Exception as exc:
        raise ValueError(f"Berkas gambar rusak atau tidak valid: {exc}") from exc

    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            actual_fmt = (img.format or "").upper()
            expected_fmt = "JPEG" if expected_kind == "jpeg" else "PNG"
            if actual_fmt != expected_fmt:
                raise ValueError("Header biner gambar tidak sesuai dengan konten berkas.")
            if getattr(img, "is_animated", False) or getattr(img, "n_frames", 1) > 1:
                raise ValueError("PNG animasi (APNG) tidak didukung.")
            try:
                transposed = ImageOps.exif_transpose(img)
            except Exception:
                transposed = img
            width, height = transposed.size
            if width <= 0 or height <= 0 or width * height > MAX_PIXELS:
                raise ValueError("Resolusi gambar melebihi batas keamanan 50 megapiksel.")

            has_alpha = expected_kind == "png" and (
                "A" in transposed.mode
                or (transposed.mode == "P" and "transparency" in transposed.info)
            )
            if has_alpha:
                rgba = np.asarray(transposed.convert("RGBA"), dtype=np.uint8)
                bgr = np.ascontiguousarray(cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2BGR))
                alpha = np.ascontiguousarray(rgba[:, :, 3])
                return bgr, alpha

            rgb = np.asarray(transposed.convert("RGB"), dtype=np.uint8)
            bgr = np.ascontiguousarray(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
            return bgr, None
    except Image.DecompressionBombError as exc:
        raise ValueError("Resolusi gambar melebihi batas keamanan 50 megapiksel.") from exc


def _build_binary_mask(
    width: int,
    height: int,
    page_instr: PageRemovalInstruction,
    brush_dilate_px: int = DEFAULT_BRUSH_DILATE_PX,
) -> np.ndarray:
    """Meraster kotak kandidat (dengan dilasi) lalu replay kronologis goresan kuas add/erase."""
    mask = np.zeros((height, width), dtype=np.uint8)

    for box in page_instr.selected_boxes:
        x0 = max(0, min(width - 1, int(round(box.x0 * width))))
        y0 = max(0, min(height - 1, int(round(box.y0 * height))))
        x1 = max(x0 + 1, min(width, int(round(box.x1 * width))))
        y1 = max(y0 + 1, min(height, int(round(box.y1 * height))))
        cv2.rectangle(mask, (x0, y0), (x1, y1), 255, -1)

    if brush_dilate_px > 0 and np.any(mask):
        k = brush_dilate_px * 2 + 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        mask = cv2.dilate(mask, kernel)

    max_dim = max(1, width, height)
    for stroke in page_instr.strokes:
        color = 255 if stroke.mode == "add" else 0
        radius_px = max(1, int(round(stroke.brush_radius_norm * max_dim)))
        pts = [
            (
                max(0, min(width - 1, int(round(pt.x * width)))),
                max(0, min(height - 1, int(round(pt.y * height)))),
            )
            for pt in stroke.points
        ]
        if len(pts) == 1:
            cv2.circle(mask, pts[0], radius_px, color, -1, lineType=cv2.LINE_8)
        else:
            thickness = max(1, radius_px * 2)
            for idx in range(len(pts) - 1):
                cv2.line(mask, pts[idx], pts[idx + 1], color, thickness, lineType=cv2.LINE_8)

    return mask


def _inpaint_bgr(bgr: np.ndarray, mask: np.ndarray, radius: int) -> np.ndarray:
    """Menjalankan cv2.INPAINT_TELEA hanya pada area mask non-nol."""
    if not np.any(mask):
        return bgr.copy()
    return cv2.inpaint(bgr, mask, inpaintRadius=float(radius), flags=cv2.INPAINT_TELEA)


def _encode_clean_image_bytes(
    bgr: np.ndarray,
    alpha: np.ndarray | None,
    output_kind: Literal["jpeg", "png"],
    jpeg_quality: int = 92,
) -> bytes:
    """Meng-encode gambar hasil tanpa metadata EXIF/GPS dengan mempertahankan alpha PNG."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    buf = io.BytesIO()
    if output_kind == "png":
        if alpha is not None:
            rgba = np.dstack([rgb, alpha])
            Image.fromarray(rgba, mode="RGBA").save(buf, format="PNG")
        else:
            Image.fromarray(rgb, mode="RGB").save(buf, format="PNG")
    else:
        Image.fromarray(rgb, mode="RGB").save(buf, format="JPEG", quality=jpeg_quality)
    return buf.getvalue()


def _encode_preview_data_url(
    bgr: np.ndarray,
    alpha: np.ndarray | None,
    prefer_png: bool,
) -> tuple[str, int, int]:
    """Menghasilkan data URL preview bersih bebas EXIF untuk perbandingan before/after."""
    height, width = bgr.shape[:2]
    scale = min(1.0, MAX_PREVIEW_WIDTH / max(1, width))
    prev_w = max(1, int(round(width * scale)))
    prev_h = max(1, int(round(height * scale)))

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    if prefer_png and alpha is not None:
        pil_img = Image.fromarray(np.dstack([rgb, alpha]), mode="RGBA")
        if (prev_w, prev_h) != (width, height):
            pil_img = pil_img.resize((prev_w, prev_h), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        mime = "image/png"
    else:
        pil_img = Image.fromarray(rgb, mode="RGB")
        if (prev_w, prev_h) != (width, height):
            pil_img = pil_img.resize((prev_w, prev_h), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=85)
        mime = "image/jpeg"

    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:{mime};base64,{b64}", prev_w, prev_h


def _delete_target_annotations(page: pymupdf.Page, target_xrefs: set[int]) -> int:
    """Menghapus annotation aman yang dipilih dari halaman PDF tanpa meraster halaman."""
    if not target_xrefs:
        return 0
    removed = 0
    for annot in list(page.annots()):
        if int(annot.xref) in target_xrefs and annot.type and annot.type[1] in SAFE_ANNOT_TYPES:
            page.delete_annot(annot)
            removed += 1
    return removed


def preview_watermark_removal(
    file_bytes: bytes,
    manifest: WatermarkRemovalManifest,
    page_index: int = 0,
) -> dict[str, Any]:
    """Menghasilkan pratinjau before/after pada halaman target sesuai manifest tervalidasi."""
    summary = validate_manifest_against_document(file_bytes, manifest)
    page_instr = next((p for p in manifest.pages if p.page_index == page_index), None)
    if page_instr is None:
        raise ValueError(
            f"Halaman {page_index + 1} tidak memiliki instruksi penghapusan pada manifest."
        )

    file_kind = summary["file_kind"]
    if file_kind in {"jpeg", "png"}:
        bgr, alpha = _decode_image_arrays(file_bytes, file_kind)
        h, w = bgr.shape[:2]
        mask = _build_binary_mask(w, h, page_instr)
        mask_pixels = int(np.count_nonzero(mask))
        cleaned_bgr = _inpaint_bgr(bgr, mask, manifest.inpaint_radius)
        has_alpha = alpha is not None
        before_url, prev_w, prev_h = _encode_preview_data_url(bgr, alpha, prefer_png=has_alpha)
        after_url, _, _ = _encode_preview_data_url(cleaned_bgr, alpha, prefer_png=has_alpha)
        return {
            "file_kind": file_kind,
            "page_index": 0,
            "width": w,
            "height": h,
            "preview_width": prev_w,
            "preview_height": prev_h,
            "has_alpha": has_alpha,
            "removal_mode": "raster" if mask_pixels > 0 else "none",
            "mask_pixel_count": mask_pixels,
            "before_data_url": before_url,
            "after_data_url": after_url,
        }

    doc = _open_validated_pdf(file_bytes)
    try:
        page = doc[page_index]
        prect = page.rect
        prev_scale = min(2.0, MAX_PREVIEW_WIDTH / max(1.0, float(prect.width)))
        before_pix = page.get_pixmap(matrix=pymupdf.Matrix(prev_scale, prev_scale), alpha=False)
        before_b64 = base64.b64encode(before_pix.tobytes("jpeg")).decode("ascii")
        before_url = f"data:image/jpeg;base64,{before_b64}"

        annots_removed = _delete_target_annotations(page, set(page_instr.annot_xrefs))
        mask_pixels = 0
        if page_instr.selected_boxes or page_instr.strokes:
            work_pix = page.get_pixmap(dpi=PDF_RASTER_DPI, alpha=False)
            arr = np.frombuffer(work_pix.samples, dtype=np.uint8).reshape(
                work_pix.height, work_pix.width, 3
            )
            bgr = np.ascontiguousarray(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR))
            mask = _build_binary_mask(work_pix.width, work_pix.height, page_instr)
            mask_pixels = int(np.count_nonzero(mask))
            if mask_pixels > 0:
                cleaned_bgr = _inpaint_bgr(bgr, mask, manifest.inpaint_radius)
                after_url, prev_w, prev_h = _encode_preview_data_url(
                    cleaned_bgr, None, prefer_png=False
                )
                removal_mode = "hybrid_raster" if annots_removed > 0 else "raster"
            else:
                after_pix = page.get_pixmap(
                    matrix=pymupdf.Matrix(prev_scale, prev_scale), alpha=False
                )
                after_b64 = base64.b64encode(after_pix.tobytes("jpeg")).decode("ascii")
                after_url = f"data:image/jpeg;base64,{after_b64}"
                prev_w, prev_h = int(after_pix.width), int(after_pix.height)
                removal_mode = "structural" if annots_removed > 0 else "none"
        else:
            after_pix = page.get_pixmap(matrix=pymupdf.Matrix(prev_scale, prev_scale), alpha=False)
            after_b64 = base64.b64encode(after_pix.tobytes("jpeg")).decode("ascii")
            after_url = f"data:image/jpeg;base64,{after_b64}"
            prev_w, prev_h = int(after_pix.width), int(after_pix.height)
            removal_mode = "structural" if annots_removed > 0 else "none"

        return {
            "file_kind": "pdf",
            "page_index": page_index,
            "width": round(float(prect.width), 2),
            "height": round(float(prect.height), 2),
            "preview_width": prev_w,
            "preview_height": prev_h,
            "has_alpha": False,
            "removal_mode": removal_mode,
            "mask_pixel_count": mask_pixels,
            "before_data_url": before_url,
            "after_data_url": after_url,
        }
    finally:
        doc.close()


def apply_watermark_removal(
    file_bytes: bytes,
    manifest: WatermarkRemovalManifest,
    filename: str = "document",
) -> dict[str, Any]:
    """Menjalankan penghapusan watermark final secara in-memory dan mengembalikan output bersih."""
    summary = validate_manifest_against_document(file_bytes, manifest)
    clean_base = _sanitize_name(filename)
    file_kind = summary["file_kind"]

    if file_kind in {"jpeg", "png"}:
        bgr, alpha = _decode_image_arrays(file_bytes, file_kind)
        h, w = bgr.shape[:2]
        mask = _build_binary_mask(w, h, manifest.pages[0])
        has_mask = bool(np.any(mask))
        cleaned_bgr = _inpaint_bgr(bgr, mask, manifest.inpaint_radius)
        out_bytes = _encode_clean_image_bytes(cleaned_bgr, alpha, file_kind)
        ext = "jpg" if file_kind == "jpeg" else "png"
        media_type = "image/jpeg" if ext == "jpg" else "image/png"
        return {
            "output_bytes": out_bytes,
            "filename": f"{clean_base}_watermark_removed.{ext}",
            "media_type": media_type,
            "file_kind": file_kind,
            "page_count": 1,
            "structural_pages": 0,
            "rasterized_pages": 1 if has_mask else 0,
            "annots_removed": 0,
            "original_size_bytes": len(file_bytes),
            "output_size_bytes": len(out_bytes),
        }

    doc = _open_validated_pdf(file_bytes)
    instr_by_page = {p.page_index: p for p in manifest.pages}
    structural_pages = 0
    rasterized_pages = 0
    annots_removed = 0

    try:
        # Hapus seluruh annotation target terlebih dahulu (berlaku untuk struktural & hybrid)
        for p_idx, page_instr in instr_by_page.items():
            if page_instr.annot_xrefs:
                removed_here = _delete_target_annotations(doc[p_idx], set(page_instr.annot_xrefs))
                annots_removed += removed_here
                if removed_here > 0 and not (page_instr.selected_boxes or page_instr.strokes):
                    structural_pages += 1

        if not summary["requires_rasterization"]:
            out_bytes = doc.tobytes(garbage=3, deflate=True)
        else:
            new_doc = pymupdf.open()
            try:
                for p_idx in range(doc.page_count):
                    page_instr = instr_by_page.get(p_idx)
                    if page_instr and (page_instr.selected_boxes or page_instr.strokes):
                        page = doc[p_idx]
                        pix = page.get_pixmap(dpi=PDF_RASTER_DPI, alpha=False)
                        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                            pix.height, pix.width, 3
                        )
                        bgr = np.ascontiguousarray(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR))
                        mask = _build_binary_mask(pix.width, pix.height, page_instr)

                        if np.any(mask):
                            cleaned_bgr = _inpaint_bgr(bgr, mask, manifest.inpaint_radius)
                            ok, png_buf = cv2.imencode(".png", cleaned_bgr)
                            if not ok:
                                raise RuntimeError(
                                    "Gagal meng-encode halaman PDF hasil inpainting."
                                )
                            new_page = new_doc.new_page(
                                width=page.rect.width, height=page.rect.height
                            )
                            new_page.insert_image(new_page.rect, stream=png_buf.tobytes())
                            rasterized_pages += 1
                            del cleaned_bgr, png_buf
                        else:
                            new_doc.insert_pdf(doc, from_page=p_idx, to_page=p_idx)
                            if page_instr.annot_xrefs:
                                structural_pages += 1

                        del pix, arr, bgr, mask
                    else:
                        # Pertahankan halaman non-target tetap dalam bentuk vektor/aslinya
                        new_doc.insert_pdf(doc, from_page=p_idx, to_page=p_idx)

                out_bytes = new_doc.tobytes(garbage=3, deflate=True)
            finally:
                new_doc.close()

        return {
            "output_bytes": out_bytes,
            "filename": f"{clean_base}_watermark_removed.pdf",
            "media_type": "application/pdf",
            "file_kind": "pdf",
            "page_count": doc.page_count,
            "structural_pages": structural_pages,
            "rasterized_pages": rasterized_pages,
            "annots_removed": annots_removed,
            "original_size_bytes": len(file_bytes),
            "output_size_bytes": len(out_bytes),
        }
    finally:
        doc.close()
