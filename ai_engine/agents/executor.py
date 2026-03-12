"""
ai_engine.agents.executor
~~~~~~~~~~~~~~~~~~~~~~~~~
High-level SynapseAgentExecutor — combines the tool registry with the
ReAct agent base class and exposes a single-entry-point API used by the
Celery task and the FastAPI AI service.

Phase 5.1 — Agent Framework (Week 13)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Iterator, List, Optional

from .base import SynapseAgent  # noqa: F401 — SynapseAgent uses LangGraph internally
from .registry import AgentToolRegistry, get_registry

logger = logging.getLogger(__name__)

# Module-level singleton
_executor_instance: Optional["SynapseAgentExecutor"] = None


class SynapseAgentExecutor:
    """
    Orchestrates the full agent lifecycle:

      1. Resolves which tools to use (via AgentToolRegistry)
      2. Instantiates a SynapseAgent with those tools
      3. Runs or streams the task and returns structured results

    The executor caches a default agent (all tools) but can create
    task-specific agents on-the-fly with a restricted tool subset.

    Usage::

        executor = get_executor()

        # Synchronous
        result = executor.run("What are the trending AI papers this week?")

        # Streaming
        for event in executor.stream("Analyze trends for Python and Rust"):
            print(event)
    """

    def __init__(
        self,
        registry: Optional[AgentToolRegistry] = None,
        model_name: str = "gemini-1.5-flash-latest",
        temperature: float = 0.1,
        max_tokens: int = 2048,
        max_iterations: int = 10,
        max_execution_time: int = 300,
        verbose: bool = True,
    ) -> None:
        self.registry = registry if registry is not None else get_registry()
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.max_iterations = max_iterations
        self.max_execution_time = max_execution_time
        self.verbose = verbose

        self._default_agent: Optional[SynapseAgent] = None

    # ------------------------------------------------------------------
    # Agent construction
    # ------------------------------------------------------------------

    def _get_default_agent(self) -> SynapseAgent:
        """Return (and lazily initialise) the default agent with all tools."""
        if self._default_agent is None:
            tools = self.registry.get_tools()
            self._default_agent = SynapseAgent(
                tools=tools,
                model_name=self.model_name,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                max_iterations=self.max_iterations,
                max_execution_time=self.max_execution_time,
                verbose=self.verbose,
            )
        return self._default_agent

    def _make_agent(self, tool_names: Optional[List[str]] = None) -> SynapseAgent:
        """Create a fresh agent, optionally restricted to specific tools."""
        if tool_names is None:
            return self._get_default_agent()

        tools = self.registry.get_tools(tool_names)
        if not tools:
            logger.warning("No tools resolved for %s — falling back to all tools", tool_names)
            tools = self.registry.get_tools()

        return SynapseAgent(
            tools=tools,
            model_name=self.model_name,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            max_iterations=self.max_iterations,
            max_execution_time=self.max_execution_time,
            verbose=self.verbose,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(
        self,
        task: str,
        tool_names: Optional[List[str]] = None,
        extra_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute a task synchronously.

        Args:
            task:         Natural-language task description.
            tool_names:   Optional list of tool names to restrict the agent to.
                          If None, all registered tools are available.
            extra_context: Additional key-value pairs injected into the agent prompt.

        Returns:
            Dict with keys: answer, intermediate_steps, tokens_used,
                            cost_usd, execution_time_s, success, error.
        """
        agent = self._make_agent(tool_names)
        logger.info("Running agent task (tools=%s): %s", tool_names or "all", task[:120])
        result = agent.run(task, extra_context=extra_context)
        logger.info(
            "Agent task complete — success=%s tokens=%d cost=$%.6f time=%.2fs",
            result["success"],
            result["tokens_used"],
            result["cost_usd"],
            result["execution_time_s"],
        )
        return result

    def stream(
        self,
        task: str,
        tool_names: Optional[List[str]] = None,
        extra_context: Optional[Dict[str, Any]] = None,
    ) -> Iterator[Dict[str, Any]]:
        """
        Stream intermediate steps and the final answer.

        Yields dicts of the form:
          {"step": {"thought": ..., "action": ..., "action_input": ...}}
          {"step": {"observation": ...}}
          {"final": {"answer": ..., "tokens_used": ..., "cost_usd": ..., "execution_time_s": ...}}
          {"error": str}
        """
        agent = self._make_agent(tool_names)
        logger.info("Streaming agent task (tools=%s): %s", tool_names or "all", task[:120])
        yield from agent.stream(task, extra_context=extra_context)

    def list_tools(self) -> List[Dict[str, str]]:
        """Return descriptions of all registered tools (for API /agents/tools endpoint)."""
        return self.registry.describe()

    def health(self) -> Dict[str, Any]:
        """Return health/status information about the executor."""
        return {
            "status": "ok",
            "tools_registered": len(self.registry),
            "tool_names": self.registry.list_tool_names(),
            "model": self.model_name,
            "max_iterations": self.max_iterations,
            "max_execution_time_s": self.max_execution_time,
        }


# ---------------------------------------------------------------------------
# Module-level singleton accessor
# ---------------------------------------------------------------------------

def get_executor() -> SynapseAgentExecutor:
    """Return the module-level SynapseAgentExecutor singleton."""
    global _executor_instance
    if _executor_instance is None:
        _executor_instance = SynapseAgentExecutor()
    return _executor_instance
