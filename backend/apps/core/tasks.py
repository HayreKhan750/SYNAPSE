"""
Celery tasks for the SYNAPSE scraper.

Defines long-running scraping tasks that are executed asynchronously
using Celery with a Redis broker.
"""
import logging
import subprocess
from pathlib import Path
from typing import Dict, Optional

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

# Compute project root directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent


@shared_task(bind=True, max_retries=3)
def scrape_hackernews(self, story_type: str = 'top', limit: int = 100) -> Dict:
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
            timeout=300  # 5 minute timeout
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
            timeout=300  # 5 minute timeout
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
            timeout=600  # 10 minute timeout for arXiv
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
def scrape_youtube(self, days_back: int = 30, max_results: int = 20) -> Dict:
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
        
        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR / 'scraper'),
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
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
