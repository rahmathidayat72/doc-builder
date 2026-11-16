from __future__ import annotations

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.db.postgres import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    avatar_url = Column(Text, nullable=True)
    email_verified = Column(Integer, nullable=False, default=0)
    created_at = Column(Float, nullable=False)
    updated_at = Column(Float, nullable=False)


class OAuthTransaction(Base):
    __tablename__ = "oauth_transactions"

    state_hash = Column(String(128), primary_key=True)
    provider = Column(String(50), nullable=False, default="google")
    intent = Column(String(20), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    browser_binding_hash = Column(String(128), nullable=False)
    code_verifier = Column(String(128), nullable=False)
    nonce = Column(String(128), nullable=False)
    created_at = Column(Float, nullable=False)
    expires_at = Column(Float, nullable=False, index=True)
    used_at = Column(Float, nullable=True)

    __table_args__ = (
        CheckConstraint("intent IN ('login', 'link')", name="chk_oauth_tx_intent"),
        Index("idx_oauth_tx_expires", "expires_at"),
    )


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)
    provider_user_id = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    created_at = Column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_uid"),
        UniqueConstraint("user_id", "provider", name="uq_oauth_user_provider"),
        Index("idx_oauth_accounts_user_id", "user_id"),
        Index("idx_oauth_accounts_provider_uid", "provider", "provider_user_id"),
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    token_hash = Column(String(128), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    csrf_token = Column(String(128), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(Float, nullable=False)
    expires_at = Column(Float, nullable=False, index=True)

    __table_args__ = (
        Index("idx_user_sessions_user_id", "user_id"),
    )


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    token_hash = Column(String(128), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_type = Column(String(50), nullable=False)
    created_at = Column(Float, nullable=False)
    expires_at = Column(Float, nullable=False)
    used_at = Column(Float, nullable=True)

    __table_args__ = (
        Index("idx_auth_tokens_user_type", "user_id", "token_type"),
    )


class ShortUrl(Base):
    __tablename__ = "short_urls"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    destination_url = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="active")
    click_count = Column(BigInteger, nullable=False, default=0)
    created_at = Column(Float, nullable=False)
    revoked_at = Column(Float, nullable=True)
    last_accessed_at = Column(Float, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'revoked', 'tombstone')",
            name="chk_short_urls_status",
        ),
    )


class MediaDownloadJob(Base):
    __tablename__ = "media_download_jobs"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ip_address = Column(String(45), nullable=True)
    url = Column(Text, nullable=False)
    platform = Column(String(50), nullable=False)
    media_type = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, index=True)
    progress_percent = Column(Float, default=0.0)
    file_path = Column(Text, nullable=True)
    filename = Column(String(255), nullable=True)
    file_size_bytes = Column(BigInteger, default=0)
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)
    reserved_bytes = Column(BigInteger, default=0)
    actual_bytes = Column(BigInteger, default=0)
    created_at = Column(Float, nullable=False)
    started_at = Column(Float, nullable=True)
    completed_at = Column(Float, nullable=True)
    expires_at = Column(Float, nullable=True, index=True)

    __table_args__ = (
        Index("idx_media_jobs_user_status", "user_id", "status"),
    )


class MediaDownloadUsage(Base):
    __tablename__ = "media_download_usage"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False)
    ip_address = Column(String(45), nullable=False)
    job_id = Column(String(36), nullable=False)
    bytes_used = Column(BigInteger, nullable=False)
    timestamp = Column(Float, nullable=False)

    __table_args__ = (
        Index("idx_media_usage_user_time", "user_id", "timestamp"),
        Index("idx_media_usage_ip_time", "ip_address", "timestamp"),
    )


class ResumeDraft(Base):
    __tablename__ = "resume_drafts"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(140), nullable=False, default="CV Tanpa Judul")
    payload = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    favorite = Column(Boolean, nullable=False, default=False)
    target_job_title = Column(String(140), nullable=True)
    size_bytes = Column(Integer, nullable=False, default=0)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(Float, nullable=False)
    updated_at = Column(Float, nullable=False)
    expires_at = Column(Float, nullable=False, index=True)
    deleted_at = Column(Float, nullable=True, index=True)

    __table_args__ = (
        Index("idx_resume_drafts_user_updated", "user_id", "updated_at"),
        Index("idx_resume_drafts_user_deleted", "user_id", "deleted_at"),
        Index("idx_resume_drafts_expires", "expires_at"),
        Index("idx_resume_drafts_deleted", "deleted_at"),
    )


