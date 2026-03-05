"""Schemas for Life Domain API endpoints."""

from typing import Dict

from pydantic import BaseModel


class LifeDomainScoreResponse(BaseModel):
    score_date: str
    scores: Dict[str, float]  # 7 domain keys: career, relationship, family, health, finance, social, purpose
    total_score: float
