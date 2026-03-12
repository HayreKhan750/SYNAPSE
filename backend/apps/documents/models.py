import uuid
from django.db import models
from apps.users.models import User

class GeneratedDocument(models.Model):
    class DocType(models.TextChoices):
        PDF      = 'pdf',      'PDF'
        PPT      = 'ppt',      'PowerPoint'
        WORD     = 'word',     'Word'
        MARKDOWN = 'markdown', 'Markdown'
        PROJECT  = 'project',  'Project Scaffold'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user            = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    title           = models.CharField(max_length=500)
    doc_type        = models.CharField(max_length=20, choices=DocType.choices)
    file_path       = models.CharField(max_length=1000, blank=True)
    cloud_url       = models.URLField(max_length=1000, blank=True)
    file_size_bytes = models.BigIntegerField(default=0)
    agent_prompt    = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    metadata        = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'generated_documents'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.doc_type})"
