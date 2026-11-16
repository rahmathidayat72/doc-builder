"""005_mp4_to_mp3

Revision ID: 005_mp4_to_mp3
Revises: 004_video_compression
Create Date: 2026-11-13 12:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005_mp4_to_mp3"
down_revision: str | None = "004_video_compression"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("video_compression_jobs") as batch_op:
        batch_op.add_column(
            sa.Column(
                "job_type",
                sa.String(length=20),
                server_default="compress",
                nullable=False,
            )
        )
        batch_op.drop_constraint("chk_video_jobs_preset", type_="check")
        batch_op.create_check_constraint(
            "chk_video_jobs_preset",
            "preset IN ('light', 'balanced', 'maximum', '128k', '192k', '320k')",
        )
        batch_op.create_check_constraint(
            "chk_video_jobs_job_type",
            "job_type IN ('compress', 'extract_audio')",
        )


def downgrade() -> None:
    with op.batch_alter_table("video_compression_jobs") as batch_op:
        batch_op.drop_constraint("chk_video_jobs_job_type", type_="check")
        batch_op.drop_constraint("chk_video_jobs_preset", type_="check")
        batch_op.create_check_constraint(
            "chk_video_jobs_preset",
            "preset IN ('light', 'balanced', 'maximum')",
        )
        batch_op.drop_column("job_type")
