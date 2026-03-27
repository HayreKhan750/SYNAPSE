from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.users.urls')),
    path('api/v1/articles/', include('apps.articles.urls')),
    path('api/v1/repos/', include('apps.repositories.urls')),
    path('api/v1/papers/', include('apps.papers.urls')),
    path('api/v1/videos/', include('apps.videos.urls')),
    path('api/v1/automation/', include('apps.automation.urls')),
    path('api/v1/agents/', include('apps.agents.urls')),
    path('api/v1/documents/', include('apps.documents.urls')),
    path('api/v1/trends/', include('apps.trends.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/', include('apps.core.urls')),
    path('api/v1/ai/', include('apps.core.urls_nlp')),
    path('api/v1/integrations/', include('apps.integrations.urls')),  # Phase 6
    # path('', include('django_prometheus.urls')),  # Re-enable after upgrading django-prometheus
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
