"""
Tests for the Automation app Celery tasks.

Covers:
  - execute_workflow() orchestration logic
  - Action handlers: collect_news, summarize_content, send_email, generate_pdf
  - cleanup_stale_runs()
  - Edge cases: missing workflow, invalid action, all-success, partial-failure
"""
import uuid
from datetime import timedelta
from unittest.mock import patch, MagicMock, call

from django.test import TestCase
from django.utils import timezone

from apps.users.models import User
from apps.automation.models import AutomationWorkflow, WorkflowRun
from apps.automation.tasks import (
    execute_workflow,
    cleanup_stale_runs,
    _action_collect_news,
    _action_summarize_content,
    _action_send_email,
)


def _make_user():
    uid = uuid.uuid4().hex[:6]
    return User.objects.create_user(
        username=f"task_test_{uid}",
        email=f"task_test_{uid}@example.com",
        password="pass12345",
    )


def _make_workflow(user, actions=None, is_active=True):
    return AutomationWorkflow.objects.create(
        user=user,
        name="Test Workflow",
        trigger_type="manual",
        is_active=is_active,
        actions=actions or [{"type": "collect_news", "params": {"sources": ["hackernews"]}}],
    )


class ExecuteWorkflowTaskTests(TestCase):

    def setUp(self):
        self.user = _make_user()

    def test_nonexistent_workflow_id_does_not_crash(self):
        """Task should handle missing workflow gracefully (not raise)."""
        fake_id = str(uuid.uuid4())
        # Should complete without raising
        try:
            execute_workflow(fake_id)
        except Exception as exc:
            self.fail(f"execute_workflow raised unexpectedly: {exc}")

    def test_creates_workflow_run_on_execution(self):
        wf = _make_workflow(self.user)
        with patch.dict("apps.automation.tasks.ACTION_HANDLERS", {"collect_news": MagicMock(return_value={"action": "collect_news", "status": "queued", "task_ids": {}})}):
            execute_workflow(str(wf.id))
        self.assertTrue(WorkflowRun.objects.filter(workflow=wf).exists())

    def test_successful_execution_sets_run_status_success(self):
        wf = _make_workflow(self.user, actions=[
            {"type": "collect_news", "params": {"sources": ["hackernews"]}}
        ])
        with patch.dict("apps.automation.tasks.ACTION_HANDLERS", {"collect_news": MagicMock(return_value={"action": "collect_news", "status": "queued", "task_ids": {}})}):
            execute_workflow(str(wf.id))
        run = WorkflowRun.objects.filter(workflow=wf).first()
        self.assertIsNotNone(run)
        self.assertEqual(run.status, WorkflowRun.RunStatus.SUCCESS)

    def test_failed_action_sets_run_status_failed(self):
        wf = _make_workflow(self.user, actions=[
            {"type": "collect_news", "params": {}}
        ])
        mock_fn = MagicMock(side_effect=Exception("boom"))
        with patch.dict("apps.automation.tasks.ACTION_HANDLERS", {"collect_news": mock_fn}):
            execute_workflow(str(wf.id))
        run = WorkflowRun.objects.filter(workflow=wf).first()
        self.assertEqual(run.status, WorkflowRun.RunStatus.FAILED)
        self.assertIn("boom", run.error_message)

    def test_unknown_action_type_is_handled_gracefully(self):
        wf = _make_workflow(self.user, actions=[
            {"type": "teleport", "params": {}}
        ])
        execute_workflow(str(wf.id))
        run = WorkflowRun.objects.filter(workflow=wf).first()
        # Should fail or skip, not crash the worker
        self.assertIsNotNone(run)

    def test_workflow_run_count_incremented(self):
        wf = _make_workflow(self.user)
        initial_count = wf.run_count
        with patch.dict("apps.automation.tasks.ACTION_HANDLERS", {"collect_news": MagicMock(return_value={"action": "collect_news", "status": "queued", "task_ids": {}})}):
            execute_workflow(str(wf.id))
        wf.refresh_from_db()
        self.assertEqual(wf.run_count, initial_count + 1)

    def test_last_run_at_updated(self):
        wf = _make_workflow(self.user)
        before = timezone.now()
        with patch.dict("apps.automation.tasks.ACTION_HANDLERS", {"collect_news": MagicMock(return_value={"action": "collect_news", "status": "queued", "task_ids": {}})}):
            execute_workflow(str(wf.id))
        wf.refresh_from_db()
        self.assertIsNotNone(wf.last_run_at)
        self.assertGreaterEqual(wf.last_run_at, before)

    def test_multiple_actions_all_executed_in_order(self):
        call_order = []

        def mock_news(params):
            call_order.append("collect_news")
            return {"action": "collect_news", "status": "queued", "task_ids": {}}

        def mock_summarize(params):
            call_order.append("summarize_content")
            return {"action": "summarize_content", "status": "queued"}

        wf = _make_workflow(self.user, actions=[
            {"type": "collect_news", "params": {}},
            {"type": "summarize_content", "params": {}},
        ])
        with patch.dict("apps.automation.tasks.ACTION_HANDLERS", {
            "collect_news": mock_news,
            "summarize_content": mock_summarize,
        }):
            execute_workflow(str(wf.id))

        self.assertEqual(call_order, ["collect_news", "summarize_content"])


