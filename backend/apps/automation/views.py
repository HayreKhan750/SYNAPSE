"""
Views for the Automation app.

Provides CRUD endpoints for AutomationWorkflow and WorkflowRun,
plus a manual trigger endpoint.
"""
import logging

from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AutomationWorkflow, WorkflowRun
from .serializers import (
    AutomationWorkflowSerializer,
    AutomationWorkflowListSerializer,
    WorkflowRunSerializer,
)

logger = logging.getLogger(__name__)


class WorkflowListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/automation/workflows/      — list current user's workflows
    POST /api/v1/automation/workflows/      — create a new workflow
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return AutomationWorkflowListSerializer
        return AutomationWorkflowSerializer

    def get_queryset(self):
        return AutomationWorkflow.objects.filter(
            user=self.request.user
        ).prefetch_related('runs')

    def perform_create(self, serializer):
        workflow = serializer.save(user=self.request.user)
        # If it's a scheduled workflow, register it with Celery Beat
        if workflow.trigger_type == AutomationWorkflow.TriggerType.SCHEDULE:
            _register_workflow_beat(workflow)
        logger.info(
            f"Workflow created: {workflow.id} ({workflow.name}) by user {self.request.user.email}"
        )


class WorkflowRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/v1/automation/workflows/<id>/  — retrieve workflow
    PATCH  /api/v1/automation/workflows/<id>/  — partial update
    PUT    /api/v1/automation/workflows/<id>/  — full update
    DELETE /api/v1/automation/workflows/<id>/  — delete workflow
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AutomationWorkflowSerializer

    def get_queryset(self):
        return AutomationWorkflow.objects.filter(
            user=self.request.user
        ).prefetch_related('runs')

    def perform_update(self, serializer):
        workflow = serializer.save()
        # Re-register beat schedule if cron changed
        if workflow.trigger_type == AutomationWorkflow.TriggerType.SCHEDULE:
            _register_workflow_beat(workflow)
        logger.info(f"Workflow updated: {workflow.id} ({workflow.name})")

    def perform_destroy(self, instance):
        _unregister_workflow_beat(instance)
        instance.delete()
        logger.info(f"Workflow deleted: {instance.id} ({instance.name})")


class WorkflowTriggerView(APIView):
    """
    POST /api/v1/automation/workflows/<id>/trigger/
    Manually trigger a workflow execution.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            workflow = AutomationWorkflow.objects.get(
                pk=pk, user=request.user
            )
        except AutomationWorkflow.DoesNotExist:
            return Response(
                {'detail': 'Workflow not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not workflow.is_active:
            return Response(
                {'detail': 'Workflow is not active.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Import here to avoid circular imports
        from .tasks import execute_workflow
        task = execute_workflow.delay(str(workflow.id))

        logger.info(
            f"Workflow {workflow.id} manually triggered by {request.user.email}. "
            f"Celery task: {task.id}"
        )
        return Response(
            {
                'detail': 'Workflow triggered successfully.',
                'workflow_id': str(workflow.id),
                'celery_task_id': task.id,
            },
            status=status.HTTP_202_ACCEPTED
        )


class WorkflowToggleView(APIView):
    """
    POST /api/v1/automation/workflows/<id>/toggle/
    Toggle a workflow's is_active state (pause/resume).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            workflow = AutomationWorkflow.objects.get(
                pk=pk, user=request.user
            )
        except AutomationWorkflow.DoesNotExist:
            return Response(
                {'detail': 'Workflow not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        workflow.is_active = not workflow.is_active
        new_status = (
            AutomationWorkflow.Status.ACTIVE
            if workflow.is_active
            else AutomationWorkflow.Status.PAUSED
        )
        workflow.status = new_status
        workflow.save(update_fields=['is_active', 'status', 'updated_at'])

        logger.info(
            f"Workflow {workflow.id} toggled to "
            f"{'active' if workflow.is_active else 'paused'} "
            f"by {request.user.email}"
        )
        return Response(
            {
                'detail': f"Workflow {'activated' if workflow.is_active else 'paused'}.",
                'is_active': workflow.is_active,
                'status': workflow.status,
            }
        )


class WorkflowRunListView(generics.ListAPIView):
    """
    GET /api/v1/automation/workflows/<id>/runs/
    List all runs for a specific workflow.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WorkflowRunSerializer

    def get_queryset(self):
        return WorkflowRun.objects.filter(
            workflow__id=self.kwargs['pk'],
            workflow__user=self.request.user,
        )


class WorkflowRunDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/automation/runs/<id>/
    Retrieve a specific workflow run.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WorkflowRunSerializer

    def get_queryset(self):
        return WorkflowRun.objects.filter(
            workflow__user=self.request.user
        )


# ── Helper utilities ──────────────────────────────────────────────────────────

def _register_workflow_beat(workflow: AutomationWorkflow) -> None:
    """Register or update a PeriodicTask in django-celery-beat for a workflow."""
    try:
        from django_celery_beat.models import PeriodicTask, CrontabSchedule
        import json

        if not workflow.cron_expression:
            return

        parts = workflow.cron_expression.strip().split()
        if len(parts) != 5:
            return

        minute, hour, day_of_month, month_of_year, day_of_week = parts

        schedule, _ = CrontabSchedule.objects.get_or_create(
            minute=minute,
            hour=hour,
            day_of_month=day_of_month,
            month_of_year=month_of_year,
            day_of_week=day_of_week,
        )

        task_name = f"workflow-{workflow.id}"
        PeriodicTask.objects.update_or_create(
            name=task_name,
            defaults={
                'crontab': schedule,
                'task': 'apps.automation.tasks.execute_workflow',
                'kwargs': json.dumps({'workflow_id': str(workflow.id)}),
                'enabled': workflow.is_active,
            }
        )
        logger.info(f"Registered Celery Beat task: {task_name}")
    except Exception as exc:
        logger.warning(f"Failed to register beat task for workflow {workflow.id}: {exc}")


def _unregister_workflow_beat(workflow: AutomationWorkflow) -> None:
    """Remove the PeriodicTask associated with a workflow."""
    try:
        from django_celery_beat.models import PeriodicTask
        task_name = f"workflow-{workflow.id}"
        PeriodicTask.objects.filter(name=task_name).delete()
        logger.info(f"Unregistered Celery Beat task: {task_name}")
    except Exception as exc:
        logger.warning(f"Failed to unregister beat task for workflow {workflow.id}: {exc}")
