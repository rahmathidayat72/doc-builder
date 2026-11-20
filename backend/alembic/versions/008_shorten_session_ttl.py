"""008_shorten_session_ttl

Revision ID: 008_shorten_session_ttl
Revises: 007_google_oidc
Create Date: 2026-11-19 09:05:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008_shorten_session_ttl"
down_revision: str | None = "007_google_oidc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SESSION_TTL_SECONDS = 6 * 3600.0


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE user_sessions "
            "SET expires_at = created_at + :ttl "
            "WHERE expires_at > created_at + :ttl"
        ).bindparams(ttl=SESSION_TTL_SECONDS)
    )


def downgrade() -> None:
    # Pemendekan TTL sesi lama tidak membalikkan batas keamanan ke 30 hari.
    pass
