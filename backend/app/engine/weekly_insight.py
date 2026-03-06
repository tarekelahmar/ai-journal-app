"""
AI Weekly Insight Generator — Track 5 Task 3.

Generates the AI weekly insight text for the dashboard using the LLM.
Falls back to deterministic template when LLM is disabled.

Tone (from framework):
- Direct, not harsh
- Focus on what the data shows, not generic advice
- Name specific patterns, actions, and domains
- End with open loops (things that need attention)
- 2-3 short paragraphs max
- No therapy-speak, no cheerleading
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def generate_weekly_insight(db: Session, user_id: int) -> Optional[Dict]:
    """
    Generate the AI weekly insight for the dashboard.

    1. Get the weekly synthesis data (from journal_synthesis.py)
    2. Get active patterns
    3. Get active actions with their impact/consistency
    4. Get domain scores with deltas
    5. Build a structured prompt and call the LLM
    6. Return: {"headline": str, "body": str, "date_range": str}

    Falls back to template-based version when LLM is disabled.
    """
    from app.engine.journal_synthesis import generate_weekly_synthesis

    synthesis = generate_weekly_synthesis(db, user_id)
    if not synthesis:
        return None

    # Gather supporting data
    patterns_text = _get_patterns_summary(db, user_id)
    actions_text = _get_actions_summary(db, user_id)
    domain_changes = synthesis.domain_changes

    date_range = f"{synthesis.week_start} to {synthesis.week_end}"

    # Try LLM
    enable_llm = os.getenv("ENABLE_LLM_TRANSLATION", "false").lower() == "true"
    if enable_llm:
        try:
            result = _generate_with_llm(synthesis, patterns_text, actions_text, domain_changes)
            if result:
                result["date_range"] = date_range
                return result
        except Exception as e:
            logger.error(f"LLM weekly insight generation failed: {e}")

    # Template fallback
    return _generate_template(synthesis, patterns_text, domain_changes, date_range)


def _generate_with_llm(
    synthesis,
    patterns_text: str,
    actions_text: str,
    domain_changes: Dict[str, float],
) -> Optional[Dict]:
    """Generate insight using the LLM."""
    try:
        import anthropic
    except ImportError:
        return None

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    model = os.getenv(
        "ANTHROPIC_COMPANION_MODEL",
        os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250514"),
    )

    # Build data summary for the prompt
    data_lines = [
        f"Week: {synthesis.week_start} to {synthesis.week_end}",
        f"Entries: {synthesis.entry_count}",
        f"Average score: {synthesis.avg_wellbeing}/10" if synthesis.avg_wellbeing else "No scores",
        f"Score range: {synthesis.score_range[0]} to {synthesis.score_range[1]}" if synthesis.score_range[0] else "",
        f"Trend: {synthesis.trend}",
        f"Phase: {synthesis.phase.phase} ({synthesis.phase.description})",
    ]

    if patterns_text:
        data_lines.append(f"\nPatterns:\n{patterns_text}")

    if actions_text:
        data_lines.append(f"\nActions:\n{actions_text}")

    if domain_changes:
        changes = ", ".join(f"{k}: {'+' if v > 0 else ''}{v}" for k, v in domain_changes.items())
        data_lines.append(f"\nDomain changes this week: {changes}")

    data_summary = "\n".join(line for line in data_lines if line)

    system_prompt = """You are a wellness journal companion generating a weekly dashboard insight.

RULES:
- Write a headline (one sentence, punchy, data-specific) and a body (2-3 short paragraphs).
- Be direct, not harsh. Focus on what the data shows.
- Name specific patterns, actions, and domains by name.
- End with open loops (things that need attention).
- No therapy-speak, no cheerleading, no generic advice.
- The headline should be the most interesting or actionable finding.
- Return valid JSON: {"headline": "...", "body": "..."}

EXAMPLE:
{"headline": "Your floor is rising — the bad days are less bad than they used to be.",
 "body": "Three weeks ago your lows hit 2-3. This week your lowest was 5.0. The structure is holding: exercise + office + social contact continues to be the formula. The pattern is no longer a hypothesis — it's confirmed across 45 entries.\\n\\nFinance is now your most neglected domain — down from 4 to 3 with no action taken. The James conversation enters its third week of avoidance. These are your two open loops."}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=model,
            max_tokens=400,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": f"Generate a weekly insight from this data:\n\n{data_summary}",
            }],
        )

        content = response.content[0].text if response.content else None
        if not content:
            return None

        # Strip markdown fences
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
        if content.endswith("```"):
            content = content.rsplit("```", 1)[0]
        content = content.strip()

        return json.loads(content)

    except json.JSONDecodeError as e:
        logger.error(f"Weekly insight: invalid JSON from LLM: {e}")
        return None
    except Exception as e:
        logger.error(f"Weekly insight LLM call failed: {e}")
        return None


