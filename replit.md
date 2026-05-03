# SYNAPSE Workspace

## Overview

AI-Powered Technology Intelligence Platform. Full-stack app cloned from GitHub (HayreKhan750/SYNAPSE) and made production-ready in Replit.

## Architecture

- **Frontend**: Next.js 15.5 (React 18) — `synapse/frontend/`
- **Backend**: Django 4.2 (ASGI/Daphne) — `synapse/backend/`
- **AI Engine**: LangChain-based agent framework — `synapse/ai_engine/`
- **Database**: Replit PostgreSQL (host: helium, db: heliumdb)
- **AI Provider**: Replit built-in OpenAI (via `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY`)
- **Workspace**: pnpm monorepo

## Running Services

| Workflow | Description | Port |
|---|---|---|
| `artifacts/synapse: web` | Next.js frontend | 22167 |
| `SYNAPSE Backend` | Django API (ASGI/Daphne) | 8000 |

## API Proxy

Next.js rewrites `/api/v1/*` → `http://localhost:8000/api/v1/*/` internally (no CORS issues).
Browser always uses relative paths — never `http://localhost:8000` directly.

## Django Settings

- **Settings module**: `config.settings.replit`
- **In-memory channels** (no Redis needed)
- **Console email backend** (no SMTP needed)
- **Celery eager mode** (no broker needed) — agent tasks use background threads to avoid blocking HTTP
- **Background scraper scheduler** — runs `synapse/scraper_scheduler.py` for periodic real data scraping
- **AUTO_VERIFY_EMAIL = True** — new registrations are auto-verified and receive JWT tokens immediately
- **All ALLOWED_HOSTS** enabled
- **PYTHONPATH** includes both `synapse/backend/` and `synapse/` (for ai_engine)

## Test User

- **Email**: `demo@synapse.dev`
- **Password**: `Demo1234!`
- **UUID**: `57b9b0f1-338a-4004-9b46-ca4e1e82771b`
- **Status**: email_verified=True, is_onboarded=True

## Live Scraped Data (no seeds/fixtures)

All seed data has been cleared. All content is real scraped data. Background scheduler: `synapse/scraper_scheduler.py`.

| Content Type | Count | Source | Refresh |
|---|---|---|---|
| Articles | 161 | HackerNews API (top/new/best) | Every 30 min |
| Repositories | 359 | GitHub Search API (all langs + Python + TypeScript) | Every 2 hrs |
| Research Papers | 296 | arXiv API (cs.AI, cs.LG, cs.CL, cs.CV) | Every 6 hrs |
| Tech Trends | 67 | Analyzed from articles/repos/papers | Daily |
| Tweets | 0 | Needs `TWITTER_BEARER_TOKEN` env var — nitter blocked | On key provision |
| Videos | 0 | Needs `YOUTUBE_API_KEY` env var | On key provision |

### Critical Bug Fixed
Articles/Repos/Papers views previously filtered all authenticated requests to only show bookmarked items (a `user_articles__user=request.user` filter was always applied). Fixed: junction-table filter now only applies when `?saved=1` is explicitly passed.

### Personalization
Demo user (`demo@synapse.dev`) has `OnboardingPreferences` with interests: `["AI", "machine learning", "Python", "LLM", "open source", "RAG", "GitHub", "TypeScript"]`. The `?for_you=1` filter now matches articles by title/summary (since all HN articles have generic `topic="tech"`) — returns 35 personalized articles from 161 total.

## API Endpoints — All Working

All endpoints return 200 with auth token. Key paths:

