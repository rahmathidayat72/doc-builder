"""Integration & security tests untuk GET status, single-use download, & DELETE cancel (VC-03)."""

from __future__ import annotations

import base64
import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
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
def video_api_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_file = tmp_path / f"test_video_api_{uuid.uuid4().hex}.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False, "timeout": 30},
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


def _create_user_session(
    env: dict,
    *,
    email: str = "user@example.com",
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


def _seed_job(
    env: dict,
    *,
    user_id: str,
    status: str = "succeeded",
    job_type: str = "compress",
    original_filename: str = "Rahasia_Klien_2026.mp4",
    output_filename: str = "Rahasia_Klien_2026_compressed.mp4",
    preset: str = "balanced",
    input_size_bytes: int = 250_000,
    output_size_bytes: int | None = 130_000,
    output_bytes: bytes | None = None,
    create_input_file: bool = False,
    progress_percent: float = 100.0,
    expires_offset: float | None = 900.0,
    ip_address: str = "198.51.100.77",
) -> str:
    job_id = str(uuid.uuid4())
    job_dir = env["workspace_dir"] / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    in_path: str | None = None
    out_path: str | None = None

    if create_input_file:
        input_file = job_dir / "input.bin"
        input_file.write_bytes(b"raw-input")
        in_path = str(input_file)

    if output_bytes is not None:
        out_name = "output.mp3" if job_type == "extract_audio" else "output.mp4"
        output_file = job_dir / out_name
        output_file.write_bytes(output_bytes)
        out_path = str(output_file)
        output_size_bytes = len(output_bytes)

    now = time.time()
    running_lock = 1 if status in ("scanning", "probing", "encoding") else None
    expires_at = None if expires_offset is None else now + expires_offset

    with env["session_factory"]() as session:
        session.add(
            VideoCompressionJob(
                id=job_id,
                user_id=user_id,
                job_type=job_type,
                ip_address=ip_address,
                original_filename=original_filename,
                output_filename=output_filename,
                preset=preset,
                status=status,
                running_lock=running_lock,
                progress_percent=progress_percent,
                input_path=in_path,
                output_path=out_path,
                input_size_bytes=input_size_bytes,
                output_size_bytes=output_size_bytes,
                created_at=now,
                updated_at=now,
                expires_at=expires_at,
                claimed_at=now if status == "claimed" else None,
            )
        )
        session.commit()
    return job_id


def _make_metadata(filename: str = "demo.mp4", preset: str = "balanced") -> str:
    raw = json.dumps({"filename": filename, "preset": preset}).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def test_status_download_cancel_auth_origin_csrf_and_prod_guards(
    video_api_env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    uid, sess, csrf = _create_user_session(video_api_env)
    job_id = _seed_job(video_api_env, user_id=uid, status="queued")
    client = TestClient(app)

    # 1. Unauthenticated -> 401
    assert client.get(f"/api/video-compressions/{job_id}").status_code == 401
    assert client.get(f"/api/video-compressions/{job_id}/download").status_code == 401
    assert client.delete(f"/api/video-compressions/{job_id}").status_code == 401

    # 2. Dev guest session -> 401
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    assert client.get(f"/api/video-compressions/{job_id}").status_code == 401
    assert client.get(f"/api/video-compressions/{job_id}/download").status_code == 401
    assert (
        client.delete(
            f"/api/video-compressions/{job_id}",
            headers={"X-CSRF-Token": session_manager.csrf_token},
        ).status_code
        == 401
    )

    # 3. Authenticated without CSRF on DELETE -> 403; disallowed Origin -> 403
    client.cookies.set(SESSION_COOKIE_NAME, sess)
    assert client.delete(f"/api/video-compressions/{job_id}").status_code == 403
    assert (
        client.get(
            f"/api/video-compressions/{job_id}",
            headers={"Origin": "https://evil.invalid"},
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/video-compressions/{job_id}/download",
            headers={"Origin": "https://evil.invalid"},
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/video-compressions/{job_id}",
            headers={"Origin": "https://evil.invalid", "X-CSRF-Token": csrf},
        ).status_code
        == 403
    )

    # 4. Unverified user di production -> 403
    uid2, sess2, csrf2 = _create_user_session(
        video_api_env, email="unverified@example.com", email_verified=False
    )
    job2 = _seed_job(video_api_env, user_id=uid2, status="queued")
    monkeypatch.setattr(settings, "IS_PRODUCTION", True)
    client.cookies.set(SESSION_COOKIE_NAME, sess2)
    assert client.get(f"/api/video-compressions/{job2}").status_code == 403
    assert client.get(f"/api/video-compressions/{job2}/download").status_code == 403
    assert (
        client.delete(
            f"/api/video-compressions/{job2}",
            headers={"X-CSRF-Token": csrf2},
        ).status_code
        == 403
    )


def test_anti_bola_cross_user_returns_404_across_all_endpoints(video_api_env: dict) -> None:
    owner_id, _owner_sess, _owner_csrf = _create_user_session(
        video_api_env, email="owner@example.com"
    )
    _other_id, other_sess, other_csrf = _create_user_session(
        video_api_env, email="attacker@example.com"
    )

    job_id = _seed_job(
        video_api_env,
        user_id=owner_id,
        status="succeeded",
        output_bytes=b"secret-owner-video",
    )

    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, other_sess)

    assert client.get(f"/api/video-compressions/{job_id}").status_code == 404
    assert client.get(f"/api/video-compressions/{job_id}/download").status_code == 404
    assert (
        client.delete(
            f"/api/video-compressions/{job_id}",
            headers={"X-CSRF-Token": other_csrf},
        ).status_code
        == 404
    )

    missing_id = str(uuid.uuid4())
    assert client.get(f"/api/video-compressions/{missing_id}").status_code == 404
    assert client.get(f"/api/video-compressions/{missing_id}/download").status_code == 404
    assert (
        client.delete(
            f"/api/video-compressions/{missing_id}",
            headers={"X-CSRF-Token": other_csrf},
        ).status_code
        == 404
    )

    # Verify owner job and output remain intact
    with video_api_env["session_factory"]() as session:
        job = session.get(VideoCompressionJob, job_id)
        assert job is not None
        assert job.status == "succeeded"
    assert (video_api_env["workspace_dir"] / job_id / "output.mp4").is_file()


def test_get_status_sanitizes_internal_fields_and_download_url(video_api_env: dict) -> None:
    uid, sess, _csrf = _create_user_session(video_api_env)
    enc_job = _seed_job(
        video_api_env,
        user_id=uid,
        status="encoding",
        progress_percent=45.0,
        create_input_file=True,
    )
    done_job = _seed_job(
        video_api_env,
        user_id=uid,
        status="succeeded",
        output_bytes=b"compressed",
    )

    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess)

    res_enc = client.get(f"/api/video-compressions/{enc_job}")
    assert res_enc.status_code == 200
    data_enc = res_enc.json()["data"]
    assert data_enc["status"] == "encoding"
    assert data_enc["progress_percent"] == 45.0
    assert data_enc["download_url"] is None
    for forbidden in ("input_path", "output_path", "ip_address", "user_id"):
        assert forbidden not in data_enc

    res_done = client.get(f"/api/video-compressions/{done_job}")
    assert res_done.status_code == 200
    data_done = res_done.json()["data"]
    assert data_done["status"] == "succeeded"
    assert data_done["download_url"] == f"/api/video-compressions/{done_job}/download"
    for forbidden in ("input_path", "output_path", "ip_address", "user_id"):
        assert forbidden not in data_done


