"""
Environment Mode Configuration

Create ENV_MODE (dev, staging, production) with specific rules for authentication,
safety, and logging.
"""

from __future__ import annotations

import os
from enum import Enum
from typing import Dict, Any


class EnvironmentMode(str, Enum):
    """Environment mode."""
    DEV = "dev"
    STAGING = "staging"
    PRODUCTION = "production"


def get_env_mode() -> EnvironmentMode:
    """Get current environment mode from ENV_MODE env var."""
    mode_str = os.getenv("ENV_MODE", "dev").lower()
    try:
        return EnvironmentMode(mode_str)
    except ValueError:
        return EnvironmentMode.DEV


def get_mode_config() -> Dict[str, Any]:
    """
    Single source of truth for environment configuration.

    Returns dict with:
    - auth_mode: "public" or "private"
    - safety_strict: bool
    - logging_level: str

    Rules:
    - dev: AUTH_MODE can be set to "public" or "private" (default: "public")
    - staging: AUTH_MODE is always "private" (enforced)
    - production: AUTH_MODE is always "private" (enforced, fail hard if misconfigured)
    """
    mode = get_env_mode()

    # Enforce auth mode based on environment
    if mode == EnvironmentMode.PRODUCTION:
        auth_mode_override = os.getenv("AUTH_MODE", "").strip().lower()
        if auth_mode_override and auth_mode_override != "private":
            import logging
            logger = logging.getLogger(__name__)
            logger.critical(
                "PRODUCTION_AUTH_MISCONFIGURED",
                extra={
                    "env_mode": mode.value,
                    "auth_mode_override": auth_mode_override,
                    "enforced_auth_mode": "private",
                },
            )
        auth_mode = "private"
    elif mode == EnvironmentMode.STAGING:
        auth_mode = "private"
    else:
        auth_mode = os.getenv("AUTH_MODE", "public").strip().lower()
        if auth_mode not in ["public", "private"]:
            auth_mode = "public"

    configs = {
        EnvironmentMode.DEV: {
            "auth_mode": auth_mode,
            "safety_strict": False,
            "logging_level": "DEBUG",
        },
        EnvironmentMode.STAGING: {
            "auth_mode": auth_mode,
            "safety_strict": True,
            "logging_level": "INFO",
        },
        EnvironmentMode.PRODUCTION: {
            "auth_mode": auth_mode,
            "safety_strict": True,
            "logging_level": "WARNING",
        },
    }

    return configs.get(mode, configs[EnvironmentMode.DEV])


def is_production() -> bool:
    """Check if running in production mode."""
    return get_env_mode() == EnvironmentMode.PRODUCTION


def is_staging() -> bool:
    """Check if running in staging mode."""
    return get_env_mode() == EnvironmentMode.STAGING


def is_dev() -> bool:
    """Check if running in dev mode."""
    return get_env_mode() == EnvironmentMode.DEV
