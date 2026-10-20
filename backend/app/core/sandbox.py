import ctypes
import os
import subprocess
import sys
import time
from ctypes import wintypes
from dataclasses import dataclass
from pathlib import Path


@dataclass
class SandboxConfig:
    working_dir: Path
    timeout_sec: float = 30.0
    max_memory_mb: int = 500
    allow_network: bool = False


@dataclass
class ExecutionResult:
    command: list[str]
    exit_code: int
    stdout: str
    stderr: str
    duration_sec: float
    timed_out: bool = False
    network_blocked: bool = False
    error_message: str | None = None


# Structures ctypes Win32 Job Object pada level modul
class IO_COUNTERS(ctypes.Structure):
    _fields_ = [
        ("ReadOperationCount", ctypes.c_uint64),
        ("WriteOperationCount", ctypes.c_uint64),
        ("OtherOperationCount", ctypes.c_uint64),
        ("ReadTransferCount", ctypes.c_uint64),
        ("WriteTransferCount", ctypes.c_uint64),
        ("OtherTransferCount", ctypes.c_uint64),
    ]


class JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", wintypes.LARGE_INTEGER),
        ("PerJobUserTimeLimit", wintypes.LARGE_INTEGER),
        ("LimitFlags", wintypes.DWORD),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", wintypes.DWORD),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", wintypes.DWORD),
        ("SchedulingClass", wintypes.DWORD),
    ]


class JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", JOBOBJECT_BASIC_LIMIT_INFORMATION),
        ("IoInfo", IO_COUNTERS),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryLimit", ctypes.c_size_t),
        ("PeakJobMemoryLimit", ctypes.c_size_t),
    ]


class WindowsJobObject:
    """Helper ctypes untuk Windows Job Objects."""

    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000
    JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x00000100
    JOB_OBJECT_LIMIT_JOB_MEMORY = 0x00000200
    JobObjectExtendedLimitInformation = 9

    def __init__(self, max_memory_mb: int = 500):
        self.handle = None
        if sys.platform == "win32":
            kernel32 = ctypes.windll.kernel32
            self.handle = kernel32.CreateJobObjectW(None, None)
            if self.handle:
                info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
                info.BasicLimitInformation.LimitFlags = (
                    self.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                    | self.JOB_OBJECT_LIMIT_PROCESS_MEMORY
                    | self.JOB_OBJECT_LIMIT_JOB_MEMORY
                )
                limit_bytes = max_memory_mb * 1024 * 1024
                info.ProcessMemoryLimit = limit_bytes
                info.JobMemoryLimit = limit_bytes

                kernel32.SetInformationJobObject(
                    self.handle,
                    self.JobObjectExtendedLimitInformation,
                    ctypes.byref(info),
                    ctypes.sizeof(info),
                )

    def assign_process(self, process_handle) -> bool:
        if sys.platform == "win32" and self.handle:
            kernel32 = ctypes.windll.kernel32
            return bool(kernel32.AssignProcessToJobObject(self.handle, process_handle))
        return False

    def close(self):
        if sys.platform == "win32" and self.handle:
            ctypes.windll.kernel32.CloseHandle(self.handle)
            self.handle = None


def get_sanitized_env(allow_network: bool = False) -> dict[str, str]:
    clean_env = os.environ.copy()
    sensitive_keys = [
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "DATABASE_URL",
        "SECRET_KEY",
        "API_KEY",
        "TOKEN",
        "GITHUB_TOKEN",
        "PASSWORD",
    ]
    for k in sensitive_keys:
        clean_env.pop(k, None)

    clean_env["PYTHONNOUSERSITE"] = "1"
    clean_env["PYTHONDONTWRITEBYTECODE"] = "1"

    if not allow_network:
        clean_env["HTTP_PROXY"] = "http://127.0.0.1:0"
        clean_env["HTTPS_PROXY"] = "http://127.0.0.1:0"
        clean_env["ALL_PROXY"] = "http://127.0.0.1:0"
        clean_env["NO_PROXY"] = ""
        clean_env["DOCBUILDER_SANDBOX_NETWORK_BLOCKED"] = "1"

    return clean_env


def run_sandboxed_subprocess(cmd: list[str], config: SandboxConfig) -> ExecutionResult:
    config.working_dir.mkdir(parents=True, exist_ok=True)
    env = get_sanitized_env(config.allow_network)

    job = None
    if sys.platform == "win32":
        job = WindowsJobObject(max_memory_mb=config.max_memory_mb)

    start_time = time.perf_counter()
    timed_out = False
    stdout_data = ""
    stderr_data = ""
    exit_code = -1
    error_msg = None

    creation_flags = 0
    if sys.platform == "win32":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(config.working_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            creationflags=creation_flags,
        )

        if job and sys.platform == "win32":
            job.assign_process(proc._handle)

        try:
            stdout_data, stderr_data = proc.communicate(timeout=config.timeout_sec)
            exit_code = proc.returncode
        except subprocess.TimeoutExpired:
            timed_out = True
            proc.kill()
            stdout_data, stderr_data = proc.communicate()
            exit_code = -9
            error_msg = f"Proses melampaui batas waktu ({config.timeout_sec}s)."

    except Exception as e:
        error_msg = str(e)
    finally:
        if job:
            job.close()

    duration = time.perf_counter() - start_time
    network_blocked = (
        "DOCBUILDER_NETWORK_BLOCKED" in stderr_data
        or "Network access blocked" in stderr_data
        or "Connection refused" in stderr_data
        or "Failed to connect" in stderr_data
    )

    return ExecutionResult(
        command=cmd,
        exit_code=exit_code,
        stdout=stdout_data,
        stderr=stderr_data,
        duration_sec=round(duration, 3),
        timed_out=timed_out,
        network_blocked=network_blocked,
        error_message=error_msg,
    )
