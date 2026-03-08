import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField
from pgvector.django import VectorField


class Repository(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    github_id    = models.BigIntegerField(unique=True)
    name         = models.CharField(max_length=500)
    full_name    = models.CharField(max_length=500, unique=True)
    description  = models.TextField(blank=True)
    url          = models.URLField(max_length=1000)
    clone_url    = models.URLField(max_length=1000, blank=True)
    stars        = models.IntegerField(default=0)
    forks        = models.IntegerField(default=0)
    watchers     = models.IntegerField(default=0)
    open_issues  = models.IntegerField(default=0)
    language     = models.CharField(max_length=100, blank=True)
    topics       = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    owner        = models.CharField(max_length=200)
    is_trending  = models.BooleanField(default=False)
    readme_summary = models.TextField(blank=True)
    embedding_id = models.CharField(max_length=200, blank=True)
    embedding    = VectorField(dimensions=384, null=True, blank=True)
    scraped_at   = models.DateTimeField(auto_now=True)
    repo_created_at = models.DateTimeField(null=True, blank=True)
    stars_today  = models.IntegerField(default=0)
    metadata     = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'repositories'
        ordering = ['-stars']
        indexes = [
            models.Index(fields=['language']),
            models.Index(fields=['is_trending']),
            models.Index(fields=['stars']),
        ]

    def __str__(self):
        return self.full_name
