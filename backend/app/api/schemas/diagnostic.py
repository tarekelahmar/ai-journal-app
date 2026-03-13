"""Pydantic schemas for the Diagnostic system."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class DiagnosticResponseCreate(BaseModel):
    question_id: str = Field(..., min_length=1, max_length=30)
    layer: int = Field(..., ge=1, le=3)
    section: str = Field(..., min_length=1, max_length=30)
    response_type: str = Field(..., min_length=1, max_length=20)
    response_json: dict


class DiagnosticResponseOut(BaseModel):
    id: int
    question_id: str
    layer: int
    section: str
    response_type: str
    response_json: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DiagnosticProgressOut(BaseModel):
    layer_1: int = 0
    layer_2: int = 0
    layer_3: int = 0
    sections: dict = {}
    concern_track: Optional[str] = None


class SynthesisOut(BaseModel):
    who_you_are: Optional[str] = None
    patterns_identified: Optional[list] = None
    ai_approach_text: Optional[str] = None
    primary_concern_track: Optional[str] = None
    secondary_concern_track: Optional[str] = None
    domain_scores: Optional[dict] = None
    commitments: Optional[list] = None
    feared_future: Optional[str] = None
    desired_future: Optional[str] = None
    diagnostic_completed: bool = False


class UserProfileOut(BaseModel):
    profile_json: dict = {}
    who_you_are: Optional[str] = None
    patterns_identified: Optional[list] = None
    ai_approach_text: Optional[str] = None
    primary_concern_track: Optional[str] = None
    secondary_concern_track: Optional[str] = None
    depth_level: Optional[int] = None
    challenge_tolerance: Optional[int] = None
    processing_style: Optional[str] = None
    diagnostic_completed: bool = False
    diagnostic_completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