def test_single_use_download_streams_cleans_workspace_and_handles_edge_states(
    video_api_env: dict,
) -> None:
    uid, sess, _csrf = _create_user_session(video_api_env)
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess)

    # 1. Not ready (`queued` / `failed`) -> 409
    queued_id = _seed_job(video_api_env, user_id=uid, status="queued")
    assert client.get(f"/api/video-compressions/{queued_id}/download").status_code == 409

    # 2. Expired (`succeeded` melewati TTL) -> 410 + bersihkan workspace & tandai expired
    expired_id = _seed_job(
        video_api_env,
        user_id=uid,
        status="succeeded",
        output_bytes=b"stale-video",
        expires_offset=-10.0,
    )
    res_exp = client.get(f"/api/video-compressions/{expired_id}/download")
    assert res_exp.status_code == 410
    assert not (video_api_env["workspace_dir"] / expired_id).exists()
    with video_api_env["session_factory"]() as session:
        exp_row = session.get(VideoCompressionJob, expired_id)
        assert exp_row is not None
        assert exp_row.status == "expired"

    # 3. Succeeded tapi berkas disk hilang -> 410 tanpa 500
    missing_file_id = _seed_job(
        video_api_env,
        user_id=uid,
        status="succeeded",
        output_bytes=None,
    )
    assert client.get(f"/api/video-compressions/{missing_file_id}/download").status_code == 410

    # 4. Happy path multi-chunk (>64 KiB) -> 200, headers valid, cleanup dir, lalu replay 409
    payload = b"MP4-CHUNK-" * 13_000  # 130_000 bytes
    ok_id = _seed_job(
        video_api_env,
        user_id=uid,
        status="succeeded",
        input_size_bytes=500_000,
        output_bytes=payload,
    )
    res_ok = client.get(f"/api/video-compressions/{ok_id}/download")
    assert res_ok.status_code == 200
    assert res_ok.headers["content-type"].startswith("video/mp4")
    assert 'filename="Rahasia_Klien_2026_compressed.mp4"' in res_ok.headers["content-disposition"]
    assert "no-store" in res_ok.headers["cache-control"]
    assert res_ok.headers["x-job-id"] == ok_id
    assert res_ok.headers["x-original-size"] == "500000"
    assert res_ok.headers["x-output-size"] == str(len(payload))
    assert res_ok.content == payload
    assert not (video_api_env["workspace_dir"] / ok_id).exists()

    with video_api_env["session_factory"]() as session:
        claimed_row = session.get(VideoCompressionJob, ok_id)
        assert claimed_row is not None
        assert claimed_row.status == "claimed"
        assert claimed_row.output_path is None

    # Unduhan ke-2 ditolak 409
    res_replay = client.get(f"/api/video-compressions/{ok_id}/download")
    assert res_replay.status_code == 409

    # 5. Concurrent double download race -> tepat satu 200 dan satu 409
    race_id = _seed_job(
        video_api_env,
        user_id=uid,
        status="succeeded",
        input_size_bytes=300_000,
        output_bytes=b"concurrent-video-bytes",
    )

    def _hit_download() -> int:
        with TestClient(app) as local_client:
            local_client.cookies.set(SESSION_COOKIE_NAME, sess)
            return local_client.get(f"/api/video-compressions/{race_id}/download").status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = sorted(list(pool.map(lambda _: _hit_download(), range(2))))
    assert statuses == [200, 409]


