"""
Bubblewrap Sandbox Process Isolation Runner for Satukit File Shelf
Task: FS-05 (Phase File Shelf)
Enforces --unshare-net, memory limits (RLIMIT_AS=512MiB), and 30s timeout on parser executions.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time

TIMEOUT_SECONDS = 30.0
MEMORY_LIMIT_BYTES = 512 * 1024 * 1024  # 512 MiB


class SandboxError(Exception):
    """Base exception for sandbox execution."""
    pass


class SandboxTimeoutError(SandboxError):
    pass


class SandboxMemoryError(SandboxError):
    pass


class BubblewrapSandbox:
    """Manages process containment using bubblewrap on Linux, with OS subprocess fallback."""

    def __init__(self) -> None:
        self.bwrap_bin = shutil.which("bwrap")
        self.is_linux = sys.platform.startswith("linux")

    def _get_rlimit_fn(self, memory_limit: int):
        try:
            import resource

            def set_limits():
                resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))
                resource.setrlimit(resource.RLIMIT_CORE, (0, 0))

            return set_limits
        except ImportError:
            return None

    def run_isolated_script(
        self,
        python_code: str,
        timeout: float = TIMEOUT_SECONDS,
        memory_limit_bytes: int = MEMORY_LIMIT_BYTES,
    ) -> tuple[int, str, str, float]:
        """
        Executes a Python script in an isolated namespace.
        Returns: (exit_code, stdout, stderr, elapsed_seconds)
        """
        start = time.perf_counter()

        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(python_code)
            script_path = f.name

        try:
            if self.is_linux and self.bwrap_bin:
                cmd = [
                    self.bwrap_bin,
                    "--ro-bind", "/", "/",
                    "--dev", "/dev",
                    "--proc", "/proc",
                    "--tmpfs", "/tmp",
                    "--unshare-net",
                    "--unshare-ipc",
                    "--unshare-pid",
                    "--die-with-parent",
                    sys.executable,
                    script_path,
                ]
                preexec_fn = self._get_rlimit_fn(memory_limit_bytes)
            else:
                cmd = [sys.executable, script_path]
                preexec_fn = None

            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                preexec_fn=preexec_fn,
            )

            try:
                stdout, stderr = proc.communicate(timeout=timeout)
                elapsed = time.perf_counter() - start
                return proc.returncode, stdout, stderr, elapsed
            except subprocess.TimeoutExpired as e:
                proc.kill()
                proc.communicate()
                raise SandboxTimeoutError(
                    f"Eksekusi parser melebihi batas waktu maksimal ({timeout}s)."
                ) from e

        finally:
            if os.path.exists(script_path):
                try:
                    os.unlink(script_path)
                except OSError:
                    pass


_GLOBAL_SANDBOX: BubblewrapSandbox | None = None


def get_sandbox() -> BubblewrapSandbox:
    global _GLOBAL_SANDBOX
    if _GLOBAL_SANDBOX is None:
        _GLOBAL_SANDBOX = BubblewrapSandbox()
    return _GLOBAL_SANDBOX
