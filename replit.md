# SYNAPSE Workspace

## Overview

AI-Powered Technology Intelligence Platform. Full-stack app cloned from GitHub (HayreKhan750/SYNAPSE) and made fully production-ready in Replit.

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
| `artifacts/synapse: web` | Next.js frontend | varies (read PORT env) |
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
- **DISABLE_RATE_LIMITS=true** — all AI endpoints rate-limit-free for demo

## Test User

- **Email**: `demo@synapse.dev`
- **Password**: `Demo1234!`
- **UUID**: `57b9b0f1-338a-4004-9b46-ca4e1e82771b`
- **Status**: email_verified=True, is_onboarded=True, org="Synapse Demo Team", 10 bookmarks, 3 collections

## Live Scraped Data (all real, no seeds/fixtures)

Background scheduler (`synapse/scraper_scheduler.py`) runs every minute and dispatches:

| Content Type | Count | Source | Refresh Interval |
|---|---|---|---|
| Articles | 166 | HackerNews API (top/new/best 100) | Every 30 min |
| Repositories | 361 | GitHub Search API (all langs + TypeScript + Python) | Every 2 hrs |
| Research Papers | 392 | arXiv API (cs.AI, cs.LG, cs.CL, cs.CV) | Every 6 hrs |
| Videos | 99 | yt-dlp (AI/ML/dev YouTube channels) | Every 3 hrs |
| Tweets | 571 | Mastodon public API (no key needed) 7 topics | Every 1 hr |
| Tech Trends | 10 topics | Analyzed across all 5 sources | Every 2 hrs |
| AI Article Summaries | batch 30 | Replit AI (gpt-4o-mini) | Every 1 hr |
| Daily Briefings | per-user | Replit AI (gpt-4o-mini) — 4302+ chars | Every 24 hrs |

## Knowledge Graph

50 tech entity nodes (LLM, RAG, Python, Go, Rust, Claude, etc.) + 50 typed edges
(used_with, implemented_in, instance_of, framework_for, technique_for, etc.)
Built from trends data. Endpoint: `GET /api/v1/knowledge-graph/`

## Scheduler Tasks (`synapse/scraper_scheduler.py`)

| Task | Interval | Python call |
|---|---|---|
| HackerNews scraper | 30 min | `run_scrapers --sources hn` |
| GitHub scraper | 2 hrs | `run_scrapers --sources github` |
| arXiv scraper | 6 hrs | `run_scrapers --sources arxiv` |
| Mastodon tweet scraper | 1 hr | `scrape_twitter()` per topic |
| YouTube scraper | 3 hrs | `scrape_youtube()` |
| Trend analysis | 2 hrs | `analyze_trends_task()` |
| Article summarization | 1 hr | `summarize_pending_articles(batch_size=30)` |
| Daily briefings | 24 hrs | `generate_user_briefing()` per user |

## AI Features — All Working

- **AI Chat**: `POST /api/v1/ai/chat/` — any model ID normalizes to gpt-4o-mini via Replit AI
- **Agent Tasks**: `POST /api/v1/agents/tasks/` — task_type + prompt fields, runs research agents
- **Daily Briefing**: `GET /api/v1/briefing/today/` — 4302-char AI-generated brief per user
- **Research Sessions**: `POST /api/v1/agents/research/` — deep-dive AI research with citations
- **Rate limits**: DISABLED (`DISABLE_RATE_LIMITS=true`) for all AI endpoints

## Model Normalization Fix

`synapse/backend/apps/core/views_chat.py` → `_get_replit_openai_pipeline()`:
Any non-OpenAI model ID (`google/*`, `meta-llama/*`, etc.) is normalized to `gpt-4o-mini`
before calling the Replit AI gateway. Frontend `DEFAULT_MODEL = 'gpt-4o-mini'`.

## API Key Banner Fix

`synapse/frontend/src/hooks/useApiKeyStatus.ts` reads `d.any_configured` from backend.
Backend always returns `any_configured: true` since Replit AI is the server-side key.
Banner only shows if truly no AI backend is available.

## User Features

- **Bookmarks**: 10 items (5 articles + 5 repos) — `GET /api/v1/bookmarks/`
- **Collections**: 3 (AI & ML, Open Source Tools, Weekly Reading List) — `GET /api/v1/collections/`
- **Organizations**: "Synapse Demo Team" — `GET /api/v1/organizations/`
- **Notifications**: 14 real notifications
- **Onboarding**: Complete — interests [AI, ML, Python, LLM, open source, RAG, GitHub, TypeScript]
- **For-You Feed**: 135 personalized articles matching user interests

## Key Files

- `synapse/start-backend.sh` — env vars, pip install, DB migrate, scheduler launch, daphne start
- `synapse/scraper_scheduler.py` — all 8 periodic scraping tasks
- `synapse/backend/apps/core/views_chat.py` — AI chat, model normalization, briefing
- `synapse/backend/apps/core/throttles.py` — rate limit bypass (DISABLE_RATE_LIMITS)
- `synapse/backend/apps/core/views.py` — knowledge graph, bookmarks, search
- `synapse/backend/apps/core/management/commands/run_scrapers.py` — hn/github/arxiv/youtube/twitter
- `synapse/frontend/src/app/(dashboard)/chat/page.tsx` — model dropdown (Built-in vs Key needed)
- `synapse/frontend/src/hooks/useApiKeyStatus.ts` — reads any_configured from backend

## Endpoints — All Working

- `POST /api/v1/auth/login/` — JWT auth
- `GET /api/v1/articles/?for_you=1` — personalized feed (135 articles)
- `GET /api/v1/repos/?ordering=-stars` — GitHub trending
- `GET /api/v1/papers/` — arXiv research papers
- `GET /api/v1/videos/` — YouTube tech videos
- `GET /api/v1/tweets/` — Mastodon posts (tech topics)
- `GET /api/v1/trends/?ordering=-trend_score` — Go 618, LLM 560, RAG 443...
- `GET /api/v1/briefing/today/` — AI daily brief (4302 chars, topic_summary)
- `GET /api/v1/knowledge-graph/` — 50 nodes, 50 edges (named source/target)
- `GET /api/v1/knowledge-graph/search/?q=llm` — node search
- `GET /api/v1/search/?q=machine+learning` — global search (32 results)
- `POST /api/v1/ai/chat/` — AI chat (gpt-4o-mini via Replit AI)
- `POST /api/v1/agents/tasks/` — AI agent tasks (task_type + prompt)
- `GET /api/v1/agents/research/` — research sessions
- `GET /api/v1/bookmarks/` — user bookmarks (10)
- `GET /api/v1/collections/` — user collections (3)
- `GET /api/v1/organizations/` — user orgs
- `GET /api/v1/automation/workflows/` — 4 workflows
- `GET /api/v1/billing/subscription/` — billing status
- `GET /api/v1/users/ai-keys/` — API key status (any_configured: true)
- `POST /api/v1/bookmarks/{type}/{id}/` — toggle bookmark
- `POST /api/v1/trends/trigger/` — recompute trends
- `GET /api/v1/notifications/` — 14 notifications
