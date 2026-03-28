"""
Celery configuration for SYNAPSE.

Configures Celery for asynchronous task execution with:
- Redis broker (from CELERY_BROKER_URL / REDIS_URL environment variable)
- Redis result backend
- Django-Celery-Beat for scheduled tasks
- JSON serialization
- UTC timezone
- Task routing to specific queues

NOTE: All core Celery settings (broker, backend, serialization, task_routes, etc.)
are defined in config/settings/base.py and loaded via config_from_object below.
This file only defines the Celery app, autodiscovers tasks, and sets the beat
schedule (which is harder to express purely in Django settings).
"""
import os
from celery import Celery
from celery.schedules import crontab

# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

# Create Celery app instance
app = Celery('synapse')

# Load ALL configuration from Django settings (namespace='CELERY' means Django
# settings prefixed with CELERY_ are mapped to Celery config keys).
# This is the single source of truth — do NOT call app.conf.update() after this
# to avoid overwriting the settings-defined values (broker URL, task_routes, etc.)
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all INSTALLED_APPS
app.autodiscover_tasks()

# Beat scheduler configuration (django-celery-beat)
# Defined here (not in settings) because crontab imports require Celery to be
# initialised first.  The CELERY_ prefix is NOT used here — beat_schedule is
# applied directly on the app after config is loaded.
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

# Apply only the beat schedule — all other config comes from Django settings
# via config_from_object above.  Applying a partial update here would
# overwrite settings-defined values (broker URL, task_routes, etc.) with
# stale/wrong defaults, causing tasks to stay in "pending".
app.conf.beat_schedule = CELERY_BEAT_SCHEDULE


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery configuration."""
    print(f'Request: {self.request!r}')
