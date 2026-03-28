from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ['*']

# ── django.contrib.postgres is required for ArrayField ──────────────────────
# Must be included when using PostgreSQL (ArrayField, HStoreField, etc.)
if 'django.contrib.postgres' not in INSTALLED_APPS:
    INSTALLED_APPS = list(INSTALLED_APPS) + ['django.contrib.postgres']

# Allow all CORS in development
CORS_ALLOW_ALL_ORIGINS = True

# Disable axes in development for convenience
AXES_ENABLED = False

# Disable throttling in development/test to prevent 429s during test runs
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
}

# Show SQL queries in development
LOGGING['loggers']['django.db.backends'] = {
    'handlers': ['console'],
    'level': 'WARNING',  # set to DEBUG to see SQL, WARNING to reduce noise
    'propagate': False,
}

