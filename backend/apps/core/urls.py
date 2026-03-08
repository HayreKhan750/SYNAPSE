from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health-check'),
    path('search/', views.global_search, name='global-search'),
    path('search/semantic/', views.semantic_search, name='semantic-search'),
    path('bookmarks/', views.BookmarkListView.as_view(), name='bookmark-list'),
    path('bookmarks/<str:content_type_name>/<str:object_id>/', views.BookmarkToggleView.as_view(), name='bookmark-toggle'),
    path('collections/', views.CollectionListCreateView.as_view(), name='collection-list'),
    path('collections/<uuid:pk>/', views.CollectionDetailView.as_view(), name='collection-detail'),
    path('collections/<uuid:pk>/bookmarks/', views.CollectionBookmarkView.as_view(), name='collection-bookmarks'),
]
