"""Integration, security, & output integrity tests untuk endpoint Hapus Watermark (RW-03)."""

from __future__ import annotations

import io
import json
import sys
import time
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pymupdf
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import audit  # noqa: E402
from app.core.audit import AuditLogger  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager  # noqa: E402
from app.main import app  # noqa: E402
from app.services.auth_service import auth_service  # noqa: E402
from app.services.job_manager import JobBusyError  # noqa: E402
from app.services.watermark_remover import (  # noqa: E402
    MAX_WATERMARK_FILE_SIZE,
    compute_file_sha256,
)

TRUSTED_ORIGIN = "http://localhost:5173"


def _auth_client() -> tuple[TestClient, dict[str, str]]:
    client = TestClient(app, base_url="http://localhost:8000")
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {
        CSRF_HEADER_NAME: session_manager.csrf_token,
        "Origin": TRUSTED_ORIGIN,
    }
    return client, headers


def _make_pdf_with_stamp_and_vector(num_pages: int = 3) -> bytes:
    doc = pymupdf.open()
    for idx in range(num_pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text(
            (50, 80),
            f"DOKUMEN VEKTOR HALAMAN {idx + 1} YANG HARUS TETAP TERJAGA",
            fontsize=13,
            fontname="helv",
        )
        if idx == 0:
            page.add_stamp_annot(pymupdf.Rect(180, 320, 410, 410), stamp=0)
            page.insert_text(
                (170, 520),
                "WATERMARK RAHASIA",
                fontsize=28,
                fontname="helv",
                color=(0.82, 0.25, 0.25),
            )
    raw = doc.tobytes()
    doc.close()
    return raw


def _make_png_rgba_with_watermark() -> tuple[bytes, np.ndarray]:
    w, h = 240, 180
    img = Image.new("RGBA", (w, h), (235, 240, 245, 255))
    draw = ImageDraw.Draw(img)
    # Tulis watermark merah di tengah (y=75..105)
    draw.rectangle([50, 75, 190, 105], fill=(220, 40, 40, 255))
    # Tulis kotak hijau di kiri atas (akan dijaga pakai erase stroke)
    draw.rectangle([15, 15, 55, 55], fill=(20, 170, 60, 255))

    # Buat alpha gradient & sudut transparan untuk menguji preservasi alpha byte-per-byte
    alpha = np.zeros((h, w), dtype=np.uint8)
    for y in range(h):
        alpha[y, :] = int(60 + (195 * y) / (h - 1))
    alpha[:20, :20] = 0
    alpha[-20:, -20:] = 128

    arr = np.asarray(img, dtype=np.uint8).copy()
    arr[:, :, 3] = alpha
    out_img = Image.fromarray(arr, mode="RGBA")
    buf = io.BytesIO()
    out_img.save(buf, format="PNG")
    return buf.getvalue(), alpha


def _make_jpeg_with_exif_and_watermark() -> bytes:
    img = Image.new("RGB", (260, 200), (242, 242, 242))
    draw = ImageDraw.Draw(img)
    draw.rectangle([60, 80, 200, 120], fill=(210, 45, 45))
    exif = Image.Exif()
    exif[0x010E] = "Lokasi Rahasia GPS Simulasi"
    exif[0x010F] = "Kamera Privat"
    exif[0x013B] = "Pembuat Dokumen"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92, exif=exif.tobytes())
    return buf.getvalue()


