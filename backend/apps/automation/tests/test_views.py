"""
Integration tests for Automation API views.
"""
from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apps.users.models import User
from apps.automation.models import AutomationWorkflow, WorkflowRun


class WorkflowAPITestCase(APITestCase):
    """Base test case with authenticated user and sample workflow."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        self.other_user = User.objects.create_user(
            username='other',
            email='other@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

        self.workflow = AutomationWorkflow.objects.create(
            user=self.user,
            name='My Workflow',
            description='Test workflow',
            trigger_type=AutomationWorkflow.TriggerType.SCHEDULE,
            cron_expression='0 * * * *',
            actions=[{'type': 'collect_news'}],
            is_active=True,
        )

    # ── List & Create ─────────────────────────────────────────────────────────

    def test_list_workflows_authenticated(self):
        url = reverse('workflow-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_returns_only_own_workflows(self):
        AutomationWorkflow.objects.create(
            user=self.other_user,
            name='Other Workflow',
            trigger_type=AutomationWorkflow.TriggerType.MANUAL,
            actions=[{'type': 'collect_news'}],
        )
        url = reverse('workflow-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        # Handle custom wrapper, paginated, and plain list responses
        if isinstance(data, dict):
            if 'data' in data:
                results = list(data['data'])
            elif 'results' in data:
                results = list(data['results'])
            else:
                results = list(data.values())
        elif isinstance(data, list):
            results = data
        else:
            results = list(data)
        names = [item['name'] for item in results]
        self.assertIn('My Workflow', names)
        self.assertNotIn('Other Workflow', names)

    def test_create_workflow_valid(self):
        url = reverse('workflow-list-create')
        payload = {
            'name': 'New Workflow',
            'description': 'A test',
            'trigger_type': 'schedule',
            'cron_expression': '0 8 * * *',
            'actions': [{'type': 'collect_news'}],
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'New Workflow')

    def test_create_workflow_missing_cron_for_schedule(self):
        url = reverse('workflow-list-create')
        payload = {
            'name': 'Bad Workflow',
            'trigger_type': 'schedule',
            'cron_expression': '',
            'actions': [{'type': 'collect_news'}],
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_workflow_invalid_action_type(self):
        url = reverse('workflow-list-create')
        payload = {
            'name': 'Bad Actions',
            'trigger_type': 'manual',
            'actions': [{'type': 'invalid_action'}],
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_workflow_empty_actions(self):
        url = reverse('workflow-list-create')
        payload = {
            'name': 'Empty Actions',
            'trigger_type': 'manual',
            'actions': [],
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_access_denied(self):
        self.client.force_authenticate(user=None)
        url = reverse('workflow-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Retrieve / Update / Delete ────────────────────────────────────────────

    def test_retrieve_workflow(self):
        url = reverse('workflow-detail', kwargs={'pk': self.workflow.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'My Workflow')

    def test_retrieve_other_user_workflow_404(self):
        other_wf = AutomationWorkflow.objects.create(
            user=self.other_user,
            name='Other',
            trigger_type=AutomationWorkflow.TriggerType.MANUAL,
            actions=[{'type': 'collect_news'}],
        )
        url = reverse('workflow-detail', kwargs={'pk': other_wf.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_workflow(self):
        url = reverse('workflow-detail', kwargs={'pk': self.workflow.id})
        # Provide all required fields for a full valid partial update
        response = self.client.patch(
            url,
            {
                'name': 'Updated Name',
                'actions': [{'type': 'collect_news'}],
                'cron_expression': '0 * * * *',
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Name')

    def test_delete_workflow(self):
        url = reverse('workflow-detail', kwargs={'pk': self.workflow.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(AutomationWorkflow.objects.filter(id=self.workflow.id).exists())

    # ── Trigger ───────────────────────────────────────────────────────────────

    @patch('apps.automation.tasks.execute_workflow')
    def test_trigger_workflow(self, mock_task):
        mock_task.delay.return_value.id = 'mock-task-id'
        url = reverse('workflow-trigger', kwargs={'pk': self.workflow.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn('celery_task_id', response.data)
        mock_task.delay.assert_called_once_with(str(self.workflow.id))

    def test_trigger_inactive_workflow(self):
        self.workflow.is_active = False
        self.workflow.save()
        url = reverse('workflow-trigger', kwargs={'pk': self.workflow.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Toggle ────────────────────────────────────────────────────────────────

    def test_toggle_workflow_pauses(self):
        url = reverse('workflow-toggle', kwargs={'pk': self.workflow.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_active'])
        self.assertEqual(response.data['status'], 'paused')

    def test_toggle_workflow_resumes(self):
        self.workflow.is_active = False
        self.workflow.status = AutomationWorkflow.Status.PAUSED
        self.workflow.save()
        url = reverse('workflow-toggle', kwargs={'pk': self.workflow.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_active'])

    # ── Run History ───────────────────────────────────────────────────────────

    def test_list_workflow_runs(self):
        WorkflowRun.objects.create(
            workflow=self.workflow,
            status=WorkflowRun.RunStatus.SUCCESS,
        )
        url = reverse('workflow-runs', kwargs={'pk': self.workflow.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_retrieve_run_detail(self):
        run = WorkflowRun.objects.create(
            workflow=self.workflow,
            status=WorkflowRun.RunStatus.SUCCESS,
        )
        url = reverse('run-detail', kwargs={'pk': run.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
