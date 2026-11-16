"""Unit & migration tests untuk skema dan repository Compress Video (VC-01)."""

from __future__ import annotations

import sys
import time
import uuid
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from alembic import command
from app.db.models import User, VideoCompressionJob
from app.db.postgres import Base
from app.db.repositories.video_compression_repository import (
    ActiveJobExistsError,
    InvalidJobStateError,
    JobNotFoundError,
    QueueFullError,
    RateLimitExceededError,
    VideoCompressionRepository,
    WorkspaceFullError,
    sanitize_video_filenames,
)

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture
def db_ctx(tmp_path: Path):
    db_file = tmp_path / f"test_video_db_{uuid.uuid4().hex}.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session: Session = session_factory()

    now = time.time()
    users = [
        User(
            id=f"user-{i}",
            email=f"user{i}@example.com",
            name=f"User {i}",
            email_verified=1,
            created_at=now,
            updated_at=now,
        )
        for i in range(1, 6)
    ]
    session.add_all(users)
    session.commit()

    workspace_dir = tmp_path / "video_ws"
    workspace_dir.mkdir(parents=True, exist_ok=True)

    try:
        yield session, workspace_dir
    finally:
        session.close()
        engine.dispose()


def test_alembic_004_video_compression_lifecycle(tmp_path: Path) -> None:
    test_db = tmp_path / "alembic_004.db"
    test_url = f"sqlite:///{test_db.as_posix()}"
    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", test_url)

    engine = create_engine(test_url)
    command.upgrade(alembic_cfg, "head")

    inspector = inspect(engine)
    assert "video_compression_jobs" in inspector.get_table_names()
    cols = {c["name"] for c in inspector.get_columns("video_compression_jobs")}
    assert {
        "id",
        "user_id",
        "ip_address",
        "original_filename",
        "output_filename",
        "job_type",
        "preset",
        "status",
        "running_lock",
        "progress_percent",
        "input_path",
        "output_path",
        "input_size_bytes",
        "output_size_bytes",
        "created_at",
        "expires_at",
        "claimed_at",
    }.issubset(cols)

    indexes = {idx["name"] for idx in inspector.get_indexes("video_compression_jobs")}
    assert "uq_video_jobs_active_per_user" in indexes
    assert "uq_video_jobs_global_running" in indexes

    command.downgrade(alembic_cfg, "005_mp4_to_mp3")
    command.downgrade(alembic_cfg, "004_video_compression")
    inspector_004 = inspect(engine)
    cols_004 = {c["name"] for c in inspector_004.get_columns("video_compression_jobs")}
    assert "job_type" not in cols_004
    assert "id" in cols_004

    command.downgrade(alembic_cfg, "003_file_shelf")
    inspector_mid = inspect(engine)
    assert "video_compression_jobs" not in inspector_mid.get_table_names()
    assert "file_shelf_items" in inspector_mid.get_table_names()

    command.downgrade(alembic_cfg, "base")
    engine.dispose()


def test_sanitize_video_filenames_and_extensions() -> None:
    clean_in, out_name = sanitize_video_filenames("../../liburan keluarga/clip.01.MOV")
    assert clean_in == "clip.01.MOV"
    assert out_name == "clip_01_compressed.mp4"

    with pytest.raises(ValueError):
        sanitize_video_filenames("notes.txt")
    with pytest.raises(ValueError):
        sanitize_video_filenames(".mp4")
    with pytest.raises(ValueError):
        sanitize_video_filenames("")


