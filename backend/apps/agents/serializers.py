"""
backend.apps.agents.serializers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
DRF serializers for the AgentTask model.

Phase 5.1 — Agent Framework (Week 13)
"""
from rest_framework import serializers
from .models import AgentTask


class AgentTaskCreateSerializer(serializers.ModelSerializer):
    """Used when a user creates a new agent task via POST /api/v1/agents/tasks/."""

    VALID_TASK_TYPES = ["research", "trends", "github", "arxiv", "general", "document", "project"]

    class Meta:
        model = AgentTask
        fields = ["id", "task_type", "prompt"]
        read_only_fields = ["id"]

    def validate_task_type(self, value: str) -> str:
        if value not in self.VALID_TASK_TYPES:
            raise serializers.ValidationError(
                f"Invalid task_type '{value}'. Must be one of: {self.VALID_TASK_TYPES}"
            )
        return value

    def validate_prompt(self, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError("Prompt must be at least 10 characters.")
        if len(value) > 4000:
            raise serializers.ValidationError("Prompt cannot exceed 4000 characters.")
        return value


class AgentTaskSerializer(serializers.ModelSerializer):
    """Full read serializer — returned on GET requests."""

    answer = serializers.SerializerMethodField()
    intermediate_steps = serializers.SerializerMethodField()
    execution_time_s = serializers.SerializerMethodField()

    class Meta:
        model = AgentTask
        fields = [
            "id",
            "task_type",
            "prompt",
            "status",
            "answer",
            "intermediate_steps",
            "execution_time_s",
            "error_message",
            "tokens_used",
            "cost_usd",
            "celery_task_id",
            "created_at",
            "completed_at",
        ]
        read_only_fields = fields

    def get_answer(self, obj: AgentTask) -> str:
        return obj.result.get("answer", "") if obj.result else ""

    def get_intermediate_steps(self, obj: AgentTask) -> list:
        return obj.result.get("intermediate_steps", []) if obj.result else []

    def get_execution_time_s(self, obj: AgentTask) -> float:
        return obj.result.get("execution_time_s", 0.0) if obj.result else 0.0


class AgentTaskListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views (no intermediate steps)."""

    answer = serializers.SerializerMethodField()
    execution_time_s = serializers.SerializerMethodField()
    result = serializers.JSONField(read_only=True)

    class Meta:
        model = AgentTask
        fields = [
            "id",
            "task_type",
            "prompt",
            "status",
            "answer",
            "execution_time_s",
            "result",
            "error_message",
            "tokens_used",
            "cost_usd",
            "created_at",
            "completed_at",
        ]
        read_only_fields = fields

    def get_answer(self, obj: AgentTask) -> str:
        return obj.result.get("answer", "") if obj.result else ""

    def get_execution_time_s(self, obj: AgentTask) -> float:
        return obj.result.get("execution_time_s", 0.0) if obj.result else 0.0


class AgentToolDescriptionSerializer(serializers.Serializer):
    """Describes a single registered agent tool."""
    name = serializers.CharField()
    description = serializers.CharField()
