"""
URL patterns for NLP / AI on-demand endpoints.

Mounted at /api/v1/ai/ by config/urls.py.
"""
from django.urls import path
from . import views_nlp

urlpatterns = [
    path("summarize/",              views_nlp.summarize_text,       name="ai-summarize"),
    path("nlp/",                    views_nlp.analyze_text,         name="ai-nlp-analyze"),
    path("process/<uuid:article_id>/", views_nlp.trigger_article_nlp, name="ai-process-article"),
]
