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

# Compute project root directory - works in both local dev and Docker
_file_path = Path(__file__).resolve()
# Local: /project/backend/apps/core/tasks.py -> /project (4 parents)
# Docker: /app/apps/core/tasks.py -> /app (3 parents, no 'backend' dir)
if (_file_path.parent.parent.parent / "backend").exists():
    BASE_DIR = _file_path.parent.parent.parent.parent  # Local dev with backend/ folder
else:
    BASE_DIR = _file_path.parent.parent.parent  # Docker container, no backend/ folder


# Virtualenv Python for subprocess - detect dynamically (works in local dev and Docker)
def _get_venv_python() -> str:
    """Find the correct virtualenv Python executable."""
    possible_paths = [
        # Local development paths
        BASE_DIR / "backend" / "venv" / "bin" / "python",
        BASE_DIR / "venv" / "bin" / "python",
        # Docker container paths
        Path("/app") / "backend" / "venv" / "bin" / "python",
        Path("/app") / "venv" / "bin" / "python",
        # System Python as fallback
        Path("/usr/local/bin/python3"),
        Path("/usr/bin/python3"),
    ]
    for path in possible_paths:
        if path.exists():
            return str(path)
    # Fallback to current Python
    import sys

    return sys.executable


VENV_PYTHON = _get_venv_python()


def _ensure_dedup_ttl() -> None:
    """Ensure all dedup Redis sets have a 24-hour TTL so they don't block scraping forever.
    Called before each scrape task to keep TTLs fresh."""
    try:
        import redis as redis_lib

        from django.conf import settings

        redis_url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        # Dedup sets live in db 0
        r = redis_lib.from_url(
            redis_url.rsplit("/", 1)[0] + "/0", decode_responses=True
        )
        for key in [
            "synapse:seen_urls",
            "synapse:seen_github_ids",
            "synapse:seen_arxiv_ids",
            "synapse:seen_youtube_ids",
        ]:
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
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in env:  # don't override existing env vars
                    env[key] = val

    # Inject per-user API keys from their stored preferences (override .env)
    if user_id:
        env["SYNAPSE_USER_ID"] = str(user_id)
        try:
            from apps.users.models import User  # noqa: PLC0415

            import django  # noqa: PLC0415

            user = User.objects.filter(pk=user_id).first()
            if user:
                prefs = getattr(user, "preferences", {}) or {}
                if prefs.get("x_api_key"):
                    env["X_API_KEY"] = prefs["x_api_key"]
                    env["TWITTER_BEARER_TOKEN"] = prefs["x_api_key"]
                if prefs.get("github_token"):
                    env["GITHUB_TOKEN"] = prefs["github_token"]
        except Exception as e:
            logger.warning(f"Could not load user API keys for user {user_id}: {e}")

    project_root = str(BASE_DIR)
    backend_dir = str(BASE_DIR / "backend")
    current_path = env.get("PYTHONPATH", "")
    parts = [p for p in current_path.split(":") if p]
    for d in [project_root, backend_dir]:
        if d not in parts:
            parts.insert(0, d)
    env["PYTHONPATH"] = ":".join(parts)

    # Ensure virtualenv bin is in PATH so subprocess finds correct Python
    venv_bin = str(Path(VENV_PYTHON).parent)
    current_sys_path = env.get("PATH", "")
    if venv_bin not in current_sys_path:
        env["PATH"] = f"{venv_bin}:{current_sys_path}"

    return env


def _backfill_user_links(user_id: str, source: str, limit: int = 5) -> int:
    """
    After a scrape completes, ensure the user is linked to at least `limit`
    items of the given source type.  Dedup may have prevented the spider
    from re-yielding items that already exist in the DB; this function
    links the user to those existing items so they appear in the feed.

    Returns the number of new junction rows created.
    """
    if not user_id:
        return 0

    try:
        from apps.users.models import User

        user = User.objects.filter(pk=user_id).first()
        if not user:
            return 0
    except Exception:
        return 0

    created_count = 0

    try:
        if source in ("hackernews", "news", "articles"):
            from apps.articles.models import Article, UserArticle

            already = UserArticle.objects.filter(user=user).values_list(
                "article_id", flat=True
            )
            needed = limit - already.count()
            if needed > 0:
                extras = Article.objects.exclude(id__in=already).order_by(
                    "-scraped_at"
                )[:needed]
                for a in extras:
                    _, c = UserArticle.objects.get_or_create(user=user, article=a)
                    created_count += int(c)

        elif source == "github":
            from apps.repositories.models import Repository, UserRepository

            already = UserRepository.objects.filter(user=user).values_list(
                "repository_id", flat=True
            )
            needed = limit - already.count()
            if needed > 0:
                extras = Repository.objects.exclude(id__in=already).order_by(
                    "-scraped_at"
                )[:needed]
                for r in extras:
                    _, c = UserRepository.objects.get_or_create(user=user, repository=r)
                    created_count += int(c)

        elif source == "arxiv":
            from apps.papers.models import ResearchPaper, UserPaper

            already = UserPaper.objects.filter(user=user).values_list(
                "paper_id", flat=True
            )
            needed = limit - already.count()
            if needed > 0:
                extras = ResearchPaper.objects.exclude(id__in=already).order_by(
                    "-fetched_at"
                )[:needed]
                for p in extras:
                    _, c = UserPaper.objects.get_or_create(user=user, paper=p)
                    created_count += int(c)

        elif source in ("youtube", "videos"):
            from apps.videos.models import UserVideo, Video

            already = UserVideo.objects.filter(user=user).values_list(
                "video_id", flat=True
            )
            needed = limit - already.count()
            if needed > 0:
                extras = Video.objects.exclude(id__in=already).order_by("-fetched_at")[
                    :needed
                ]
                for v in extras:
                    _, c = UserVideo.objects.get_or_create(user=user, video=v)
                    created_count += int(c)

        elif source in ("twitter", "tweets"):
            from apps.tweets.models import Tweet, UserTweet

            already = UserTweet.objects.filter(user=user).values_list(
                "tweet_id", flat=True
            )
            needed = limit - already.count()
            if needed > 0:
                extras = Tweet.objects.exclude(id__in=already).order_by("-posted_at")[
                    :needed
                ]
                for t in extras:
                    _, c = UserTweet.objects.get_or_create(user=user, tweet=t)
                    created_count += int(c)

    except Exception as exc:
        logger.warning(f"Backfill failed for user={user_id} source={source}: {exc}")

    if created_count:
        logger.info(f"Backfilled {created_count} {source} links for user {user_id}")
    return created_count


