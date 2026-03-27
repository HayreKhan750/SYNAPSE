"""
backend.apps.agents.views
~~~~~~~~~~~~~~~~~~~~~~~~~
REST API views for the SYNAPSE Agentic AI framework.

Endpoints (Phase 5.1 + 5.4):
  POST   /api/v1/agents/tasks/              — create + queue an agent task
  GET    /api/v1/agents/tasks/              — list user's tasks (paginated)
  GET    /api/v1/agents/tasks/{id}/         — retrieve task detail + result
  POST   /api/v1/agents/tasks/{id}/cancel/  — cancel a running task
  GET    /api/v1/agents/tasks/{id}/stream/  — SSE stream for real-time progress
  GET    /api/v1/agents/tools/              — list all registered tools
  GET    /api/v1/agents/health/             — executor health check

Phase 5.1 — Agent Framework (Week 13)
Phase 5.4 — Agent UI / SSE Streaming (Week 16)
"""
from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path

from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

# Ensure the project root (containing ai_engine/) is on the path
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent.parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from apps.core.pagination import StandardPagination

from .models import AgentTask
from .serializers import (
    AgentTaskCreateSerializer,
    AgentTaskListSerializer,
    AgentTaskSerializer,
    AgentToolDescriptionSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Task list + create
# ---------------------------------------------------------------------------

class AgentTaskListCreateView(APIView):
    """
    GET  — Return paginated list of the authenticated user's agent tasks.
    POST — Create and immediately queue a new agent task.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        qs = AgentTask.objects.filter(user=request.user).order_by("-created_at")

        # Optional status filter: ?status=completed
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Optional task_type filter: ?task_type=research
        task_type_filter = request.query_params.get("task_type")
        if task_type_filter:
            qs = qs.filter(task_type=task_type_filter)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = AgentTaskListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request: Request) -> Response:
        serializer = AgentTaskCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Create the AgentTask record
        task_obj = AgentTask.objects.create(
            user=request.user,
            task_type=serializer.validated_data["task_type"],
            prompt=serializer.validated_data["prompt"],
            status=AgentTask.TaskStatus.PENDING,
        )

        # Queue the Celery task
        try:
            from .tasks import execute_agent_task
            celery_result = execute_agent_task.delay(str(task_obj.id))
            task_obj.celery_task_id = celery_result.id
            task_obj.save(update_fields=["celery_task_id"])
            logger.info("Queued AgentTask %s → Celery %s", task_obj.id, celery_result.id)
        except Exception as exc:
            logger.error("Failed to queue AgentTask %s: %s", task_obj.id, exc)
            task_obj.status = AgentTask.TaskStatus.FAILED
            task_obj.error_message = f"Failed to queue task: {exc}"
            task_obj.save(update_fields=["status", "error_message"])
            return Response(
                {"error": "Failed to queue agent task. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            AgentTaskSerializer(task_obj).data,
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Task detail
# ---------------------------------------------------------------------------

class AgentTaskDetailView(APIView):
    """GET /api/v1/agents/tasks/{id}/ — retrieve full task detail including result."""

    permission_classes = [IsAuthenticated]

    def _get_task(self, task_id: str, user) -> AgentTask | None:
        try:
            return AgentTask.objects.get(id=task_id, user=user)
        except AgentTask.DoesNotExist:
            return None

    def get(self, request: Request, task_id: str) -> Response:
        task_obj = self._get_task(task_id, request.user)
        if not task_obj:
            return Response({"error": "Agent task not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AgentTaskSerializer(task_obj).data)


# ---------------------------------------------------------------------------
# Task cancel
# ---------------------------------------------------------------------------

class AgentTaskCancelView(APIView):
    """POST /api/v1/agents/tasks/{id}/cancel/ — cancel a pending/processing task."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: str) -> Response:
        try:
            task_obj = AgentTask.objects.get(id=task_id, user=request.user)
        except AgentTask.DoesNotExist:
            return Response({"error": "Agent task not found."}, status=status.HTTP_404_NOT_FOUND)

        if task_obj.status in (AgentTask.TaskStatus.COMPLETED, AgentTask.TaskStatus.FAILED):
            return Response(
                {"error": f"Cannot cancel a task with status '{task_obj.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from .tasks import cancel_agent_task
            cancel_agent_task.delay(str(task_obj.id), task_obj.celery_task_id)
            return Response({"message": "Cancellation requested.", "task_id": str(task_obj.id)})
        except Exception as exc:
            logger.error("Cancel failed for AgentTask %s: %s", task_obj.id, exc)
            return Response(
                {"error": f"Cancellation failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ---------------------------------------------------------------------------
# Tool list
# ---------------------------------------------------------------------------

class AgentToolListView(APIView):
    """GET /api/v1/agents/tools/ — list all registered agent tools."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        try:
            from ai_engine.agents import get_executor
            executor = get_executor()
            tools = executor.list_tools()
        except Exception as exc:
            logger.error("Failed to load agent tools: %s", exc)
            tools = []

        serializer = AgentToolDescriptionSerializer(tools, many=True)
        return Response({"tools": serializer.data, "count": len(tools)})


# ---------------------------------------------------------------------------
# SSE streaming — real-time task progress (Phase 5.4)
# ---------------------------------------------------------------------------

def agent_task_stream(request, task_id: str) -> StreamingHttpResponse:
    """
    GET /api/v1/agents/tasks/{id}/stream/

    Server-Sent Events endpoint — plain Django view (bypasses DRF content
    negotiation so it can return text/event-stream without a 406 error).

    Authentication: Bearer JWT token in Authorization header, or
                    ?token=<jwt> query-param for EventSource clients
                    (EventSource API cannot set custom headers).

    Polls the AgentTask row every second and pushes status updates until
    the task reaches a terminal state (completed / failed) or 6 min timeout.

    Event format (JSON payload per SSE message):
        { "status": "...", "answer": "...", "tokens_used": 0,
          "cost_usd": "0.000000", "execution_time_s": null,
          "intermediate_steps": [], "error_message": "" }
    """
    from django.http import HttpResponse, JsonResponse

    # ── Authenticate: JWT Bearer token (header or ?token= query param) ────────
    user = None
    token_str = None

    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if auth_header.startswith("Bearer "):
        token_str = auth_header[7:].strip()
    if not token_str:
        token_str = request.GET.get("token", "")

    if token_str:
        try:
            from rest_framework_simplejwt.tokens import UntypedToken
            from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
            from rest_framework_simplejwt.authentication import JWTAuthentication

            jwt_auth = JWTAuthentication()
            validated = jwt_auth.get_validated_token(token_str.encode())
            user = jwt_auth.get_user(validated)
        except Exception:
            return JsonResponse({"error": "Invalid or expired token."}, status=401)
    else:
        # Fall back to session authentication (for same-origin requests)
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            return JsonResponse({"error": "Authentication required."}, status=401)

    # ── Validate task ownership ───────────────────────────────────────────────
    try:
        AgentTask.objects.get(id=task_id, user=user)
    except AgentTask.DoesNotExist:
        return JsonResponse({"error": "Agent task not found."}, status=404)

    # ── SSE generator ─────────────────────────────────────────────────────────
    def _event_stream():
        terminal = {AgentTask.TaskStatus.COMPLETED, AgentTask.TaskStatus.FAILED}
        poll_interval = 1.0
        max_polls = 360              # give up after 6 minutes

        for _ in range(max_polls):
            try:
                task_obj = AgentTask.objects.get(id=task_id, user=user)
            except AgentTask.DoesNotExist:
                payload = json.dumps({"error": "Task not found."})
                yield f"event: error\ndata: {payload}\n\n"
                return

            serializer = AgentTaskSerializer(task_obj)
            data = serializer.data
            payload = json.dumps({
                "status":             data.get("status"),
                "answer":             data.get("answer") or "",
                "tokens_used":        data.get("tokens_used", 0),
                "cost_usd":           str(data.get("cost_usd", "0.000000")),
                "execution_time_s":   data.get("execution_time_s"),
                "intermediate_steps": data.get("intermediate_steps") or [],
                "error_message":      data.get("error_message") or "",
                "completed_at":       data.get("completed_at"),
            })
            yield f"data: {payload}\n\n"

            if data.get("status") in terminal:
                yield "event: done\ndata: {}\n\n"
                return

            time.sleep(poll_interval)

        yield "event: timeout\ndata: {}\n\n"

    response = StreamingHttpResponse(
        streaming_content=_event_stream(),
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"   # disable Nginx buffering
    return response


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def agent_health(request: Request) -> Response:
    """GET /api/v1/agents/health/ — executor health check."""
    try:
        from ai_engine.agents import get_executor
        executor = get_executor()
        health_data = executor.health()
        return Response(health_data)
    except Exception as exc:
        logger.error("Agent health check failed: %s", exc)
        return Response(
            {"status": "error", "error": str(exc)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
