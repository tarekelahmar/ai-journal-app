"""
Diagnostic Profile Engine — converts diagnostic responses into a structured User Profile.

Orchestrates: response extraction → profile building → LLM synthesis → domain seeding → preference update.
"""

import json
import logging
import math
import os
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.domain.models.user_profile import UserProfile
from app.domain.repositories.diagnostic_response_repository import DiagnosticResponseRepository
from app.domain.repositories.user_profile_repository import UserProfileRepository

logger = logging.getLogger(__name__)


# ── Concern Track Constants ─────────────────────────────────────────

CONCERN_TRACKS = {
    "avoidance_and_inaction",
    "relationship_patterns",
    "identity_and_direction",
    "emotional_regulation",
    "behavioural_loops",
    "life_transition",
    "self_worth_and_confidence",
    "general_self_improvement",
}

DOMAIN_QUESTION_MAP = {
    "q3_career": "career",
    "q4_relationship": "relationship",
    "q5_family": "family",
    "q6_health": "health",
    "q7_finance": "finance",
    "q8_social": "social",
    "q9_purpose": "purpose",
}


# ── Main Pipeline ───────────────────────────────────────────────────


def complete_diagnostic(db: Session, user_id: int) -> UserProfile:
    """
    Full pipeline: build profile, generate synthesis, store everything.

    1. Build profile_json from responses
    2. Call LLM for synthesis text (who_you_are, patterns, ai_approach)
    3. Store in UserProfile table
    4. Seed LifeDomainScore from diagnostic domain scores
    5. Update UserPreference (depth_level, diagnostic_completed)
    6. Return the profile
    """
    repo = DiagnosticResponseRepository(db)
    responses = {r.question_id: r.response_json for r in repo.get_all(user_id)}

    if not responses:
        logger.warning(f"No diagnostic responses found for user {user_id}")
        profile_repo = UserProfileRepository(db)
        return profile_repo.upsert(user_id=user_id, profile_json={}, diagnostic_completed=False)

    # Build structured profile
    profile_json = {
        "communication_settings": _extract_communication_settings(responses),
        "focus": _extract_focus(responses),
        "pattern_baseline": _extract_pattern_baseline(responses),
        "motivational_structure": _extract_motivational_structure(responses),
        "narrative_context": _extract_narrative_context(responses),
    }

    # Generate synthesis text via LLM (with template fallback)
    synthesis = _generate_synthesis_text(profile_json, responses)

    # Store profile
    profile_repo = UserProfileRepository(db)
    profile = profile_repo.upsert(
        user_id=user_id,
        profile_json=profile_json,
        who_you_are=synthesis.get("who_you_are"),
        patterns_identified=synthesis.get("patterns"),
        ai_approach_text=synthesis.get("ai_approach"),
        primary_concern_track=profile_json["focus"].get("primary_concern_track"),
        secondary_concern_track=profile_json["focus"].get("secondary_concern_track"),
        depth_level=profile_json["communication_settings"].get("depth_level"),
        challenge_tolerance=profile_json["communication_settings"].get("challenge_tolerance"),
        processing_style=profile_json["communication_settings"].get("processing_style"),
        diagnostic_completed=True,
        diagnostic_completed_at=datetime.utcnow(),
    )

    # Seed life domain scores
    _seed_domain_scores(db, user_id, responses)

    # Update user preferences
    _update_preferences(db, user_id, profile_json)

    return profile


# ── Extraction Helpers ──────────────────────────────────────────────


