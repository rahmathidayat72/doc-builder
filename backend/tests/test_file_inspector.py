"""
Unit tests for File Safety Inspector and Quarantine Manager
Task: FS-05 (Phase File Shelf)
"""

from __future__ import annotations

import io
import zipfile

import docx
import pypdf
import pytest
from PIL import Image

from app.services.file_inspector import (
    MIME_DOCX,
    MIME_JPEG,
    MIME_MD,
    MIME_PDF,
    MIME_PNG,
    QuarantineManager,
    SecurityInspectionError,
    UnsupportedFormatError,
    inspect_file_safety,
)
from app.services.file_scanner import EICAR_SIGNATURE, MalwareDetectedError


def test_clean_pdf():
    # Build minimal valid PDF
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()

    result = inspect_file_safety(pdf_bytes, filename="document.pdf")
    assert result.is_safe is True
    assert result.content_type == MIME_PDF
    assert result.detected_format == "pdf"
    assert result.has_exif_warning is False


def test_pdf_with_javascript_rejected():
    # Construct PDF with /JavaScript action
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_js("app.alert('Hello from PDF');")
    buf = io.BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()

    with pytest.raises(SecurityInspectionError) as exc:
        inspect_file_safety(pdf_bytes, filename="doc_js.pdf")
    assert "elemen aktif" in str(exc.value)


def test_pdf_with_launch_action_rejected():
    # Raw PDF containing /Launch token
    raw_pdf = (
        b"%PDF-1.4\n1 0 obj\n"
        b"<< /Type /Catalog /Pages 2 0 R /Launch << /F (cmd.exe) >> >>\nendobj\n"
    )
    with pytest.raises(SecurityInspectionError) as exc:
        inspect_file_safety(raw_pdf, filename="doc_launch.pdf")
    assert "elemen aktif" in str(exc.value)


def test_malware_eicar_rejected():
    with pytest.raises(MalwareDetectedError) as exc:
        inspect_file_safety(EICAR_SIGNATURE, filename="virus.txt")
    assert "Eicar" in str(exc.value)


def test_archive_zip_rejected():
    # Construct a plain generic ZIP file
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("archive.txt", "Some archived contents")
    zip_bytes = buf.getvalue()

    with pytest.raises(UnsupportedFormatError) as exc:
        inspect_file_safety(zip_bytes, filename="files.zip")
    assert "arsip" in str(exc.value).lower()


def test_svg_rejected():
    svg_data = b"<svg xmlns='http://www.w3.org/2000/svg'><circle cx='10' cy='10' r='5'/></svg>"
    with pytest.raises(UnsupportedFormatError) as exc:
        inspect_file_safety(svg_data, filename="vector.svg")
    assert "SVG" in str(exc.value)


def test_clean_docx():
    doc = docx.Document()
    doc.add_heading("Satukit Test Document", 0)
    doc.add_paragraph("This is safe body text.")
    buf = io.BytesIO()
    doc.save(buf)
    docx_bytes = buf.getvalue()

    result = inspect_file_safety(docx_bytes, filename="report.docx")
    assert result.is_safe is True
    assert result.content_type == MIME_DOCX
    assert result.detected_format == "docx"


def test_clean_jpeg_and_png():
    # 1. Clean PNG
    img_png = Image.new("RGB", (50, 50), color="blue")
    buf_png = io.BytesIO()
    img_png.save(buf_png, format="PNG")
    png_bytes = buf_png.getvalue()

    res_png = inspect_file_safety(png_bytes, filename="photo.png")
    assert res_png.is_safe is True
    assert res_png.content_type == MIME_PNG
    assert res_png.has_exif_warning is False

    # 2. Clean JPEG
    img_jpg = Image.new("RGB", (50, 50), color="red")
    buf_jpg = io.BytesIO()
    img_jpg.save(buf_jpg, format="JPEG")
    jpg_bytes = buf_jpg.getvalue()

    res_jpg = inspect_file_safety(jpg_bytes, filename="photo.jpg")
    assert res_jpg.is_safe is True
    assert res_jpg.content_type == MIME_JPEG


def test_static_image_with_exif_preserves_bytes_and_flags_warning():
    # Construct JPEG with EXIF header
    img = Image.new("RGB", (50, 50), color="green")
    exif = img.getexif()
    exif[0x010E] = "Satukit Photo Description"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    jpg_with_exif = buf.getvalue()

    result = inspect_file_safety(jpg_with_exif, filename="vacation.jpg")
    assert result.is_safe is True
    assert result.content_type == MIME_JPEG
    assert result.has_exif_warning is True


def test_markdown_safety():
    # 1. Safe Markdown
    clean_md = b"# Satukit Notes\n\nThis is a clean markdown file.\n- Point A\n- Point B\n"
    res = inspect_file_safety(clean_md, filename="notes.md")
    assert res.is_safe is True
    assert res.content_type == MIME_MD
    assert res.detected_format == "markdown"

    # 2. Markdown with NUL byte
    corrupted_md = b"# Title\x00Binary payload embedded"
    with pytest.raises(SecurityInspectionError) as exc:
        inspect_file_safety(corrupted_md, filename="notes.md")
    assert "NUL byte" in str(exc.value)


def test_quarantine_manager(tmp_path):
    qm = QuarantineManager(base_dir=str(tmp_path))
    data = b"Secret quarantined byte payload"
    item_id = "test_item_1"

    filepath = qm.write_file(item_id, data)
    assert filepath is not None

    with open(filepath, "rb") as f:
        assert f.read() == data

    # Clean up
    qm.remove_file(filepath)
    with pytest.raises(FileNotFoundError):
        open(filepath, "rb")
