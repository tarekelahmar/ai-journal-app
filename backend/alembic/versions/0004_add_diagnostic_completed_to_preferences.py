"""Add diagnostic_completed column to user_preferences table

Revision ID: 0004_add_diagnostic_completed_to_preferences
Revises: 0003_add_diagnostic_tables
Create Date: 2026-03-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0004_add_diagnostic_completed_to_preferences'
down_revision: Union[str, None] = '0003_add_diagnostic_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'user_preferences' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('user_preferences')]
        if 'diagnostic_completed' not in columns:
            op.add_column(
                'user_preferences',
                sa.Column('diagnostic_completed', sa.Boolean(), nullable=True, server_default='false')
            )


def downgrade() -> None:
    op.drop_column('user_preferences', 'diagnostic_completed')