def test_db_check_constraints_and_partial_unique_indexes(db_ctx) -> None:
    session, _ = db_ctx
    now = time.time()

    # 1. Invalid running_lock pada status queued -> CheckConstraint error
    bad_lock = VideoCompressionJob(
        id=str(uuid.uuid4()),
        user_id="user-1",
        ip_address="198.51.100.1",
        original_filename="a.mp4",
        output_filename="a_compressed.mp4",
        preset="balanced",
        status="queued",
        running_lock=1,
        created_at=now,
        updated_at=now,
    )
    session.add(bad_lock)
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()

    # 2. Invalid preset -> CheckConstraint error
    bad_preset = VideoCompressionJob(
        id=str(uuid.uuid4()),
        user_id="user-1",
        ip_address="198.51.100.1",
        original_filename="a.mp4",
        output_filename="a_compressed.mp4",
        preset="ultra",
        status="queued",
        running_lock=None,
        created_at=now,
        updated_at=now,
    )
    session.add(bad_preset)
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()

    # 2b. Invalid job_type -> CheckConstraint error
    bad_job_type = VideoCompressionJob(
        id=str(uuid.uuid4()),
        user_id="user-1",
        ip_address="198.51.100.1",
        original_filename="a.mp4",
        output_filename="a_audio.mp3",
        job_type="invalid_type",
        preset="192k",
        status="queued",
        running_lock=None,
        created_at=now,
        updated_at=now,
    )
    session.add(bad_job_type)
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()

    # 2c. Valid extract_audio with valid MP3 preset -> success
    valid_audio_job = VideoCompressionJob(
        id=str(uuid.uuid4()),
        user_id="user-1",
        ip_address="198.51.100.1",
        original_filename="a.mp4",
        output_filename="a_audio.mp3",
        job_type="extract_audio",
        preset="192k",
        status="queued",
        running_lock=None,
        created_at=now,
        updated_at=now,
    )
    session.add(valid_audio_job)
    session.flush()
    session.delete(valid_audio_job)
    session.flush()

    # 3. Partial unique index: hanya 1 running_lock = 1 secara global
    j1 = VideoCompressionJob(
        id=str(uuid.uuid4()),
        user_id="user-1",
        ip_address="198.51.100.1",
        original_filename="a.mp4",
        output_filename="a_compressed.mp4",
        preset="balanced",
        status="encoding",
        running_lock=1,
        created_at=now,
        updated_at=now,
    )
    j2 = VideoCompressionJob(
        id=str(uuid.uuid4()),
        user_id="user-2",
        ip_address="198.51.100.2",
        original_filename="b.mp4",
        output_filename="b_compressed.mp4",
        preset="balanced",
        status="scanning",
        running_lock=1,
        created_at=now,
        updated_at=now,
    )
    session.add(j1)
    session.flush()
    session.add(j2)
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()

    # 4. Partial unique index: hanya 1 active job per user
    u1_a = VideoCompressionJob(
        id=str(uuid.uuid4()),
        user_id="user-1",
        ip_address="198.51.100.1",
        original_filename="a.mp4",
        output_filename="a_compressed.mp4",
        preset="balanced",
        status="queued",
        running_lock=None,
        created_at=now,
        updated_at=now,
    )
    u1_b = VideoCompressionJob(
        id=str(uuid.uuid4()),
        user_id="user-1",
        ip_address="198.51.100.1",
        original_filename="b.mp4",
        output_filename="b_compressed.mp4",
        preset="balanced",
        status="uploading",
        running_lock=None,
        created_at=now,
        updated_at=now,
    )
    session.add(u1_a)
    session.flush()
    session.add(u1_b)
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()