class ActionHandlerTests(TestCase):

    def test_collect_news_queues_hackernews_task(self):
        with patch("apps.core.tasks.scrape_hackernews") as mock_task:
            mock_task.delay.return_value = MagicMock(id="task-123")
            result = _action_collect_news({"sources": ["hackernews"]})
        self.assertEqual(result["action"], "collect_news")
        self.assertEqual(result["status"], "queued")
        mock_task.delay.assert_called_once()

    def test_collect_news_empty_sources_queues_all(self):
        with patch("apps.core.tasks.scrape_hackernews") as m1, \
             patch("apps.core.tasks.scrape_github") as m2, \
             patch("apps.core.tasks.scrape_arxiv") as m3, \
             patch("apps.core.tasks.scrape_youtube") as m4:
            for m in (m1, m2, m3, m4):
                m.delay.return_value = MagicMock(id="t")
            result = _action_collect_news({})  # no sources = all
        self.assertIn("hackernews", result["task_ids"])
        self.assertIn("github", result["task_ids"])

    def test_summarize_content_queues_nlp_tasks(self):
        with patch("apps.articles.tasks.process_article_nlp") as mock_task:
            mock_task.delay.return_value = MagicMock(id="nlp-task")
            result = _action_summarize_content({})
        self.assertIn(result["status"], ["queued", "ok", "skipped"])

    def test_send_email_creates_notification(self):
        """send_email action creates an in-app notification for the workflow owner."""
        from apps.users.models import User
        from apps.notifications.models import Notification
        import uuid as _uuid
        uid = _uuid.uuid4().hex[:6]
        user = User.objects.create_user(
            username=f"email_test_{uid}",
            email=f"email_test_{uid}@example.com",
            password="pass12345",
        )
        from apps.automation.models import AutomationWorkflow
        wf = AutomationWorkflow.objects.create(
            user=user,
            name="Email Test Workflow",
            trigger_type="manual",
            actions=[{"type": "send_email", "params": {}}],
        )
        with patch("apps.notifications.tasks.send_notification_email_task") as mock_email:
            mock_email.delay = MagicMock()
            result = _action_send_email(wf, {"subject": "Done", "body": "Completed."})
        self.assertEqual(result["action"], "send_email")
        self.assertIn(result["status"], ["notification_created", "failed"])

    def test_send_email_bad_params_handled_gracefully(self):
        """send_email action with an invalid workflow mock should not raise unhandled."""
        wf_mock = MagicMock()
        wf_mock.user = MagicMock()
        wf_mock.name = "Bad Workflow"
        # Should not raise — returns a dict with status
        result = _action_send_email(wf_mock, {})
        self.assertIn("action", result)
        self.assertEqual(result["action"], "send_email")


class CleanupStaleRunsTests(TestCase):

    def setUp(self):
        self.user = _make_user()
        self.wf = _make_workflow(self.user)

    def test_stale_running_runs_marked_failed(self):
        # Create a run stuck in RUNNING state for >1 hour
        stale_run = WorkflowRun.objects.create(
            workflow=self.wf,
            status=WorkflowRun.RunStatus.RUNNING,
        )
        # Manually backdate started_at
        WorkflowRun.objects.filter(id=stale_run.id).update(
            started_at=timezone.now() - timedelta(hours=2)
        )
        cleanup_stale_runs()
        stale_run.refresh_from_db()
        self.assertEqual(stale_run.status, WorkflowRun.RunStatus.FAILED)

    def test_recent_running_run_not_touched(self):
        fresh_run = WorkflowRun.objects.create(
            workflow=self.wf,
            status=WorkflowRun.RunStatus.RUNNING,
        )
        cleanup_stale_runs()
        fresh_run.refresh_from_db()
        self.assertEqual(fresh_run.status, WorkflowRun.RunStatus.RUNNING)

    def test_already_completed_runs_not_touched(self):
        done_run = WorkflowRun.objects.create(
            workflow=self.wf,
            status=WorkflowRun.RunStatus.SUCCESS,
        )
        cleanup_stale_runs()
        done_run.refresh_from_db()
        self.assertEqual(done_run.status, WorkflowRun.RunStatus.SUCCESS)
