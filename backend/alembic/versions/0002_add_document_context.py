"""Add document_context and document_filename to journal_sessions

Stores extracted text from uploaded documents for AI context.

Revision ID: 0002_add_document_context
Revises: 0001_baseline
Create Date: 2026-03-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0002_add_document_context'
down_revision: Union[str, None] = '0001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: create_all() may have already added these columns
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = {c['name'] for c in inspector.get_columns('journal_sessions')}

    if 'document_context' not in existing_columns:
        op.add_column('journal_sessions', sa.Column('document_context', sa.Text(), nullable=True))
    if 'document_filename' not in existing_columns:
        op.add_column('journal_sessions', sa.Column('document_filename', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('journal_sessions', 'document_filename')
    op.drop_column('journal_sessions', 'document_context')
