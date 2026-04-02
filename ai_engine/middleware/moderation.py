"""
ai_engine.middleware.moderation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
OpenAI Moderation API integration — screens every user input before sending
to the LLM to detect and block harmful content.

TASK-004-B4

Usage:
    from ai_engine.middleware.moderation import check_moderation

    check_moderation(text, user_id="user-123")  # raises ModerationFlaggedError if harmful
"""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────

MODERATION_ENABLED = os.environ.get("MODERATION_ENABLED", "true").lower() == "true"
OPENAI_API_KEY     = os.environ.get("OPENAI_API_KEY", "")

# Categories we treat as hard-block (refuse + log)
HARD_BLOCK_CATEGORIES = {
    "sexual/minors",
    "violence/graphic",
    "self-harm/instructions",
    "harassment/threatening",
}

# Categories we soft-block (warn but allow through with extra caution flag)
SOFT_BLOCK_CATEGORIES = {
    "sexual",
    "violence",
    "self-harm",
    "harassment",
    "hate",
    "hate/threatening",
    "self-harm/intent",
}


class ModerationFlaggedError(Exception):
    """Raised when content is flagged by OpenAI Moderation API."""

    def __init__(
        self,
        categories: dict,
        scores: dict,
        hard_block: bool = False,
        user_id: Optional[str] = None,
    ):
        self.categories  = categories
        self.scores      = scores
        self.hard_block  = hard_block
        self.user_id     = user_id
        flagged_cats     = [k for k, v in categories.items() if v]
        super().__init__(
            f"Content flagged by moderation: {', '.join(flagged_cats)}"
        )


def check_moderation(text: str, user_id: Optional[str] = None) -> dict:
    """
    Screen input text using the OpenAI Moderation API.

    Args:
        text:    The user input to screen.
        user_id: Optional user identifier for logging.

    Returns:
        dict with keys: flagged (bool), categories (dict), scores (dict), hard_block (bool)

    Raises:
        ModerationFlaggedError: If content is flagged (hard-block categories always raise;
                                 soft-block categories also raise).
    """
    if not MODERATION_ENABLED or not text or not text.strip():
        return {"flagged": False, "categories": {}, "scores": {}, "hard_block": False}

    if not OPENAI_API_KEY:
        logger.debug("moderation_skipped: OPENAI_API_KEY not set")
        return {"flagged": False, "categories": {}, "scores": {}, "hard_block": False}

    try:
        import openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        response = client.moderations.create(
            input=text[:4096],  # Moderation API limit
            model="omni-moderation-latest",
        )
        result = response.results[0]

        categories: dict = dict(result.categories)
        scores: dict     = dict(result.category_scores)
        flagged: bool    = result.flagged

        if not flagged:
            return {"flagged": False, "categories": categories, "scores": scores, "hard_block": False}

        # Determine if any hard-block category is flagged
        hard_block = any(
            categories.get(cat, False)
            for cat in HARD_BLOCK_CATEGORIES
        )

        flagged_cats = [k for k, v in categories.items() if v]
        logger.warning(
            "moderation_flagged user=%s categories=%s hard_block=%s input_excerpt='%.80s'",
            user_id, flagged_cats, hard_block, text,
        )

        raise ModerationFlaggedError(
            categories=categories,
            scores=scores,
            hard_block=hard_block,
            user_id=user_id,
        )

    except ModerationFlaggedError:
        raise
    except Exception as exc:
        # If the Moderation API is unavailable, log and allow through
        logger.warning("moderation_api_error (allowing through): %s", exc)
        return {"flagged": False, "categories": {}, "scores": {}, "hard_block": False}
