import os
import signal
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.sandbox import (
    SandboxConfig,
    WindowsJobObject,
    get_sanitized_env,
    run_sandboxed_subprocess,
)


def test_sanitized_env_blocks_secrets_and_proxies():
    with patch.dict(os.environ, {"DATABASE_URL": "postgres://secret", "SECRET_KEY": "mysecret"}):
        clean = get_sanitized_env(allow_network=False)
        assert "DATABASE_URL" not in clean
        assert "SECRET_KEY" not in clean
        assert clean["PYTHONNOUSERSITE"] == "1"
        assert clean["HTTP_PROXY"] == "http://127.0.0.1:0"
        assert clean["DOCBUILDER_SANDBOX_NETWORK_BLOCKED"] == "1"


def test_run_sandboxed_subprocess_success(tmp_path):
    cmd = [sys.executable, "-c", "print('sandbox_ok')"]
    cfg = SandboxConfig(working_dir=tmp_path, timeout_sec=10.0, max_memory_mb=256)
    res = run_sandboxed_subprocess(cmd, cfg)

    assert res.exit_code == 0
    assert "sandbox_ok" in res.stdout
    assert res.timed_out is False
    assert res.error_message is None


def test_run_sandboxed_subprocess_timeout(tmp_path):
    cmd = [sys.executable, "-c", "import time; time.sleep(5)"]
    cfg = SandboxConfig(working_dir=tmp_path, timeout_sec=0.2, max_memory_mb=256)
    res = run_sandboxed_subprocess(cmd, cfg)

    assert res.timed_out is True
    assert res.exit_code == -9
    assert "melampaui batas waktu" in (res.error_message or "")


@pytest.mark.skipif(sys.platform != "win32", reason="Win32 Job Object hanya aktif di Windows")
def test_windows_job_object_lifecycle():
    job = WindowsJobObject(max_memory_mb=128)
    assert job.handle is not None
    job.close()
    assert job.handle is None


@pytest.mark.skipif(sys.platform != "win32", reason="Win32 Job Object hanya aktif di Windows")
def test_windows_job_object_fail_closed_on_assign_failure(tmp_path):
    cmd = [sys.executable, "-c", "print('fail_closed_test')"]
    cfg = SandboxConfig(working_dir=tmp_path, timeout_sec=5.0)

    with patch.object(WindowsJobObject, "assign_process", return_value=False):
        res = run_sandboxed_subprocess(cmd, cfg)
        assert res.exit_code != 0
        assert "fail-closed" in (res.error_message or "").lower()


def test_posix_timeout_triggers_process_group_kill(tmp_path):
    mock_proc = MagicMock()
    mock_proc.pid = 99999
    mock_proc.communicate.side_effect = [
        subprocess.TimeoutExpired(cmd=["mock"], timeout=0.1),
        ("out", "err"),
    ]

    with (
        patch("sys.platform", "linux"),
        patch("subprocess.Popen", return_value=mock_proc) as mock_popen,
        patch("os.getpgid", return_value=99999, create=True),
        patch("os.killpg", create=True) as mock_killpg,
    ):
        cfg = SandboxConfig(working_dir=tmp_path, timeout_sec=0.1)
        res = run_sandboxed_subprocess(["dummy"], cfg)

        assert res.timed_out is True
        assert res.exit_code == -9
        mock_killpg.assert_called_with(99999, signal.SIGTERM)
        _, kwargs = mock_popen.call_args
        assert kwargs.get("start_new_session") is True
