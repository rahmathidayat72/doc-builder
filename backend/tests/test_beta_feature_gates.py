from __future__ import annotations

import io
import sys
from pathlib import Path

import pymupdf
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import Settings, settings
from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.main import app

client = TestClient(app)


def _create_sample_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Satukit Beta Gate Test")
    out = doc.tobytes()
    doc.close()
    return out


def _auth_headers() -> dict[str, str]:
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    return {
        CSRF_HEADER_NAME: session_manager.csrf_token,
        "Origin": "http://localhost:5173",
    }


def test_beta_coming_soon_gate_enabled_by_default() -> None:
    assert settings.BETA_COMING_SOON_GATES_ENABLED is True
    assert Settings().BETA_COMING_SOON_GATES_ENABLED is True


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/media-downloads"),
        ("GET", "/api/media-downloads/job-123"),
        ("DELETE", "/api/media-downloads/job-123"),
        ("GET", "/api/media-downloads/job-123/file"),
        ("POST", "/api/video-compressions"),
        ("GET", "/api/video-compressions/job-123"),
        ("GET", "/api/video-compressions/job-123/download"),
        ("DELETE", "/api/video-compressions/job-123"),
        ("POST", "/api/pdf-tools/editor/pages"),
        ("POST", "/api/pdf-tools/editor/apply"),
        ("POST", "/api/pdf-tools/repair"),
        ("GET", "/api/pdf-tools/ocr/status"),
        ("POST", "/api/pdf-tools/ocr"),
    ],
)
def test_gated_endpoints_reject_unauthenticated_and_authenticated_requests_with_503(
    method: str, path: str
) -> None:
    client.cookies.clear()
    res_unauth = client.request(method, path)
    assert res_unauth.status_code == 503
    body_unauth = res_unauth.json()
    assert body_unauth["success"] is False
    assert body_unauth["error_code"] == "FEATURE_COMING_SOON"

    headers = _auth_headers()
    res_auth = client.request(method, path, headers=headers)
    assert res_auth.status_code == 503
    body_auth = res_auth.json()
    assert body_auth["success"] is False
    assert body_auth["error_code"] == "FEATURE_COMING_SOON"


def test_gated_endpoint_still_rejects_untrusted_origin_with_403() -> None:
    res = client.post(
        "/api/media-downloads",
        headers={"Origin": "https://evil.invalid"},
    )
    assert res.status_code == 403


def test_active_sibling_endpoints_Remain_accessible() -> None:
    client.cookies.clear()
    # /api/image-tools/remove-background tetap aktif untuk Hapus Latar Belakang
    res_bg = client.post("/api/image-tools/remove-background")
    assert res_bg.status_code == 401
    assert res_bg.json().get("error_code") != "FEATURE_COMING_SOON"

    # /api/pdf-tools/compress tetap aktif dan memproses PDF valid
    headers = _auth_headers()
    pdf_bytes = _create_sample_pdf()
    res_compress = client.post(
        "/api/pdf-tools/compress",
        files={"file": ("aktif.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"compression_level": "recommended"},
        headers=headers,
    )
    assert res_compress.status_code == 200
    assert res_compress.headers["content-type"] == "application/pdf"