def test_repository_reserve_active_rate_limit_queue_and_workspace(db_ctx) -> None:
    session, workspace_dir = db_ctx
    repo = VideoCompressionRepository(session)
    base_ts = 1_700_000_000.0

    # Reserve -> finalize
    job1 = repo.reserve_upload_job(
        user_id="user-1",
        ip_address="203.0.113.10",
        original_filename="clip1.mp4",
        output_filename="clip1_compressed.mp4",
        preset="balanced",
        workspace_dir=workspace_dir,
        now=base_ts,
    )
    assert job1.status == "uploading"

    # Active job conflict per user
    with pytest.raises(ActiveJobExistsError):
        repo.reserve_upload_job(
            user_id="user-1",
            ip_address="203.0.113.10",
            original_filename="clip2.mp4",
            output_filename="clip2_compressed.mp4",
            workspace_dir=workspace_dir,
            now=base_ts + 1,
        )

    repo.finalize_upload_queued(job1.id, 10_000, now=base_ts + 2)
    job1.status = "failed"
    session.flush()

    # 2 more jobs for user-1 (different IPs) -> reaches 3/hour user limit
    for idx in (2, 3):
        j = repo.reserve_upload_job(
            user_id="user-1",
            ip_address=f"203.0.113.{10 + idx}",
            original_filename=f"clip{idx}.mp4",
            output_filename=f"clip{idx}_compressed.mp4",
            workspace_dir=workspace_dir,
            now=base_ts + 10 * idx,
        )
        repo.finalize_upload_queued(j.id, 10_000, now=base_ts + 10 * idx + 1)
        j.status = "failed"
        session.flush()

    with pytest.raises(RateLimitExceededError) as exc_user:
        repo.reserve_upload_job(
            user_id="user-1",
            ip_address="203.0.113.99",
            original_filename="clip4.mp4",
            output_filename="clip4_compressed.mp4",
            workspace_dir=workspace_dir,
            now=base_ts + 100,
        )
    assert exc_user.value.retry_after >= 1

    # Rate limit per IP across different users (203.0.113.55 x 3 -> 4th blocked)
    for uid, offset in (("user-2", 1), ("user-3", 2), ("user-4", 3)):
        j = repo.reserve_upload_job(
            user_id=uid,
            ip_address="203.0.113.55",
            original_filename="shared_ip.mp4",
            output_filename="shared_ip_compressed.mp4",
            workspace_dir=workspace_dir,
            now=base_ts + 200 + offset,
        )
        repo.finalize_upload_queued(j.id, 5_000, now=base_ts + 200 + offset)
        j.status = "expired"
        session.flush()

    with pytest.raises(RateLimitExceededError):
        repo.reserve_upload_job(
            user_id="user-5",
            ip_address="203.0.113.55",
            original_filename="shared_ip4.mp4",
            output_filename="shared_ip4_compressed.mp4",
            workspace_dir=workspace_dir,
            now=base_ts + 250,
        )

    # Global queue limit: 1 running + 2 waiting = 3 active across different users & IPs
    for idx, uid in enumerate(("user-2", "user-3", "user-4"), start=1):
        j = repo.reserve_upload_job(
            user_id=uid,
            ip_address=f"198.51.100.{idx}",
            original_filename=f"q{idx}.mp4",
            output_filename=f"q{idx}_compressed.mp4",
            workspace_dir=workspace_dir,
            now=base_ts + 500 + idx,
        )
        repo.finalize_upload_queued(j.id, 5_000, now=base_ts + 500 + idx)
    session.flush()

    with pytest.raises(QueueFullError) as exc_q:
        repo.reserve_upload_job(
            user_id="user-5",
            ip_address="198.51.100.4",
            original_filename="q4.mp4",
            output_filename="q4_compressed.mp4",
            workspace_dir=workspace_dir,
            now=base_ts + 510,
        )
    assert exc_q.value.retry_after == 30

    # Workspace cap guard
    dummy_file = workspace_dir / "existing.bin"
    dummy_file.write_bytes(b"x" * 1024)
    # Mark one job expired to free queue slot, keep disk full against cap 1024
    first_queued = session.execute(
        select(VideoCompressionJob).where(
            VideoCompressionJob.user_id == "user-4",
            VideoCompressionJob.status == "queued",
        )
    ).scalar_one()
    first_queued.status = "expired"
    session.flush()

    with pytest.raises(WorkspaceFullError):
        repo.reserve_upload_job(
            user_id="user-5",
            ip_address="198.51.100.5",
            original_filename="ws_full.mp4",
            output_filename="ws_full_compressed.mp4",
            workspace_dir=workspace_dir,
            max_workspace_bytes=1024,
            now=base_ts + 520,
        )


def test_repository_claim_queue_for_update_and_atomic_download_claim(db_ctx) -> None:
    session, workspace_dir = db_ctx
    repo = VideoCompressionRepository(session)
    now = 1_700_001_000.0

    # Verify PostgreSQL dialect compiles FOR UPDATE SKIP LOCKED
    pg_sql = str(
        select(VideoCompressionJob)
        .where(VideoCompressionJob.status == "queued")
        .order_by(VideoCompressionJob.created_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True)
        .compile(dialect=postgresql.dialect())
    )
    assert "FOR UPDATE SKIP LOCKED" in pg_sql

    j1 = repo.reserve_upload_job(
        user_id="user-1",
        ip_address="198.51.100.11",
        original_filename="first.mp4",
        output_filename="first_compressed.mp4",
        workspace_dir=workspace_dir,
        now=now,
    )
    repo.finalize_upload_queued(j1.id, 1000, now=now + 1)

    j2 = repo.reserve_upload_job(
        user_id="user-2",
        ip_address="198.51.100.12",
        original_filename="second.mp4",
        output_filename="second_compressed.mp4",
        workspace_dir=workspace_dir,
        now=now + 2,
    )
    repo.finalize_upload_queued(j2.id, 1000, now=now + 3)

    # Worker claims oldest job first -> j1 becomes scanning with running_lock = 1
    claimed = repo.claim_next_queued_job(now=now + 5)
    assert claimed is not None
    assert claimed.id == j1.id
    assert claimed.status == "scanning"
    assert claimed.running_lock == 1

    # Second claim while j1 is still running returns None
    assert repo.claim_next_queued_job(now=now + 6) is None

    # Finish j1 -> succeeded with TTL 900s
    claimed.status = "succeeded"
    claimed.running_lock = None
    claimed.completed_at = now + 20
    claimed.expires_at = now + 920
    session.flush()

    # Cross-user download claim blocked (anti-BOLA)
    with pytest.raises(JobNotFoundError):
        repo.claim_succeeded_job_for_download(j1.id, "user-2", now=now + 30)

    # First owner download claim succeeds atomically (`succeeded -> claimed`)
    dl_job = repo.claim_succeeded_job_for_download(j1.id, "user-1", now=now + 30)
    assert dl_job.status == "claimed"
    assert dl_job.claimed_at == now + 30

    # Second download claim rejected (single-use)
    with pytest.raises(InvalidJobStateError):
        repo.claim_succeeded_job_for_download(j1.id, "user-1", now=now + 31)

    # Expired job claim rejected
    j2.status = "succeeded"
    j2.running_lock = None
    j2.expires_at = now + 50
    session.flush()
    with pytest.raises(InvalidJobStateError):
        repo.claim_succeeded_job_for_download(j2.id, "user-2", now=now + 51)


