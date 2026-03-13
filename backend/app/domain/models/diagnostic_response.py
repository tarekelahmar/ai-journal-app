"""
DiagnosticResponse — stores each individual diagnostic answer.

One row per question per user. Supports save-and-resume and individual
question editing via upsert on (user_id, question_id).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, JSON,
    Index, UniqueConstraint,
)

from app.core.database import Base


class DiagnosticResponse(Base):
    __tablename__ = "diagnostic_responses"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Which question this responds to
    question_id = Column(String(30), nullable=False)  # e.g. "q1", "q3_career", "pa_2a", "pr_3_av1"
    layer = Column(Integer, nullable=False)  # 1, 2, or 3
    section = Column(String(30), nullable=False)  # e.g. "opener", "domains", "behavioural", "concern", "past_authoring"

    # The response data (flexible JSON handles all types)
    response_type = Column(String(20), nullable=False)  # "text", "score", "slider", "select", "multi_select", "composite"
    response_json = Column(JSON, nullable=False)
    # Examples:
    #   text: {"value": "I keep avoiding things..."}
    #   score: {"value": 7.5}
    #   slider: {"value": 3}
    #   select: {"value": "avoidance_and_inaction"}
    #   multi_select: {"values": ["avoidance_and_inaction", "identity_and_direction"]}
    #   composite: {"score": 4, "why": "Stuck in role...", "what_would_help": "Have the conversation"}
    #   sliders_group: {"structure": 3, "avoidance": 2, "accountability": 4, "processing": 2, "emotional": 3, "follow_through": 2}

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_diagnostic_user_question"),
        Index("ix_diagnostic_user_layer", "user_id", "layer"),
    )