def _extract_communication_settings(responses: Dict) -> dict:
    """
    Build communication_settings from Q2 (honesty rating) and Q10 (6 behavioural sliders).
    """
    # Q2: honesty self-rating (1-10)
    q2 = responses.get("q2", {})
    honesty_score = q2.get("value", 5)

    # Q10: behavioural sliders
    q10 = responses.get("q10", {})
    structure = q10.get("structure", 3)
    avoidance = q10.get("avoidance", 3)
    accountability = q10.get("accountability", 3)
    processing = q10.get("processing", 3)
    emotional = q10.get("emotional", 3)
    follow_through = q10.get("follow_through", 3)

    # Derive depth_level from Q2: ≤3 → 1, 4-6 → 2, 7-10 → 3
    if honesty_score <= 3:
        depth_level = 1
    elif honesty_score <= 6:
        depth_level = 2
    else:
        depth_level = 3

    # Derive processing_style from processing + emotional sliders
    if processing <= 2 and emotional <= 2:
        processing_style = "analytical"
    elif processing >= 4 or emotional >= 4:
        processing_style = "emotional"
    else:
        processing_style = "mixed"

    # Challenge tolerance maps directly from avoidance slider (1-5)
    challenge_tolerance = avoidance

    # Self-awareness from Q2 mapped to 1-5 (divide by 2, round)
    self_awareness_level = max(1, min(5, round(honesty_score / 2)))

    # Accountability type
    if accountability <= 2:
        accountability_type = "external"
    elif accountability >= 4:
        accountability_type = "internal"
    else:
        accountability_type = "mixed"

    # Emotional engagement from slider (1-5)
    emotional_engagement = emotional

    return {
        "depth_level": depth_level,
        "processing_style": processing_style,
        "challenge_tolerance": challenge_tolerance,
        "structure_preference": structure,
        "follow_through_baseline": follow_through,
        "self_awareness_level": self_awareness_level,
        "emotional_engagement": emotional_engagement,
        "accountability_type": accountability_type,
    }


def _extract_focus(responses: Dict) -> dict:
    """
    Build focus config from Q11 (concern track selection) and Q3-Q9 (domain scores).
    """
    # Q11: concern track selection
    q11 = responses.get("q11", {})
    concern_values = q11.get("values", [])
    primary_concern = concern_values[0] if len(concern_values) > 0 else None
    secondary_concern = concern_values[1] if len(concern_values) > 1 else None

    # Domain scores from Q3-Q9
    domain_scores = {}
    for q_id, domain in DOMAIN_QUESTION_MAP.items():
        resp = responses.get(q_id, {})
        score = resp.get("score")
        if score is not None:
            domain_scores[domain] = float(score)

    # Domains under pressure (score < 5)
    domains_under_pressure = [d for d, s in domain_scores.items() if s < 5]

    # Priority domain: from FU-3a if available, else lowest-scoring domain
    fu3a = responses.get("fu_3a", {})
    priority_domain = fu3a.get("domain", fu3a.get("value"))
    if not priority_domain and domain_scores:
        priority_domain = min(domain_scores, key=domain_scores.get)

    # Professional support status from Q12
    q12 = responses.get("q12", {})
    professional_support = q12.get("value", "no")

    return {
        "primary_concern_track": primary_concern,
        "secondary_concern_track": secondary_concern,
        "priority_domain": priority_domain,
        "domains_under_pressure": domains_under_pressure,
        "domain_scores": domain_scores,
        "professional_support_status": professional_support,
    }


def _extract_pattern_baseline(responses: Dict) -> dict:
    """
    Build pattern baseline from narrative responses.
    """
    # Self-identified patterns from track-specific probes
    identified_patterns = []

    # Check all PA-3 track probes for pattern content
    for key, val in responses.items():
        if key.startswith("pa_3_") and isinstance(val, dict):
            text = val.get("value", "")
            if text and len(text) > 20:
                identified_patterns.append({
                    "name": f"Pattern from {key}",
                    "description": text[:300],
                    "evidence_domains": [],
                    "severity": "medium",
                })

    # Blind spot indicators from PR-1a (values-behaviour gap)
    blind_spots = []
    pr1a = responses.get("pr_1a", {})
    if pr1a.get("value"):
        blind_spots.append(pr1a["value"][:200])

    # Previous change attempts from PA-3-AV2 or other probes
    previous_attempts = []
    for key in ["pa_3_av2", "pa_3_bl2", "pr_3_bl2"]:
        resp = responses.get(key, {})
        text = resp.get("value", "")
        if text:
            previous_attempts.append(text[:200])

    # Key relationships from PR-2
    key_relationships = []
    pr2 = responses.get("pr_2", {})
    if isinstance(pr2, dict):
        relationships = pr2.get("relationships", [])
        if isinstance(relationships, list):
            for rel in relationships[:5]:
                if isinstance(rel, dict) and rel.get("name"):
                    key_relationships.append({
                        "name": rel["name"],
                        "context": rel.get("description", rel.get("context", rel.get("sentence", "")))[:200],
                    })

    # Known triggers from PA-2b (crisis/failure narrative)
    known_triggers = []
    pa2b = responses.get("pa_2b", {})
    if pa2b.get("value"):
        known_triggers.append(pa2b["value"][:300])

    # Peak conditions from PA-2a (positive experience)
    peak_conditions = []
    pa2a = responses.get("pa_2a", {})
    if pa2a.get("value"):
        peak_conditions.append(pa2a["value"][:300])

    return {
        "identified_patterns": identified_patterns,
        "blind_spot_indicators": blind_spots,
        "previous_change_attempts": previous_attempts,
        "key_relationships": key_relationships,
        "known_triggers": known_triggers,
        "peak_conditions": peak_conditions,
    }