def test_discard_uploading_job_cleans_row(db_ctx) -> None:
    session, workspace_dir = db_ctx
    repo = VideoCompressionRepository(session)
    job = repo.reserve_upload_job(
        user_id="user-1",
        ip_address="198.51.100.33",
        original_filename="drop.webm",
        output_filename="drop_compressed.mp4",
        workspace_dir=workspace_dir,
    )
    repo.discard_uploading_job(job.id)
    assert repo.get_job_for_user(job.id, "user-1") is None


def test_repository_reserve_upload_job_extract_audio(db_ctx) -> None:
    session, workspace_dir = db_ctx
    repo = VideoCompressionRepository(session)

    # 1. Success reserve extract_audio job
    job = repo.reserve_upload_job(
        user_id="user-1",
        ip_address="198.51.100.40",
        original_filename="song.mp4",
        output_filename="song_audio.mp3",
        job_type="extract_audio",
        preset="192k",
        workspace_dir=workspace_dir,
    )
    assert job.job_type == "extract_audio"
    assert job.preset == "192k"
    assert job.status == "uploading"
    repo.discard_uploading_job(job.id)

    # 2. Invalid preset for extract_audio (e.g. video preset "balanced")
    with pytest.raises(ValueError, match="Preset audio tidak valid"):
        repo.reserve_upload_job(
            user_id="user-1",
            ip_address="198.51.100.40",
            original_filename="song.mp4",
            output_filename="song_audio.mp3",
            job_type="extract_audio",
            preset="balanced",
            workspace_dir=workspace_dir,
        )

    # 3. Invalid preset for compress (e.g. audio preset "192k")
    with pytest.raises(ValueError, match="Preset kompresi tidak valid"):
        repo.reserve_upload_job(
            user_id="user-1",
            ip_address="198.51.100.40",
            original_filename="song.mp4",
            output_filename="song_compressed.mp4",
            job_type="compress",
            preset="192k",
            workspace_dir=workspace_dir,
        )

    # 4. Invalid job_type
    with pytest.raises(ValueError, match="Tipe tugas 'invalid_type' tidak valid"):
        repo.reserve_upload_job(
            user_id="user-1",
            ip_address="198.51.100.40",
            original_filename="song.mp4",
            output_filename="song_audio.mp3",
            job_type="invalid_type",
            preset="192k",
            workspace_dir=workspace_dir,
        )


def test_repository_reserve_upload_job_transcribe(db_ctx) -> None:
    session, workspace_dir = db_ctx
    repo = VideoCompressionRepository(session)

    # 1. Success reserve transcribe job with valid presets auto, id, en
    for pr in ("auto", "id", "en"):
        job = repo.reserve_upload_job(
            user_id="user-1",
            ip_address="198.51.100.50",
            original_filename="meeting.mp4",
            output_filename="meeting_transcript.zip",
            job_type="transcribe",
            preset=pr,
            workspace_dir=workspace_dir,
        )
        assert job.job_type == "transcribe"
        assert job.preset == pr
        assert job.status == "uploading"
        repo.discard_uploading_job(job.id)

    # 2. Invalid preset for transcribe (e.g. video preset "balanced" or audio "192k")
    with pytest.raises(ValueError, match="Preset transkripsi tidak valid"):
        repo.reserve_upload_job(
            user_id="user-1",
            ip_address="198.51.100.50",
            original_filename="meeting.mp4",
            output_filename="meeting_transcript.zip",
            job_type="transcribe",
            preset="balanced",
            workspace_dir=workspace_dir,
        )

    with pytest.raises(ValueError, match="Preset transkripsi tidak valid"):
        repo.reserve_upload_job(
            user_id="user-1",
            ip_address="198.51.100.50",
            original_filename="meeting.mp4",
            output_filename="meeting_transcript.zip",
            job_type="transcribe",
            preset="192k",
            workspace_dir=workspace_dir,
        )

