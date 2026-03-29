from django.urls import path
from . import views

urlpatterns = [
    path('', views.trend_list, name='trend-list'),
    path('trigger/', views.trend_trigger, name='trend-trigger'),
    path('<uuid:pk>/', views.trend_detail, name='trend-detail'),
]
