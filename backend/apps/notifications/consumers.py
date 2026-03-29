"""
Notification WebSocket Consumer
================================
Authenticated users connect to ws://host/ws/notifications/
and receive real-time notification events pushed from Celery tasks
via the Django Channels layer (Redis backend).

Usage from server-side (e.g. tasks.py):
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"notifications_{user_id}",
        {
            "type": "notify",
            "data": {
                "id": str(notification.id),
                "title": notification.title,
                "message": notification.message,
                "notif_type": notification.notif_type,
                "is_read": False,
                "created_at": notification.created_at.isoformat(),
                "metadata": notification.metadata or {},
            }
        }
    )
"""
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Per-user WebSocket channel.
    Group name: notifications_<user_id>
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_id = str(user.id)
        self.group_name = f"notifications_{self.user_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info("WS connected: user=%s group=%s", self.user_id, self.group_name)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info("WS disconnected: user=%s code=%s", getattr(self, "user_id", "?"), close_code)

    async def receive(self, text_data=None, bytes_data=None):
        """Ping/pong keepalive."""
        if text_data:
            try:
                msg = json.loads(text_data)
                if msg.get("type") == "ping":
                    await self.send(text_data=json.dumps({"type": "pong"}))
            except Exception:
                pass

    # ── Group message handlers ────────────────────────────────────────────────

    async def notify(self, event):
        """Relay a notification pushed from the server to this WebSocket."""
        await self.send(text_data=json.dumps({
            "type": "notification",
            "data": event.get("data", {}),
        }))
