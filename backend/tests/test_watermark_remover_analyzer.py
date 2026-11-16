"""Unit & negative security tests untuk layanan analyzer Hapus Watermark (RW-02)."""

from __future__ import annotations

import io
import math
from unittest.mock import patch

import pymupdf
import pytest
from PIL import Image
from pydantic import ValidationError

from app.services.pdf_tools import watermark_pdf
from app.services.watermark_remover import (
    MAX_WATERMARK_FILE_SIZE,
    MAX_WATERMARK_PDF_PAGES,
    WatermarkRemovalManifest,
    analyze_watermark_document,
    compute_file_sha256,
    validate_manifest_against_document,
)


def _make_sample_pdf(
    num_pages: int = 3, with_stamp: bool = False, with_repeated_text: bool = False
) -> bytes:
    doc = pymupdf.open()
    for i in range(num_pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text((50, 70), f"DOKUMEN RESMI HALAMAN {i + 1}", fontsize=14, fontname="helv")
        page.insert_text(
            (50, 120),
            "Baris paragraf berulang pada setiap halaman yang bukan watermark.",
            fontsize=10.5,
            fontname="helv",
            color=(0.12, 0.12, 0.12),
        )
        if with_stamp and i < 2:
            page.add_stamp_annot(pymupdf.Rect(180, 320, 410, 410), stamp=0)
        if with_repeated_text and i < 2:
            page.insert_text(
                (190, 420),
                "INTERNAL DRAFT",
                fontsize=32,
                fontname="helv",
                color=(0.82, 0.25, 0.25),
                fill_opacity=0.25,
            )
    data = doc.tobytes()
    doc.close()
    return data


def _make_png(width: int = 400, height: int = 300, alpha: bool = False) -> bytes:
    mode = "RGBA" if alpha else "RGB"
    color = (120, 180, 200, 180) if alpha else (120, 180, 200)
    img = Image.new(mode, (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_jpeg_with_exif(width: int = 400, height: int = 300) -> bytes:
    img = Image.new("RGB", (width, height), (45, 95, 130))
    exif = Image.Exif()
    exif[0x010F] = "CameraSecret"
    exif[0x013B] = "PrivateAuthor"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90, exif=exif.tobytes())
    return buf.getvalue()


def test_analyze_pdf_structural_and_no_body_false_positive() -> None:
    pdf_bytes = _make_sample_pdf(num_pages=3, with_stamp=True, with_repeated_text=True)
    with patch(
        "app.services.watermark_remover.get_tesseract_status",
        return_value={
            "available": False,
            "tessdata": None,
            "languages": [],
            "message": "not found",
        },
    ):
        result = analyze_watermark_document(pdf_bytes, filename="kontrak.pdf", owner_confirmed=True)

    assert result["file_kind"] == "pdf"
    assert result["page_count"] == 3
    assert result["file_sha256"] == compute_file_sha256(pdf_bytes)
    assert result["ocr_status"] == "unavailable"

    p0_candidates = result["pages"][0]["candidates"]
    sources = {c["source"] for c in p0_candidates}
    assert "pdf_annotation" in sources
    assert "repeated_text" in sources
    # Pastikan teks paragraf biasa fontsize 10.5 tidak dianggap watermark
    labels = " ".join(c["label"] for c in p0_candidates)
    assert "Baris paragraf berulang" not in labels
    assert "INTERNAL DRAFT" in labels


def test_analyze_satukit_mosaic_pdf_and_repeated_logo() -> None:
    base = _make_sample_pdf(num_pages=3)
    wm_buf, _ = watermark_pdf(
        base,
        mode="text",
        text="SATUKIT",
        opacity=0.25,
        rotation=45.0,
        position="mosaic",
        fontsize=36,
        pages_str="1-2",
    )
    logo_png = _make_png(width=120, height=60, alpha=True)
    logo_buf, _ = watermark_pdf(
        base,
        mode="image",
        image_bytes=logo_png,
        opacity=0.35,
        position="center",
        pages_str="1-2",
    )
    with patch(
        "app.services.watermark_remover.get_tesseract_status",
        return_value={"available": False, "tessdata": None, "languages": [], "message": "absent"},
    ):
        res_text = analyze_watermark_document(
            wm_buf.getvalue(), "mosaic.pdf", owner_confirmed=True
        )
        res_logo = analyze_watermark_document(
            logo_buf.getvalue(), "logo_wm.pdf", owner_confirmed=True
        )

    p0_rtxt = [c for c in res_text["pages"][0]["candidates"] if c["source"] == "repeated_text"]
    p2_rtxt = [c for c in res_text["pages"][2]["candidates"] if c["source"] == "repeated_text"]
    assert len(p0_rtxt) == 6
    assert len(p2_rtxt) == 0

    p0_rimg = [c for c in res_logo["pages"][0]["candidates"] if c["source"] == "repeated_image"]
    p2_rimg = [c for c in res_logo["pages"][2]["candidates"] if c["source"] == "repeated_image"]
    assert len(p0_rimg) == 1
    assert len(p2_rimg) == 0


def test_analyze_jpeg_strips_exif_in_preview_and_png_detects_alpha() -> None:
    jpg_bytes = _make_jpeg_with_exif()
    png_alpha_bytes = _make_png(alpha=True)

    with patch(
        "app.services.watermark_remover.get_tesseract_status",
        return_value={"available": False, "tessdata": None, "languages": [], "message": "absent"},
    ):
        jpg_res = analyze_watermark_document(jpg_bytes, "foto.jpg", owner_confirmed=True)
        png_res = analyze_watermark_document(png_alpha_bytes, "logo.png", owner_confirmed=True)

    assert jpg_res["file_kind"] == "jpeg"
    assert jpg_res["pages"][0]["has_alpha"] is False
    assert jpg_res["pages"][0]["preview_data_url"].startswith("data:image/jpeg;base64,")

    assert png_res["file_kind"] == "png"
    assert png_res["pages"][0]["has_alpha"] is True
    assert png_res["pages"][0]["preview_data_url"].startswith("data:image/png;base64,")


def test_analyze_ocr_available_mock_and_runtime_failure_non_blocking() -> None:
    png_bytes = _make_png(alpha=False)

    # Buat PDF OCR palsu 1 halaman berisi kata "SAMPLE" untuk menyimulasikan output pdfocr_tobytes
    ocr_doc = pymupdf.open()
    ocr_page = ocr_doc.new_page(width=400, height=300)
    ocr_page.insert_text((80, 150), "SAMPLE WATERMARK", fontsize=28)
    fake_ocr_pdf = ocr_doc.tobytes()
    ocr_doc.close()

    with (
        patch(
            "app.services.watermark_remover.get_tesseract_status",
            return_value={
                "available": True,
                "tessdata": "/usr/share/tessdata",
                "languages": ["eng", "ind"],
                "message": "ok",
            },
        ),
        patch.object(pymupdf.Pixmap, "pdfocr_tobytes", return_value=fake_ocr_pdf),
    ):
        res_ok = analyze_watermark_document(png_bytes, "scan.png", owner_confirmed=True)

    assert res_ok["ocr_status"] == "completed"
    cands = res_ok["pages"][0]["candidates"]
    assert len(cands) >= 1
    assert cands[0]["source"] == "ocr_text"
    assert all(0.0 <= coord <= 1.0 for coord in cands[0]["bbox_norm"])

    # Jika runtime OCR gagal, analyzer tidak boleh crash/memblokir
    with (
        patch(
            "app.services.watermark_remover.get_tesseract_status",
            return_value={
                "available": True,
                "tessdata": "/usr/share/tessdata",
                "languages": ["eng"],
                "message": "ok",
            },
        ),
        patch.object(pymupdf.Pixmap, "pdfocr_tobytes", side_effect=RuntimeError("ocr crash")),
    ):
        res_fail = analyze_watermark_document(png_bytes, "scan.png", owner_confirmed=True)

    assert res_fail["ocr_status"] == "failed"
    assert len(res_fail["pages"]) == 1


def test_fail_closed_security_guards() -> None:
    valid_png = _make_png()

    # 1. Owner confirmation wajib
    with pytest.raises(ValueError, match="konfirmasi hak kepemilikan"):
        analyze_watermark_document(valid_png, "a.png", owner_confirmed=False)

    # 2. Kosong & > 25 MB
    with pytest.raises(ValueError, match="kosong"):
        analyze_watermark_document(b"", "empty.png", owner_confirmed=True)
    with pytest.raises(ValueError, match="25 MB"):
        analyze_watermark_document(
            b"\x89PNG\r\n\x1a\n" + b"0" * MAX_WATERMARK_FILE_SIZE, "big.png", True
        )

    # 3. Format dilarang (WebP / teks)
    with pytest.raises(ValueError, match="Format berkas tidak didukung"):
        analyze_watermark_document(b"RIFF1234WEBP", "pic.webp", owner_confirmed=True)

    # 3b. PNG animasi (APNG) ditolak
    apng_buf = io.BytesIO()
    f1 = Image.new("RGBA", (32, 32), (255, 0, 0, 255))
    f2 = Image.new("RGBA", (32, 32), (0, 255, 0, 255))
    f1.save(apng_buf, format="PNG", save_all=True, append_images=[f2], duration=100)
    with pytest.raises(ValueError, match="APNG"):
        analyze_watermark_document(apng_buf.getvalue(), "anim.png", owner_confirmed=True)

    # 3c. Pixel bomb ditolak
    with (
        patch.object(Image, "open", side_effect=Image.DecompressionBombError("bomb")),
        pytest.raises(ValueError, match="50 megapiksel"),
    ):
        analyze_watermark_document(valid_png, "bomb.png", owner_confirmed=True)

    # 4. PDF terenkripsi
    enc_doc = pymupdf.open()
    enc_doc.new_page()
    enc_bytes = enc_doc.tobytes(
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        user_pw="secret",
        owner_pw="secret-owner",
    )
    enc_doc.close()
    with pytest.raises(ValueError, match="terenkripsi"):
        analyze_watermark_document(enc_bytes, "locked.pdf", owner_confirmed=True)

    # 5. PDF bertanda tangan digital
    sig_doc = pymupdf.open()
    sig_page = sig_doc.new_page()
    w = pymupdf.Widget()
    w.rect = pymupdf.Rect(20, 20, 120, 60)
    w.field_type = pymupdf.PDF_WIDGET_TYPE_SIGNATURE
    w.field_name = "SigField"
    sig_page.add_widget(w)
    sig_bytes = sig_doc.tobytes()
    sig_doc.close()
    with pytest.raises(ValueError, match="tanda tangan digital"):
        analyze_watermark_document(sig_bytes, "signed.pdf", owner_confirmed=True)

    # 6. PDF > 50 halaman ditolak pada analisis interaktif
    big_doc = pymupdf.open()
    for _ in range(MAX_WATERMARK_PDF_PAGES + 1):
        big_doc.new_page()
    big_pdf_bytes = big_doc.tobytes()
    big_doc.close()
    with pytest.raises(ValueError, match=f"{MAX_WATERMARK_PDF_PAGES} halaman"):
        analyze_watermark_document(big_pdf_bytes, "51pages.pdf", owner_confirmed=True)


def test_manifest_schema_boundaries_and_document_binding() -> None:
    pdf_bytes = _make_sample_pdf(num_pages=2, with_stamp=True)
    sha = compute_file_sha256(pdf_bytes)

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    valid_xref = int(next(doc[0].annots()).xref)
    doc.close()

    # 1. NaN / out-of-range coordinates rejected
    with pytest.raises(ValidationError):
        WatermarkRemovalManifest(
            file_sha256=sha,
            owner_confirmed=True,
            pages=[
                {
                    "page_index": 0,
                    "selected_boxes": [{"x0": 0.1, "y0": 0.1, "x1": math.nan, "y1": 0.5}],
                }
            ],
        )

    with pytest.raises(ValidationError):
        WatermarkRemovalManifest(
            file_sha256=sha,
            owner_confirmed=True,
            pages=[
                {
                    "page_index": 0,
                    "strokes": [
                        {
                            "mode": "add",
                            "brush_radius_norm": 0.02,
                            "points": [{"x": 1.2, "y": 0.5}],
                        }
                    ],
                }
            ],
        )

    # 2. Structural annotation only -> confirm_pdf_rasterization=False diizinkan
    manifest_struct = WatermarkRemovalManifest(
        file_sha256=sha,
        owner_confirmed=True,
        confirm_pdf_rasterization=False,
        pages=[{"page_index": 0, "annot_xrefs": [valid_xref]}],
    )
    summary = validate_manifest_against_document(pdf_bytes, manifest_struct)
    assert summary["structural_pages"] == [0]
    assert summary["requires_rasterization"] is False

    # 3. Raster target tanpa konfirmasi eksplisit -> ditolak
    manifest_no_confirm = WatermarkRemovalManifest(
        file_sha256=sha,
        owner_confirmed=True,
        confirm_pdf_rasterization=False,
        pages=[
            {
                "page_index": 0,
                "selected_boxes": [{"x0": 0.2, "y0": 0.2, "x1": 0.5, "y1": 0.5}],
            }
        ],
    )
    with pytest.raises(ValueError, match="konfirmasi rasterisasi"):
        validate_manifest_against_document(pdf_bytes, manifest_no_confirm)

    # 4. SHA-256 mismatch -> ditolak
    manifest_wrong_sha = WatermarkRemovalManifest(
        file_sha256="0" * 64,
        owner_confirmed=True,
        pages=[{"page_index": 0, "annot_xrefs": [valid_xref]}],
    )
    with pytest.raises(ValueError, match="SHA-256"):
        validate_manifest_against_document(pdf_bytes, manifest_wrong_sha)

    # 5. annot_xref tidak sah di halaman -> ditolak
    manifest_wrong_xref = WatermarkRemovalManifest(
        file_sha256=sha,
        owner_confirmed=True,
        pages=[{"page_index": 1, "annot_xrefs": [99999]}],
    )
    with pytest.raises(ValueError, match="annot_xref"):
        validate_manifest_against_document(pdf_bytes, manifest_wrong_xref)
