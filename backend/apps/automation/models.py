import uuid
from django.db import models
from apps.users.models import User

class AutomationWorkflow(models.Model):
    class TriggerType(models.TextChoices):
        SCHEDULE = 'schedule', 'Schedule'
        EVENT    = 'event',    'Event'
        MANUAL   = 'manual',   'Manual'
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        FAILED = 'failed', 'Failed'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user            = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workflows')
    name            = models.CharField(max_length=300)
    description     = models.TextField(blank=True)
    trigger_type    = models.CharField(max_length=20, choices=TriggerType.choices, default=TriggerType.SCHEDULE)
    cron_expression = models.CharField(max_length=100, blank=True)
    actions         = models.JSONField(default=list)
    is_active       = models.BooleanField(default=True)
    last_run_at     = models.DateTimeField(null=True, blank=True)
    next_run_at     = models.DateTimeField(null=True, blank=True)
    run_count       = models.IntegerField(default=0)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'automation_workflows'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} — {self.name}"

class WorkflowRun(models.Model):
    class RunStatus(models.TextChoices):
        PENDING   = 'pending',   'Pending'
        RUNNING   = 'running',   'Running'
        SUCCESS   = 'success',   'Success'
        FAILED    = 'failed',    'Failed'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow     = models.ForeignKey(AutomationWorkflow, on_delete=models.CASCADE, related_name='runs')
    status       = models.CharField(max_length=20, choices=RunStatus.choices, default=RunStatus.PENDING)
    started_at   = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    result       = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = 'workflow_runs'
        ordering = ['-started_at']
