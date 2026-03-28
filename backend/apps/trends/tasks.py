"""
backend.apps.trends.tasks
~~~~~~~~~~~~~~~~~~~~~~~~~
Celery task that mines article and repository data to populate the
TechnologyTrend model with daily mention counts and trend scores.

Runs daily (configured in Celery Beat).

Phase 2.4 / Phase 9 — Technology Trend Analysis
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Dict, List

from celery import shared_task
from django.db.models import Avg, Count, Q
from django.utils import timezone

logger = logging.getLogger(__name__)

# Technologies to track — extend this list as needed
TRACKED_TECHNOLOGIES: List[str] = [
    # Languages
    "Python", "Rust", "Go", "TypeScript", "JavaScript", "Java", "C++", "Swift", "Kotlin", "Ruby",
    # AI / ML
    "LLM", "GPT", "Claude", "Gemini", "LangChain", "LangGraph", "RAG", "Vector Search",
    "Transformer", "Diffusion", "Reinforcement Learning", "Fine-tuning", "RLHF",
    # Frameworks & tools
    "PyTorch", "TensorFlow", "JAX", "FastAPI", "Django", "React", "Next.js", "Vue",
    "Docker", "Kubernetes", "Terraform", "GitHub Actions", "PostgreSQL", "Redis",
    # Trends
    "Open Source", "Edge AI", "WebAssembly", "GraphQL", "Serverless", "DevSecOps",
]

# Weights for scoring
_ARTICLE_WEIGHT = 1.0
_REPO_WEIGHT = 2.0          # repos are higher-signal than articles
_SENTIMENT_BONUS = 5.0       # added when avg sentiment is positive


def _score_technology(tech: str, since: date) -> Dict:
    """
    Compute mention count and trend score for a single technology.

    Searches article titles/keywords/topics and repository names/descriptions/topics
    to count how many times the technology appeared in the given period.
    """
    from apps.articles.models import Article
    from apps.repositories.models import Repository

    tech_q_article = (
        Q(title__icontains=tech)
        | Q(keywords__icontains=tech)
        | Q(topic__icontains=tech)
        | Q(summary__icontains=tech)
    )
    tech_q_repo = (
        Q(name__icontains=tech)
        | Q(description__icontains=tech)
        | Q(topics__icontains=tech)
    )

    since_dt = timezone.make_aware(
        timezone.datetime.combine(since, timezone.datetime.min.time())
    )

    article_qs = Article.objects.filter(tech_q_article, scraped_at__date__gte=since)
    article_count = article_qs.count()
    avg_sentiment = article_qs.aggregate(avg=Avg("sentiment_score"))["avg"] or 0.0

    repo_count = Repository.objects.filter(tech_q_repo, scraped_at__date__gte=since).count()

    mention_count = article_count + repo_count
    trend_score = (
        article_count * _ARTICLE_WEIGHT
        + repo_count * _REPO_WEIGHT
        + (_SENTIMENT_BONUS if avg_sentiment > 0.1 else 0.0)
    )

    return {
        "mention_count": mention_count,
        "trend_score": round(trend_score, 2),
        "sources": _build_source_list(article_count, repo_count),
    }


def _build_source_list(article_count: int, repo_count: int) -> List[str]:
    sources = []
    if article_count > 0:
        sources.append("articles")
    if repo_count > 0:
        sources.append("repositories")
    return sources


def _infer_category(tech: str) -> str:
    """Map a technology name to a broad category for filtering."""
    lang = {"Python", "Rust", "Go", "TypeScript", "JavaScript", "Java", "C++", "Swift", "Kotlin", "Ruby"}
    ai = {"LLM", "GPT", "Claude", "Gemini", "LangChain", "LangGraph", "RAG", "Vector Search",
          "Transformer", "Diffusion", "Reinforcement Learning", "Fine-tuning", "RLHF",
          "PyTorch", "TensorFlow", "JAX"}
    devops = {"Docker", "Kubernetes", "Terraform", "GitHub Actions", "PostgreSQL", "Redis", "DevSecOps", "Serverless"}
    web = {"FastAPI", "Django", "React", "Next.js", "Vue", "GraphQL", "WebAssembly"}

    if tech in lang:
        return "language"
    if tech in ai:
        return "ai_ml"
    if tech in devops:
        return "devops"
    if tech in web:
        return "web"
    return "general"


@shared_task(
    name="apps.trends.tasks.analyze_trends_task",
    queue="default",
    max_retries=2,
    default_retry_delay=60,
)
def analyze_trends_task(
    technologies: List[str] | None = None,
    days_back: int = 1,
    target_date: str | None = None,
) -> Dict:
    """
    Mine article & repository data to populate TechnologyTrend for today.

    Args:
        technologies: List of technology names to analyze.
                      Defaults to TRACKED_TECHNOLOGIES.
        days_back:    How many days back to count mentions (default: 1 = today).
        target_date:  ISO date string (YYYY-MM-DD) for the trend record.
                      Defaults to today.

    Returns:
        Dict with summary: { created, updated, skipped, errors }
    """
    from apps.trends.models import TechnologyTrend

    techs = technologies or TRACKED_TECHNOLOGIES
    if target_date:
        trend_date = date.fromisoformat(target_date)
    else:
        trend_date = date.today()

    since = trend_date - timedelta(days=days_back - 1)

    logger.info(
        "analyze_trends_task: scoring %d technologies for date=%s (since=%s)",
        len(techs), trend_date, since,
    )

    created = updated = skipped = errors = 0

    for tech in techs:
        try:
            scores = _score_technology(tech, since)

            if scores["mention_count"] == 0:
                skipped += 1
                continue

            obj, was_created = TechnologyTrend.objects.update_or_create(
                technology_name=tech,
                date=trend_date,
                defaults={
                    "mention_count": scores["mention_count"],
                    "trend_score": scores["trend_score"],
                    "category": _infer_category(tech),
                    "sources": scores["sources"],
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        except Exception as exc:
            logger.error("analyze_trends_task: error scoring '%s': %s", tech, exc)
            errors += 1

    summary = {
        "date": str(trend_date),
        "technologies_analyzed": len(techs),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
    }
    logger.info("analyze_trends_task complete: %s", summary)
    return summary
