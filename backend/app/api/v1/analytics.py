"""
Dashboard Analytics Endpoint — Track 5 Task 5.

A single endpoint that returns all pre-computed dashboard data,
replacing the 5+ parallel frontend API calls.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Dict, List, Optional

from fastapi import Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth_mode import get_request_user_id
from app.api.router_factory import make_v1_router
from app.core.database import get_db
from app.domain.models.action import Action
from app.domain.models.daily_checkin import DailyCheckIn

logger = logging.getLogger(__name__)

router = make_v1_router(prefix="/api/v1/analytics", tags=["analytics"])


# ── Response Schema ───────────────────────────────────────────────

class ImpactFactorResponse(BaseModel):
    label: str
    impact_percentage: int
    direction: str  # "positive" | "negative"
    effect_size: float


class WeeklyInsightResponse(BaseModel):
    headline: str
    body: str
    date_range: str


class DashboardAnalyticsResponse(BaseModel):
    # Headline metrics
    floor: Optional[float] = None
    floor_start: Optional[float] = None
    trend_direction: str = "stable"
    trend_avg: Optional[float] = None
    best_streak: int = 0
    streak_threshold: Optional[float] = None

    # Scores
    daily_scores: List[dict] = []

    # Impact factors
    impact_factors: List[ImpactFactorResponse] = []

    # Life domains
    current_domains: dict = {}
    previous_domains: Optional[dict] = None

    # Weekly insight
    weekly_insight: Optional[WeeklyInsightResponse] = None

    # Actions summary
    habit_count: int = 0
    completable_count: int = 0
    completed_count: int = 0

    entry_count: int = 0


# ── Endpoint ──────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardAnalyticsResponse)
def get_dashboard(
    user_id: int = Depends(get_request_user_id),
    db: Session = Depends(get_db),
):
    """
    Single endpoint returning all pre-computed dashboard data.
    Replaces 5+ parallel frontend API calls.
    """
    # 1. Fetch daily scores (last 60 days)
    sixty_days_ago = date.today() - timedelta(days=60)
    checkins = (
        db.query(DailyCheckIn)
        .filter(
            DailyCheckIn.user_id == user_id,
            DailyCheckIn.checkin_date >= sixty_days_ago,
            DailyCheckIn.overall_wellbeing.isnot(None),
        )
        .order_by(DailyCheckIn.checkin_date.asc())
        .all()
    )

    scores = [
        {"date": str(c.checkin_date), "score": c.overall_wellbeing}
        for c in checkins
    ]

    # 2. Compute headline metrics
    floor, floor_start = _compute_floor(scores)
    trend_direction, trend_avg = _compute_trend(scores)
    best_streak, streak_threshold = _compute_streak(scores)

    # Last 30 days for chart display
    thirty_days_ago = date.today() - timedelta(days=30)
    chart_scores = [s for s in scores if s["date"] >= str(thirty_days_ago)]

    # 3. Get patterns and convert to impact factors
    impact_factors = _get_impact_factors(db, user_id)

    # 4. Get current + historical domain scores
    current_domains, previous_domains = _get_domain_scores(db, user_id)

    # 5. Generate weekly insight
    weekly_insight = _get_weekly_insight(db, user_id)

    # 6. Count actions by type/status
    habit_count, completable_count, completed_count = _count_actions(db, user_id)

    return DashboardAnalyticsResponse(
        floor=floor,
        floor_start=floor_start,
        trend_direction=trend_direction,
        trend_avg=trend_avg,
        best_streak=best_streak,
        streak_threshold=streak_threshold,
        daily_scores=chart_scores,
        impact_factors=impact_factors,
        current_domains=current_domains,
        previous_domains=previous_domains,
        weekly_insight=weekly_insight,
        habit_count=habit_count,
        completable_count=completable_count,
        completed_count=completed_count,
        entry_count=len(scores),
    )


# ── Computation Helpers ───────────────────────────────────────────

def _compute_floor(scores: List[dict]) -> tuple:
    """
    Compute floor (lowest score in last 14 days)
    and floor_start (lowest score in first 14 days for "up from X").
    """
    if not scores:
        return None, None

    today = date.today()
    recent_cutoff = str(today - timedelta(days=14))

    recent = [s["score"] for s in scores if s["date"] >= recent_cutoff]
    floor = min(recent) if recent else None

    early_end = str(today - timedelta(days=46))
    early_start = str(today - timedelta(days=60))
    early = [s["score"] for s in scores if early_start <= s["date"] <= early_end]
    floor_start = min(early) if early else None

    return floor, floor_start


def _compute_trend(scores: List[dict]) -> tuple:
    """Compute trend direction and 7-day average."""
    if not scores:
        return "stable", None

    today = date.today()
    seven_days_ago = str(today - timedelta(days=7))
    recent = [s["score"] for s in scores if s["date"] >= seven_days_ago]

    if not recent:
        return "stable", None

    avg = round(sum(recent) / len(recent), 1)

    # Compare first half vs second half for direction
    if len(recent) >= 4:
        mid = len(recent) // 2
        first_avg = sum(recent[:mid]) / mid
        second_avg = sum(recent[mid:]) / max(1, len(recent) - mid)
        diff = second_avg - first_avg
        direction = "up" if diff > 0.3 else "down" if diff < -0.3 else "stable"
    else:
        direction = "stable"

    return direction, avg


def _compute_streak(scores: List[dict]) -> tuple:
    """
    Compute best streak: consecutive days with score above personal median.
    Returns (streak_length, threshold).
    """
    if not scores:
        return 0, None

    all_vals = [s["score"] for s in scores]
    median = sorted(all_vals)[len(all_vals) // 2]

    # Compute current streak from today backwards
    sorted_scores = sorted(scores, key=lambda s: s["date"], reverse=True)
    today = date.today()
    streak = 0

    for i, s in enumerate(sorted_scores):
        expected = str(today - timedelta(days=i))
        if s["date"] == expected and s["score"] >= median:
            streak += 1
        else:
            break

    return streak, round(median, 1)


def _get_impact_factors(db: Session, user_id: int) -> List[ImpactFactorResponse]:
    """Get patterns formatted as impact factors for the dashboard."""
    try:
        from app.engine.memory.pattern_manager import PatternManager

        mgr = PatternManager(db)
        patterns = mgr.get_active_patterns(user_id=user_id)

        factors = []
        for p in patterns:
            rel = p.relationship_json or {}
            if not rel.get("pattern_name"):
                continue

            effect = rel.get("effect_size", 0)
            impact_pct = round(min(30, abs(effect) * 12))
            if impact_pct == 0:
                continue

            # Build human-readable label from input factors
            input_factors = p.input_signals_json or []
            if input_factors:
                label = input_factors[0].replace("_", " ").title()
            else:
                label = rel.get("pattern_name", p.pattern_type)

            factors.append(ImpactFactorResponse(
                label=label,
                impact_percentage=impact_pct,
                direction="positive" if effect > 0 else "negative",
                effect_size=round(effect, 2),
            ))

        # Sort by impact descending, take top 6
        factors.sort(key=lambda f: f.impact_percentage, reverse=True)
        return factors[:6]

    except Exception as e:
        logger.error(f"Failed to get impact factors: {e}")
        return []


def _get_domain_scores(db: Session, user_id: int) -> tuple:
    """Get current and 30-day-ago domain scores."""
    try:
        from app.domain.models.life_domain_score import LifeDomainScore, LIFE_DOMAINS

        # Current (most recent)
        current_row = (
            db.query(LifeDomainScore)
            .filter(LifeDomainScore.user_id == user_id)
            .order_by(LifeDomainScore.score_date.desc())
            .first()
        )

        if not current_row:
            return {}, None

        current = current_row.get_scores()

        # Previous (30+ days ago)
        thirty_days_ago = str(date.today() - timedelta(days=30))
        previous_row = (
            db.query(LifeDomainScore)
            .filter(
                LifeDomainScore.user_id == user_id,
                LifeDomainScore.score_date <= thirty_days_ago,
            )
            .order_by(LifeDomainScore.score_date.desc())
            .first()
        )

        previous = previous_row.get_scores() if previous_row else None

        return current, previous

    except Exception as e:
        logger.error(f"Failed to get domain scores: {e}")
        return {}, None


def _get_weekly_insight(db: Session, user_id: int) -> Optional[WeeklyInsightResponse]:
    """Generate or retrieve the weekly insight."""
    try:
        from app.engine.weekly_insight import generate_weekly_insight

        result = generate_weekly_insight(db, user_id)
        if result:
            return WeeklyInsightResponse(
                headline=result["headline"],
                body=result["body"],
                date_range=result.get("date_range", ""),
            )
    except Exception as e:
        logger.error(f"Failed to generate weekly insight: {e}")

    return None


def _count_actions(db: Session, user_id: int) -> tuple:
    """Count actions by type and status."""
    try:
        habits = db.query(Action).filter(
            Action.user_id == user_id,
            Action.action_type == "habit",
            Action.status == "active",
        ).count()

        completables = db.query(Action).filter(
            Action.user_id == user_id,
            Action.action_type == "completable",
            Action.status == "active",
        ).count()

        completed = db.query(Action).filter(
            Action.user_id == user_id,
            Action.status == "completed",
        ).count()

        return habits, completables, completed

    except Exception as e:
        logger.error(f"Failed to count actions: {e}")
        return 0, 0, 0