def test_cancel_active_jobs_cleans_workspace_retains_rate_limit_and_rejects_terminal(
    video_api_env: dict,
) -> None:
    uid, sess, csrf = _create_user_session(video_api_env)
    client = TestClient(app, client=("127.0.0.1", 50000))
    client.cookies.set(SESSION_COOKIE_NAME, sess)

    # 1. Cancel job `encoding` (`running_lock=1`) -> 200, running_lock=None, cleanup
    enc_id = _seed_job(
        video_api_env,
        user_id=uid,
        status="encoding",
        create_input_file=True,
        output_bytes=b"partial-output",
    )
    res_cancel = client.delete(
        f"/api/video-compressions/{enc_id}",
        headers={"X-CSRF-Token": csrf},
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["data"]["status"] == "cancelled"
    assert not (video_api_env["workspace_dir"] / enc_id).exists()
    with video_api_env["session_factory"]() as session:
        row = session.get(VideoCompressionJob, enc_id)
        assert row is not None
        assert row.status == "cancelled"
        assert row.running_lock is None
        assert row.input_path is None
        assert row.output_path is None

    # 2. Cancel terminal status -> 409
    for terminal in ("cancelled", "succeeded", "claimed", "failed", "expired"):
        term_id = (
            enc_id
            if terminal == "cancelled"
            else _seed_job(video_api_env, user_id=uid, status=terminal)
        )
        res_term = client.delete(
            f"/api/video-compressions/{term_id}",
            headers={"X-CSRF-Token": csrf},
        )
        assert res_term.status_code == 409

    # 3. Histori row `cancelled` tetap dihitung pada rate limit 3/jam
    uid2, sess2, csrf2 = _create_user_session(video_api_env, email="rlcancel@example.com")
    client.cookies.set(SESSION_COOKIE_NAME, sess2)
    for idx in range(3):
        up_res = client.post(
            "/api/video-compressions",
            content=b"video-data",
            headers={
                "X-CSRF-Token": csrf2,
                "Content-Type": "application/octet-stream",
                "X-Video-Metadata": _make_metadata(f"clip{idx}.mp4"),
                "X-Forwarded-For": "198.51.100.88",
            },
        )
        assert up_res.status_code == 202
        created_id = up_res.json()["data"]["id"]
        del_res = client.delete(
            f"/api/video-compressions/{created_id}",
            headers={"X-CSRF-Token": csrf2, "X-Forwarded-For": "198.51.100.88"},
        )
        assert del_res.status_code == 200

    res_4th = client.post(
        "/api/video-compressions",
        content=b"video-data-4",
        headers={
            "X-CSRF-Token": csrf2,
            "Content-Type": "application/octet-stream",
            "X-Video-Metadata": _make_metadata("clip4.mp4"),
            "X-Forwarded-For": "198.51.100.88",
        },
    )
    assert res_4th.status_code == 429
    assert int(res_4th.headers["Retry-After"]) >= 1


def test_audit_logs_for_download_and_cancel_contain_no_pii_or_paths(
    video_api_env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    audit_events: list[dict] = []

    def _capture_record(event: str, outcome: str, **fields) -> None:
        audit_events.append({"event": event, "outcome": outcome, **fields})

    monkeypatch.setattr(audit.audit_logger, "record", _capture_record)

    uid, sess, csrf = _create_user_session(video_api_env)
    sensitive_name = "Dokumen_Rahasia_NamaAsli.mp4"
    dl_id = _seed_job(
        video_api_env,
        user_id=uid,
        status="succeeded",
        original_filename=sensitive_name,
        output_filename="Dokumen_Rahasia_NamaAsli_compressed.mp4",
        output_bytes=b"video-ok",
        ip_address="203.0.113.250",
    )
    cancel_id = _seed_job(
        video_api_env,
        user_id=uid,
        status="queued",
        original_filename=sensitive_name,
        output_filename="Dokumen_Rahasia_NamaAsli_compressed.mp4",
        create_input_file=True,
        ip_address="203.0.113.250",
    )

    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess)

    assert client.get(f"/api/video-compressions/{dl_id}/download").status_code == 200
    assert client.get(f"/api/video-compressions/{dl_id}/download").status_code == 409
    assert (
        client.delete(
            f"/api/video-compressions/{cancel_id}",
            headers={"X-CSRF-Token": csrf},
        ).status_code
        == 200
    )
    assert (
        client.delete(
            f"/api/video-compressions/{cancel_id}",
            headers={"X-CSRF-Token": csrf},
        ).status_code
        == 409
    )

    video_events = [
        ev
        for ev in audit_events
        if ev["event"] in ("video_compression.download", "video_compression.cancel")
    ]
    assert len(video_events) == 4
    serialized = json.dumps(video_events)
    assert "Dokumen_Rahasia" not in serialized
    assert "output.mp4" not in serialized
    assert "input.bin" not in serialized
    assert "203.0.113.250" not in serialized
    assert str(video_api_env["workspace_dir"]) not in serialized


def test_extract_audio_status_and_download_flow(video_api_env: dict) -> None:
    uid, sess, _csrf = _create_user_session(video_api_env)
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, sess)

    mp3_payload = b"\xff\xfb\x90\x44" + (b"ID3-AUDIO-DATA" * 50)
    audio_job_id = _seed_job(
        video_api_env,
        user_id=uid,
        status="succeeded",
        job_type="extract_audio",
        original_filename="kajian.mp4",
        output_filename="kajian_audio.mp3",
        preset="192k",
        input_size_bytes=1_200_000,
        output_bytes=mp3_payload,
    )

    # 1. Status endpoint includes job_type
    res_status = client.get(f"/api/video-compressions/{audio_job_id}")
    assert res_status.status_code == 200
    job_data = res_status.json()["data"]
    assert job_data["job_type"] == "extract_audio"
    assert job_data["preset"] == "192k"
    assert job_data["output_filename"] == "kajian_audio.mp3"
    assert job_data["download_url"] == f"/api/video-compressions/{audio_job_id}/download"

    # 2. Download returns audio/mpeg and correct Content-Disposition
    res_dl = client.get(f"/api/video-compressions/{audio_job_id}/download")
    assert res_dl.status_code == 200
    assert res_dl.headers["content-type"].startswith("audio/mpeg")
    assert 'filename="kajian_audio.mp3"' in res_dl.headers["content-disposition"]
    assert res_dl.content == mp3_payload
    assert not (video_api_env["workspace_dir"] / audio_job_id).exists()

    # 3. Single-use download replay returns 409
    res_replay = client.get(f"/api/video-compressions/{audio_job_id}/download")
    assert res_replay.status_code == 409

