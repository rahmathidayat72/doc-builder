"""Shared non-PII heartbeat constants and evaluation helpers for Satukit background workers."""

from __future__ import annotations

import time
from typing import Any

FILE_WORKER_HEARTBEAT_KEY = "file_worker_last_seen"
FILE_WORKER_HEARTBEAT_STALE_SECONDS = 60.0
STALE_CHECKING_TIMEOUT_SECONDS = 900.0


def evaluate_worker_heartbeat(
    state: Any,
    *,
    stale_seconds: float = FILE_WORKER_HEARTBEAT_STALE_SECONDS,
    now: float | None = None,
    include_active_job: bool = False,
) -> dict[str, Any]:
    """Evaluates a RuntimeState heartbeat record without exposing filesystem paths or PII."""
    fallback: dict[str, Any] = {
        "status": "unavailable",
        "fresh": False,
        "worker_status": None,
        "last_heartbeat_at": None,
        "age_seconds": None,
        "heartbeat_age_seconds": None,
    }
    if include_active_job:
        fallback["has_active_job"] = False

    if state is None:
        return fallback

    raw_val = state.value if isinstance(getattr(state, "value", None), dict) else {}
    raw_ts = raw_val.get("last_heartbeat_at", getattr(state, "updated_at", None))
    try:
        last_hb = float(raw_ts)
    except (TypeError, ValueError):
        try:
            last_hb = float(state.updated_at)
        except (TypeError, ValueError):
            return fallback

    raw_status = raw_val.get("status")
    if raw_status == "stopped":
        worker_status = "stopped"
    elif raw_status in ("idle", "processing"):
        worker_status = raw_status
    else:
        worker_status = "unknown"

    ts = time.time() if now is None else now
    age_seconds = max(0.0, round(ts - last_hb, 2))
    is_stopped = worker_status == "stopped"
    is_fresh = (not is_stopped) and (age_seconds <= stale_seconds)

    if is_stopped:
        health_status = "unavailable"
    elif is_fresh:
        health_status = "healthy"
    else:
        health_status = "stale"

    result: dict[str, Any] = {
        "status": health_status,
        "fresh": is_fresh,
        "worker_status": worker_status,
        "last_heartbeat_at": last_hb,
        "age_seconds": age_seconds,
        "heartbeat_age_seconds": age_seconds,
    }
    if include_active_job:
        result["has_active_job"] = bool(raw_val.get("has_active_job", False))
    return result
