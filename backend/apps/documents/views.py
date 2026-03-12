"""
backend.apps.documents.views
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
REST API views for Document Studio.

Endpoints (Phase 5.2 + 5.3):
  POST  /api/v1/documents/generate/          — generate a document via agent tools
  POST  /api/v1/documents/generate-project/  — generate a project scaffold (.zip)
  GET   /api/v1/documents/                   — list user's documents
  GET   /api/v1/documents/{id}/              — retrieve document metadata
  GET   /api/v1/documents/{id}/download/     — stream the file for download
  DELETE /api/v1/documents/{id}/             — delete a document

Phase 5.2 — Document Generation (Week 14)
Phase 5.3 — Project Builder (Week 15)
"""
from __future__ import annotations

import logging
import mimetypes
import os
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import StandardPagination

from .models import GeneratedDocument
from .serializers import (
    DocumentGenerateSerializer,
    GeneratedDocumentListSerializer,
    GeneratedDocumentSerializer,
)

logger = logging.getLogger(__name__)

# MIME type map for document types
_MIME_MAP = {
    "pdf":      "application/pdf",
    "ppt":      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "word":     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "markdown": "text/markdown",
    "project":  "application/zip",
}

_EXT_MAP = {
    "pdf":      ".pdf",
    "ppt":      ".pptx",
    "word":     ".docx",
    "markdown": ".md",
    "project":  ".zip",
}


# ---------------------------------------------------------------------------
# Generate
# ---------------------------------------------------------------------------

class DocumentGenerateView(APIView):
    """
    POST /api/v1/documents/generate/

    Generates a document using the appropriate agent tool:
      - PDF   → generate_pdf tool
      - PPT   → generate_ppt tool
      - Word  → generate_word_doc tool
      - Markdown → generate_markdown tool

    If 'sections' is provided in the request, they are passed directly to the tool.
    Otherwise, a minimal single-section document is generated from the prompt.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        serializer = DocumentGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        doc_type  = data["doc_type"]
        title     = data["title"]
        prompt    = data["prompt"]
        sections  = data.get("sections") or []
        subtitle  = data.get("subtitle", "")
        author    = data.get("author", "SYNAPSE AI")
        user_id   = str(request.user.id)

        # Build sections from prompt if not provided
        if not sections:
            sections = [{"heading": "Content", "content": prompt}]

        try:
            result_str, file_path_str = self._call_tool(
                doc_type=doc_type,
                title=title,
                sections=sections,
                subtitle=subtitle,
                author=author,
                user_id=user_id,
            )
        except Exception as exc:
            logger.error("Document generation failed: %s", exc)
            return Response(
                {"error": f"Document generation failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if "failed" in result_str.lower():
            return Response(
                {"error": result_str},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Parse file path from result string
        abs_path = Path(file_path_str) if file_path_str else None
        rel_path = ""
        file_size = 0
        if abs_path and abs_path.exists():
            media_root = Path(settings.MEDIA_ROOT)
            try:
                rel_path = str(abs_path.relative_to(media_root))
            except ValueError:
                rel_path = str(abs_path)
            file_size = abs_path.stat().st_size

        # Persist record
        doc_obj = GeneratedDocument.objects.create(
            user=request.user,
            title=title,
            doc_type=doc_type,
            file_path=rel_path,
            file_size_bytes=file_size,
            agent_prompt=prompt,
            metadata={
                "subtitle": subtitle,
                "author": author,
                "section_count": len(sections),
                "tool_result": result_str[:500],
            },
        )

        return Response(
            GeneratedDocumentSerializer(doc_obj, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _call_tool(
        doc_type: str,
        title: str,
        sections: list,
        subtitle: str,
        author: str,
        user_id: str,
    ) -> tuple[str, str]:
        """
        Call the appropriate doc generation tool and return (result_str, abs_file_path).
        """
        from ai_engine.agents.doc_tools import (
            _generate_pdf,
            _generate_ppt,
            _generate_word_doc,
            _generate_markdown,
        )

        if doc_type == "pdf":
            result = _generate_pdf(
                title=title, sections=sections,
                subtitle=subtitle, author=author, user_id=user_id,
            )
        elif doc_type == "ppt":
            # Convert sections to slide dicts
            slides = [
                {"title": s.get("heading", "Slide"), "bullets": [s.get("content", "")[:200]], "notes": ""}
                for s in sections
            ]
            result = _generate_ppt(
                title=title, slides=slides,
                subtitle=subtitle or "Generated by SYNAPSE AI",
                author=author, user_id=user_id,
            )
        elif doc_type == "word":
            # Add level=1 to each section if missing
            word_sections = [
                {"heading": s.get("heading", "Section"), "content": s.get("content", ""), "level": s.get("level", 1)}
                for s in sections
            ]
            result = _generate_word_doc(
                title=title, sections=word_sections,
                author=author, add_toc=True, user_id=user_id,
            )
        elif doc_type == "markdown":
            result = _generate_markdown(
                title=title, sections=sections,
                author=author, user_id=user_id,
            )
        else:
            raise ValueError(f"Unsupported doc_type: {doc_type}")

        # Extract file path from result string ("Path: /abs/path")
        file_path = ""
        for line in result.splitlines():
            if line.startswith("Path:"):
                file_path = line.replace("Path:", "").strip()
                break

        return result, file_path


# ---------------------------------------------------------------------------
# Generate Project (Phase 5.3)
# ---------------------------------------------------------------------------

class ProjectGenerateView(APIView):
    """
    POST /api/v1/documents/generate-project/

    Generates a project scaffold (.zip) using the create_project agent tool.
    Supported project_type values: django, fastapi, nextjs, datascience, react_lib
    Optional features list: ['auth', 'testing', 'ci_cd']
    """
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        from .serializers import ProjectGenerateSerializer

        serializer = ProjectGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        project_type = data["project_type"]
        name         = data["name"]
        features     = data.get("features", [])
        user_id      = str(request.user.id)

        try:
            from ai_engine.agents.project_tools import _create_project
            result_str = _create_project(
                project_type=project_type,
                name=name,
                features=features,
                user_id=user_id,
            )
        except Exception as exc:
            logger.error("Project generation failed: %s", exc)
            return Response(
                {"error": f"Project generation failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if "failed" in result_str.lower() or "unknown project_type" in result_str.lower():
            return Response({"error": result_str}, status=status.HTTP_400_BAD_REQUEST)

        # Parse file path from result string ("Path: /abs/path")
        abs_path_str = ""
        for line in result_str.splitlines():
            if line.startswith("Path:"):
                abs_path_str = line.replace("Path:", "").strip()
                break

        abs_path = Path(abs_path_str) if abs_path_str else None
        rel_path = ""
        file_size = 0
        if abs_path and abs_path.exists():
            media_root = Path(settings.MEDIA_ROOT)
            try:
                rel_path = str(abs_path.relative_to(media_root))
            except ValueError:
                rel_path = str(abs_path)
            file_size = abs_path.stat().st_size

        title = f"{name} ({project_type} scaffold)"
        doc_obj = GeneratedDocument.objects.create(
            user=request.user,
            title=title,
            doc_type="project",
            file_path=rel_path,
            file_size_bytes=file_size,
            agent_prompt=f"Generate {project_type} project: {name}",
            metadata={
                "project_type": project_type,
                "project_name": name,
                "features": features,
                "tool_result": result_str[:500],
            },
        )

        return Response(
            GeneratedDocumentSerializer(doc_obj, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

class DocumentListView(APIView):
    """GET /api/v1/documents/ — list the authenticated user's documents."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        qs = GeneratedDocument.objects.filter(user=request.user).order_by("-created_at")

        doc_type_filter = request.query_params.get("doc_type")
        if doc_type_filter:
            qs = qs.filter(doc_type=doc_type_filter)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = GeneratedDocumentListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# ---------------------------------------------------------------------------
