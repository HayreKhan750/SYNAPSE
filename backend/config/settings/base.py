"""
SYNAPSE Django Base Settings
"""
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load .env from the project root (one level above the backend/ directory)
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent.parent.parent / ".env")

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-change-in-production')
DEBUG = os.environ.get('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# ── Applications ─────────────────────────────────────────────
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'axes',
    'django_celery_beat',
    'django_celery_results',
    # 'django_prometheus',  # Re-enable after upgrading: pip install django-prometheus>=2.3
]

LOCAL_APPS = [
    'apps.core',
    'apps.users',
    'apps.articles',
    'apps.repositories',
    'apps.papers',
    'apps.videos',
    'apps.automation',
    'apps.agents',
    'apps.documents',
    'apps.trends',
    'apps.notifications',
    'apps.integrations',  # Phase 6 — Cloud Integration (Google Drive + AWS S3)
    'apps.billing',       # Phase 9.3 — Stripe billing, referrals, feedback
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ── Middleware ────────────────────────────────────────────────
MIDDLEWARE = [
    # 'django_prometheus.middleware.PrometheusBeforeMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'axes.middleware.AxesMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # 'django_prometheus.middleware.PrometheusAfterMiddleware',
    # Phase 9.1 — Security hardening
    'apps.core.security.SecurityHeadersMiddleware',
    'apps.core.security.ContentSecurityPolicyMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ── Database ─────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',  # works with psycopg2 or psycopg3
        'NAME': os.environ.get('DB_NAME', 'synapse_db'),
        'USER': os.environ.get('DB_USER', 'synapse_user'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'synapse_pass'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        'CONN_MAX_AGE': 600,   # Keep DB connections alive for 10 min (was 60s)
        'OPTIONS': {
            'connect_timeout': 10,
        },
    }
}

# ── Cache (Redis) ─────────────────────────────────────────────
# ── Django Channels ───────────────────────────────────────────
ASGI_APPLICATION = 'config.asgi.application'

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [os.environ.get("REDIS_URL", "redis://localhost:6379/0")],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
            'CONNECTION_POOL_KWARGS': {'max_connections': 100},
        },
        'KEY_PREFIX': 'synapse',
        'TIMEOUT': 3600,  # 1 hour default (was 300s — too aggressive for stable data)
    }
}

SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'

# ── Auth ──────────────────────────────────────────────────────
AUTH_USER_MODEL = 'users.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# ── Email (SendGrid) ─────────────────────────────────────────
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend'  # dev: prints to console
)
# For production with SendGrid SMTP:
#   EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
#   EMAIL_HOST    = 'smtp.sendgrid.net'
#   EMAIL_PORT    = 587
#   EMAIL_USE_TLS = True
#   EMAIL_HOST_USER = 'apikey'
#   EMAIL_HOST_PASSWORD = os.environ.get('SENDGRID_API_KEY')
EMAIL_HOST          = os.environ.get('EMAIL_HOST', 'smtp.sendgrid.net')
EMAIL_PORT          = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS       = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER', 'apikey')
EMAIL_HOST_PASSWORD = os.environ.get('SENDGRID_API_KEY', '')
DEFAULT_FROM_EMAIL  = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@synapse.ai')
SENDGRID_API_KEY    = os.environ.get('SENDGRID_API_KEY', '')

# ── REST Framework ────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',
        'user': '100/minute',
    },
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'EXCEPTION_HANDLER': 'apps.core.exceptions.custom_exception_handler',
}

# ── JWT ───────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.environ.get('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 15))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.environ.get('JWT_REFRESH_TOKEN_LIFETIME_DAYS', 7))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# ── CORS ──────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000'
).split(',')
CORS_ALLOW_CREDENTIALS = True

