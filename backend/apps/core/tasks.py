"""
Celery tasks for the SYNAPSE scraper.

Defines long-running scraping tasks that are executed asynchronously
using Celery with a Redis broker.
"""
import logging
import os
import subprocess
from pathlib import Path
from typing import Dict, Optional

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

# Compute project root directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # /app/apps/core -> /app/apps -> /app

def _ensure_dedup_ttl() -> None:
    """Ensure all dedup Redis sets have a 24-hour TTL so they don't block scraping forever.
    Called before each scrape task to keep TTLs fresh."""
    try:
        import redis as redis_lib
        from django.conf import settings
        redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')
        # Dedup sets live in db 0
        r = redis_lib.from_url(redis_url.rsplit('/', 1)[0] + '/0', decode_responses=True)
        for key in ['synapse:seen_urls', 'synapse:seen_github_ids',
                    'synapse:seen_arxiv_ids', 'synapse:seen_youtube_ids']:
            if r.exists(key):
                ttl = r.ttl(key)
                if ttl == -1:  # no TTL set — fix it
                    r.expire(key, 24 * 60 * 60)
    except Exception:
        pass  # non-critical


def _scrapy_env(user_id: Optional[str] = None) -> dict:
    """Return env vars for scrapy subprocess — ensures PYTHONPATH includes
    the project root so 'scraper.settings' and 'scraper.pipelines.*' are importable.
    Also loads any variables from the project-root .env file that aren't already
    in the environment (e.g. YOUTUBE_API_KEY, GITHUB_TOKEN).
    If user_id is provided, the user's stored API keys override the .env values."""
    env = os.environ.copy()

    # Load .env file variables that are missing from the current environment
    env_file = BASE_DIR / '.env'
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, _, val = line.partition('=')
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in env:  # don't override existing env vars
                    env[key] = val

    # Inject per-user API keys from their stored preferences (override .env)
    if user_id:
        try:
            import django  # noqa: PLC0415
            from apps.users.models import User  # noqa: PLC0415
            user = User.objects.filter(pk=user_id).first()
            if user:
                prefs = getattr(user, 'preferences', {}) or {}
                if prefs.get('x_api_key'):
                    env['X_API_KEY'] = prefs['x_api_key']
                    env['TWITTER_BEARER_TOKEN'] = prefs['x_api_key']
                if prefs.get('github_token'):
                    env['GITHUB_TOKEN'] = prefs['github_token']
        except Exception as e:
            logger.warning(f"Could not load user API keys for user {user_id}: {e}")

    project_root = str(BASE_DIR)
    backend_dir = str(BASE_DIR / 'backend')
    current_path = env.get('PYTHONPATH', '')
    parts = [p for p in current_path.split(':') if p]
    for d in [project_root, backend_dir]:
        if d not in parts:
            parts.insert(0, d)
    env['PYTHONPATH'] = ':'.join(parts)
    return env


@shared_task(bind=True, max_retries=3)
def scrape_hackernews(self, story_type: str = 'top', limit: int = 100) -> Dict:
    _ensure_dedup_ttl()
    """
    Scrape HackerNews stories using the HackerNews spider.
    
    Args:
        self: Celery task instance (for retry mechanism)
        story_type: Type of stories ('top', 'new', 'best') - default: 'top'
        limit: Maximum number of stories to scrape - default: 100
        
    Returns:
        Dictionary with keys: {'spider': 'hackernews', 'status': 'success'/'failed', 'returncode': int}
    """
    task_id = self.request.id
    logger.info(f"[{task_id}] Starting HackerNews scraper: story_type={story_type}, limit={limit}")
    
    try:
        spider_name = 'hackernews'
        cmd = [
            'scrapy', 'crawl', spider_name,
            '-a', f'story_type={story_type}',
            '-a', f'limit={limit}',
        ]
        
        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR / 'scraper'),
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            env=_scrapy_env(),
        )
        
        if result.returncode == 0:
            logger.info(f"[{task_id}] HackerNews scraper completed successfully")
            _update_source_last_scraped('news')
            return {
                'spider': 'hackernews',
                'status': 'success',
                'returncode': result.returncode,
            }
        else:
            logger.error(
                f"[{task_id}] HackerNews scraper failed with return code {result.returncode}\n"
                f"stderr: {result.stderr}"
            )
            raise Exception(f"HackerNews spider failed: {result.stderr}")
    
    except subprocess.TimeoutExpired as exc:
        logger.error(f"[{task_id}] HackerNews scraper timed out after 300s")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
    
    except Exception as exc:
        logger.error(f"[{task_id}] HackerNews scraper exception: {exc}")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(bind=True, max_retries=3)
