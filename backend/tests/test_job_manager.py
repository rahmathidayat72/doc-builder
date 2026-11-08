from __future__ import annotations

import os
import stat
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from app.core.disk_guard import DiskSpaceExhaustedError
from app.services.job_manager import (
    BackgroundSweeper,
    ConversionJobManager,
    JobBusyError,
)


def test_job_manager_allows_only_one_active_job(tmp_path: Path):
    manager = ConversionJobManager(tmp_path / "jobs")
    first_job = manager.create_job("docx-to-pdf")

    with pytest.raises(JobBusyError, match="Satu job konversi lain sedang berjalan"):
        manager.create_job("pdf-to-docx")

    manager.finish_job(first_job.id)
    second_job = manager.create_job("pdf-to-docx")
    assert second_job.operation == "pdf-to-docx"
    manager.finish_job(second_job.id)


def test_run_job_updates_status_and_cleans_workspace(tmp_path: Path):
    manager = ConversionJobManager(tmp_path / "jobs")

    with manager.run_job("docx-to-pdf") as job:
        assert job.status == "running"
        assert job.workspace.exists()
        (job.workspace / "temporary.bin").write_bytes(b"temporary")
        job_id = job.id
        workspace = job.workspace

    completed = manager.get_job(job_id)
    assert completed is not None
    assert completed.status == "succeeded"
    assert not workspace.exists()
    assert manager.get_active_job() is None


def test_run_job_marks_failure_and_releases_lock(tmp_path: Path):
    manager = ConversionJobManager(tmp_path / "jobs")

    with pytest.raises(RuntimeError, match="conversion failed"):
        with manager.run_job("docx-to-pdf") as job:
            job_id = job.id
            raise RuntimeError("conversion failed")

    failed = manager.get_job(job_id)
    assert failed is not None
    assert failed.status == "failed"
    assert failed.error == "conversion failed"

    follow_up = manager.create_job("pdf-to-docx")
    manager.finish_job(follow_up.id)


def test_sweep_expired_workspaces_removes_only_expired_directories(tmp_path: Path):
    root = tmp_path / "jobs"
    manager = ConversionJobManager(root, ttl_seconds=300)
    expired = root / "expired-job"
    fresh = root / "fresh-job"
    expired.mkdir()
    fresh.mkdir()

    current_time = time.time()
    old_time = current_time - 301
    os.utime(expired, (old_time, old_time))

    removed = manager.sweep_expired_workspaces(now=current_time)

    assert expired in removed
    assert not expired.exists()
    assert fresh.exists()


def test_job_state_is_serializable(tmp_path: Path):
    manager = ConversionJobManager(tmp_path / "jobs")
    job = manager.create_job("docx-to-pdf")
    payload = job.to_dict()

    assert payload["id"] == job.id
    assert payload["status"] == "queued"
    assert isinstance(payload["workspace"], str)
    manager.finish_job(job.id)


def test_workspace_has_secure_0700_permissions(tmp_path: Path):
    root = tmp_path / "jobs_secure"
    manager = ConversionJobManager(root, ttl_seconds=3600)
    job = manager.create_job("test-perm")

    if os.name == "posix":
        root_mode = stat.S_IMODE(root.stat().st_mode)
        assert root_mode == 0o700, f"Expected 0o700, got {oct(root_mode)}"

        job_mode = stat.S_IMODE(job.workspace.stat().st_mode)
        assert job_mode == 0o700, f"Expected 0o700, got {oct(job_mode)}"

    manager.finish_job(job.id)


def test_create_job_aborts_and_releases_lock_when_disk_critical(tmp_path: Path):
    root = tmp_path / "jobs_disk"
    manager = ConversionJobManager(root)
    mock_err = DiskSpaceExhaustedError("Disk 82% full")

    with patch("app.services.job_manager.check_disk_guard", side_effect=mock_err):
        with pytest.raises(DiskSpaceExhaustedError, match="Disk 82% full"):
            manager.create_job("docx-to-pdf")

        # Pastikan lock tidak tertinggal dalam kondisi locked
        assert not manager._lock.locked()
        assert manager.get_active_job() is None

    # Verifikasi bahwa setelah kondisi disk pulih, job berikutnya dapat dibuat normal
    success_job = manager.create_job("docx-to-pdf")
    assert success_job.status == "queued"
    manager.finish_job(success_job.id)


def test_background_sweeper_lifecycle_and_periodic_cleanup(tmp_path: Path):
    root = tmp_path / "jobs_sweeper"
    manager = ConversionJobManager(root, ttl_seconds=10)
    expired = root / "sweeper-expired"
    expired.mkdir(parents=True, exist_ok=True)

    old_time = time.time() - 20
    os.utime(expired, (old_time, old_time))
    assert expired.exists()

    sweeper = BackgroundSweeper(manager, interval_seconds=0.1)
    assert not sweeper.is_running

    sweeper.start()
    assert sweeper.is_running
    # Idempotent start
    sweeper.start()

    # Tunggu sebentar hingga sweeper menjalankan iterasi
    deadline = time.time() + 2.0
    while expired.exists() and time.time() < deadline:
        time.sleep(0.05)

    assert not expired.exists(), "Expired workspace was not cleaned by background sweeper"

    sweeper.stop()
    assert not sweeper.is_running
    # Idempotent stop
    sweeper.stop()
