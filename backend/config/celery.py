"""
Celery configuration for SYNAPSE.

Configures Celery for asynchronous task execution with:
- Redis broker (from REDIS_URL environment variable)
- Redis result backend
- Django-Celery-Beat for scheduled tasks
- JSON serialization
- UTC timezone
- Task routing to specific queues
"""
import os
from celery import Celery
from celery.schedules import crontab
from django.conf import settings

# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

# Create Celery app instance
app = Celery('synapse')

# Load configuration from Django settings with namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all installed apps
app.autodiscover_tasks()


# Celery configuration
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://localhost:6380/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://localhost:6380/0')

# Serialization
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# Timezone
CELERY_TIMEZONE = 'UTC'
CELERY_ENABLE_UTC = True

# Task configuration
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes soft limit

# Result backend configuration
CELERY_RESULT_EXPIRES = 3600  # Results expire after 1 hour

# Task routing - send scraping tasks to specific queue
# NOTE: task names must match the `name=` argument on the @shared_task decorator
# (or the dotted module path when no explicit name is given).
CELERY_TASK_ROUTES = {
    # Scraping — core tasks
    'apps.core.tasks.scrape_hackernews': {'queue': 'scraping'},
    'apps.core.tasks.scrape_github': {'queue': 'scraping'},
    'apps.core.tasks.scrape_arxiv': {'queue': 'scraping'},
    'apps.core.tasks.scrape_youtube': {'queue': 'scraping'},
    'apps.core.tasks.scrape_all': {'queue': 'scraping'},
    # Keep legacy prefixed names in case older beat entries exist
    'backend.apps.core.tasks.scrape_hackernews': {'queue': 'scraping'},
    'backend.apps.core.tasks.scrape_github': {'queue': 'scraping'},
    'backend.apps.core.tasks.scrape_arxiv': {'queue': 'scraping'},
    'backend.apps.core.tasks.scrape_youtube': {'queue': 'scraping'},
    'backend.apps.core.tasks.scrape_all': {'queue': 'scraping'},
    # NLP processing tasks — Phase 2.1
    'apps.articles.tasks.process_article_nlp': {'queue': 'nlp'},
    'apps.articles.tasks.process_pending_articles_nlp': {'queue': 'nlp'},
    # Trend analysis — Phase 2.4 / Phase 9
    'apps.trends.tasks.analyze_trends_task': {'queue': 'default'},
    # Agent tasks — Phase 5.1
    'apps.agents.tasks.execute_agent_task': {'queue': 'agents'},
    'apps.agents.tasks.cancel_agent_task': {'queue': 'agents'},
    # Summarization tasks — Phase 2.2
    'apps.articles.tasks.summarize_article': {'queue': 'nlp'},
    'apps.articles.tasks.summarize_pending_articles': {'queue': 'nlp'},
}

# Default queue for non-routed tasks
CELERY_DEFAULT_QUEUE = 'default'

# Beat scheduler configuration (django-celery-beat)
CELERY_BEAT_SCHEDULE = {
    'scrape-hackernews-every-30min': {
        'task': 'apps.core.tasks.scrape_hackernews',
        'schedule': 30 * 60,  # 30 minutes in seconds
        'args': ('top', 100),  # story_type='top', limit=100
        'options': {'queue': 'scraping'},
    },
    'scrape-github-every-2hrs': {
        'task': 'apps.core.tasks.scrape_github',
        'schedule': 2 * 60 * 60,  # 2 hours in seconds
        'args': (1, None, 100),  # days_back=1, language=None, limit=100
        'options': {'queue': 'scraping'},
    },
    'scrape-arxiv-every-6hrs': {
        'task': 'apps.core.tasks.scrape_arxiv',
        'schedule': 6 * 60 * 60,  # 6 hours in seconds
        'args': (None, 7, 500),  # categories=None, days_back=7, max_papers=500
        'options': {'queue': 'scraping'},
    },
    'scrape-youtube-every-12hrs': {
        'task': 'apps.core.tasks.scrape_youtube',
        'schedule': 12 * 60 * 60,  # 12 hours in seconds
        'args': (30, 20),  # days_back=30, max_results=20
        'options': {'queue': 'scraping'},
    },
    # NLP processing — Phase 2.1
    # Run every 10 minutes to pick up newly scraped articles
    'process-pending-nlp-every-10min': {
        'task': 'apps.articles.tasks.process_pending_articles_nlp',
        'schedule': 10 * 60,  # 10 minutes in seconds
        'args': (50,),         # batch_size=50
        'options': {'queue': 'nlp'},
    },
    # Summarization catch-up — Phase 2.2
    # Runs every 15 minutes to summarize articles that missed the pipeline
    # (e.g. imported before Phase 2.2, or whose summarization failed)
    'fetch-pending-excerpts-every-5min': {
        'task': 'apps.articles.tasks.fetch_pending_excerpts',
        'schedule': 5 * 60,  # every 5 minutes — fast HTTP fetches, not Gemini
        'options': {'queue': 'default'},  # separate from nlp so Gemini can't block it
    },
    'summarize-pending-articles-every-15min': {
        'task': 'apps.articles.tasks.summarize_pending_articles',
        'schedule': 15 * 60,  # 15 minutes in seconds
        'args': (20,),          # batch_size=20
        'options': {'queue': 'nlp'},
    },
    # Phase 4.1 — Workflow Engine
    # Periodic cleanup: mark stale 'running' workflow runs as failed (every hour)
    'cleanup-stale-workflow-runs-every-hour': {
        'task': 'apps.automation.tasks.cleanup_stale_runs',
        'schedule': 60 * 60,  # 1 hour
        'options': {'queue': 'default'},
    },
    # Phase 4.2 — Notifications: poll for unread count every 5 minutes via Celery
    # (Frontend uses polling via React Query — no WebSocket needed for MVP)

    # Phase 2.4 / 9 — Technology Trend Analysis
    # Runs daily at midnight UTC to populate TechnologyTrend records
    'analyze-trends-daily': {
        'task': 'apps.trends.tasks.analyze_trends_task',
        'schedule': crontab(hour=0, minute=5),  # 00:05 UTC daily
        'options': {'queue': 'default'},
    },
}

# Apply configuration to app
app.conf.update(
    broker_url=CELERY_BROKER_URL,
    result_backend=CELERY_RESULT_BACKEND,
    accept_content=CELERY_ACCEPT_CONTENT,
    task_serializer=CELERY_TASK_SERIALIZER,
    result_serializer=CELERY_RESULT_SERIALIZER,
    timezone=CELERY_TIMEZONE,
    enable_utc=CELERY_ENABLE_UTC,
    task_track_started=CELERY_TASK_TRACK_STARTED,
    task_time_limit=CELERY_TASK_TIME_LIMIT,
    task_soft_time_limit=CELERY_TASK_SOFT_TIME_LIMIT,
    result_expires=CELERY_RESULT_EXPIRES,
    task_routes=CELERY_TASK_ROUTES,
    beat_schedule=CELERY_BEAT_SCHEDULE,
)


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery configuration."""
    print(f'Request: {self.request!r}')
