"""
URL configuration for the Automation app.

Routes:
  GET/POST   /api/v1/automation/workflows/
  GET/PUT/PATCH/DELETE /api/v1/automation/workflows/<id>/
  POST       /api/v1/automation/workflows/<id>/trigger/
  POST       /api/v1/automation/workflows/<id>/toggle/
  GET        /api/v1/automation/workflows/<id>/runs/
  GET        /api/v1/automation/runs/<id>/
"""
from django.urls import path
from .views import (
    WorkflowListCreateView,
    WorkflowRetrieveUpdateDestroyView,
    WorkflowTriggerView,
    WorkflowToggleView,
    WorkflowRunListView,
    WorkflowRunDetailView,
)

urlpatterns = [
    # Workflow CRUD
    path('workflows/', WorkflowListCreateView.as_view(), name='workflow-list-create'),
    path('workflows/<uuid:pk>/', WorkflowRetrieveUpdateDestroyView.as_view(), name='workflow-detail'),

    # Workflow actions
    path('workflows/<uuid:pk>/trigger/', WorkflowTriggerView.as_view(), name='workflow-trigger'),
    path('workflows/<uuid:pk>/toggle/', WorkflowToggleView.as_view(), name='workflow-toggle'),

    # Run history
    path('workflows/<uuid:pk>/runs/', WorkflowRunListView.as_view(), name='workflow-runs'),
    path('runs/<uuid:pk>/', WorkflowRunDetailView.as_view(), name='run-detail'),
]
