"""Database connection and session management"""
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import logging

from app.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Create SQLAlchemy engine with connection pooling
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    echo=settings.DEBUG,  # Log SQL queries in debug mode
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()


def init_db():
    """
    Initialize database schema.

    SCHEMA GOVERNANCE: Only creates tables in dev mode.
    In staging/production, schema must be managed via Alembic migrations only.
    """
    from app.config.environment import get_env_mode, is_production, is_staging

    env_mode = get_env_mode()

    # SCHEMA GOVERNANCE: Disable create_all() in staging/production
    if is_production() or is_staging():
        logger.warning(
            "init_db() called in %s mode - create_all() is disabled. "
            "Schema must be managed via Alembic migrations only.",
            env_mode.value
        )
        return

    # Only in dev mode: create missing tables (for convenience)
    logger.info("Running init_db() in dev mode - creating missing tables")

    # Import journal-app models to register with Base.metadata
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

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get database session.

    Yields:
        Database session

    Example:
        ```python
        def my_endpoint(db: Session = Depends(get_db)):
            # Use db session here
            pass
        ```
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()
