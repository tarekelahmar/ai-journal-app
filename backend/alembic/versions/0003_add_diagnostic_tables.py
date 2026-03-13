"""Add diagnostic_responses and user_profiles tables

Tables for the diagnostic questionnaire system:
- diagnostic_responses: stores individual answers (one per question per user)
- user_profiles: stores the generated synthesis/profile

Revision ID: 0003_add_diagnostic_tables
Revises: 0002_add_document_context
Create Date: 2026-03-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0003_add_diagnostic_tables'
down_revision: Union[str, None] = '0002_add_document_context'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'diagnostic_responses' not in existing_tables:
        op.create_table(
            'diagnostic_responses',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('question_id', sa.String(30), nullable=False),
            sa.Column('layer', sa.Integer(), nullable=False),
            sa.Column('section', sa.String(30), nullable=False),
            sa.Column('response_type', sa.String(20), nullable=False),
            sa.Column('response_json', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
            sa.UniqueConstraint('user_id', 'question_id', name='uq_diagnostic_user_question'),
        )
        op.create_index('ix_diagnostic_user_layer', 'diagnostic_responses', ['user_id', 'layer'])

    if 'user_profiles' not in existing_tables:
        op.create_table(
            'user_profiles',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, unique=True),
            sa.Column('profile_json', sa.JSON(), nullable=False, server_default='{}'),
            sa.Column('who_you_are', sa.Text(), nullable=True),
            sa.Column('patterns_identified', sa.JSON(), nullable=True),
            sa.Column('ai_approach_text', sa.Text(), nullable=True),
            sa.Column('primary_concern_track', sa.String(50), nullable=True),
            sa.Column('secondary_concern_track', sa.String(50), nullable=True),
            sa.Column('depth_level', sa.Integer(), nullable=True),
            sa.Column('challenge_tolerance', sa.Integer(), nullable=True),
            sa.Column('processing_style', sa.String(20), nullable=True),
            sa.Column('diagnostic_completed', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('diagnostic_completed_at', sa.DateTime(), nullable=True),
            sa.Column('diagnostic_version', sa.String(10), server_default='1.0'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table('user_profiles')
    op.drop_index('ix_diagnostic_user_layer', table_name='diagnostic_responses')
    op.drop_table('diagnostic_responses')