def scrape_github(self, days_back: int = 1, language: Optional[str] = None, limit: int = 100, user_id: Optional[str] = None) -> Dict:
    _ensure_dedup_ttl()
    """
    Scrape GitHub repositories using the GitHub spider.
    
    Args:
        self: Celery task instance (for retry mechanism)
        days_back: Number of days to look back - default: 1
        language: Programming language filter (optional)
        limit: Maximum number of repositories to scrape - default: 100
        
    Returns:
        Dictionary with keys: {'spider': 'github', 'status': 'success'/'failed', 'returncode': int}
    """
    task_id = self.request.id
    logger.info(
        f"[{task_id}] Starting GitHub scraper: days_back={days_back}, "
        f"language={language}, limit={limit}"
    )
    
    try:
        spider_name = 'github'
        cmd = [
            'scrapy', 'crawl', spider_name,
            '-a', f'days_back={days_back}',
            '-a', f'limit={limit}',
        ]
        
        if language:
            cmd.extend(['-a', f'language={language}'])
        
        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR / 'scraper'),
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            env=_scrapy_env(user_id=user_id),
        )
        
        if result.returncode == 0:
            logger.info(f"[{task_id}] GitHub scraper completed successfully")
            _update_source_last_scraped('github')
            return {
                'spider': 'github',
                'status': 'success',
                'returncode': result.returncode,
            }
        else:
            logger.error(
                f"[{task_id}] GitHub scraper failed with return code {result.returncode}\n"
                f"stderr: {result.stderr}"
            )
            raise Exception(f"GitHub spider failed: {result.stderr}")
    
    except subprocess.TimeoutExpired as exc:
        logger.error(f"[{task_id}] GitHub scraper timed out after 300s")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
    
    except Exception as exc:
        logger.error(f"[{task_id}] GitHub scraper exception: {exc}")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(bind=True, max_retries=3)
def scrape_arxiv(self, categories: Optional[list] = None, days_back: int = 7, max_papers: int = 500) -> Dict:
    _ensure_dedup_ttl()
    """
    Scrape arXiv papers using the arXiv spider.
    
    Args:
        self: Celery task instance (for retry mechanism)
        categories: List of arXiv categories to scrape (optional)
        days_back: Number of days to look back - default: 7
        max_papers: Maximum number of papers to scrape - default: 500
        
    Returns:
        Dictionary with keys: {'spider': 'arxiv', 'status': 'success'/'failed', 'returncode': int}
    """
    task_id = self.request.id
    logger.info(
        f"[{task_id}] Starting arXiv scraper: categories={categories}, "
        f"days_back={days_back}, max_papers={max_papers}"
    )
    
    try:
        spider_name = 'arxiv'
        cmd = [
            'scrapy', 'crawl', spider_name,
            '-a', f'days_back={days_back}',
            '-a', f'max_papers={max_papers}',
        ]
        
        if categories:
            categories_str = ','.join(categories)
            cmd.extend(['-a', f'categories={categories_str}'])
        
        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR / 'scraper'),
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout for arXiv
            env=_scrapy_env(),
        )
        
        if result.returncode == 0:
            logger.info(f"[{task_id}] arXiv scraper completed successfully")
            _update_source_last_scraped('arxiv')
            return {
                'spider': 'arxiv',
                'status': 'success',
                'returncode': result.returncode,
            }
        else:
            logger.error(
                f"[{task_id}] arXiv scraper failed with return code {result.returncode}\n"
                f"stderr: {result.stderr}"
            )
            raise Exception(f"arXiv spider failed: {result.stderr}")
    
    except subprocess.TimeoutExpired as exc:
        logger.error(f"[{task_id}] arXiv scraper timed out after 600s")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
    
    except Exception as exc:
        logger.error(f"[{task_id}] arXiv scraper exception: {exc}")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(bind=True, max_retries=3)
