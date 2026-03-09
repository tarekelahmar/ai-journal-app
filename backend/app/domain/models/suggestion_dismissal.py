"""
Suggestion Dismissal — tracks when a user dismisses a domain-based suggestion.

Used by the domain suggestion service to enforce a 14-day cooldown:
if a user dismisses a suggestion for a domain, no new suggestion for that
domain will appear for at least 14 days.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from app.core.database import Base


class SuggestionDismissal(Base):
    __tablename__ = "suggestion_dismissals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    domain = Column(String(30), nullable=False)  # e.g. "finance"
    dismissed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_suggestion_dismissal_user_domain", "user_id", "domain"),
    )
