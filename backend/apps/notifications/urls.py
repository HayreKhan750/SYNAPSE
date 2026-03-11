"""
URL configuration for the Notifications app.
"""
from django.urls import path
from .views import (
    NotificationListView,
    NotificationUnreadCountView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    NotificationDeleteView,
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('unread-count/', NotificationUnreadCountView.as_view(), name='notification-unread-count'),
    path('read-all/', NotificationMarkAllReadView.as_view(), name='notification-read-all'),
    path('<uuid:pk>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('<uuid:pk>/', NotificationDeleteView.as_view(), name='notification-delete'),
]
