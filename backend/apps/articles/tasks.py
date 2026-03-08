"""
Celery tasks for NLP processing of articles.

Phase 2.1 — NLP Processing Pipeline
Implements process_article_nlp task that:
  1. Cleans text
  2. Detects language
  3. Extracts keywords (KeyBERT + YAKE)
  4. Classifies topic (zero-shot BART)
  5. Analyses sentiment (RoBERTa)
  6. Runs Named Entity Recognition (spaCy)

Also provides process_pending_articles_nlp for batch reprocessing.
"""
import logging
import sys
import os
import time
from typing import Dict, Optional

from celery import shared_task

logger = logging.getLogger(__name__)


def _run_nlp(text: str, title: str = "") -> Optional[object]:
    """
    Import and run the NLP pipeline.  Handles import errors gracefully so
    that the Django/Celery process does not crash when heavy ML dependencies
    are absent from the backend virtualenv.
    """
    try:
        # Add the project root to sys.path so ai_engine is importable from
        # within the backend Celery worker.
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
        if project_root not in sys.path:
            sys.path.insert(0, project_root)

        from ai_engine.nlp.pipeline import run_pipeline  # noqa: PLC0415
        return run_pipeline(text=text, title=title)
    except ImportError as exc:
        logger.error("NLP pipeline import failed (is ai_engine on PYTHONPATH?): %s", exc)
        return None
    except Exception as exc:
        logger.error("NLP pipeline execution error: %s", exc)
        return None


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="nlp",
    name="apps.articles.tasks.process_article_nlp",
)
def process_article_nlp(self, article_id: str) -> Dict:
    """
    Run the full NLP pipeline on a single article and persist results.

    Steps:
      1. Fetch Article from DB
      2. Run ai_engine NLP pipeline (clean → lang → keywords → topic → sentiment → NER)
      3. Persist keywords, topic, sentiment_score and nlp_processed flag

    Args:
        article_id: UUID string of the Article to process.

    Returns:
        Dict with processing status and extracted fields.
    """
    task_id = self.request.id
    logger.info("[%s] Starting NLP for article: %s", task_id, article_id)
    start_time = time.time()

    try:
        from apps.articles.models import Article  # noqa: PLC0415

        try:
            article = Article.objects.get(pk=article_id)
        except Article.DoesNotExist:
            logger.error("[%s] Article %s not found.", task_id, article_id)
            return {"status": "error", "reason": "article_not_found", "article_id": article_id}

        # Build the text to analyse
        text = article.content or ""
        title = article.title or ""

        if not text and not title:
            logger.warning("[%s] Article %s has no text content.", task_id, article_id)
            return {"status": "skipped", "reason": "no_content", "article_id": article_id}

        # Run the NLP pipeline
        result = _run_nlp(text=text, title=title)

        if result is None:
            logger.error("[%s] NLP pipeline returned None for article %s.", task_id, article_id)
            return {"status": "error", "reason": "pipeline_failed", "article_id": article_id}

        if result.skipped:
            logger.info(
                "[%s] Article %s skipped: %s", task_id, article_id, result.skip_reason
            )
            return {
                "status": "skipped",
                "reason": result.skip_reason,
                "article_id": article_id,
            }

        # Persist extracted fields
        update_fields = ["updated_at"]

        if result.keywords:
            article.keywords = result.keywords
            update_fields.append("keywords")

        if result.topic:
            article.topic = result.topic
            update_fields.append("topic")

        if result.sentiment_score is not None:
            article.sentiment_score = result.sentiment_score
            update_fields.append("sentiment_score")

        # Store NER entities in metadata JSON field
        if result.entities:
            if not isinstance(article.metadata, dict):
                article.metadata = {}
            article.metadata["entities"] = result.entities
            article.metadata["language"] = result.language
            article.metadata["topic_confidence"] = result.topic_confidence
            update_fields.append("metadata")

        # Mark NLP as processed
        article.nlp_processed = True
        update_fields.append("nlp_processed")

        article.save(update_fields=update_fields)

        elapsed = round(time.time() - start_time, 2)
        logger.info(
            "[%s] NLP complete for article %s in %.2fs — "
            "topic=%s, sentiment=%.4f, keywords=%d",
            task_id, article_id, elapsed,
            result.topic, result.sentiment_score or 0.0, len(result.keywords),
        )

        return {
            "status": "success",
            "article_id": article_id,
            "topic": result.topic,
            "sentiment_score": result.sentiment_score,
            "keywords": result.keywords,
            "entities_count": len(result.entities),
            "elapsed_seconds": elapsed,
        }

    except Exception as exc:
        logger.error("[%s] Unexpected error processing article %s: %s", task_id, article_id, exc)
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(
    bind=True,
    max_retries=1,
    queue="nlp",
    name="apps.articles.tasks.process_pending_articles_nlp",
)
def process_pending_articles_nlp(self, batch_size: int = 50) -> Dict:
    """
    Queue NLP processing for articles that have not been processed yet.

    Fetches up to *batch_size* articles where ``nlp_processed=False`` and
    dispatches individual :func:`process_article_nlp` tasks for each.

    Args:
        batch_size: Maximum number of articles to enqueue (default 50).

    Returns:
        Dict summarising how many tasks were queued.
    """
    task_id = self.request.id
    logger.info("[%s] Queuing NLP for pending articles (batch_size=%d)", task_id, batch_size)

    try:
        from apps.articles.models import Article  # noqa: PLC0415

        pending = Article.objects.filter(
            nlp_processed=False
        ).values_list("id", flat=True)[:batch_size]

        queued = 0
        for article_id in pending:
            process_article_nlp.delay(str(article_id))
            queued += 1

        logger.info("[%s] Queued %d NLP tasks.", task_id, queued)
        return {"status": "success", "queued": queued}

    except Exception as exc:
        logger.error("[%s] process_pending_articles_nlp failed: %s", task_id, exc)
        raise self.retry(exc=exc, countdown=120)