def test_security_auth_origin_csrf_and_production_verified_guard() -> None:
    anon_client = TestClient(app, base_url="http://localhost:8000")
    png_bytes, _ = _make_png_rgba_with_watermark()

    # 1. Anonim -> 401 Unauthorized
    r_anon = anon_client.post(
        "/api/watermark-removal/analyze",
        files={"file": ("doc.png", png_bytes, "image/png")},
        data={"owner_confirmed": "true"},
        headers={"Origin": TRUSTED_ORIGIN},
    )
    assert r_anon.status_code == 401

    # 2. Origin asing -> 403 Forbidden
    auth_client, headers = _auth_client()
    r_origin = auth_client.post(
        "/api/watermark-removal/analyze",
        files={"file": ("doc.png", png_bytes, "image/png")},
        data={"owner_confirmed": "true"},
        headers={CSRF_HEADER_NAME: headers[CSRF_HEADER_NAME], "Origin": "https://evil.example"},
    )
    assert r_origin.status_code == 403

    # 3. Tanpa CSRF header -> 403 Forbidden
    r_csrf = auth_client.post(
        "/api/watermark-removal/analyze",
        files={"file": ("doc.png", png_bytes, "image/png")},
        data={"owner_confirmed": "true"},
        headers={"Origin": TRUSTED_ORIGIN},
    )
    assert r_csrf.status_code == 403

    # 4. Production mode wajib akun DB & email terverifikasi
    orig_prod = settings.IS_PRODUCTION
    prod_client = TestClient(app, base_url="http://localhost:8000")
    try:
        settings.IS_PRODUCTION = True
        email = f"wm_prod_{int(time.time() * 1000)}@example.com"
        reg = prod_client.post(
            "/api/auth/register",
            json={"email": email, "password": "StrongPassword123!", "name": "WM Tester"},
            headers={"Origin": TRUSTED_ORIGIN},
        )
        assert reg.status_code == 200
        cookie = reg.cookies.get(SESSION_COOKIE_NAME)
        csrf = reg.json()["csrf_token"]
        assert cookie is not None

        # Akun belum terverifikasi -> 403
        prod_client.cookies.set(SESSION_COOKIE_NAME, cookie)
        r_unverified = prod_client.post(
            "/api/watermark-removal/analyze",
            headers={"Origin": TRUSTED_ORIGIN, CSRF_HEADER_NAME: csrf},
            files={"file": ("doc.png", png_bytes, "image/png")},
            data={"owner_confirmed": "true"},
        )
        assert r_unverified.status_code == 403

        # Verifikasi email -> lolos guard auth (200)
        user = auth_service.repo.get_user_by_email(email)
        assert user is not None
        auth_service.repo.consume_email_verification_token(user.id, "dummy_hash", time.time())
        r_verified = prod_client.post(
            "/api/watermark-removal/analyze",
            headers={"Origin": TRUSTED_ORIGIN, CSRF_HEADER_NAME: csrf},
            files={"file": ("doc.png", png_bytes, "image/png")},
            data={"owner_confirmed": "true", "include_ocr": "false"},
        )
        assert r_verified.status_code == 200
    finally:
        settings.IS_PRODUCTION = orig_prod


