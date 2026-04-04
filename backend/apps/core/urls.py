from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health-check'),
    # ── TASK-305-B3: Daily Briefing ──────────────────────────────────────────
    path('briefing/today/', views.TodayBriefingView.as_view(), name='briefing-today'),
    path('briefing/history/', views.BriefingHistoryView.as_view(), name='briefing-history'),
    # ── TASK-603-B3: Knowledge Graph ──────────────────────────────────────────
    path('knowledge-graph/', views.KnowledgeGraphView.as_view(), name='knowledge-graph'),
    path('knowledge-graph/search/', views.KnowledgeGraphSearchView.as_view(), name='knowledge-graph-search'),
    path('knowledge-graph/nodes/<uuid:pk>/', views.KnowledgeNodeDetailView.as_view(), name='knowledge-node-detail'),
    # ── TASK-505-B3: Audit log ────────────────────────────────────────────────
    path('audit-log/', views.AuditLogListView.as_view(), name='audit-log'),
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
