import io
import sys
import zipfile
from pathlib import Path

import pymupdf
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfReader, PdfWriter

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app
from app.services.pdf_tools import (
    images_to_pdf,
    merge_pdf_and_images,
    parse_page_ranges,
    pdf_to_images_zip,
    split_pdf,
)

client = TestClient(app)


def create_pdf(page_count: int = 2) -> bytes:
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=595, height=842)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def create_png(color: str = "blue") -> bytes:
    image = Image.new("RGB", (200, 300), color)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def auth_headers() -> dict[str, str]:
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    return {
        CSRF_HEADER_NAME: session_manager.csrf_token,
        "Origin": "http://localhost:5173",
    }


def test_parse_page_ranges():
    assert parse_page_ranges("1-2, 4", 5) == [0, 1, 3]


def test_merge_pdf_and_image_outputs_two_pages():
    output = merge_pdf_and_images(
        [("sample.pdf", create_pdf(1)), ("image.png", create_png())]
    )
    assert len(PdfReader(output).pages) == 2


def test_split_pdf_uses_requested_range():
    output = split_pdf(create_pdf(4), "2-3")
    assert len(PdfReader(output).pages) == 2


def test_images_to_pdf_creates_multiple_pages():
    output = images_to_pdf(
        [("one.png", create_png("blue")), ("two.png", create_png("red"))],
        "A4",
        "portrait",
    )
    assert len(PdfReader(output).pages) == 2


def test_pdf_to_images_zip_contains_all_pages():
    pdf = pymupdf.open()
    pdf.new_page()
    pdf.new_page()
    pdf_bytes = pdf.tobytes()
    pdf.close()

    output = pdf_to_images_zip(pdf_bytes, "png", 72)
    with zipfile.ZipFile(output) as archive:
        assert archive.namelist() == ["page_001.png", "page_002.png"]


def test_merge_endpoint_requires_auth():
    files = [("files", ("sample.pdf", create_pdf(1), "application/pdf"))]
    response = client.post("/api/pdf-tools/merge", files=files)
    assert response.status_code == 401


def test_split_endpoint_returns_pdf_attachment():
    files = {"file": ("sample.pdf", create_pdf(3), "application/pdf")}
    response = client.post(
        "/api/pdf-tools/split",
        files=files,
        data={"pages": "1,3"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(PdfReader(io.BytesIO(response.content)).pages) == 2


def test_images_to_pdf_endpoint_returns_pdf():
    files = [
        ("files", ("one.png", create_png("blue"), "image/png")),
        ("files", ("two.png", create_png("red"), "image/png")),
    ]
    response = client.post(
        "/api/pdf-tools/images-to-pdf",
        files=files,
        data={"page_size": "LETTER", "orientation": "landscape"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"


def test_pdf_to_images_endpoint_returns_zip():
    pdf = pymupdf.open()
    pdf.new_page()
    pdf_bytes = pdf.tobytes()
    pdf.close()
    files = {"file": ("sample.pdf", pdf_bytes, "application/pdf")}

    response = client.post(
        "/api/pdf-tools/pdf-to-images",
        files=files,
        data={"image_format": "jpeg", "dpi": "72"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert archive.namelist() == ["page_001.jpg"]


def test_encrypted_pdf_rejected():
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    writer.encrypt("secret123")
    output = io.BytesIO()
    writer.write(output)
    enc_pdf = output.getvalue()

    files = {"file": ("encrypted.pdf", enc_pdf, "application/pdf")}
    response = client.post(
        "/api/pdf-tools/split",
        files=files,
        data={"pages": "1"},
        headers=auth_headers(),
    )
    assert response.status_code == 422
    assert "terenkripsi" in response.json()["detail"]


def test_split_invalid_range_rejected():
    files = {"file": ("sample.pdf", create_pdf(2), "application/pdf")}
    response = client.post(
        "/api/pdf-tools/split",
        files=files,
        data={"pages": "5-10"},
        headers=auth_headers(),
    )
    assert response.status_code == 422
    assert "Rentang" in response.json()["detail"]


def test_split_filename_sanitized():
    files = {"file": ("my test file (1)!?.pdf", create_pdf(2), "application/pdf")}
    response = client.post(
        "/api/pdf-tools/split",
        files=files,
        data={"pages": "1"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    disposition = response.headers["content-disposition"]
    assert "my_test_file__1_split.pdf" in disposition