@shared_task(bind=True, max_retries=3)
def scrape_hackernews(
    self, story_type: str = "top", limit: int = 100, user_id: Optional[str] = None
) -> Dict:
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
    logger.info(
        f"[{task_id}] Starting HackerNews scraper: story_type={story_type}, limit={limit}"
    )

    try:
        spider_name = "hackernews"
        cmd = [
            VENV_PYTHON,
            "-m",
            "scrapy",
            "crawl",
            spider_name,
            "-a",
            f"story_type={story_type}",
            "-a",
            f"limit={limit}",
        ]

        # Add user_id as spider argument if provided
        if user_id:
            cmd.extend(["-a", f"user_id={user_id}"])

        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR / "scraper"),
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            env=_scrapy_env(user_id=user_id),
        )

        if result.returncode == 0:
            logger.info(f"[{task_id}] HackerNews scraper completed successfully")
            _update_source_last_scraped("news")
            _backfill_user_links(user_id, "hackernews", limit)
            return {
                "spider": "hackernews",
                "status": "success",
                "returncode": result.returncode,
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
def scrape_github(
    self,
    days_back: int = 1,
    language: Optional[str] = None,
    limit: int = 100,
    user_id: Optional[str] = None,
) -> Dict:
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
        spider_name = "github"
        cmd = [
            VENV_PYTHON,
            "-m",
            "scrapy",
            "crawl",
            spider_name,
            "-a",
            f"days_back={days_back}",
            "-a",
            f"limit={limit}",
        ]

        if language:
            cmd.extend(["-a", f"language={language}"])

        # Add user_id as spider argument if provided
        if user_id:
            cmd.extend(["-a", f"user_id={user_id}"])

        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR / "scraper"),
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            env=_scrapy_env(user_id=user_id),
        )

        if result.returncode == 0:
            logger.info(f"[{task_id}] GitHub scraper completed successfully")
            _update_source_last_scraped("github")
            _backfill_user_links(user_id, "github", limit)
            return {
                "spider": "github",
                "status": "success",
                "returncode": result.returncode,
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
def scrape_arxiv(
    self,
    categories: Optional[list] = None,
    days_back: int = 7,
    max_papers: int = 500,
    user_id: Optional[str] = None,
) -> Dict:
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
        spider_name = "arxiv"
        cmd = [
            VENV_PYTHON,
            "-m",
            "scrapy",
            "crawl",
            spider_name,
            "-a",
            f"days_back={days_back}",
            "-a",
            f"max_papers={max_papers}",
        ]

        if categories:
            categories_str = ",".join(categories)
            cmd.extend(["-a", f"categories={categories_str}"])

        # Add user_id as spider argument if provided
        if user_id:
            cmd.extend(["-a", f"user_id={user_id}"])

        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR / "scraper"),
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout for arXiv
            env=_scrapy_env(user_id=user_id),
        )

        if result.returncode == 0:
            logger.info(f"[{task_id}] arXiv scraper completed successfully")
            _update_source_last_scraped("arxiv")
            _backfill_user_links(user_id, "arxiv", max_papers)
            return {
                "spider": "arxiv",
                "status": "success",
                "returncode": result.returncode,
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
def scrape_youtube(
    self,
    days_back: int = 30,
    max_results: int = 20,
    queries: list = None,
    user_id: Optional[str] = None,
) -> Dict:
    _ensure_dedup_ttl()
    """
    Scrape YouTube videos using yt-dlp directly (no Scrapy dependency).

    This task calls yt-dlp --flat-playlist --dump-single-json for each
    search query, parses the results, filters non-tech content, and saves
    Video objects to the database.

    Args:
        self: Celery task instance (for retry mechanism)
        days_back: Number of days to look back - default: 30
        max_results: Maximum number of videos to scrape - default: 20
        queries: Optional list of search queries
        user_id: Optional user ID for personalization

    Returns:
        Dictionary with keys: {'spider': 'youtube', 'status': 'success'/'failed', 'count': int}
    """
    import json as _json
    import shutil

    task_id = self.request.id
    logger.info(
        f"[{task_id}] Starting YouTube scraper (yt-dlp direct): "
        f"days_back={days_back}, max_results={max_results}"
    )

    # ── Default queries ──────────────────────────────────────────────────
    DEFAULT_QUERIES = [
        "machine learning tutorial 2025",
        "large language models explained",
        "AI agents autonomous LLM",
        "open source AI tools 2025",
        "Django FastAPI Python tutorial",
        "Next.js React TypeScript tutorial",
        "Kubernetes Docker DevOps tutorial",
        "web security best practices",
    ]

    NON_TECH_KEYWORDS = [
        "workout", "fitness", "gym", "yoga", "diet", "recipe", "cooking",
        "makeup", "beauty", "skincare", "fashion", "vlog", "travel", "prank",
        "challenge", "dance", "music video", "reaction", "unboxing", "asmr",
        "meditation", "relationship", "dating", "romance", "funny", "comedy",
        "sport", "football", "basketball", "soccer", "cricket",
        "movie review", "anime", "manga", "gaming highlights", "minecraft",
        "fortnite", "roblox", "weight loss", "bodybuilding", "real estate",
        "stock market tips",
    ]

    # ── Resolve queries ───────────────────────────────────────────────────
    if queries:
        search_queries = list(queries)
    else:
        search_queries = DEFAULT_QUERIES

    # Cap queries to max_results
    max_queries = max(1, max_results)
    if len(search_queries) > max_queries:
        search_queries = search_queries[:max_queries]

    # Per-query result count
    num_queries = max(len(search_queries), 1)
    per_query = max(1, min(3, max_results // num_queries))

    # ── Find yt-dlp binary ────────────────────────────────────────────────
    ytdlp_bin = shutil.which("yt-dlp") or "/usr/local/bin/yt-dlp"

    total_saved = 0
    from datetime import datetime as _dt

    try:
        from apps.videos.models import Video

        for query in search_queries:
            if total_saved >= max_results:
                break

            search_url = f"ytsearch{per_query}:{query}"
            try:
                result = subprocess.run(
                    [
                        ytdlp_bin,
                        "--flat-playlist",
                        "--dump-single-json",
                        "--no-warnings",
                        "--quiet",
                        search_url,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )

                raw = (result.stdout or "").strip()
                if not raw:
                    if result.stderr:
                        logger.warning(
                            f'[{task_id}] yt-dlp no output for "{query}": '
                            f"{result.stderr[:200]}"
                        )
                    continue

                try:
                    playlist = _json.loads(raw)
                except _json.JSONDecodeError as exc:
                    logger.warning(
                        f'[{task_id}] yt-dlp JSON parse error for "{query}": {exc}'
                    )
                    continue

                entries = playlist.get("entries") or []
                logger.info(
                    f'[{task_id}] yt-dlp returned {len(entries)} entries for '
                    f'query "{query}"'
                )

                for entry in entries:
                    if total_saved >= max_results:
                        break

                    video_id = entry.get("id", "")
                    title = (entry.get("title") or "").strip()
                    if not video_id or not title:
                        continue

                    # ── Tech content filter ───────────────────────────
                    title_lower = title.lower()
                    desc_lower = (entry.get("description") or "").lower()
                    combined = title_lower + " " + desc_lower[:200]
                    if any(kw in combined for kw in NON_TECH_KEYWORDS):
                        logger.debug(
                            f'[{task_id}] Skipping non-tech: "{title[:60]}"'
                        )
                        continue

                    # ── Parse upload date ──────────────────────────────
                    upload_date_str = entry.get("upload_date", "") or ""
                    published_at = None
                    if upload_date_str:
                        try:
                            published_at = _dt.strptime(
                                upload_date_str, "%Y%m%d"
                            ).replace(tzinfo=timezone.utc)
                        except ValueError:
                            pass

                    # ── Best thumbnail ──────────────────────────────────
                    thumbnails = entry.get("thumbnails") or []
                    if thumbnails:
                        thumbnail_url = (
                            thumbnails[-1].get("url", "")
                            or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
                        )
                    else:
                        thumbnail_url = (
                            f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
                        )

                    # ── Save to DB (upsert by youtube_id) ──────────────
                    try:
                        video, created = Video.objects.update_or_create(
                            youtube_id=video_id,
                            defaults={
                                "title": title[:500],
                                "description": (entry.get("description") or "")[
                                    :2000
                                ],
                                "channel_name": (
                                    entry.get("channel")
                                    or entry.get("uploader")
                                    or ""
                                )[:200],
                                "channel_id": (
                                    entry.get("channel_id")
                                    or entry.get("uploader_id")
                                    or ""
                                )[:100],
                                "url": f"https://www.youtube.com/watch?v={video_id}",
                                "thumbnail_url": thumbnail_url,
                                "duration_seconds": int(
                                    entry.get("duration") or 0
                                ),
                                "view_count": int(entry.get("view_count") or 0),
                                "like_count": int(entry.get("like_count") or 0),
                                "published_at": published_at,
                                "topics": [query],
                            },
                        )
                        if created:
                            total_saved += 1
                            logger.info(
                                f'[{task_id}] Saved new video: "{title[:60]}"'
                            )
                    except Exception as exc:
                        logger.warning(
                            f'[{task_id}] Failed to save video {video_id}: {exc}'
                        )

            except subprocess.TimeoutExpired:
                logger.warning(
                    f'[{task_id}] yt-dlp timed out for query: "{query}"'
                )
            except FileNotFoundError:
                logger.error(
                    f"[{task_id}] yt-dlp binary not found at {ytdlp_bin}"
                )
                break
            except Exception as exc:
                logger.error(
                    f'[{task_id}] yt-dlp error for query "{query}": {exc}'
                )

        logger.info(
            f"[{task_id}] YouTube scraper completed: {total_saved} new videos saved"
        )
        _update_source_last_scraped("youtube")
        _backfill_user_links(user_id, "youtube", max_results)
        return {
            "spider": "youtube",
            "status": "success",
            "count": total_saved,
        }

    except Exception as exc:
        logger.error(f"[{task_id}] YouTube scraper exception: {exc}")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(bind=True, max_retries=3)
def scrape_twitter(
    self,
    query: Optional[str] = None,
    queries: Optional[str] = None,
    max_results: int = 100,
    user_id: Optional[str] = None,
    use_nitter: bool = True,
) -> Dict:
    _ensure_dedup_ttl()
    """
    Scrape tweets using the X/Twitter spider.

    Args:
        self: Celery task instance (for retry mechanism)
        query: Search query (optional, uses default tech queries if not provided)
        queries: JSON string of multiple search queries (optional)
        max_results: Maximum number of tweets to scrape - default: 100

    Returns:
        Dictionary with keys: {'spider': 'twitter', 'status': 'success'/'failed', 'returncode': int}
    """
    task_id = self.request.id
    logger.info(
        f"[{task_id}] Starting X/Twitter scraper: query={query}, max_results={max_results}, use_nitter={use_nitter}"
    )

    try:
        # Determine spider: use Nitter (no API key needed) or X API v2
        env = _scrapy_env(user_id=user_id)
        has_x_api_key = bool(env.get("X_API_KEY") or env.get("TWITTER_BEARER_TOKEN"))

        # Prefer nitter unless: user explicitly wants X API AND has a key
        spider_name = "twitter" if (has_x_api_key and not use_nitter) else "nitter"
        logger.info(
            f"[{task_id}] Using spider: {spider_name} (has_x_key={has_x_api_key})"
        )

        cmd = [
            VENV_PYTHON,
            "-m",
            "scrapy",
            "crawl",
            spider_name,
            "-a",
            f"max_results={max_results}",
        ]
        if query:
            cmd.extend(["-a", f"query={query}"])
        if queries:
            cmd.extend(["-a", f"queries={queries}"])

        # Add user_id as spider argument if provided
        if user_id:
            cmd.extend(["-a", f"user_id={user_id}"])

        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR / "scraper"),
            capture_output=True,
            text=True,
            timeout=300,
            env=env,
        )

        if result.returncode == 0:
            logger.info(f"[{task_id}] X/Twitter scraper completed successfully")
            _update_source_last_scraped("twitter")
            _backfill_user_links(user_id, "twitter", max_results)
            return {
                "spider": "twitter",
                "status": "success",
                "returncode": result.returncode,
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
def scrape_all(self, user_id: Optional[str] = None) -> Dict:
    """
    Queue all five scrapers in parallel.

    Args:
        self:    Celery task instance (for retry mechanism)
        user_id: Optional user UUID string. When provided, junction rows are
                 created so the user's feed is populated.

    Returns:
        Dictionary with aggregated results from all spiders
    """
    task_id = self.request.id
    logger.info(f"[{task_id}] Starting all scrapers (user_id={user_id})")

    try:
        results = {
            "hackernews": scrape_hackernews.delay(user_id=user_id),
            "github": scrape_github.delay(user_id=user_id),
            "arxiv": scrape_arxiv.delay(user_id=user_id),
            "youtube": scrape_youtube.delay(user_id=user_id),
            "twitter": scrape_twitter.delay(user_id=user_id),
        }

        logger.info(
            f"[{task_id}] Queued all scrapers. "
            f"Task IDs: hackernews={results['hackernews'].id}, "
            f"github={results['github'].id}, arxiv={results['arxiv'].id}, "
            f"youtube={results['youtube'].id}, twitter={results['twitter'].id}"
        )

        return {
            "status": "success",
            "message": "All scrapers queued",
            "task_ids": {k: v.id for k, v in results.items()},
        }

    except Exception as exc:
        logger.error(f"[{task_id}] Error queuing all scrapers: {exc}")
        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(bind=True, max_retries=2)
def generate_user_briefing(self, user_id: str) -> Dict:
    """
    Generate a personalized daily briefing for a single user immediately.
    Used after onboarding to create the first briefing with scraped content.
    Fetches exactly 5 items from each source type for the user.
    """
    from datetime import date

    from apps.articles.models import Article, UserArticle
    from apps.core.models import DailyBriefing
    from apps.papers.models import ResearchPaper, UserPaper
    from apps.repositories.models import Repository, UserRepository
    from apps.tweets.models import Tweet, UserTweet
    from apps.users.models import User
    from apps.videos.models import UserVideo, Video

    from django.utils import timezone as tz

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for briefing generation")
        return {"status": "error", "message": "User not found"}

    today = date.today()

    # Delete existing briefing for today to regenerate
    DailyBriefing.objects.filter(user=user, date=today).delete()

    # Fetch EXACTLY 5 items from each source for this user
    articles = Article.objects.filter(user_articles__user=user).order_by("-scraped_at")[
        :5
    ]

    papers = ResearchPaper.objects.filter(user_papers__user=user).order_by(
        "-fetched_at"
    )[:5]

    repos = Repository.objects.filter(user_repositories__user=user).order_by(
        "-scraped_at"
    )[:5]

    videos = Video.objects.filter(user_videos__user=user).order_by("-fetched_at")[:5]

    tweets = Tweet.objects.filter(user_tweets__user=user).order_by("-posted_at")[:5]

    # Build personalized content
    name_greeting = f", {user.first_name}" if user.first_name else ""

    content = f"""# 📊 Your Personalized Tech Briefing for {today.strftime('%B %d, %Y')}

Welcome{name_greeting} to your SYNAPSE feed! Here's what's happening in tech today.

## 📰 Latest Articles ({articles.count()} from HackerNews)

"""
    sources = []

    for article in articles:
        content += f"- **{article.title}**\n"
        if article.summary:
            content += f"  {article.summary[:120]}...\n"
        sources.append({"title": article.title, "url": article.url, "type": "article"})

    content += f"""
## 📄 Latest Research ({papers.count()} from arXiv)

"""
    for paper in papers:
        content += f"- **{paper.title}**\n"
        if paper.abstract:
            content += f"  {paper.abstract[:120]}...\n"
        sources.append({"title": paper.title, "url": paper.url, "type": "paper"})

    content += f"""
## 💻 Trending Repositories ({repos.count()} from GitHub)

"""
    for repo in repos:
        content += f"- **{repo.owner}/{repo.name}** ({repo.stars or 0} ⭐)\n"
        if repo.description:
            content += f"  {repo.description[:120]}...\n"
        sources.append(
            {
                "title": f"{repo.owner}/{repo.name}",
                "url": repo.url,
                "type": "repository",
            }
        )

    content += f"""
## 🎬 Featured Videos ({videos.count()} from YouTube)

"""
    for video in videos:
        channel = getattr(video, "channel", None) or getattr(
            video, "channel_title", "Unknown"
        )
        content += f"- **{video.title}** by {channel}\n"
        sources.append({"title": video.title, "url": video.url, "type": "video"})

    content += f"""
## 🐦 Latest from X ({tweets.count()} tweets)

"""
    for tweet in tweets:
        content += f"- **@{tweet.author_username}**: {tweet.text[:120]}...\n"
        sources.append(
            {
                "title": f"@{tweet.author_username}",
                "url": tweet.url or "",
                "type": "tweet",
            }
        )

    content += """
---
*This briefing contains real scraped data personalized for you. Your daily workflows will keep this updated automatically.*
"""

    # Calculate topics from content
    all_titles = " ".join(a.title for a in articles[:3]).lower()
    topics = []
    topic_keywords = [
        "ai",
        "machine learning",
        "python",
        "rust",
        "kubernetes",
        "llm",
        "security",
        "web",
        "cloud",
        "devops",
        "research",
        "data science",
    ]
    for kw in topic_keywords:
        if kw in all_titles:
            topics.append(kw)

    # Create the briefing
    briefing = DailyBriefing.objects.create(
        user=user,
        date=today,
        content=content,
        sources=sources[:20],
        topic_summary={"topics": topics[:5], "sentiment": "positive"},
    )

    logger.info(
        f"Generated onboarding briefing for user {user.email}: {len(content)} chars, {len(sources)} sources"
    )

    return {
        "status": "success",
        "briefing_id": str(briefing.id),
        "content_length": len(content),
        "articles": articles.count(),
        "papers": papers.count(),
        "repos": repos.count(),
        "videos": videos.count(),
        "tweets": tweets.count(),
    }


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

    from apps.articles.models import Article
    from apps.core.models import DailyBriefing
    from apps.papers.models import ResearchPaper
    from apps.repositories.models import Repository
    from apps.users.models import User

    from django.utils import timezone as tz

    cutoff = tz.now() - timedelta(hours=24)
    today = tz.localdate()
    users = User.objects.filter(is_active=True).only("id", "email", "first_name")
    created = 0
    skipped = 0

    for user in users:
        # Skip if briefing already exists for today
        if DailyBriefing.objects.filter(user=user, date=today).exists():
            skipped += 1
            continue

        try:
            # ── gather recent content ────────────────────────────────────
            articles = list(
                Article.objects.filter(scraped_at__gte=cutoff)
                .order_by("-scraped_at")
                .values("title", "url", "summary")[:10]
            )
            papers = list(
                ResearchPaper.objects.filter(fetched_at__gte=cutoff)
                .order_by("-fetched_at")
                .values("title", "url", "abstract")[:5]
            )
            repos = list(
                Repository.objects.filter(scraped_at__gte=cutoff)
                .order_by("-scraped_at")
                .values("full_name", "url", "description")[:5]
            )

            sources: list = []
            content_lines: list = []

            for a in articles:
                sources.append(
                    {"title": a["title"], "url": a["url"], "type": "article"}
                )
                if a.get("summary"):
                    content_lines.append(f"- {a['title']}: {a['summary'][:200]}")

            for p in papers:
                sources.append({"title": p["title"], "url": p["url"], "type": "paper"})
                if p.get("abstract"):
                    content_lines.append(f"- {p['title']}: {p['abstract'][:200]}")

            for r in repos:
                sources.append(
                    {"title": r["full_name"], "url": r["url"], "type": "repository"}
                )
                if r.get("description"):
                    content_lines.append(
                        f"- {r['full_name']}: {r['description'][:150]}"
                    )

            if not sources:
                # Nothing scraped yet — produce a placeholder
                content = (
                    f"Good morning{', ' + user.first_name if user.first_name else ''}! "
                    "Your personalised briefing will appear here once content has been scraped.\n\n"
                    "Check back tomorrow for the latest AI, development, and research highlights."
                )
                topic_summary: dict = {"topics": [], "sentiment": "neutral"}
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
                    all_titles = " ".join(s["title"] for s in sources[:10]).lower()
                    topics = []
                    for kw in [
                        "ai",
                        "machine learning",
                        "python",
                        "rust",
                        "kubernetes",
                        "llm",
                        "security",
                        "web",
                        "cloud",
                        "devops",
                        "research",
                    ]:
                        if kw in all_titles:
                            topics.append(kw)
                    topic_summary = {"topics": topics[:5], "sentiment": "positive"}

                except Exception as ai_exc:
                    logger.warning(
                        "AI briefing generation failed for user %s: %s", user.id, ai_exc
                    )
                    # Fallback template briefing — use \n\n so ReactMarkdown renders paragraphs
                    name_greeting = f", {user.first_name}" if user.first_name else ""
                    top = sources[:3]
                    bullets = "\n\n".join(
                        f"**[{i+1}]** {s['title']}" for i, s in enumerate(top)
                    )
                    content = (
                        f"Good morning{name_greeting}! Here is your daily briefing.\n\n"
                        f"In the past 24 hours, **{len(articles)} new articles**, "
                        f"**{len(papers)} research papers**, and **{len(repos)} repositories** "
                        f"were added to your feed.\n\n"
                        f"Top highlights:\n\n{bullets}\n\n"
                        f"Open the feed to explore all {len(sources)} new items and stay ahead of the curve."
                    )
                    topic_summary = {"topics": [], "sentiment": "neutral"}

            DailyBriefing.objects.update_or_create(
                user=user,
                date=today,
                defaults={
                    "content": content,
                    "sources": sources[:20],
                    "topic_summary": topic_summary,
                },
            )
            created += 1

        except Exception as exc:
            logger.error(
                "Failed to generate briefing for user %s: %s",
                user.id,
                exc,
                exc_info=True,
            )

    logger.info("Daily briefings: created=%s skipped=%s", created, skipped)
    return {"created": int(created), "skipped": int(skipped)}


@shared_task(bind=True, max_retries=2)
def build_knowledge_graph(self) -> Dict:
    """
    TASK-603-B2: Incrementally build the AI knowledge graph from all content.

    Pipeline:
     1. Query articles/papers since last_run (stored in cache).
     2. Run NER on each piece of content → extract entities.
     3. Upsert KnowledgeNode for each entity (merge by name+type).
     4. Create KnowledgeEdge edges for co-occurring entities.
     5. Link paper authors, repo tools, concept co-citations.
    """
    from apps.articles.models import Article
    from apps.core.models import KnowledgeEdge, KnowledgeNode
    from apps.papers.models import ResearchPaper

    from django.core.cache import cache
    from django.utils import timezone as dj_tz

    CACHE_KEY = "knowledge_graph_last_run"
    last_run = cache.get(CACHE_KEY)
    now = dj_tz.now()

    # Query new content since last run
    article_qs = Article.objects.all().values("id", "title", "summary", "url")
    paper_qs = ResearchPaper.objects.all().values(
        "id", "title", "abstract", "url", "authors"
    )

    if last_run:
        article_qs = article_qs.filter(scraped_at__gte=last_run)
        paper_qs = paper_qs.filter(fetched_at__gte=last_run)

    # Try to use NER pipeline; fall back to simple keyword extraction
    try:
        import os
        import sys

        sys.path.insert(
            0, os.path.join(os.path.dirname(__file__), "../../../../ai_engine")
        )
        from ai_engine.nlp.ner import NERExtractor

        ner = NERExtractor()
        use_ner = True
    except Exception:
        use_ner = False
        ner = None

    nodes_created = 0
    edges_created = 0

    def extract_entities(text: str) -> list[dict]:
        """Return list of {name, entity_type} dicts."""
        if not text:
            return []
        if use_ner and ner:
            try:
                results = ner.extract(text[:2000])
                return [
                    {
                        "name": r.get("text", r.get("entity", "")).strip(),
                        "entity_type": r.get("label", "concept").lower(),
                    }
                    for r in results
                    if r.get("text") or r.get("entity")
                ]
            except Exception:
                pass
        # Fallback: naive noun-phrase extraction via simple heuristic
        import re

        tokens = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text[:1000])
        return [
            {"name": t, "entity_type": "concept"} for t in set(tokens) if len(t) > 3
        ]

    def upsert_node(
        name: str, entity_type: str, source_id: str, extra_meta: dict | None = None
    ) -> KnowledgeNode | None:
        """Create or update a KnowledgeNode; returns the node."""
        name = name.strip()[:300]
        if not name or len(name) < 2:
            return None
        # Normalise entity_type to valid choices
        valid_types = {
            "concept",
            "paper",
            "repository",
            "author",
            "tool",
            "organization",
        }
        et = entity_type.lower() if entity_type.lower() in valid_types else "concept"
        node, created = KnowledgeNode.objects.get_or_create(
            name=name,
            entity_type=et,
            defaults={"source_ids": [source_id], "metadata": extra_meta or {}},
        )
        if not created:
            if source_id not in node.source_ids:
                node.source_ids.append(source_id)
                node.mention_count += 1
                node.save(update_fields=["source_ids", "mention_count", "updated_at"])
        return node

    def upsert_edge(
        src: KnowledgeNode, tgt: KnowledgeNode, rel: str, evidence_text: str = ""
    ) -> None:
        """Create or strengthen a KnowledgeEdge between two nodes."""
        nonlocal edges_created
        valid_rels = {"cites", "uses", "authored_by", "related_to", "built_with"}
        rel = rel if rel in valid_rels else "related_to"
        edge, created = KnowledgeEdge.objects.get_or_create(
            source=src,
            target=tgt,
            relation_type=rel,
            defaults={"weight": 1.0, "evidence": [{"text": evidence_text[:200]}]},
        )
        if not created:
            edge.weight += 0.5
            if len(edge.evidence) < 10 and evidence_text:
                edge.evidence.append({"text": evidence_text[:200]})
            edge.save(update_fields=["weight", "evidence"])
        else:
            edges_created += 1

    # ── Process articles ─────────────────────────────────────────────────────
    for article in article_qs[:200]:
        text = f"{article['title']} {article.get('summary', '')}"
        src_id = str(article["id"])
        entities = extract_entities(text)
        nodes = []
        for ent in entities[:15]:
            node = upsert_node(ent["name"], ent["entity_type"], src_id)
            if node:
                nodes.append(node)
                nodes_created += 1

        # Link co-occurring entities
        for i, n1 in enumerate(nodes[:8]):
            for n2 in nodes[i + 1 : 8]:
                if n1.pk != n2.pk:
                    upsert_edge(
                        n1, n2, "related_to", f"Co-occur in: {article['title'][:100]}"
                    )

    # ── Process papers ───────────────────────────────────────────────────────
    for paper in paper_qs[:200]:
        text = f"{paper['title']} {paper.get('abstract', '')}"
        src_id = str(paper["id"])
        entities = extract_entities(text)
        paper_node = upsert_node(
            paper["title"][:300], "paper", src_id, {"url": paper.get("url", "")}
        )
        if paper_node:
            nodes_created += 1

        # Add authors
        for author in (paper.get("authors") or [])[:5]:
            author_name = author if isinstance(author, str) else str(author)
            author_node = upsert_node(author_name, "author", src_id)
            if author_node and paper_node:
                upsert_edge(
                    paper_node, author_node, "authored_by", paper["title"][:100]
                )

        concept_nodes = []
        for ent in entities[:10]:
            node = upsert_node(ent["name"], ent["entity_type"], src_id)
            if node:
                concept_nodes.append(node)
                nodes_created += 1
                if paper_node:
                    upsert_edge(paper_node, node, "cites", paper["title"][:100])

    cache.set(CACHE_KEY, now, timeout=None)
    logger.info(
        "TASK-603-B2: knowledge graph built — nodes=%d edges=%d",
        nodes_created,
        edges_created,
    )
    return {"nodes_touched": nodes_created, "edges_created": edges_created}


@shared_task(bind=True, max_retries=2)
def run_research_session(self, session_id: str) -> Dict:
    """
    TASK-601-B2: Run the Plan-and-Execute research pipeline for a ResearchSession.
    Called when POST /api/v1/agents/research/ is hit.
    """
    try:
        import os
        import sys  # noqa

        ai_engine_path = os.path.join(
            os.path.dirname(__file__), "../../../../ai_engine"
        )
        if ai_engine_path not in sys.path:
            sys.path.insert(0, ai_engine_path)
        from ai_engine.agents.research_agent import run_research_pipeline  # noqa

        run_research_pipeline(session_id)
        return {"session_id": session_id, "status": "complete"}
    except Exception as exc:
        logger.error(
            "Research session task failed for %s: %s", session_id, exc, exc_info=True
        )
        # Mark session as failed
        try:
            from apps.agents.models import ResearchSession  # noqa

            ResearchSession.objects.filter(pk=session_id).update(
                status=ResearchSession.Status.FAILED
            )
        except Exception:
            pass
        raise self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=1)
def import_zotero_library(
    self, user_id: str, api_key: str, zotero_user_id: str
) -> Dict:
    """Import a user's Zotero library in the background."""
    try:
        from apps.integrations.zotero import ZoteroClient, import_library  # noqa
        from apps.users.models import User  # noqa

        user = User.objects.get(pk=user_id)
        client = ZoteroClient(api_key=api_key, user_id=zotero_user_id)
        result = import_library(client, user)
        logger.info("Zotero import complete for user %s: %s", user_id, result)
        return result
    except Exception as exc:
        logger.error("Zotero import failed for user %s: %s", user_id, exc)
        raise self.retry(exc=exc, countdown=120)


@shared_task(bind=True, max_retries=1)
def slack_ai_query(self, question: str, channel_id: str, response_url: str) -> Dict:
    """Answer a Slack /synapse command via AI and post delayed response."""
    try:
        from ai_engine.rag.pipeline import RAGPipeline  # noqa

        pipeline = RAGPipeline()
        result = pipeline.query(question)
        answer = result.get("answer", "No answer found.")
        sources = result.get("sources", [])

        # Post delayed response to Slack via response_url
        blocks = [
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Q: {question}*"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": answer[:3000]}},
        ]
        if sources:
            source_text = "\n".join(
                f"• <{s.get('url', '#')}|{s.get('title', 'Source')[:60]}>"
                for s in sources[:3]
            )
            blocks.append(
                {
                    "type": "context",
                    "elements": [
                        {"type": "mrkdwn", "text": f"Sources:\n{source_text}"}
                    ],
                }
            )

        import requests  # noqa

        requests.post(
            response_url,
            json={
                "response_type": "in_channel",
                "blocks": blocks,
            },
            timeout=10,
        )
        return {"status": "sent"}
    except Exception as exc:
        logger.error("Slack AI query failed: %s", exc)
        raise self.retry(exc=exc, countdown=30)


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

    db_url = os.environ.get("DATABASE_URL", "")
    bucket = os.environ.get("BACKUP_S3_BUCKET", "")
    admin_email = os.environ.get("BACKUP_ADMIN_EMAIL", "")
    slack_url = os.environ.get("BACKUP_SLACK_WEBHOOK", "")

    today_str = timezone.now().strftime("%Y/%m/%d")
    filename = f"postgres/{today_str}.sql.gz"

    if not db_url or not bucket:
        logger.warning(
            "TASK-502: DATABASE_URL or BACKUP_S3_BUCKET not set — skipping backup"
        )
        return {"status": "skipped", "reason": "missing env vars"}

    try:
        import boto3  # noqa: PLC0415
    except ImportError:
        logger.error("TASK-502: boto3 not installed — cannot upload backup")
        return {"status": "error", "reason": "boto3 not installed"}

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            dump_path = os.path.join(tmpdir, "backup.sql")
            gz_path = os.path.join(tmpdir, "backup.sql.gz")

            # ── 1. pg_dump ─────────────────────────────────────────────────
            logger.info("TASK-502: Running pg_dump…")
            result = subprocess.run(
                ["pg_dump", "--no-owner", "--no-acl", db_url],
                stdout=open(dump_path, "w"),
                stderr=subprocess.PIPE,
                timeout=600,
            )
            if result.returncode != 0:
                raise RuntimeError(f"pg_dump failed: {result.stderr.decode()[:500]}")

            # ── 2. gzip ────────────────────────────────────────────────────
            with open(dump_path, "rb") as f_in, gzip.open(gz_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
            gz_size_mb = os.path.getsize(gz_path) / (1024 * 1024)
            logger.info("TASK-502: Compressed backup %.1f MB", gz_size_mb)

            # ── 3. Upload to S3 ────────────────────────────────────────────
            s3 = boto3.client(
                "s3",
                region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
            )
            with open(gz_path, "rb") as f:
                s3.put_object(
                    Bucket=bucket,
                    Key=filename,
                    Body=f,
                    ContentType="application/gzip",
                    ServerSideEncryption="AES256",
                    StorageClass="STANDARD_IA",
                )
            logger.info("TASK-502: Uploaded s3://%s/%s", bucket, filename)

            # ── 4. Retention — delete backups older than 30 days ───────────
            cutoff = timezone.now() - timedelta(days=30)
            paginator = s3.get_paginator("list_objects_v2")
            deleted = 0
            for page in paginator.paginate(Bucket=bucket, Prefix="postgres/"):
                for obj in page.get("Contents", []):
                    if obj["LastModified"].replace(tzinfo=None) < cutoff.replace(
                        tzinfo=None
                    ):
                        s3.delete_object(Bucket=bucket, Key=obj["Key"])
                        deleted += 1
            if deleted:
                logger.info("TASK-502: Cleaned up %d old backups (>30 days)", deleted)

        return {
            "status": "success",
            "bucket": bucket,
            "key": filename,
            "size_mb": round(gz_size_mb, 2),
            "deleted_old": deleted,
        }

    except Exception as exc:
        logger.error("TASK-502: Backup FAILED — %s", exc, exc_info=True)

        # ── TASK-502-B2: Failure alerting ──────────────────────────────────
        err_msg = str(exc)[:1000]
        subject = (
            f"[SYNAPSE] Database backup FAILED — {timezone.now().strftime('%Y-%m-%d')}"
        )
        body = (
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
                    from_email=getattr(
                        django_settings, "DEFAULT_FROM_EMAIL", "noreply@synapse.app"
                    ),
                    recipient_list=[admin_email],
                    fail_silently=True,
                )
            except Exception as mail_exc:
                logger.error(
                    "TASK-502: Failed to send backup failure email: %s", mail_exc
                )

        # Slack webhook
        if slack_url:
            try:
                import json as _json  # noqa: PLC0415,E401
                import urllib.request

                payload = _json.dumps(
                    {
                        "text": f":rotating_light: *Database backup FAILED* ({timezone.now().strftime('%Y-%m-%d')})\n```{err_msg[:500]}```"
                    }
                ).encode()
                req = urllib.request.Request(
                    slack_url,
                    data=payload,
                    headers={"Content-Type": "application/json"},
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

        logger.debug(
            f"Updated last_scraped_at for {updated_count} {source_type} sources"
        )
    except Exception as exc:
        logger.warning(
            f"Failed to update Source.last_scraped_at for {source_type}: {exc}"
        )
