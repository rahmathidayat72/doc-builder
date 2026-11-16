"""Generator corpus sintetis untuk feasibility spike RW-01 (Hapus Watermark)."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import pymupdf
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.pdf_tools import watermark_pdf  # noqa: E402

DEFAULT_OUT_DIR = ROOT_DIR / "temp_workspace" / "watermark-spike-out"
SAMPLES_DIR = DEFAULT_OUT_DIR / "samples"
BASELINES_DIR = DEFAULT_OUT_DIR / "baselines"


def _make_logo_rgba(size: tuple[int, int] = (240, 120), alpha_val: int = 90) -> bytes:
    """Membuat gambar logo watermark sintetis RGBA semi-transparan."""
    w, h = size
    canvas = np.zeros((h, w, 4), dtype=np.uint8)
    # Lingkaran + palang sederhana + teks WATERMARK
    cv2.circle(canvas, (52, h // 2), 34, (220, 38, 38, alpha_val), thickness=5)
    cv2.line(canvas, (30, h // 2), (74, h // 2), (220, 38, 38, alpha_val), thickness=4)
    cv2.putText(
        canvas,
        "SAMPLE",
        (96, h // 2 + 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (220, 38, 38, alpha_val),
        3,
        cv2.LINE_AA,
    )
    ok, buf = cv2.imencode(".png", canvas)
    if not ok:
        raise RuntimeError("Gagal encode logo sintetis.")
    return buf.tobytes()


def _create_base_document_pdf(num_pages: int = 3) -> pymupdf.Document:
    """Membuat dokumen PDF multi-halaman vektor sintetis yang bersih."""
    doc = pymupdf.open()
    for i in range(num_pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text(
            (50, 60),
            f"DOKUMEN UJI SATUKIT - HALAMAN {i + 1}",
            fontsize=15,
            fontname="helv",
            color=(0.1, 0.2, 0.35),
        )
        page.draw_line((50, 74), (545, 74), color=(0.4, 0.5, 0.6), width=1.0)
        for row in range(10):
            y = 110 + row * 58
            page.insert_text(
                (55, y),
                f"Baris {row + 1}. Konten utama dokumen vektor yang wajib tetap utuh dan terbaca.",
                fontsize=10.5,
                fontname="helv",
                color=(0.12, 0.12, 0.12),
            )
            page.draw_rect(
                pymupdf.Rect(50, y - 14, 545, y + 18),
                color=(0.82, 0.85, 0.88),
                width=0.6,
            )
    return doc


def _render_clean_document_bgr(width: int = 1240, height: int = 1754) -> np.ndarray:
    """Merender halaman dokumen sintetis beresolusi tinggi untuk uji raster/scan."""
    img = np.full((height, width, 3), 248, dtype=np.uint8)
    cv2.rectangle(img, (60, 60), (width - 60, height - 60), (210, 215, 220), 2)
    cv2.putText(
        img,
        "LAPORAN INVENTARIS DOKUMEN",
        (100, 140),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.4,
        (25, 45, 70),
        3,
        cv2.LINE_AA,
    )
    cv2.line(img, (100, 165), (width - 100, 165), (40, 90, 110), 3)
    for row in range(14):
        y = 250 + row * 95
        cv2.putText(
            img,
            f"Item #{row + 1:02d}: Data transaksi internal yang harus tetap jelas pasca inpaint.",
            (110, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.85,
            (35, 35, 35),
            2,
            cv2.LINE_AA,
        )
        cv2.line(img, (100, y + 24), (width - 100, y + 24), (220, 224, 228), 1)
    return img


def _render_clean_photo_bgr(width: int = 1600, height: int = 1200) -> np.ndarray:
    """Membuat gambar foto/grafis sintetis berwarna bergradasi + objek geometris."""
    xs = np.linspace(40, 220, width, dtype=np.float32)
    ys = np.linspace(70, 200, height, dtype=np.float32)
    xv, yv = np.meshgrid(xs, ys)
    b = np.clip(xv, 0, 255).astype(np.uint8)
    g = np.clip((xv + yv) * 0.5, 0, 255).astype(np.uint8)
    r = np.clip(yv, 0, 255).astype(np.uint8)
    img = cv2.merge([b, g, r])
    cv2.circle(img, (width // 2, height // 2), 260, (240, 195, 75), -1, cv2.LINE_AA)
    cv2.rectangle(
        img,
        (width // 2 - 420, height // 2 - 140),
        (width // 2 - 140, height // 2 + 140),
        (28, 120, 118),
        -1,
    )
    cv2.putText(
        img,
        "PORTFOLIO ASSET",
        (width // 2 - 160, height // 2 + 320),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.5,
        (25, 30, 35),
        4,
        cv2.LINE_AA,
    )
    return img


def _overlay_diagonal_text_watermark(
    bgr: np.ndarray,
    text: str = "CONFIDENTIAL",
    alpha: float = 0.24,
    color: tuple[int, int, int] = (50, 50, 210),
    font_scale: float = 3.2,
    thickness: int = 7,
) -> tuple[np.ndarray, tuple[float, float, float, float]]:
    """Menempelkan watermark teks semi-transparan dan mengembalikan bbox ternormalisasi (x0,y0,x1,y1)."""
    h, w = bgr.shape[:2]
    overlay = np.zeros((h, w, 3), dtype=np.uint8)
    mask = np.zeros((h, w), dtype=np.uint8)

    text_size, baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
    tw, th = text_size
    cx, cy = w // 2, h // 2
    org = (cx - tw // 2, cy + th // 2)

    cv2.putText(overlay, text, org, cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness, cv2.LINE_AA)
    cv2.putText(mask, text, org, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 255, thickness, cv2.LINE_AA)

    mat = cv2.getRotationMatrix2D((cx, cy), 30.0, 1.0)
    rot_overlay = cv2.warpAffine(overlay, mat, (w, h), flags=cv2.INTER_LINEAR)
    rot_mask = cv2.warpAffine(mask, mat, (w, h), flags=cv2.INTER_NEAREST)

    out = bgr.copy()
    wm_idx = rot_mask > 0
    out[wm_idx] = (
        (1.0 - alpha) * out[wm_idx].astype(np.float32)
        + alpha * rot_overlay[wm_idx].astype(np.float32)
    ).astype(np.uint8)

    ys, xs = np.where(wm_idx)
    x0 = float(xs.min()) / w
    y0 = float(ys.min()) / h
    x1 = float(xs.max() + 1) / w
    y1 = float(ys.max() + 1) / h
    return out, (x0, y0, x1, y1)


def _overlay_logo_watermark(
    bgr: np.ndarray,
    logo_bytes: bytes,
    top_left_norm: tuple[float, float] = (0.62, 0.72),
    scale_w_norm: float = 0.28,
) -> tuple[np.ndarray, tuple[float, float, float, float]]:
    """Menempelkan logo watermark RGBA pada citra BGR dan mengembalikan bbox ternormalisasi."""
    h, w = bgr.shape[:2]
    logo_arr = cv2.imdecode(np.frombuffer(logo_bytes, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    if logo_arr is None or logo_arr.shape[2] != 4:
        raise RuntimeError("Logo RGBA tidak valid.")

    target_w = max(32, int(w * scale_w_norm))
    target_h = max(16, int(target_w * (logo_arr.shape[0] / logo_arr.shape[1])))
    resized = cv2.resize(logo_arr, (target_w, target_h), interpolation=cv2.INTER_AREA)

    x0_px = min(w - target_w, max(0, int(w * top_left_norm[0])))
    y0_px = min(h - target_h, max(0, int(h * top_left_norm[1])))
    x1_px = x0_px + target_w
    y1_px = y0_px + target_h

    alpha = (resized[:, :, 3:4].astype(np.float32)) / 255.0
    rgb_logo = resized[:, :, :3].astype(np.float32)

    out = bgr.copy()
    roi = out[y0_px:y1_px, x0_px:x1_px].astype(np.float32)
    blended = (1.0 - alpha) * roi + alpha * rgb_logo
    out[y0_px:y1_px, x0_px:x1_px] = np.clip(blended, 0, 255).astype(np.uint8)

    return out, (x0_px / w, y0_px / h, x1_px / w, y1_px / h)


def _save_jpeg_with_exif(bgr: np.ndarray, path: Path) -> None:
    """Menyimpan JPG dengan EXIF sintetis untuk menguji penghapusan metadata."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    exif = Image.Exif()
    exif[0x010F] = "Satukit-TestCam"
    exif[0x0110] = "Model-X1"
    exif[0x013B] = "Synthetic Test Author"
    pil_img.save(path, format="JPEG", quality=92, exif=exif.tobytes())


