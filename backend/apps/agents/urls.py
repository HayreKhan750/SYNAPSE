"""
backend.apps.agents.urls
~~~~~~~~~~~~~~~~~~~~~~~~
URL routing for the Agentic AI framework.

Phase 5.1 — Agent Framework (Week 13)

Mounted at: /api/v1/agents/
"""
from django.urls import path
from . import views

urlpatterns = [
    # Task CRUD
    path("tasks/", views.AgentTaskListCreateView.as_view(), name="agent-task-list-create"),
    path("tasks/<uuid:task_id>/", views.AgentTaskDetailView.as_view(), name="agent-task-detail"),
    path("tasks/<uuid:task_id>/cancel/", views.AgentTaskCancelView.as_view(), name="agent-task-cancel"),

    # Tool registry
    path("tools/", views.AgentToolListView.as_view(), name="agent-tool-list"),

    # Health
    path("health/", views.agent_health, name="agent-health"),
]
