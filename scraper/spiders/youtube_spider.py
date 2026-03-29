"""
YouTube Spider for SYNAPSE — uses yt-dlp (no API key, no quota limits)

Searches YouTube for tech/AI/ML videos using yt-dlp's ytsearch backend.
Populates VideoItem with video metadata without hitting the YouTube Data API.
"""

import logging
import subprocess
import json
from datetime import datetime, timezone

import scrapy
from scraper.items import VideoItem

logger = logging.getLogger(__name__)


class YouTubeSpider(scrapy.Spider):
    """
    YouTube spider using yt-dlp — no API key, no quota.
    Uses yt-dlp to search YouTube and extract video metadata.
    """

    name = 'youtube'
    allowed_domains = []  # yt-dlp handles its own requests
    start_urls = ['https://www.youtube.com']  # dummy — overridden by start_requests

    custom_settings = {
        'ROBOTSTXT_OBEY': False,
        'CONCURRENT_REQUESTS': 1,
        'DOWNLOAD_DELAY': 0,
    }

    DEFAULT_QUERIES = [
        'machine learning 2024',
        'artificial intelligence tutorial',
        'AI agents LLM',
        'LangChain tutorial',
        'RAG retrieval augmented generation',
        'vector databases explained',
        'Django REST API tutorial',
        'Next.js tutorial',
        'system design interview',
        'large language models explained',
        'open source AI tools',
        'Python data science',
    ]

    def __init__(self, queries=None, days_back=30, max_results=20, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.queries = queries if queries else self.DEFAULT_QUERIES
        self.max_results = int(max_results)
        self.days_back = int(days_back)
        # How many results per query (distribute total across queries)
        self.per_query = max(1, self.max_results // len(self.DEFAULT_QUERIES))

    def start_requests(self):
        """Use yt-dlp to fetch videos — yield a dummy request per query."""
        # Use custom queries if provided, else fall back to defaults
        active_queries = self.queries if self.queries else self.DEFAULT_QUERIES
        # Recalculate per_query based on actual query count
        self.per_query = max(1, self.max_results // len(active_queries))
        for query in active_queries:
            yield scrapy.Request(
                url=f'https://www.youtube.com/results?search_query={query.replace(" ", "+")}',
                callback=self.fetch_with_ytdlp,
                cb_kwargs={'query': query},
                dont_filter=True,
            )

    def fetch_with_ytdlp(self, response, query):
        """Run yt-dlp to get video metadata for this query."""
        import shutil
        # Find yt-dlp in PATH or common install locations
        ytdlp_bin = (
            shutil.which('yt-dlp') or
            '/home/appuser/.local/bin/yt-dlp' or
            '/usr/local/bin/yt-dlp'
        )
        n = self.per_query
        search_url = f'ytsearch{n}:{query}'

        try:
            result = subprocess.run(
                [
                    ytdlp_bin,
                    '--dump-json',
                    '--no-playlist',
                    '--skip-download',
                    '--quiet',
                    '--no-warnings',
                    '--extractor-args', 'youtube:skip=dash,hls',
                    search_url,
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )

            if result.returncode != 0 and not result.stdout.strip():
                logger.warning(f'yt-dlp ({ytdlp_bin}) failed for query "{query}": {result.stderr[:200]}')
                return

            for line in result.stdout.strip().split('\n'):
                if not line.strip():
                    continue
                try:
                    info = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Extract upload date
                upload_date_str = info.get('upload_date', '')
                try:
                    published_at = datetime.strptime(upload_date_str, '%Y%m%d').replace(
                        tzinfo=timezone.utc
                    ).isoformat() if upload_date_str else datetime.now(timezone.utc).isoformat()
                except ValueError:
                    published_at = datetime.now(timezone.utc).isoformat()

                # Best thumbnail
                thumbnails = info.get('thumbnails', [])
                thumbnail_url = thumbnails[-1]['url'] if thumbnails else (
                    f"https://i.ytimg.com/vi/{info.get('id', '')}/hqdefault.jpg"
                )

                # Duration in seconds
                duration = info.get('duration', 0) or 0

                video_id = info.get('id', '')
                if not video_id:
                    continue

                item = VideoItem()
                item['youtube_id'] = video_id
                item['title'] = info.get('title', '')[:500]
                item['description'] = (info.get('description', '') or '')[:2000]
                item['channel_name'] = info.get('uploader', '') or info.get('channel', '')
                item['channel_id'] = info.get('channel_id', '') or info.get('uploader_id', '')
                item['published_at'] = published_at
                item['thumbnail_url'] = thumbnail_url
                item['duration_seconds'] = duration
                item['view_count'] = info.get('view_count', 0) or 0
                item['like_count'] = info.get('like_count', 0) or 0
                item['url'] = f'https://www.youtube.com/watch?v={video_id}'
                item['topics'] = [query]
                item['metadata'] = {
                    'query': query,
                    'source': 'yt-dlp',
                    'categories': info.get('categories', []),
                    'tags': (info.get('tags', []) or [])[:20],
                    'channel_follower_count': info.get('channel_follower_count', 0),
                    'language': info.get('language', ''),
                }

                yield item

        except subprocess.TimeoutExpired:
            logger.warning(f'yt-dlp timed out for query: {query}')
        except Exception as e:
            logger.error(f'yt-dlp ({ytdlp_bin}) error for query "{query}": {e}')

    def parse(self, response):
        """Not used — yt-dlp handles all fetching."""
        pass