def create_corpus(out_root: Path = DEFAULT_OUT_DIR) -> dict:
    """Menghasilkan seluruh sampel corpus sintetis RW-01 dan manifest ground-truth."""
    samples_dir = out_root / "samples"
    baselines_dir = out_root / "baselines"
    samples_dir.mkdir(parents=True, exist_ok=True)
    baselines_dir.mkdir(parents=True, exist_ok=True)

    logo_bytes = _make_logo_rgba()
    records: list[dict] = []

    # 1. PDF dengan Stamp/Annotation (halaman 1 & 2 ber-annotation, halaman 3 bersih)
    doc = _create_base_document_pdf(3)
    for idx in (0, 1):
        page = doc[idx]
        page.add_stamp_annot(pymupdf.Rect(180, 320, 415, 420), stamp=0)
    p1 = samples_dir / "01_pdf_stamp_annot.pdf"
    doc.save(p1)
    doc.close()
    records.append({
        "id": "01_pdf_stamp_annot",
        "kind": "pdf_annot",
        "path": str(p1),
        "target_pages": [0, 1],
        "non_target_pages": [2],
        "expected_removal": "structural",
    })

    # 2. PDF teks berulang antarhalaman (halaman 1 & 2, halaman 3 bersih vektor)
    doc = _create_base_document_pdf(3)
    for idx in (0, 1):
        page = doc[idx]
        page.insert_text(
            (190, 420),
            "INTERNAL DRAFT",
            fontsize=32,
            fontname="helv",
            color=(0.82, 0.25, 0.25),
            fill_opacity=0.25,
        )
    p2 = samples_dir / "02_pdf_repeated_text.pdf"
    doc.save(p2)
    doc.close()
    records.append({
        "id": "02_pdf_repeated_text",
        "kind": "pdf_repeated_text",
        "path": str(p2),
        "target_pages": [0, 1],
        "non_target_pages": [2],
        "expected_bboxes_norm": [[185 / 595, 385 / 842, 435 / 595, 430 / 842]],
        "expected_removal": "raster_selective",
    })

    # 3. PDF hasil fungsi watermark_pdf Satukit (mode text, mosaic, halaman 1-2 dari 3)
    base_doc = _create_base_document_pdf(3)
    base_bytes = base_doc.tobytes()
    base_doc.close()
    satukit_text_buf, _ = watermark_pdf(
        base_bytes,
        mode="text",
        text="SATUKIT",
        opacity=0.25,
        rotation=45.0,
        position="mosaic",
        fontsize=36,
        color_hex="#e11d48",
        pages_str="1-2",
    )
    p3 = samples_dir / "03_pdf_satukit_text_watermark.pdf"
    p3.write_bytes(satukit_text_buf.getvalue())
    records.append({
        "id": "03_pdf_satukit_text_watermark",
        "kind": "pdf_satukit_text",
        "path": str(p3),
        "target_pages": [0, 1],
        "non_target_pages": [2],
        "expected_removal": "raster_selective",
    })

    # 4. PDF logo berulang antarhalaman (halaman 1 & 2, halaman 3 bersih)
    doc = _create_base_document_pdf(3)
    logo_rect = pymupdf.Rect(180, 340, 415, 460)
    for idx in (0, 1):
        doc[idx].insert_image(logo_rect, stream=logo_bytes, keep_proportion=True, overlay=True)
    p4 = samples_dir / "04_pdf_repeated_logo.pdf"
    doc.save(p4)
    doc.close()
    records.append({
        "id": "04_pdf_repeated_logo",
        "kind": "pdf_repeated_logo",
        "path": str(p4),
        "target_pages": [0, 1],
        "non_target_pages": [2],
        "expected_bboxes_norm": [[180 / 595, 340 / 842, 415 / 595, 460 / 842]],
        "expected_removal": "raster_selective",
    })

    # 5. PDF hasil fungsi watermark_pdf Satukit (mode image, center, halaman 1-2 dari 3)
    satukit_logo_buf, _ = watermark_pdf(
        base_bytes,
        mode="image",
        image_bytes=logo_bytes,
        opacity=0.4,
        position="center",
        pages_str="1-2",
    )
    p5 = samples_dir / "05_pdf_satukit_logo_watermark.pdf"
    p5.write_bytes(satukit_logo_buf.getvalue())
    records.append({
        "id": "05_pdf_satukit_logo_watermark",
        "kind": "pdf_satukit_logo",
        "path": str(p5),
        "target_pages": [0, 1],
        "non_target_pages": [2],
        "expected_removal": "raster_selective",
    })

    # 6. PDF scan raster dengan watermark teks tipis (2 halaman)
    clean_doc_bgr = _render_clean_document_bgr()
    scan_text_bgr, scan_text_bbox = _overlay_diagonal_text_watermark(
        clean_doc_bgr, text="SAMPLE COPY", alpha=0.22
    )
    ok, clean_png = cv2.imencode(".png", clean_doc_bgr)
    ok2, wm_png = cv2.imencode(".png", scan_text_bgr)
    if not (ok and ok2):
        raise RuntimeError("Gagal encode scan raster text.")
    base_scan_path = baselines_dir / "06_clean_doc.png"
    base_scan_path.write_bytes(clean_png.tobytes())

    doc = pymupdf.open()
    for _ in range(2):
        page = doc.new_page(width=595, height=842)
        page.insert_image(page.rect, stream=wm_png.tobytes())
    p6 = samples_dir / "06_pdf_scan_raster_text_wm.pdf"
    doc.save(p6)
    doc.close()
    records.append({
        "id": "06_pdf_scan_raster_text_wm",
        "kind": "pdf_scan_text",
        "path": str(p6),
        "baseline_path": str(base_scan_path),
        "target_pages": [0, 1],
        "non_target_pages": [],
        "expected_bboxes_norm": [list(scan_text_bbox)],
        "expected_removal": "raster_manual_or_ocr",
    })

    # 7. PDF scan raster dengan watermark logo tipis (2 halaman)
    scan_logo_bgr, scan_logo_bbox = _overlay_logo_watermark(
        clean_doc_bgr, logo_bytes, top_left_norm=(0.35, 0.42), scale_w_norm=0.32
    )
    ok3, wm_logo_png = cv2.imencode(".png", scan_logo_bgr)
    if not ok3:
        raise RuntimeError("Gagal encode scan raster logo.")
    doc = pymupdf.open()
    for _ in range(2):
        page = doc.new_page(width=595, height=842)
        page.insert_image(page.rect, stream=wm_logo_png.tobytes())
    p7 = samples_dir / "07_pdf_scan_raster_logo_wm.pdf"
    doc.save(p7)
    doc.close()
    records.append({
        "id": "07_pdf_scan_raster_logo_wm",
        "kind": "pdf_scan_logo",
        "path": str(p7),
        "baseline_path": str(base_scan_path),
        "target_pages": [0, 1],
        "non_target_pages": [],
        "expected_bboxes_norm": [list(scan_logo_bbox)],
        "expected_removal": "raster_manual_or_ocr",
    })

    # 8. JPG foto dengan watermark teks & EXIF sintetis
    clean_photo = _render_clean_photo_bgr(1600, 1200)
    base_photo_path = baselines_dir / "08_clean_photo.png"
    cv2.imwrite(str(base_photo_path), clean_photo)
    photo_text_wm, photo_text_bbox = _overlay_diagonal_text_watermark(
        clean_photo, text="PREVIEW ONLY", alpha=0.28, font_scale=3.4, thickness=8
    )
    p8 = samples_dir / "08_photo_text_wm.jpg"
    _save_jpeg_with_exif(photo_text_wm, p8)
    records.append({
        "id": "08_photo_text_wm",
        "kind": "jpg_text_exif",
        "path": str(p8),
        "baseline_path": str(base_photo_path),
        "expected_bboxes_norm": [list(photo_text_bbox)],
        "has_exif": True,
    })

    # 9. JPG banner HD dengan watermark logo & EXIF sintetis
    clean_banner = _render_clean_photo_bgr(1920, 1080)
    base_banner_path = baselines_dir / "09_clean_banner.png"
    cv2.imwrite(str(base_banner_path), clean_banner)
    banner_logo_wm, banner_logo_bbox = _overlay_logo_watermark(
        clean_banner, logo_bytes, top_left_norm=(0.65, 0.72), scale_w_norm=0.28
    )
    p9 = samples_dir / "09_banner_logo_wm.jpg"
    _save_jpeg_with_exif(banner_logo_wm, p9)
    records.append({
        "id": "09_banner_logo_wm",
        "kind": "jpg_logo_exif",
        "path": str(p9),
        "baseline_path": str(base_banner_path),
        "expected_bboxes_norm": [list(banner_logo_bbox)],
        "has_exif": True,
    })

    # 10. PNG dokumen scan opak RGB dengan watermark teks
    p10 = samples_dir / "10_document_scan_wm.png"
    cv2.imwrite(str(p10), scan_text_bgr)
    records.append({
        "id": "10_document_scan_wm",
        "kind": "png_rgb",
        "path": str(p10),
        "baseline_path": str(base_scan_path),
        "expected_bboxes_norm": [list(scan_text_bbox)],
        "has_alpha": False,
    })

    # 11. PNG RGBA transparan (menguji pelestarian kanal alpha 100%)
    size = 1024
    clean_rgba = np.zeros((size, size, 4), dtype=np.uint8)
    # Bentuk lingkaran & kotak solid dengan tepi anti-aliased
    cv2.circle(clean_rgba, (512, 512), 340, (180, 140, 30, 255), -1, cv2.LINE_AA)
    cv2.rectangle(clean_rgba, (280, 280), (540, 540), (45, 95, 210, 255), -1)
    # Efek feathering ringan pada bagian pinggir untuk uji alpha gradien 0..255
    cv2.circle(clean_rgba, (512, 512), 350, (180, 140, 30, 128), 8, cv2.LINE_AA)

    base_rgba_path = baselines_dir / "11_clean_rgba.png"
    cv2.imwrite(str(base_rgba_path), clean_rgba)

    # Tempel watermark HANYA pada RGB di dalam area grafik (kanal alpha asli utuh)
    wm_rgba = clean_rgba.copy()
    wm_bgr, rgba_bbox = _overlay_diagonal_text_watermark(
        clean_rgba[:, :, :3], text="DRAFT", alpha=0.30, font_scale=3.0, thickness=8
    )
    # Pertahankan alpha asli agar hanya area alpha>0 terlihat membawa watermark
    opaque_mask = clean_rgba[:, :, 3] > 0
    wm_rgba[:, :, :3][opaque_mask] = wm_bgr[opaque_mask]
    p11 = samples_dir / "11_transparent_asset_wm.png"
    cv2.imwrite(str(p11), wm_rgba)
    records.append({
        "id": "11_transparent_asset_wm",
        "kind": "png_rgba",
        "path": str(p11),
        "baseline_path": str(base_rgba_path),
        "expected_bboxes_norm": [list(rgba_bbox)],
        "has_alpha": True,
    })

    # 12. Negatif: PDF terenkripsi password (harus ditolak fail-closed)
    enc_doc = _create_base_document_pdf(1)
    p12 = samples_dir / "12_negative_encrypted.pdf"
    enc_doc.save(
        p12,
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        user_pw="spike-user-secret",
        owner_pw="spike-owner-secret",
    )
    enc_doc.close()
    records.append({
        "id": "12_negative_encrypted",
        "kind": "negative_encrypted_pdf",
        "path": str(p12),
    })

    # 13. Negatif: PDF bertanda tangan digital (harus ditolak fail-closed)
    sig_doc = _create_base_document_pdf(1)
    widget = pymupdf.Widget()
    widget.rect = pymupdf.Rect(50, 720, 220, 770)
    widget.field_type = pymupdf.PDF_WIDGET_TYPE_SIGNATURE
    widget.field_name = "SignatureSpike1"
    sig_doc[0].add_widget(widget)
    p13 = samples_dir / "13_negative_signed.pdf"
    sig_doc.save(p13)
    sig_doc.close()
    records.append({
        "id": "13_negative_signed",
        "kind": "negative_signed_pdf",
        "path": str(p13),
    })

    manifest = {"corpus_count": len(records), "samples": records}
    manifest_path = samples_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


if __name__ == "__main__":
    manifest = create_corpus()
    print(f"Generated {manifest['corpus_count']} corpus samples in {SAMPLES_DIR}")
