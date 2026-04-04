"""
Production settings — hardened, optimised, industry-standard.

Best practices applied:
  ✓ Pinned package versions in requirements.txt
  ✓ Security headers (HSTS, CSP, XFO, referrer policy)
  ✓ WhiteNoise for efficient static file serving
  ✓ Sentry error tracking
  ✓ Structured JSON logging
  ✓ Connection pooling via CONN_MAX_AGE
  ✓ django-silk disabled in production
  ✓ ALLOWED_HOSTS from env
"""
from .base import *  # noqa: F401, F403
import os

DEBUG = False
"""
DEBUG must always be False in production.
Never enable debug mode in production — it exposes sensitive information,
disables security middleware, and allows arbitrary code execution.
"""

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

# ── Security headers ──────────────────────────────────────────────────────────
SECURE_SSL_REDIRECT              = True
SECURE_HSTS_SECONDS              = 31_536_000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS   = True
SECURE_HSTS_PRELOAD              = True
SESSION_COOKIE_SECURE            = True
SESSION_COOKIE_HTTPONLY          = True
SESSION_COOKIE_SAMESITE          = 'Lax'
CSRF_COOKIE_SECURE               = True
CSRF_COOKIE_HTTPONLY             = True
CSRF_COOKIE_SAMESITE             = 'Strict'
SECURE_CONTENT_TYPE_NOSNIFF      = True
SECURE_BROWSER_XSS_FILTER        = True
X_FRAME_OPTIONS                  = 'DENY'
SECURE_REFERRER_POLICY           = 'strict-origin-when-cross-origin'
SECURE_PROXY_SSL_HEADER          = ('HTTP_X_FORWARDED_PROTO', 'https')

# ── Database — connection pooling ─────────────────────────────────────────────
DATABASES['default']['CONN_MAX_AGE'] = int(os.environ.get('DB_CONN_MAX_AGE', 60))
DATABASES['default']['OPTIONS']      = {'connect_timeout': 10}

# ── WhiteNoise — efficient static file serving (no nginx needed for statics) ──
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # must be after SecurityMiddleware
] + [m for m in MIDDLEWARE if m != 'django.middleware.security.SecurityMiddleware']  # type: ignore

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ── Disable silk profiler in production ───────────────────────────────────────
SILKY_INTERCEPT_PERCENT = 0
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != 'silk']  # type: ignore
MIDDLEWARE     = [m for m in MIDDLEWARE if m != 'silk.middleware.SilkyMiddleware']

# ── CORS — production domain configuration ────────────────────────────────────
# CORS_ALLOWED_ORIGINS must be explicitly set from environment variables.
# NEVER use '*' (wildcard) in production — it allows requests from any origin
# and disables credentials validation.
# Example: CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
if not CORS_ALLOWED_ORIGINS or CORS_ALLOWED_ORIGINS == ['']:
    raise ValueError(
        'CORS_ALLOWED_ORIGINS environment variable must be set in production. '
        'Example: CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com'
    )

# ── Sentry — error tracking ───────────────────────────────────────────────────
SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis  import RedisIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(transaction_style='url'),
            CeleryIntegration(monitor_beat_tasks=True),
            RedisIntegration(),
            LoggingIntegration(level=None, event_level='ERROR'),
        ],
        traces_sample_rate = float(os.environ.get('SENTRY_TRACES_RATE', '0.1')),
        profiles_sample_rate= float(os.environ.get('SENTRY_PROFILES_RATE', '0.05')),
        environment        = 'production',
        send_default_pii   = False,
    )

# ── Structured JSON logging for log aggregators (CloudWatch, Datadog, etc.) ───
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'pii_redaction': {
            '()': 'apps.core.log_filters.PiiRedactionFilter',
        },
    },
    'formatters': {
        'json': {
            '()': 'structlog.stdlib.ProcessorFormatter',
            'processor': 'structlog.dev.ConsoleRenderer' if DEBUG else 'structlog.processors.JSONRenderer',
        },
    },
    'handlers': {
        'console': {
            'class':     'logging.StreamHandler',
            'formatter': 'json',
            'filters':   ['pii_redaction'],
        },
    },
    'root': {
        'handlers': ['console'],
        'level':    'INFO',
    },
    'loggers': {
        'django':               {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'django.request':       {'handlers': ['console'], 'level': 'ERROR',   'propagate': False},
        'apps':                 {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
        'celery':               {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
    },
}
