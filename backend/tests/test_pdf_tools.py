import base64
import io
import json
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
    add_page_numbers_pdf,
    apply_pdf_editor_changes,
    compress_pdf,
    get_pdf_editor_pages,
    get_tesseract_status,
    images_to_pdf,
    merge_pdf_and_images,
    ocr_pdf,
    parse_page_range_groups,
    parse_page_ranges,
    pdf_to_images_zip,
    pdf_to_markdown,
    protect_pdf,
    repair_pdf,
    split_pdf,
    split_pdf_ranges_zip,
    unlock_pdf,
    validate_protect_password,
    watermark_pdf,
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


def test_parse_page_range_groups():
    groups = parse_page_range_groups("1-3, 5, 7-9", 10)
    assert len(groups) == 3
    assert groups[0] == ("pages_001-003", [0, 1, 2])
    assert groups[1] == ("page_005", [4])
    assert groups[2] == ("pages_007-009", [6, 7, 8])


def test_split_pdf_ranges_zip_creates_multiple_pdfs():
    source_pdf = create_pdf(6)
    zip_stream = split_pdf_ranges_zip(source_pdf, "1-2, 4, 5-6")
    with zipfile.ZipFile(zip_stream) as archive:
        names = archive.namelist()
        assert names == [
            "01_pages_001-002.pdf",
            "02_page_004.pdf",
            "03_pages_005-006.pdf",
        ]
        # Pastikan masing-masing berkas PDF valid
        pdf1 = PdfReader(io.BytesIO(archive.read("01_pages_001-002.pdf")))
        assert len(pdf1.pages) == 2
        pdf2 = PdfReader(io.BytesIO(archive.read("02_page_004.pdf")))
        assert len(pdf2.pages) == 1
        pdf3 = PdfReader(io.BytesIO(archive.read("03_pages_005-006.pdf")))
        assert len(pdf3.pages) == 2


