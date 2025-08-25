"""Add whisper backend support

Revision ID: 47f3e1a09e69
Revises: 43801cdd977d
Create Date: 2025-08-25 16:25:40.220485

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "47f3e1a09e69"
down_revision: str | Sequence[str] | None = "43801cdd977d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add 'whisper' to the model_backend_enum
    op.execute("ALTER TYPE model_backend_enum ADD VALUE 'whisper'")


def downgrade() -> None:
    """Downgrade schema."""
    # Note: PostgreSQL doesn't support removing enum values directly
    # This would require recreating the enum type
    pass
