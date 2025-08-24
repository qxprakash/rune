"""Add pytorch backend support

Revision ID: pytorch_backend_001
Revises: 1d511dc5f19a
Create Date: 2025-01-24 04:30:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "pytorch_backend_001"
down_revision = "1d511dc5f19a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add pytorch backend to ModelBackend enum."""
    # Add pytorch to the enum type
    op.execute("ALTER TYPE model_backend_enum ADD VALUE 'pytorch'")


def downgrade() -> None:
    """Remove pytorch backend from ModelBackend enum."""
    # Note: PostgreSQL doesn't support removing enum values directly
    # This would require recreating the enum and updating all references
    # For now, we'll leave the enum value in place to avoid data loss
    pass