def _generate_template(
    synthesis,
    patterns_text: str,
    domain_changes: Dict[str, float],
    date_range: str,
) -> Dict:
    """Deterministic template fallback when LLM is disabled."""
    # Headline based on trend
    if synthesis.trend == "up" and synthesis.avg_wellbeing and synthesis.avg_wellbeing >= 7:
        headline = f"Solid week — averaging {synthesis.avg_wellbeing}/10 with an upward trend."
    elif synthesis.trend == "up":
        headline = f"Trending up this week — average {synthesis.avg_wellbeing}/10."
    elif synthesis.trend == "down" and synthesis.avg_wellbeing and synthesis.avg_wellbeing < 5:
        headline = f"Tough week — average dropped to {synthesis.avg_wellbeing}/10."
    elif synthesis.trend == "down":
        headline = f"Slight dip this week — average {synthesis.avg_wellbeing}/10."
    else:
        headline = f"Steady week — averaging {synthesis.avg_wellbeing}/10 across {synthesis.entry_count} entries."

    # Body
    body_parts = []

    # Score range
    if synthesis.score_range[0] != synthesis.score_range[1]:
        body_parts.append(
            f"This week: {synthesis.entry_count} entries, scores ranged from "
            f"{synthesis.score_range[0]} to {synthesis.score_range[1]}. "
            f"Trend: {synthesis.trend}."
        )
    else:
        body_parts.append(
            f"This week: {synthesis.entry_count} entries. "
            f"Trend: {synthesis.trend}."
        )

    # Top pattern
    if synthesis.top_pattern:
        body_parts.append(f"Top pattern: {synthesis.top_pattern}.")
    else:
        body_parts.append("No confirmed patterns yet.")

    # Domain changes
    if domain_changes:
        declining = [(k, v) for k, v in domain_changes.items() if v < 0]
        if declining:
            worst = sorted(declining, key=lambda x: x[1])[0]
            body_parts.append(f"Watch: {worst[0]} dropped {abs(worst[1]):.1f} points this week.")

    body = " ".join(body_parts)

    return {
        "headline": headline,
        "body": body,
        "date_range": date_range,
    }


# ── Helper functions ──────────────────────────────────────────────

def _get_patterns_summary(db: Session, user_id: int) -> str:
    """Get a text summary of active patterns for the LLM prompt."""
    try:
        from app.engine.memory.pattern_manager import PatternManager
        mgr = PatternManager(db)
        patterns = mgr.get_active_patterns(user_id=user_id)

        if not patterns:
            return "No confirmed patterns."

        lines = []
        for p in patterns[:5]:
            rel = p.relationship_json or {}
            name = rel.get("pattern_name", p.pattern_type)
            effect = rel.get("effect_size", 0)
            obs = p.times_observed
            status = p.status
            lines.append(f"- {name} (effect: {effect:+.1f}, {obs} observations, {status})")

        return "\n".join(lines)
    except Exception:
        return ""


def _get_actions_summary(db: Session, user_id: int) -> str:
    """Get a text summary of active actions for the LLM prompt."""
    try:
        from app.domain.models.action import Action
        from app.domain.models.habit_log import HabitLog
        from datetime import datetime

        actions = (
            db.query(Action)
            .filter(Action.user_id == user_id, Action.status == "active")
            .all()
        )

        if not actions:
            return "No active actions."

        lines = []
        for a in actions:
            if a.action_type == "habit":
                thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
                today_str = datetime.utcnow().strftime("%Y-%m-%d")
                log_count = (
                    db.query(HabitLog)
                    .filter(
                        HabitLog.action_id == a.id,
                        HabitLog.completed == True,
                        HabitLog.log_date >= thirty_days_ago,
                        HabitLog.log_date <= today_str,
                    )
                    .count()
                )
                lines.append(f"- Habit: \"{a.title}\" ({log_count}/30 days consistency)")
            else:
                days_old = (datetime.utcnow() - a.created_at).days if a.created_at else 0
                lines.append(f"- Completable: \"{a.title}\" ({days_old} days old)")

        return "\n".join(lines)
    except Exception:
        return ""
