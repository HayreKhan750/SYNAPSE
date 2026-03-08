import uuid
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey


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
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id    = models.CharField(max_length=50)  # UUID as string
    content_object = GenericForeignKey('content_type', 'object_id')
    interaction_type = models.CharField(max_length=32, choices=ACTION_CHOICES)
    timestamp    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_activities'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp'], name='ua_user_time_idx'),
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
