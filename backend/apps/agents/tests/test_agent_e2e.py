"""
backend.apps.agents.tests.test_agent_e2e
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
End-to-end integration tests for the full agent task flow.

Phase 5.4 — Agent UI (Week 16)

Covers:
  - Creating an agent task via POST /api/v1/agents/tasks/
  - Polling task status via GET /api/v1/agents/tasks/{id}/
  - Cancelling a pending task via POST /api/v1/agents/tasks/{id}/cancel/
  - SSE stream endpoint returns correct content-type
  - Tool list endpoint returns registered tools
  - Health check endpoint
  - Cost and token fields are present and correct types
  - Task history filtering by status
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User
from apps.agents.models import AgentTask


class AgentTaskE2ETest(APITestCase):
    """Full lifecycle: create → poll → complete → history."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="agentuser",
            email="agentuser@test.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

    # ── create task ───────────────────────────────────────────────────────────

    @patch("apps.agents.views.execute_agent_task")
    def test_create_task_returns_201(self, mock_celery):
        """POST /agents/tasks/ creates an AgentTask and queues it."""
        mock_result = MagicMock()
        mock_result.id = str(uuid.uuid4())
        mock_celery.delay.return_value = mock_result

        payload = {"task_type": "general", "prompt": "Summarise the latest AI news for me."}
        response = self.client.post("/api/v1/agents/tasks/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn("id", data)
        self.assertEqual(data["task_type"], "general")
        self.assertEqual(data["status"], "pending")
        self.assertIn("cost_usd", data)
        self.assertIn("tokens_used", data)
        mock_celery.delay.assert_called_once()

    def test_create_task_prompt_too_short(self):
        """Prompt shorter than 10 chars should be rejected with 400."""
        payload = {"task_type": "general", "prompt": "short"}
        response = self.client.post("/api/v1/agents/tasks/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_task_invalid_type(self):
        """Unknown task_type should be rejected with 400."""
        payload = {"task_type": "unknown_type", "prompt": "This is a valid long enough prompt."}
        response = self.client.post("/api/v1/agents/tasks/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_task_requires_auth(self):
        """Unauthenticated requests should get 401."""
        self.client.force_authenticate(user=None)
        payload = {"task_type": "general", "prompt": "This is a valid long enough prompt."}
        response = self.client.post("/api/v1/agents/tasks/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── poll task detail ───────────────────────────────────────────────────────

    def test_get_task_detail(self):
        """GET /agents/tasks/{id}/ returns full task detail."""
        task = AgentTask.objects.create(
            user=self.user,
            task_type="research",
            prompt="What are the latest developments in quantum computing?",
            status=AgentTask.TaskStatus.COMPLETED,
            result={"answer": "Quantum computing advances rapidly.", "tokens_used": 512},
            tokens_used=512,
            cost_usd="0.000768",
        )
        response = self.client.get(f"/api/v1/agents/tasks/{task.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], str(task.id))
        self.assertEqual(data["status"], "completed")
        self.assertEqual(data["tokens_used"], 512)
        self.assertIn("answer", data)

    def test_get_task_not_found(self):
        """GET for non-existent task returns 404."""
        fake_id = uuid.uuid4()
        response = self.client.get(f"/api/v1/agents/tasks/{fake_id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_access_other_users_task(self):
        """User A cannot retrieve User B's task."""
        other = User.objects.create_user(username="other", email="other@test.com", password="pass")
        task = AgentTask.objects.create(
            user=other,
            task_type="general",
            prompt="This belongs to another user entirely.",
            status=AgentTask.TaskStatus.PENDING,
        )
        response = self.client.get(f"/api/v1/agents/tasks/{task.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── list + filter ──────────────────────────────────────────────────────────

    def test_list_tasks_returns_only_own(self):
        """GET /agents/tasks/ returns only the authenticated user's tasks."""
        AgentTask.objects.create(user=self.user, task_type="general", prompt="My task, long enough.")
        other = User.objects.create_user(username="stranger", email="s@test.com", password="pass")
        AgentTask.objects.create(user=other, task_type="general", prompt="Stranger task, long enough.")

        response = self.client.get("/api/v1/agents/tasks/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", response.json())
        ids = [t["id"] for t in results]
        # All returned tasks belong to self.user; stranger's task not included
        for task_id in ids:
            self.assertTrue(AgentTask.objects.filter(id=task_id, user=self.user).exists())

    def test_filter_tasks_by_status(self):
        """?status=completed filter returns only completed tasks."""
        AgentTask.objects.create(user=self.user, task_type="general", prompt="Pending task, long enough text.", status="pending")
        AgentTask.objects.create(user=self.user, task_type="research", prompt="Completed task, long enough text.", status="completed")

        response = self.client.get("/api/v1/agents/tasks/?status=completed")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", response.json())
        for task in results:
            self.assertEqual(task["status"], "completed")

    # ── cancel ─────────────────────────────────────────────────────────────────

    @patch("apps.agents.views.cancel_agent_task")
    def test_cancel_pending_task(self, mock_cancel):
        """POST /agents/tasks/{id}/cancel/ cancels a pending task."""
        mock_cancel.delay.return_value = MagicMock()
        task = AgentTask.objects.create(
            user=self.user,
            task_type="general",
            prompt="A cancelable task with sufficient length.",
            status=AgentTask.TaskStatus.PENDING,
            celery_task_id=str(uuid.uuid4()),
        )
        response = self.client.post(f"/api/v1/agents/tasks/{task.id}/cancel/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.json())

    def test_cancel_completed_task_fails(self):
        """Cannot cancel an already-completed task."""
        task = AgentTask.objects.create(
            user=self.user,
            task_type="general",
            prompt="A completed task with sufficient length.",
            status=AgentTask.TaskStatus.COMPLETED,
        )
        response = self.client.post(f"/api/v1/agents/tasks/{task.id}/cancel/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── SSE stream ─────────────────────────────────────────────────────────────

    def test_sse_stream_content_type(self):
        """GET /agents/tasks/{id}/stream/ returns text/event-stream content type."""
        task = AgentTask.objects.create(
            user=self.user,
            task_type="general",
            prompt="Stream this task result with enough characters.",
            status=AgentTask.TaskStatus.COMPLETED,
            result={"answer": "Done."},
            tokens_used=100,
        )
        response = self.client.get(f"/api/v1/agents/tasks/{task.id}/stream/", HTTP_ACCEPT="text/event-stream")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/event-stream", response.get("Content-Type", ""))

    def test_sse_stream_not_found(self):
        """SSE for non-existent task returns 404."""
        fake_id = uuid.uuid4()
        response = self.client.get(f"/api/v1/agents/tasks/{fake_id}/stream/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── tools ──────────────────────────────────────────────────────────────────

    @patch("apps.agents.views.get_executor")
    def test_tools_list(self, mock_get_executor):
        """GET /agents/tools/ returns tool list."""
        mock_executor = MagicMock()
        mock_executor.list_tools.return_value = [
            {"name": "search_knowledge_base", "description": "Searches the knowledge base."},
            {"name": "fetch_articles", "description": "Fetches articles."},
        ]
        mock_get_executor.return_value = mock_executor

        response = self.client.get("/api/v1/agents/tools/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("tools", data)
        self.assertIn("count", data)
        self.assertEqual(data["count"], 2)

    # ── health ─────────────────────────────────────────────────────────────────

    @patch("apps.agents.views.get_executor")
    def test_health_check(self, mock_get_executor):
        """GET /agents/health/ returns status ok."""
        mock_executor = MagicMock()
        mock_executor.health.return_value = {"status": "ok", "tools": 9}
        mock_get_executor.return_value = mock_executor

        response = self.client.get("/api/v1/agents/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "ok")

    # ── cost & token fields ────────────────────────────────────────────────────

    def test_task_has_cost_and_token_fields(self):
        """AgentTask model stores cost_usd and tokens_used correctly."""
        task = AgentTask.objects.create(
            user=self.user,
            task_type="trends",
            prompt="Analyze current trends in open source software development.",
            status=AgentTask.TaskStatus.COMPLETED,
            tokens_used=1234,
            cost_usd="0.001851",
        )
        response = self.client.get(f"/api/v1/agents/tasks/{task.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["tokens_used"], 1234)
        # cost_usd is serialized as string (DecimalField)
        self.assertIn("cost_usd", data)
        self.assertAlmostEqual(float(data["cost_usd"]), 0.001851, places=5)
