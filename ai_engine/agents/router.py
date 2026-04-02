"""
ai_engine.agents.router
~~~~~~~~~~~~~~~~~~~~~~~~
Model router — automatically falls back to a cheaper model when a user
is approaching or has exceeded their daily budget cap.

TASK-004-B8

Budget thresholds:
  < 80%  — use the primary model (configured via MODEL_PRIMARY env var)
  80–99% — fall back to cheaper model (MODEL_FALLBACK env var)
  100%+  — block entirely (raise BudgetExceededError)

Usage:
    from ai_engine.agents.router import get_model_for_user

    model_name = get_model_for_user(user_id="user-123", role="user")
    # → "gpt-4o"  or  "gpt-4o-mini"  depending on budget
"""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Model configuration ────────────────────────────────────────────────────────

# Primary model per role
PRIMARY_MODELS: dict[str, str] = {
    "user":       os.environ.get("MODEL_PRIMARY",  "gpt-4o"),
    "pro":        os.environ.get("MODEL_PRO",       "gpt-4o"),
    "enterprise": os.environ.get("MODEL_ENT",       "gpt-4o"),
    "staff":      os.environ.get("MODEL_STAFF",     "gpt-4o"),
}

# Fallback model (used when 80%+ budget consumed)
FALLBACK_MODELS: dict[str, str] = {
    "user":       os.environ.get("MODEL_FALLBACK",      "gpt-4o-mini"),
    "pro":        os.environ.get("MODEL_FALLBACK_PRO",  "gpt-4o-mini"),
    "enterprise": os.environ.get("MODEL_FALLBACK_ENT",  "gpt-4o-mini"),
    "staff":      os.environ.get("MODEL_FALLBACK_STAFF","gpt-4o-mini"),
}

# Alternate names for popular model families (Claude, etc.)
CLAUDE_PRIMARY  = os.environ.get("CLAUDE_MODEL_PRIMARY",  "claude-3-5-sonnet-20241022")
CLAUDE_FALLBACK = os.environ.get("CLAUDE_MODEL_FALLBACK", "claude-3-haiku-20240307")

# Budget threshold at which to switch to fallback
FALLBACK_THRESHOLD = float(os.environ.get("BUDGET_FALLBACK_THRESHOLD", "0.80"))


# ── Public API ─────────────────────────────────────────────────────────────────

def get_model_for_user(
    user_id: Optional[str] = None,
    role: str = "user",
    provider: str = "openai",
) -> str:
    """
    Return the best available LLM model name for the given user.

    If the user has consumed >= FALLBACK_THRESHOLD (80%) of their daily budget,
    automatically returns the fallback (cheaper) model. If budget is fully
    exhausted, raises BudgetExceededError.

    Args:
        user_id:  The user's identifier (used to look up Redis budget).
        role:     Plan role: "user" (free), "pro", "enterprise", "staff".
        provider: "openai" or "anthropic". Defaults to "openai".

    Returns:
        Model name string, e.g. "gpt-4o" or "gpt-4o-mini".

    Raises:
        BudgetExceededError: If daily budget is 100% consumed.
    """
    if not user_id:
        # No user context — return default primary model
        return _primary(role, provider)

    budget_pct = _get_budget_percent(user_id, role)

    if budget_pct >= 1.0:
        # Fully exhausted — raise
        from ai_engine.middleware.rate_limit import BudgetExceededError
        raise BudgetExceededError(
            f"Daily budget exhausted ({budget_pct * 100:.0f}% used). "
            f"Upgrade your plan for higher limits.",
            reset_at=_get_reset_time(),
        )

    if budget_pct >= FALLBACK_THRESHOLD:
        model = _fallback(role, provider)
        logger.info(
            "model_fallback user=%s role=%s budget_pct=%.0f%% model=%s",
            user_id, role, budget_pct * 100, model,
        )
        return model

    model = _primary(role, provider)
    logger.debug(
        "model_primary user=%s role=%s budget_pct=%.0f%% model=%s",
        user_id, role, budget_pct * 100, model,
    )
    return model


def get_model_info(user_id: Optional[str] = None, role: str = "user") -> dict:
    """
    Return a dict describing which model will be used and why.
    Useful for debugging and API responses.
    """
    budget_pct = _get_budget_percent(user_id, role) if user_id else 0.0
    exhausted  = budget_pct >= 1.0
    fallback   = budget_pct >= FALLBACK_THRESHOLD

    return {
        "model":         _fallback(role) if fallback else _primary(role),
        "is_fallback":   fallback,
        "is_exhausted":  exhausted,
        "budget_percent": round(budget_pct * 100, 1),
        "threshold_pct":  int(FALLBACK_THRESHOLD * 100),
        "primary_model":  _primary(role),
        "fallback_model": _fallback(role),
    }


# ── Internal helpers ──────────────────────────────────────────────────────────

def _primary(role: str = "user", provider: str = "openai") -> str:
    if provider == "anthropic":
        return CLAUDE_PRIMARY
    return PRIMARY_MODELS.get(role, PRIMARY_MODELS["user"])


def _fallback(role: str = "user", provider: str = "openai") -> str:
    if provider == "anthropic":
        return CLAUDE_FALLBACK
    return FALLBACK_MODELS.get(role, FALLBACK_MODELS["user"])


def _get_budget_percent(user_id: str, role: str) -> float:
    """
    Return the fraction of daily budget consumed (0.0 – 1.0+).
    Returns 0.0 if Redis is unavailable or budget tracking not configured.
    """
    try:
        from ai_engine.middleware.rate_limit import get_budget_status
        info = get_budget_status(user_id, role)
        if info.get("unlimited"):
            return 0.0
        spent = info.get("spent_cents", 0)
        limit = info.get("limit_cents", 1)
        return spent / max(limit, 1)
    except Exception as exc:
        logger.debug("budget_percent_unavailable: %s", exc)
        return 0.0


def _get_reset_time() -> str:
    """Return ISO-format UTC midnight (budget reset time)."""
    from datetime import datetime, timezone, timedelta
    now   = datetime.now(timezone.utc)
    reset = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return reset.isoformat()
