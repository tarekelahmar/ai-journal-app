"""
ActionMilestone — sub-steps or milestones for completable actions.

Each completable action can have 0+ milestones that track progress
toward completion. Milestones are ordered and individually completable.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index

from app.core.database import Base


class ActionMilestone(Base):
    __tablename__ = "action_milestones"

    id = Column(Integer, primary_key=True, index=True)
    action_id = Column(Integer, ForeignKey("actions.id", ondelete="CASCADE"), nullable=False)

    title = Column(String, nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_action_milestone_action", "action_id"),
    )
