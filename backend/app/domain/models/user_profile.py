"""
UserProfile — stores the generated diagnostic profile consumed by the AI companion.

One row per user. Regenerated when diagnostic responses change.
The profile_json contains the full structured profile; individual fields
are extracted for quick access and querying.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON,
)

from app.core.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    # The full structured profile JSON (schema in diagnostic-layer-3.md)
    profile_json = Column(JSON, nullable=False, default=dict)

    # LLM-generated synthesis text blocks
    who_you_are = Column(Text, nullable=True)
    patterns_identified = Column(JSON, nullable=True)  # List of {name, description, evidence_domains, severity}
    ai_approach_text = Column(Text, nullable=True)

    # Concern track assignment (extracted for quick access)
    primary_concern_track = Column(String(50), nullable=True)
    secondary_concern_track = Column(String(50), nullable=True)

    # Communication settings (extracted for quick access)
    depth_level = Column(Integer, nullable=True)  # 1, 2, or 3
    challenge_tolerance = Column(Integer, nullable=True)  # 1-5
    processing_style = Column(String(20), nullable=True)  # "analytical", "emotional", "mixed"

    # Status
    diagnostic_completed = Column(Boolean, default=False, nullable=False)
    diagnostic_completed_at = Column(DateTime, nullable=True)
    diagnostic_version = Column(String(10), default="1.0")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
