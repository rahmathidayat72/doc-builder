"""003_file_shelf

Revision ID: 003_file_shelf
Revises: 002_resume_drafts
Create Date: 2026-11-11 14:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003_file_shelf"
down_revision: str | None = "002_resume_drafts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. file_shelf_items
    op.create_table(
        "file_shelf_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="CHECKING", nullable=False),
        sa.Column("sha256_hash", sa.String(length=64), nullable=True),
        sa.Column("r2_object_key", sa.String(length=255), nullable=True),
        sa.Column("r2_key_id", sa.String(length=64), nullable=True),
        sa.Column("r2_etag", sa.String(length=64), nullable=True),
        sa.Column("quarantine_path", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "has_exif_warning",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("uploaded_at", sa.Float(), nullable=False),
        sa.Column("available_at", sa.Float(), nullable=True),
        sa.Column("expires_at", sa.Float(), nullable=True),
        sa.Column("deleted_at", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_file_shelf_user_status", "file_shelf_items", ["user_id", "status"], unique=False
    )
    op.create_index(
        "idx_file_shelf_user_expires", "file_shelf_items", ["user_id", "expires_at"], unique=False
    )
    op.create_index(
        "idx_file_shelf_status_uploaded",
        "file_shelf_items",
        ["status", "uploaded_at"],
        unique=False,
    )
    op.create_index("idx_file_shelf_deleted", "file_shelf_items", ["deleted_at"], unique=False)

    # 2. rate_events
    op.create_table(
        "rate_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("timestamp", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_file_rate_user_type_time",
        "rate_events",
        ["user_id", "event_type", "timestamp"],
        unique=False,
    )

    # 3. download_leases
    op.create_table(
        "download_leases",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("file_id", sa.String(length=36), nullable=False),
        sa.Column("acquired_at", sa.Float(), nullable=False),
        sa.Column("expires_at", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["file_shelf_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_download_lease_user", "download_leases", ["user_id"], unique=False)
    op.create_index("idx_download_lease_expires", "download_leases", ["expires_at"], unique=False)

    # 4. deletion_jobs
    op.create_table(
        "deletion_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("file_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("r2_object_key", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="PENDING", nullable=False),
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.Float(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_file_del_status_created",
        "deletion_jobs",
        ["status", "created_at"],
        unique=False,
    )
    op.create_index("idx_file_del_file_id", "deletion_jobs", ["file_id"], unique=False)

    # 5. runtime_state
    op.create_table(
        "runtime_state",
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column(
            "value",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("runtime_state")
    op.drop_table("deletion_jobs")
    op.drop_table("download_leases")
    op.drop_table("rate_events")
    op.drop_table("file_shelf_items")
