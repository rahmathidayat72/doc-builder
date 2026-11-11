from __future__ import annotations

import threading

from app.core.config import settings
from app.db.repositories.resume_draft_repository import (
    ResumeDraftRepository,
    resume_draft_repo,
)


class DraftCleanerWorker:
    """Daemon background worker untuk membersihkan draf kedaluwarsa (>30 hari)
    dan tempat sampah (>10 detik) secara periodik setiap 5 menit (BRULE-018).
    """

    def __init__(
        self,
        repo: ResumeDraftRepository | None = None,
        interval_seconds: float | None = None,
    ) -> None:
        self.repo = repo or resume_draft_repo
        self.interval_seconds = max(
            0.5,
            float(
                interval_seconds
                if interval_seconds is not None
                else settings.DRAFT_CLEANER_INTERVAL_SECONDS
            ),
        )
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    @property
    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self) -> None:
        with self._lock:
            if self.is_running:
                return
            self._stop_event.clear()
            self._thread = threading.Thread(
                target=self._run_loop,
                name="satukit-draft-cleaner",
                daemon=True,
            )
            self._thread.start()

    def stop(self, timeout: float = 2.0) -> None:
        with self._lock:
            if not self.is_running or self._thread is None:
                return
            self._stop_event.set()
            self._thread.join(timeout=timeout)
            self._thread = None

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.repo.purge_expired()
            except Exception:
                pass
            self._stop_event.wait(timeout=self.interval_seconds)


draft_cleaner = DraftCleanerWorker()
