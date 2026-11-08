from __future__ import annotations

import shutil
from pathlib import Path
from unittest.mock import patch

import pytest

from app.core.disk_guard import (
    DiskSpaceExhaustedError,
    DiskSpaceInfo,
    check_disk_guard,
    get_disk_space_info,
)


def test_get_disk_space_info_returns_valid_live_data(tmp_path: Path):
    info = get_disk_space_info(tmp_path)
    assert isinstance(info, DiskSpaceInfo)
    assert info.total_bytes > 0
    assert info.free_bytes >= 0
    assert 0.0 <= info.used_percent <= 100.0
    assert info.status in ("healthy", "warning", "critical")

    data = info.to_dict()
    assert "total_mb" in data
    assert "used_mb" in data
    assert "free_mb" in data
    assert data["status"] == info.status


def test_disk_guard_status_classification(tmp_path: Path):
    total = 100 * 1024 * 1024 * 1024  # 100 GB

    # 1. Healthy (< 70%)
    usage_healthy = shutil._ntuple_diskusage(
        total, 60 * 1024 * 1024 * 1024, 40 * 1024 * 1024 * 1024
    )
    with patch("shutil.disk_usage", return_value=usage_healthy):
        info = get_disk_space_info(tmp_path)
        assert info.used_percent == 60.0
        assert info.status == "healthy"
        checked = check_disk_guard(tmp_path)
        assert checked.status == "healthy"

    # 2. Warning (70% - 79.9%)
    usage_warning = shutil._ntuple_diskusage(
        total, 75 * 1024 * 1024 * 1024, 25 * 1024 * 1024 * 1024
    )
    with patch("shutil.disk_usage", return_value=usage_warning):
        info = get_disk_space_info(tmp_path)
        assert info.used_percent == 75.0
        assert info.status == "warning"
        checked = check_disk_guard(tmp_path)
        assert checked.status == "warning"

    # 3. Critical (>= 80%) - Fail-Closed
    usage_critical = shutil._ntuple_diskusage(
        total, 80 * 1024 * 1024 * 1024, 20 * 1024 * 1024 * 1024
    )
    with patch("shutil.disk_usage", return_value=usage_critical):
        info = get_disk_space_info(tmp_path)
        assert info.used_percent == 80.0
        assert info.status == "critical"
        with pytest.raises(DiskSpaceExhaustedError, match="Penyimpanan server hampir penuh"):
            check_disk_guard(tmp_path)


def test_get_disk_space_info_handles_os_error_gracefully(tmp_path: Path):
    with patch("shutil.disk_usage", side_effect=OSError("Disk hardware fault")):
        info = get_disk_space_info(tmp_path)
        assert info.total_bytes == 1
        assert info.used_bytes == 0
        assert info.status == "healthy"


def test_app_exception_handler_returns_http_507_on_disk_exhaustion():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    mock_err = DiskSpaceExhaustedError("Disk 85% full")
    with patch("app.services.job_manager.check_disk_guard", side_effect=mock_err):
        with (
            patch("app.core.security.session_manager.verify_session", return_value=True),
            patch("app.core.security.session_manager.verify_csrf", return_value=True),
        ):
            response = client.post(
                "/api/converter/docx-to-pdf",
                files={"file": ("test.docx", b"PK\x03\x04dummy", "application/octet-stream")},
                cookies={"docbuilder_session": "valid_session"},
                headers={"X-CSRF-Token": "valid_csrf", "Origin": "http://127.0.0.1:8000"},
            )
            assert response.status_code == 507
            data = response.json()
            assert data["success"] is False
            assert "Disk 85% full" in data["error"]
            assert data["code"] == "DISK_SPACE_EXHAUSTED"
