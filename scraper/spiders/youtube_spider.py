"""
YouTube Spider for SYNAPSE — AI-powered tech intelligence platform

Fetches videos from YouTube using the YouTube Data API v3.
Searches for tech/AI/ML-related queries and populates VideoItem with:
  - Video metadata (title, description, channel info)
  - Statistics (views, likes, comments)
  - Duration (parsed from ISO 8601 format)
  - Thumbnail URLs (highest quality available)
  - Topics (from search query)
  - Rich metadata dict

Requires YOUTUBE_API_KEY environment variable (v3 API key).
Handles quota exceeded and API errors gracefully.
"""

import logging
import os
import re
from datetime import datetime, timedelta
from urllib.parse import urlencode

import scrapy
from scraper.items import VideoItem

logger = logging.getLogger(__name__)


class YouTubeSpider(scrapy.Spider):
    """
    YouTube Data API v3 spider for discovering tech/AI/ML videos.
    
    Attributes:
        name: Spider identifier ('youtube')
        allowed_domains: API domain
        custom_settings: Rate limiting and request configuration
    """
    
    name = 'youtube'
    allowed_domains = ['googleapis.com']
    
    custom_settings = {
        'DOWNLOAD_DELAY': 0.5,
        'ROBOTSTXT_OBEY': False,
        'CONCURRENT_REQUESTS': 4,
    }
    
    # Default high-quality tech/AI/ML queries
    DEFAULT_QUERIES = [
        'machine learning',
        'artificial intelligence',
        'AI agents',
        'LangChain tutorial',
        'RAG retrieval augmented generation',
        'vector databases',
        'Django REST API',
        'FastAPI',
        'Next.js',
        'system design',
        'large language models',
        'Kubernetes',
        'data engineering',
        'Transformers PyTorch',
        'MLOps',
    ]
    
    def __init__(self, *args, **kwargs):
        super(YouTubeSpider, self).__init__(*args, **kwargs)
        
        # Get API key from environment
        self.api_key = os.getenv('YOUTUBE_API_KEY')
        if not self.api_key:
            logger.warning(
                'YOUTUBE_API_KEY environment variable not set. '
                'Spider will not fetch videos.'
            )
        
        # Parse CLI arguments
        queries_str = kwargs.get('queries', '|'.join(self.DEFAULT_QUERIES))
        self.queries = [q.strip() for q in queries_str.split('|') if q.strip()]
        
        self.max_results = int(kwargs.get('max_results', 20))
        self.max_results = min(self.max_results, 50)  # API limit
        
        self.days_back = int(kwargs.get('days_back', 30))
        
        self.base_url = 'https://www.googleapis.com/youtube/v3'
        self.video_ids_batch = {}  # {search_query: [video_ids]}
    
    def start_requests(self):
        """Generate search requests for each query."""
        if not self.api_key:
            logger.error('Cannot start requests: YOUTUBE_API_KEY not configured')
            return
        
        published_after = (
            datetime.utcnow() - timedelta(days=self.days_back)
        ).isoformat() + 'Z'
        
        for query in self.queries:
            params = {
                'part': 'snippet',
                'q': query,
                'type': 'video',
                'maxResults': self.max_results,
                'publishedAfter': published_after,
                'relevanceLanguage': 'en',
                'key': self.api_key,
                'order': 'relevance',
            }
            
            url = f"{self.base_url}/search?{urlencode(params)}"
            
            yield scrapy.Request(
                url,
                callback=self.parse_search,
                errback=self.handle_error,
                meta={'query': query},
            )
    
    def parse_search(self, response):
        """
        Parse search results and collect video IDs for batch fetch.
        
        Args:
            response: Scrapy response from search endpoint
            
        Yields:
            Requests to fetch full video details
        """
        query = response.meta.get('query', 'unknown')
        
        try:
            data = response.json()
        except Exception as e:
            logger.error(f'Failed to parse search response for "{query}": {e}')
            return
        
        # Check for API errors
        if 'error' in data:
            error_msg = data['error'].get('message', 'Unknown error')
            if data['error'].get('code') == 403:
                logger.warning(f'YouTube API quota exceeded: {error_msg}')
            else:
                logger.error(f'YouTube API error for "{query}": {error_msg}')
            return
        
        items = data.get('items', [])
        if not items:
            logger.info(f'No results found for query: "{query}"')
            return
        
        # Extract video IDs
        video_ids = [
            item['id']['videoId']
            for item in items
            if item.get('id', {}).get('kind') == 'youtube#video'
        ]
        
        if not video_ids:
            logger.info(f'No videos found for query: "{query}"')
            return
        
        self.video_ids_batch[query] = video_ids
        
        # Batch fetch video details (up to 50 per request)
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i:i+50]
            params = {
                'part': 'snippet,statistics,contentDetails',
                'id': ','.join(batch),
                'key': self.api_key,
            }
            
            url = f"{self.base_url}/videos?{urlencode(params)}"
            
            yield scrapy.Request(
                url,
                callback=self.parse_videos,
                errback=self.handle_error,
                meta={'query': query},
            )
    
    def parse_videos(self, response):
        """
        Parse video details and yield VideoItem for each.
        
        Args:
            response: Scrapy response from videos endpoint
            
        Yields:
            VideoItem: Populated with all available fields
        """
        query = response.meta.get('query', 'unknown')
        
        try:
            data = response.json()
        except Exception as e:
            logger.error(f'Failed to parse videos response for "{query}": {e}')
            return
        
        # Check for API errors
        if 'error' in data:
            error_msg = data['error'].get('message', 'Unknown error')
            if data['error'].get('code') == 403:
                logger.warning(f'YouTube API quota exceeded: {error_msg}')
            else:
                logger.error(f'YouTube API error for "{query}": {error_msg}')
            return
        
        items = data.get('items', [])
        
        for item in items:
            try:
                video_id = item['id']
                snippet = item.get('snippet', {})
                stats = item.get('statistics', {})
                content_details = item.get('contentDetails', {})
                
                # Parse duration
                duration_str = content_details.get('duration', 'PT0S')
                duration_seconds = self._parse_duration(duration_str)
                
                # Get best thumbnail
                thumbnails = snippet.get('thumbnails', {})
                thumbnail_url = (
                    thumbnails.get('maxres', {}).get('url') or
                    thumbnails.get('high', {}).get('url') or
                    thumbnails.get('medium', {}).get('url') or
                    ''
                )
                
                # Build metadata
                metadata = {
                    'tags': snippet.get('tags', [])[:20],
                    'category_id': snippet.get('categoryId'),
                    'comment_count': int(stats.get('commentCount', 0)),
                    'favorite_count': int(stats.get('favoriteCount', 0)),
                    'search_query': query,
                    'definition': content_details.get('definition', 'sd'),
                    'licensed_content': content_details.get('licensedContent', False),
                }
                
                item_obj = VideoItem(
                    youtube_id=video_id,
                    title=snippet.get('title', ''),
                    description=snippet.get('description', ''),
                    channel_name=snippet.get('channelTitle', ''),
                    channel_id=snippet.get('channelId', ''),
                    url=f'https://www.youtube.com/watch?v={video_id}',
                    thumbnail_url=thumbnail_url,
                    duration_seconds=duration_seconds,
                    view_count=int(stats.get('viewCount', 0)),
                    like_count=int(stats.get('likeCount', 0)),
                    published_at=snippet.get('publishedAt', ''),
                    topics=[query],
                    metadata=metadata,
                )
                
                yield item_obj
                
            except Exception as e:
                logger.error(f'Error parsing video item: {e}', exc_info=True)
                continue
    
    def _parse_duration(self, duration_str):
        """
        Parse ISO 8601 duration string to seconds.
        
        Examples:
            PT1H2M3S -> 3723
            PT5M30S -> 330
            PT30S -> 30
            PT0S -> 0
        
        Args:
            duration_str: ISO 8601 duration (e.g., 'PT1H2M3S')
            
        Returns:
            int: Duration in seconds
        """
        # Pattern: PT[n]H[n]M[n]S
        pattern = r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?'
        match = re.match(pattern, duration_str)
        
        if not match:
            return 0
        
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        
        return hours * 3600 + minutes * 60 + seconds
    
    def handle_error(self, failure):
        """
        Handle request failures gracefully.
        
        Args:
            failure: Twisted failure object
        """
        query = failure.request.meta.get('query', 'unknown')
        logger.error(
            f'Request failed for query "{query}": {failure.value}'
        )
