"""
Serializers for the Notifications app.
"""
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model."""

    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notif_type',
            'is_read', 'created_at', 'metadata',
        ]
        read_only_fields = [
            'id', 'title', 'message', 'notif_type',
            'created_at', 'metadata',
        ]
