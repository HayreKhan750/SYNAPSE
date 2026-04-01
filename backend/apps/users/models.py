import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN   = 'admin',   'Admin'
        PREMIUM = 'premium', 'Premium'
        USER    = 'user',    'User'

    id                       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email                    = models.EmailField(unique=True)
    role                     = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    avatar_url               = models.URLField(max_length=500, blank=True)
    preferences              = models.JSONField(default=dict, blank=True)
    bio                      = models.TextField(blank=True)
    created_at               = models.DateTimeField(auto_now_add=True)
    updated_at               = models.DateTimeField(auto_now=True)
    # ── Email verification ────────────────────────────────────
    email_verified           = models.BooleanField(default=True)
    email_verification_token = models.UUIDField(null=True, blank=True, default=uuid.uuid4)
    # ── Social auth ───────────────────────────────────────────
    google_id                = models.CharField(max_length=255, blank=True, unique=True, null=True)
    github_id                = models.CharField(max_length=255, blank=True, unique=True, null=True)
    github_username          = models.CharField(max_length=255, blank=True)
    # ── Onboarding ────────────────────────────────────────────
    is_onboarded             = models.BooleanField(default=False)
    onboarded_at             = models.DateTimeField(null=True, blank=True)
    # ── Weekly digest preferences ─────────────────────────────
    digest_enabled           = models.BooleanField(default=True)
    digest_day               = models.CharField(
        max_length=10,
        default='monday',
        choices=[
            ('monday', 'Monday'), ('tuesday', 'Tuesday'), ('wednesday', 'Wednesday'),
            ('thursday', 'Thursday'), ('friday', 'Friday'), ('saturday', 'Saturday'),
            ('sunday', 'Sunday'),
        ]
    )

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


class OnboardingPreferences(models.Model):
    """Stores user interest and use-case preferences captured during onboarding."""

    INTEREST_CHOICES = [
        ('ai_ml',        'AI & Machine Learning'),
        ('web_dev',      'Web Development'),
        ('security',     'Security & Privacy'),
        ('cloud_devops', 'Cloud & DevOps'),
        ('research',     'Academic Research'),
        ('data_science', 'Data Science'),
        ('open_source',  'Open Source'),
        ('startup',      'Startups & Business'),
        ('finance',      'Finance & Crypto'),
        ('health_bio',   'Health & Biotech'),
    ]

    USE_CASE_CHOICES = [
        ('research',    'Daily Research Digest'),
        ('automation',  'Workflow Automation'),
        ('learning',    'Continuous Learning'),
        ('archiving',   'Knowledge Archiving'),
        ('team',        'Team Collaboration'),
    ]

    user         = models.OneToOneField(User, on_delete=models.CASCADE, related_name='onboarding_prefs')
    interests    = models.JSONField(default=list, blank=True, help_text='List of selected interest slugs')
    use_case     = models.CharField(max_length=20, choices=USE_CASE_CHOICES, blank=True)
    current_step = models.PositiveSmallIntegerField(default=1)
    completed    = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_onboarding_preferences'

    def __str__(self):
        return f"OnboardingPrefs({self.user.email}, step={self.current_step}, done={self.completed})"
