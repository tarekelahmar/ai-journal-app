"""
Domain-Based Suggestion Service — Refinement 11.

Checks if there's a qualified domain-based action suggestion for a user.
Returns at most ONE suggestion, targeting the domain with the biggest decline.

Qualification criteria (ALL must be met):
1. A life domain declined by 1.0+ points over 14+ days
2. The user mentioned the topic 2+ times in journal messages (last 30 days)
3. No active action with primary_domain matching this domain
4. User hasn't dismissed a suggestion for this domain in the last 14 days
5. At least 14 days of daily score data exists (no early firing)
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.domain.models.action import Action
from app.domain.models.journal_message import JournalMessage
from app.domain.models.life_domain_score import LifeDomainScore, LIFE_DOMAINS
from app.domain.models.suggestion_dismissal import SuggestionDismissal

logger = logging.getLogger(__name__)

# ── Domain keyword mapping ───────────────────────────────────────

DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "finance": [
        "money", "spending", "finances", "financial", "budget",
        "debt", "savings", "salary", "pay",
    ],
    "career": [
        "work", "job", "career", "boss", "project",
        "promotion", "office",
    ],
    "relationship": [
        "partner", "relationship", "girlfriend", "boyfriend",
        "wife", "husband", "dating",
    ],
    "family": [
        "family", "father", "mother", "parents",
        "sister", "brother", "dad", "mum",
    ],
    "health": [
        "exercise", "gym", "health", "sleep",
        "medication", "therapy", "doctor", "weight",
    ],
    "social": [
        "friends", "social", "lonely", "isolated",
        "people", "community",
    ],
    "purpose": [
        "purpose", "meaning", "direction", "goals",
        "passion", "motivation", "stuck",
    ],
}

DOMAIN_LABELS: dict[str, str] = {
    "career": "Career",
    "relationship": "Relationship",
    "family": "Family",
    "health": "Health",
    "finance": "Finance",
    "social": "Social",
    "purpose": "Purpose",
}

DEFAULT_SUGGESTIONS: dict[str, tuple[str, str]] = {
    "finance": ("Track monthly spending for 2 weeks", "completable"),
    "career": ("Identify one career blocker and address it", "completable"),
    "relationship": ("Have one honest conversation with your partner this week", "completable"),
    "family": ("Reach out to one family member", "completable"),
    "health": ("Prioritise daily exercise", "habit"),
    "social": ("Make plans with one friend this week", "completable"),
    "purpose": ("Write about what purpose means to you", "completable"),
}


# ── Main entry point ─────────────────────────────────────────────

def get_domain_suggestion(db: Session, user_id: int) -> Optional[dict]:
    """
    Check if there's a qualified domain-based suggestion for the user.

    Returns at most ONE suggestion dict, or None.
    """
    try:
        # Guard: need at least 14 days of score data
        if not _has_enough_data(db, user_id):
            return None

        # Step 1: find declining domains (sorted by biggest drop)
        declines = _find_declining_domains(db, user_id)
        if not declines:
            return None

        # For each declining domain (biggest drop first), check qualifications
        for domain, current_score, previous_score, decline in declines:

            # Step 2: check journal mentions (≥ 2 in last 30 days)
            mention_count = _count_domain_mentions(db, user_id, domain)
            if mention_count < 2:
                continue

            # Step 3: no active action for this domain
            if _has_active_action(db, user_id, domain):
                continue

            # Step 4: not dismissed in last 14 days
            if _recently_dismissed(db, user_id, domain):
                continue

            # All criteria met — build suggestion
            suggested_title, suggested_type = DEFAULT_SUGGESTIONS.get(
                domain, ("Take one small step to improve", "completable")
            )

            return {
                "domain": domain,
                "domain_label": DOMAIN_LABELS.get(domain, domain.title()),
                "score_current": round(current_score, 1),
                "score_previous": round(previous_score, 1),
                "decline": round(decline, 1),
                "mention_count": mention_count,
                "suggested_action": suggested_title,
                "suggested_type": suggested_type,
                "evidence_text": (
                    f"Your {DOMAIN_LABELS.get(domain, domain)} domain has dropped "
                    f"from {round(previous_score, 1)} to {round(current_score, 1)} "
                    f"over the past month. You've mentioned "
                    f"{DOMAIN_LABELS.get(domain, domain).lower()} concerns "
                    f"{mention_count} times without creating an action."
                ),
            }

        return None

    except Exception as e:
        logger.error(f"Domain suggestion error: {e}", exc_info=True)
        return None


# ── Step helpers ─────────────────────────────────────────────────

def _has_enough_data(db: Session, user_id: int) -> bool:
    """Require at least 14 days of daily score data."""
    from app.domain.models.daily_checkin import DailyCheckIn

    count = (
        db.query(func.count(DailyCheckIn.id))
        .filter(
            DailyCheckIn.user_id == user_id,
            DailyCheckIn.overall_wellbeing.isnot(None),
        )
        .scalar()
    )
    return (count or 0) >= 14


def _find_declining_domains(
    db: Session, user_id: int
) -> list[tuple[str, float, float, float]]:
    """
    Compare most recent LifeDomainScore with one from 14+ days ago.
    Returns list of (domain, current, previous, decline) sorted by decline desc.
    Only includes domains that declined by >= 1.0.
    """
    today = date.today()
    cutoff = str(today - timedelta(days=14))

    # Most recent score
    current_row = (
        db.query(LifeDomainScore)
        .filter(LifeDomainScore.user_id == user_id)
        .order_by(LifeDomainScore.score_date.desc())
        .first()
    )
    if not current_row:
        return []

    # Score from 14+ days ago (most recent before cutoff)
    previous_row = (
        db.query(LifeDomainScore)
        .filter(
            LifeDomainScore.user_id == user_id,
            LifeDomainScore.score_date <= cutoff,
        )
        .order_by(LifeDomainScore.score_date.desc())
        .first()
    )
    if not previous_row:
        return []

    current_scores = current_row.get_scores()
    previous_scores = previous_row.get_scores()

    declines = []
    for domain in LIFE_DOMAINS:
        cur = current_scores.get(domain, 5.0)
        prev = previous_scores.get(domain, 5.0)
        drop = prev - cur
        if drop >= 1.0:
            declines.append((domain, cur, prev, drop))

    # Biggest decline first
    declines.sort(key=lambda x: x[3], reverse=True)
    return declines


def _count_domain_mentions(db: Session, user_id: int, domain: str) -> int:
    """Count user messages in last 30 days containing domain keywords."""
    keywords = DOMAIN_KEYWORDS.get(domain, [])
    if not keywords:
        return 0

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    messages = (
        db.query(JournalMessage.content)
        .filter(
            JournalMessage.user_id == user_id,
            JournalMessage.role == "user",
            JournalMessage.created_at >= thirty_days_ago,
        )
        .all()
    )

    count = 0
    for (content,) in messages:
        lower = content.lower()
        if any(kw in lower for kw in keywords):
            count += 1
    return count


def _has_active_action(db: Session, user_id: int, domain: str) -> bool:
    """Check if there's already an active action for this domain."""
    exists = (
        db.query(Action.id)
        .filter(
            Action.user_id == user_id,
            Action.primary_domain == domain,
            Action.status == "active",
        )
        .first()
    )
    return exists is not None


def _recently_dismissed(db: Session, user_id: int, domain: str) -> bool:
    """Check if the user dismissed a suggestion for this domain in the last 14 days."""
    cutoff = datetime.utcnow() - timedelta(days=14)

    exists = (
        db.query(SuggestionDismissal.id)
        .filter(
            SuggestionDismissal.user_id == user_id,
            SuggestionDismissal.domain == domain,
            SuggestionDismissal.dismissed_at >= cutoff,
        )
        .first()
    )
    return exists is not None