def _extract_motivational_structure(responses: Dict) -> dict:
    """
    Build motivational structure from future authoring responses.
    """
    # Feared future (FU-1)
    fu1 = responses.get("fu_1", {})
    feared_future = fu1.get("value", "")

    # Desired future (FU-2)
    fu2 = responses.get("fu_2", {})
    desired_future = fu2.get("value", "")

    # Urgency: inferred from feared future vividness (length + specificity)
    if feared_future and len(feared_future) > 150:
        urgency_level = "high"
    elif feared_future and len(feared_future) > 50:
        urgency_level = "medium"
    else:
        urgency_level = "low"

    # Stated commitments (FU-3b)
    fu3b = responses.get("fu_3b", {})
    commitments_text = fu3b.get("value", "")
    # Split into list if possible (by newlines or semicolons)
    stated_commitments = []
    if commitments_text:
        for delimiter in ["\n", ";", ","]:
            if delimiter in commitments_text:
                stated_commitments = [c.strip() for c in commitments_text.split(delimiter) if c.strip()]
                break
        if not stated_commitments:
            stated_commitments = [commitments_text.strip()]

    # Sacrifice (FU-3c)
    fu3c = responses.get("fu_3c", {})
    sacrifice_named = fu3c.get("value", "")

    # Values-behaviour gap (PR-1a)
    pr1a = responses.get("pr_1a", {})
    values_behaviour_gap = pr1a.get("value", "")

    # Priority domain (FU-3a)
    fu3a = responses.get("fu_3a", {})
    priority_domain = fu3a.get("domain", fu3a.get("value"))

    # Feared future vividness (for AI urgency calibration)
    feared_future_vividness = urgency_level

    return {
        "urgency_level": urgency_level,
        "feared_future": feared_future,
        "desired_future": desired_future,
        "feared_future_vividness": feared_future_vividness,
        "stated_commitments": stated_commitments,
        "sacrifice_named": sacrifice_named,
        "values_behaviour_gap": values_behaviour_gap,
        "priority_domain": priority_domain,
    }


def _extract_narrative_context(responses: Dict) -> dict:
    """
    Compile narrative context from all text responses.
    """
    # Life chapters (PA-1)
    pa1 = responses.get("pa_1", {})
    life_chapters = []
    chapters_data = pa1.get("values", pa1.get("chapters", []))
    if isinstance(chapters_data, list):
        for ch in chapters_data[:5]:
            if isinstance(ch, dict) and ch.get("title"):
                life_chapters.append({
                    "title": ch["title"],
                    "summary": ch.get("description", ch.get("summary", ch.get("text", "")))[:300],
                })

    # Defining experiences
    pa2a = responses.get("pa_2a", {})
    positive_defining = pa2a.get("value", "")

    pa2b = responses.get("pa_2b", {})
    negative_defining = pa2b.get("value", "")

    pa2c = responses.get("pa_2c", {})
    turning_point = pa2c.get("value", "")

    # Feared and desired futures
    fu1 = responses.get("fu_1", {})
    feared_future = fu1.get("value", "")

    fu2 = responses.get("fu_2", {})
    desired_future = fu2.get("value", "")

    # Open door responses (Q13 + track-specific FU-3d)
    q13 = responses.get("q13", {})
    open_door = q13.get("value", "")

    # Track-specific future probes
    for key in ["fu_3d_av", "fu_3d_rp", "fu_3d_id", "fu_3d_lt", "fu_3d_sw"]:
        resp = responses.get(key, {})
        text = resp.get("value", "")
        if text:
            open_door = (open_door + "\n" + text).strip() if open_door else text

    # Current honest state per domain (from Q3-Q9 "why" texts)
    current_state = {}
    for q_id, domain in DOMAIN_QUESTION_MAP.items():
        resp = responses.get(q_id, {})
        why = resp.get("why", "")
        if why:
            current_state[domain] = why

    return {
        "life_chapters": life_chapters,
        "positive_defining_experience": positive_defining,
        "negative_defining_experience": negative_defining,
        "turning_point": turning_point,
        "feared_future": feared_future,
        "desired_future": desired_future,
        "current_honest_state": current_state,
        "open_door_response": open_door,
    }


