"""002_resume_drafts

Revision ID: 002_resume_drafts
Revises: 001_initial_schema
Create Date: 2026-11-11 12:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_resume_drafts"
down_revision: str | None = "001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "resume_drafts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=140), nullable=False),
        sa.Column(
            "payload",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=False,
        ),
        sa.Column("favorite", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("target_job_title", sa.String(length=140), nullable=True),
        sa.Column("size_bytes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.Float(), nullable=False),
        sa.Column("expires_at", sa.Float(), nullable=False),
        sa.Column("deleted_at", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_resume_drafts_user_updated",
        "resume_drafts",
        ["user_id", "updated_at"],
        unique=False,
    )
    op.create_index(
        "idx_resume_drafts_user_deleted",
        "resume_drafts",
        ["user_id", "deleted_at"],
        unique=False,
    )
    op.create_index(
        "idx_resume_drafts_expires",
        "resume_drafts",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        "idx_resume_drafts_deleted",
        "resume_drafts",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_resume_drafts_deleted", table_name="resume_drafts")
    op.drop_index("idx_resume_drafts_expires", table_name="resume_drafts")
    op.drop_index("idx_resume_drafts_user_deleted", table_name="resume_drafts")
    op.drop_index("idx_resume_drafts_user_updated", table_name="resume_drafts")
    op.drop_table("resume_drafts")
