"""
Action — user-defined or AI-suggested actions to improve life domains.

Framework alignment (March 2026): Actions are things users commit to doing.
Two types:
  - "habit" — ongoing, consistency-tracked (e.g., "Meditate 10 min daily")
  - "completable" — has a finish line, milestone-tracked (e.g., "Sign up for gym")

Actions link to 1+ life domains and can be sourced from journal extraction,
AI suggestion, or user creation.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey,
    Index, UniqueConstraint,
)

from app.core.database import Base


class Action(Base):
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Core fields
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    action_type = Column(String(20), nullable=False)  # "habit" | "completable"
    status = Column(String(20), nullable=False, default="active")  # "active" | "paused" | "completed" | "abandoned"
    source = Column(String(30), nullable=False, default="user_created")  # "journal_extraction" | "ai_suggestion" | "user_created"

    # Domain linkage (primary domain this action targets)
    primary_domain = Column(String(30), nullable=True)  # e.g., "health", "career"

    # Optional: target frequency for habits (times per week)
    target_frequency = Column(Integer, nullable=True)  # e.g., 7 = daily, 3 = 3x/week

    # Optional: difficulty/effort estimate (1-5)
    difficulty = Column(Integer, nullable=True)

    # Ordering within user's list
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_action_user_status", "user_id", "status"),
        Index("ix_action_user_domain", "user_id", "primary_domain"),
    )