# ── Synthesis Generation ────────────────────────────────────────────


SYNTHESIS_SYSTEM_PROMPT = """You are generating a personal portrait for someone who has completed a detailed life diagnostic.

Write in second person ("you"). Be direct and warm. No therapy language. No hedging.
Your job is to reflect back what they've shown you — not to diagnose, advise, or comfort.

Generate THREE sections as JSON:

1. "who_you_are": 3-4 sentences about their operating style. Reference specific behavioural patterns from their responses, not generic personality descriptors. Be observational, not evaluative.

2. "patterns": An array of 2-4 pattern objects, each with:
   - "name": A memorable title (e.g. "The Avoidance Loop", "Structure = Floor")
   - "description": 3-4 sentences. Each pattern must cite evidence from at least 2 different responses. Use their own phrases where impactful (brief — 3-5 words).
   - "evidence_domains": array of life domain strings this pattern touches
   - "severity": "high", "medium", or "low"

3. "ai_approach": 2-3 sentences describing how the AI companion will work with this person based on their communication profile.

Rules:
- Never use: "It sounds like", "I hear you", "It's great that", "You should", "Have you considered"
- Tone: like a perceptive friend who respects them enough to be honest
- Reference their actual words and scores, not abstractions
- Return ONLY valid JSON, no markdown fences, no preamble"""


def _generate_synthesis_text(profile_json: dict, responses: Dict) -> dict:
    """
    Generate the three synthesis text blocks using the LLM.
    Falls back to templates when LLM is disabled.
    """
    enable_llm = os.getenv("ENABLE_LLM_TRANSLATION", "false").lower() == "true"
    if not enable_llm:
        logger.info("LLM disabled — using template synthesis")
        return _template_synthesis(profile_json, responses)

    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic package not installed — using template synthesis")
        return _template_synthesis(profile_json, responses)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — using template synthesis")
        return _template_synthesis(profile_json, responses)

    # Build condensed user message with key response excerpts
    user_message = _build_synthesis_user_message(profile_json, responses)

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5"),
            max_tokens=1500,
            system=SYNTHESIS_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        content = response.content[0].text if response.content else None
        if not content:
            logger.warning("LLM returned empty response for synthesis")
            return _template_synthesis(profile_json, responses)

        # Strip markdown fences if present
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
        if content.endswith("```"):
            content = content.rsplit("```", 1)[0]
        content = content.strip()

        parsed = json.loads(content)

        return {
            "who_you_are": parsed.get("who_you_are", ""),
            "patterns": parsed.get("patterns", []),
            "ai_approach": parsed.get("ai_approach", ""),
        }

    except json.JSONDecodeError as e:
        logger.error(f"Synthesis: invalid JSON from LLM: {e}")
        return _template_synthesis(profile_json, responses)
    except Exception as e:
        logger.error(f"Synthesis LLM call failed: {e}")
        return _template_synthesis(profile_json, responses)