def scrape_youtube(self, days_back: int = 30, max_results: int = 20, queries: list = None) -> Dict:
    _ensure_dedup_ttl()
    """
    Scrape YouTube videos using the YouTube spider.
    
    Args:
        self: Celery task instance (for retry mechanism)
        days_back: Number of days to look back - default: 30
        max_results: Maximum number of videos to scrape - default: 20
        
    Returns:
        Dictionary with keys: {'spider': 'youtube', 'status': 'success'/'failed', 'returncode': int}
    """
    task_id = self.request.id
    logger.info(
        f"[{task_id}] Starting YouTube scraper: days_back={days_back}, max_results={max_results}"
    )
    
    try:
        spider_name = 'youtube'
        cmd = [
            'scrapy', 'crawl', spider_name,
            '-a', f'days_back={days_back}',
            '-a', f'max_results={max_results}',
        ]
        # Pass custom queries if provided
        if queries:
            import json
            cmd += ['-a', f'queries={json.dumps(queries)}']
        
        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR / 'scraper'),
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout (8 queries × ~15s each = ~120s, with margin)
            env=_scrapy_env(),
        )
        
        if result.returncode == 0:
            logger.info(f"[{task_id}] YouTube scraper completed successfully")
            _update_source_last_scraped('youtube')
            return {
                'spider': 'youtube',
                'status': 'success',
                'returncode': result.returncode,
            }
        else:
            logger.error(
                f"[{task_id}] YouTube scraper failed with return code {result.returncode}\n"
                f"stderr: {result.stderr}"
            )
            raise Exception(f"YouTube spider failed: {result.stderr}")
    
    except subprocess.TimeoutExpired as exc:
        logger.error(f"[{task_id}] YouTube scraper timed out after 300s")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
    
    except Exception as exc:
        logger.error(f"[{task_id}] YouTube scraper exception: {exc}")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(bind=True, max_retries=3)
def scrape_twitter(self, query: Optional[str] = None, max_results: int = 100, user_id: Optional[str] = None, use_nitter: bool = True) -> Dict:
    _ensure_dedup_ttl()
    """
    Scrape tweets using the X/Twitter spider.

    Args:
        self: Celery task instance (for retry mechanism)
        query: Search query (optional, uses default tech queries if not provided)
        max_results: Maximum number of tweets to scrape - default: 100

    Returns:
        Dictionary with keys: {'spider': 'twitter', 'status': 'success'/'failed', 'returncode': int}
    """
    task_id = self.request.id
    logger.info(f"[{task_id}] Starting X/Twitter scraper: query={query}, max_results={max_results}, use_nitter={use_nitter}")

    try:
        # Determine spider: use Nitter (no API key needed) or X API v2
        env = _scrapy_env(user_id=user_id)
        has_x_api_key = bool(env.get('X_API_KEY') or env.get('TWITTER_BEARER_TOKEN'))

        # Prefer nitter unless: user explicitly wants X API AND has a key
        spider_name = 'twitter' if (has_x_api_key and not use_nitter) else 'nitter'
        logger.info(f"[{task_id}] Using spider: {spider_name} (has_x_key={has_x_api_key})")

        cmd = [
            'scrapy', 'crawl', spider_name,
            '-a', f'max_results={max_results}',
        ]
        if query:
            cmd.extend(['-a', f'query={query}'])

        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR / 'scraper'),
            capture_output=True,
            text=True,
            timeout=300,
            env=env,
        )

        if result.returncode == 0:
            logger.info(f"[{task_id}] X/Twitter scraper completed successfully")
            _update_source_last_scraped('twitter')
            # Queue embedding generation for newly scraped tweets
            try:
                from apps.tweets.embedding_tasks import generate_pending_tweet_embeddings  # noqa: PLC0415
                generate_pending_tweet_embeddings.delay()
            except Exception as emb_exc:
                logger.warning(f"[{task_id}] Could not queue tweet embeddings: {emb_exc}")
            return {
                'spider': 'twitter',
                'status': 'success',
                'returncode': result.returncode,
            }
        else:
            logger.error(
                f"[{task_id}] X/Twitter scraper failed with return code {result.returncode}\n"
                f"stderr: {result.stderr}"
            )
            raise Exception(f"X/Twitter spider failed: {result.stderr}")

    except subprocess.TimeoutExpired as exc:
        logger.error(f"[{task_id}] X/Twitter scraper timed out after 300s")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

    except Exception as exc:
        logger.error(f"[{task_id}] X/Twitter scraper exception: {exc}")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(bind=True, max_retries=1)
