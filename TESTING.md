# SYNAPSE Testing Guide

## Overview
This guide covers testing procedures for all SYNAPSE systems: Authentication, Automation, AI Agents, Billing, Organizations, and Workflows/Scrapers.

## Prerequisites
```bash
# Start Docker services
docker-compose up -d

# Run migrations
docker-compose exec backend python manage.py migrate

# Create test superuser
docker-compose exec backend python manage.py createsuperuser
```

## 1. Authentication Testing

### 1.1 Django JWT Authentication
```bash
# Test login
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# Expected: {"access": "...", "refresh": "...", "user": {...}}
```

### 1.2 Supabase Authentication
```bash
# Test Supabase token exchange
curl -X POST http://localhost:8000/api/v1/auth/supabase/ \
  -H "Content-Type: application/json" \
  -d '{"access_token": "<supabase-access-token>"}'

# Expected: {"access": "...", "refresh": "...", "user": {...}}
```

### 1.3 Google OAuth
```bash
# Test Google OAuth callback
curl -X POST http://localhost:8000/api/v1/auth/google/ \
  -H "Content-Type: application/json" \
  -d '{"access_token": "<google-access-token>"}'

# Expected: {"success": true, "tokens": {...}, "user": {...}}
```

## 2. Automation Testing

### 2.1 Create Workflow
```bash
# Get JWT token first
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' | jq -r '.access')

# Create workflow
curl -X POST http://localhost:8000/api/v1/automation/workflows/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Tech Digest",
    "description": "Collect and summarize daily tech news",
    "trigger_type": "schedule",
    "cron_expression": "0 6 * * *",
    "actions": [
      {"type": "collect_news", "params": {"sources": ["hackernews", "github"]}},
      {"type": "generate_pdf", "params": {"title": "Daily Digest"}}
    ]
  }'
```

### 2.2 Trigger Workflow Manually
```bash
# Get workflow ID from previous response
WORKFLOW_ID="<workflow-id>"

curl -X POST http://localhost:8000/api/v1/automation/workflows/$WORKFLOW_ID/trigger/ \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"detail": "Workflow triggered successfully.", "run_id": "..."}
```

### 2.3 Check Workflow Runs
```bash
curl -X GET http://localhost:8000/api/v1/automation/workflows/$WORKFLOW_ID/runs/ \
  -H "Authorization: Bearer $TOKEN"
```

## 3. AI Agent Testing

### 3.1 Create Agent Task
```bash
curl -X POST http://localhost:8000/api/v1/agents/tasks/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "research",
    "prompt": "Research the latest developments in AI agents and summarize key findings"
  }'

# Expected: {"id": "...", "status": "pending", ...}
```

### 3.2 Check Agent Task Status
```bash
TASK_ID="<task-id>"

curl -X GET http://localhost:8000/api/v1/agents/tasks/$TASK_ID/ \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"id": "...", "status": "completed", "result": {...}}
```

## 4. Billing Testing

### 4.1 Get Pricing Plans
```bash
curl -X GET http://localhost:8000/api/v1/billing/pricing/

# Expected: {"plans": {"free": {...}, "pro": {...}, "enterprise": {...}}}
```

### 4.2 Check Subscription
```bash
curl -X GET http://localhost:8000/api/v1/billing/subscription/ \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"plan": "free", "status": "active", ...}
```

### 4.3 Create Checkout Session (requires Stripe)
```bash
curl -X POST http://localhost:8000/api/v1/billing/checkout/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "pro"}'

# Expected: {"checkout_url": "https://checkout.stripe.com/..."}
```

## 5. Organization Testing

### 5.1 Create Organization
```bash
curl -X POST http://localhost:8000/api/v1/organizations/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tech Research Team",
    "slug": "tech-research"
  }'

# Expected: {"id": "...", "name": "Tech Research Team", ...}
```

### 5.2 Invite Member
```bash
ORG_ID="<org-id>"

curl -X POST http://localhost:8000/api/v1/organizations/$ORG_ID/invite/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "newmember@example.com", "role": "editor"}'

# Expected: {"invite_id": "...", "invite_url": "..."}
```

## 6. Scraper Testing

### 6.1 Test HackerNews Scraper
```bash
# Via automation workflow
curl -X POST http://localhost:8000/api/v1/automation/events/trigger/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "new_article",
    "payload": {"source": "hackernews"}
  }'

# Expected: {"detail": "Event dispatched.", "celery_task_id": "..."}
```

