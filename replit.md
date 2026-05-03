# SYNAPSE Workspace

## Overview

AI-Powered Technology Intelligence Platform. Full-stack app cloned from GitHub (HayreKhan750/SYNAPSE) and made production-ready in Replit.

## Architecture

- **Frontend**: Next.js 15.5 (React 18) — `synapse/frontend/`
- **Backend**: Django 4.2 (ASGI/Daphne) — `synapse/backend/`
- **AI Engine**: LangChain-based agent framework — `synapse/ai_engine/`
- **Database**: Replit PostgreSQL (host: helium, db: heliumdb)
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
- **Celery eager mode** (no broker needed)
- **AUTO_VERIFY_EMAIL = True** — new registrations are auto-verified and receive JWT tokens immediately
- **All ALLOWED_HOSTS** enabled
- **PYTHONPATH** includes both `synapse/backend/` and `synapse/` (for ai_engine)

## Test User

- **Email**: `demo@synapse.dev`
- **Password**: `Demo1234!`
- **Status**: email_verified=True, is_onboarded=True

## Key Files

- `synapse/start-frontend.sh` — Next.js startup (port 22167)
- `synapse/start-backend.sh` — Django startup (Daphne ASGI, port 8000)
- `synapse/backend/config/settings/replit.py` — Replit-specific Django settings
- `synapse/frontend/.env.local` — NEXT_PUBLIC_API_URL='' (relative paths)
- `synapse/frontend/next.config.mjs` — Next.js config (rewrites to Django, allowedDevOrigins)
- `synapse/frontend/src/utils/api.ts` — Axios with empty BASE_URL for relative paths
- `synapse/frontend/src/store/authStore.ts` — Handles auto-verify token response on register

## Installed Packages (beyond original requirements)

- `langchain-core==0.3.83`, `langchain==0.3.28`, `langchain-community==0.3.31` — for AI agent framework

## Known Non-Issues

- `artifacts/api-server` workflow fails (EADDRINUSE) — unrelated Express server, not part of SYNAPSE
- Django StatReloader "Address already in use" warning on hot-reload — cosmetic, server still running
- `/api/v1/agents/health/` returns 503 if OPENAI_API_KEY not set (expected)

## Startup Notes

- Frontend runs on Node.js v24 with Next.js 15 (upgraded from 14 for compatibility)
- Backend `.bin` symlinks were created manually (`node_modules/.bin/next`)
- Django backend must start before API calls work (Next.js proxy waits)
- Port conflicts: run `fuser -k 8000/tcp 22167/tcp` to clear stale processes

## pnpm Workspace Packages

The original SYNAPSE app lives in `synapse/` (not in `artifacts/`). The artifact at `artifacts/synapse` just points its workflow to `synapse/start-frontend.sh`.
