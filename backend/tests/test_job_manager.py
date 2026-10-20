import os
import time
from pathlib import Path

import pytest

from app.services.job_manager import ConversionJobManager, JobBusyError


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
