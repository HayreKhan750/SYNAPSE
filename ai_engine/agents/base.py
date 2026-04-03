"""
ai_engine.agents.base
~~~~~~~~~~~~~~~~~~~~~
LangChain / LangGraph ReAct Agent base class for SYNAPSE.

The ReAct (Reasoning + Acting) pattern drives every SYNAPSE agent:
  1. Thought  — reason about the current state and available tools
  2. Action   — select a tool and its input parameters
  3. Observation — receive the tool result
  4. Repeat   — iterate until goal is reached or limits exceeded

Safety limits (from 13_AI_Agent_Spec.tex):
  - max_iterations : 10  (ReAct loop cycles)
  - max_execution_time : 300 seconds
  - max_tokens : 10 000 per task
  - token cost logging per run

Uses LangGraph's create_react_agent (LangChain ≥ 0.3 / LangGraph ≥ 0.2).

Phase 5.1 — Agent Framework (Week 13)
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, Iterator, List, Optional

from langchain_core.tools import BaseTool
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

# langchain_openai and langgraph are imported lazily inside methods so that
# doc_tools.py (which only uses reportlab/pptx) can be imported without
# requiring langchain_openai to be installed in environments that only use
# the document generation tools.
try:
    from langchain_openai import ChatOpenAI as _ChatOpenAI  # type: ignore
    _OPENAI_AVAILABLE = True
except ImportError:
    _ChatOpenAI = None  # type: ignore
    _OPENAI_AVAILABLE = False

try:
    from langgraph.prebuilt import create_react_agent as _create_react_agent  # type: ignore
    _LANGGRAPH_AVAILABLE = True
except ImportError:
    _create_react_agent = None  # type: ignore
    _LANGGRAPH_AVAILABLE = False

# TASK-302: Anthropic Claude
try:
    from langchain_anthropic import ChatAnthropic as _ChatAnthropic  # type: ignore
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ChatAnthropic = None  # type: ignore
    _ANTHROPIC_AVAILABLE = False

# TASK-302: Ollama local LLMs
try:
    from langchain_ollama import ChatOllama as _ChatOllama  # type: ignore
    _OLLAMA_AVAILABLE = True
except ImportError:
    _ChatOllama = None  # type: ignore
    _OLLAMA_AVAILABLE = False

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — grounding and safety rules for the SYNAPSE ReAct agent
# ---------------------------------------------------------------------------

REACT_SYSTEM_PROMPT = (
    "You are SYNAPSE Agent, an intelligent AI assistant that autonomously completes tasks "
    "for the user WITHOUT asking for clarification or additional input. "
    "You must ALWAYS produce a complete result using your tools and your own knowledge.\n\n"

    "CRITICAL RULES:\n"
    "1. NEVER ask the user for more information — complete the task with what you have.\n"
    "2. For document/report generation: call the appropriate tool (generate_pdf, generate_ppt, "
    "   generate_word_doc, generate_markdown) immediately with content YOU generate from your knowledge. "
    "   Create realistic, informative section content yourself — do not wait for user input.\n"
    "3. For research tasks: use 1-3 tool calls maximum, then synthesize a clear answer.\n"
    "4. For trend analysis: call analyze_trends once, then summarize the result.\n"
    "5. For GitHub searches: call search_github once with a good query, then present results.\n"
    "6. For arXiv: call fetch_arxiv_papers once; if rate-limited, state so and use your knowledge.\n"
    "7. For project scaffolding: call create_project immediately with the requested type and name.\n"
    "8. If a tool fails, use your built-in knowledge to answer instead.\n"
    "9. Be concise, accurate, and always produce a final answer.\n"
    "10. Cite sources when available.\n"
)


# ---------------------------------------------------------------------------
# SynapseAgent
# ---------------------------------------------------------------------------

class SynapseAgent:
    """
    ReAct agent built on LangGraph's create_react_agent.

    Usage::

        from ai_engine.agents import get_executor
        executor = get_executor()
        result = executor.run("Summarise the latest AI trends from the knowledge base")
    """

    # Safety defaults (from 13_AI_Agent_Spec.tex)
    MAX_ITERATIONS: int = 10
    MAX_EXECUTION_TIME: int = 300          # seconds
    MAX_TOKENS_PER_TASK: int = 10_000

    def __init__(
        self,
        tools: List[BaseTool],
        model_name: str = "gemini-1.5-flash-latest",
        temperature: float = 0.1,
        max_tokens: int = 2048,
        max_iterations: int = MAX_ITERATIONS,
        max_execution_time: int = MAX_EXECUTION_TIME,
        verbose: bool = True,
        openrouter_api_key: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        # TASK-302: multi-provider support
        provider: str = "auto",              # "auto"|"openai"|"anthropic"|"ollama"|"gemini"
        anthropic_api_key: Optional[str] = None,
        ollama_base_url: Optional[str] = None,
    ) -> None:
        self.tools = tools
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.max_iterations = max_iterations
        self.max_execution_time = max_execution_time
        self.verbose = verbose
        self.provider = provider
        # Per-user API key overrides (take priority over env vars)
        self._openrouter_api_key = openrouter_api_key
        self._gemini_api_key = gemini_api_key
        self._anthropic_api_key = anthropic_api_key
        self._ollama_base_url = ollama_base_url

        self._llm = self._build_llm()
        self._graph = None  # LangGraph compiled graph — built lazily

    # ------------------------------------------------------------------
    # Construction helpers
    # ------------------------------------------------------------------

    def _build_llm(self):
        """
        Instantiate the LLM used by the agent.

        Provider selection order (TASK-302):
          1. provider="anthropic"  → Claude (ANTHROPIC_API_KEY required)
          2. provider="ollama"     → local Ollama LLM (OLLAMA_BASE_URL, no API key)
          3. provider="gemini"     → Google Gemini (GEMINI_API_KEY required)
          4. provider="openai"     → OpenRouter-compatible endpoint
          5. provider="auto"       → tries OpenRouter → Gemini → raises

        Per-user key overrides always take priority over env vars.
        """
        # ── Anthropic Claude ──────────────────────────────────────────────────
        if self.provider == "anthropic":
            anthropic_key = self._anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY", "")
            if not anthropic_key:
                raise ValueError("ANTHROPIC_API_KEY is required for provider='anthropic'.")
            if not _ANTHROPIC_AVAILABLE or _ChatAnthropic is None:
                raise ImportError(
                    "langchain-anthropic is not installed. "
                    "Install it with: pip install langchain-anthropic"
                )
            model = self.model_name if self.model_name.startswith("claude-") \
                else os.environ.get("CLAUDE_MODEL_PRIMARY", "claude-3-5-sonnet-20241022")
            logger.info("llm_provider=anthropic model=%s", model)
            return _ChatAnthropic(
                model=model,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                anthropic_api_key=anthropic_key,
            )

        # ── Ollama (local) ────────────────────────────────────────────────────
        if self.provider == "ollama":
            if not _OLLAMA_AVAILABLE or _ChatOllama is None:
                raise ImportError(
                    "langchain-ollama is not installed. "
                    "Install it with: pip install langchain-ollama"
                )
            base_url = (
                self._ollama_base_url
                or os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
            )
            model = self.model_name if self.model_name not in ("gemini-1.5-flash-latest",) \
                else os.environ.get("OLLAMA_MODEL", "llama3.2")
            logger.info("llm_provider=ollama model=%s base_url=%s", model, base_url)
            return _ChatOllama(
                model=model,
                base_url=base_url,
                temperature=self.temperature,
                num_predict=self.max_tokens,
            )

        # ── Google Gemini (explicit) ──────────────────────────────────────────
        if self.provider == "gemini":
            gemini_key = self._gemini_api_key or os.environ.get("GEMINI_API_KEY", "")
            if not gemini_key:
                raise ValueError("GEMINI_API_KEY is required for provider='gemini'.")
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                model = os.environ.get("GEMINI_MODEL", self.model_name)
                logger.info("llm_provider=gemini model=%s", model)
                return ChatGoogleGenerativeAI(
                    model=model,
                    temperature=self.temperature,
                    max_output_tokens=self.max_tokens,
                    google_api_key=gemini_key,
                    convert_system_message_to_human=True,
                )
            except ImportError as exc:
                raise ImportError(
                    "langchain-google-genai is not installed. "
                    "Install it with: pip install langchain-google-genai"
                ) from exc

        # ── OpenAI / OpenRouter (explicit or auto) ────────────────────────────
        openrouter_base  = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        openrouter_model = os.environ.get("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
        openrouter_key   = self._openrouter_api_key or os.environ.get("OPENROUTER_API_KEY", "")
        gemini_key       = self._gemini_api_key or os.environ.get("GEMINI_API_KEY", "")

        if openrouter_key and _OPENAI_AVAILABLE and _ChatOpenAI is not None:
            logger.info("llm_provider=openrouter model=%s", openrouter_model)
            return _ChatOpenAI(
                model=openrouter_model,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                openai_api_key=openrouter_key,
                openai_api_base=openrouter_base,
                default_headers={
                    "HTTP-Referer": "https://synapse.ai",
                    "X-Title": "SYNAPSE Agent",
                },
            )

        # Auto fallback → Google Gemini
        if gemini_key:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                model = os.environ.get("GEMINI_MODEL", self.model_name)
                logger.info("llm_provider=gemini_auto model=%s", model)
                return ChatGoogleGenerativeAI(
                    model=model,
                    temperature=self.temperature,
                    max_output_tokens=self.max_tokens,
                    google_api_key=gemini_key,
                    convert_system_message_to_human=True,
                )
            except ImportError:
                pass

        raise ValueError(
            "No LLM configured. Set one of: OPENROUTER_API_KEY, ANTHROPIC_API_KEY, "
            "GEMINI_API_KEY, or use provider='ollama' with OLLAMA_BASE_URL."
        )

    @property
    def graph(self):
        """Lazy-initialised LangGraph ReAct graph (built once, reused)."""
        if self._graph is None:
            if not _LANGGRAPH_AVAILABLE or _create_react_agent is None:
                raise ImportError(
                    "langgraph is not installed. Install it with: pip install langgraph"
                )
            self._graph = _create_react_agent(
                model=self._llm,
                tools=self.tools,
                prompt=REACT_SYSTEM_PROMPT,
            )
        return self._graph

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(
        self,
        task: str,
        extra_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute an agent task synchronously.

        Returns a dict with:
          - answer            : str — the final answer produced by the agent
          - intermediate_steps: list — all tool call records
          - tokens_used       : int — estimated token count
          - cost_usd          : float — estimated cost in USD
          - execution_time_s  : float — wall-clock seconds
          - success           : bool
          - error             : str | None
        """
        start = time.time()
        result: Dict[str, Any] = {
            "answer": "",
            "intermediate_steps": [],
            "tokens_used": 0,
            "cost_usd": 0.0,
            "execution_time_s": 0.0,
            "success": False,
            "error": None,
        }

        try:
            config = {"recursion_limit": self.max_iterations * 2 + 2}
            state = self.graph.invoke(
                {"messages": [HumanMessage(content=task)]},
                config=config,
            )
            messages = state.get("messages", [])
            answer = ""
            steps = []

            for msg in messages:
                if isinstance(msg, AIMessage) and msg.content:
                    answer = msg.content if isinstance(msg.content, str) else str(msg.content)
                elif isinstance(msg, ToolMessage):
                    steps.append({
                        "tool": getattr(msg, "name", "tool"),
                        "tool_input": "",
                        "observation": str(msg.content)[:2000],
                        "thought": "",
                    })

            result["answer"] = answer
            result["intermediate_steps"] = steps
            result["tokens_used"] = self._estimate_tokens(task, answer)
            result["cost_usd"] = self._estimate_cost(result["tokens_used"])
            result["success"] = True

        except Exception as exc:
            logger.exception("Agent task failed: %s", exc)
            result["error"] = str(exc)
            result["success"] = False

        finally:
            result["execution_time_s"] = round(time.time() - start, 3)

        return result

    def stream(
        self,
        task: str,
        extra_context: Optional[Dict[str, Any]] = None,
    ) -> Iterator[Dict[str, Any]]:
        """
        Stream intermediate steps and the final answer as they are produced.

        Yields dicts of the form:
          {"step": {"tool": ..., "observation": ...}}
          {"final": {"answer": ..., "tokens_used": ..., "cost_usd": ..., "execution_time_s": ...}}
          {"error": str}
        """
        start = time.time()
        try:
            config = {"recursion_limit": self.max_iterations * 2 + 2}
            for chunk in self.graph.stream(
                {"messages": [HumanMessage(content=task)]},
                config=config,
                stream_mode="updates",
            ):
                for node_name, node_output in chunk.items():
                    msgs = node_output.get("messages", [])
                    for msg in msgs:
                        if isinstance(msg, ToolMessage):
                            yield {
                                "step": {
                                    "tool": getattr(msg, "name", "tool"),
                                    "observation": str(msg.content)[:2000],
                                }
                            }
                        elif isinstance(msg, AIMessage) and msg.content:
                            answer = msg.content if isinstance(msg.content, str) else str(msg.content)
                            tokens = self._estimate_tokens(task, answer)
                            yield {
                                "final": {
                                    "answer": answer,
                                    "tokens_used": tokens,
                                    "cost_usd": self._estimate_cost(tokens),
                                    "execution_time_s": round(time.time() - start, 3),
                                }
                            }
        except Exception as exc:
            logger.exception("Agent stream failed: %s", exc)
            yield {"error": str(exc)}

    # ------------------------------------------------------------------
    # Internal utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _serialize_steps(steps: list) -> List[Dict[str, Any]]:
        """Convert raw step records to JSON-serialisable dicts."""
        serialized = []
        for action, observation in steps:
            serialized.append({
                "thought": getattr(action, "log", ""),
                "tool": getattr(action, "tool", ""),
                "tool_input": getattr(action, "tool_input", ""),
                "observation": str(observation)[:2000],
            })
        return serialized

    @staticmethod
    def _estimate_tokens(prompt: str, response: str) -> int:
        """Rough token estimate: ~4 chars per token."""
        return max(1, (len(prompt) + len(response)) // 4)

    @staticmethod
    def _estimate_cost(tokens: int) -> float:
        """
        Estimate USD cost.
        Gemini 1.5 Flash: ~$0.075 per 1M tokens (blended approximation).
        """
        return round(tokens * 0.000_000_075, 8)