### 6.2 Check Celery Tasks
```bash
# Check Flower dashboard (if enabled)
# http://localhost:5555

# Or via CLI
docker-compose exec backend celery -A config inspect active
```

## 7. End-to-End Testing

### 7.1 Complete User Flow
1. **Register**: POST /api/v1/auth/register/
2. **Login**: POST /api/v1/auth/login/
3. **Create Organization**: POST /api/v1/organizations/
4. **Create Workflow**: POST /api/v1/automation/workflows/
5. **Trigger Workflow**: POST /api/v1/automation/workflows/{id}/trigger/
6. **Create Agent Task**: POST /api/v1/agents/tasks/
7. **Check Subscription**: GET /api/v1/billing/subscription/

### 7.2 Automated Test Script
```python
# tests/e2e/test_complete_flow.py
import pytest
import requests

BASE_URL = "http://localhost:8000/api/v1"

def test_complete_user_flow():
    # 1. Register
    response = requests.post(f"{BASE_URL}/auth/register/", json={
        "email": "test@example.com",
        "username": "testuser",
        "password": "SecurePass123!",
        "password2": "SecurePass123!"
    })
    assert response.status_code == 201

    # 2. Login
    response = requests.post(f"{BASE_URL}/auth/login/", json={
        "email": "test@example.com",
        "password": "SecurePass123!"
    })
    assert response.status_code == 200
    token = response.json()["access"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create Organization
    response = requests.post(f"{BASE_URL}/organizations/",
        headers=headers,
        json={"name": "Test Org", "slug": "test-org"}
    )
    assert response.status_code == 201

    # 4. Create Workflow
    response = requests.post(f"{BASE_URL}/automation/workflows/",
        headers=headers,
        json={
            "name": "Test Workflow",
            "trigger_type": "manual",
            "actions": [{"type": "collect_news", "params": {}}]
        }
    )
    assert response.status_code == 201
    workflow_id = response.json()["id"]

    # 5. Trigger Workflow
    response = requests.post(
        f"{BASE_URL}/automation/workflows/{workflow_id}/trigger/",
        headers=headers
    )
    assert response.status_code == 202

    # 6. Create Agent Task
    response = requests.post(f"{BASE_URL}/agents/tasks/",
        headers=headers,
        json={"task_type": "research", "prompt": "Test prompt"}
    )
    assert response.status_code == 201

    print("All tests passed!")
```

## 8. Performance Testing

### 8.1 Load Testing with Locust
```python
# locustfile.py
from locust import HttpUser, task, between

class SYNAPSEUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        response = self.client.post("/api/v1/auth/login/", json={
            "email": "test@example.com",
            "password": "password123"
        })
        self.token = response.json()["access"]

    @task(3)
    def get_feed(self):
        self.client.get("/api/v1/articles/feed/",
            headers={"Authorization": f"Bearer {self.token}"})

    @task(2)
    def get_workflows(self):
        self.client.get("/api/v1/automation/workflows/",
            headers={"Authorization": f"Bearer {self.token}"})

    @task(1)
    def create_agent_task(self):
        self.client.post("/api/v1/agents/tasks/",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"task_type": "research", "prompt": "Test"})
```

Run with:
```bash
locust -f locustfile.py --host=http://localhost:8000
```

## 9. Troubleshooting

### Common Issues

#### Authentication Failures
- Check Supabase credentials in `.env`
- Verify JWT secret key in Django settings
- Check CORS settings for frontend origin

#### Automation Not Running
- Check Celery worker status: `docker-compose ps`
- Check Celery logs: `docker-compose logs celery`
- Verify Redis connection

#### Agent Tasks Failing
- Check AI API keys configured
- Verify rate limits not exceeded
- Check agent task logs

#### Stripe Webhooks Not Working
- Verify webhook secret configured
- Check Stripe dashboard for webhook delivery status
- Test webhook locally with Stripe CLI

## 10. Test Coverage Goals

| Component | Target Coverage |
|-----------|-----------------|
| Authentication | 90% |
| Automation | 85% |
| AI Agents | 80% |
| Billing | 85% |
| Organizations | 80% |
| Scrapers | 75% |

Run coverage with:
```bash
docker-compose exec backend pytest --cov=apps --cov-report=html
```
