# SYNAPSE Workspace

## Overview

AI-Powered Technology Intelligence Platform. Full-stack app cloned from GitHub (HayreKhan750/SYNAPSE) and made production-ready in Replit.

## Architecture

- **Frontend**: Next.js 15.5 (React 18) — `synapse/frontend/`
- **Backend**: Django 4.2 (ASGI/Daphne) — `synapse/backend/`
- **Database**: Replit PostgreSQL (host: helium, db: heliumdb)
- **Workspace**: pnpm monorepo

## Running Services

| Workflow | Description | Port |
|---|---|---|
| `artifacts/synapse: web` | Next.js frontend | 22167 |
| `SYNAPSE Backend` | Django API (ASGI) | 8000 |

## API Proxy

Next.js rewrites `/api/v1/*` → `http://localhost:8000/api/v1/*/` internally (no CORS issues).

## Django Settings

- **Settings module**: `config.settings.replit`
- **In-memory channels** (no Redis needed)
- **Console email backend**
- **Celery eager mode** (no broker needed)
- **All ALLOWED_HOSTS** enabled

## Test User

- **Email**: `demo@synapse.dev`
- **Password**: `Demo1234!`

## Key Files

- `synapse/start-frontend.sh` — Next.js startup (port 22167)
- `synapse/start-backend.sh` — Django startup (port 8000)
- `synapse/backend/config/settings/replit.py` — Replit-specific Django settings
- `synapse/frontend/next.config.mjs` — Next.js config (rewrites, allowedDevOrigins)

## Startup Notes

- Frontend runs on Node.js v24 with Next.js 15 (upgraded from 14 for compatibility)
- Backend `.bin` symlinks were created manually (`node_modules/.bin/next`)
- Django backend needs to start before API calls work

## pnpm Workspace Packages

The original SYNAPSE app lives in `synapse/` (not in `artifacts/`). The artifact at `artifacts/synapse` just points its workflow to `synapse/start-frontend.sh`.
