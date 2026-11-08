from __future__ import annotations

import io

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.core.config import settings
from app.core.security import session_manager
from app.main import app
from app.services.bg_remover import (
    BackgroundRemovalManager,
    BackgroundRemoverBusyError,
    validate_image_payload,
)

client = TestClient(app)


def make_test_image(format_name: str = "PNG", size: tuple[int, int] = (120, 120)) -> bytes:
    """Membuat citra sintetis sederhana untuk pengujian."""
    img = Image.new("RGB", size, color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    # Gambar subjek lingkaran berwarna solid di tengah
    draw.ellipse([20, 20, size[0] - 20, size[1] - 20], fill=(220, 40, 40))

    buf = io.BytesIO()
    img.save(buf, format=format_name)
    return buf.getvalue()


def test_validate_image_payload():
    # 1. Berkas kosong
    with pytest.raises(HTTPException) as exc1:
        validate_image_payload(b"")
    assert exc1.value.status_code == 400

    # 2. Berkas melebihi 10 MB
    oversized = b"0" * (11 * 1024 * 1024)
    with pytest.raises(HTTPException) as exc2:
        validate_image_payload(oversized)
    assert exc2.value.status_code == 413

    # 3. Format tidak valid
    with pytest.raises(HTTPException) as exc3:
        validate_image_payload(b"Bukan berkas gambar sama sekali")
    assert exc3.value.status_code == 422

    # 4. Valid magic bytes
    jpeg_bytes = make_test_image("JPEG")
    assert validate_image_payload(jpeg_bytes) == "jpeg"

    png_bytes = make_test_image("PNG")
    assert validate_image_payload(png_bytes) == "png"

    webp_bytes = make_test_image("WEBP")
    assert validate_image_payload(webp_bytes) == "webp"


def test_bg_remover_manager_inference_real_model():
    """Menguji eksekusi inferensi U2NetP nyata pada subprocess terisolasi."""
    model_path = settings.U2NETP_MODEL_PATH
    if not model_path.is_file():
        pytest.skip("Model u2netp.onnx belum ada di server")

    manager = BackgroundRemovalManager(model_path=model_path, timeout_seconds=30)
    input_bytes = make_test_image("JPEG", size=(100, 100))

    out_buf, metrics = manager.remove_background(input_bytes, "test.jpg")

    assert out_buf is not None
    assert metrics["success"] is True
    assert "inference_time_ms" in metrics
    assert metrics["original_size_bytes"] == len(input_bytes)
    assert metrics["processed_size_bytes"] > 0

    # Verifikasi berkas keluaran adalah PNG RGBA
    out_buf.seek(0)
    with Image.open(out_buf) as res_img:
        assert res_img.format == "PNG"
        assert res_img.mode == "RGBA"
        assert res_img.size == (100, 100)
        # Sudut luar (5, 5) harus memiliki alpha rendah / mendekati 0
        corner_alpha = res_img.getpixel((5, 5))[3]
        center_alpha = res_img.getpixel((50, 50))[3]
        assert corner_alpha < center_alpha


def test_bg_remover_concurrency_and_queue_rejection():
    """Menguji penolakan HTTP 429 saat konkurensi (1) dan antrean (2) terisi penuh."""
    model_path = settings.U2NETP_MODEL_PATH
    if not model_path.is_file():
        pytest.skip("Model u2netp.onnx belum ada di server")

    manager = BackgroundRemovalManager(
        model_path=model_path,
        concurrency_limit=1,
        queue_capacity=2,
    )

    # Simulasikan slot aktif 1 dan antrean 2
    manager._active_workers = 1
    manager._waiting_queue.put_nowait("job-1")
    manager._waiting_queue.put_nowait("job-2")

    # Request ke-4 harus langsung ditolak dengan BackgroundRemoverBusyError (429)
    valid_bytes = make_test_image("PNG")
    with pytest.raises(BackgroundRemoverBusyError) as exc:
        manager.remove_background(valid_bytes, "overflow.png")

    assert exc.value.status_code == 429
    assert exc.value.headers.get("Retry-After") == "30"
    assert exc.value.headers.get("X-Error-Code") == "CONCURRENCY_LIMIT_REACHED"


def test_api_remove_background_endpoint():
    """Menguji pemanggilan endpoint POST /api/image-tools/remove-background via HTTP client."""
    model_path = settings.U2NETP_MODEL_PATH
    if not model_path.is_file():
        pytest.skip("Model u2netp.onnx belum ada di server")

    input_bytes = make_test_image("PNG", size=(80, 80))

    # Ambil sesi lokal
    session_token = session_manager.session_token
    csrf_token = session_manager.csrf_token

    response = client.post(
        "/api/image-tools/remove-background",
        files={"file": ("profile.png", input_bytes, "image/png")},
        cookies={"docbuilder_session": session_token},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert 'attachment; filename="profile_nobg.png"' in response.headers["content-disposition"]
    assert "x-original-size" in response.headers
    assert "x-processed-size" in response.headers
    assert "x-inference-time-ms" in response.headers

    # Periksa konten gambar yang dikembalikan
    res_buf = io.BytesIO(response.content)
    with Image.open(res_buf) as img:
        assert img.format == "PNG"
        assert img.mode == "RGBA"
        assert img.size == (80, 80)
