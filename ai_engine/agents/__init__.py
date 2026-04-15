"""
ai_engine.agents
~~~~~~~~~~~~~~~~
LangChain ReAct Agentic AI framework for SYNAPSE.

Phase 5.1 — Agent Framework (Week 13)

Exports:
    SynapseAgent        — ReAct agent base class
    AgentToolRegistry   — Tool registration system
    SynapseAgentExecutor— High-level executor (async + sync)
    get_executor        — Module-level singleton factory
"""

from .base import SynapseAgent
from .registry import AgentToolRegistry, get_registry
from .executor import SynapseAgentExecutor, get_executor

__all__ = [
    "SynapseAgent",
    "AgentToolRegistry",
    "get_registry",
    "SynapseAgentExecutor",
    "get_executor",
]
