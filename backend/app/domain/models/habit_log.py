"""
HabitLog — daily completion log for habit-type actions.

One row per (action, date) pair. Tracks whether the habit was done
on a given day, enabling streak and consistency calculations.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey,
    UniqueConstraint, Index,
)

from app.core.database import Base


class HabitLog(Base):
    __tablename__ = "habit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action_id = Column(Integer, ForeignKey("actions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_date = Column(String(10), nullable=False)  # "YYYY-MM-DD"
    completed = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("action_id", "log_date", name="uq_habit_log_action_date"),
        Index("ix_habit_log_user_date", "user_id", "log_date"),
        Index("ix_habit_log_action_date", "action_id", "log_date"),
    )
