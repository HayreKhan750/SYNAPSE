"""
backend.apps.agents.tasks
~~~~~~~~~~~~~~~~~~~~~~~~~
Celery tasks for asynchronous agent task execution.

Phase 5.1 — Agent Framework (Week 13)

Flow:
    1. API creates AgentTask (status=pending) and queues execute_agent_task
    2. Celery worker picks it up → status=processing
    3. SynapseAgentExecutor.run() executes the ReAct loop
    4. Result saved → status=completed | failed
    5. Optional notification sent to user
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="apps.agents.tasks.execute_agent_task",
    queue="agents",
    max_retries=2,
    default_retry_delay=30,
    soft_time_limit=330,   # 5 min 30 s — slightly above agent max_execution_time
    time_limit=360,
)
def execute_agent_task(self, agent_task_id: str) -> dict:
    """
    Execute a SYNAPSE agent task asynchronously.

    Args:
        agent_task_id: UUID string of the AgentTask record to process.

    Returns:
        dict summarising success/failure (stored in Celery result backend).
    """
    from apps.agents.models import AgentTask

    # ── Fetch task record ─────────────────────────────────────────────
    try:
        task_obj = AgentTask.objects.get(id=agent_task_id)
    except AgentTask.DoesNotExist:
        logger.error("AgentTask %s not found", agent_task_id)
        return {"success": False, "error": "AgentTask not found"}

    # ── Mark as processing ────────────────────────────────────────────
    task_obj.status = AgentTask.TaskStatus.PROCESSING
    task_obj.celery_task_id = self.request.id
    task_obj.save(update_fields=["status", "celery_task_id"])
    logger.info("AgentTask %s — starting (type=%s)", agent_task_id, task_obj.task_type)

    # ── Resolve tool subset from task_type ────────────────────────────
    tool_map: dict[str, list[str] | None] = {
        "research":  ["search_knowledge_base", "fetch_articles", "fetch_arxiv_papers"],
        "trends":    ["analyze_trends", "search_github", "fetch_arxiv_papers"],
        "github":    ["search_github"],
        "arxiv":     ["fetch_arxiv_papers"],
        "general":   None,  # all tools
    }
    tool_names = tool_map.get(task_obj.task_type, None)

    # ── Run the agent ─────────────────────────────────────────────────
    try:
        # Import here so Django/AI engine are fully initialised before use
        from ai_engine.agents import get_executor

        executor = get_executor()
        result = executor.run(
            task=task_obj.prompt,
            tool_names=tool_names,
        )

        # ── Save result ───────────────────────────────────────────────
        task_obj.status = (
            AgentTask.TaskStatus.COMPLETED if result["success"]
            else AgentTask.TaskStatus.FAILED
        )
        task_obj.result = {
            "answer": result.get("answer", ""),
            "intermediate_steps": result.get("intermediate_steps", []),
            "execution_time_s": result.get("execution_time_s", 0),
        }
        task_obj.tokens_used = result.get("tokens_used", 0)
        task_obj.cost_usd = result.get("cost_usd", 0.0)
        task_obj.error_message = result.get("error") or ""
        task_obj.completed_at = datetime.now(tz=timezone.utc)
        task_obj.save(update_fields=[
            "status", "result", "tokens_used", "cost_usd",
            "error_message", "completed_at",
        ])

        logger.info(
            "AgentTask %s — %s (tokens=%d cost=$%.6f time=%.2fs)",
            agent_task_id,
            task_obj.status,
            task_obj.tokens_used,
            float(task_obj.cost_usd),
            result["execution_time_s"],
        )

        # ── Optional: create in-app notification ──────────────────────
        try:
            _notify_user(task_obj, result["success"])
        except Exception as notify_exc:
            logger.warning("Notification failed for AgentTask %s: %s", agent_task_id, notify_exc)

        return {
            "success": result["success"],
            "agent_task_id": agent_task_id,
            "tokens_used": task_obj.tokens_used,
            "cost_usd": float(task_obj.cost_usd),
        }

    except Exception as exc:
        logger.exception("AgentTask %s — unexpected error: %s", agent_task_id, exc)
        task_obj.status = AgentTask.TaskStatus.FAILED
        task_obj.error_message = str(exc)
        task_obj.completed_at = datetime.now(tz=timezone.utc)
        task_obj.save(update_fields=["status", "error_message", "completed_at"])

        # Retry if within retry budget
        raise self.retry(exc=exc)


def _notify_user(task_obj, success: bool) -> None:
    """Create an in-app notification for the task owner."""
    from apps.notifications.models import Notification

    status_str = "completed" if success else "failed"
    emoji = "✅" if success else "❌"

    Notification.objects.create(
        user=task_obj.user,
        title=f"{emoji} Agent task {status_str}",
        message=(
            f"Your agent task '{task_obj.task_type}' has {status_str}. "
            f"Tokens used: {task_obj.tokens_used} | "
            f"Cost: ${float(task_obj.cost_usd):.4f}"
        ),
        notif_type="agent",
        metadata={
            "agent_task_id": str(task_obj.id),
            "task_type": task_obj.task_type,
            "tokens_used": task_obj.tokens_used,
            "cost_usd": float(task_obj.cost_usd),
        },
    )


@shared_task(
    name="apps.agents.tasks.cancel_agent_task",
    queue="agents",
)
def cancel_agent_task(agent_task_id: str, celery_task_id: str) -> dict:
    """
    Attempt to cancel a running agent task by revoking its Celery task.

    Args:
        agent_task_id:  UUID of the AgentTask record.
        celery_task_id: Celery task ID to revoke.
    """
    from apps.agents.models import AgentTask
    from celery.app.control import Control
    from config.celery import app as celery_app

    try:
        task_obj = AgentTask.objects.get(id=agent_task_id)
    except AgentTask.DoesNotExist:
        return {"success": False, "error": "AgentTask not found"}

    if task_obj.status in (AgentTask.TaskStatus.COMPLETED, AgentTask.TaskStatus.FAILED):
        return {"success": False, "error": f"Task already {task_obj.status}"}

    # Revoke the Celery task
    control = Control(app=celery_app)
    control.revoke(celery_task_id, terminate=True, signal="SIGTERM")

    task_obj.status = AgentTask.TaskStatus.FAILED
    task_obj.error_message = "Cancelled by user"
    task_obj.completed_at = datetime.now(tz=timezone.utc)
    task_obj.save(update_fields=["status", "error_message", "completed_at"])

    logger.info("AgentTask %s cancelled (celery_task_id=%s)", agent_task_id, celery_task_id)
    return {"success": True, "agent_task_id": agent_task_id}
