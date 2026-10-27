import json
import stat
import sys
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import audit  # noqa: E402
from app.core.audit import AuditLogger  # noqa: E402
from app.core.security import SESSION_COOKIE_NAME  # noqa: E402
from app.main import app  # noqa: E402

TRUSTED_ORIGIN = {"Origin": "http://localhost:5173"}


def _log_files(log_dir: Path) -> list[Path]:
    return sorted(log_dir.glob("audit-*.jsonl"))


def _read_events(log_dir: Path) -> list[dict]:
    events: list[dict] = []
    for path in _log_files(log_dir):
        for line in path.read_text(encoding="utf-8").splitlines():
            events.append(json.loads(line))
    return events


def _read_raw(log_dir: Path) -> str:
    return "".join(path.read_text(encoding="utf-8") for path in _log_files(log_dir))


@pytest.fixture()
def audit_dir(tmp_path, monkeypatch):
    """Mengarahkan audit logger global ke direktori sementara per test."""
    log_dir = tmp_path / "logs"
    monkeypatch.setattr(audit, "audit_logger", AuditLogger(log_dir))
    return log_dir


def _bootstrap(client: TestClient) -> str:
    response = client.post("/api/auth/bootstrap", json={}, headers=TRUSTED_ORIGIN)
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_audit_logger_writes_structured_jsonl_with_restricted_permissions(tmp_path):
    logger = AuditLogger(tmp_path / "logs")
    logger.record(
        "api.request",
        "allowed",
        request_id="req-1",
        method="GET",
        route="/api/auth/session",
        status=200,
        duration_ms=1.25,
    )

    files = _log_files(tmp_path / "logs")
    assert len(files) == 1

    payload = json.loads(files[0].read_text(encoding="utf-8").strip())
    assert payload["event"] == "api.request"
    assert payload["outcome"] == "allowed"
    assert payload["request_id"] == "req-1"
    assert payload["route"] == "/api/auth/session"
    assert payload["status"] == 200
    assert payload["timestamp"].endswith("Z")

    parsed = datetime.fromisoformat(payload["timestamp"].replace("Z", "+00:00"))
    assert parsed.tzinfo == UTC

    if sys.platform != "win32":
        assert stat.S_IMODE(files[0].stat().st_mode) == 0o600
        assert stat.S_IMODE(files[0].parent.stat().st_mode) == 0o700


def test_audit_logger_prunes_expired_files_only(tmp_path):
    logger = AuditLogger(tmp_path, retention_days=7)
    today = datetime.now(UTC).date()
    expired = tmp_path / f"audit-{(today - timedelta(days=7)).isoformat()}.jsonl"
    recent = tmp_path / f"audit-{(today - timedelta(days=6)).isoformat()}.jsonl"
    foreign = tmp_path / "notes.jsonl"
    for path in (expired, recent, foreign):
        path.write_text("{}\n", encoding="utf-8")

    logger.prune()

    assert not expired.exists()
    assert recent.exists()
    assert foreign.exists()


def test_audit_logger_handles_concurrent_appends(tmp_path):
    logger = AuditLogger(tmp_path)

    def worker(worker_id: int) -> None:
        for index in range(25):
            logger.record("api.request", "allowed", request_id=f"{worker_id}-{index}")

    threads = [threading.Thread(target=worker, args=(worker_id,)) for worker_id in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    events = _read_events(tmp_path)
    assert len(events) == 100
    assert len({event["request_id"] for event in events}) == 100


def test_audit_logger_write_failure_does_not_raise(tmp_path, capsys):
    blocked_path = tmp_path / "logs"
    blocked_path.write_text("not a directory", encoding="utf-8")

    logger = AuditLogger(blocked_path)
    logger.record("api.request", "allowed")

    assert "audit_log_write_failed" in capsys.readouterr().err


def test_middleware_logs_untrusted_origin_denial(audit_dir):
    client = TestClient(app)
    response = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert response.status_code == 403

    denied = [event for event in _read_events(audit_dir) if event["event"] == "security.denied"]
    assert denied[-1]["reason"] == "origin"
    assert denied[-1]["status"] == 403
    assert denied[-1]["route"] == "/api/health"


def test_middleware_logs_missing_session_denial(audit_dir):
    client = TestClient(app)
    client.cookies.clear()
    response = client.get("/api/auth/session")
    assert response.status_code == 401

    denied = [event for event in _read_events(audit_dir) if event["event"] == "security.denied"]
    assert denied[-1]["reason"] == "session"
    assert denied[-1]["status"] == 401


def test_middleware_logs_csrf_denial(audit_dir):
    client = TestClient(app)
    _bootstrap(client)

    response = client.post("/api/auth/session", headers=TRUSTED_ORIGIN)
    assert response.status_code == 403

    denied = [event for event in _read_events(audit_dir) if event["event"] == "security.denied"]
    assert denied[-1]["reason"] == "csrf"
    assert denied[-1]["status"] == 403


def test_middleware_logs_allowed_request_without_sensitive_values(audit_dir):
    client = TestClient(app)
    csrf_token = _bootstrap(client)

    response = client.get("/api/auth/session", headers=TRUSTED_ORIGIN)
    assert response.status_code == 200

    events = _read_events(audit_dir)
    assert any(
        event["event"] == "api.request"
        and event["route"] == "/api/auth/session"
        and event["status"] == 200
        for event in events
    )

    raw = _read_raw(audit_dir)
    assert csrf_token not in raw
    assert SESSION_COOKIE_NAME not in raw


def test_health_request_is_not_logged(audit_dir):
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert _read_events(audit_dir) == []


def test_query_string_and_credentials_are_not_logged(audit_dir):
    client = TestClient(app)
    client.cookies.clear()

    response = client.get(
        "/api/auth/session?token=super-secret-token&email=user@example.com"
    )
    assert response.status_code == 401

    raw = _read_raw(audit_dir)
    assert "super-secret-token" not in raw
    assert "user@example.com" not in raw
