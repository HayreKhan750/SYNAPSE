import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

# ── Langchain compatibility patch ─────────────────────────────────────────────
try:
    from langchain_core import exceptions as _lc_exc
    if not hasattr(_lc_exc, 'ContextOverflowError'):
        class ContextOverflowError(_lc_exc.LangChainException):
            """Context window exceeded — compatibility shim."""
        _lc_exc.ContextOverflowError = ContextOverflowError
except Exception:
    pass
# ─────────────────────────────────────────────────────────────────────────────

from django.core.asgi import get_asgi_application

# Must call get_asgi_application() before importing channels/consumers
# so Django apps are fully loaded first.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from apps.notifications.middleware import JwtAuthMiddleware
from apps.notifications.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JwtAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
