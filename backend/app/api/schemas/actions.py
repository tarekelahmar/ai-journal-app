"""
Action schemas — Pydantic models for the Action system.

Framework alignment (March 2026): Actions are habit or completable items
linked to life domains. Sources: journal_extraction, ai_suggestion, user_created.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ── Enums as literals ─────────────────────────────────────────────

ActionType = Literal["habit", "completable"]
ActionStatus = Literal["active", "paused", "completed", "abandoned"]
ActionSource = Literal["journal_extraction", "ai_suggestion", "user_created"]

VALID_DOMAINS = {"career", "relationship", "family", "health", "finance", "social", "purpose"}


# ── Action schemas ────────────────────────────────────────────────

class ActionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    action_type: ActionType
    source: ActionSource = "user_created"
    primary_domain: Optional[str] = None
    target_frequency: Optional[int] = Field(None, ge=1, le=7)
    difficulty: Optional[int] = Field(None, ge=1, le=5)

    @field_validator("primary_domain")
    @classmethod
    def validate_domain(cls, v):
        if v is not None and v not in VALID_DOMAINS:
            raise ValueError(f"Invalid domain: {v}. Must be one of {VALID_DOMAINS}")
        return v


class ActionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[ActionStatus] = None
    primary_domain: Optional[str] = None
    target_frequency: Optional[int] = Field(None, ge=1, le=7)
    difficulty: Optional[int] = Field(None, ge=1, le=5)
    sort_order: Optional[int] = None

    @field_validator("primary_domain")
    @classmethod
    def validate_domain(cls, v):
        if v is not None and v not in VALID_DOMAINS:
            raise ValueError(f"Invalid domain: {v}. Must be one of {VALID_DOMAINS}")
        return v


class ActionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    action_type: str
    status: str
    source: str
    primary_domain: Optional[str] = None
    target_frequency: Optional[int] = None
    difficulty: Optional[int] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── ActionMilestone schemas ───────────────────────────────────────

class ActionMilestoneCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    sort_order: int = 0


class ActionMilestoneResponse(BaseModel):
    id: int
    action_id: int
    title: str
    is_completed: bool
    completed_at: Optional[datetime] = None
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── HabitLog schemas ─────────────────────────────────────────────

class HabitLogCreate(BaseModel):
    log_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    completed: bool = True


class HabitLogResponse(BaseModel):
    id: int
    action_id: int
    user_id: int
    log_date: str
    completed: bool
    created_at: datetime

    class Config:
        from_attributes = True
