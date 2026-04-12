"""
GitHub Spider for SYNAPSE
Scrapes trending GitHub repositories using the GitHub REST API v3.
Searches for repositories by push date, language filters, and star count.
Respects GitHub API rate limits (60 req/hr without auth, 5000 req/hr with token).
"""

import os
import logging
from datetime import datetime, timedelta
from urllib.parse import urljoin
import scrapy
from scrapy import signals

logger = logging.getLogger(__name__)


class RepositoryItem(scrapy.Item):
    """GitHub repository item"""
    github_id = scrapy.Field()
    name = scrapy.Field()
    full_name = scrapy.Field()
    description = scrapy.Field()
    url = scrapy.Field()
    clone_url = scrapy.Field()
    stars = scrapy.Field()
    forks = scrapy.Field()
    watchers = scrapy.Field()
    open_issues = scrapy.Field()
    language = scrapy.Field()
    topics = scrapy.Field()
    owner = scrapy.Field()
    stars_today = scrapy.Field()
    is_trending = scrapy.Field()
    repo_created_at = scrapy.Field()
    metadata = scrapy.Field()


class GitHubSpider(scrapy.Spider):
    """
    Spider for scraping GitHub repositories from the GitHub REST API v3.
    
    Usage:
        scrapy crawl github -a days_back=7 -a language=Python -a limit=500
    """

    name = "github"
    allowed_domains = ["api.github.com"]

    custom_settings = {
        "DOWNLOAD_DELAY": 1.0,
        "ROBOTSTXT_OBEY": False,
        "CONCURRENT_REQUESTS": 2,
    }

    # Default AI/ML tech languages to scrape
    DEFAULT_LANGUAGES = ["Python", "JavaScript", "TypeScript", "Rust", "Go"]

    def __init__(self, days_back=1, language=None, limit=100, *args, **kwargs):
        """
        Initialize the spider.
        
        Args:
            days_back (int): Number of days back to search for pushed repositories. Default: 1
            language (str): Programming language to filter by. If None, search all DEFAULT_LANGUAGES.
            limit (int): Maximum number of items to scrape. Default: 100
        """
        super(GitHubSpider, self).__init__(*args, **kwargs)
        self.days_back = int(days_back)
        self.language = language
        self.limit = int(limit)
        self.items_scraped = 0
        self.rate_limit_remaining = None
        
        # Store user_id for personalization
        self.user_id = kwargs.get('user_id')

        # Check for GitHub token
        self.github_token = os.environ.get("GITHUB_TOKEN")
        if not self.github_token:
            logger.warning(
                "GITHUB_TOKEN not set. API limit: 60 requests/hour. "
                "Set GITHUB_TOKEN env var for 5000 requests/hour."
            )

    def start_requests(self):
        """Generate initial requests to search repositories."""
        # Determine languages to search
        languages = [self.language] if self.language else self.DEFAULT_LANGUAGES

        # Calculate push date (repositories pushed after this date)
        push_date = (datetime.utcnow() - timedelta(days=self.days_back)).strftime(
            "%Y-%m-%d"
        )

        for lang in languages:
            query = f"pushed:>={push_date} language:{lang}"
            url = f"https://api.github.com/search/repositories?q={query}&sort=stars&order=desc&per_page=100"

            logger.info(f"Starting search for language: {lang}")
            yield scrapy.Request(
                url,
                callback=self.parse,
                headers=self._headers(),
                errback=self.handle_error,
                meta={"language": lang, "page": 1},
            )

    def parse(self, response):
        """
        Parse search results and extract repository items.
        
        Handles pagination via Link header.
        """
        if response.status in [403, 422]:
            logger.error(
                f"API returned {response.status} for {response.url}. "
                "Check rate limits or query validity."
            )
            return

        # Update rate limit info
        self.rate_limit_remaining = int(
            response.headers.get("X-RateLimit-Remaining", 0)
        )
        if self.rate_limit_remaining == 0:
            logger.error(
                "GitHub API rate limit exceeded. Stopping spider. "
                "Remaining requests: 0"
            )
            self.crawler.engine.close_spider(self, "rate_limit_exceeded")
            return

        try:
            data = response.json()
        except Exception as e:
            logger.error(f"Failed to parse JSON from {response.url}: {e}")
            return

        items = data.get("items", [])
        logger.info(
            f"Processing {len(items)} repositories from {response.url} "
            f"(Rate limit remaining: {self.rate_limit_remaining})"
        )

        for repo in items:
            if self.items_scraped >= self.limit:
                logger.info(f"Reached item limit ({self.limit}). Stopping.")
                self.crawler.engine.close_spider(self, "limit_reached")
                return

            item = self._make_repo_item(repo)
            self.items_scraped += 1
            yield item

        # Check for next page via Link header
        link_header = response.headers.get("Link")
        if link_header and self.items_scraped < self.limit:
            next_url = self._parse_link_header(link_header, "next")
            if next_url:
                yield scrapy.Request(
                    next_url,
                    callback=self.parse,
                    headers=self._headers(),
                    errback=self.handle_error,
                    meta=response.meta,
                )

    def _make_repo_item(self, repo_data):
        """
        Build a RepositoryItem from GitHub API response JSON.
        
        Args:
            repo_data (dict): Repository data from GitHub API
            
        Returns:
            RepositoryItem: Processed repository item
        """
        item = RepositoryItem()

        item["github_id"] = repo_data.get("id")
        item["name"] = repo_data.get("name")
        item["full_name"] = repo_data.get("full_name")
        item["description"] = repo_data.get("description", "")
        item["url"] = repo_data.get("html_url")
        item["clone_url"] = repo_data.get("clone_url")
        item["stars"] = repo_data.get("stargazers_count", 0)
        item["forks"] = repo_data.get("forks_count", 0)
        item["watchers"] = repo_data.get("watchers_count", 0)
        item["open_issues"] = repo_data.get("open_issues_count", 0)
        item["language"] = repo_data.get("language")
        item["topics"] = repo_data.get("topics", [])
        item["owner"] = repo_data.get("owner", {}).get("login")
        item["repo_created_at"] = repo_data.get("created_at")

        # Calculate is_trending (basic heuristic: high stars + recent activity)
        stars = repo_data.get("stargazers_count", 0)
        item["is_trending"] = stars >= 100

        # Calculate stars_today (approximation based on available data)
        item["stars_today"] = 0

        # Build metadata dictionary
        item["metadata"] = {
            "pushed_at": repo_data.get("pushed_at"),
            "default_branch": repo_data.get("default_branch"),
            "license": repo_data.get("license", {}).get("spdx_id") if repo_data.get("license") else None,
            "archived": repo_data.get("archived", False),
            "fork": repo_data.get("fork", False),
            "size": repo_data.get("size", 0),
            "network_count": repo_data.get("network_count", 0),
            "subscribers_count": repo_data.get("subscribers_count", 0),
        }

        return item

    def _parse_link_header(self, link_header, rel):
        """
        Parse the Link header to find the URL for a specific rel value.
        
        Args:
            link_header (str): Link header value
            rel (str): Relationship type (e.g., 'next', 'last')
            
        Returns:
            str or None: URL for the specified relationship
        """
        links = link_header.split(",")
        for link in links:
            parts = link.split(";")
            if len(parts) == 2:
                url = parts[0].strip()[1:-1]  # Remove < and >
                if f'rel="{rel}"' in parts[1]:
                    return url
        return None

    def _headers(self):
        """
        Return proper headers for GitHub API requests.
        
        Returns:
            dict: Headers with Accept and Authorization
        """
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "SYNAPSE-Bot/1.0",
        }
        if self.github_token:
            headers["Authorization"] = f"token {self.github_token}"
        return headers

    def handle_error(self, failure):
        """
        Handle request errors gracefully.
        
        Args:
            failure: Twisted Failure object
        """
        logger.error(f"Request failed: {failure.request.url}")
        logger.error(f"Error: {failure.value}")
