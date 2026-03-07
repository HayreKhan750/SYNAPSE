"""
Deduplication Pipeline for SYNAPSE
Uses Redis to track and eliminate duplicate items across scraping runs.
Gracefully degrades if Redis is unavailable.
"""

import logging
import hashlib
import redis
from scrapy.exceptions import DropItem

logger = logging.getLogger(__name__)


class DeduplicationPipeline:
    """
    Deduplicates items using Redis key-value store.
    
    - ArticleItem: deduplicates on SHA-256 hash of URL
    - RepositoryItem: deduplicates on github_id
    - ResearchPaperItem: deduplicates on arxiv_id
    - VideoItem: deduplicates on youtube_id
    
    Gracefully handles Redis unavailability by passing items through.
    """

    # Redis key prefixes for different item types
    REDIS_KEYS = {
        "ArticleItem": "synapse:seen_urls",
        "RepositoryItem": "synapse:seen_github_ids",
        "ResearchPaperItem": "synapse:seen_arxiv_ids",
        "VideoItem": "synapse:seen_youtube_ids",
    }

    # Field to deduplicate on for each item type
    DEDUP_FIELDS = {
        "ArticleItem": "url",
        "RepositoryItem": "github_id",
        "ResearchPaperItem": "arxiv_id",
        "VideoItem": "youtube_id",
    }

    def __init__(self):
        """Initialize the pipeline."""
        self.redis_client = None
        self.redis_available = False

    def open_spider(self, spider):
        """
        Initialize Redis connection when spider opens.
        
        Args:
            spider: Spider instance
        """
        try:
            # Get Redis URL from Scrapy settings
            redis_url = spider.settings.get(
                "REDIS_URL", "redis://localhost:6379/0"
            )
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            self.redis_client.ping()
            self.redis_available = True
            logger.info(f"Connected to Redis at {redis_url}")
        except Exception as e:
            self.redis_available = False
            logger.warning(
                f"Failed to connect to Redis: {e}. "
                "Deduplication disabled - will process all items."
            )

    def close_spider(self, spider):
        """
        Clean up Redis connection when spider closes.
        
        Args:
            spider: Spider instance
        """
        if self.redis_client:
            try:
                self.redis_client.close()
                logger.info("Closed Redis connection")
            except Exception as e:
                logger.error(f"Error closing Redis connection: {e}")

    def process_item(self, item, spider):
        """
        Process an item, checking for duplicates.
        
        Args:
            item: Scrapy item to check
            spider: Spider instance
            
        Returns:
            item: Passed through if unique
            
        Raises:
            DropItem: If item is a duplicate
        """
        if not self.redis_available:
            # Redis unavailable - pass through
            return item

        item_type = item.__class__.__name__
        redis_key = self.REDIS_KEYS.get(item_type)
        dedup_field = self.DEDUP_FIELDS.get(item_type)

        if not redis_key or not dedup_field:
            # Unknown item type - pass through
            return item

        if dedup_field not in item:
            logger.warning(f"Missing dedup field '{dedup_field}' in {item_type}")
            return item

        # Get the value to deduplicate on
        dedup_value = item[dedup_field]

        # For URLs, hash them; for IDs, use as-is
        if dedup_field == "url":
            dedup_key = hashlib.sha256(dedup_value.encode()).hexdigest()
        else:
            dedup_key = str(dedup_value)

        try:
            # Check if we've seen this before
            if self.redis_client.sismember(redis_key, dedup_key):
                raise DropItem(
                    f"Duplicate {item_type} ({dedup_field}={dedup_value}) "
                    f"from {spider.name}"
                )

            # Add to seen set
            self.redis_client.sadd(redis_key, dedup_key)
            logger.debug(f"New {item_type} ({dedup_field}={dedup_value})")
            return item

        except redis.RedisError as e:
            logger.error(f"Redis error during deduplication: {e}")
            # Degrade gracefully - pass item through
            return item
