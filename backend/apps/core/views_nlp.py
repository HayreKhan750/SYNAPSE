"""
NLP / AI on-demand API views for SYNAPSE.

Phase 2.1 — NLP Processing Pipeline
Phase 2.3 — Vector Embeddings (trigger embedding generation for individual items)

Endpoints:
  POST /api/v1/ai/summarize              — Summarise arbitrary text on demand
  POST /api/v1/ai/nlp                    — Run full NLP pipeline on arbitrary text
  POST /api/v1/ai/process/{id}           — Trigger NLP for a specific article
  POST /api/v1/ai/embed/article/{id}     — Trigger embedding for a specific article
  POST /api/v1/ai/embed/paper/{id}       — Trigger embedding for a specific paper
  POST /api/v1/ai/embed/repo/{id}        — Trigger embedding for a specific repository
  POST /api/v1/ai/embed/video/{id}       — Trigger embedding for a specific video
  POST /api/v1/ai/embed/batch/           — Trigger batch embedding for all pending items
"""
import logging
import sys
import os

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def _ensure_ai_engine_path():
    """Add project root to sys.path so ai_engine is importable."""
    project_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
    if project_root not in sys.path:
        sys.path.insert(0, project_root)


# ── Summarize on demand ───────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([AllowAny])
def summarize_text(request):
    """
    Summarise arbitrary text using facebook/bart-large-cnn.

    Request body (JSON):
        text        (str, required)  — The text to summarise.
        max_length  (int, optional)  — Max summary tokens (default 150).
        min_length  (int, optional)  — Min summary tokens (default 50).

    Response (200):
        {
          "success": true,
          "data": {
            "summary": "...",
            "original_word_count": 320,
            "summary_word_count": 45
          }
        }
    """
    text = request.data.get("text", "").strip()
    if not text:
        return Response(
            {"success": False, "error": {"message": "Field 'text' is required."}},
            status=status.HTTP_400_BAD_REQUEST,
        )

    max_length = int(request.data.get("max_length", 150))
    min_length = int(request.data.get("min_length", 50))

    try:
        _ensure_ai_engine_path()
        from ai_engine.nlp.cleaner import clean_text       # noqa: PLC0415
        from ai_engine.nlp.summarizer import summarize     # noqa: PLC0415

        clean = clean_text(text, strip_html=True)
        summary = summarize(clean, max_length=max_length, min_length=min_length)

        if summary is None:
            return Response(
                {"success": False, "error": {"message": "Summarisation model unavailable."}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({
            "success": True,
            "data": {
                "summary": summary,
                "original_word_count": len(clean.split()),
                "summary_word_count": len(summary.split()),
            },
        })

    except ImportError as exc:
        logger.error("ai_engine import failed: %s", exc)
        return Response(
            {"success": False, "error": {"message": "NLP service not available."}},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except Exception as exc:
        logger.error("summarize_text error: %s", exc)
        return Response(
            {"success": False, "error": {"message": "Summarisation failed.", "detail": str(exc)}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ── Full NLP pipeline on demand ───────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([AllowAny])
def analyze_text(request):
    """
    Run the full NLP pipeline on arbitrary text.

    Request body (JSON):
        text   (str, required) — The text to analyse.
        title  (str, optional) — Optional title for richer context.

    Response (200):
        {
          "success": true,
          "data": {
            "language": "en",
            "keywords": ["machine learning", ...],
            "topic": "Machine Learning",
            "topic_confidence": 0.87,
            "sentiment_label": "POSITIVE",
            "sentiment_score": 0.92,
            "entities": [{"text": "OpenAI", "label": "ORG"}, ...]
          }
        }
    """
    text = request.data.get("text", "").strip()
    if not text:
        return Response(
            {"success": False, "error": {"message": "Field 'text' is required."}},
            status=status.HTTP_400_BAD_REQUEST,
        )

    title = request.data.get("title", "").strip()

    try:
        _ensure_ai_engine_path()
        from ai_engine.nlp.pipeline import run_pipeline   # noqa: PLC0415

        result = run_pipeline(text=text, title=title)

        if result.skipped:
            return Response({
                "success": False,
                "error": {"message": f"Text skipped: {result.skip_reason}"},
            }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        return Response({
            "success": True,
            "data": {
                "language": result.language,
                "language_confidence": result.language_confidence,
                "keywords": result.keywords,
                "topic": result.topic,
                "topic_confidence": result.topic_confidence,
                "sentiment_label": result.sentiment_label,
                "sentiment_score": result.sentiment_score,
                "entities": result.entities,
            },
        })

    except ImportError as exc:
        logger.error("ai_engine import failed: %s", exc)
        return Response(
            {"success": False, "error": {"message": "NLP service not available."}},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except Exception as exc:
        logger.error("analyze_text error: %s", exc)
        return Response(
            {"success": False, "error": {"message": "NLP analysis failed.", "detail": str(exc)}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ── Trigger NLP for a specific article ───────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trigger_article_nlp(request, article_id):
    """
    Dispatch the NLP Celery task for a specific article.

    URL param:
        article_id (UUID) — The article to process.

    Response (202):
        {"success": true, "data": {"task_id": "...", "article_id": "..."}}
    """
    try:
        from apps.articles.models import Article                          # noqa: PLC0415
        from apps.articles.tasks import process_article_nlp              # noqa: PLC0415

        try:
            article = Article.objects.get(pk=article_id)
        except Article.DoesNotExist:
            return Response(
                {"success": False, "error": {"message": "Article not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        task = process_article_nlp.delay(str(article.id))
        return Response(
            {
                "success": True,
                "data": {"task_id": task.id, "article_id": str(article.id)},
            },
            status=status.HTTP_202_ACCEPTED,
        )

    except Exception as exc:
        logger.error("trigger_article_nlp error: %s", exc)
        return Response(
            {"success": False, "error": {"message": "Failed to dispatch NLP task.", "detail": str(exc)}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ── Phase 2.3 — Embedding trigger endpoints ───────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trigger_article_embedding(request, article_id):
    """
    Dispatch the embedding Celery task for a specific Article.

    URL param:
        article_id (UUID) — The article to embed.

    Response (202):
        {"success": true, "data": {"task_id": "...", "article_id": "..."}}
    """
    try:
        from apps.articles.models import Article                                    # noqa: PLC0415
        from apps.articles.embedding_tasks import generate_article_embedding       # noqa: PLC0415

        try:
            article = Article.objects.get(pk=article_id)
        except Article.DoesNotExist:
            return Response(
                {"success": False, "error": {"message": "Article not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        task = generate_article_embedding.delay(str(article.id))
        return Response(
            {"success": True, "data": {"task_id": task.id, "article_id": str(article.id)}},
            status=status.HTTP_202_ACCEPTED,
        )

    except Exception as exc:
        logger.error("trigger_article_embedding error: %s", exc)
        return Response(
            {"success": False, "error": {"message": "Failed to dispatch embedding task.", "detail": str(exc)}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trigger_paper_embedding(request, paper_id):
    """
    Dispatch the embedding Celery task for a specific ResearchPaper.

    URL param:
        paper_id (UUID) — The research paper to embed.
    """
    try:
        from apps.papers.models import ResearchPaper                               # noqa: PLC0415
        from apps.papers.embedding_tasks import generate_paper_embedding           # noqa: PLC0415

        try:
            paper = ResearchPaper.objects.get(pk=paper_id)
        except ResearchPaper.DoesNotExist:
            return Response(
                {"success": False, "error": {"message": "Research paper not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        task = generate_paper_embedding.delay(str(paper.id))
        return Response(
            {"success": True, "data": {"task_id": task.id, "paper_id": str(paper.id)}},
            status=status.HTTP_202_ACCEPTED,
        )

    except Exception as exc:
        logger.error("trigger_paper_embedding error: %s", exc)
        return Response(
            {"success": False, "error": {"message": "Failed to dispatch embedding task.", "detail": str(exc)}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trigger_repo_embedding(request, repo_id):
    """
    Dispatch the embedding Celery task for a specific Repository.

    URL param:
        repo_id (UUID) — The repository to embed.
    """
    try:
        from apps.repositories.models import Repository                            # noqa: PLC0415
        from apps.repositories.embedding_tasks import generate_repo_embedding     # noqa: PLC0415

        try:
            repo = Repository.objects.get(pk=repo_id)
        except Repository.DoesNotExist:
            return Response(
                {"success": False, "error": {"message": "Repository not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        task = generate_repo_embedding.delay(str(repo.id))
        return Response(
            {"success": True, "data": {"task_id": task.id, "repo_id": str(repo.id)}},
            status=status.HTTP_202_ACCEPTED,
        )

    except Exception as exc:
        logger.error("trigger_repo_embedding error: %s", exc)
        return Response(
            {"success": False, "error": {"message": "Failed to dispatch embedding task.", "detail": str(exc)}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trigger_video_embedding(request, video_id):
    """
    Dispatch the embedding Celery task for a specific Video.

    URL param:
        video_id (UUID) — The video to embed.
    """
    try:
        from apps.videos.models import Video                                       # noqa: PLC0415
        from apps.videos.embedding_tasks import generate_video_embedding           # noqa: PLC0415

        try:
            video = Video.objects.get(pk=video_id)
        except Video.DoesNotExist:
            return Response(
                {"success": False, "error": {"message": "Video not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        task = generate_video_embedding.delay(str(video.id))
        return Response(
            {"success": True, "data": {"task_id": task.id, "video_id": str(video.id)}},
            status=status.HTTP_202_ACCEPTED,
        )

    except Exception as exc:
        logger.error("trigger_video_embedding error: %s", exc)
        return Response(
            {"success": False, "error": {"message": "Failed to dispatch embedding task.", "detail": str(exc)}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trigger_batch_embeddings(request):
    """
    Trigger batch embedding generation for all content types that have
    unembedded items.

    Request body (JSON, all optional):
        batch_size  (int)  — Items to queue per content type (default 100).
        types       (list) — Which types to process: articles, papers, repos, videos.
                             Defaults to all four.

    Response (202):
        {
          "success": true,
          "data": {
            "articles": {"queued": 45},
            "papers":   {"queued": 12},
            "repos":    {"queued": 8},
            "videos":   {"queued": 3}
          }
        }
    """
    batch_size = int(request.data.get("batch_size", 100))
    types = request.data.get("types", ["articles", "papers", "repos", "videos"])

    results = {}

    try:
        if "articles" in types:
            from apps.articles.embedding_tasks import generate_pending_article_embeddings  # noqa: PLC0415
            result = generate_pending_article_embeddings(batch_size=batch_size)
            results["articles"] = {"queued": result.get("queued", 0)}

        if "papers" in types:
            from apps.papers.embedding_tasks import generate_pending_paper_embeddings      # noqa: PLC0415
            result = generate_pending_paper_embeddings(batch_size=batch_size)
            results["papers"] = {"queued": result.get("queued", 0)}

        if "repos" in types:
            from apps.repositories.embedding_tasks import generate_pending_repo_embeddings  # noqa: PLC0415
            result = generate_pending_repo_embeddings(batch_size=batch_size)
            results["repos"] = {"queued": result.get("queued", 0)}

        if "videos" in types:
            from apps.videos.embedding_tasks import generate_pending_video_embeddings      # noqa: PLC0415
            result = generate_pending_video_embeddings(batch_size=batch_size)
            results["videos"] = {"queued": result.get("queued", 0)}

        total_queued = sum(v.get("queued", 0) for v in results.values())
        return Response(
            {"success": True, "data": results, "meta": {"total_queued": total_queued}},
            status=status.HTTP_202_ACCEPTED,
        )

    except Exception as exc:
        logger.error("trigger_batch_embeddings error: %s", exc)
        return Response(
            {"success": False, "error": {"message": "Batch embedding dispatch failed.", "detail": str(exc)}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
