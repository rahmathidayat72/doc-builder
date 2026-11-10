"""001_initial_schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-11-10 12:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email_verified", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("idx_users_email", "users", ["email"], unique=False)

    # 2. oauth_accounts
    op.create_table(
        "oauth_accounts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_user_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_uid"),
        sa.UniqueConstraint("user_id", "provider", name="uq_oauth_user_provider"),
    )
    op.create_index("idx_oauth_accounts_user_id", "oauth_accounts", ["user_id"], unique=False)
    op.create_index(
        "idx_oauth_accounts_provider_uid",
        "oauth_accounts",
        ["provider", "provider_user_id"],
        unique=False,
    )

    # 3. user_sessions
    op.create_table(
        "user_sessions",
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("csrf_token", sa.String(length=128), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("expires_at", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    op.create_index("idx_user_sessions_user_id", "user_sessions", ["user_id"], unique=False)
    op.create_index("idx_user_sessions_expires_at", "user_sessions", ["expires_at"], unique=False)

    # 4. auth_tokens
    op.create_table(
        "auth_tokens",
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token_type", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("expires_at", sa.Float(), nullable=False),
        sa.Column("used_at", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    op.create_index(
        "idx_auth_tokens_user_type", "auth_tokens", ["user_id", "token_type"], unique=False
    )

    # 5. short_urls
    op.create_table(
        "short_urls",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("destination_url", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("click_count", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("revoked_at", sa.Float(), nullable=True),
        sa.Column("last_accessed_at", sa.Float(), nullable=True),
        sa.CheckConstraint(
            "status IN ('active', 'revoked', 'tombstone')", name="chk_short_urls_status"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("idx_short_urls_slug", "short_urls", ["slug"], unique=True)

    # 6. media_download_jobs
    op.create_table(
        "media_download_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("platform", sa.String(length=50), nullable=False),
        sa.Column("media_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("progress_percent", sa.Float(), server_default="0.0", nullable=True),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger(), server_default="0", nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("error_code", sa.String(length=50), nullable=True),
        sa.Column("reserved_bytes", sa.BigInteger(), server_default="0", nullable=True),
        sa.Column("actual_bytes", sa.BigInteger(), server_default="0", nullable=True),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("started_at", sa.Float(), nullable=True),
        sa.Column("completed_at", sa.Float(), nullable=True),
        sa.Column("expires_at", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_media_jobs_user_status", "media_download_jobs", ["user_id", "status"], unique=False
    )
    op.create_index("idx_media_jobs_status", "media_download_jobs", ["status"], unique=False)
    op.create_index(
        "idx_media_jobs_expires_at", "media_download_jobs", ["expires_at"], unique=False
    )

    # 7. media_download_usage
    op.create_table(
        "media_download_usage",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=False),
        sa.Column("bytes_used", sa.BigInteger(), nullable=False),
        sa.Column("timestamp", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_media_usage_user_time", "media_download_usage", ["user_id", "timestamp"], unique=False
    )
    op.create_index(
        "idx_media_usage_ip_time", "media_download_usage", ["ip_address", "timestamp"], unique=False
    )


def downgrade() -> None:
    op.drop_table("media_download_usage")
    op.drop_table("media_download_jobs")
    op.drop_table("short_urls")
    op.drop_table("auth_tokens")
    op.drop_table("user_sessions")
    op.drop_table("oauth_accounts")
    op.drop_table("users")
