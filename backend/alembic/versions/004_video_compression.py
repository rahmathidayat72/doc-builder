"""004_video_compression

Revision ID: 004_video_compression
Revises: 003_file_shelf
Create Date: 2026-11-12 10:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004_video_compression"
down_revision: str | None = "003_file_shelf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "video_compression_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("output_filename", sa.String(length=255), nullable=True),
        sa.Column("preset", sa.String(length=20), server_default="balanced", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="uploading", nullable=False),
        sa.Column("running_lock", sa.Integer(), nullable=True),
        sa.Column("progress_percent", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("input_path", sa.Text(), nullable=True),
        sa.Column("output_path", sa.Text(), nullable=True),
        sa.Column("input_size_bytes", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("output_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("input_duration_sec", sa.Float(), nullable=True),
        sa.Column("input_width", sa.Integer(), nullable=True),
        sa.Column("input_height", sa.Integer(), nullable=True),
        sa.Column("output_width", sa.Integer(), nullable=True),
        sa.Column("output_height", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.Float(), nullable=False),
        sa.Column("started_at", sa.Float(), nullable=True),
        sa.Column("completed_at", sa.Float(), nullable=True),
        sa.Column("expires_at", sa.Float(), nullable=True),
        sa.Column("claimed_at", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ("
            "'uploading', 'queued', 'scanning', 'probing', 'encoding', "
            "'succeeded', 'claimed', 'failed', 'cancelled', 'expired'"
            ")",
            name="chk_video_jobs_status",
        ),
        sa.CheckConstraint(
            "preset IN ('light', 'balanced', 'maximum')",
            name="chk_video_jobs_preset",
        ),
        sa.CheckConstraint(
            "(status IN ('scanning', 'probing', 'encoding') AND running_lock = 1) OR "
            "(status NOT IN ('scanning', 'probing', 'encoding') AND running_lock IS NULL)",
            name="chk_video_jobs_running_lock",
        ),
        sa.CheckConstraint("input_size_bytes >= 0", name="chk_video_jobs_input_size_nonneg"),
    )
    op.create_index(
        "idx_video_jobs_user_created",
        "video_compression_jobs",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_video_jobs_ip_created",
        "video_compression_jobs",
        ["ip_address", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_video_jobs_status_created",
        "video_compression_jobs",
        ["status", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_video_jobs_expires_at",
        "video_compression_jobs",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        "uq_video_jobs_active_per_user",
        "video_compression_jobs",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text(
            "status IN ('uploading', 'queued', 'scanning', 'probing', 'encoding')"
        ),
        sqlite_where=sa.text(
            "status IN ('uploading', 'queued', 'scanning', 'probing', 'encoding')"
        ),
    )
    op.create_index(
        "uq_video_jobs_global_running",
        "video_compression_jobs",
        ["running_lock"],
        unique=True,
        postgresql_where=sa.text("running_lock IS NOT NULL"),
        sqlite_where=sa.text("running_lock IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_video_jobs_global_running", table_name="video_compression_jobs")
    op.drop_index("uq_video_jobs_active_per_user", table_name="video_compression_jobs")
    op.drop_index("idx_video_jobs_expires_at", table_name="video_compression_jobs")
    op.drop_index("idx_video_jobs_status_created", table_name="video_compression_jobs")
    op.drop_index("idx_video_jobs_ip_created", table_name="video_compression_jobs")
    op.drop_index("idx_video_jobs_user_created", table_name="video_compression_jobs")
    op.drop_table("video_compression_jobs")
