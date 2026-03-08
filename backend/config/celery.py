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
CELERY_TASK_ROUTES = {
    'backend.apps.core.tasks.scrape_hackernews': {'queue': 'scraping'},
    'backend.apps.core.tasks.scrape_github': {'queue': 'scraping'},
    'backend.apps.core.tasks.scrape_arxiv': {'queue': 'scraping'},
    'backend.apps.core.tasks.scrape_youtube': {'queue': 'scraping'},
    'backend.apps.core.tasks.scrape_all': {'queue': 'scraping'},
    # NLP processing tasks — Phase 2.1
    'apps.articles.tasks.process_article_nlp': {'queue': 'nlp'},
    'apps.articles.tasks.process_pending_articles_nlp': {'queue': 'nlp'},
}

# Default queue for non-routed tasks
CELERY_DEFAULT_QUEUE = 'default'

# Beat scheduler configuration (django-celery-beat)
CELERY_BEAT_SCHEDULE = {
    'scrape-hackernews-every-30min': {
        'task': 'backend.apps.core.tasks.scrape_hackernews',
        'schedule': 30 * 60,  # 30 minutes in seconds
        'args': ('top', 100),  # story_type='top', limit=100
        'options': {'queue': 'scraping'},
    },
    'scrape-github-every-2hrs': {
        'task': 'backend.apps.core.tasks.scrape_github',
        'schedule': 2 * 60 * 60,  # 2 hours in seconds
        'args': (1, None, 100),  # days_back=1, language=None, limit=100
        'options': {'queue': 'scraping'},
    },
    'scrape-arxiv-every-6hrs': {
        'task': 'backend.apps.core.tasks.scrape_arxiv',
        'schedule': 6 * 60 * 60,  # 6 hours in seconds
        'args': (None, 7, 500),  # categories=None, days_back=7, max_papers=500
        'options': {'queue': 'scraping'},
    },
    'scrape-youtube-every-12hrs': {
        'task': 'backend.apps.core.tasks.scrape_youtube',
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
