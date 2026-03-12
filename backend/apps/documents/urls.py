"""
backend.apps.documents.urls
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
URL routing for Document Studio.

Phase 5.2 — Document Generation (Week 14)
Phase 5.3 — Project Builder (Week 15)

Mounted at: /api/v1/documents/
"""
from django.urls import path
from . import views

urlpatterns = [
    # Generate a new document (PDF, PPT, Word, Markdown)
    path("generate/", views.DocumentGenerateView.as_view(), name="document-generate"),

    # Generate a project scaffold (.zip) — Phase 5.3
    path("generate-project/", views.ProjectGenerateView.as_view(), name="project-generate"),

    # List all user documents
    path("", views.DocumentListView.as_view(), name="document-list"),

    # Document detail + delete
    path("<uuid:doc_id>/", views.DocumentDetailView.as_view(), name="document-detail"),

    # File download (works for all types including .zip projects)
    path("<uuid:doc_id>/download/", views.DocumentDownloadView.as_view(), name="document-download"),
]
