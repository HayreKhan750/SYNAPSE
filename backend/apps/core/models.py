import uuid
import time
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils import timezone


class UserBookmark(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user         = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookmarks')
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id    = models.CharField(max_length=50)  # UUID stored as string
    notes        = models.TextField(blank=True)
    tags         = models.JSONField(default=list, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_bookmarks'
        unique_together = [('user', 'content_type', 'object_id')]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'content_type'], name='ub_user_ct_idx'),
            models.Index(fields=['user', 'created_at'], name='ub_user_created_idx'),
        ]

    def __str__(self):
        return f"{self.user.email} bookmarked {self.content_type} {self.object_id}"

    @property
    def content_object(self):
        model_class = self.content_type.model_class()
        try:
            return model_class.objects.get(pk=self.object_id)
        except model_class.DoesNotExist:
            return None


class UserActivity(models.Model):
    ACTION_CHOICES = (
        ("view", "view"),
        ("bookmark", "bookmark"),
        ("unbookmark", "unbookmark"),
        ("like", "like"),
        ("search", "search"),
    )

    user         = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='activities')
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id    = models.CharField(max_length=50, blank=True, null=True)  # UUID as string or free-form for search
    content_object = GenericForeignKey('content_type', 'object_id')
    interaction_type = models.CharField(max_length=32, choices=ACTION_CHOICES)
    metadata     = models.JSONField(default=dict, blank=True)
    timestamp    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_activities'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp'], name='ua_user_time_idx'),
            models.Index(fields=['interaction_type'], name='ua_interaction_type_idx'),
            models.Index(fields=['user', 'interaction_type'], name='ua_user_interaction_idx'),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.interaction_type}:{self.content_type_id}:{self.object_id}"


class Collection(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='collections')
    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_public   = models.BooleanField(default=False)
    bookmarks   = models.ManyToManyField(UserBookmark, blank=True, related_name='collections')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'collections'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email}: {self.name}"


class Conversation(models.Model):
    """Stores AI chat conversation history per user."""
    conversation_id = models.CharField(max_length=255, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations',
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=500, blank=True, default='')
    messages = models.JSONField(default=list)  # [{"role": "human"|"ai", "content": str, "ts": float}]
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['conversation_id']),
        ]

    def __str__(self):
        return f'Conversation {self.conversation_id} ({self.user})'

    def delete_message_pair(self, message_index: int) -> bool:
        """
        Delete a human message at *message_index* and the AI reply immediately
        after it (if it exists).  Returns True if anything was deleted.
        """
        messages = list(self.messages)
        if message_index < 0 or message_index >= len(messages):
            return False
        # Remove the AI reply first (if present and is an AI message)
        if message_index + 1 < len(messages) and messages[message_index + 1].get("role") == "ai":
            messages.pop(message_index + 1)
        messages.pop(message_index)
        self.messages = messages
        self.save(update_fields=["messages", "updated_at"])
        return True

    def truncate_from(self, message_index: int) -> None:
        """Remove all messages from *message_index* onwards (inclusive)."""
        self.messages = list(self.messages)[:message_index]
        self.save(update_fields=["messages", "updated_at"])

    def add_message(self, role: str, content: str) -> None:
        self.messages.append({'role': role, 'content': content, 'ts': time.time()})
        self.save(update_fields=['messages', 'updated_at'])

    def get_title(self) -> str:
        if self.title:
            return self.title
        for msg in self.messages:
            if msg.get('role') == 'human':
                return msg['content'][:100]
        return f'Conversation {self.conversation_id[:8]}'


class DailyBriefing(models.Model):
    """AI-generated daily briefing personalised per user."""

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user          = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_briefings',
    )
    date          = models.DateField(default=timezone.localdate)
    content       = models.TextField()          # 3-paragraph briefing text
    sources       = models.JSONField(default=list)   # [{"title": ..., "url": ..., "type": ...}]
    topic_summary = models.JSONField(default=dict)   # {"topics": [...], "sentiment": "..."}
    generated_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table       = 'daily_briefings'
        unique_together = [('user', 'date')]
        ordering        = ['-date']
        indexes = [
            models.Index(fields=['user', '-date'], name='db_user_date_idx'),
        ]

    def __str__(self):
        return f"Briefing for {self.user_id} on {self.date}"
