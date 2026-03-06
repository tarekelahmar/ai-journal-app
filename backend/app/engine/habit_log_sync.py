"""
Habit Log Auto-Population — Track 5 Task 2.

Syncs habit logs from journal analysis data. When the AI infers context tags
(e.g., exercise=true) from journal text, the corresponding habit action's
HabitLog should be auto-populated.

Sources:
  - JournalMessage.ai_analysis_json.context_tags (from analysis LLM call)
  - DailyCheckIn.context_tags_json (after score confirmation)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Callable, Dict, List, Optional, Tuple, Union

from sqlalchemy.orm import Session

from app.domain.models.action import Action
from app.domain.models.habit_log import HabitLog
from app.domain.models.journal_message import JournalMessage
from app.domain.models.daily_checkin import DailyCheckIn

logger = logging.getLogger(__name__)

# Map action text keywords to context tags
# (keyword_in_action_title, (context_tag_field, expected_value_or_truthy))
HABIT_TAG_MAPPING: Dict[str, Tuple[str, Union[bool, str, Callable]]] = {
    "exercise": ("exercise", True),
    "gym": ("exercise", True),
    "run": ("exercise", True),
    "workout": ("exercise", True),
    "office": ("location", "office"),
    "social": ("social_contact", lambda v: v is not None and v != "alone" and v != "none"),
    "sleep": ("sleep", "good"),
    "meditat": ("exercise", True),  # broad match for meditate/meditation
    "walk": ("exercise", True),
    "yoga": ("exercise", True),
    "journal": ("journaling", True),
}


def _match_habit_to_tags(action_text: str, context_tags: dict) -> bool:
    """Check if context tags indicate the habit was performed."""
    if not context_tags:
        return False

    text_lower = action_text.lower()
    for keyword, (tag_field, expected) in HABIT_TAG_MAPPING.items():
        if keyword in text_lower:
            actual = context_tags.get(tag_field)
            if actual is None:
                continue
            if callable(expected):
                return expected(actual)
            if isinstance(expected, bool):
                # Truthy check: True, "true", non-empty string
                if expected:
                    return bool(actual) and actual != "false" and actual != "none"
                return not actual
            return actual == expected

    return False


def _get_context_tags_for_date(
    db: Session, user_id: int, target_date: str
) -> Optional[dict]:
    """
    Get context tags for a specific date.

    Checks DailyCheckIn.context_tags_json first (more reliable, post-confirmation).
    Falls back to JournalMessage.ai_analysis_json.context_tags.
    """
    from datetime import date as date_type

    # Try DailyCheckIn first
    checkin = (
        db.query(DailyCheckIn)
        .filter(
            DailyCheckIn.user_id == user_id,
            DailyCheckIn.checkin_date == target_date,
        )
        .first()
    )
    if checkin and checkin.context_tags_json:
        return checkin.context_tags_json

    # Fallback: scan assistant messages from that day
    day_start = datetime.strptime(target_date, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1)

    messages = (
        db.query(JournalMessage)
        .filter(
            JournalMessage.user_id == user_id,
            JournalMessage.role == "assistant",
            JournalMessage.created_at >= day_start,
            JournalMessage.created_at < day_end,
            JournalMessage.ai_analysis_json.isnot(None),
        )
        .order_by(JournalMessage.created_at.desc())
        .all()
    )

    # Merge context tags from all messages for the day (latest takes precedence)
    merged_tags: dict = {}
    for msg in reversed(messages):
        analysis = msg.ai_analysis_json
        if isinstance(analysis, dict) and "context_tags" in analysis:
            tags = analysis["context_tags"]
            if isinstance(tags, dict):
                merged_tags.update(tags)

    return merged_tags if merged_tags else None


def _upsert_habit_log(
    db: Session, action_id: int, user_id: int, log_date: str, completed: bool
) -> bool:
    """
    Insert or update a habit log for (action_id, log_date).
    Returns True if a new log was created, False if existing was updated.
    """
    existing = (
        db.query(HabitLog)
        .filter(
            HabitLog.action_id == action_id,
            HabitLog.log_date == log_date,
        )
        .first()
    )

    if existing:
        if existing.completed != completed:
            existing.completed = completed
        return False
    else:
        log = HabitLog(
            action_id=action_id,
            user_id=user_id,
            log_date=log_date,
            completed=completed,
            created_at=datetime.utcnow(),
        )
        db.add(log)
        return True


def sync_habit_logs_from_analysis(db: Session, user_id: int) -> int:
    """
    Scan recent journal messages for AI-inferred context tags and
    auto-populate habit logs for matching active habits.

    Logic:
    1. Get all active habits for the user
    2. For each habit, determine what context tag maps to it
    3. Scan the last 7 days for context tags
    4. For each day where the context tag matches, upsert a HabitLog with completed=true
    5. For each day where there's a journal entry but the tag doesn't match,
       upsert with completed=false

    Returns count of logs created/updated.
    """
    # 1. Get active habits
    habits = (
        db.query(Action)
        .filter(
            Action.user_id == user_id,
            Action.action_type == "habit",
            Action.status == "active",
        )
        .all()
    )

    if not habits:
        return 0

    # 2. Build date range (last 7 days)
    today = datetime.utcnow().date()
    dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

    # 3. For each date, get context tags
    count = 0
    for date_str in dates:
        tags = _get_context_tags_for_date(db, user_id, date_str)
        if tags is None:
            continue  # No journal data for this day — skip (don't mark as missed)

        # 4. For each habit, check if tags match
        for habit in habits:
            matched = _match_habit_to_tags(habit.title, tags)
            created = _upsert_habit_log(db, habit.id, user_id, date_str, completed=matched)
            if created:
                count += 1

    try:
        db.flush()
    except Exception as e:
        logger.error(f"Failed to flush habit logs: {e}")

    logger.info(f"Habit log sync: {count} new logs created for user {user_id}")
    return count
