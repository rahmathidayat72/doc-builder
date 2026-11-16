"""006_video_to_text

Revision ID: 006_video_to_text
Revises: 005_mp4_to_mp3
Create Date: 2026-11-13 14:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006_video_to_text"
down_revision: str | None = "005_mp4_to_mp3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("video_compression_jobs") as batch_op:
        batch_op.drop_constraint("chk_video_jobs_preset", type_="check")
        batch_op.create_check_constraint(
            "chk_video_jobs_preset",
            (
                "preset IN ('light', 'balanced', 'maximum', '128k', "
                "'192k', '320k', 'auto', 'id', 'en')"
            ),
        )
        batch_op.drop_constraint("chk_video_jobs_job_type", type_="check")
        batch_op.create_check_constraint(
            "chk_video_jobs_job_type",
            "job_type IN ('compress', 'extract_audio', 'transcribe')",
        )


def downgrade() -> None:
    with op.batch_alter_table("video_compression_jobs") as batch_op:
        batch_op.drop_constraint("chk_video_jobs_job_type", type_="check")
        batch_op.create_check_constraint(
            "chk_video_jobs_job_type",
            "job_type IN ('compress', 'extract_audio')",
        )
        batch_op.drop_constraint("chk_video_jobs_preset", type_="check")
        batch_op.create_check_constraint(
            "chk_video_jobs_preset",
            "preset IN ('light', 'balanced', 'maximum', '128k', '192k', '320k')",
        )
