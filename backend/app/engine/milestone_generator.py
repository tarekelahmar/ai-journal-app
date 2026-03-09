"""
Milestone Generator — auto-generates milestones for completable actions.

Uses Anthropic Claude when ENABLE_LLM_TRANSLATION=true,
falls back to keyword-based templates when LLM is disabled.

Only generates for action_type == 'completable'. Returns empty for habits.
"""

from __future__ import annotations

import json
import logging
import os
from typing import List, Optional

from sqlalchemy.orm import Session

from app.domain.repositories.action_milestone_repository import ActionMilestoneRepository

logger = logging.getLogger(__name__)


# ── Template fallback ────────────────────────────────────────────

TEMPLATE_MILESTONES: dict[str, list[str]] = {
    "conversation": ["Prepare what to say", "Schedule the conversation", "Have the conversation"],
    "talk": ["Prepare what to say", "Schedule the conversation", "Have the conversation"],
    "discuss": ["Prepare what to say", "Schedule the conversation", "Have the conversation"],
    "review": ["Gather the data", "Analyse findings", "Decide on next steps"],
    "apply": ["Research options", "Prepare application", "Submit"],
    "submit": ["Gather required documents", "Fill in the forms", "Submit"],
    "plan": ["Research options", "Draft the plan", "Finalise and commit"],
    "organise": ["Decide what needs doing", "Prepare everything", "Execute"],
    "exercise": [],  # Habits don't get milestones
    "daily": [],     # Habits don't get milestones
}

DEFAULT_MILESTONES = ["Research and plan", "Take first step", "Complete the action"]


# ── LLM Prompt ───────────────────────────────────────────────────

MILESTONE_SYSTEM_PROMPT = """You are helping break down a personal action into concrete milestones.

The action is something a person has committed to in their journal. Generate 2-4 milestones that represent the logical steps to complete this action.

Rules:
- Each milestone should be a clear, specific step
- Order them chronologically (what needs to happen first)
- Keep each milestone under 10 words
- Don't add milestones that are obvious or trivial (e.g. "Decide to do it")
- The final milestone should be the actual completion of the action
- Return ONLY a JSON array of strings, no other text

Example:
Action: "Have the scope conversation with James"
Context: "I keep putting off talking to James about the project scope"
Output: ["Prepare key points to discuss", "Schedule a meeting with James", "Have the conversation"]

Example:
Action: "Review last month's spending"
Context: "I don't know where my money goes"
Output: ["Download bank statements", "Categorise all transactions", "Identify top 3 unnecessary expenses"]"""


# ── Main Function ────────────────────────────────────────────────

def generate_milestones_for_action(
    db: Session,
    action_id: int,
    user_id: int,
    action_title: str,
    action_type: str,
    journal_context: str = "",
) -> List[dict]:
    """
    Generate milestone suggestions for a completable action.

    Only generates for action_type == 'completable'. Returns empty for habits.
    Tries LLM first, falls back to templates.

    Returns list of dicts: [{"title": str, "sort_order": int}]
    """
    if action_type != "completable":
        return []

    # Try LLM first
    titles = _generate_via_llm(action_title, journal_context)

    # Fall back to templates
    if titles is None:
        titles = _generate_via_template(action_title)

    if not titles:
        return []

    # Persist milestones
    repo = ActionMilestoneRepository(db)
    results = []
    for i, title in enumerate(titles):
        ms = repo.create(
            action_id=action_id,
            title=title,
            sort_order=i,
        )
        results.append({"title": ms.title, "sort_order": ms.sort_order})

    logger.info(f"Generated {len(results)} milestones for action {action_id}")
    return results


# ── LLM Generation ───────────────────────────────────────────────

def _generate_via_llm(action_title: str, journal_context: str) -> Optional[List[str]]:
    """Try to generate milestones via Anthropic Claude. Returns None if LLM is disabled."""
    enable_llm = os.getenv("ENABLE_LLM_TRANSLATION", "false").lower() == "true"
    if not enable_llm:
        logger.info("LLM disabled — milestone generation using templates")
        return None

    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic package not installed — using template milestones")
        return None

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — using template milestones")
        return None

    user_message = f'Action: "{action_title}"'
    if journal_context:
        user_message += f'\nContext: "{journal_context[:500]}"'

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5"),
            max_tokens=300,
            system=MILESTONE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        content = response.content[0].text if response.content else None
        if not content:
            logger.warning("LLM returned empty response for milestone generation")
            return None

        # Strip markdown fences if present
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
        if content.endswith("```"):
            content = content.rsplit("```", 1)[0]
        content = content.strip()

        # Parse JSON array
        titles = json.loads(content)
        if not isinstance(titles, list):
            logger.error("LLM milestone response is not a list")
            return None

        # Validate: strings only, 2-4 items, reasonable length
        titles = [str(t).strip() for t in titles if isinstance(t, str) and t.strip()]
        titles = titles[:4]  # Cap at 4

        if len(titles) < 2:
            logger.warning("LLM returned fewer than 2 milestones — using templates")
            return None

        logger.info(f"LLM generated {len(titles)} milestones")
        return titles

    except json.JSONDecodeError as e:
        logger.error(f"Milestone generation: invalid JSON from LLM: {e}")
        return None
    except Exception as e:
        logger.error(f"Milestone generation LLM call failed: {e}")
        return None


# ── Template Generation ──────────────────────────────────────────

def _generate_via_template(action_title: str) -> List[str]:
    """Generate milestones from keyword-based templates."""
    title_lower = action_title.lower()

    for keyword, milestones in TEMPLATE_MILESTONES.items():
        if keyword in title_lower:
            return milestones  # May be empty for habit keywords

    return DEFAULT_MILESTONES
