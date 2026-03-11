"""
backend.apps.agents.tests.test_agent_views
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Unit tests for the agent API views.

Phase 5.1 — Agent Framework (Week 13)
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.agents.models import AgentTask
from apps.users.models import User


def _make_user(email="agent@test.com", password="pass1234!"):
    user = User.objects.create_user(username=email, email=email, password=password)
    return user


class TestAgentTaskListCreate(APITestCase):
    def setUp(self):
        self.user = _make_user()
        self.client.force_authenticate(user=self.user)
        self.url = reverse("agent-task-list-create")

    def test_list_empty(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 0)

    @patch("apps.agents.views.execute_agent_task")
    def test_create_task_success(self, mock_task):
        mock_task.delay.return_value = MagicMock(id="celery-id-123")
        data = {"task_type": "research", "prompt": "What are the latest AI trends in 2025?"}
        resp = self.client.post(self.url, data, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["task_type"], "research")
        self.assertEqual(resp.data["status"], "pending")

    def test_create_task_invalid_type(self):
        data = {"task_type": "invalid_type", "prompt": "Some prompt here"}
        resp = self.client.post(self.url, data, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("task_type", resp.data)

    def test_create_task_prompt_too_short(self):
        data = {"task_type": "general", "prompt": "short"}
        resp = self.client.post(self.url, data, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("prompt", resp.data)

    def test_create_task_prompt_too_long(self):
        data = {"task_type": "general", "prompt": "x" * 4001}
        resp = self.client.post(self.url, data, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        resp = self.client.post(self.url, {"task_type": "general", "prompt": "test prompt here"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("apps.agents.views.execute_agent_task")
    def test_list_filters_by_status(self, mock_task):
        AgentTask.objects.create(
            user=self.user, task_type="general",
            prompt="task one", status=AgentTask.TaskStatus.COMPLETED
        )
        AgentTask.objects.create(
            user=self.user, task_type="general",
            prompt="task two", status=AgentTask.TaskStatus.PENDING
        )
        resp = self.client.get(self.url + "?status=completed")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)

    def test_list_only_shows_own_tasks(self):
        other_user = _make_user("other@test.com")
        AgentTask.objects.create(
            user=other_user, task_type="general",
            prompt="someone else's task", status=AgentTask.TaskStatus.PENDING
        )
        AgentTask.objects.create(
            user=self.user, task_type="general",
            prompt="my own task here", status=AgentTask.TaskStatus.PENDING
        )
        resp = self.client.get(self.url)
        self.assertEqual(resp.data["count"], 1)


class TestAgentTaskDetail(APITestCase):
    def setUp(self):
        self.user = _make_user("detail@test.com")
        self.client.force_authenticate(user=self.user)
        self.task = AgentTask.objects.create(
            user=self.user, task_type="research",
            prompt="What is the state of LLM research?",
            status=AgentTask.TaskStatus.COMPLETED,
            result={"answer": "LLMs are advancing rapidly.", "intermediate_steps": [], "execution_time_s": 12.5},
            tokens_used=850, cost_usd=0.000064,
        )

    def test_get_task_detail(self):
        url = reverse("agent-task-detail", kwargs={"task_id": self.task.id})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "completed")
        self.assertEqual(resp.data["answer"], "LLMs are advancing rapidly.")
        self.assertEqual(resp.data["tokens_used"], 850)
        self.assertAlmostEqual(float(resp.data["execution_time_s"]), 12.5)

    def test_get_task_not_found(self):
        url = reverse("agent-task-detail", kwargs={"task_id": uuid.uuid4()})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_access_other_users_task(self):
        other_user = _make_user("other2@test.com")
        other_task = AgentTask.objects.create(
            user=other_user, task_type="general",
            prompt="private task prompt here", status=AgentTask.TaskStatus.PENDING
        )
        url = reverse("agent-task-detail", kwargs={"task_id": other_task.id})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class TestAgentTaskCancel(APITestCase):
    def setUp(self):
        self.user = _make_user("cancel@test.com")
        self.client.force_authenticate(user=self.user)

    @patch("apps.agents.views.cancel_agent_task")
    def test_cancel_pending_task(self, mock_cancel):
        mock_cancel.delay.return_value = MagicMock()
        task = AgentTask.objects.create(
            user=self.user, task_type="general",
            prompt="Long running research task here",
            status=AgentTask.TaskStatus.PENDING,
            celery_task_id="celery-abc-123"
        )
        url = reverse("agent-task-cancel", kwargs={"task_id": task.id})
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("Cancellation requested", resp.data["message"])

    def test_cannot_cancel_completed_task(self):
        task = AgentTask.objects.create(
            user=self.user, task_type="general",
            prompt="Already done task for testing",
            status=AgentTask.TaskStatus.COMPLETED,
        )
        url = reverse("agent-task-cancel", kwargs={"task_id": task.id})
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot cancel", resp.data["error"])


class TestAgentToolList(APITestCase):
    def setUp(self):
        self.user = _make_user("tools@test.com")
        self.client.force_authenticate(user=self.user)
        self.url = reverse("agent-tool-list")

    @patch("apps.agents.views.get_executor")
    def test_returns_tool_list(self, mock_get_executor):
        mock_executor = MagicMock()
        mock_executor.list_tools.return_value = [
            {"name": "search_knowledge_base", "description": "Search the knowledge base."},
            {"name": "fetch_arxiv_papers", "description": "Fetch arXiv papers."},
        ]
        mock_get_executor.return_value = mock_executor

        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 2)
        self.assertEqual(resp.data["tools"][0]["name"], "search_knowledge_base")


class TestAgentHealth(APITestCase):
    def setUp(self):
        self.user = _make_user("health@test.com")
        self.client.force_authenticate(user=self.user)
        self.url = reverse("agent-health")

    @patch("apps.agents.views.get_executor")
    def test_health_ok(self, mock_get_executor):
        mock_executor = MagicMock()
        mock_executor.health.return_value = {
            "status": "ok",
            "tools_registered": 5,
            "tool_names": ["search_knowledge_base", "fetch_articles", "analyze_trends", "search_github", "fetch_arxiv_papers"],
            "model": "gemini-1.5-flash-latest",
            "max_iterations": 10,
            "max_execution_time_s": 300,
        }
        mock_get_executor.return_value = mock_executor

        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "ok")
        self.assertEqual(resp.data["tools_registered"], 5)

    @patch("apps.agents.views.get_executor")
    def test_health_error_returns_503(self, mock_get_executor):
        mock_get_executor.side_effect = Exception("AI engine not available")
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp.data["status"], "error")
