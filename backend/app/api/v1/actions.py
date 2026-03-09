"""
Actions API — CRUD for actions, milestones, habit logs, and domain suggestions.

Framework alignment (March 2026): Actions link to 7 life dimensions.

Endpoints:
- POST   /api/v1/actions                              — create action
- GET    /api/v1/actions                              — list user actions
- GET    /api/v1/actions/suggestion                   — get domain-based suggestion
- POST   /api/v1/actions/suggestion/dismiss           — dismiss a suggestion
- GET    /api/v1/actions/{action_id}                  — get single action
- PATCH  /api/v1/actions/{action_id}                  — update action
- DELETE /api/v1/actions/{action_id}                  — delete action
- POST   /api/v1/actions/{action_id}/milestones       — add milestone
- GET    /api/v1/actions/{action_id}/milestones       — list milestones
- PATCH  /api/v1/actions/{action_id}/milestones/{mid} — toggle milestone
- DELETE /api/v1/actions/{action_id}/milestones/{mid} — delete milestone
- POST   /api/v1/actions/{action_id}/logs             — log habit completion
- GET    /api/v1/actions/{action_id}/logs             — get habit logs
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth_mode import get_request_user_id
from app.api.router_factory import make_v1_router
from app.api.schemas.actions import (
    ActionCreate, ActionUpdate, ActionResponse,
    ActionMilestoneCreate, ActionMilestoneResponse,
    HabitLogCreate, HabitLogResponse,
)

from app.domain.repositories.action_repository import ActionRepository
from app.domain.repositories.action_milestone_repository import ActionMilestoneRepository
from app.domain.repositories.habit_log_repository import HabitLogRepository

logger = logging.getLogger(__name__)

router = make_v1_router(prefix="/api/v1/actions", tags=["actions"])


# ── Action CRUD ──────────────────────────────────────────────────

@router.post("", response_model=ActionResponse)
def create_action(
    body: ActionCreate,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    repo = ActionRepository(db)
    action = repo.create(
        user_id=user_id,
        title=body.title,
        description=body.description,
        action_type=body.action_type,
        source=body.source,
        primary_domain=body.primary_domain,
        target_frequency=body.target_frequency,
        difficulty=body.difficulty,
    )

    # Auto-generate milestones for completable actions
    if action.action_type == "completable":
        try:
            from app.engine.milestone_generator import generate_milestones_for_action

            journal_context = _get_journal_context(db, user_id, action.title)
            generate_milestones_for_action(
                db=db,
                action_id=action.id,
                user_id=user_id,
                action_title=action.title,
                action_type=action.action_type,
                journal_context=journal_context,
            )
        except Exception as e:
            logger.error(f"Milestone generation failed (non-fatal): {e}")

    return action


@router.get("", response_model=List[ActionResponse])
def list_actions(
    status: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    repo = ActionRepository(db)
    return repo.list_by_user(user_id, status=status, domain=domain)


# ── Domain Suggestion ────────────────────────────────────────────


@router.get("/suggestion")
def get_suggestion(
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Get a single domain-based action suggestion, or null."""
    from app.engine.domain_suggestion import get_domain_suggestion

    result = get_domain_suggestion(db, user_id)
    return result


class DismissBody(BaseModel):
    domain: str


