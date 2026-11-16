"""Integration & security tests untuk streaming upload POST /api/video-compressions (VC-01)."""

from __future__ import annotations

import ast
import base64
import json
import os
import time
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.video_compression import set_video_compression_engine_override
from app.core import audit
from app.core.config import settings
from app.core.disk_guard import DiskSpaceInfo
from app.core.security import SESSION_COOKIE_NAME, session_manager
from app.db.models import User, VideoCompressionJob
from app.db.postgres import Base
from app.db.repositories.auth_repository import AuthRepository
from app.main import app
from app.services.auth_service import auth_service


@pytest.fixture
def video_upload_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_file = tmp_path / f"test_video_upload_{uuid.uuid4().hex}.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    set_video_compression_engine_override(engine)

    auth_repo = AuthRepository(session_factory)
    orig_auth_repo = auth_service._repo
    auth_service._repo = auth_repo

    ws_dir = tmp_path / "video_workspace"
    ws_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "VIDEO_COMPRESSION_WORKSPACE_DIR", ws_dir)
    monkeypatch.setattr(
        "app.core.disk_guard.get_disk_space_info",
        lambda _path=None: DiskSpaceInfo(
            total_bytes=10_000_000_000,
            used_bytes=1_000_000_000,
            free_bytes=9_000_000_000,
            used_percent=10.0,
            status="healthy",
        ),
    )

    yield {
        "engine": engine,
        "session_factory": session_factory,
        "workspace_dir": ws_dir,
    }

    auth_service._repo = orig_auth_repo
    set_video_compression_engine_override(None)
    engine.dispose()