def test_cors_exposes_watermark_headers_and_handles_limits_busy() -> None:
    client, headers = _auth_client()
    png_bytes, _ = _make_png_rgba_with_watermark()
    sha = compute_file_sha256(png_bytes)

    # 1. Preflight CORS & actual POST mengekspos header khusus unduhan
    opt = client.options(
        "/api/watermark-removal/apply",
        headers={
            "Origin": TRUSTED_ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )
    assert opt.status_code == 200
    assert opt.headers.get("access-control-allow-origin") == TRUSTED_ORIGIN

    apply_manifest = json.dumps({
        "file_sha256": sha,
        "owner_confirmed": True,
        "pages": [
            {
                "page_index": 0,
                "selected_boxes": [{"x0": 0.2, "y0": 0.4, "x1": 0.7, "y1": 0.6}],
            }
        ],
    })
    r_cors = client.post(
        "/api/watermark-removal/apply",
        headers=headers,
        files={"file": ("cors_check.png", png_bytes, "image/png")},
        data={"manifest_json": apply_manifest},
    )
    assert r_cors.status_code == 200
    exposed = r_cors.headers.get("access-control-expose-headers", "")
    for expected_hdr in (
        "Content-Disposition",
        "X-Structural-Pages",
        "X-Rasterized-Pages",
        "X-Annots-Removed",
    ):
        assert expected_hdr.lower() in exposed.lower()

    # 2. > 25 MB -> 413 Payload Too Large
    oversized = b"\x89PNG\r\n\x1a\n" + b"0" * MAX_WATERMARK_FILE_SIZE
    r_big = client.post(
        "/api/watermark-removal/analyze",
        headers=headers,
        files={"file": ("huge.png", oversized, "image/png")},
        data={"owner_confirmed": "true"},
    )
    assert r_big.status_code == 413

    # 3. JobBusyError -> 429 Too Many Requests
    with patch(
        "app.api.watermark_removal.conversion_job_manager.run_job",
        side_effect=JobBusyError("Job sibuk"),
    ):
        r_busy = client.post(
            "/api/watermark-removal/analyze",
            headers=headers,
            files={"file": ("pic.png", png_bytes, "image/png")},
            data={"owner_confirmed": "true"},
        )
    assert r_busy.status_code == 429


def test_validation_and_fail_closed_rejections_http_422() -> None:
    client, headers = _auth_client()
    pdf_bytes = _make_pdf_with_stamp_and_vector(num_pages=2)
    sha = compute_file_sha256(pdf_bytes)

    # 1. owner_confirmed=False -> 422
    r_no_owner = client.post(
        "/api/watermark-removal/analyze",
        headers=headers,
        files={"file": ("doc.pdf", pdf_bytes, "application/pdf")},
        data={"owner_confirmed": "false"},
    )
    assert r_no_owner.status_code == 422

    # 2. Signed PDF -> 422
    sig_doc = pymupdf.open()
    sig_p = sig_doc.new_page()
    w = pymupdf.Widget()
    w.rect = pymupdf.Rect(20, 20, 120, 60)
    w.field_type = pymupdf.PDF_WIDGET_TYPE_SIGNATURE
    w.field_name = "Sig"
    sig_p.add_widget(w)
    sig_bytes = sig_doc.tobytes()
    sig_doc.close()
    r_signed = client.post(
        "/api/watermark-removal/analyze",
        headers=headers,
        files={"file": ("signed.pdf", sig_bytes, "application/pdf")},
        data={"owner_confirmed": "true"},
    )
    assert r_signed.status_code == 422
    assert "tanda tangan digital" in r_signed.json()["detail"].lower()

    # 3. SHA mismatch pada preview -> 422
    bad_manifest = json.dumps({
        "file_sha256": "f" * 64,
        "owner_confirmed": True,
        "confirm_pdf_rasterization": True,
        "pages": [
            {
                "page_index": 0,
                "selected_boxes": [{"x0": 0.1, "y0": 0.1, "x1": 0.3, "y1": 0.3}],
            }
        ],
    })
    r_bad_sha = client.post(
        "/api/watermark-removal/preview",
        headers=headers,
        files={"file": ("doc.pdf", pdf_bytes, "application/pdf")},
        data={"manifest_json": bad_manifest, "page_index": "0"},
    )
    assert r_bad_sha.status_code == 422
    assert "SHA-256" in r_bad_sha.json()["detail"]

    # 4. Raster PDF tanpa confirm_pdf_rasterization=True -> 422
    no_confirm_manifest = json.dumps({
        "file_sha256": sha,
        "owner_confirmed": True,
        "confirm_pdf_rasterization": False,
        "pages": [
            {
                "page_index": 0,
                "selected_boxes": [{"x0": 0.2, "y0": 0.5, "x1": 0.7, "y1": 0.7}],
            }
        ],
    })
    r_no_raster_confirm = client.post(
        "/api/watermark-removal/apply",
        headers=headers,
        files={"file": ("doc.pdf", pdf_bytes, "application/pdf")},
        data={"manifest_json": no_confirm_manifest},
    )
    assert r_no_raster_confirm.status_code == 422
    assert "konfirmasi rasterisasi" in r_no_raster_confirm.json()["detail"].lower()

    # 5. JSON rusak & page_index invalid -> 422
    r_bad_json = client.post(
        "/api/watermark-removal/preview",
        headers=headers,
        files={"file": ("doc.pdf", pdf_bytes, "application/pdf")},
        data={"manifest_json": "{broken", "page_index": "0"},
    )
    assert r_bad_json.status_code == 422

    r_bad_page = client.post(
        "/api/watermark-removal/preview",
        headers=headers,
        files={"file": ("doc.pdf", pdf_bytes, "application/pdf")},
        data={"manifest_json": no_confirm_manifest, "page_index": "999"},
    )
    assert r_bad_page.status_code == 422


def test_pdf_structural_annotation_and_hybrid_selective_pipeline() -> None:
    client, headers = _auth_client()
    pdf_bytes = _make_pdf_with_stamp_and_vector(num_pages=3)

    # 1. Analyze
    r_an = client.post(
        "/api/watermark-removal/analyze",
        headers=headers,
        files={"file": ("Kontrak Penting.pdf", pdf_bytes, "application/pdf")},
        data={"owner_confirmed": "true", "include_ocr": "false"},
    )
    assert r_an.status_code == 200
    an_data = r_an.json()["data"]
    sha = an_data["file_sha256"]
    annot_cand = next(
        c for c in an_data["pages"][0]["candidates"] if c["source"] == "pdf_annotation"
    )
    annot_xref = annot_cand["annot_xref"]

    # 2A. Structural-only PDF: annotation dihapus tanpa rasterisasi
    struct_manifest = json.dumps({
        "file_sha256": sha,
        "owner_confirmed": True,
        "confirm_pdf_rasterization": False,
        "pages": [{"page_index": 0, "annot_xrefs": [annot_xref]}],
    })
    r_prev_struct = client.post(
        "/api/watermark-removal/preview",
        headers=headers,
        files={"file": ("Kontrak Penting.pdf", pdf_bytes, "application/pdf")},
        data={"manifest_json": struct_manifest, "page_index": "0"},
    )
    assert r_prev_struct.status_code == 200
    assert r_prev_struct.json()["data"]["removal_mode"] == "structural"

    r_apply_struct = client.post(
        "/api/watermark-removal/apply",
        headers=headers,
        files={"file": ("Kontrak Penting.pdf", pdf_bytes, "application/pdf")},
        data={"manifest_json": struct_manifest},
    )
    assert r_apply_struct.status_code == 200
    assert r_apply_struct.headers["x-rasterized-pages"] == "0"
    assert r_apply_struct.headers["x-structural-pages"] == "1"
    assert r_apply_struct.headers["x-annots-removed"] == "1"
    assert "Kontrak_Penting_watermark_removed.pdf" in r_apply_struct.headers["content-disposition"]

    out_struct_doc = pymupdf.open(stream=r_apply_struct.content, filetype="pdf")
    try:
        assert len(list(out_struct_doc[0].annots())) == 0
        assert "DOKUMEN VEKTOR HALAMAN 1" in out_struct_doc[0].get_text()
    finally:
        out_struct_doc.close()

    # 2B. Hybrid PDF: halaman 0 diraster & inpaint, halaman 1-2 tetap vektor asli
    hybrid_manifest = json.dumps({
        "file_sha256": sha,
        "owner_confirmed": True,
        "confirm_pdf_rasterization": True,
        "inpaint_radius": 5,
        "pages": [
            {
                "page_index": 0,
                "annot_xrefs": [annot_xref],
                "selected_boxes": [{"x0": 0.25, "y0": 0.56, "x1": 0.85, "y1": 0.66}],
            }
        ],
    })
    r_apply_hybrid = client.post(
        "/api/watermark-removal/apply",
        headers=headers,
        files={"file": ("Kontrak Penting.pdf", pdf_bytes, "application/pdf")},
        data={"manifest_json": hybrid_manifest},
    )
    assert r_apply_hybrid.status_code == 200
    assert r_apply_hybrid.headers["x-rasterized-pages"] == "1"
    assert r_apply_hybrid.headers["x-annots-removed"] == "1"

    out_hybrid_doc = pymupdf.open(stream=r_apply_hybrid.content, filetype="pdf")
    try:
        assert out_hybrid_doc.page_count == 3
        assert len(list(out_hybrid_doc[0].annots())) == 0
        assert len(out_hybrid_doc[0].get_images()) == 1
        # Halaman 1 dan 2 tetap vektor murni (bukan image raster)
        for non_target in (1, 2):
            assert len(out_hybrid_doc[non_target].get_images()) == 0
            expected_txt = f"DOKUMEN VEKTOR HALAMAN {non_target + 1}"
            assert expected_txt in out_hybrid_doc[non_target].get_text()
    finally:
        out_hybrid_doc.close()


def test_png_rgba_alpha_preserved_and_brush_add_erase_replay() -> None:
    client, headers = _auth_client()
    png_bytes, orig_alpha = _make_png_rgba_with_watermark()
    sha = compute_file_sha256(png_bytes)

    # Pilih kotak watermark merah (50..190, 75..105) + kotak kiri atas (15..55, 15..55)
    # lalu hapus kotak kiri atas dengan erase stroke, dan tambah titik brush kanan bawah
    manifest = json.dumps({
        "file_sha256": sha,
        "owner_confirmed": True,
        "inpaint_radius": 5,
        "pages": [
            {
                "page_index": 0,
                "selected_boxes": [
                    {"x0": 50 / 240, "y0": 75 / 180, "x1": 190 / 240, "y1": 105 / 180},
                    {"x0": 15 / 240, "y0": 15 / 180, "x1": 55 / 240, "y1": 55 / 180},
                ],
                "strokes": [
                    {
                        "mode": "erase",
                        "brush_radius_norm": 0.18,
                        "points": [{"x": 35 / 240, "y": 35 / 180}],
                    },
                    {
                        "mode": "add",
                        "brush_radius_norm": 0.03,
                        "points": [{"x": 0.85, "y": 0.85}, {"x": 0.9, "y": 0.85}],
                    },
                ],
            }
        ],
    })

    r_prev = client.post(
        "/api/watermark-removal/preview",
        headers=headers,
        files={"file": ("aset_transparan.png", png_bytes, "image/png")},
        data={"manifest_json": manifest, "page_index": "0"},
    )
    assert r_prev.status_code == 200
    prev_data = r_prev.json()["data"]
    assert prev_data["has_alpha"] is True
    assert prev_data["before_data_url"].startswith("data:image/png;base64,")
    assert prev_data["after_data_url"].startswith("data:image/png;base64,")

    r_apply = client.post(
        "/api/watermark-removal/apply",
        headers=headers,
        files={"file": ("aset_transparan.png", png_bytes, "image/png")},
        data={"manifest_json": manifest},
    )
    assert r_apply.status_code == 200
    assert r_apply.headers["content-type"] == "image/png"
    assert "aset_transparan_watermark_removed.png" in r_apply.headers["content-disposition"]

    out_img = Image.open(io.BytesIO(r_apply.content))
    assert out_img.mode == "RGBA"
    out_arr = np.asarray(out_img, dtype=np.uint8)
    # 1. Kanal alpha harus identik byte-per-byte
    assert np.array_equal(orig_alpha, out_arr[:, :, 3])
    # 2. Area kotak hijau (35, 35) yang di-erase tidak terinpaint -> tetap hijau
    assert out_arr[35, 35, 1] > 140 and out_arr[35, 35, 0] < 50
    # 3. Area watermark merah (90, 120) telah dibersihkan mendekati latar terang
    assert out_arr[90, 120, 1] > 200 and out_arr[90, 120, 2] > 200


def test_jpeg_exif_stripped_and_audit_log_excludes_filename(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log_dir = tmp_path / "logs"
    monkeypatch.setattr(audit, "audit_logger", AuditLogger(log_dir))

    client, headers = _auth_client()
    jpg_bytes = _make_jpeg_with_exif_and_watermark()
    secret_filename = "rahasia_gaji_direksi_2026.jpg"

    r_an = client.post(
        "/api/watermark-removal/analyze",
        headers=headers,
        files={"file": (secret_filename, jpg_bytes, "image/jpeg")},
        data={"owner_confirmed": "true", "include_ocr": "false"},
    )
    assert r_an.status_code == 200
    sha = r_an.json()["data"]["file_sha256"]

    manifest = json.dumps({
        "file_sha256": sha,
        "owner_confirmed": True,
        "pages": [
            {
                "page_index": 0,
                "selected_boxes": [
                    {"x0": 60 / 260, "y0": 80 / 200, "x1": 200 / 260, "y1": 120 / 200}
                ],
            }
        ],
    })
    r_prev = client.post(
        "/api/watermark-removal/preview",
        headers=headers,
        files={"file": (secret_filename, jpg_bytes, "image/jpeg")},
        data={"manifest_json": manifest, "page_index": "0"},
    )
    assert r_prev.status_code == 200

    r_apply = client.post(
        "/api/watermark-removal/apply",
        headers=headers,
        files={"file": (secret_filename, jpg_bytes, "image/jpeg")},
        data={"manifest_json": manifest},
    )
    assert r_apply.status_code == 200
    assert r_apply.headers["content-type"] == "image/jpeg"
    assert "rahasia_gaji_direksi_2026_watermark_removed.jpg" in (
        r_apply.headers["content-disposition"]
    )

    out_img = Image.open(io.BytesIO(r_apply.content))
    assert out_img.format == "JPEG"
    assert len(out_img.getexif()) == 0
    out_arr = np.asarray(out_img, dtype=np.uint8)
    # Watermark merah di tengah (100, 130) hilang mendekati latar terang (242, 242, 242)
    assert out_arr[100, 130, 0] > 210 and out_arr[100, 130, 1] > 210

    # Audit log JSONL wajib mencatat event tanpa nama berkas maupun PII
    log_files = sorted(log_dir.glob("audit-*.jsonl"))
    assert len(log_files) == 1
    raw_log = log_files[0].read_text(encoding="utf-8")
    assert "rahasia_gaji_direksi_2026" not in raw_log
    events = [json.loads(line)["event"] for line in raw_log.splitlines()]
    assert "watermark_removal.analyze" in events
    assert "watermark_removal.preview" in events
    assert "watermark_removal.apply" in events
