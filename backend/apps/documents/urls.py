"""
backend.apps.documents.urls
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
URL routing for Document Studio.

Phase 5.2 — Document Generation (Week 14)

Mounted at: /api/v1/documents/
"""
from django.urls import path
from . import views

urlpatterns = [
    # Generate a new document
    path("generate/", views.DocumentGenerateView.as_view(), name="document-generate"),

    # List all user documents
    path("", views.DocumentListView.as_view(), name="document-list"),

    # Document detail + delete
    path("<uuid:doc_id>/", views.DocumentDetailView.as_view(), name="document-detail"),

    # File download
    path("<uuid:doc_id>/download/", views.DocumentDownloadView.as_view(), name="document-download"),
]