@router.post("/suggestion/dismiss")
def dismiss_suggestion(
    body: DismissBody,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Dismiss a domain suggestion for 14 days."""
    from app.domain.models.suggestion_dismissal import SuggestionDismissal

    dismissal = SuggestionDismissal(user_id=user_id, domain=body.domain)
    db.add(dismissal)
    db.commit()
    return {"dismissed": True}


@router.get("/{action_id}", response_model=ActionResponse)
def get_action(
    action_id: int,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    repo = ActionRepository(db)
    action = repo.get_by_id(action_id, user_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return action


@router.patch("/{action_id}", response_model=ActionResponse)
def update_action(
    action_id: int,
    body: ActionUpdate,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    repo = ActionRepository(db)
    action = repo.get_by_id(action_id, user_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return repo.update(
        action,
        title=body.title,
        description=body.description,
        status=body.status,
        primary_domain=body.primary_domain,
        target_frequency=body.target_frequency,
        difficulty=body.difficulty,
        sort_order=body.sort_order,
    )


@router.delete("/{action_id}")
def delete_action(
    action_id: int,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    repo = ActionRepository(db)
    action = repo.get_by_id(action_id, user_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    repo.delete(action)
    return {"deleted": True}


# ── Milestones (sub-steps for completable actions) ───────────────

@router.post("/{action_id}/milestones", response_model=ActionMilestoneResponse)
def create_milestone(
    action_id: int,
    body: ActionMilestoneCreate,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    # Verify action ownership
    action_repo = ActionRepository(db)
    action = action_repo.get_by_id(action_id, user_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    repo = ActionMilestoneRepository(db)
    return repo.create(action_id=action_id, title=body.title, sort_order=body.sort_order)


@router.get("/{action_id}/milestones", response_model=List[ActionMilestoneResponse])
def list_milestones(
    action_id: int,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    action_repo = ActionRepository(db)
    action = action_repo.get_by_id(action_id, user_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    repo = ActionMilestoneRepository(db)
    return repo.list_by_action(action_id)


@router.patch("/{action_id}/milestones/{milestone_id}", response_model=ActionMilestoneResponse)
def toggle_milestone(
    action_id: int,
    milestone_id: int,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    action_repo = ActionRepository(db)
    action = action_repo.get_by_id(action_id, user_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    repo = ActionMilestoneRepository(db)
    milestone = repo.get_by_id(milestone_id)
    if not milestone or milestone.action_id != action_id:
        raise HTTPException(status_code=404, detail="Milestone not found")

    return repo.toggle_complete(milestone)


@router.delete("/{action_id}/milestones/{milestone_id}")
def delete_milestone(
    action_id: int,
    milestone_id: int,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    action_repo = ActionRepository(db)
    action = action_repo.get_by_id(action_id, user_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    repo = ActionMilestoneRepository(db)
    milestone = repo.get_by_id(milestone_id)
    if not milestone or milestone.action_id != action_id:
        raise HTTPException(status_code=404, detail="Milestone not found")

    repo.delete(milestone)
    return {"deleted": True}


# ── Habit Logs ───────────────────────────────────────────────────

@router.post("/{action_id}/logs", response_model=HabitLogResponse)
def log_habit(
    action_id: int,
    body: HabitLogCreate,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    action_repo = ActionRepository(db)
    action = action_repo.get_by_id(action_id, user_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.action_type != "habit":
        raise HTTPException(status_code=400, detail="Habit logs only apply to habit-type actions")

    repo = HabitLogRepository(db)
    return repo.log(action_id=action_id, user_id=user_id, log_date=body.log_date, completed=body.completed)


@router.get("/{action_id}/logs", response_model=List[HabitLogResponse])
def get_habit_logs(
    action_id: int,
    start_date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    action_repo = ActionRepository(db)
    action = action_repo.get_by_id(action_id, user_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    repo = HabitLogRepository(db)
    return repo.get_logs(action_id=action_id, start_date=start_date, end_date=end_date)


# ── Helpers ──────────────────────────────────────────────────────

def _get_journal_context(db: Session, user_id: int, action_title: str) -> str:
    """Get recent journal messages mentioning keywords from the action title."""
    from app.domain.models.journal_message import JournalMessage

    # Extract meaningful keywords from the action title
    stop_words = {
        "the", "a", "an", "to", "with", "for", "my", "on", "in",
        "and", "or", "of", "this", "that", "have", "last", "one",
    }
    words = [w for w in action_title.lower().split() if w not in stop_words and len(w) > 2]

    if not words:
        return ""

    # Search recent user messages for any of these keywords
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    messages = (
        db.query(JournalMessage)
        .filter(
            JournalMessage.user_id == user_id,
            JournalMessage.role == "user",
            JournalMessage.created_at >= thirty_days_ago,
            or_(*[JournalMessage.content.ilike(f"%{w}%") for w in words[:3]]),
        )
        .order_by(JournalMessage.created_at.desc())
        .limit(3)
        .all()
    )

    return " ".join([m.content for m in messages])[:500]
