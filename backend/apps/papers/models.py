import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField


class ResearchPaper(models.Model):
    class Difficulty(models.TextChoices):
        BEGINNER     = 'beginner',     'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED     = 'advanced',     'Advanced'

    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    arxiv_id          = models.CharField(max_length=50, unique=True)
    title             = models.TextField()
    abstract          = models.TextField(blank=True)
    summary           = models.TextField(blank=True)
    authors           = ArrayField(models.CharField(max_length=300), default=list)
    categories        = ArrayField(models.CharField(max_length=100), default=list)
    published_date    = models.DateField(null=True, blank=True)
    url               = models.URLField(max_length=1000)
    pdf_url           = models.URLField(max_length=1000, blank=True)
    citation_count    = models.IntegerField(default=0)
    difficulty_level  = models.CharField(max_length=20, choices=Difficulty.choices, default=Difficulty.INTERMEDIATE)
    key_contributions = models.TextField(blank=True)
    applications      = models.TextField(blank=True)
    embedding_id      = models.CharField(max_length=200, blank=True)
    fetched_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'research_papers'
        ordering = ['-published_date']
        indexes = [
            models.Index(fields=['published_date']),
            models.Index(fields=['difficulty_level']),
        ]

    def __str__(self):
        return self.title[:80]