def _build_synthesis_user_message(profile_json: dict, responses: Dict) -> str:
    """Build condensed user message for synthesis LLM call."""
    parts = []

    # Q1: what brought you here
    q1 = responses.get("q1", {})
    if q1.get("value"):
        parts.append(f"What brought them here: {q1['value'][:300]}")

    # Q2: honesty score
    q2 = responses.get("q2", {})
    if q2.get("value"):
        parts.append(f"Self-honesty rating: {q2['value']}/10")

    # Domain scores + why texts
    domain_lines = []
    for q_id, domain in DOMAIN_QUESTION_MAP.items():
        resp = responses.get(q_id, {})
        score = resp.get("score")
        why = resp.get("why", "")
        if score is not None:
            line = f"  {domain}: {score}/10"
            if why:
                line += f" — \"{why[:100]}\""
            domain_lines.append(line)
    if domain_lines:
        parts.append("Domain scores:\n" + "\n".join(domain_lines))

    # Q10: behavioural sliders
    q10 = responses.get("q10", {})
    if q10:
        slider_parts = [f"{k}={v}" for k, v in q10.items()]
        parts.append(f"Behavioural sliders: {', '.join(slider_parts)}")

    # Q11: concern track
    q11 = responses.get("q11", {})
    if q11.get("values"):
        parts.append(f"Concern tracks selected: {', '.join(q11['values'])}")

    # Life chapters (titles only)
    pa1 = responses.get("pa_1", {})
    chapters = pa1.get("values", pa1.get("chapters", []))
    if isinstance(chapters, list) and chapters:
        titles = [ch.get("title", "untitled") for ch in chapters if isinstance(ch, dict)]
        parts.append(f"Life chapters: {', '.join(titles)}")

    # Key narrative excerpts (truncated)
    for key, label in [
        ("pa_2a", "Positive defining experience"),
        ("pa_2b", "Negative defining experience"),
        ("pr_1a", "Values-behaviour gap"),
        ("pr_1b", "Current avoidance"),
        ("fu_1", "Feared future"),
        ("fu_2", "Desired future"),
        ("fu_3b", "Commitments"),
        ("q13", "Open door"),
    ]:
        resp = responses.get(key, {})
        text = resp.get("value", "")
        if text:
            parts.append(f"{label}: \"{text[:200]}\"")

    # Communication settings summary
    comm = profile_json.get("communication_settings", {})
    parts.append(
        f"Communication profile: depth {comm.get('depth_level', 2)}, "
        f"{comm.get('processing_style', 'mixed')} processor, "
        f"challenge tolerance {comm.get('challenge_tolerance', 3)}/5, "
        f"follow-through {comm.get('follow_through_baseline', 3)}/5"
    )

    return "\n\n".join(parts)


