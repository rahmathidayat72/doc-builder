import io
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app
from app.services.image_resizer import resize_image_to_target, strip_exif

client = TestClient(app)


def auth_headers() -> dict[str, str]:
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    return {
        CSRF_HEADER_NAME: session_manager.csrf_token,
        "Origin": "http://localhost:5173",
    }


def create_sample_image(
    format_name: str = "JPEG",
    size: tuple[int, int] = (800, 600),
    color: tuple[int, int, int] = (100, 150, 200),
    include_exif: bool = False,
) -> bytes:
    img = Image.new("RGB", size, color)
    output = io.BytesIO()

    if include_exif and format_name.upper() == "JPEG":
        exif = img.getexif()
        exif[0x010E] = "Confidential User Location"
        exif[0x0131] = "Camera Model X"
        img.save(output, format=format_name, exif=exif)
    else:
        img.save(output, format=format_name)

    return output.getvalue()


def test_strip_exif_removes_metadata():
    img_bytes = create_sample_image("JPEG", include_exif=True)
    img_with_exif = Image.open(io.BytesIO(img_bytes))
    assert 0x010E in img_with_exif.getexif()

    clean_img = strip_exif(img_with_exif)
    out = io.BytesIO()
    clean_img.save(out, format="JPEG")
    out.seek(0)
    reloaded = Image.open(out)
    assert 0x010E not in reloaded.getexif()


def test_resize_image_to_target_kb():
    orig_bytes = create_sample_image("JPEG", size=(1200, 900))
    target_kb = 40
    output_buf, orig_size, final_size = resize_image_to_target(
        orig_bytes, target_kb=target_kb, output_format="jpeg"
    )

    assert final_size <= target_kb * 1024
    assert orig_size == len(orig_bytes)
    result_img = Image.open(output_buf)
    assert result_img.format == "JPEG"


def test_resize_image_invalid_input():
    with pytest.raises(ValueError, match="bukan format gambar valid"):
        resize_image_to_target(b"not an image", target_kb=50)

    with pytest.raises(ValueError, match="minimal 5 KB"):
        resize_image_to_target(create_sample_image(), target_kb=2)


def test_endpoint_resize_jpeg_success():
    img_bytes = create_sample_image("JPEG", size=(1000, 800), include_exif=True)
    files = {"file": ("my_photo (vacation).jpg", img_bytes, "image/jpeg")}
    data = {"target_kb": "50", "output_format": "jpeg", "strip_exif": "true"}

    response = client.post(
        "/api/image-tools/resize",
        files=files,
        data=data,
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert "my_photo__vacation_resized.jpg" in response.headers["content-disposition"]
    assert "x-original-size" in response.headers
    assert "x-optimized-size" in response.headers
    assert int(response.headers["x-optimized-size"]) <= 50 * 1024


def test_endpoint_resize_png_success():
    img_bytes = create_sample_image("PNG", size=(600, 400))
    files = {"file": ("diagram.png", img_bytes, "image/png")}
    data = {"target_kb": "30", "output_format": "png", "strip_exif": "true"}

    response = client.post(
        "/api/image-tools/resize",
        files=files,
        data=data,
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert int(response.headers["x-optimized-size"]) <= 30 * 1024


def test_endpoint_resize_rejects_corrupted_payload():
    files = {"file": ("corrupt.jpg", b"bad image data 12345", "image/jpeg")}
    data = {"target_kb": "50"}

    response = client.post(
        "/api/image-tools/resize",
        files=files,
        data=data,
        headers=auth_headers(),
    )

    assert response.status_code == 422
    assert "bukan format gambar valid" in response.json()["detail"]


def test_endpoint_resize_requires_auth():
    files = {"file": ("photo.jpg", create_sample_image(), "image/jpeg")}
    data = {"target_kb": "50"}

    response = client.post(
        "/api/image-tools/resize",
        files=files,
        data=data,
    )
    assert response.status_code in (401, 403)
