"""Integration & lifecycle tests untuk Video Compression Worker (VC-02)."""

from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core import audit
from app.core.config import settings
from app.db.models import RuntimeState, User, VideoCompressionJob
from app.db.postgres import Base
from app.db.repositories.video_compression_repository import VideoCompressionRepository
from app.services.file_scanner import MockClamAVScanner, ScanResult
from app.services.video_compressor import (
    AudioExtractionResult,
    AudioProbeInfo,
    OutputNotSmallerError,
    VideoCompressionCancelledError,
    VideoCompressionResult,
    VideoProbeError,
    VideoProbeInfo,
)
from app.workers import video_worker


@pytest.fixture
def worker_ctx(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_file = tmp_path / f"video_worker_{uuid.uuid4().hex}.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    ws_dir = tmp_path / "video_ws"
    ws_dir.mkdir(parents=True, exist_ok=True)

    audit_dir = tmp_path / "audit_logs"
    monkeypatch.setattr(audit.audit_logger, "log_dir", audit_dir)
    monkeypatch.setattr(audit.audit_logger, "_last_prune_date", None)
    monkeypatch.setattr(settings, "VIDEO_COMPRESSION_WORKSPACE_DIR", ws_dir)

    now = time.time()
    with session_factory() as session:
        session.add(
            User(
                id="user-1",
                email="video_worker@example.com",
                name="Video Worker User",
                email_verified=1,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()

    try:
        yield {
            "engine": engine,
            "session_factory": session_factory,
            "workspace_dir": ws_dir,
            "audit_dir": audit_dir,
        }
    finally:
        engine.dispose()


def _seed_queued_job(
    session_factory: sessionmaker,
    ws_dir: Path,
    *,
    user_id: str = "user-1",
    filename: str = "clip.mp4",
    output_filename: str | None = None,
    job_type: str = "compress",
    content: bytes = b"V" * 2048,
    preset: str = "balanced",
    now: float | None = None,
) -> VideoCompressionJob:
    ts = time.time() if now is None else now
    out_name = output_filename or (
        "clip_audio.mp3" if job_type == "extract_audio" else "clip_compressed.mp4"
    )
    with session_factory() as session:
        repo = VideoCompressionRepository(session)
        job = repo.reserve_upload_job(
            user_id=user_id,
            ip_address="198.51.100.10",
            original_filename=filename,
            output_filename=out_name,
            job_type=job_type,
            preset=preset,
            workspace_dir=ws_dir,
            now=ts,
        )
        job_dir = ws_dir / job.id
        job_dir.mkdir(parents=True, exist_ok=True)
        Path(job.input_path).write_bytes(content)
        repo.finalize_upload_queued(job.id, len(content), now=ts)
        session.commit()
        session.refresh(job)
        return job


def _read_audit_events(audit_dir: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    if not audit_dir.exists():
        return events
    for file in sorted(audit_dir.glob("audit-*.jsonl")):
        for line in file.read_text(encoding="utf-8").splitlines():
            if line.strip():
                events.append(json.loads(line))
    return events


def test_recover_stale_running_jobs_marks_failed_and_cleans_workspace(
    worker_ctx: dict[str, Any],
) -> None:
    engine = worker_ctx["engine"]
    session_factory = worker_ctx["session_factory"]
    ws_dir: Path = worker_ctx["workspace_dir"]

    stale_id = str(uuid.uuid4())
    stale_dir = ws_dir / stale_id
    stale_dir.mkdir(parents=True)
    in_file = stale_dir / "input.bin"
    out_file = stale_dir / "output.mp4"
    in_file.write_bytes(b"stale-input")
    out_file.write_bytes(b"stale-partial")

    now = time.time()
    with session_factory() as session:
        session.add(
            VideoCompressionJob(
                id=stale_id,
                user_id="user-1",
                ip_address="198.51.100.10",
                original_filename="secret_clip.mp4",
                output_filename="secret_clip_compressed.mp4",
                preset="balanced",
                status="encoding",
                running_lock=1,
                progress_percent=42.0,
                input_path=str(in_file),
                output_path=str(out_file),
                input_size_bytes=11,
                created_at=now - 100,
                updated_at=now - 20,
            )
        )
        session.commit()

    count = video_worker.recover_stale_running_jobs(
        engine_override=engine, workspace_dir=ws_dir, now=now
    )
    assert count == 1
    assert not stale_dir.exists()

    with session_factory() as session:
        refreshed = session.get(VideoCompressionJob, stale_id)
        assert refreshed is not None
        assert refreshed.status == "failed"
        assert refreshed.running_lock is None
        assert refreshed.error_code == "WORKER_INTERRUPTED"
        assert refreshed.output_path is None

    raw_audit = json.dumps(_read_audit_events(worker_ctx["audit_dir"]))
    assert "secret_clip.mp4" not in raw_audit
    assert str(ws_dir) not in raw_audit


def test_worker_pass_success_updates_db_deletes_input_and_writes_heartbeat(
    worker_ctx: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = worker_ctx["engine"]
    session_factory = worker_ctx["session_factory"]
    ws_dir: Path = worker_ctx["workspace_dir"]

    job = _seed_queued_job(
        session_factory,
        ws_dir,
        filename="Rahasia_Client_2026.mp4",
        content=b"V" * 4000,
    )
    probe = VideoProbeInfo("mp4", "h264", 20.0, 3840, 2160, 60.0, True)

    monkeypatch.setattr("app.workers.video_worker.probe_video", lambda *a, **kw: probe)

    def _fake_compress(
        input_path: Path,
        output_path: Path,
        job_dir: Path,
        *,
        on_progress: Any = None,
        **kwargs: Any,
    ) -> VideoCompressionResult:
        if on_progress is not None:
            on_progress(55.0)
        output_path.write_bytes(b"O" * 1000)
        return VideoCompressionResult(
            output_path=output_path,
            output_size_bytes=1000,
            output_width=1920,
            output_height=1080,
            probe=probe,
        )

    monkeypatch.setattr("app.workers.video_worker.compress_video_file", _fake_compress)
    monkeypatch.setattr(
        "app.workers.video_worker.detect_ffmpeg_binaries",
        lambda: ("/usr/bin/ffmpeg", "/usr/bin/ffprobe"),
    )

    stats = video_worker.run_video_worker_pass(
        engine_override=engine,
        workspace_dir=ws_dir,
        scanner=MockClamAVScanner(),
    )
    assert stats["processed_job_id"] == job.id

    with session_factory() as session:
        done = session.get(VideoCompressionJob, job.id)
        assert done is not None
        assert done.status == "succeeded"
        assert done.running_lock is None
        assert done.progress_percent == 100.0
        assert done.input_path is None
        assert done.output_path == str(ws_dir / job.id / "output.mp4")
        assert done.output_size_bytes == 1000
        assert done.input_width == 3840
        assert done.input_height == 2160
        assert done.output_width == 1920
        assert done.output_height == 1080
        assert done.expires_at is not None
        assert abs(done.expires_at - (done.completed_at + 900.0)) < 1.0

        hb = session.get(RuntimeState, video_worker.HEARTBEAT_STATE_KEY)
        assert hb is not None
        assert hb.value["status"] == "idle"
        assert hb.value["ffmpeg_available"] is True
        assert hb.value["ffprobe_available"] is True
        assert "path" not in json.dumps(hb.value).lower()
        assert str(ws_dir) not in json.dumps(hb.value)

    assert not (ws_dir / job.id / "input.bin").exists()
    assert (ws_dir / job.id / "output.mp4").is_file()

    audit_dump = json.dumps(_read_audit_events(worker_ctx["audit_dir"]))
    assert "Rahasia_Client_2026" not in audit_dump
    assert str(ws_dir) not in audit_dump


def test_worker_malware_blocks_ffprobe_and_cleans_workspace(
    worker_ctx: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = worker_ctx["engine"]
    session_factory = worker_ctx["session_factory"]
    ws_dir: Path = worker_ctx["workspace_dir"]

    class _InfectedScanner:
        def ensure_fresh_signatures(self) -> float:
            return time.time()

        def scan_file(self, filepath: str) -> ScanResult:
            return ScanResult(
                is_clean=False,
                virus_name="Win.Test.Malware",
                raw_response="stream: Win.Test.Malware FOUND",
            )

    job = _seed_queued_job(
        session_factory,
        ws_dir,
        content=b"HEADER_MALWARE_PAYLOAD_TAIL",
    )

    probe_called = False

    def _fail_if_probed(*args: Any, **kwargs: Any) -> VideoProbeInfo:
        nonlocal probe_called
        probe_called = True
        raise AssertionError("ffprobe tidak boleh dipanggil untuk berkas terinfeksi")

    monkeypatch.setattr("app.workers.video_worker.probe_video", _fail_if_probed)

    processed = video_worker.process_next_video_job(
        engine_override=engine,
        workspace_dir=ws_dir,
        scanner=_InfectedScanner(),
    )
    assert processed == job.id
    assert probe_called is False
    assert not (ws_dir / job.id).exists()

    with session_factory() as session:
        failed = session.get(VideoCompressionJob, job.id)
        assert failed is not None
        assert failed.status == "failed"
        assert failed.running_lock is None
        assert failed.error_code == "MALWARE_DETECTED"


def test_worker_handles_output_not_smaller_and_cancel_mid_encode(
    worker_ctx: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = worker_ctx["engine"]
    session_factory = worker_ctx["session_factory"]
    ws_dir: Path = worker_ctx["workspace_dir"]

    probe = VideoProbeInfo("mp4", "h264", 10.0, 1280, 720, 30.0, True)
    monkeypatch.setattr("app.workers.video_worker.probe_video", lambda *a, **kw: probe)

    # 1. OUTPUT_NOT_SMALLER
    job1 = _seed_queued_job(session_factory, ws_dir, now=time.time() - 5000)

    def _not_smaller(*args: Any, **kwargs: Any) -> VideoCompressionResult:
        raise OutputNotSmallerError("OUTPUT_NOT_SMALLER", "Output lebih besar")

    monkeypatch.setattr("app.workers.video_worker.compress_video_file", _not_smaller)
    video_worker.process_next_video_job(
        engine_override=engine, workspace_dir=ws_dir, scanner=MockClamAVScanner()
    )
    assert not (ws_dir / job1.id).exists()
    with session_factory() as session:
        j1 = session.get(VideoCompressionJob, job1.id)
        assert j1 is not None
        assert j1.status == "failed"
        assert j1.running_lock is None
        assert j1.error_code == "OUTPUT_NOT_SMALLER"

    # 2. Pembatalan saat encoding berjalan
    job2 = _seed_queued_job(session_factory, ws_dir, now=time.time())

    def _cancel_during_encode(
        input_path: Path,
        output_path: Path,
        job_dir: Path,
        *,
        should_cancel: Any = None,
        **kwargs: Any,
    ) -> VideoCompressionResult:
        with session_factory() as s:
            row = s.get(VideoCompressionJob, job2.id)
            assert row is not None
            row.status = "cancelled"
            row.running_lock = None
            s.commit()
        assert should_cancel is not None and should_cancel() is True
        raise VideoCompressionCancelledError("CANCELLED", "Dibatalkan")

    monkeypatch.setattr("app.workers.video_worker.compress_video_file", _cancel_during_encode)
    video_worker.process_next_video_job(
        engine_override=engine, workspace_dir=ws_dir, scanner=MockClamAVScanner()
    )
    assert not (ws_dir / job2.id).exists()
    with session_factory() as session:
        j2 = session.get(VideoCompressionJob, job2.id)
        assert j2 is not None
        assert j2.status == "cancelled"
        assert j2.running_lock is None


def test_sweep_expires_ttl_cleans_claimed_orphans_and_retains_rate_limit_window(
    worker_ctx: dict[str, Any],
) -> None:
    engine = worker_ctx["engine"]
    session_factory = worker_ctx["session_factory"]
    ws_dir: Path = worker_ctx["workspace_dir"]

    now = 1_762_950_000.0

    # 1. Job succeeded kedaluwarsa (expires_at <= now)
    exp_id = str(uuid.uuid4())
    exp_dir = ws_dir / exp_id
    exp_dir.mkdir()
    (exp_dir / "output.mp4").write_bytes(b"expired")

    # 2. Job claimed baru (20s -> JANGAN dihapus) vs claimed lama (120s -> HAPUS)
    fresh_claimed_id = str(uuid.uuid4())
    fresh_dir = ws_dir / fresh_claimed_id
    fresh_dir.mkdir()
    (fresh_dir / "output.mp4").write_bytes(b"streaming")

    old_claimed_id = str(uuid.uuid4())
    old_dir = ws_dir / old_claimed_id
    old_dir.mkdir()
    (old_dir / "output.mp4").write_bytes(b"done-old")

    # 3. Job failed masih dalam jendela rate-limit 24 jam vs > 24 jam
    recent_failed_id = str(uuid.uuid4())
    ancient_failed_id = str(uuid.uuid4())

    # 4. Direktori yatim berumur > 60 detik
    orphan_dir = ws_dir / str(uuid.uuid4())
    orphan_dir.mkdir()
    (orphan_dir / "junk.bin").write_bytes(b"orphan")
    os.utime(orphan_dir, (now - 120, now - 120))

    with session_factory() as session:
        session.add_all(
            [
                VideoCompressionJob(
                    id=exp_id,
                    user_id="user-1",
                    ip_address="198.51.100.1",
                    original_filename="exp.mp4",
                    output_filename="exp_compressed.mp4",
                    preset="balanced",
                    status="succeeded",
                    running_lock=None,
                    output_path=str(exp_dir / "output.mp4"),
                    input_size_bytes=100,
                    output_size_bytes=50,
                    created_at=now - 1000,
                    updated_at=now - 950,
                    completed_at=now - 950,
                    expires_at=now - 10,
                ),
                VideoCompressionJob(
                    id=fresh_claimed_id,
                    user_id="user-1",
                    ip_address="198.51.100.1",
                    original_filename="fresh.mp4",
                    output_filename="fresh_compressed.mp4",
                    preset="balanced",
                    status="claimed",
                    running_lock=None,
                    output_path=str(fresh_dir / "output.mp4"),
                    input_size_bytes=100,
                    output_size_bytes=50,
                    created_at=now - 300,
                    updated_at=now - 20,
                    claimed_at=now - 20,
                ),
                VideoCompressionJob(
                    id=old_claimed_id,
                    user_id="user-1",
                    ip_address="198.51.100.1",
                    original_filename="old.mp4",
                    output_filename="old_compressed.mp4",
                    preset="balanced",
                    status="claimed",
                    running_lock=None,
                    output_path=str(old_dir / "output.mp4"),
                    input_size_bytes=100,
                    output_size_bytes=50,
                    created_at=now - 500,
                    updated_at=now - 120,
                    claimed_at=now - 120,
                ),
                VideoCompressionJob(
                    id=recent_failed_id,
                    user_id="user-1",
                    ip_address="198.51.100.1",
                    original_filename="recent.mp4",
                    output_filename="recent_compressed.mp4",
                    preset="balanced",
                    status="failed",
                    running_lock=None,
                    input_size_bytes=100,
                    created_at=now - 1800,
                    updated_at=now - 1800,
                ),
                VideoCompressionJob(
                    id=ancient_failed_id,
                    user_id="user-1",
                    ip_address="198.51.100.1",
                    original_filename="ancient.mp4",
                    output_filename="ancient_compressed.mp4",
                    preset="balanced",
                    status="failed",
                    running_lock=None,
                    input_size_bytes=100,
                    created_at=now - 90_000,
                    updated_at=now - 90_000,
                ),
            ]
        )
        session.commit()

    stats = video_worker.sweep_expired_and_terminal_jobs(
        engine_override=engine,
        workspace_dir=ws_dir,
        now=now,
    )
    assert stats["expired"] == 1
    assert stats["claimed_cleaned"] == 1
    assert stats["orphan_dirs_removed"] == 1
    assert stats["purged_rows"] == 1

    assert not exp_dir.exists()
    assert fresh_dir.exists()
    assert not old_dir.exists()
    assert not orphan_dir.exists()

    with session_factory() as session:
        exp_row = session.get(VideoCompressionJob, exp_id)
        assert exp_row is not None
        assert exp_row.status == "expired"
        assert exp_row.output_path is None

        # Baris < 24 jam tetap dipertahankan untuk histori rate-limit, baris > 24 jam dihapus
        assert session.get(VideoCompressionJob, recent_failed_id) is not None
        assert session.get(VideoCompressionJob, ancient_failed_id) is None

        remaining_ids = set(session.execute(select(VideoCompressionJob.id)).scalars().all())
        assert ancient_failed_id not in remaining_ids


def test_process_next_video_job_extract_audio_success(
    worker_ctx: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = worker_ctx["engine"]
    session_factory = worker_ctx["session_factory"]
    ws_dir: Path = worker_ctx["workspace_dir"]
    audit_dir: Path = worker_ctx["audit_dir"]

    job = _seed_queued_job(
        session_factory,
        ws_dir,
        filename="podcast.mp4",
        job_type="extract_audio",
        preset="192k",
        content=b"M" * 4096,
    )

    probe = AudioProbeInfo(
        container_format="mp4",
        audio_codec="aac",
        duration_sec=90.0,
        channels=2,
        target_channels=2,
        sample_rate=44100,
        selected_stream_index=0,
    )

    def _mock_probe_audio(in_path: Path, j_dir: Path, **kw: Any) -> AudioProbeInfo:
        assert in_path.is_file()
        assert j_dir.name == job.id
        return probe

    def _mock_extract_audio(
        in_path: Path,
        out_path: Path,
        j_dir: Path,
        *,
        preset: str = "192k",
        probe: AudioProbeInfo,
        on_progress: Any = None,
        **kw: Any,
    ) -> AudioExtractionResult:
        assert preset == "192k"
        if on_progress:
            on_progress(50.0)
            on_progress(95.0)
        out_path.write_bytes(b"MP3_EXTRACTED_BYTES")
        return AudioExtractionResult(
            output_path=out_path,
            output_size_bytes=len(b"MP3_EXTRACTED_BYTES"),
            probe=probe,
        )

    monkeypatch.setattr("app.workers.video_worker.probe_audio_extraction", _mock_probe_audio)
    monkeypatch.setattr("app.workers.video_worker.extract_audio_file", _mock_extract_audio)

    processed = video_worker.process_next_video_job(
        engine_override=engine,
        workspace_dir=ws_dir,
        scanner=MockClamAVScanner(),
    )
    assert processed == job.id

    with session_factory() as session:
        completed = session.get(VideoCompressionJob, job.id)
        assert completed is not None
        assert completed.status == "succeeded"
        assert completed.job_type == "extract_audio"
        assert completed.preset == "192k"
        assert completed.running_lock is None
        assert completed.progress_percent == 100.0
        assert completed.input_path is None
        assert completed.output_path is not None
        assert completed.output_path.endswith("output.mp3")
        assert completed.output_size_bytes == len(b"MP3_EXTRACTED_BYTES")
        assert completed.output_width is None
        assert completed.output_height is None
        assert completed.completed_at is not None
        expected_ttl = settings.VIDEO_COMPRESSION_FILE_TTL_SECONDS
        assert completed.expires_at == completed.completed_at + expected_ttl

    # Verifikasi berkas input langsung dihapus dan berkas output ada
    assert not (ws_dir / job.id / "input.bin").exists()
    assert (ws_dir / job.id / "output.mp3").is_file()

    # Verifikasi audit event
    events = _read_audit_events(audit_dir)
    success_events = [
        e for e in events if e.get("outcome") == "succeeded" and e.get("job_id") == job.id
    ]
    assert len(success_events) == 1
    assert success_events[0]["job_type"] == "extract_audio"
    assert success_events[0]["preset"] == "192k"


def test_process_next_video_job_extract_audio_no_audio_stream_fail_closed(
    worker_ctx: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = worker_ctx["engine"]
    session_factory = worker_ctx["session_factory"]
    ws_dir: Path = worker_ctx["workspace_dir"]
    audit_dir: Path = worker_ctx["audit_dir"]

    job = _seed_queued_job(
        session_factory,
        ws_dir,
        filename="silent.mp4",
        job_type="extract_audio",
        preset="192k",
        content=b"M" * 2048,
    )

    def _mock_no_audio(*args: Any, **kwargs: Any) -> AudioProbeInfo:
        raise VideoProbeError(
            "NO_AUDIO_STREAM",
            "Berkas MP4 tidak mengandung aliran audio untuk diekstrak.",
        )

    monkeypatch.setattr("app.workers.video_worker.probe_audio_extraction", _mock_no_audio)

    processed = video_worker.process_next_video_job(
        engine_override=engine,
        workspace_dir=ws_dir,
        scanner=MockClamAVScanner(),
    )
    assert processed == job.id

    with session_factory() as session:
        failed = session.get(VideoCompressionJob, job.id)
        assert failed is not None
        assert failed.status == "failed"
        assert failed.job_type == "extract_audio"
        assert failed.running_lock is None
        assert failed.error_code == "NO_AUDIO_STREAM"
        assert failed.error_message == "Berkas MP4 tidak mengandung aliran audio untuk diekstrak."

    # Workspace dibersihkan sepenuhnya saat gagal
    assert not (ws_dir / job.id).exists()

    # Verifikasi audit event
    events = _read_audit_events(audit_dir)
    fail_events = [e for e in events if e.get("outcome") == "failed" and e.get("job_id") == job.id]
    assert len(fail_events) == 1
    assert fail_events[0]["job_type"] == "extract_audio"
    assert fail_events[0]["error_code"] == "NO_AUDIO_STREAM"
