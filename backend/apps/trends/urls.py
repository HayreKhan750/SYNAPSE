from django.urls import path
from . import views

urlpatterns = [
    path("", views.trend_list, name="trend-list"),
    path("<uuid:pk>/", views.trend_detail, name="trend-detail"),
]
