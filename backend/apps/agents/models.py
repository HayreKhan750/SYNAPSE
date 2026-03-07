import uuid
from django.db import models
from apps.users.models import User

class AgentTask(models.Model):
    class TaskStatus(models.TextChoices):
        PENDING    = 'pending',    'Pending'
        PROCESSING = 'processing', 'Processing'
        COMPLETED  = 'completed',  'Completed'
        FAILED     = 'failed',     'Failed'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user           = models.ForeignKey(User, on_delete=models.CASCADE, related_name='agent_tasks')
    task_type      = models.CharField(max_length=200)
    prompt         = models.TextField()
    status         = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING)
    result         = models.JSONField(default=dict, blank=True)
    error_message  = models.TextField(blank=True)
    celery_task_id = models.CharField(max_length=200, blank=True)
    tokens_used    = models.IntegerField(default=0)
    cost_usd       = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    created_at     = models.DateTimeField(auto_now_add=True)
    completed_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'agent_tasks'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.task_type} — {self.status}"
