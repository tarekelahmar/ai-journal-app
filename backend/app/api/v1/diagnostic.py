"""Diagnostic endpoints — CRUD for diagnostic responses, progress, synthesis."""

import logging
from typing import List

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth_mode import get_request_user_id
from app.api.router_factory import make_v1_router
from app.api.schemas.diagnostic import (
    DiagnosticResponseCreate,
    DiagnosticResponseOut,
    DiagnosticProgressOut,
    SynthesisOut,
    UserProfileOut,
)
from app.core.database import get_db
from app.domain.repositories.diagnostic_response_repository import DiagnosticResponseRepository
from app.domain.repositories.user_profile_repository import UserProfileRepository

logger = logging.getLogger(__name__)

router = make_v1_router(prefix="/api/v1/diagnostic", tags=["diagnostic"])


# ── Diagnostic Response CRUD ────────────────────────────────────────


@router.post("/responses", response_model=DiagnosticResponseOut)
def save_response(
    body: DiagnosticResponseCreate,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Save or update a single diagnostic response."""
    repo = DiagnosticResponseRepository(db)
    obj = repo.upsert(
        user_id=user_id,
        question_id=body.question_id,
        layer=body.layer,
        section=body.section,
        response_type=body.response_type,
        response_json=body.response_json,
    )
    return obj


@router.get("/responses", response_model=List[DiagnosticResponseOut])
def get_responses(
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Get all diagnostic responses for the current user."""
    repo = DiagnosticResponseRepository(db)
    return repo.get_all(user_id)


@router.get("/responses/{question_id}", response_model=DiagnosticResponseOut)
def get_response(
    question_id: str,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Get a specific diagnostic response."""
    repo = DiagnosticResponseRepository(db)
    obj = repo.get_by_question(user_id, question_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Response not found")
    return obj


@router.delete("/responses/{question_id}")
def delete_response(
    question_id: str,
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Delete a specific diagnostic response."""
    repo = DiagnosticResponseRepository(db)
    deleted = repo.delete_by_question(user_id, question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Response not found")
    return {"deleted": True}


# ── Progress ────────────────────────────────────────────────────────


@router.get("/progress", response_model=DiagnosticProgressOut)
def get_progress(
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Get diagnostic completion progress per layer and section."""
    repo = DiagnosticResponseRepository(db)
    progress = repo.get_progress(user_id)

    # Extract concern track from Q11 if answered
    concern_track = None
    q11 = repo.get_by_question(user_id, "q11")
    if q11 and q11.response_json:
        values = q11.response_json.get("values", [])
        if values:
            concern_track = values[0]

    return DiagnosticProgressOut(
        layer_1=progress.get("layer_1", 0),
        layer_2=progress.get("layer_2", 0),
        layer_3=progress.get("layer_3", 0),
        sections=progress.get("sections", {}),
        concern_track=concern_track,
    )


# ── Complete + Synthesis ────────────────────────────────────────────


@router.post("/complete", response_model=SynthesisOut)
def complete_diagnostic(
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Mark diagnostic as complete and trigger the full synthesis pipeline."""
    from app.engine.diagnostic_profile import complete_diagnostic as run_complete

    profile = run_complete(db, user_id)
    return _profile_to_synthesis(profile, db, user_id)


@router.get("/synthesis", response_model=SynthesisOut)
def get_synthesis(
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Get the current synthesis for the user."""
    profile_repo = UserProfileRepository(db)
    profile = profile_repo.get(user_id)
    if not profile:
        return SynthesisOut()
    return _profile_to_synthesis(profile, db, user_id)


@router.post("/synthesis/regenerate", response_model=SynthesisOut)
def regenerate_synthesis(
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Regenerate synthesis after editing responses."""
    from app.engine.diagnostic_profile import complete_diagnostic as run_complete

    profile = run_complete(db, user_id)
    return _profile_to_synthesis(profile, db, user_id)


# ── User Profile ────────────────────────────────────────────────────


@router.get("/profile", response_model=UserProfileOut)
def get_profile(
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """Get the full user profile."""
    profile_repo = UserProfileRepository(db)
    profile = profile_repo.get(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


# ── Helpers ─────────────────────────────────────────────────────────


def _profile_to_synthesis(profile, db: Session, user_id: int) -> SynthesisOut:
    """Convert a UserProfile to a SynthesisOut response."""
    p = profile.profile_json or {}

    # Extract domain scores from Q3-Q9
    domain_scores = {}
    resp_repo = DiagnosticResponseRepository(db)
    domain_map = {
        "q3_career": "career",
        "q4_relationship": "relationship",
        "q5_family": "family",
        "q6_health": "health",
        "q7_finance": "finance",
        "q8_social": "social",
        "q9_purpose": "purpose",
    }
    for q_id, domain in domain_map.items():
        resp = resp_repo.get_by_question(user_id, q_id)
        if resp and resp.response_json:
            domain_scores[domain] = resp.response_json.get("score")

    # Extract commitments and futures from profile
    motiv = p.get("motivational_structure", {})
    narrative = p.get("narrative_context", {})

    return SynthesisOut(
        who_you_are=profile.who_you_are,
        patterns_identified=profile.patterns_identified,
        ai_approach_text=profile.ai_approach_text,
        primary_concern_track=profile.primary_concern_track,
        secondary_concern_track=profile.secondary_concern_track,
        domain_scores=domain_scores or None,
        commitments=motiv.get("stated_commitments"),
        feared_future=narrative.get("feared_future"),
        desired_future=narrative.get("desired_future"),
        diagnostic_completed=profile.diagnostic_completed,
    )
