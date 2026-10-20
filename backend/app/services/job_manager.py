import shutil
import threading
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]


class JobBusyError(RuntimeError):
    """Dilempar ketika sudah ada satu job konversi aktif."""


@dataclass
class ConversionJob:
    id: str
    operation: str
    status: JobStatus
    created_at: float
    updated_at: float
    workspace: Path
    error: str | None = None

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["workspace"] = str(self.workspace)
        return data


class ConversionJobManager:
    """Manajer atomik untuk maksimal satu job konversi aktif."""

    def __init__(self, workspace_root: Path, ttl_seconds: int = 300):
        self.workspace_root = workspace_root
        self.ttl_seconds = ttl_seconds
        self.workspace_root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._state_lock = threading.RLock()
        self._jobs: dict[str, ConversionJob] = {}
        self._active_job_id: str | None = None
        self.sweep_expired_workspaces()

    def create_job(self, operation: str) -> ConversionJob:
        if not self._lock.acquire(blocking=False):
            raise JobBusyError("Satu job konversi lain sedang berjalan. Coba lagi setelah selesai.")

        now = time.time()
        job_id = str(uuid.uuid4())
        workspace = self.workspace_root / job_id
        workspace.mkdir(parents=True, exist_ok=False)
        job = ConversionJob(
            id=job_id,
            operation=operation,
            status="queued",
            created_at=now,
            updated_at=now,
            workspace=workspace,
        )
        with self._state_lock:
            self._jobs[job_id] = job
            self._active_job_id = job_id
        return job

    def update_status(
        self, job_id: str, status: JobStatus, error: str | None = None
    ) -> ConversionJob:
        with self._state_lock:
            job = self._jobs[job_id]
            job.status = status
            job.updated_at = time.time()
            job.error = error
            return job

    def get_job(self, job_id: str) -> ConversionJob | None:
        with self._state_lock:
            return self._jobs.get(job_id)

    def get_active_job(self) -> ConversionJob | None:
        with self._state_lock:
            if self._active_job_id is None:
                return None
            return self._jobs.get(self._active_job_id)

    def finish_job(self, job_id: str) -> None:
        with self._state_lock:
            job = self._jobs.get(job_id)
            if job:
                shutil.rmtree(job.workspace, ignore_errors=True)
            if self._active_job_id == job_id:
                self._active_job_id = None
        if self._lock.locked():
            self._lock.release()

    @contextmanager
    def run_job(self, operation: str) -> Iterator[ConversionJob]:
        job = self.create_job(operation)
        self.update_status(job.id, "running")
        try:
            yield job
        except GeneratorExit:
            self.update_status(job.id, "cancelled")
            raise
        except Exception as exc:
            self.update_status(job.id, "failed", str(exc))
            raise
        else:
            self.update_status(job.id, "succeeded")
        finally:
            self.finish_job(job.id)

    def sweep_expired_workspaces(self, now: float | None = None) -> list[Path]:
        current_time = now if now is not None else time.time()
        removed: list[Path] = []
        if not self.workspace_root.exists():
            return removed

        for path in self.workspace_root.iterdir():
            if not path.is_dir():
                continue
            age = current_time - path.stat().st_mtime
            if age >= self.ttl_seconds:
                shutil.rmtree(path, ignore_errors=True)
                removed.append(path)
        return removed
