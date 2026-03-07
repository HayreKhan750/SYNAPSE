from django.urls import path
from . import views
urlpatterns = [
    path('',           views.RepositoryListView.as_view(),   name='repo-list'),
    path('<uuid:pk>/', views.RepositoryDetailView.as_view(), name='repo-detail'),
    path('trending/',  views.TrendingRepositoryListView.as_view(), name='repo-trending'),
]
