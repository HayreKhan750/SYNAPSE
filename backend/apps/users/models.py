import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN   = 'admin',   'Admin'
        PREMIUM = 'premium', 'Premium'
        USER    = 'user',    'User'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email       = models.EmailField(unique=True)
    role        = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    avatar_url  = models.URLField(max_length=500, blank=True)
    preferences = models.JSONField(default=dict, blank=True)
    bio         = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']

    def __str__(self):
        return self.email

    @property
    def is_premium(self):
        return self.role in [self.Role.PREMIUM, self.Role.ADMIN]

    @property
    def is_admin_user(self):
        return self.role == self.Role.ADMIN
