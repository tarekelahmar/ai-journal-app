"""
Production startup script.

Handles both first deploy (fresh DB) and subsequent deploys:
1. Creates all tables from SQLAlchemy models (no-op if they already exist)
2. Stamps Alembic version to head if no version exists (first deploy)
3. Runs any pending Alembic migrations (subsequent deploys)
"""
import os
import subprocess
import sys
import logging

# Ensure the backend root is on the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("startup")


def init_tables():
    """Create tables from SQLAlchemy metadata. Safe to run multiple times."""
    from app.core.database import Base, engine

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

    logger.info("Creating tables from SQLAlchemy models (no-op for existing tables)...")
    Base.metadata.create_all(bind=engine)
    logger.info("Tables ready.")


def stamp_if_needed():
    """Stamp Alembic head if no version exists (first deploy)."""
    from app.core.database import engine
    from sqlalchemy import text, inspect

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "alembic_version" not in tables:
        logger.info("No alembic_version table — first deploy, stamping head...")
        subprocess.run([sys.executable, "-m", "alembic", "stamp", "head"], check=True)
        logger.info("Stamped Alembic to head.")
    else:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT count(*) FROM alembic_version"))
            count = result.scalar()
            if count == 0:
                logger.info("Empty alembic_version — stamping head...")
                subprocess.run([sys.executable, "-m", "alembic", "stamp", "head"], check=True)
                logger.info("Stamped Alembic to head.")
            else:
                logger.info("Alembic version exists, running migrations...")
                subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
                logger.info("Migrations complete.")


if __name__ == "__main__":
    init_tables()
    stamp_if_needed()
    logger.info("Database initialization complete.")