# Detail + Delete
# ---------------------------------------------------------------------------

class DocumentDetailView(APIView):
    """
    GET    /api/v1/documents/{id}/ — retrieve document metadata
    DELETE /api/v1/documents/{id}/ — delete document record + file
    """

    permission_classes = [IsAuthenticated]

    def _get_doc(self, doc_id, user) -> GeneratedDocument | None:
        try:
            return GeneratedDocument.objects.get(id=doc_id, user=user)
        except GeneratedDocument.DoesNotExist:
            return None

    def get(self, request: Request, doc_id: str) -> Response:
        doc = self._get_doc(doc_id, request.user)
        if not doc:
            return Response({"error": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(GeneratedDocumentSerializer(doc, context={"request": request}).data)

    def delete(self, request: Request, doc_id: str) -> Response:
        doc = self._get_doc(doc_id, request.user)
        if not doc:
            return Response({"error": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

        # Delete physical file
        if doc.file_path:
            abs_path = Path(settings.MEDIA_ROOT) / doc.file_path
            if abs_path.exists():
                try:
                    abs_path.unlink()
                except Exception as exc:
                    logger.warning("Could not delete file %s: %s", abs_path, exc)

        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

class DocumentDownloadView(APIView):
    """GET /api/v1/documents/{id}/download/ — stream the file as a download."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, doc_id: str) -> FileResponse:
        try:
            doc = GeneratedDocument.objects.get(id=doc_id, user=request.user)
        except GeneratedDocument.DoesNotExist:
            raise Http404("Document not found.")

        if not doc.file_path:
            return Response({"error": "No file available for this document."}, status=status.HTTP_404_NOT_FOUND)

        abs_path = Path(settings.MEDIA_ROOT) / doc.file_path
        if not abs_path.exists():
            return Response({"error": "File not found on server."}, status=status.HTTP_404_NOT_FOUND)

        content_type = _MIME_MAP.get(doc.doc_type, "application/octet-stream")
        ext = _EXT_MAP.get(doc.doc_type, "")
        filename = f"{doc.title[:50].replace('/', '_')}{ext}"

        response = FileResponse(
            open(abs_path, "rb"),
            content_type=content_type,
            as_attachment=True,
            filename=filename,
        )
        return response
