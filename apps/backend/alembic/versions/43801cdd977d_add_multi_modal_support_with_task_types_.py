"""Add multi-modal support with task types and file handling

Revision ID: 43801cdd977d
Revises: pytorch_backend_001
Create Date: 2025-08-25 15:32:06.251623

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "43801cdd977d"
down_revision: str | Sequence[str] | None = "pytorch_backend_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create the job_type_enum type first
    job_type_enum = sa.Enum(
        "text_generation",
        "speech_to_text",
        "text_to_speech",
        "image_generation",
        "image_to_text",
        "embeddings",
        name="job_type_enum",
    )
    job_type_enum.create(op.get_bind())

    # Add columns with the enum type
    op.add_column(
        "jobs",
        sa.Column("task_type", job_type_enum, server_default="text_generation", nullable=False),
    )
    op.add_column("jobs", sa.Column("input_files", sa.JSON(), server_default="[]", nullable=False))
    op.add_column("jobs", sa.Column("output_files", sa.JSON(), server_default="[]", nullable=False))
    op.add_column(
        "models",
        sa.Column(
            "supported_tasks", sa.JSON(), server_default='["text_generation"]', nullable=False
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop columns first
    op.drop_column("models", "supported_tasks")
    op.drop_column("jobs", "output_files")
    op.drop_column("jobs", "input_files")
    op.drop_column("jobs", "task_type")

    # Drop the enum type
    sa.Enum(name="job_type_enum").drop(op.get_bind())
