"""
SYNAPSE Django settings for Replit development environment.
Inherits from development.py but overrides Redis/Celery to use in-memory backends.
"""

from .development import *  # noqa: F401, F403
import os

# Override ALLOWED_HOSTS for Replit proxy
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# ── Use in-memory channel layer (no Redis needed) ─────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

# ── Disable Redis cache, use in-memory ────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "synapse-default",
    }
}

# ── Disable Celery broker / result backend ────────────────────────────────────
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
CELERY_ALWAYS_EAGER = True
CELERY_EAGER_PROPAGATES = True
CELERY_TASK_ALWAYS_EAGER = True

# ── Database (Replit PostgreSQL) ───────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "heliumdb"),
        "USER": os.environ.get("DB_USER", "postgres"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "password"),
        "HOST": os.environ.get("DB_HOST", "helium"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }
}

# ── Disable Silk profiler ──────────────────────────────────────────────────────
SILKY_PYTHON_PROFILER = False
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != "silk"]
MIDDLEWARE = [m for m in MIDDLEWARE if "silk" not in m.lower()]

# ── Disable Axes login throttling in dev ──────────────────────────────────────
AXES_ENABLED = False

# ── Disable throttling ────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {},
}

# ── Disable Sentry ────────────────────────────────────────────────────────────
SENTRY_DSN = None

# ── Static files ──────────────────────────────────────────────────────────────
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
STATIC_URL = "/static/"

# ── Media files ───────────────────────────────────────────────────────────────
MEDIA_ROOT = os.path.join(BASE_DIR, "media")
MEDIA_URL = "/media/"

# ── CORS for Next.js dev server ───────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:22167",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:22167",
]
CORS_ALLOW_ALL_ORIGINS = True

# ── JWT settings ───────────────────────────────────────────────────────────────
from datetime import timedelta  # noqa: E402
SIMPLE_JWT = {
    **SIMPLE_JWT,
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# ── Disable email sending (use console backend) ────────────────────────────────
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# ── Dev-only: skip email verification requirement ─────────────────────────────
# In Replit we use the console email backend so real emails never arrive.
# Setting this to True makes RegisterView auto-verify and issue JWT tokens
# immediately on signup so users can use the app without an inbox.
AUTO_VERIFY_EMAIL = True
