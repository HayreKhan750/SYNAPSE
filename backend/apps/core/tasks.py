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
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

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


def _scrapy_env() -> dict:
    """Return env vars for scrapy subprocess — ensures PYTHONPATH includes
    the project root so 'scraper.settings' and 'scraper.pipelines.*' are importable.
    Also loads any variables from the project-root .env file that aren't already
    in the environment (e.g. YOUTUBE_API_KEY, GITHUB_TOKEN)."""
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
def scrape_github(self, days_back: int = 1, language: Optional[str] = None, limit: int = 100) -> Dict:
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
            env=_scrapy_env(),
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
            timeout=300,  # 5 minute timeout
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
        }
        
        logger.info(
            f"[{task_id}] Queued all scrapers. "
            f"Task IDs: hackernews={results['hackernews'].id}, "
            f"github={results['github'].id}, arxiv={results['arxiv'].id}, "
            f"youtube={results['youtube'].id}"
        )
        
        return {
            'status': 'success',
            'message': 'All scrapers queued',
            'task_ids': {k: v.id for k, v in results.items()},
        }
    
    except Exception as exc:
        logger.error(f"[{task_id}] Error queuing all scrapers: {exc}")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


def _update_source_last_scraped(source_type: str) -> None:
    """
    Update the last_scraped_at timestamp for sources of a given type.
    
    Args:
        source_type: Type of source ('news', 'github', 'arxiv', 'youtube')
    """
    try:
        from apps.articles.models import Source
        
        sources = Source.objects.filter(source_type=source_type, is_active=True)
        updated_count = sources.update(last_scraped_at=timezone.now())
        
        logger.debug(f"Updated last_scraped_at for {updated_count} {source_type} sources")
    except Exception as exc:
        logger.warning(f"Failed to update Source.last_scraped_at for {source_type}: {exc}")
