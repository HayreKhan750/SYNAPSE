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

from langgraph.prebuilt import create_react_agent
from langchain_core.tools import BaseTool
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — grounding and safety rules for the SYNAPSE ReAct agent
# ---------------------------------------------------------------------------

REACT_SYSTEM_PROMPT = (
    "You are SYNAPSE Agent, an intelligent AI assistant that autonomously performs "
    "research, trend analysis, and knowledge retrieval tasks on behalf of the user. "
    "You have access to tools for searching the knowledge base, fetching articles, "
    "analyzing technology trends, searching GitHub, and retrieving arXiv papers. "
    "Always use tools to ground your answers in real data. "
    "Cite the sources you used. "
    "If a tool fails, try an alternative approach or explain the limitation clearly. "
    "Be concise, accurate, and helpful."
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
    ) -> None:
        self.tools = tools
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.max_iterations = max_iterations
        self.max_execution_time = max_execution_time
        self.verbose = verbose

        self._llm = self._build_llm()
        self._graph = None  # LangGraph compiled graph — built lazily

    # ------------------------------------------------------------------
    # Construction helpers
    # ------------------------------------------------------------------

    def _build_llm(self) -> ChatOpenAI:
        """Instantiate the LLM used by the agent via OpenRouter (OpenAI-compatible)."""
        openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
        openrouter_base = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        openrouter_model = os.environ.get("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
        if openrouter_key:
            return ChatOpenAI(
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
        # Fallback to Google Gemini if configured
        gemini_key = os.environ.get("GEMINI_API_KEY", "")
        if gemini_key:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(
                    model=os.environ.get("GEMINI_MODEL", self.model_name),
                    temperature=self.temperature,
                    max_output_tokens=self.max_tokens,
                    google_api_key=gemini_key,
                    convert_system_message_to_human=True,
                )
            except ImportError:
                pass
        raise ValueError(
            "No LLM configured. Set OPENROUTER_API_KEY (recommended) or GEMINI_API_KEY."
        )

    @property
    def graph(self):
        """Lazy-initialised LangGraph ReAct graph (built once, reused)."""
        if self._graph is None:
            self._graph = create_react_agent(
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
