"""Alembic environment configuration.

Reads DATABASE_URL from environment and imports all models
so autogenerate can detect schema changes.
"""
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv

# Load .env if present (local dev)
load_dotenv()

# Alembic Config object
config = context.config

# Set sqlalchemy.url from environment
database_url = os.environ.get("DATABASE_URL", "")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import Base and all models so metadata is populated
from app.core.database import Base

# Import all models to register with Base.metadata
from app.domain.models.user import User  # noqa: F401
from app.domain.models.daily_checkin import DailyCheckIn  # noqa: F401
from app.domain.models.journal_session import JournalSession  # noqa: F401
from app.domain.models.journal_message import JournalMessage  # noqa: F401
from app.domain.models.personal_pattern import PersonalPattern  # noqa: F401
from app.domain.models.life_domain_score import LifeDomainScore  # noqa: F401
from app.domain.models.domain_checkin import DomainCheckin  # noqa: F401
from app.domain.models.milestone import Milestone  # noqa: F401
from app.domain.models.user_preference import UserPreference  # noqa: F401
from app.domain.models.consent import Consent  # noqa: F401
from app.domain.models.audit_event import AuditEvent  # noqa: F401
from app.domain.models.action import Action  # noqa: F401
from app.domain.models.action_milestone import ActionMilestone  # noqa: F401
from app.domain.models.habit_log import HabitLog  # noqa: F401
from app.domain.models.suggestion_dismissal import SuggestionDismissal  # noqa: F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Generates SQL script without connecting to the database.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Connects to the database and applies migrations directly.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