def create_user_session(
    env: dict,
    *,
    email: str = "video@example.com",
    email_verified: bool = True,
) -> tuple[str, str, str]:
    session_factory: sessionmaker[Session] = env["session_factory"]
    now = time.time()
    user_id = str(uuid.uuid4())
    with session_factory() as session:
        session.add(
            User(
                id=user_id,
                email=email,
                name="Video User",
                password_hash="hashed-pwd",
                email_verified=1 if email_verified else 0,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    sess_token, csrf_token, _ = auth_service.create_session(user_id)
    return user_id, sess_token, csrf_token


def make_video_metadata(
    filename: str = "demo.mp4",
    preset: str = "balanced",
    *,
    job_type: str = "compress",
    owner_confirmed: bool | None = None,
) -> str:
    payload: dict[str, object] = {"filename": filename, "preset": preset, "job_type": job_type}
    if owner_confirmed is not None:
        payload["owner_confirmed"] = owner_confirmed
    raw = json.dumps(payload).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def test_route_does_not_call_request_body() -> None:
    route_src = (
        Path(__file__).resolve().parent.parent / "app" / "api" / "video_compression.py"
    ).read_text(encoding="utf-8")
    tree = ast.parse(route_src)
    called_attrs = {
        node.func.attr
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    }
    assert "body" not in called_attrs
    assert "stream" in called_attrs


def test_auth_origin_csrf_and_prod_verified_guards(
    video_upload_env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = TestClient(app)

    # 1. Unauthenticated -> 401
    res_anon = client.post("/api/video-compressions", content=b"123")
    assert res_anon.status_code == 401

    # 2. Dev guest session (bukan user DB) -> tetap 401
    guest_cookie = session_manager.session_token
    client.cookies.set(SESSION_COOKIE_NAME, guest_cookie)
    res_guest = client.post(
        "/api/video-compressions",
        content=b"123",
        headers={
            "X-CSRF-Token": session_manager.csrf_token,
            "X-Video-Metadata": make_video_metadata(),
        },
    )
    assert res_guest.status_code == 401

    # 3. Authenticated user tanpa CSRF -> 403
    _uid, sess_token, csrf = create_user_session(video_upload_env)
    client.cookies.set(SESSION_COOKIE_NAME, sess_token)
    res_no_csrf = client.post(
        "/api/video-compressions",
        content=b"123",
        headers={"X-Video-Metadata": make_video_metadata()},
    )
    assert res_no_csrf.status_code == 403

    # 4. Disallowed Origin -> 403
    res_bad_origin = client.post(
        "/api/video-compressions",
        content=b"123",
        headers={
            "Origin": "https://evil.invalid",
            "X-CSRF-Token": csrf,
            "X-Video-Metadata": make_video_metadata(),
        },
    )
    assert res_bad_origin.status_code == 403

    # 5. Unverified user di production -> 403
    _uid2, sess2, csrf2 = create_user_session(
        video_upload_env, email="unverified@example.com", email_verified=False
    )
    monkeypatch.setattr(settings, "IS_PRODUCTION", True)
    client.cookies.set(SESSION_COOKIE_NAME, sess2)
    res_unverified = client.post(
        "/api/video-compressions",
        content=b"123",
        headers={
            "X-CSRF-Token": csrf2,
            "X-Video-Metadata": make_video_metadata(),
        },
    )
    assert res_unverified.status_code == 403


def test_metadata_and_content_type_validation(video_upload_env: dict) -> None:
    _uid, sess, csrf = create_user_session(video_upload_env)
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess)
    base_headers = {"X-CSRF-Token": csrf, "Content-Type": "application/octet-stream"}

    assert (
        client.post("/api/video-compressions", content=b"123", headers=base_headers).status_code
        == 400
    )
    assert (
        client.post(
            "/api/video-compressions",
            content=b"123",
            headers={**base_headers, "X-Video-Metadata": "!!!bad!!!"},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/video-compressions",
            content=b"123",
            headers={**base_headers, "X-Video-Metadata": make_video_metadata("video.mkv")},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/video-compressions",
            content=b"123",
            headers={**base_headers, "X-Video-Metadata": make_video_metadata("ok.mp4", "extreme")},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/video-compressions",
            content=b"123",
            headers={
                "X-CSRF-Token": csrf,
                "Content-Type": "multipart/form-data; boundary=abc",
                "X-Video-Metadata": make_video_metadata(),
            },
        ).status_code
        == 415
    )


def test_streaming_upload_success_and_non_pii_audit(
    video_upload_env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    audit_events: list[dict[str, object]] = []
    monkeypatch.setattr(
        audit.audit_logger,
        "record",
        lambda event, outcome, **fields: audit_events.append(
            {"event": event, "outcome": outcome, **fields}
        ),
    )

    _uid, sess, csrf = create_user_session(video_upload_env)
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess)

    def chunk_stream():
        for _ in range(4):
            yield b"V" * 16_384

    res = client.post(
        "/api/video-compressions",
        content=chunk_stream(),
        headers={
            "X-CSRF-Token": csrf,
            "Content-Type": "application/octet-stream",
            "X-Video-Metadata": make_video_metadata("../../rahasiaku/Liburan Pribadi.MOV", "light"),
        },
    )
    assert res.status_code == 202
    payload = res.json()
    assert payload["success"] is True
    job_data = payload["data"]
    assert job_data["status"] == "queued"
    assert job_data["preset"] == "light"
    assert job_data["original_filename"] == "Liburan Pribadi.MOV"
    assert job_data["output_filename"] == "Liburan_Pribadi_compressed.mp4"
    assert job_data["input_size_bytes"] == 65_536
    assert "input_path" not in job_data
    assert "output_path" not in job_data

    saved_file = video_upload_env["workspace_dir"] / job_data["id"] / "input.bin"
    assert saved_file.exists()
    assert saved_file.stat().st_size == 65_536
    if os.name != "nt":
        assert (saved_file.stat().st_mode & 0o777) == 0o600
        assert (saved_file.parent.stat().st_mode & 0o777) == 0o700

    upload_events = [e for e in audit_events if e["event"] == "video_compression.upload"]
    assert len(upload_events) == 1
    serialized_audit = json.dumps(upload_events[0])
    assert "Liburan Pribadi" not in serialized_audit
    assert "input.bin" not in serialized_audit


def test_empty_oversized_workspace_and_disk_guard_cleanup(
    video_upload_env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    _uid, sess, csrf = create_user_session(video_upload_env)
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess)
    headers = {
        "X-CSRF-Token": csrf,
        "Content-Type": "application/octet-stream",
        "X-Video-Metadata": make_video_metadata("sample.mp4"),
    }

    # 1. Empty chunked stream (tanpa Content-Length) -> 400 + no orphan files/rows
    def empty_gen():
        if False:
            yield b""

    res_empty = client.post("/api/video-compressions", content=empty_gen(), headers=headers)
    assert res_empty.status_code == 400
    assert list(video_upload_env["workspace_dir"].iterdir()) == []
    with video_upload_env["session_factory"]() as s:
        assert s.execute(select(VideoCompressionJob)).scalars().all() == []

    # 2. Exceeds max file bytes mid-stream -> 413 + cleanup
    monkeypatch.setattr(settings, "VIDEO_COMPRESSION_MAX_FILE_BYTES", 1024)

    def big_gen():
        yield b"a" * 600
        yield b"b" * 600

    res_big = client.post("/api/video-compressions", content=big_gen(), headers=headers)
    assert res_big.status_code == 413
    assert list(video_upload_env["workspace_dir"].iterdir()) == []
    with video_upload_env["session_factory"]() as s:
        assert s.execute(select(VideoCompressionJob)).scalars().all() == []

    # 3. Exceeds global workspace cap -> 507 + cleanup
    monkeypatch.setattr(settings, "VIDEO_COMPRESSION_MAX_FILE_BYTES", 250_000_000)
    monkeypatch.setattr(settings, "VIDEO_COMPRESSION_WORKSPACE_MAX_BYTES", 1000)
    existing_dir = video_upload_env["workspace_dir"] / "existing-job"
    existing_dir.mkdir(parents=True, exist_ok=True)
    (existing_dir / "input.bin").write_bytes(b"x" * 700)

    def over_ws_gen():
        yield b"y" * 400

    res_ws = client.post("/api/video-compressions", content=over_ws_gen(), headers=headers)
    assert res_ws.status_code == 507
    # Only existing-job remains; failed upload dir cleaned up
    assert [p.name for p in video_upload_env["workspace_dir"].iterdir()] == ["existing-job"]
    with video_upload_env["session_factory"]() as s:
        assert s.execute(select(VideoCompressionJob)).scalars().all() == []

    # 4. OS Disk Guard >= 80% -> 507
    monkeypatch.setattr(
        "app.core.disk_guard.get_disk_space_info",
        lambda _path=None: DiskSpaceInfo(
            total_bytes=1000,
            used_bytes=850,
            free_bytes=150,
            used_percent=85.0,
            status="critical",
        ),
    )
    res_disk = client.post("/api/video-compressions", content=b"123", headers=headers)
    assert res_disk.status_code == 507


def test_active_job_rate_limit_and_global_queue_http_responses(video_upload_env: dict) -> None:
    session_factory: sessionmaker[Session] = video_upload_env["session_factory"]
    u1, sess1, csrf1 = create_user_session(video_upload_env, email="u1@example.com")
    u2, sess2, csrf2 = create_user_session(video_upload_env, email="u2@example.com")
    u3, sess3, csrf3 = create_user_session(video_upload_env, email="u3@example.com")
    u4, sess4, csrf4 = create_user_session(video_upload_env, email="u4@example.com")
    u5, sess5, csrf5 = create_user_session(video_upload_env, email="u5@example.com")

    client = TestClient(app, client=("127.0.0.1", 50000))

    # 1. u1 uploads -> 202 queued; 2nd upload while active -> 409
    client.cookies.set(SESSION_COOKIE_NAME, sess1)
    r1 = client.post(
        "/api/video-compressions",
        content=b"video-1",
        headers={
            "X-CSRF-Token": csrf1,
            "X-Video-Metadata": make_video_metadata("a.mp4"),
            "X-Forwarded-For": "198.51.100.1",
        },
    )
    assert r1.status_code == 202
    r1_dup = client.post(
        "/api/video-compressions",
        content=b"video-1b",
        headers={
            "X-CSRF-Token": csrf1,
            "X-Video-Metadata": make_video_metadata("b.mp4"),
            "X-Forwarded-For": "198.51.100.1",
        },
    )
    assert r1_dup.status_code == 409

    # 2. u2 & u3 fill remaining queue (1+2 = 3 active total); u4 -> 503 Retry-After: 30
    for sess, csrf, ip in (
        (sess2, csrf2, "198.51.100.2"),
        (sess3, csrf3, "198.51.100.3"),
    ):
        client.cookies.set(SESSION_COOKIE_NAME, sess)
        res = client.post(
            "/api/video-compressions",
            content=b"video-q",
            headers={
                "X-CSRF-Token": csrf,
                "X-Video-Metadata": make_video_metadata("q.webm"),
                "X-Forwarded-For": ip,
            },
        )
        assert res.status_code == 202

    client.cookies.set(SESSION_COOKIE_NAME, sess4)
    res_full = client.post(
        "/api/video-compressions",
        content=b"video-4",
        headers={
            "X-CSRF-Token": csrf4,
            "X-Video-Metadata": make_video_metadata("overflow.mp4"),
            "X-Forwarded-For": "198.51.100.4",
        },
    )
    assert res_full.status_code == 503
    assert res_full.headers.get("Retry-After") == "30"

    # 3. Free global queue & verify 3/hour rate limit per IP across users (429 + Retry-After)
    with session_factory() as s:
        for j in s.execute(select(VideoCompressionJob)).scalars().all():
            j.status = "failed"
            j.running_lock = None
        s.commit()

    # Seed 3 recent jobs on same IP 203.0.113.77 for u2, u3, u4 -> u5 on same IP gets 429
    now = time.time()
    with session_factory() as s:
        for idx, uid in enumerate((u2, u3, u4), start=1):
            s.add(
                VideoCompressionJob(
                    id=str(uuid.uuid4()),
                    user_id=uid,
                    ip_address="203.0.113.77",
                    original_filename=f"ip{idx}.mp4",
                    output_filename=f"ip{idx}_compressed.mp4",
                    preset="balanced",
                    status="failed",
                    running_lock=None,
                    input_size_bytes=100,
                    created_at=now - idx,
                    updated_at=now - idx,
                )
            )
        s.commit()

    client.cookies.set(SESSION_COOKIE_NAME, sess5)
    res_rl = client.post(
        "/api/video-compressions",
        content=b"video-rl",
        headers={
            "X-CSRF-Token": csrf5,
            "X-Video-Metadata": make_video_metadata("rl.mp4"),
            "X-Forwarded-For": "203.0.113.77",
        },
    )
    assert res_rl.status_code == 429
    assert int(res_rl.headers["Retry-After"]) >= 1

    # Also verify u1 reached 3/hour account limit after 2 more completed jobs
    with session_factory() as s:
        for idx in (2, 3):
            s.add(
                VideoCompressionJob(
                    id=str(uuid.uuid4()),
                    user_id=u1,
                    ip_address=f"198.51.100.9{idx}",
                    original_filename=f"u1_{idx}.mp4",
                    output_filename=f"u1_{idx}_compressed.mp4",
                    preset="balanced",
                    status="succeeded",
                    running_lock=None,
                    input_size_bytes=100,
                    created_at=now - idx,
                    updated_at=now - idx,
                )
            )
        s.commit()

    client.cookies.set(SESSION_COOKIE_NAME, sess1)
    res_u1_rl = client.post(
        "/api/video-compressions",
        content=b"video-u1-4th",
        headers={
            "X-CSRF-Token": csrf1,
            "X-Video-Metadata": make_video_metadata("u1_4th.mp4"),
            "X-Forwarded-For": "198.51.100.99",
        },
    )
    assert res_u1_rl.status_code == 429
    assert int(res_u1_rl.headers["Retry-After"]) >= 1


def test_extract_audio_upload_validation_and_queue(video_upload_env: dict) -> None:
    _uid, sess, csrf = create_user_session(video_upload_env)
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess)

    base_headers = {
        "X-CSRF-Token": csrf,
        "Content-Type": "application/octet-stream",
    }

    # 1. Non-mp4 extension rejected 422
    meta_mkv = make_video_metadata(
        "sample.mkv", preset="192k", job_type="extract_audio", owner_confirmed=True
    )
    res_mkv = client.post(
        "/api/video-compressions",
        content=b"fake-bytes",
        headers={**base_headers, "X-Video-Metadata": meta_mkv},
    )
    assert res_mkv.status_code == 422
    assert ".mp4" in res_mkv.json()["detail"]

    # 2. owner_confirmed missing/false rejected 422
    meta_no_confirm = make_video_metadata(
        "sample.mp4", preset="192k", job_type="extract_audio", owner_confirmed=False
    )
    res_no_confirm = client.post(
        "/api/video-compressions",
        content=b"fake-bytes",
        headers={**base_headers, "X-Video-Metadata": meta_no_confirm},
    )
    assert res_no_confirm.status_code == 422
    assert "hak penggunaan audio" in res_no_confirm.json()["detail"]

    # 3. Invalid preset for extract_audio rejected 400
    meta_bad_preset = make_video_metadata(
        "sample.mp4", preset="balanced", job_type="extract_audio", owner_confirmed=True
    )
    res_bad_preset = client.post(
        "/api/video-compressions",
        content=b"fake-bytes",
        headers={**base_headers, "X-Video-Metadata": meta_bad_preset},
    )
    assert res_bad_preset.status_code == 400
    assert "Preset audio tidak valid" in res_bad_preset.json()["detail"]

    # 4. Invalid job_type rejected 400
    meta_bad_type = make_video_metadata(
        "sample.mp4", preset="192k", job_type="unknown_type", owner_confirmed=True
    )
    res_bad_type = client.post(
        "/api/video-compressions",
        content=b"fake-bytes",
        headers={**base_headers, "X-Video-Metadata": meta_bad_type},
    )
    assert res_bad_type.status_code == 400
    assert "Tipe tugas tidak valid" in res_bad_type.json()["detail"]

    # 5. Happy path extract_audio with 320k -> 202
    meta_ok = make_video_metadata(
        "podcast_clip.mp4", preset="320k", job_type="extract_audio", owner_confirmed=True
    )
    res_ok = client.post(
        "/api/video-compressions",
        content=b"fake-mp4-stream",
        headers={**base_headers, "X-Video-Metadata": meta_ok},
    )
    assert res_ok.status_code == 202
    data = res_ok.json()["data"]
    assert data["job_type"] == "extract_audio"
    assert data["preset"] == "320k"
    assert data["original_filename"] == "podcast_clip.mp4"
    assert data["output_filename"] == "podcast_clip_audio.mp3"
    assert data["status"] == "queued"

