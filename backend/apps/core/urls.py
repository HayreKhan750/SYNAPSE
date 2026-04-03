from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health-check'),
    path('search/', views.global_search, name='global-search'),
    path('search/bm25/', views.bm25_search_view, name='bm25-search'),
    path('search/hybrid/', views.hybrid_search_view, name='hybrid-search'),
    path('search/semantic/', views.semantic_search, name='semantic-search'),
    path('scraper/run/', views.ScraperRunView.as_view(), name='scraper-run'),
    path('bookmarks/', views.BookmarkListView.as_view(), name='bookmark-list'),
    path('bookmarks/<uuid:pk>/notes/', views.BookmarkNotesView.as_view(), name='bookmark-notes'),
    path('bookmarks/<str:content_type_name>/<str:object_id>/', views.BookmarkToggleView.as_view(), name='bookmark-toggle'),
    path('collections/', views.CollectionListCreateView.as_view(), name='collection-list'),
    path('collections/<uuid:pk>/', views.CollectionDetailView.as_view(), name='collection-detail'),
    path('collections/<uuid:pk>/bookmarks/', views.CollectionBookmarkView.as_view(), name='collection-bookmarks'),
    path('recommendations/', views.recommendations, name='recommendations'),
    path('trending/', views.trending, name='trending'),
]
