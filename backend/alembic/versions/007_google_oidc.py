"""007_google_oidc

Revision ID: 007_google_oidc
Revises: 006_video_to_text
Create Date: 2026-11-16 16:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007_google_oidc"
down_revision: str | None = "006_video_to_text"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. users: add avatar_url
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("avatar_url", sa.Text(), nullable=True))

    # 2. oauth_transactions
    op.create_table(
        "oauth_transactions",
        sa.Column("state_hash", sa.String(length=128), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False, server_default="google"),
        sa.Column("intent", sa.String(length=20), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("browser_binding_hash", sa.String(length=128), nullable=False),
        sa.Column("code_verifier", sa.String(length=128), nullable=False),
        sa.Column("nonce", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("expires_at", sa.Float(), nullable=False),
        sa.Column("used_at", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("state_hash"),
        sa.CheckConstraint("intent IN ('login', 'link')", name="chk_oauth_tx_intent"),
    )
    op.create_index(
        "idx_oauth_tx_expires",
        "oauth_transactions",
        ["expires_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_oauth_tx_expires", table_name="oauth_transactions")
    op.drop_table("oauth_transactions")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("avatar_url")
