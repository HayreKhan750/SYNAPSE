"""
Serializers for the Automation app.

Handles serialization/deserialization for AutomationWorkflow and WorkflowRun models.
"""
from rest_framework import serializers
from .models import AutomationWorkflow, WorkflowRun


class WorkflowRunSerializer(serializers.ModelSerializer):
    """Serializer for individual workflow execution runs."""

    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowRun
        fields = [
            'id', 'workflow', 'status', 'started_at',
            'completed_at', 'result', 'error_message', 'duration_seconds',
        ]
        read_only_fields = [
            'id', 'workflow', 'status', 'started_at',
            'completed_at', 'result', 'error_message', 'duration_seconds',
        ]

    def get_duration_seconds(self, obj):
        if obj.completed_at and obj.started_at:
            return (obj.completed_at - obj.started_at).total_seconds()
        return None


class AutomationWorkflowSerializer(serializers.ModelSerializer):
    """Full serializer for creating/updating workflows."""

    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    runs_count = serializers.SerializerMethodField()
    last_run = serializers.SerializerMethodField()

    class Meta:
        model = AutomationWorkflow
        fields = [
            'id', 'user', 'name', 'description', 'trigger_type',
            'cron_expression', 'actions', 'is_active', 'status',
            'last_run_at', 'next_run_at', 'run_count',
            'created_at', 'updated_at', 'runs_count', 'last_run',
        ]
        read_only_fields = [
            'id', 'last_run_at', 'next_run_at', 'run_count',
            'created_at', 'updated_at', 'runs_count', 'last_run',
        ]

    def get_runs_count(self, obj):
        return obj.runs.count()

    def get_last_run(self, obj):
        last = obj.runs.first()
        if last:
            return WorkflowRunSerializer(last).data
        return None

    def validate_cron_expression(self, value):
        """Validate cron expression has exactly 5 fields if provided."""
        if value:
            parts = value.strip().split()
            if len(parts) != 5:
                raise serializers.ValidationError(
                    "Cron expression must have exactly 5 fields: "
                    "minute hour day-of-month month day-of-week"
                )
        return value

    def validate_actions(self, value):
        """Validate that actions is a non-empty list of dicts with 'type' key."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Actions must be a list.")
        if len(value) == 0:
            raise serializers.ValidationError("At least one action is required.")
        valid_action_types = [
            'collect_news', 'summarize_content', 'generate_pdf',
            'send_email', 'upload_to_drive',
        ]
        for i, action in enumerate(value):
            if not isinstance(action, dict):
                raise serializers.ValidationError(f"Action {i} must be an object.")
            if 'type' not in action:
                raise serializers.ValidationError(f"Action {i} must have a 'type' field.")
            if action['type'] not in valid_action_types:
                raise serializers.ValidationError(
                    f"Action {i} has invalid type '{action['type']}'. "
                    f"Valid types: {valid_action_types}"
                )
        return value

    def validate(self, attrs):
        trigger_type = attrs.get('trigger_type', AutomationWorkflow.TriggerType.SCHEDULE)
        cron_expression = attrs.get('cron_expression', '')
        if trigger_type == AutomationWorkflow.TriggerType.SCHEDULE and not cron_expression:
            raise serializers.ValidationError(
                {'cron_expression': 'Cron expression is required for scheduled workflows.'}
            )
        return attrs


class AutomationWorkflowListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing workflows."""

    runs_count = serializers.SerializerMethodField()
    last_run_status = serializers.SerializerMethodField()

    class Meta:
        model = AutomationWorkflow
        fields = [
            'id', 'name', 'description', 'trigger_type', 'cron_expression',
            'is_active', 'status', 'last_run_at', 'next_run_at',
            'run_count', 'created_at', 'runs_count', 'last_run_status',
        ]

    def get_runs_count(self, obj):
        return obj.runs.count()

    def get_last_run_status(self, obj):
        last = obj.runs.first()
        return last.status if last else None
