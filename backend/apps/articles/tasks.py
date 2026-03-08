"""
Celery tasks for NLP processing of articles.

Phase 2.1 — NLP Processing Pipeline
Phase 2.2 — Article Summarization (BART auto-run after scraping)

Tasks:
  process_article_nlp           — Full pipeline: clean → lang → keywords →
                                   topic → sentiment → NER → summary (BART)
  process_pending_articles_nlp  — Batch-queue unprocessed articles
  summarize_article             — Standalone BART summarization task
"""
import logging
import sys
import os
import time
from typing import Dict, Optional

from celery import shared_task

logger = logging.getLogger(__name__)


def _summarize_with_gemini(text: str, max_chars: int = 8000) -> Optional[str]:
    """
    Summarize text using Google Gemini 1.5 Flash.
    Returns None if GOOGLE_API_KEY is not set or the call fails.
    """
    import os
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key.startswith("your-"):
        return None
    try:
        import sys
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
        if project_root not in sys.path:
            sys.path.insert(0, project_root)
        from langchain_google_genai import ChatGoogleGenerativeAI  # noqa: PLC0415
        from langchain_core.messages import HumanMessage  # noqa: PLC0415

        llm = ChatGoogleGenerativeAI(
            model=os.environ.get("GEMINI_MODEL","gemini-2.0-flash"),
            temperature=0.2,
            max_output_tokens=300,
            google_api_key=api_key,
        )
        prompt = (
            "You are a technical summarizer. Write a concise 2-3 sentence summary "
            "of the following article, focusing on the key findings and takeaways.\n\n"
            f"Article:\n{text[:max_chars]}\n\nSummary:"
        )
        result = llm.invoke([HumanMessage(content=prompt)])
        summary = result.content.strip() if hasattr(result, "content") else ""
        return summary or None
    except Exception as exc:
        logger.warning("Gemini summarization failed: %s", exc)
        return None


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

        # Phase 2.2 — Persist BART-generated summary.
        # Only overwrite if the article does not already have a human-supplied
        # summary (scraped/imported) so we don't destroy richer content.
        if result.summary and not article.summary:
            article.summary = result.summary
            update_fields.append("summary")

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
            "topic=%s, sentiment=%.4f, keywords=%d, summary=%s",
            task_id, article_id, elapsed,
            result.topic, result.sentiment_score or 0.0, len(result.keywords),
            "yes" if result.summary else "no",
        )

        return {
            "status": "success",
            "article_id": article_id,
            "topic": result.topic,
            "sentiment_score": result.sentiment_score,
            "keywords": result.keywords,
            "entities_count": len(result.entities),
            "summary_generated": bool(result.summary),
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


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="nlp",
    name="apps.articles.tasks.summarize_article",
)
def summarize_article(self, article_id: str, force: bool = False) -> Dict:
    """
    Phase 2.2 — Standalone BART summarization task.

    Generates an abstractive summary for a single article using
    ``facebook/bart-large-cnn`` and persists it to ``Article.summary``.

    This task can be called independently (e.g. for re-summarization or
    when only summarization is needed without the full NLP pipeline).

    Args:
        article_id: UUID string of the Article to summarize.
        force:      If True, overwrite an existing summary. Default False.

    Returns:
        Dict with status and summary metadata.
    """
    task_id = self.request.id
    logger.info("[%s] Starting BART summarization for article: %s", task_id, article_id)
    start_time = time.time()

    try:
        from apps.articles.models import Article  # noqa: PLC0415

        try:
            article = Article.objects.get(pk=article_id)
        except Article.DoesNotExist:
            logger.error("[%s] Article %s not found.", task_id, article_id)
            return {"status": "error", "reason": "article_not_found", "article_id": article_id}

        # Skip if already has a summary and force is not set
        if article.summary and not force:
            logger.info(
                "[%s] Article %s already has summary; skipping (use force=True to overwrite).",
                task_id, article_id,
            )
            return {"status": "skipped", "reason": "already_summarized", "article_id": article_id}

        text = article.content or ""
        if not text:
            logger.warning("[%s] Article %s has no content to summarize.", task_id, article_id)
            return {"status": "skipped", "reason": "no_content", "article_id": article_id}

        # Import summarizer — tries Gemini first, falls back to BART
        try:
            project_root = os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            )
            if project_root not in sys.path:
                sys.path.insert(0, project_root)
            from ai_engine.nlp.summarizer import summarize  # noqa: PLC0415
        except ImportError as exc:
            logger.error("[%s] summarizer import failed: %s", task_id, exc)
            return {"status": "error", "reason": "import_failed", "article_id": article_id}

        summary = _summarize_with_gemini(text) or summarize(text)

        if not summary:
            logger.warning("[%s] BART returned no summary for article %s.", task_id, article_id)
            return {"status": "error", "reason": "empty_summary", "article_id": article_id}

        article.summary = summary
        article.save(update_fields=["summary", "updated_at"])

        elapsed = round(time.time() - start_time, 2)
        logger.info(
            "[%s] Summary generated for article %s in %.2fs (%d chars).",
            task_id, article_id, elapsed, len(summary),
        )

        return {
            "status": "success",
            "article_id": article_id,
            "summary_length": len(summary),
            "elapsed_seconds": elapsed,
        }

    except Exception as exc:
        logger.error("[%s] Unexpected error summarizing article %s: %s", task_id, article_id, exc)
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(
    bind=True,
    max_retries=1,
    queue="nlp",
    name="apps.articles.tasks.summarize_pending_articles",
)
def summarize_pending_articles(self, batch_size: int = 20) -> Dict:
    """
    Phase 2.2 — Queue BART summarization for articles without a summary.

    Fetches up to *batch_size* articles that have been NLP-processed but
    still lack a summary, and dispatches :func:`summarize_article` tasks.

    Articles that were already processed by the full NLP pipeline (which
    includes summarization) will typically already have a summary.  This
    task handles edge cases: very old articles imported before Phase 2.2,
    or articles whose summarization failed transiently.

    Args:
        batch_size: Maximum number of articles to enqueue (default 20).

    Returns:
        Dict summarising how many tasks were queued.
    """
    task_id = self.request.id
    logger.info(
        "[%s] Queuing summarization for articles without summary (batch_size=%d)",
        task_id, batch_size,
    )

    try:
        from apps.articles.models import Article  # noqa: PLC0415

        # Target articles that are NLP-processed but lack a summary
        pending = Article.objects.filter(
            summary=""
        ).values_list("id", flat=True)[:batch_size]

        queued = 0
        for article_id in pending:
            summarize_article.delay(str(article_id))
            queued += 1

        logger.info("[%s] Queued %d summarization tasks.", task_id, queued)
        return {"status": "success", "queued": queued}

    except Exception as exc:
        logger.error("[%s] summarize_pending_articles failed: %s", task_id, exc)
        raise self.retry(exc=exc, countdown=120)
