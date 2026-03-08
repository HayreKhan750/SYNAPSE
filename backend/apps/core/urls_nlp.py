"""
URL patterns for NLP / AI on-demand endpoints.

Mounted at /api/v1/ai/ by config/urls.py.
"""
from django.urls import path
from . import views_nlp

urlpatterns = [
    # Phase 2.1 — NLP
    path("summarize/",              views_nlp.summarize_text,           name="ai-summarize"),
    path("nlp/",                    views_nlp.analyze_text,             name="ai-nlp-analyze"),
    path("process/<uuid:article_id>/", views_nlp.trigger_article_nlp,  name="ai-process-article"),
    # Phase 2.3 — Embeddings
    path("embed/article/<uuid:article_id>/", views_nlp.trigger_article_embedding, name="ai-embed-article"),
    path("embed/paper/<uuid:paper_id>/",     views_nlp.trigger_paper_embedding,   name="ai-embed-paper"),
    path("embed/repo/<uuid:repo_id>/",       views_nlp.trigger_repo_embedding,    name="ai-embed-repo"),
    path("embed/video/<uuid:video_id>/",     views_nlp.trigger_video_embedding,   name="ai-embed-video"),
    path("embed/batch/",                     views_nlp.trigger_batch_embeddings,  name="ai-embed-batch"),
]
