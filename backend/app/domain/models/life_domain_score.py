"""
Life Domain Scores — 7-axis life satisfaction model.

Framework alignment (March 2026): 7 life dimensions locked by product framework.
Scores are 1.0-10.0 floats, updated via EMA after each journal entry.
Cold start: all domains at 5.0.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, UniqueConstraint, Index, Text
from app.core.database import Base


# The 7 life dimensions (framework-locked)
LIFE_DOMAINS = [
    "career",
    "relationship",
    "family",
    "health",
    "finance",
    "social",
    "purpose",
]

LIFE_DOMAIN_LABELS = {
    "career": "Career / Work",
    "relationship": "Relationship",
    "family": "Family",
    "health": "Physical & Mental Health",
    "finance": "Finance",
    "social": "Social",
    "purpose": "Purpose",
}

DEFAULT_SCORE = 5.0


class LifeDomainScore(Base):
    """Daily snapshot of a user's life domain scores."""
    __tablename__ = "life_domain_scores"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score_date = Column(String(10), nullable=False)  # "YYYY-MM-DD"

    # 7 life dimension scores (1.0-10.0)
    career = Column(Float, nullable=False, default=DEFAULT_SCORE)
    relationship = Column(Float, nullable=False, default=DEFAULT_SCORE)
    family = Column(Float, nullable=False, default=DEFAULT_SCORE)
    health = Column(Float, nullable=False, default=DEFAULT_SCORE)
    finance = Column(Float, nullable=False, default=DEFAULT_SCORE)
    social = Column(Float, nullable=False, default=DEFAULT_SCORE)
    purpose = Column(Float, nullable=False, default=DEFAULT_SCORE)

    # How each domain score was derived
    derivation_json = Column(Text, nullable=True)
    # {domain: {signal_source: "companion_inferred"|"slider_mapped", confidence: 0.7}}

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "score_date", name="uq_life_domain_user_date"),
        Index("ix_life_domain_scores_user_date", "user_id", "score_date"),
    )

    def get_scores(self) -> dict[str, float]:
        """Return all domain scores as a dict."""
        return {d: getattr(self, d) for d in LIFE_DOMAINS}

    def set_score(self, domain: str, value: float) -> None:
        """Set a single domain score, clamped to 1.0-10.0."""
        if domain not in LIFE_DOMAINS:
            raise ValueError(f"Unknown life domain: {domain}")
        setattr(self, domain, max(1.0, min(10.0, value)))

    @property
    def total_score(self) -> float:
        """Sum of all 7 domains (max 70)."""
        return sum(getattr(self, d) for d in LIFE_DOMAINS)