def scrape_all(self) -> Dict:
    """
    Chain all four scrapers in sequence.
    
    Runs all scrapers in order: HackerNews, GitHub, arXiv, YouTube.
    Logs the overall execution and returns aggregated results.
    
    Args:
        self: Celery task instance (for retry mechanism)
        
    Returns:
        Dictionary with aggregated results from all spiders
    """
    task_id = self.request.id
    logger.info(f"[{task_id}] Starting all scrapers in sequence")
    
    try:
        results = {
            'hackernews': scrape_hackernews.delay(),
            'github': scrape_github.delay(),
            'arxiv': scrape_arxiv.delay(),
            'youtube': scrape_youtube.delay(),
            'twitter': scrape_twitter.delay(),
        }

        logger.info(
            f"[{task_id}] Queued all scrapers. "
            f"Task IDs: hackernews={results['hackernews'].id}, "
            f"github={results['github'].id}, arxiv={results['arxiv'].id}, "
            f"youtube={results['youtube'].id}, twitter={results['twitter'].id}"
        )

        return {
            'status': 'success',
            'message': 'All scrapers queued',
            'task_ids': {k: v.id for k, v in results.items()},
        }
    
    except Exception as exc:
        logger.error(f"[{task_id}] Error queuing all scrapers: {exc}")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(bind=True, max_retries=2)
def generate_daily_briefings(self) -> Dict:
    """
    TASK-305-B2: Generate a personalised AI briefing for every active user.
    Scheduled at 06:30 UTC daily via Celery beat.

    For each active user:
      1. Fetch trending content from the last 24 h that matches their interest topics.
      2. Call the AI engine to write a 3-paragraph briefing with source attribution.
      3. Upsert a DailyBriefing row (unique per user/date).
    """
    import json as _json
    from datetime import timedelta

    from django.utils import timezone as tz
    from apps.core.models import DailyBriefing
    from apps.users.models import User
    from apps.articles.models import Article
    from apps.papers.models import ResearchPaper
    from apps.repositories.models import Repository

    cutoff   = tz.now() - timedelta(hours=24)
    today    = tz.localdate()
    users    = User.objects.filter(is_active=True).only('id', 'email', 'first_name')
    created  = 0
    skipped  = 0

    for user in users:
        # Skip if briefing already exists for today
        if DailyBriefing.objects.filter(user=user, date=today).exists():
            skipped += 1
            continue

        try:
            # ── gather recent content ────────────────────────────────────
            articles = list(
                Article.objects.filter(scraped_at__gte=cutoff)
                .order_by('-scraped_at')
                .values('title', 'url', 'summary')[:10]
            )
            papers = list(
                ResearchPaper.objects.filter(fetched_at__gte=cutoff)
                .order_by('-fetched_at')
                .values('title', 'url', 'abstract')[:5]
            )
            repos = list(
                Repository.objects.filter(scraped_at__gte=cutoff)
                .order_by('-scraped_at')
                .values('full_name', 'url', 'description')[:5]
            )

            sources: list = []
            content_lines: list = []

            for a in articles:
                sources.append({'title': a['title'], 'url': a['url'], 'type': 'article'})
                if a.get('summary'):
                    content_lines.append(f"- {a['title']}: {a['summary'][:200]}")

            for p in papers:
                sources.append({'title': p['title'], 'url': p['url'], 'type': 'paper'})
                if p.get('abstract'):
                    content_lines.append(f"- {p['title']}: {p['abstract'][:200]}")

            for r in repos:
                sources.append({'title': r['full_name'], 'url': r['url'], 'type': 'repository'})
                if r.get('description'):
                    content_lines.append(f"- {r['full_name']}: {r['description'][:150]}")

            if not sources:
                # Nothing scraped yet — produce a placeholder
                content = (
                    f"Good morning{', ' + user.first_name if user.first_name else ''}! "
                    "Your personalised briefing will appear here once content has been scraped. "
                    "Check back tomorrow for the latest AI, development, and research highlights."
                )
                topic_summary: dict = {'topics': [], 'sentiment': 'neutral'}
            else:
                # ── try AI generation, fall back to template ────────────
                try:
                    import openai  # noqa: PLC0415
                    from django.conf import settings as django_settings  # noqa: PLC0415

                    client = openai.OpenAI(api_key=django_settings.OPENAI_API_KEY)
                    digest_text = "\n".join(content_lines[:20])
                    name_greeting = f", {user.first_name}" if user.first_name else ""

                    prompt = (
                        f"You are a tech journalist writing a concise daily briefing for a developer{name_greeting}. "
                        f"Based on the following recent items, write exactly 3 short paragraphs (no headers). "
                        f"Each paragraph should cover a different theme. "
                        f"End with inline citations like [1] referencing the source list.\n\n"
                        f"Recent content:\n{digest_text}\n\n"
                        f"Write the briefing now:"
                    )

                    resp = client.chat.completions.create(
                        model="gpt-3.5-turbo",
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=500,
                        temperature=0.7,
                    )
                    content = resp.choices[0].message.content.strip()
                    # derive topics from source titles
                    all_titles = " ".join(s['title'] for s in sources[:10]).lower()
                    topics = []
                    for kw in ['ai', 'machine learning', 'python', 'rust', 'kubernetes', 'llm',
                               'security', 'web', 'cloud', 'devops', 'research']:
                        if kw in all_titles:
                            topics.append(kw)
                    topic_summary = {'topics': topics[:5], 'sentiment': 'positive'}

                except Exception as ai_exc:
                    logger.warning("AI briefing generation failed for user %s: %s", user.id, ai_exc)
                    # Fallback template briefing
                    name_greeting = f", {user.first_name}" if user.first_name else ""
                    top = sources[:3]
                    bullets = "\n".join(
                        f"  [{i+1}] {s['title']}" for i, s in enumerate(top)
                    )
                    content = (
                        f"Good morning{name_greeting}! Here is your daily briefing.\n\n"
                        f"In the past 24 hours, {len(articles)} new articles, "
                        f"{len(papers)} research papers, and {len(repos)} repositories "
                        f"were added to your feed. Top highlights:\n{bullets}\n\n"
                        f"Open the feed to explore all {len(sources)} new items and stay ahead of the curve."
                    )
                    topic_summary = {'topics': [], 'sentiment': 'neutral'}

            DailyBriefing.objects.update_or_create(
                user=user,
                date=today,
                defaults={
                    'content': content,
                    'sources': sources[:20],
                    'topic_summary': topic_summary,
                },
            )
            created += 1

        except Exception as exc:
            logger.error("Failed to generate briefing for user %s: %s", user.id, exc, exc_info=True)

    logger.info("Daily briefings: created=%d skipped=%d", created, skipped)
    return {'created': created, 'skipped': skipped}