def _template_synthesis(profile_json: dict, responses: Dict) -> dict:
    """Template-based synthesis when LLM is disabled."""
    comm = profile_json.get("communication_settings", {})
    focus = profile_json.get("focus", {})
    motiv = profile_json.get("motivational_structure", {})

    # who_you_are — map communication settings to template sentences
    processing_desc = {
        "analytical": "internally before you're ready to talk about them",
        "emotional": "by talking or writing things out",
        "mixed": "through a mix of reflection and conversation",
    }
    processing_text = processing_desc.get(comm.get("processing_style", "mixed"), "through a mix of reflection and conversation")

    follow = comm.get("follow_through_baseline", 3)
    follow_text = "strong follow-through" if follow >= 4 else "a gap between knowing and doing" if follow <= 2 else "inconsistent follow-through"

    awareness = comm.get("self_awareness_level", 3)
    awareness_text = "high — you see your patterns clearly" if awareness >= 4 else "developing — you're starting to notice what drives your behaviour"

    who_you_are = (
        f"You process things {processing_text}. "
        f"You have {follow_text}. "
        f"Your self-awareness is {awareness_text}."
    )

    # patterns — derive from concern track + domain scores
    patterns = []
    primary_track = focus.get("primary_concern_track", "")
    domains_under_pressure = focus.get("domains_under_pressure", [])

    track_patterns = {
        "avoidance_and_inaction": {
            "name": "The Avoidance Pattern",
            "description": "You tend to identify what needs to happen and then defer action. This pattern appears across multiple areas of your life.",
            "severity": "high",
        },
        "relationship_patterns": {
            "name": "Relational Repetition",
            "description": "Similar dynamics play out across your relationships. The roles and outcomes feel familiar because the underlying pattern is consistent.",
            "severity": "high",
        },
        "identity_and_direction": {
            "name": "The Direction Gap",
            "description": "You know something needs to change but the clarity about what hasn't arrived. The uncertainty creates stagnation rather than exploration.",
            "severity": "medium",
        },
        "emotional_regulation": {
            "name": "Emotional Volatility",
            "description": "Your emotional state fluctuates more than you'd like. The coping mechanisms you use provide short-term relief but don't address the underlying instability.",
            "severity": "high",
        },
        "behavioural_loops": {
            "name": "The Loop",
            "description": "A behaviour you want to change keeps reasserting itself. You know the triggers, you know the consequences, but the pattern persists.",
            "severity": "high",
        },
        "life_transition": {
            "name": "Between Chapters",
            "description": "You're in the gap between what was and what's next. The old chapter has ended but the new one hasn't fully started.",
            "severity": "medium",
        },
        "self_worth_and_confidence": {
            "name": "The Inner Critic",
            "description": "Your self-belief doesn't match your capability. The gap between what you can do and what you think you deserve creates friction in multiple areas.",
            "severity": "high",
        },
        "general_self_improvement": {
            "name": "Optimisation Mode",
            "description": "Things are functional but you want them to be better. The risk is optimising without direction — getting more efficient at a life you haven't fully chosen.",
            "severity": "low",
        },
    }

    if primary_track in track_patterns:
        pattern = track_patterns[primary_track].copy()
        pattern["evidence_domains"] = domains_under_pressure[:3]
        patterns.append(pattern)

    # Add a structure/follow-through pattern if relevant
    if follow <= 2:
        patterns.append({
            "name": "Knowing Without Doing",
            "description": "You see what needs to change clearly but don't follow through consistently. The gap is execution, not awareness.",
            "evidence_domains": domains_under_pressure[:2],
            "severity": "medium",
        })

    # ai_approach
    challenge_text = "be direct with you" if comm.get("challenge_tolerance", 3) >= 3 else "build trust before challenging you"
    primary_focus = (primary_track or "general").replace("_", " ")

    ai_approach = (
        f"Your AI companion will operate at depth level {comm.get('depth_level', 2)}. "
        f"It will {challenge_text}. "
        f"Primary focus: {primary_focus}."
    )

    return {
        "who_you_are": who_you_are,
        "patterns": patterns,
        "ai_approach": ai_approach,
    }


# ── Domain Score Seeding ────────────────────────────────────────────


def _seed_domain_scores(db: Session, user_id: int, responses: Dict):
    """Seed LifeDomainScore from diagnostic domain scores."""
    from app.domain.models.life_domain_score import LifeDomainScore

    scores = {}
    for q_id, domain in DOMAIN_QUESTION_MAP.items():
        resp = responses.get(q_id, {})
        score = resp.get("score")
        if score is not None:
            scores[domain] = max(1.0, min(10.0, float(score)))

    if not scores:
        return

    today = datetime.utcnow().strftime("%Y-%m-%d")

    existing = db.query(LifeDomainScore).filter(
        LifeDomainScore.user_id == user_id,
        LifeDomainScore.score_date == today,
    ).first()

    if existing:
        for domain, score in scores.items():
            existing.set_score(domain, score)
    else:
        lds = LifeDomainScore(user_id=user_id, score_date=today, **scores)
        db.add(lds)

    db.commit()


# ── Preference Update ───────────────────────────────────────────────


def _update_preferences(db: Session, user_id: int, profile_json: dict):
    """Update UserPreference from diagnostic results."""
    from app.domain.models.user_preference import UserPreference

    pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
    if not pref:
        pref = UserPreference(user_id=user_id)
        db.add(pref)

    comm = profile_json.get("communication_settings", {})
    pref.preferred_depth_level = comm.get("depth_level", 2)
    pref.diagnostic_completed = True
    pref.journal_onboarded = True  # Skip app onboarding

    db.commit()
