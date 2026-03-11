"""
backend.apps.documents.serializers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
DRF serializers for the GeneratedDocument model.

Phase 5.2 — Document Generation (Week 14)
"""
from rest_framework import serializers
from .models import GeneratedDocument


class DocumentGenerateSerializer(serializers.Serializer):
    """Input serializer for document generation requests."""

    VALID_DOC_TYPES = ["pdf", "ppt", "word", "markdown"]

    doc_type = serializers.ChoiceField(
        choices=VALID_DOC_TYPES,
        help_text="Document format: pdf, ppt, word, or markdown",
    )
    title = serializers.CharField(
        max_length=500,
        help_text="Document title",
    )
    prompt = serializers.CharField(
        max_length=8000,
        help_text=(
            "Natural language prompt describing what to generate. "
            "The AI agent will use this to structure the content."
        ),
    )
    sections = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_empty=True,
        help_text=(
            "Optional pre-structured sections. Each dict has 'heading' and 'content'. "
            "If omitted, the agent generates sections from the prompt."
        ),
    )
    subtitle = serializers.CharField(
        max_length=300,
        required=False,
        allow_blank=True,
        default="",
        help_text="Optional subtitle (PDF cover page / PPT title slide)",
    )
    author = serializers.CharField(
        max_length=200,
        required=False,
        default="SYNAPSE AI",
        help_text="Author name shown in document metadata and footer",
    )

    def validate_title(self, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Title must be at least 3 characters.")
        return value

    def validate_prompt(self, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError("Prompt must be at least 10 characters.")
        return value


class GeneratedDocumentSerializer(serializers.ModelSerializer):
    """Full serializer for reading document records."""

    download_url = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedDocument
        fields = [
            "id",
            "title",
            "doc_type",
            "file_path",
            "cloud_url",
            "file_size_bytes",
            "agent_prompt",
            "download_url",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields

    def get_download_url(self, obj: GeneratedDocument) -> str:
        """Return the download URL relative to the API host."""
        request = self.context.get("request")
        if obj.file_path:
            path = f"/api/v1/documents/{obj.id}/download/"
            if request:
                return request.build_absolute_uri(path)
            return path
        return obj.cloud_url or ""


class GeneratedDocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""

    class Meta:
        model = GeneratedDocument
        fields = [
            "id",
            "title",
            "doc_type",
            "file_size_bytes",
            "created_at",
        ]
        read_only_fields = fields