@shared_task(bind=True, max_retries=1)
def backup_database(self) -> Dict:
    """
    TASK-502-B1: Daily pg_dump backup → gzip → upload to S3.

    Schedule: 02:00 UTC daily via Celery beat.
    Retention: 30 days — older backups are deleted automatically.

    Required env vars:
        DATABASE_URL            — PostgreSQL connection string
        BACKUP_S3_BUCKET        — S3 bucket name (e.g. synapse-backups)
        AWS_ACCESS_KEY_ID       — AWS credentials
        AWS_SECRET_ACCESS_KEY   — AWS credentials
        AWS_DEFAULT_REGION      — (optional, default us-east-1)
        BACKUP_ADMIN_EMAIL      — email to alert on failure
    """
    import gzip
    import os
    import shutil
    import subprocess
    import tempfile
    from datetime import timedelta
    from urllib.parse import urlparse
    from django.conf import settings as django_settings
    from django.core.mail import send_mail

    db_url       = os.environ.get('DATABASE_URL', '')
    bucket       = os.environ.get('BACKUP_S3_BUCKET', '')
    admin_email  = os.environ.get('BACKUP_ADMIN_EMAIL', '')
    slack_url    = os.environ.get('BACKUP_SLACK_WEBHOOK', '')

    today_str = timezone.now().strftime('%Y/%m/%d')
    filename  = f"postgres/{today_str}.sql.gz"

    if not db_url or not bucket:
        logger.warning("TASK-502: DATABASE_URL or BACKUP_S3_BUCKET not set — skipping backup")
        return {'status': 'skipped', 'reason': 'missing env vars'}

    try:
        import boto3  # noqa: PLC0415
    except ImportError:
        logger.error("TASK-502: boto3 not installed — cannot upload backup")
        return {'status': 'error', 'reason': 'boto3 not installed'}

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            dump_path = os.path.join(tmpdir, 'backup.sql')
            gz_path   = os.path.join(tmpdir, 'backup.sql.gz')

            # ── 1. pg_dump ─────────────────────────────────────────────────
            logger.info("TASK-502: Running pg_dump…")
            result = subprocess.run(
                ['pg_dump', '--no-owner', '--no-acl', db_url],
                stdout=open(dump_path, 'w'),
                stderr=subprocess.PIPE,
                timeout=600,
            )
            if result.returncode != 0:
                raise RuntimeError(f"pg_dump failed: {result.stderr.decode()[:500]}")

            # ── 2. gzip ────────────────────────────────────────────────────
            with open(dump_path, 'rb') as f_in, gzip.open(gz_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
            gz_size_mb = os.path.getsize(gz_path) / (1024 * 1024)
            logger.info("TASK-502: Compressed backup %.1f MB", gz_size_mb)

            # ── 3. Upload to S3 ────────────────────────────────────────────
            s3 = boto3.client(
                's3',
                region_name=os.environ.get('AWS_DEFAULT_REGION', 'us-east-1'),
            )
            with open(gz_path, 'rb') as f:
                s3.put_object(
                    Bucket=bucket,
                    Key=filename,
                    Body=f,
                    ContentType='application/gzip',
                    ServerSideEncryption='AES256',
                    StorageClass='STANDARD_IA',
                )
            logger.info("TASK-502: Uploaded s3://%s/%s", bucket, filename)

            # ── 4. Retention — delete backups older than 30 days ───────────
            cutoff = timezone.now() - timedelta(days=30)
            paginator = s3.get_paginator('list_objects_v2')
            deleted   = 0
            for page in paginator.paginate(Bucket=bucket, Prefix='postgres/'):
                for obj in page.get('Contents', []):
                    if obj['LastModified'].replace(tzinfo=None) < cutoff.replace(tzinfo=None):
                        s3.delete_object(Bucket=bucket, Key=obj['Key'])
                        deleted += 1
            if deleted:
                logger.info("TASK-502: Cleaned up %d old backups (>30 days)", deleted)

        return {
            'status':      'success',
            'bucket':      bucket,
            'key':         filename,
            'size_mb':     round(gz_size_mb, 2),
            'deleted_old': deleted,
        }

    except Exception as exc:
        logger.error("TASK-502: Backup FAILED — %s", exc, exc_info=True)

        # ── TASK-502-B2: Failure alerting ──────────────────────────────────
        err_msg = str(exc)[:1000]
        subject = f"[SYNAPSE] Database backup FAILED — {timezone.now().strftime('%Y-%m-%d')}"
        body    = (
            f"The automated database backup failed at {timezone.now().isoformat()}.\n\n"
            f"Error:\n{err_msg}\n\n"
            "Please investigate immediately and trigger a manual backup:\n"
            "  celery -A config call apps.core.tasks.backup_database\n\n"
            "Restore procedure: see DEPLOYMENT.md § Backup & Restore"
        )

        # Email admin
        if admin_email:
            try:
                send_mail(
                    subject=subject,
                    message=body,
                    from_email=getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@synapse.app'),
                    recipient_list=[admin_email],
                    fail_silently=True,
                )
            except Exception as mail_exc:
                logger.error("TASK-502: Failed to send backup failure email: %s", mail_exc)

        # Slack webhook
        if slack_url:
            try:
                import urllib.request, json as _json  # noqa: PLC0415,E401
                payload = _json.dumps({
                    'text': f":rotating_light: *Database backup FAILED* ({timezone.now().strftime('%Y-%m-%d')})\n```{err_msg[:500]}```"
                }).encode()
                req = urllib.request.Request(
                    slack_url, data=payload,
                    headers={'Content-Type': 'application/json'},
                )
                urllib.request.urlopen(req, timeout=5)
            except Exception as slack_exc:
                logger.error("TASK-502: Slack alert failed: %s", slack_exc)

        raise self.retry(exc=exc, countdown=300)  # retry once after 5 min


def _update_source_last_scraped(source_type: str) -> None:
    """
    Update the last_scraped_at timestamp for sources of a given type.

    Args:
        source_type: Type of source ('news', 'github', 'arxiv', 'youtube', 'twitter')
    """
    try:
        from apps.articles.models import Source
        
        sources = Source.objects.filter(source_type=source_type, is_active=True)
        updated_count = sources.update(last_scraped_at=timezone.now())
        
        logger.debug(f"Updated last_scraped_at for {updated_count} {source_type} sources")
    except Exception as exc:
        logger.warning(f"Failed to update Source.last_scraped_at for {source_type}: {exc}")
