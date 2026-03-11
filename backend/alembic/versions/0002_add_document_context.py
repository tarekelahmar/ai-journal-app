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
    op.add_column('journal_sessions', sa.Column('document_context', sa.Text(), nullable=True))
    op.add_column('journal_sessions', sa.Column('document_filename', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('journal_sessions', 'document_filename')
    op.drop_column('journal_sessions', 'document_context')
