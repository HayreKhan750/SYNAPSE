"""
Database Pipeline for SYNAPSE
Saves validated items to the Django PostgreSQL database.
Handles setup/teardown of Django ORM and provides robust error handling.

Uses twisted.internet.threads.deferToThread so Django ORM calls run in a
thread pool instead of the async Twisted reactor loop, avoiding the
"You cannot call this from an async context" error.
"""

import os
import sys
import logging
import hashlib
from datetime import datetime
from pathlib import Path

import django
from twisted.internet import threads

logger = logging.getLogger(__name__)


class DatabasePipeline:
    """
    Saves items to Django models in PostgreSQL.
    
    - ArticleItem → Article model (update_or_create by url_hash)
    - RepositoryItem → Repository model (update_or_create by github_id)
    - ResearchPaperItem → ResearchPaper model (update_or_create by arxiv_id)
    - VideoItem → Video model (update_or_create by youtube_id)
    
    Wraps saves in try/except to prevent pipeline crashes.
    Logs statistics at close.
    """

    def __init__(self):
        """Initialize the pipeline."""
        self.items_saved = 0
        self.items_failed = 0
        self.django_setup_complete = False

    def open_spider(self, spider):
        """
        Initialize Django environment and import models.
        
        Args:
            spider: Spider instance
        """
        try:
            # Add backend directory to sys.path so Django models are importable
            backend_dir = str(Path(__file__).resolve().parent.parent.parent / "backend")
            if backend_dir not in sys.path:
                sys.path.insert(0, backend_dir)

            # Set Django settings module
            os.environ.setdefault(
                "DJANGO_SETTINGS_MODULE", "config.settings.development"
            )

            # Setup Django
            django.setup()
            self.django_setup_complete = True
            self._user_cache = {}  # cache user lookups per spider run
            
            logger.info("Django environment initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Django: {e}")
            self.django_setup_complete = False
            raise

    def _resolve_user(self, spider):
        """Resolve the Django User instance from the spider's user_id setting."""
        user_id = getattr(spider, 'user_id', None) or os.environ.get('SYNAPSE_USER_ID')
        if not user_id:
            return None
        if user_id in self._user_cache:
            return self._user_cache[user_id]
        try:
            from apps.users.models import User
            user = User.objects.get(id=user_id)
            self._user_cache[user_id] = user
            return user
        except Exception:
            logger.debug("Could not resolve user_id=%s", user_id)
            self._user_cache[user_id] = None
            return None

    def close_spider(self, spider):
        """
        Log statistics and clean up.
        
        Args:
            spider: Spider instance
        """
        logger.info(
            f"Database pipeline closed. "
            f"Items saved: {self.items_saved}, Items failed: {self.items_failed}"
        )

    def process_item(self, item, spider):
        """
        Process an item and save to database via a thread pool.

        Runs the synchronous Django ORM save in a Twisted thread so it does
        not block the async reactor loop.

        Args:
            item: Scrapy item to save
            spider: Spider instance

        Returns:
            Deferred that resolves to item after save attempt.
        """
        if not self.django_setup_complete:
            logger.warning("Django not initialized, skipping item save")
            self.items_failed += 1
            return item

        return threads.deferToThread(self._save_item_sync, item, spider)

    def _save_item_sync(self, item, spider):
        """Synchronous save — runs in a thread, not the reactor loop."""
        item_type = item.__class__.__name__

        try:
            if item_type == "ArticleItem":
                self._save_article(item, spider)
            elif item_type == "RepositoryItem":
                self._save_repository(item, spider)
            elif item_type == "ResearchPaperItem":
                self._save_research_paper(item, spider)
            elif item_type == "VideoItem":
                self._save_video(item, spider)
            elif item_type == "TweetItem":
                self._save_tweet(item, spider)
            else:
                logger.warning(f"Unknown item type: {item_type}")
                self.items_failed += 1
                return item

            self.items_saved += 1
            logger.debug(f"Saved {item_type} to database")
            return item

        except Exception as e:
            self.items_failed += 1
            logger.error(f"Failed to save {item_type}: {e}")
            return item

    def _save_article(self, item, spider):
        """
        Save ArticleItem to Article model.
        
        Args:
            item: ArticleItem
            spider: Spider instance
        """
        from apps.articles.models import Article, Source

        url = item.get("url", "")
        url_hash = hashlib.sha256(url.encode()).hexdigest()

        # Get or create source
        source_name = item.get("source_name") or item.get("source") or "Unknown"
        source_url = item.get("source_url", "") or ""
        source_type = item.get("source_type", "news") or "news"
        source, _ = Source.objects.get_or_create(
            name=source_name,
            defaults={
                "url": source_url,
                "source_type": source_type,
                "is_active": True,
            },
        )

        # Parse published_at if provided
        published_at = None
        if item.get("published_at"):
            published_at = self._parse_datetime(item["published_at"])

        # Update or create article
        defaults = {
                "url": url,
                "title": item.get("title", ""),
                "content": item.get("content", ""),
                "summary": item.get("summary", ""),
                "source": source,
                "author": item.get("author", ""),
                "published_at": published_at,
                "topic": item.get("topic", ""),
                "tags": item.get("tags", []),
                "keywords": item.get("keywords", []),
                "sentiment_score": item.get("sentiment_score"),
                "trending_score": item.get("trending_score") or 0.0,
                "view_count": item.get("view_count", 0),
                "metadata": item.get("metadata", {}),
        }
        user = self._resolve_user(spider)
        if user:
            defaults["user"] = user
        article, created = Article.objects.update_or_create(
            url_hash=url_hash,
            defaults=defaults,
        )

        # Phase 2.2 — Auto-trigger NLP pipeline (incl. BART summarization)
        # after saving a new article. Existing articles that are already
        # nlp_processed are skipped to avoid redundant work.
        if created or not article.nlp_processed:
            try:
                # Import via Django's app registry to keep scraper decoupled
                from django.db import connection as _conn  # noqa: PLC0415
                # Use Celery task if broker is reachable; fail silently otherwise
                import importlib  # noqa: PLC0415
                tasks_mod = importlib.import_module("apps.articles.tasks")
                tasks_mod.process_article_nlp.delay(str(article.id))
                logger.info(
                    "Queued NLP/summarization task for article %s (created=%s)",
                    article.id, created,
                )
            except Exception as nlp_exc:
                logger.warning(
                    "Could not queue NLP task for article %s: %s",
                    article.id, nlp_exc,
                )

    def _save_repository(self, item, spider):
        """
        Save RepositoryItem to Repository model.
        
        Args:
            item: RepositoryItem
            spider: Spider instance
        """
        from apps.repositories.models import Repository

        # Parse repo_created_at if provided
        repo_created_at = None
        if item.get("repo_created_at"):
            repo_created_at = self._parse_datetime(item["repo_created_at"])

        # Update or create repository
        Repository.objects.update_or_create(
            github_id=item.get("github_id"),
            defaults={
                "name": item.get("name", ""),
                "full_name": item.get("full_name", ""),
                "description": item.get("description", ""),
                "url": item.get("url", ""),
                "clone_url": item.get("clone_url", ""),
                "stars": item.get("stars", 0),
                "forks": item.get("forks", 0),
                "watchers": item.get("watchers", 0),
                "open_issues": item.get("open_issues", 0),
                "language": item.get("language"),
                "topics": item.get("topics", []),
                "owner": item.get("owner", ""),
                "is_trending": item.get("is_trending", False),
                "stars_today": item.get("stars_today", 0),
                "repo_created_at": repo_created_at,
                "metadata": item.get("metadata", {}),
            },
        )

    def _save_research_paper(self, item, spider):
        """
        Save ResearchPaperItem to ResearchPaper model.
        
        Args:
            item: ResearchPaperItem
            spider: Spider instance
        """
        from apps.papers.models import ResearchPaper

        # Parse published_date if provided
        published_date = None
        if item.get("published_date"):
            published_date = self._parse_datetime(item["published_date"])

        # Update or create research paper
        ResearchPaper.objects.update_or_create(
            arxiv_id=item.get("arxiv_id"),
            defaults={
                "title": item.get("title", ""),
                "abstract": item.get("abstract", ""),
                "summary": item.get("summary", ""),
                "authors": item.get("authors", []),
                "categories": item.get("categories", []),
                "published_date": published_date,
                "url": item.get("url", ""),
                "pdf_url": item.get("pdf_url", ""),
                "citation_count": item.get("citation_count", 0),
                "difficulty_level": item.get("difficulty_level", "intermediate"),
                "key_contributions": item.get("key_contributions", ""),
                "applications": item.get("applications", ""),
            },
        )

    def _save_video(self, item, spider):
        """
        Save VideoItem to Video model.
        
        Args:
            item: VideoItem
            spider: Spider instance
        """
        from apps.videos.models import Video

        # Parse published_at if provided
        published_at = None
        if item.get("published_at"):
            published_at = self._parse_datetime(item["published_at"])

        # Update or create video
        Video.objects.update_or_create(
            youtube_id=item.get("youtube_id"),
            defaults={
                "title": item.get("title", ""),
                "description": item.get("description", ""),
                "summary": item.get("summary", ""),
                "channel_name": item.get("channel_name", ""),
                "channel_id": item.get("channel_id", ""),
                "url": item.get("url", ""),
                "thumbnail_url": item.get("thumbnail_url", ""),
                "duration_seconds": item.get("duration_seconds", 0),
                "view_count": item.get("view_count", 0),
                "like_count": item.get("like_count", 0),
                "published_at": published_at,
                "transcript": item.get("transcript", ""),
                "topics": item.get("topics", []),
            },
        )

    def _save_tweet(self, item, spider):
        """
        Save TweetItem to Tweet model.

        Args:
            item: TweetItem
            spider: Spider instance
        """
        from apps.tweets.models import Tweet

        posted_at = None
        if item.get("posted_at"):
            posted_at = self._parse_datetime(item["posted_at"])

        from django.utils import timezone

        defaults = {
                "text": item.get("text", ""),
                "author_username": item.get("author_username", ""),
                "author_display_name": item.get("author_display_name", ""),
                "author_profile_image": item.get("author_profile_image", ""),
                "author_verified": item.get("author_verified", False),
                "author_followers": item.get("author_followers", 0),
                "retweet_count": item.get("retweet_count", 0),
                "like_count": item.get("like_count", 0),
                "reply_count": item.get("reply_count", 0),
                "quote_count": item.get("quote_count", 0),
                "view_count": item.get("view_count", 0),
                "bookmark_count": item.get("bookmark_count", 0),
                "posted_at": posted_at,
                "scraped_at": timezone.now(),
                "hashtags": item.get("hashtags", []),
                "mentions": item.get("mentions", []),
                "media_urls": item.get("media_urls", []),
                "urls": item.get("urls", []),
                "is_retweet": item.get("is_retweet", False),
                "is_reply": item.get("is_reply", False),
                "is_quote": item.get("is_quote", False),
                "conversation_id": item.get("conversation_id", ""),
                "in_reply_to_user": item.get("in_reply_to_user", ""),
                "lang": item.get("lang", ""),
                "url": item.get("url", ""),
                "source_label": item.get("source_label", ""),
                "topic": item.get("topic", ""),
                "trending_score": item.get("trending_score") or 0.0,
                "metadata": item.get("metadata", {}),
        }
        user = self._resolve_user(spider)
        if user:
            defaults["user"] = user
        Tweet.objects.update_or_create(
            tweet_id=item.get("tweet_id"),
            defaults=defaults,
        )

    @staticmethod
    def _parse_datetime(value):
        """
        Parse various datetime formats to datetime object.
        
        Args:
            value: Datetime string or object
            
        Returns:
            datetime or None: Parsed datetime object
        """
        if isinstance(value, datetime):
            return value

        if not isinstance(value, str):
            return None

        try:
            # Try ISO format first
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            pass

        try:
            # Try other common formats
            from dateutil import parser
            return parser.parse(value)
        except Exception:
            logger.warning(f"Could not parse datetime: {value}")
            return None
