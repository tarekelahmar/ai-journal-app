"""
Domain Mapping — 7 user-facing domains → backend LifeDomainScore columns.

Framework alignment (March 2026): user-facing keys now map 1:1 to backend
columns (same names). The expand function is kept for structural consistency
but is now a pass-through since keys == columns.
"""

from __future__ import annotations

from typing import Dict, List


# ── 7 life dimensions (framework-locked) ─────────────────────────

USER_FACING_DOMAINS: List[Dict] = [
    {
        "key": "career",
        "label": "Career / Work",
        "emoji": "💼",
        "backend_column": "career",
        "low": "Struggling",
        "high": "Thriving",
    },
    {
        "key": "relationship",
        "label": "Relationship",
        "emoji": "❤️",
        "backend_column": "relationship",
        "low": "Distant",
        "high": "Connected",
    },
    {
        "key": "family",
        "label": "Family",
        "emoji": "👨‍👩‍👧",
        "backend_column": "family",
        "low": "Disconnected",
        "high": "Close",
    },
    {
        "key": "health",
        "label": "Physical & Mental Health",
        "emoji": "💪",
        "backend_column": "health",
        "low": "Poor",
        "high": "Strong",
    },
    {
        "key": "finance",
        "label": "Finance",
        "emoji": "💰",
        "backend_column": "finance",
        "low": "Stressed",
        "high": "Secure",
    },
    {
        "key": "social",
        "label": "Social",
        "emoji": "👥",
        "backend_column": "social",
        "low": "Isolated",
        "high": "Supported",
    },
    {
        "key": "purpose",
        "label": "Purpose",
        "emoji": "🧭",
        "backend_column": "purpose",
        "low": "Lost",
        "high": "Aligned",
    },
]

# Quick lookup: user key → backend column name (1:1 in framework-aligned model)
_KEY_TO_COLUMN = {d["key"]: d["backend_column"] for d in USER_FACING_DOMAINS}

# Valid user-facing domain keys
DOMAIN_KEYS = [d["key"] for d in USER_FACING_DOMAINS]


def expand_to_backend_scores(user_scores: Dict[str, float]) -> Dict[str, float]:
    """Convert user-facing domain ratings to backend column names.

    With 7 aligned dimensions, keys == columns. This function validates
    and passes through.

    Args:
        user_scores: e.g. {"career": 7.5, "relationship": 6.0, ...}

    Returns:
        e.g. {"career": 7.5, "relationship": 6.0, ...}

    Raises:
        ValueError: if an unknown domain key is provided.
    """
    result: Dict[str, float] = {}
    for key, score in user_scores.items():
        if key not in _KEY_TO_COLUMN:
            raise ValueError(f"Unknown domain key: {key}")
        result[_KEY_TO_COLUMN[key]] = score
    return result
