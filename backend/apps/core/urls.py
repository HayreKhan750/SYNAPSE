from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health-check'),
    path('search/semantic/', views.semantic_search, name='semantic-search'),
]