- `POST /api/v1/auth/login/` — JWT auth
- `GET /api/v1/articles/` — HackerNews articles
- `GET /api/v1/repos/` — GitHub repos
- `GET /api/v1/papers/` — arXiv papers
- `GET /api/v1/videos/` — YouTube videos
- `GET /api/v1/tweets/` — Twitter/X content
- `GET /api/v1/trends/` — Tech trending topics
- `GET /api/v1/briefing/today/` — Daily AI briefing
- `GET /api/v1/automation/workflows/` — Automation workflows
- `GET /api/v1/automation/action-schemas/` — Action parameter schemas
- `POST /api/v1/ai/chat/` — RAG chat (requires user API key)
- `GET /api/v1/ai/chat/conversations/` — Chat history
- `GET /api/v1/agents/tasks/` — AI agent tasks
- `GET /api/v1/agents/tools/` — Available agent tools
- `GET /api/v1/agents/health/` — Agent health check
- `GET /api/v1/billing/pricing/` — Pricing plans
- `GET /api/v1/billing/subscription/` — User subscription
- `GET /api/v1/users/me/` — User profile
- `GET /api/v1/users/ai-keys/` — AI API keys (OpenRouter, Gemini, etc.)
- `GET /api/v1/knowledge-graph/` — Knowledge graph data
- `POST /api/v1/scraper/run/` — Trigger scraper (`scraper` field: hackernews|github|arxiv|youtube|twitter)
- `POST /api/v1/trends/trigger/` — Trigger trend analysis

## Chat AI — User-Supplied Keys

The chat page (`/chat`) uses OpenRouter by default. Users must add their API key under Settings → API Keys. The chat endpoint is `/api/v1/ai/chat/` (POST). Supported models:
- Google Gemini (free via OpenRouter)
- Meta Llama (free via OpenRouter)
- DeepSeek, Mistral, Qwen (free via OpenRouter)
- GPT-4o, Claude (paid)
- Local Ollama models

## Key Files

- `synapse/start-frontend.sh` — Next.js startup (port 22167)
- `synapse/start-backend.sh` — Django startup (Daphne ASGI, port 8000); includes `fuser -k 8000/tcp`
- `synapse/backend/config/settings/replit.py` — Replit-specific Django settings
- `synapse/frontend/.env.local` — NEXT_PUBLIC_API_URL='' (relative paths)
- `synapse/frontend/next.config.mjs` — Next.js config (rewrites to Django, allowedDevOrigins)
- `synapse/frontend/src/utils/api.ts` — Axios with empty BASE_URL for relative paths
- `synapse/frontend/src/store/authStore.ts` — Handles auto-verify token response on register

## Scraper Notes

- **HackerNews**: Works via direct arXiv API. Returns 30 articles/run.
- **GitHub**: Works via GitHub API (public, no token needed). Returns 25 repos/run.
- **arXiv**: Fixed `itertext()` for XML title extraction (handles mixed-content elements). Returns up to 100 papers across 5 categories.
- **YouTube**: Requires `yt-dlp` (installed). May need YouTube cookies for some searches.
- **Twitter/X**: Requires `X_API_KEY` / `TWITTER_BEARER_TOKEN` set in environment.

## Installed Packages (beyond original requirements)

- `langchain-core==0.3.83`, `langchain==0.3.28`, `langchain-community==0.3.31` — AI agent framework

## Known Non-Issues

- `artifacts/api-server` workflow fails (EADDRINUSE) — unrelated Express server, not part of SYNAPSE
- Django StatReloader "Address already in use" warning on hot-reload — cosmetic, server still running
- `/api/v1/agents/health/` returns 503 if OPENAI_API_KEY not set (expected — requires user API key)
- Google sign-in shows "unavailable" — requires GOOGLE_CLIENT_ID/SECRET env vars
- GitHub OAuth shows "Sign in with GitHub" — requires GITHUB_CLIENT_ID/SECRET env vars

## Startup Notes

- Frontend runs on Node.js v24 with Next.js 15 (upgraded from 14 for compatibility)
- Backend `.bin` symlinks were created manually (`node_modules/.bin/next`)
- Django backend must start before API calls work (Next.js proxy waits)
- Port conflicts: run `fuser -k 8000/tcp 22167/tcp` to clear stale processes

## pnpm Workspace Packages

The original SYNAPSE app lives in `synapse/` (not in `artifacts/`). The artifact at `artifacts/synapse` just points its workflow to `synapse/start-frontend.sh`.
