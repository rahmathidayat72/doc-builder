"""Integration & lifecycle tests untuk worker transkripsi video ke teks (CR-023 / FR-061).

Memvalidasi:
- Siklus hidup antrean queued -> scanning -> probing -> encoding -> succeeded untuk job transkripsi
- Pembuatan paket unduhan ZIP (persis 3 berkas) dan preview.json di direktori workspace
- Penanganan penolakan audio-less (NO_AUDIO_STREAM) -> failed
- Penanganan audio hening / tanpa ucapan (NO_SPEECH) -> failed
"""

from __future__ import annotations

import json
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core import audit
from app.core.config import settings
from app.db.models import User, VideoCompressionJob
from app.db.postgres import Base
from app.db.repositories.video_compression_repository import VideoCompressionRepository
from app.services.file_scanner import MockClamAVScanner
from app.services.video_compressor import AudioProbeInfo, VideoProbeError
from app.workers import video_worker


class MockWorkerWhisperModel:
    def __init__(
        self,
        text: str = "Transkripsi worker berhasil.",
        language: str = "id",
        duration: float = 30.0,
        empty: bool = False,
    ) -> None:
        self.text = text
        self.language = language
        self.duration = duration
        self.empty = empty

    def transcribe(
        self,
        audio_path: str,
        language: str | None = None,
        vad_filter: bool = True,
        beam_size: int = 5,
    ) -> tuple[Any, Any]:
        if self.empty:
            info_obj = type(
                "Info",
                (),
                {"language": language or "id", "duration": self.duration},
            )()
            return iter([]), info_obj

        seg = type(
            "Seg",
            (),
            {"start": 0.0, "end": 2.5, "text": self.text},
        )()
        info = type(
            "Info",
            (),
            {"language": language or self.language, "duration": self.duration},
        )()
        return iter([seg]), info


