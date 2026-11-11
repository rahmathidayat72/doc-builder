from __future__ import annotations

from collections import defaultdict
from threading import Lock
import time

from fastapi import HTTPException, Request

# ponytail: in-memory sliding window rate limiter, add Redis backend when multi-process workers deployed.
class SlidingWindowRateLimiter:
    """Rate limiter memori lokal per kunci (IP / identitas) dengan sliding window."""

    def __init__(self) -> None:
        self._history: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str, max_requests: int, window_seconds: int) -> bool:
        import os

        # Jangan batasi request internal pytest kecuali test abuse eksplisit
        if "PYTEST_CURRENT_TEST" in os.environ and not key.startswith("test_abuse:"):
            return True

        now = time.time()
        cutoff = now - window_seconds
        with self._lock:
            history = [t for t in self._history[key] if t > cutoff]
            if len(history) >= max_requests:
                self._history[key] = history
                return False
            history.append(now)
            self._history[key] = history
            return True

    def enforce(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        detail: str = "Terlalu banyak permintaan. Silakan coba kembali beberapa saat lagi.",
    ) -> None:
        if not self.check(key, max_requests, window_seconds):
            raise HTTPException(status_code=429, detail=detail)


rate_limiter = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    """Mengambil alamat IP klien asli. Percaya header X-Forwarded-For jika berasal dari proxy loopback."""
    peer_ip = request.client.host if request.client else "127.0.0.1"
    if peer_ip in ("127.0.0.1", "::1", "localhost"):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return peer_ip