class FileShelfItem(Base):
    __tablename__ = "file_shelf_items"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    status = Column(String(20), nullable=False, default="CHECKING")
    sha256_hash = Column(String(64), nullable=True)
    r2_object_key = Column(String(255), nullable=True)
    r2_key_id = Column(String(64), nullable=True)
    r2_etag = Column(String(64), nullable=True)
    quarantine_path = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    has_exif_warning = Column(Boolean, nullable=False, default=False)
    uploaded_at = Column(Float, nullable=False)
    available_at = Column(Float, nullable=True)
    expires_at = Column(Float, nullable=True, index=True)
    deleted_at = Column(Float, nullable=True, index=True)

    __table_args__ = (
        Index("idx_file_shelf_user_status", "user_id", "status"),
        Index("idx_file_shelf_user_expires", "user_id", "expires_at"),
        Index("idx_file_shelf_status_uploaded", "status", "uploaded_at"),
    )


class FileRateEvent(Base):
    __tablename__ = "rate_events"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(20), nullable=False)
    timestamp = Column(Float, nullable=False, index=True)

    __table_args__ = (
        Index("idx_file_rate_user_type_time", "user_id", "event_type", "timestamp"),
    )


class DownloadLease(Base):
    __tablename__ = "download_leases"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id = Column(
        String(36),
        ForeignKey("file_shelf_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    acquired_at = Column(Float, nullable=False)
    expires_at = Column(Float, nullable=False, index=True)

    __table_args__ = (
        Index("idx_download_lease_user", "user_id"),
        Index("idx_download_lease_expires", "expires_at"),
    )


class FileDeletionJob(Base):
    __tablename__ = "deletion_jobs"

    id = Column(String(36), primary_key=True)
    file_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False)
    r2_object_key = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(Float, nullable=False)
    updated_at = Column(Float, nullable=False)
    last_error = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_file_del_status_created", "status", "created_at"),
    )


class RuntimeState(Base):
    __tablename__ = "runtime_state"

    key = Column(String(100), primary_key=True)
    value = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    updated_at = Column(Float, nullable=False)


class VideoCompressionJob(Base):
    __tablename__ = "video_compression_jobs"

    id = Column(String(36), primary_key=True)
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    ip_address = Column(String(45), nullable=False)
    original_filename = Column(String(255), nullable=False)
    output_filename = Column(String(255), nullable=True)
    job_type = Column(String(20), nullable=False, default="compress")
    preset = Column(String(20), nullable=False, default="balanced")
    status = Column(String(20), nullable=False, default="uploading")
    running_lock = Column(Integer, nullable=True)
    progress_percent = Column(Float, nullable=False, default=0.0)
    input_path = Column(Text, nullable=True)
    output_path = Column(Text, nullable=True)
    input_size_bytes = Column(BigInteger, nullable=False, default=0)
    output_size_bytes = Column(BigInteger, nullable=True)
    input_duration_sec = Column(Float, nullable=True)
    input_width = Column(Integer, nullable=True)
    input_height = Column(Integer, nullable=True)
    output_width = Column(Integer, nullable=True)
    output_height = Column(Integer, nullable=True)
    error_code = Column(String(64), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(Float, nullable=False)
    updated_at = Column(Float, nullable=False)
    started_at = Column(Float, nullable=True)
    completed_at = Column(Float, nullable=True)
    expires_at = Column(Float, nullable=True)
    claimed_at = Column(Float, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ("
            "'uploading', 'queued', 'scanning', 'probing', 'encoding', "
            "'succeeded', 'claimed', 'failed', 'cancelled', 'expired'"
            ")",
            name="chk_video_jobs_status",
        ),
        CheckConstraint(
            "job_type IN ('compress', 'extract_audio', 'transcribe')",
            name="chk_video_jobs_job_type",
        ),
        CheckConstraint(
            (
                "preset IN ('light', 'balanced', 'maximum', '128k', "
                "'192k', '320k', 'auto', 'id', 'en')"
            ),
            name="chk_video_jobs_preset",
        ),
        CheckConstraint(
            "(status IN ('scanning', 'probing', 'encoding') AND running_lock = 1) OR "
            "(status NOT IN ('scanning', 'probing', 'encoding') AND running_lock IS NULL)",
            name="chk_video_jobs_running_lock",
        ),
        CheckConstraint("input_size_bytes >= 0", name="chk_video_jobs_input_size_nonneg"),
        Index("idx_video_jobs_user_created", "user_id", "created_at"),
        Index("idx_video_jobs_ip_created", "ip_address", "created_at"),
        Index("idx_video_jobs_status_created", "status", "created_at"),
        Index("idx_video_jobs_expires_at", "expires_at"),
        Index(
            "uq_video_jobs_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text(
                "status IN ('uploading', 'queued', 'scanning', 'probing', 'encoding')"
            ),
            sqlite_where=text(
                "status IN ('uploading', 'queued', 'scanning', 'probing', 'encoding')"
            ),
        ),
        Index(
            "uq_video_jobs_global_running",
            "running_lock",
            unique=True,
            postgresql_where=text("running_lock IS NOT NULL"),
            sqlite_where=text("running_lock IS NOT NULL"),
        ),
    )


