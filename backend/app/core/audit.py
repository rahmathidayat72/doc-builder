import json
import os
import re
import sys
import threading
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from app.core.config import settings

_AUDIT_FILE_RE = re.compile(r"^audit-(\d{4}-\d{2}-\d{2})\.jsonl$")


class AuditLogger:
    """Audit trail JSONL lokal dengan rotasi harian dan retensi terbatas.

    Catatan keamanan:
    - Direktori dibuat ``0700`` dan berkas ``0600`` pada platform POSIX.
    - Isi log tidak boleh memuat PII, body request, header, token, atau nama berkas.
    - Log ini bukan tamper-evident terhadap pengguna OS yang sama; perlindungan
      utama adalah batas akun OS dan permission berkas.
    """

    def __init__(self, log_dir: Path, retention_days: int = 7):
        self.log_dir = Path(log_dir)
        self.retention_days = max(1, int(retention_days))
        self._lock = threading.Lock()
        self._initialized = False
        self._last_prune_date: date | None = None

    def initialize(self) -> None:
        """Membuat direktori log dan menjalankan retensi."""
        with self._lock:
            self._ensure_dir_locked()
            self._prune_locked(datetime.now(UTC).date())
            self._initialized = True

    def record(self, event: str, outcome: str, **fields: Any) -> None:
        """Menambahkan satu event audit. Kegagalan tulis tidak boleh menggagalkan request."""
        timestamp = datetime.now(UTC)
        payload: dict[str, Any] = {
            "timestamp": timestamp.isoformat().replace("+00:00", "Z"),
            "event": str(event),
            "outcome": str(outcome),
        }
        for key, value in fields.items():
            if value is not None:
                payload[key] = value

        line = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str)
        try:
            with self._lock:
                self._ensure_dir_locked()
                today = timestamp.date()
                if self._last_prune_date != today:
                    self._prune_locked(today)

                path = self._path_for(today)
                fd = os.open(path, os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o600)
                try:
                    self._chmod_fd(fd)
                    os.write(fd, (line + "\n").encode("utf-8"))
                finally:
                    os.close(fd)
                self._initialized = True
        except OSError as exc:
            # Jangan menulis path, pesan mentah, atau data request ke stderr.
            sys.stderr.write(f"audit_log_write_failed:{type(exc).__name__}\n")

    def prune(self) -> None:
        """Menghapus berkas audit harian di luar retensi."""
        with self._lock:
            self._ensure_dir_locked()
            self._prune_locked(datetime.now(UTC).date())

    def _ensure_dir_locked(self) -> None:
        self.log_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            os.chmod(self.log_dir, 0o700)
        except OSError:
            pass

    def _path_for(self, day: date) -> Path:
        return self.log_dir / f"audit-{day.isoformat()}.jsonl"

    @staticmethod
    def _chmod_fd(fd: int) -> None:
        try:
            os.fchmod(fd, 0o600)
        except (AttributeError, OSError):
            pass

    def _prune_locked(self, today: date) -> None:
        cutoff = today - timedelta(days=self.retention_days - 1)
        for path in self.log_dir.iterdir():
            match = _AUDIT_FILE_RE.match(path.name)
            if not match:
                continue
            try:
                file_date = date.fromisoformat(match.group(1))
            except ValueError:
                continue
            if file_date < cutoff:
                try:
                    path.unlink()
                except OSError:
                    continue
        self._last_prune_date = today


audit_logger = AuditLogger(settings.AUDIT_LOG_DIR, settings.AUDIT_LOG_RETENTION_DAYS)
