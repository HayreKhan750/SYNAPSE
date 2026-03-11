"""
ai_engine.agents.tools
~~~~~~~~~~~~~~~~~~~~~~
LangChain StructuredTool definitions for SYNAPSE ReAct agents.

Phase 5.1 — Agent Framework (Week 13)

Tools implemented:
  1. search_knowledge_base  — semantic search across pgvector collections
  2. fetch_articles         — retrieve articles from the SYNAPSE database
  3. analyze_trends         — technology trend analysis from stored data
  4. search_github          — GitHub trending repos via REST API
  5. fetch_arxiv_papers     — arXiv paper search via public API

Each tool:
  - Has a Pydantic input schema (StructuredTool)
  - Returns a plain string (agent-readable)
  - Has a 30-second timeout on external calls
  - Handles errors gracefully (returns error string, never raises)
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared HTTP timeout (seconds)
# ---------------------------------------------------------------------------
_HTTP_TIMEOUT = 30


# ===========================================================================
# 1. search_knowledge_base
# ===========================================================================

class SearchKnowledgeBaseInput(BaseModel):
    query: str = Field(..., description="Natural language search query")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum number of results to return")
    content_types: Optional[List[str]] = Field(
        default=None,
        description="Filter by content type: articles, papers, repositories, videos. Defaults to all.",
    )
    min_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Minimum similarity score (0–1)")


def _search_knowledge_base(
    query: str,
    limit: int = 10,
    content_types: Optional[List[str]] = None,
    min_score: float = 0.0,
) -> str:
    """Execute semantic search against the pgvector knowledge base."""
    try:
        from ai_engine.rag.retriever import SynapseRetriever

        retriever = SynapseRetriever(
            k=limit,
            score_threshold=min_score,
            content_types=content_types or ["articles", "papers", "repositories", "videos"],
        )
        docs = retriever.invoke(query)

        if not docs:
            return f"No results found for query: '{query}'"

        results = []
        for i, doc in enumerate(docs[:limit], 1):
            meta = doc.metadata
            title = meta.get("title") or meta.get("name") or "Untitled"
            url = meta.get("source") or meta.get("url") or ""
            ctype = meta.get("content_type", "document")
            score = meta.get("similarity_score", "N/A")
            snippet = doc.page_content[:300].strip()
            results.append(
                f"{i}. [{ctype.upper()}] {title}\n"
                f"   Score: {score}\n"
                f"   URL: {url}\n"
                f"   Snippet: {snippet}"
            )

        return f"Found {len(results)} results for '{query}':\n\n" + "\n\n".join(results)

    except Exception as exc:
        logger.error("search_knowledge_base failed: %s", exc)
        return f"Search failed: {exc}"


def make_search_knowledge_base_tool() -> StructuredTool:
    return StructuredTool.from_function(
        func=_search_knowledge_base,
        name="search_knowledge_base",
        description=(
            "Search the SYNAPSE knowledge base using semantic similarity. "
            "Use this tool to find relevant articles, research papers, GitHub repositories, "
            "or videos. Supports optional content type filtering and minimum relevance score."
        ),
        args_schema=SearchKnowledgeBaseInput,
        return_direct=False,
    )


# ===========================================================================
# 2. fetch_articles
# ===========================================================================

class FetchArticlesInput(BaseModel):
    topic: str = Field(..., description="Topic or keyword to search for in articles")
    days_back: int = Field(default=7, ge=1, le=365, description="How many days back to search")
    limit: int = Field(default=20, ge=1, le=100, description="Maximum articles to return")
    source: Optional[str] = Field(
        default=None,
        description="Filter by source name, e.g. 'hackernews', 'arxiv', 'github'",
    )


def _fetch_articles(
    topic: str,
    days_back: int = 7,
    limit: int = 20,
    source: Optional[str] = None,
) -> str:
    """Fetch articles from the SYNAPSE PostgreSQL database."""
    try:
        import django
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
        try:
            django.setup()
        except RuntimeError:
            pass  # already set up

        from django.utils import timezone
        from apps.articles.models import Article

        cutoff = timezone.now() - timedelta(days=days_back)
        qs = Article.objects.filter(
            created_at__gte=cutoff,
        ).order_by("-trending_score", "-created_at")

        if topic:
            from django.db.models import Q
            qs = qs.filter(
                Q(title__icontains=topic)
                | Q(summary__icontains=topic)
                | Q(topic__icontains=topic)
                | Q(keywords__icontains=topic)
            )

        if source:
            qs = qs.filter(source__icontains=source)

        articles = qs[:limit]

        if not articles.exists():
            return f"No articles found for topic '{topic}' in the last {days_back} days."

        results = []
        for i, a in enumerate(articles, 1):
            results.append(
                f"{i}. {a.title}\n"
                f"   Source: {a.source} | Topic: {a.topic} | Sentiment: {a.sentiment_score}\n"
                f"   Published: {a.created_at.strftime('%Y-%m-%d')}\n"
                f"   URL: {a.url}\n"
                f"   Summary: {(a.summary or a.content[:200]).strip()[:300]}"
            )

        return (
            f"Found {len(results)} articles for '{topic}' (last {days_back} days):\n\n"
            + "\n\n".join(results)
        )

    except Exception as exc:
        logger.error("fetch_articles failed: %s", exc)
        return f"Failed to fetch articles: {exc}"


def make_fetch_articles_tool() -> StructuredTool:
    return StructuredTool.from_function(
        func=_fetch_articles,
        name="fetch_articles",
        description=(
            "Retrieve articles from the SYNAPSE database filtered by topic and date range. "
            "Use this to get the latest news and articles on a specific technology, framework, "
            "or domain. Optionally filter by source (hackernews, arxiv, etc.)."
        ),
        args_schema=FetchArticlesInput,
        return_direct=False,
    )


# ===========================================================================
# 3. analyze_trends
# ===========================================================================

class AnalyzeTrendsInput(BaseModel):
    technologies: List[str] = Field(
        ...,
        description="List of technology names to analyze, e.g. ['Python', 'Rust', 'LLM']",
    )
    period_days: int = Field(
        default=30,
        ge=1,
        le=365,
        description="Analysis period in days",
    )


def _analyze_trends(
    technologies: List[str],
    period_days: int = 30,
) -> str:
    """Analyze technology trends from SYNAPSE database article and repository data."""
    try:
        import django
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
        try:
            django.setup()
        except RuntimeError:
            pass

        from django.utils import timezone
        from django.db.models import Count, Avg, Q
        from apps.articles.models import Article
        from apps.repositories.models import Repository

        cutoff = timezone.now() - timedelta(days=period_days)
        report_lines = [
            f"Technology Trend Analysis — last {period_days} days\n"
            f"{'=' * 50}"
        ]

        for tech in technologies:
            tech_q = Q(title__icontains=tech) | Q(keywords__icontains=tech) | Q(topic__icontains=tech)

            # Articles
            article_count = Article.objects.filter(tech_q, created_at__gte=cutoff).count()
            avg_sentiment = (
                Article.objects.filter(tech_q, created_at__gte=cutoff)
                .aggregate(avg=Avg("sentiment_score"))["avg"]
            ) or 0.0

            # Repositories
            repo_q = Q(name__icontains=tech) | Q(description__icontains=tech) | Q(topics__icontains=tech)
            repo_count = Repository.objects.filter(repo_q, created_at__gte=cutoff).count()
            top_repos = (
                Repository.objects.filter(repo_q)
                .order_by("-stars")[:3]
                .values_list("name", "stars")
            )
            top_repos_str = ", ".join(f"{n} (★{s})" for n, s in top_repos) or "None found"

            sentiment_label = (
                "Positive 📈" if avg_sentiment > 0.1
                else "Negative 📉" if avg_sentiment < -0.1
                else "Neutral ➡️"
            )

            report_lines.append(
                f"\n🔍 {tech}\n"
                f"   Articles:    {article_count}\n"
                f"   Repositories:{repo_count}\n"
                f"   Sentiment:   {sentiment_label} ({avg_sentiment:.3f})\n"
                f"   Top Repos:   {top_repos_str}"
            )

        return "\n".join(report_lines)

    except Exception as exc:
        logger.error("analyze_trends failed: %s", exc)
        return f"Trend analysis failed: {exc}"


def make_analyze_trends_tool() -> StructuredTool:
    return StructuredTool.from_function(
        func=_analyze_trends,
        name="analyze_trends",
        description=(
            "Analyze technology trends over a specified time period using SYNAPSE data. "
            "Returns article counts, repository counts, and sentiment scores for each technology. "
            "Great for identifying which technologies are gaining or losing traction."
        ),
        args_schema=AnalyzeTrendsInput,
        return_direct=False,
    )


# ===========================================================================
# 4. search_github
# ===========================================================================

class SearchGitHubInput(BaseModel):
    query: str = Field(..., description="Search query for GitHub repositories")
    language: Optional[str] = Field(default=None, description="Filter by programming language, e.g. 'Python', 'TypeScript'")
    stars_min: int = Field(default=100, ge=0, description="Minimum number of stars")
    limit: int = Field(default=10, ge=1, le=30, description="Maximum repositories to return")
    sort: str = Field(default="stars", description="Sort by: stars, forks, updated, best-match")


def _search_github(
    query: str,
    language: Optional[str] = None,
    stars_min: int = 100,
    limit: int = 10,
    sort: str = "stars",
) -> str:
    """Search GitHub repositories via the REST API v3."""
    try:
        github_token = os.environ.get("GITHUB_TOKEN", "")
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "SYNAPSE-Agent/1.0",
        }
        if github_token:
            headers["Authorization"] = f"token {github_token}"

        # Build query string
        q = query
        if language:
            q += f" language:{language}"
        if stars_min > 0:
            q += f" stars:>={stars_min}"

        params = {
            "q": q,
            "sort": sort,
            "order": "desc",
            "per_page": min(limit, 30),
        }

        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            resp = client.get("https://api.github.com/search/repositories", params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        items = data.get("items", [])
        total = data.get("total_count", 0)

        if not items:
            return f"No GitHub repositories found for query: '{query}'"

        results = []
        for i, repo in enumerate(items[:limit], 1):
            results.append(
                f"{i}. {repo['full_name']} (★{repo['stargazers_count']:,})\n"
                f"   Language: {repo.get('language') or 'N/A'} | Forks: {repo['forks_count']:,}\n"
                f"   URL: {repo['html_url']}\n"
                f"   Description: {(repo.get('description') or 'No description')[:200]}\n"
                f"   Updated: {repo['updated_at'][:10]}"
            )

        return (
            f"GitHub search for '{query}' — {total:,} total results, showing top {len(results)}:\n\n"
            + "\n\n".join(results)
        )

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 403:
            return "GitHub API rate limit reached. Please set GITHUB_TOKEN environment variable."
        return f"GitHub API error {exc.response.status_code}: {exc}"
    except Exception as exc:
        logger.error("search_github failed: %s", exc)
        return f"GitHub search failed: {exc}"


def make_search_github_tool() -> StructuredTool:
    return StructuredTool.from_function(
        func=_search_github,
        name="search_github",
        description=(
            "Search GitHub for repositories matching a query. "
            "Filter by programming language and minimum star count. "
            "Use this to discover trending projects, libraries, or frameworks on GitHub."
        ),
        args_schema=SearchGitHubInput,
        return_direct=False,
    )


# ===========================================================================
# 5. fetch_arxiv_papers
# ===========================================================================

class FetchArxivPapersInput(BaseModel):
    query: str = Field(..., description="Search query for arXiv papers (title, abstract, or keyword)")
    max_results: int = Field(default=10, ge=1, le=50, description="Maximum papers to return")
    categories: Optional[List[str]] = Field(
        default=None,
        description="arXiv category filters, e.g. ['cs.AI', 'cs.LG', 'stat.ML']",
    )
    sort_by: str = Field(
        default="relevance",
        description="Sort order: relevance, lastUpdatedDate, submittedDate",
    )


def _fetch_arxiv_papers(
    query: str,
    max_results: int = 10,
    categories: Optional[List[str]] = None,
    sort_by: str = "relevance",
) -> str:
    """Fetch research papers from arXiv via the public Atom API."""
    try:
        # Build search query
        search_query = query
        if categories:
            cat_filter = " OR ".join(f"cat:{c}" for c in categories)
            search_query = f"({query}) AND ({cat_filter})"

        params = {
            "search_query": f"all:{search_query}",
            "max_results": max_results,
            "sortBy": sort_by,
            "sortOrder": "descending",
        }

        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            resp = client.get("https://export.arxiv.org/api/query", params=params)
            resp.raise_for_status()
            content = resp.text

        # Parse Atom XML
        import xml.etree.ElementTree as ET
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        root = ET.fromstring(content)
        entries = root.findall("atom:entry", ns)

        if not entries:
            return f"No arXiv papers found for query: '{query}'"

        results = []
        for i, entry in enumerate(entries[:max_results], 1):
            title_el = entry.find("atom:title", ns)
            summary_el = entry.find("atom:summary", ns)
            published_el = entry.find("atom:published", ns)
            id_el = entry.find("atom:id", ns)
            authors = entry.findall("atom:author", ns)

            title = (title_el.text or "").strip().replace("\n", " ")
            summary = (summary_el.text or "").strip().replace("\n", " ")[:300]
            published = (published_el.text or "")[:10]
            paper_id = (id_el.text or "").strip()
            author_names = [
                (a.find("atom:name", ns).text or "")
                for a in authors[:3]
            ]
            author_str = ", ".join(author_names)
            if len(authors) > 3:
                author_str += f" et al. (+{len(authors) - 3})"

            categories_els = entry.findall("atom:category", ns)
            cats = [c.attrib.get("term", "") for c in categories_els[:3]]

            results.append(
                f"{i}. {title}\n"
                f"   Authors: {author_str}\n"
                f"   Categories: {', '.join(cats)}\n"
                f"   Published: {published}\n"
                f"   URL: {paper_id}\n"
                f"   Abstract: {summary}..."
            )

        return (
            f"arXiv papers for '{query}' — showing {len(results)} results:\n\n"
            + "\n\n".join(results)
        )

    except Exception as exc:
        logger.error("fetch_arxiv_papers failed: %s", exc)
        return f"arXiv fetch failed: {exc}"


def make_fetch_arxiv_papers_tool() -> StructuredTool:
    return StructuredTool.from_function(
        func=_fetch_arxiv_papers,
        name="fetch_arxiv_papers",
        description=(
            "Search and fetch research papers from arXiv using the public API. "
            "Filter by category (e.g. cs.AI, cs.LG) and sort by relevance or date. "
            "Use this for academic research, literature reviews, or finding the latest AI/ML papers."
        ),
        args_schema=FetchArxivPapersInput,
        return_direct=False,
    )