def test_split_endpoint_ranges_mode_returns_zip():
    files = {"file": ("laporan_tahunan.pdf", create_pdf(5), "application/pdf")}
    response = client.post(
        "/api/pdf-tools/split",
        files=files,
        data={"pages": "1-2, 4-5", "output_mode": "ranges"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "laporan_tahunan_split.zip" in response.headers["content-disposition"]

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert archive.namelist() == [
            "01_pages_001-002.pdf",
            "02_pages_004-005.pdf",
        ]


def test_split_endpoint_ranges_mode_invalid_range_rejected():
    files = {"file": ("test.pdf", create_pdf(3), "application/pdf")}
    response = client.post(
        "/api/pdf-tools/split",
        files=files,
        data={"pages": "4-5", "output_mode": "ranges"},
        headers=auth_headers(),
    )
    assert response.status_code == 422
    assert "di luar batas" in response.json()["detail"]


def test_merge_with_docx_mocked_success():
    from unittest.mock import patch

    # Mock konversi docx menghasilkan stream PDF 2 halaman
    fake_pdf = create_pdf(2)
    with patch(
        "app.services.pdf_tools.convert_docx_to_pdf_sandboxed",
        return_value=(io.BytesIO(fake_pdf), None),
    ):
        output = merge_pdf_and_images(
            [
                ("doc1.pdf", create_pdf(1)),
                ("doc2.docx", b"PK\x03\x04fake_docx_content"),
            ]
        )
        assert len(PdfReader(output).pages) == 3


def test_merge_with_docx_without_libreoffice_returns_422_with_guidance():
    from unittest.mock import patch

    with patch(
        "app.services.pdf_tools.convert_docx_to_pdf_sandboxed",
        return_value=(None, "LIBREOFFICE_NOT_FOUND"),
    ):
        files = [
            ("files", ("surat.docx", b"PK\x03\x04fake_docx", "application/vnd.openxmlformats")),
        ]
        response = client.post(
            "/api/pdf-tools/merge",
            files=files,
            headers=auth_headers(),
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error_code"] == "LIBREOFFICE_NOT_FOUND"
        assert "LibreOffice belum terpasang" in data["message"]


def create_signed_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    w = pymupdf.Widget()
    w.rect = pymupdf.Rect(10, 10, 100, 50)
    w.field_type = pymupdf.PDF_WIDGET_TYPE_SIGNATURE
    w.field_name = "Signature1"
    page.add_widget(w)
    data = doc.tobytes()
    doc.close()
    return data


def create_image_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    img = Image.new("RGB", (600, 600))
    pixels = img.load()
    for x in range(600):
        for y in range(600):
            pixels[x, y] = ((x * 5) % 256, (y * 7) % 256, (x + y) % 256)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    page.insert_image(pymupdf.Rect(50, 50, 300, 300), stream=buf.getvalue())
    data = doc.tobytes()
    doc.close()
    return data


def test_compress_pdf_service_levels():
    source = create_image_pdf()
    orig_len = len(source)

    # Light compression
    out_light, applied_light, o_size, l_size = compress_pdf(source, "light")
    assert applied_light is True
    assert l_size < orig_len
    assert len(PdfReader(out_light).pages) == 1

    # Balanced compression
    out_bal, applied_bal, _, b_size = compress_pdf(source, "balanced")
    assert applied_bal is True
    assert b_size < orig_len
    assert len(PdfReader(out_bal).pages) == 1

    # Maximum compression
    out_max, applied_max, _, m_size = compress_pdf(source, "maximum")
    assert applied_max is True
    assert m_size <= b_size
    assert len(PdfReader(out_max).pages) == 1


def test_compress_pdf_already_optimal_fallback():
    # PDF teks kosong kecil yang sudah optimal
    tiny_pdf = create_pdf(1)
    output, applied, orig_size, out_size = compress_pdf(tiny_pdf, "light")
    assert applied is False
    assert out_size == orig_size
    assert len(output.getvalue()) == len(tiny_pdf)


def test_compress_pdf_signed_rejected():
    signed = create_signed_pdf()
    import pytest

    with pytest.raises(ValueError, match="tanda tangan digital"):
        compress_pdf(signed, "balanced")


def test_compress_endpoint_requires_auth():
    files = {"file": ("sample.pdf", create_pdf(1), "application/pdf")}
    response = client.post("/api/pdf-tools/compress", files=files)
    assert response.status_code in (401, 403)


def test_compress_endpoint_success():
    source = create_image_pdf()
    files = {"file": ("brosur produk (v1).pdf", source, "application/pdf")}
    response = client.post(
        "/api/pdf-tools/compress",
        files=files,
        data={"level": "balanced"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "brosur_produk__v1_compressed.pdf" in response.headers["content-disposition"]
    assert response.headers["x-compression-applied"] == "true"
    assert int(response.headers["x-output-size"]) < int(response.headers["x-original-size"])


def test_compress_endpoint_signed_rejected_422():
    files = {"file": ("kontrak.pdf", create_signed_pdf(), "application/pdf")}
    response = client.post(
        "/api/pdf-tools/compress",
        files=files,
        data={"level": "balanced"},
        headers=auth_headers(),
    )
    assert response.status_code == 422
    assert "tanda tangan digital" in response.json()["detail"]


def test_get_pdf_editor_pages_service():
    source = create_pdf(3)
    pages = get_pdf_editor_pages(source)
    assert len(pages) == 3
    assert pages[0]["page_number"] == 1
    assert pages[0]["original_index"] == 0
    assert pages[0]["width"] > 0
    assert pages[0]["height"] > 0
    assert pages[0]["thumbnail"].startswith("data:image/jpeg;base64,")
    assert pages[0]["preview"].startswith("data:image/jpeg;base64,")


def test_get_pdf_editor_pages_signed_rejected():
    import pytest

    signed = create_signed_pdf()
    with pytest.raises(ValueError, match="tanda tangan digital"):
        get_pdf_editor_pages(signed)


def test_apply_pdf_editor_changes_service():
    source = create_pdf(3)
    img_b64 = "data:image/png;base64," + base64.b64encode(create_png("red")).decode(
        "ascii"
    )

    manifest = {
        "pages": [
            {
                "source_index": 2,
                "rotation": 90,
                "text_overlays": [
                    {
                        "text": "Nomor Surat: 001/HRD",
                        "x_ratio": 0.1,
                        "y_ratio": 0.1,
                        "font_size": 14,
                        "color": "#1e40af",
                    }
                ],
                "image_overlays": [
                    {
                        "image_base64": img_b64,
                        "x_ratio": 0.5,
                        "y_ratio": 0.7,
                        "width_ratio": 0.3,
                        "height_ratio": 0.15,
                    }
                ],
            },
            {
                "source_index": 0,
                "rotation": 0,
                "text_overlays": [],
                "image_overlays": [],
            },
        ]
    }

    out_stream = apply_pdf_editor_changes(source, manifest)
    res_pdf = PdfReader(out_stream)
    assert len(res_pdf.pages) == 2
    # First page rotated 90
    assert res_pdf.pages[0].rotation == 90
    assert res_pdf.pages[1].rotation == 0


def test_apply_pdf_editor_changes_unified_overlays():
    source = create_pdf(2)
    img_b64 = "data:image/png;base64," + base64.b64encode(create_png("blue")).decode(
        "ascii"
    )

    manifest = {
        "pages": [
            {
                "source_index": 0,
                "rotation": 0,
                "overlays": [
                    {
                        "type": "image",
                        "image_base64": img_b64,
                        "x_ratio": 0.2,
                        "y_ratio": 0.2,
                        "width_ratio": 0.3,
                        "height_ratio": 0.15,
                    },
                    {
                        "type": "text",
                        "text": "Stempel Disetujui",
                        "x_ratio": 0.25,
                        "y_ratio": 0.25,
                        "font_size": 16,
                        "color": "#047857",
                    },
                ],
            }
        ]
    }

    out_stream = apply_pdf_editor_changes(source, manifest)
    res_pdf = PdfReader(out_stream)
    assert len(res_pdf.pages) == 1
    assert res_pdf.pages[0].rotation == 0


def test_editor_endpoints_require_auth():
    files = {"file": ("sample.pdf", create_pdf(1), "application/pdf")}
    res_pages = client.post("/api/pdf-tools/editor/pages", files=files)
    assert res_pages.status_code in (401, 403)

    files_apply = {"file": ("sample.pdf", create_pdf(1), "application/pdf")}
    res_apply = client.post(
        "/api/pdf-tools/editor/apply",
        files=files_apply,
        data={"manifest": json.dumps({"pages": []})},
    )
    assert res_apply.status_code in (401, 403)


def test_editor_pages_endpoint_success():
    files = {"file": ("dokumen_kantor.pdf", create_pdf(2), "application/pdf")}
    response = client.post(
        "/api/pdf-tools/editor/pages",
        files=files,
        headers=auth_headers(),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total_pages"] == 2
    assert len(data["pages"]) == 2
    assert data["pages"][0]["thumbnail"].startswith("data:image/jpeg;base64,")


def test_editor_apply_endpoint_success():
    files = {"file": ("laporan_resmi (v2).pdf", create_pdf(3), "application/pdf")}
    manifest = {
        "pages": [
            {"source_index": 1, "rotation": 180, "text_overlays": [], "image_overlays": []},
            {"source_index": 0, "rotation": 0, "text_overlays": [], "image_overlays": []},
        ]
    }
    response = client.post(
        "/api/pdf-tools/editor/apply",
        files=files,
        data={"manifest": json.dumps(manifest)},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "laporan_resmi__v2_edited.pdf" in response.headers["content-disposition"]

    res_pdf = PdfReader(io.BytesIO(response.content))
    assert len(res_pdf.pages) == 2
    assert res_pdf.pages[0].rotation == 180


def test_editor_apply_endpoint_invalid_manifest():
    files = {"file": ("sample.pdf", create_pdf(1), "application/pdf")}
    response = client.post(
        "/api/pdf-tools/editor/apply",
        files=files,
        data={"manifest": "not-a-json"},
        headers=auth_headers(),
    )
    assert response.status_code == 422


def test_editor_apply_endpoint_signed_output_mode():
    files = {"file": ("kontrak_kerja.pdf", create_pdf(1), "application/pdf")}
    manifest = {
        "pages": [
            {"source_index": 0, "rotation": 0, "text_overlays": [], "image_overlays": []},
        ]
    }
    response = client.post(
        "/api/pdf-tools/editor/apply",
        files=files,
        data={"manifest": json.dumps(manifest), "output_mode": "signed"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert "kontrak_kerja_signed.pdf" in response.headers["content-disposition"]


def test_editor_apply_endpoint_invalid_image_format():
    # GIF bukan JPEG atau PNG
    gif_b64 = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    files = {"file": ("surat.pdf", create_pdf(1), "application/pdf")}
    manifest = {
        "pages": [
            {
                "source_index": 0,
                "rotation": 0,
                "text_overlays": [],
                "image_overlays": [{"image_base64": gif_b64, "x_ratio": 0.5, "y_ratio": 0.5}],
            },
        ]
    }
    response = client.post(
        "/api/pdf-tools/editor/apply",
        files=files,
        data={"manifest": json.dumps(manifest)},
        headers=auth_headers(),
    )
    assert response.status_code == 422
    assert "PNG atau JPEG" in response.json()["detail"]


def test_validate_protect_password():
    import pytest

    # Valid
    validate_protect_password("KunciAman#2026")

    # Terlalu pendek (< 12)
    with pytest.raises(ValueError, match="minimal 12 karakter"):
        validate_protect_password("Short1!")

    # Terlalu panjang (> 40 byte)
    with pytest.raises(ValueError, match="maksimal 40 byte"):
        validate_protect_password("A" * 40 + "1!a")

    # Tanpa huruf besar
    with pytest.raises(ValueError, match="huruf besar"):
        validate_protect_password("kunciaman#2026")

    # Tanpa huruf kecil
    with pytest.raises(ValueError, match="huruf kecil"):
        validate_protect_password("KUNCIAMAN#2026")

    # Tanpa angka
    with pytest.raises(ValueError, match="angka"):
        validate_protect_password("KunciAman#Bagus")

    # Tanpa simbol
    with pytest.raises(ValueError, match="simbol"):
        validate_protect_password("KunciAman20267")


def test_protect_and_unlock_pdf_roundtrip():
    import pytest

    pdf_bytes = create_pdf(2)
    password = "KunciRahasia#2026"

    # Protect
    protected_stream = protect_pdf(pdf_bytes, password)
    protected_bytes = protected_stream.getvalue()

    doc_enc = pymupdf.open(stream=protected_bytes, filetype="pdf")
    assert doc_enc.is_encrypted or doc_enc.needs_pass
    assert doc_enc.authenticate(password) > 0
    assert doc_enc.page_count == 2
    doc_enc.close()

    # Protect sudah terenkripsi -> ditolak
    with pytest.raises(ValueError, match="sudah terenkripsi"):
        protect_pdf(protected_bytes, password)

    # Unlock password salah -> ditolak
    with pytest.raises(ValueError, match="Password salah"):
        unlock_pdf(protected_bytes, "SalahPassword#123")

    # Unlock password benar
    unlocked_stream = unlock_pdf(protected_bytes, password)
    unlocked_bytes = unlocked_stream.getvalue()

    doc_dec = pymupdf.open(stream=unlocked_bytes, filetype="pdf")
    assert not doc_dec.is_encrypted and not doc_dec.needs_pass
    assert doc_dec.page_count == 2
    doc_dec.close()

    # Unlock pada PDF tidak terenkripsi -> ditolak
    with pytest.raises(ValueError, match="tidak terenkripsi"):
        unlock_pdf(unlocked_bytes, password)


def test_protect_and_unlock_signed_rejected():
    import pytest

    signed_bytes = create_signed_pdf()
    password = "KunciAman#2026"

    with pytest.raises(ValueError, match="tanda tangan digital"):
        protect_pdf(signed_bytes, password)


def test_protect_and_unlock_endpoints():
    pdf_bytes = create_pdf(1)
    password = "KunciAman#2026"

    # Protect endpoint
    resp_protect = client.post(
        "/api/pdf-tools/protect",
        files={"file": ("dokumen_rahasia.pdf", pdf_bytes, "application/pdf")},
        data={"password": password},
        headers=auth_headers(),
    )
    assert resp_protect.status_code == 200
    assert "dokumen_rahasia_protected.pdf" in resp_protect.headers["content-disposition"]
    protected_bytes = resp_protect.content

    # Verifikasi berkas hasil endpoint benar-benar terenkripsi
    doc_p = pymupdf.open(stream=protected_bytes, filetype="pdf")
    assert doc_p.is_encrypted or doc_p.needs_pass
    doc_p.close()

    # Protect dengan password lemah -> 422
    resp_weak = client.post(
        "/api/pdf-tools/protect",
        files={"file": ("dokumen.pdf", pdf_bytes, "application/pdf")},
        data={"password": "lemah"},
        headers=auth_headers(),
    )
    assert resp_weak.status_code == 422
    assert "minimal 12 karakter" in resp_weak.json()["detail"]

    # Unlock endpoint dengan password salah -> 422
    resp_wrong = client.post(
        "/api/pdf-tools/unlock",
        files={"file": ("dokumen_protected.pdf", protected_bytes, "application/pdf")},
        data={"password": "Salah#Password9"},
        headers=auth_headers(),
    )
    assert resp_wrong.status_code == 422
    assert "Password salah" in resp_wrong.json()["detail"]

    # Unlock endpoint dengan password benar -> 200
    resp_unlock = client.post(
        "/api/pdf-tools/unlock",
        files={"file": ("dokumen_protected.pdf", protected_bytes, "application/pdf")},
        data={"password": password},
        headers=auth_headers(),
    )
    assert resp_unlock.status_code == 200
    assert "dokumen_protected_unlocked.pdf" in resp_unlock.headers["content-disposition"]

    # Verifikasi hasil unlock tidak terenkripsi
    doc_u = pymupdf.open(stream=resp_unlock.content, filetype="pdf")
    assert not doc_u.is_encrypted and not doc_u.needs_pass
    doc_u.close()


def test_repair_pdf_valid_and_corrupt():
    import pytest

    # PDF valid
    valid_pdf = create_pdf(3)
    out_valid, meta_valid = repair_pdf(valid_pdf)
    assert meta_valid["page_count"] == 3
    assert len(out_valid.getvalue()) > 0

    # PDF rusak (xref terpotong & trailer cacat)
    corrupt_bytes = valid_pdf[:-50] + b"garbage_broken_trailer_data_123456789"
    out_rep, meta_rep = repair_pdf(corrupt_bytes)
    assert meta_rep["page_count"] == 3
    doc_check = pymupdf.open(stream=out_rep.getvalue(), filetype="pdf")
    assert doc_check.page_count == 3
    doc_check.close()

    # Berkas kosong -> ValueError
    with pytest.raises(ValueError, match="kosong atau tidak valid"):
        repair_pdf(b"")

    # Berkas bukan PDF / rusak fatal tanpa stream yang bisa dibuka
    with pytest.raises(ValueError, match="rusak parah"):
        repair_pdf(b"Bukan berkas dokumen sama sekali.")

    # PDF terenkripsi -> ditolak dengan edukasi
    protected_stream = protect_pdf(create_pdf(1), "KunciAman#2026")
    with pytest.raises(ValueError, match="terenkripsi password"):
        repair_pdf(protected_stream.getvalue())


def test_repair_pdf_endpoint():
    valid_pdf = create_pdf(2)
    corrupt_bytes = valid_pdf[:-40] + b"corrupt_tail_data"

    response = client.post(
        "/api/pdf-tools/repair",
        files={"file": ("laporan_rusak.pdf", corrupt_bytes, "application/pdf")},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert "laporan_rusak_repaired.pdf" in response.headers["content-disposition"]
    assert response.headers.get("x-pages-recovered") == "2"

    doc_repaired = pymupdf.open(stream=response.content, filetype="pdf")
    assert doc_repaired.page_count == 2
    doc_repaired.close()


def test_ocr_status_and_pdf_ocr(monkeypatch):
    import pytest

    # Test status saat ini (host belum ada tesseract)
    status = get_tesseract_status()
    assert isinstance(status, dict)
    assert "available" in status

    # Endpoint GET /api/pdf-tools/ocr/status
    res_status = client.get("/api/pdf-tools/ocr/status")
    assert res_status.status_code == 200
    data = res_status.json()
    assert "available" in data

    # Test ocr_pdf saat Tesseract tidak ada -> ValueError
    monkeypatch.setattr(
        "app.services.pdf_tools.get_tesseract_status",
        lambda: {"available": False, "tessdata": None, "languages": [], "message": "Not found"},
    )
    with pytest.raises(ValueError, match="Tesseract OCR tidak ditemukan"):
        ocr_pdf(create_pdf(1), "eng")

    # Endpoint POST /api/pdf-tools/ocr saat Tesseract tidak ada -> 422
    res_no_tess = client.post(
        "/api/pdf-tools/ocr",
        files={"file": ("scan.pdf", create_pdf(1), "application/pdf")},
        data={"language": "eng"},
        headers=auth_headers(),
    )
    assert res_no_tess.status_code == 422
    assert "Tesseract OCR tidak ditemukan" in res_no_tess.json()["detail"]

    # Test ocr_pdf saat Tesseract disimulasikan ada
    fake_status = {
        "available": True,
        "tessdata": "/fake/tessdata",
        "languages": ["eng", "ind"],
        "message": "OK",
    }
    monkeypatch.setattr("app.services.pdf_tools.get_tesseract_status", lambda: fake_status)
    # Mock pix.pdfocr_tobytes to return a valid 1-page PDF
    fake_ocr_page = create_pdf(1)
    monkeypatch.setattr(
        pymupdf.Pixmap,
        "pdfocr_tobytes",
        lambda self, compress=True, language="eng", tessdata=None: fake_ocr_page,
    )

    out_ocr, meta_ocr = ocr_pdf(create_pdf(1), "eng")
    assert meta_ocr["page_count"] == 1
    doc_ocr = pymupdf.open(stream=out_ocr.getvalue(), filetype="pdf")
    assert doc_ocr.page_count == 1
    doc_ocr.close()

    # Endpoint POST /api/pdf-tools/ocr saat sukses
    res_ocr_ok = client.post(
        "/api/pdf-tools/ocr",
        files={"file": ("scan_dokumen.pdf", create_pdf(1), "application/pdf")},
        data={"language": "ind+eng"},
        headers=auth_headers(),
    )
    assert res_ocr_ok.status_code == 200
    assert "scan_dokumen_searchable.pdf" in res_ocr_ok.headers["content-disposition"]
    assert res_ocr_ok.headers.get("x-ocr-pages") == "1"


def test_watermark_pdf_text_and_image():
    import pytest

    pdf_bytes = create_pdf(3)

    # 1. Text watermark center
    out_wm, meta_wm = watermark_pdf(
        file_bytes=pdf_bytes,
        mode="text",
        text="RAHASIA",
        opacity=0.35,
        rotation=45.0,
        position="center",
        fontsize=40,
        color_hex="#e11d48",
        pages_str="all",
    )
    assert meta_wm["pages_watermarked"] == 3
    doc_wm = pymupdf.open(stream=out_wm.getvalue(), filetype="pdf")
    assert doc_wm.page_count == 3
    doc_wm.close()

    # 2. Text watermark mosaic on specific page
    out_mosaic, meta_mosaic = watermark_pdf(
        file_bytes=pdf_bytes,
        mode="text",
        text="DRAFT",
        position="mosaic",
        pages_str="1-2",
    )
    assert meta_mosaic["pages_watermarked"] == 2

    # 3. Image watermark
    png_bytes = create_png("red")
    out_img, meta_img = watermark_pdf(
        file_bytes=pdf_bytes,
        mode="image",
        image_bytes=png_bytes,
        opacity=0.4,
        position="bottom-right",
    )
    assert meta_img["pages_watermarked"] == 3

    # 4. Image watermark without image -> ValueError
    with pytest.raises(ValueError, match="wajib diunggah"):
        watermark_pdf(file_bytes=pdf_bytes, mode="image", image_bytes=None)

    # 5. Protected PDF -> ValueError
    protected_pdf = protect_pdf(create_pdf(1), "KunciAman#2026").getvalue()
    with pytest.raises(ValueError, match="terenkripsi password"):
        watermark_pdf(file_bytes=protected_pdf, text="DRAFT")


def test_page_numbers_pdf():
    import pytest

    pdf_bytes = create_pdf(4)

    # 1. Default numbering bottom-center
    out_num, meta_num = add_page_numbers_pdf(
        file_bytes=pdf_bytes,
        format_pattern="{n} / {total}",
        position="bottom-center",
        margin=25,
        start_page=1,
        start_number=1,
    )
    assert meta_num["pages_numbered"] == 4

    # 2. Skip cover (start_page = 2, start_number = 1)
    out_skip, meta_skip = add_page_numbers_pdf(
        file_bytes=pdf_bytes,
        format_pattern="Halaman {n} dari {total}",
        position="bottom-right",
        start_page=2,
        start_number=1,
    )
    assert meta_skip["pages_numbered"] == 3

    # 3. Protected PDF -> ValueError
    protected_pdf = protect_pdf(create_pdf(1), "KunciAman#2026").getvalue()
    with pytest.raises(ValueError, match="terenkripsi password"):
        add_page_numbers_pdf(file_bytes=protected_pdf)


def test_watermark_and_page_numbers_endpoints():
    pdf_bytes = create_pdf(2)

    # POST /api/pdf-tools/watermark
    res_wm = client.post(
        "/api/pdf-tools/watermark",
        files={"file": ("laporan_tahunan.pdf", pdf_bytes, "application/pdf")},
        data={
            "mode": "text",
            "text": "CONFIDENTIAL",
            "opacity": "0.3",
            "rotation": "45",
            "position": "center",
            "color": "#dc2626",
            "pages": "all",
        },
        headers=auth_headers(),
    )
    assert res_wm.status_code == 200
    assert "laporan_tahunan_watermarked.pdf" in res_wm.headers["content-disposition"]
    assert res_wm.headers.get("x-watermarked-pages") == "2"

    # POST /api/pdf-tools/page-numbers
    res_pn = client.post(
        "/api/pdf-tools/page-numbers",
        files={"file": ("skripsi_final.pdf", pdf_bytes, "application/pdf")},
        data={
            "format": "Halaman {n} dari {total}",
            "position": "bottom-center",
            "margin": "30",
            "start_page": "1",
            "start_number": "1",
            "fontsize": "10",
            "color": "#000000",
            "pages": "all",
        },
        headers=auth_headers(),
    )
    assert res_pn.status_code == 200
    assert "skripsi_final_numbered.pdf" in res_pn.headers["content-disposition"]
    assert res_pn.headers.get("x-numbered-pages") == "2"


def test_pdf_to_markdown_service_and_endpoint():
    import pytest

    # Buat PDF dengan PyMuPDF yang memuat teks dan list
    doc = pymupdf.open()
    p1 = doc.new_page(width=595, height=842)
    p1.insert_text(pymupdf.Point(50, 50), "Dokumen Penawaran Proyek", fontsize=20)
    p1.insert_text(pymupdf.Point(50, 90), "Ringkasan eksekutif untuk klien.", fontsize=12)
    p2 = doc.new_page(width=595, height=842)
    p2.insert_text(pymupdf.Point(50, 50), "Rincian Biaya dan Timeline", fontsize=18)
    p2.insert_text(pymupdf.Point(50, 90), "- Fase 1: Perencanaan", fontsize=12)
    p2.insert_text(pymupdf.Point(50, 110), "- Fase 2: Eksekusi", fontsize=12)

    buf = io.BytesIO()
    doc.save(buf)
    pdf_sample = buf.getvalue()
    doc.close()

    # 1. Konversi seluruh halaman
    md_text, meta = pdf_to_markdown(pdf_sample, "all")
    assert meta["total_pages"] == 2
    assert meta["converted_pages"] == 2
    assert "Dokumen Penawaran Proyek" in md_text
    assert "Rincian Biaya dan Timeline" in md_text

    # 2. Konversi hanya halaman 2
    md_p2, meta_p2 = pdf_to_markdown(pdf_sample, "2")
    assert meta_p2["total_pages"] == 2
    assert meta_p2["converted_pages"] == 1
    assert "Dokumen Penawaran Proyek" not in md_p2
    assert "Rincian Biaya dan Timeline" in md_p2

    # 3. PDF terenkripsi password -> ValueError
    protected_pdf = protect_pdf(create_pdf(1), "PasswordAman#123").getvalue()
    with pytest.raises(ValueError, match="terenkripsi password"):
        pdf_to_markdown(protected_pdf)

    # 4. Uji Endpoint POST /api/pdf-tools/pdf-to-markdown
    res_api = client.post(
        "/api/pdf-tools/pdf-to-markdown",
        files={"file": ("penawaran_proyek.pdf", pdf_sample, "application/pdf")},
        data={"pages": "all"},
        headers=auth_headers(),
    )
    assert res_api.status_code == 200
    assert "penawaran_proyek.md" in res_api.headers["content-disposition"]
    assert res_api.headers.get("x-total-pages") == "2"
    assert res_api.headers.get("x-converted-pages") == "2"
    assert "Dokumen Penawaran Proyek" in res_api.text