# ── Celery ────────────────────────────────────────────────────
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/1')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/2')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_ENABLE_UTC = True
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
# Track when a task transitions to STARTED (enables "processing" status in DB)
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60       # 30 min hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 min soft limit
CELERY_RESULT_EXPIRES = 3600           # results expire after 1 hour
CELERY_DEFAULT_QUEUE = 'default'
CELERY_TASK_ROUTES = {
    # ── Automation (MUST be first — highest priority) ─────────────────────────
    # execute_workflow MUST land on 'default' so the worker that handles the
    # ▶ Run button picks it up immediately.
    'apps.automation.tasks.execute_workflow':    {'queue': 'default'},
    'apps.automation.tasks.cleanup_stale_runs':  {'queue': 'default'},
    'apps.automation.tasks.dispatch_event_trigger': {'queue': 'default'},

    # ── NLP processing (Phase 2.1) ────────────────────────────────────────────
    # These MUST be listed before the 'apps.articles.tasks.*' scraping wildcard
    # below — Celery evaluates routes in definition order and the first match wins.
    'apps.articles.tasks.process_article_nlp':        {'queue': 'nlp'},
    'apps.articles.tasks.process_pending_articles_nlp': {'queue': 'nlp'},

    # ── Summarization (Phase 2.2) ─────────────────────────────────────────────
    'apps.articles.tasks.summarize_article':          {'queue': 'nlp'},
    'apps.articles.tasks.summarize_pending_articles': {'queue': 'nlp'},

    # ── Excerpt fetching (default queue — lightweight HTTP tasks) ─────────────
    'apps.articles.tasks.fetch_article_excerpt':   {'queue': 'default'},
    'apps.articles.tasks.fetch_pending_excerpts':  {'queue': 'default'},

    # ── Core scraping tasks ───────────────────────────────────────────────────
    'apps.core.tasks.scrape_hackernews': {'queue': 'scraping'},
    'apps.core.tasks.scrape_github':     {'queue': 'scraping'},
    'apps.core.tasks.scrape_arxiv':      {'queue': 'slow_scraping'},  # long-running — isolated
    'apps.core.tasks.scrape_youtube':    {'queue': 'slow_scraping'},  # long-running — isolated
    'apps.core.tasks.scrape_all':        {'queue': 'scraping'},
    # Legacy prefixed names (older beat entries)
    'backend.apps.core.tasks.scrape_hackernews': {'queue': 'scraping'},
    'backend.apps.core.tasks.scrape_github':     {'queue': 'scraping'},
    'backend.apps.core.tasks.scrape_arxiv':      {'queue': 'slow_scraping'},
    'backend.apps.core.tasks.scrape_youtube':    {'queue': 'slow_scraping'},
    'backend.apps.core.tasks.scrape_all':        {'queue': 'scraping'},

    # ── Vector Embeddings (Phase 2.3) ─────────────────────────────────────────
    'apps.articles.embedding_tasks.*':     {'queue': 'embeddings'},
    'apps.papers.embedding_tasks.*':       {'queue': 'embeddings'},
    'apps.repositories.embedding_tasks.*': {'queue': 'embeddings'},
    'apps.videos.embedding_tasks.*':       {'queue': 'embeddings'},

    # ── Agent tasks (Phase 5.1) ───────────────────────────────────────────────
    'apps.agents.tasks.*': {'queue': 'agents'},

    # ── Trend analysis ────────────────────────────────────────────────────────
    'apps.trends.tasks.analyze_trends_task': {'queue': 'default'},

    # ── Notifications (Phase 4.2) ─────────────────────────────────────────────
    'apps.notifications.tasks.*': {'queue': 'default'},

    # ── Catch-all wildcards (MUST be last — lowest priority) ──────────────────
    # Any article/paper/repo/video task not matched above goes to scraping.
    'apps.articles.tasks.*':      {'queue': 'scraping'},
    'apps.papers.tasks.*':        {'queue': 'scraping'},
    'apps.repositories.tasks.*':  {'queue': 'scraping'},
    'apps.videos.tasks.*':        {'queue': 'scraping'},
}

# ── Axes (Login Rate Limiting) ────────────────────────────────
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = 1  # hours
AXES_RESET_ON_SUCCESS = True
AXES_LOCKOUT_TEMPLATE = None
AXES_ENABLED = True

# ── Internationalization ──────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ── Static & Media ────────────────────────────────────────────
# ── Google Drive OAuth2 (Phase 6.1) ─────────────────────────────────────────
GOOGLE_CLIENT_ID      = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET  = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI   = os.environ.get(
    'GOOGLE_REDIRECT_URI',
    'http://localhost:8000/api/v1/integrations/drive/callback/',
)

# ── AWS S3 (Phase 6.2) ───────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID       = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY   = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', 'synapse-media')
AWS_S3_REGION_NAME      = os.environ.get('AWS_S3_REGION_NAME', 'us-east-1')
AWS_S3_CUSTOM_DOMAIN    = os.environ.get('AWS_S3_CUSTOM_DOMAIN', '')
AWS_PRESIGNED_URL_EXPIRY = int(os.environ.get('AWS_PRESIGNED_URL_EXPIRY', 3600))

# Use S3 for media storage when bucket is configured
if AWS_STORAGE_BUCKET_NAME and AWS_STORAGE_BUCKET_NAME != 'synapse-media':
    DEFAULT_FILE_STORAGE  = 'storages.backends.s3boto3.S3Boto3Storage'
    STATICFILES_STORAGE   = 'storages.backends.s3boto3.S3StaticStorage'
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL       = None
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
# Allow overriding via env var when backend/media/ is not writable (e.g. dev)
_media_root_env = os.environ.get('DJANGO_MEDIA_ROOT', '')
MEDIA_ROOT = Path(_media_root_env) if _media_root_env else BASE_DIR / 'media'
# Sync MEDIA_ROOT back into the environment so that ai_engine/agents/doc_tools.py
# (which reads DJANGO_MEDIA_ROOT at import time) always uses the same directory
# as Django — preventing file-not-found errors on download.
os.environ.setdefault('DJANGO_MEDIA_ROOT', str(MEDIA_ROOT))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Logging ───────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'apps': {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
        'celery': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
    },
}