@pytest.fixture
def worker_ctx(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_file = tmp_path / f"transcribe_worker_{uuid.uuid4().hex}.db"
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
                id="user-transcribe",
                email="transcribe_worker@example.com",
                name="Transcribe User",
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


def _seed_transcribe_job(
    session_factory: sessionmaker,
    ws_dir: Path,
    *,
    user_id: str = "user-transcribe",
    filename: str = "meeting.mp4",
    preset: str = "auto",
    content: bytes = b"MOCK_MP4_CONTENT",
    now: float | None = None,
) -> VideoCompressionJob:
    ts = time.time() if now is None else now
    stem = Path(filename).stem
    out_name = f"{stem}_transcript.zip"
    with session_factory() as session:
        repo = VideoCompressionRepository(session)
        job = repo.reserve_upload_job(
            user_id=user_id,
            ip_address="198.51.100.25",
            original_filename=filename,
            output_filename=out_name,
            job_type="transcribe",
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


def test_worker_transcribe_job_success(worker_ctx, monkeypatch: pytest.MonkeyPatch) -> None:
    session_factory = worker_ctx["session_factory"]
    ws_dir = worker_ctx["workspace_dir"]
    engine = worker_ctx["engine"]

    job = _seed_transcribe_job(
        session_factory,
        ws_dir,
        filename="wawancara.mp4",
        preset="id",
    )

    probe = AudioProbeInfo(
        container_format="mov,mp4,m4a,3gp,3g2,mj2",
        audio_codec="aac",
        duration_sec=25.0,
        channels=2,
        target_channels=1,
        sample_rate=44100,
        selected_stream_index=0,
    )

    monkeypatch.setattr(
        video_worker,
        "probe_audio_extraction",
        lambda *args, **kwargs: probe,
    )
    monkeypatch.setattr(
        "app.services.transcription_service.extract_transcription_wav",
        lambda in_path, out_path, *a, **kw: out_path.write_bytes(b"RIFF mock wav"),
    )

    mock_model = MockWorkerWhisperModel(text="Halo ini wawancara resmi.", language="id")

    res = video_worker.run_video_worker_pass(
        engine_override=engine,
        workspace_dir=ws_dir,
        scanner=MockClamAVScanner(),
        transcription_model=mock_model,
    )

    assert res["processed_job_id"] == job.id

    with session_factory() as session:
        db_job = session.get(VideoCompressionJob, job.id)
        assert db_job is not None
        assert db_job.status == "succeeded"
        assert db_job.running_lock is None
        assert db_job.progress_percent == 100.0
        assert db_job.output_path is not None
        assert db_job.output_size_bytes is not None and db_job.output_size_bytes > 0
        assert db_job.input_duration_sec == 25.0

        out_zip = Path(db_job.output_path)
        assert out_zip.is_file()

        # Workspace must have preview.json
        job_dir = ws_dir / job.id
        preview_file = job_dir / "preview.json"
        assert preview_file.is_file()
        preview_data = json.loads(preview_file.read_text(encoding="utf-8"))
        assert preview_data["language"] == "id"
        assert preview_data["full_text"] == "Halo ini wawancara resmi."

        # Output ZIP contains exactly 3 files
        with zipfile.ZipFile(out_zip, "r") as zf:
            assert set(zf.namelist()) == {
                "wawancara_transcript.txt",
                "wawancara_transcript.srt",
                "wawancara_transcript.docx",
            }


def test_worker_transcribe_job_no_audio_stream(worker_ctx, monkeypatch: pytest.MonkeyPatch) -> None:
    session_factory = worker_ctx["session_factory"]
    ws_dir = worker_ctx["workspace_dir"]
    engine = worker_ctx["engine"]

    job = _seed_transcribe_job(session_factory, ws_dir, filename="silent_movie.mp4")

    def _raise_no_audio(*args, **kwargs):
        raise VideoProbeError(
            "NO_AUDIO_STREAM",
            "Berkas MP4 tidak mengandung aliran audio untuk diekstrak.",
        )

    monkeypatch.setattr(video_worker, "probe_audio_extraction", _raise_no_audio)

    res = video_worker.run_video_worker_pass(
        engine_override=engine,
        workspace_dir=ws_dir,
        scanner=MockClamAVScanner(),
    )

    assert res["processed_job_id"] == job.id

    with session_factory() as session:
        db_job = session.get(VideoCompressionJob, job.id)
        assert db_job is not None
        assert db_job.status == "failed"
        assert db_job.error_code == "NO_AUDIO_STREAM"
        assert db_job.running_lock is None
        assert db_job.output_path is None

    # Workspace directory must be cleaned up on failure
    job_dir = ws_dir / job.id
    assert not job_dir.exists()


def test_worker_transcribe_job_no_speech(worker_ctx, monkeypatch: pytest.MonkeyPatch) -> None:
    session_factory = worker_ctx["session_factory"]
    ws_dir = worker_ctx["workspace_dir"]
    engine = worker_ctx["engine"]

    job = _seed_transcribe_job(session_factory, ws_dir, filename="music_only.mp4")

    probe = AudioProbeInfo(
        container_format="mov,mp4,m4a,3gp,3g2,mj2",
        audio_codec="aac",
        duration_sec=15.0,
        channels=2,
        target_channels=1,
        sample_rate=44100,
        selected_stream_index=0,
    )

    monkeypatch.setattr(
        video_worker,
        "probe_audio_extraction",
        lambda *args, **kwargs: probe,
    )
    monkeypatch.setattr(
        "app.services.transcription_service.extract_transcription_wav",
        lambda in_path, out_path, *a, **kw: out_path.write_bytes(b"RIFF mock wav"),
    )

    # Empty segments model simulates audio without speech
    empty_model = MockWorkerWhisperModel(empty=True)

    res = video_worker.run_video_worker_pass(
        engine_override=engine,
        workspace_dir=ws_dir,
        scanner=MockClamAVScanner(),
        transcription_model=empty_model,
    )

    assert res["processed_job_id"] == job.id

    with session_factory() as session:
        db_job = session.get(VideoCompressionJob, job.id)
        assert db_job is not None
        assert db_job.status == "failed"
        assert db_job.error_code == "NO_SPEECH"
        assert "Tidak ada ucapan" in (db_job.error_message or "")
        assert db_job.running_lock is None

    # Workspace directory must be cleaned up on failure
    job_dir = ws_dir / job.id
    assert not job_dir.exists()
