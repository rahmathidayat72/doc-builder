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
)
from sqlalchemy.dialects.postgresql import JSONB

from app.db.postgres import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    email_verified = Column(Integer, nullable=False, default=0)
    created_at = Column(Float, nullable=False)
    updated_at = Column(Float, nullable=False)


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


