"""
ai_engine.agents.llm_factory
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Shared LLM factory used by both the RAG chain (rag/chain.py) and the
agent executor (agents/base.py). Consolidates duplicate _build_llm()
implementations into a single, tested function.

QA-24: Previously both SynapseRAGChain._build_llm() and SynapseAgent._build_llm()
contained near-identical provider-routing logic. Any change had to be made in two
places. This module is the single source of truth.

Provider selection order:
  1. provider="anthropic"  → Claude   (ANTHROPIC_API_KEY required)
  2. provider="ollama"     → Ollama   (no API key; OLLAMA_BASE_URL)
  3. provider="gemini"     → Gemini   (GEMINI_API_KEY required)
  4. provider="scitely"    → Scitely  (SCITELY_API_KEY; OpenAI-compatible)
  5. provider="openai"     → OpenRouter-compatible (OPENROUTER_API_KEY)
  6. provider="auto"       → Scitely → OpenRouter → Gemini → raise ValueError
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── Optional package guards ────────────────────────────────────────────────────
try:
    from langchain_openai import ChatOpenAI  # type: ignore

    _OPENAI_AVAILABLE = True
except ImportError:
    ChatOpenAI = None  # type: ignore[assignment,misc]
    _OPENAI_AVAILABLE = False

try:
    from langchain_anthropic import ChatAnthropic  # type: ignore

    _ANTHROPIC_AVAILABLE = True
except ImportError:
    ChatAnthropic = None  # type: ignore[assignment,misc]
    _ANTHROPIC_AVAILABLE = False

try:
    from langchain_ollama import ChatOllama  # type: ignore

    _OLLAMA_AVAILABLE = True
except ImportError:
    ChatOllama = None  # type: ignore[assignment,misc]
    _OLLAMA_AVAILABLE = False


def build_llm(
    provider: str = "auto",
    model: str = "",
    temperature: float = 0.2,
    max_tokens: int = 1024,
    streaming: bool = False,
    # Per-user API key overrides (take priority over env vars)
    scitely_api_key: Optional[str] = None,
    openrouter_api_key: Optional[str] = None,
    gemini_api_key: Optional[str] = None,
    anthropic_api_key: Optional[str] = None,
    ollama_base_url: Optional[str] = None,
) -> Any:
    """
    Instantiate and return an LLM for the given provider.

    Args:
        provider:           LLM provider — "auto"|"openai"|"anthropic"|"ollama"|"gemini"
        model:              Model name override. Falls back to env vars per provider.
        temperature:        Sampling temperature (0–1).
        max_tokens:         Maximum tokens in the response.
        streaming:          Whether to enable streaming mode.
        openrouter_api_key: Per-user OpenRouter key (overrides OPENROUTER_API_KEY env).
        scitely_api_key:    Per-user Scitely key (overrides SCITELY_API_KEY env).
        gemini_api_key:     Per-user Gemini key (overrides GEMINI_API_KEY env).
        anthropic_api_key:  Per-user Anthropic key (overrides ANTHROPIC_API_KEY env).
        ollama_base_url:    Per-user Ollama base URL (overrides OLLAMA_BASE_URL env).

    Returns:
        A LangChain chat model instance.

    Raises:
        ValueError:   If the required API key is missing.
        ImportError:  If the required package is not installed.
    """

    # ── Anthropic Claude ──────────────────────────────────────────────────────
    if provider == "anthropic":
        key = anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if not key:
            raise ValueError("ANTHROPIC_API_KEY is required for provider='anthropic'.")
        if not _ANTHROPIC_AVAILABLE or ChatAnthropic is None:
            raise ImportError(
                "langchain-anthropic is not installed. "
                "Install it with: pip install langchain-anthropic"
            )
        resolved = model or os.environ.get(
            "CLAUDE_MODEL_PRIMARY", "claude-3-5-sonnet-20241022"
        )
        logger.info(
            "llm_factory provider=anthropic model=%s streaming=%s", resolved, streaming
        )
        return ChatAnthropic(
            model=resolved,
            temperature=temperature,
            max_tokens=max_tokens,
            anthropic_api_key=key,
            streaming=streaming,
        )

    # ── Ollama (local) ────────────────────────────────────────────────────────
    if provider == "ollama":
        if not _OLLAMA_AVAILABLE or ChatOllama is None:
            raise ImportError(
                "langchain-ollama is not installed. "
                "Install it with: pip install langchain-ollama"
            )
        base = ollama_base_url or os.environ.get(
            "OLLAMA_BASE_URL", "http://localhost:11434"
        )
        resolved = model or os.environ.get("OLLAMA_MODEL", "llama3.2")
        logger.info("llm_factory provider=ollama model=%s base_url=%s", resolved, base)
        return ChatOllama(
            model=resolved,
            base_url=base,
            temperature=temperature,
            num_predict=max_tokens,
        )

    # ── Google Gemini (explicit) ──────────────────────────────────────────────
    if provider == "gemini":
        key = gemini_api_key
        if not key:
            raise ValueError(
                "API key not configured for standard agents. Please add a Gemini key in Settings → AI Engine."
            )
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI  # type: ignore
        except ImportError as exc:
            raise ImportError(
                "langchain-google-genai is not installed. "
                "Install it with: pip install langchain-google-genai"
            ) from exc
        resolved = model or os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
        logger.info(
            "llm_factory provider=gemini model=%s streaming=%s", resolved, streaming
        )
        return ChatGoogleGenerativeAI(
            model=resolved,
            temperature=temperature,
            max_output_tokens=max_tokens,
            google_api_key=key,
            streaming=streaming,
            convert_system_message_to_human=True,
        )

    # ── Scitely (explicit or auto-fallback) ────────────────────────────────────
    sc_key = scitely_api_key or os.environ.get("SCITELY_API_KEY", "")
    sc_base = "https://api.scitely.com/v1"
    sc_model = model or os.environ.get("SCITELY_MODEL", "deepseek-v3")

    if provider == "scitely":
        if not sc_key:
            raise ValueError("SCITELY_API_KEY is required for provider='scitely'.")
        if not _OPENAI_AVAILABLE or ChatOpenAI is None:
            raise ImportError("langchain-openai is not installed.")
        logger.info(
            "llm_factory provider=scitely model=%s streaming=%s", sc_model, streaming
        )
        return ChatOpenAI(
            model=sc_model,
            temperature=temperature,
            max_tokens=max_tokens,
            openai_api_key=sc_key,
            openai_api_base=sc_base,
            streaming=streaming,
            default_headers={
                "HTTP-Referer": "https://synapse.ai",
                "X-Title": "SYNAPSE",
            },
        )

    # Auto-fallback: try Scitely first
    if sc_key and _OPENAI_AVAILABLE and ChatOpenAI is not None:
        logger.info(
            "llm_factory provider=scitely_auto model=%s streaming=%s",
            sc_model,
            streaming,
        )
        return ChatOpenAI(
            model=sc_model,
            temperature=temperature,
            max_tokens=max_tokens,
            openai_api_key=sc_key,
            openai_api_base=sc_base,
            streaming=streaming,
            default_headers={
                "HTTP-Referer": "https://synapse.ai",
                "X-Title": "SYNAPSE",
            },
        )

    # ── OpenRouter / OpenAI (explicit or auto-fallback) ───────────────────────
    or_key = openrouter_api_key
    or_base = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    or_model = model or os.environ.get(
        "OPENROUTER_MODEL", "google/gemini-2.0-flash-001"
    )

    if or_key and _OPENAI_AVAILABLE and ChatOpenAI is not None:
        logger.info(
            "llm_factory provider=openrouter model=%s streaming=%s", or_model, streaming
        )
        return ChatOpenAI(
            model=or_model,
            temperature=temperature,
            max_tokens=max_tokens,
            openai_api_key=or_key,
            openai_api_base=or_base,
            streaming=streaming,
            default_headers={
                "HTTP-Referer": "https://synapse.ai",
                "X-Title": "SYNAPSE",
            },
        )

    # ── Gemini auto-fallback ──────────────────────────────────────────────────
    gem_key = gemini_api_key
    if gem_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI  # type: ignore

            resolved = model or os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
            logger.info(
                "llm_factory provider=gemini_auto model=%s streaming=%s",
                resolved,
                streaming,
            )
            return ChatGoogleGenerativeAI(
                model=resolved,
                temperature=temperature,
                max_output_tokens=max_tokens,
                google_api_key=gem_key,
                streaming=streaming,
                convert_system_message_to_human=True,
            )
        except ImportError:
            pass

    raise ValueError(
        "API key not configured for standard agents. Please add one in Settings → AI Engine."
    )
