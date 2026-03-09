"""baseline

Baseline migration. Tables are created by SQLAlchemy create_all()
on first deploy. This revision serves as the Alembic starting point.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-03-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0001_baseline'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables are created by SQLAlchemy Base.metadata.create_all()
    # This is a no-op baseline for Alembic version tracking.
    pass


def downgrade() -> None:
    pass
