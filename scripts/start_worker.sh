#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SYNAPSE — Celery Worker Startup Script
#
# Starts the background task worker that processes:
#   • Article NLP (clean, keyword extract, topic classify, sentiment, NER)
#   • Article summarization (Gemini 1.5 Flash)
#   • Vector embedding generation (sentence-transformers)
#   • Scraping tasks (HackerNews, GitHub, arXiv, YouTube)
#
# Usage:
#   chmod +x scripts/start_worker.sh
#   ./scripts/start_worker.sh
#
# Or run individual queues manually — see comments at the bottom.
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Load .env so GOOGLE_API_KEY and broker settings are available
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
  echo "✅ Loaded .env"
fi

# Make sure ai_engine is on PYTHONPATH so Celery tasks can import it
export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.development}"

echo ""
echo "🚀 Starting SYNAPSE Celery worker..."
echo "   DJANGO_SETTINGS_MODULE = $DJANGO_SETTINGS_MODULE"
echo "   PYTHONPATH includes     = $PROJECT_ROOT"
echo "   Queues                  = nlp, embeddings, celery (default)"
echo ""

cd "$BACKEND_DIR"

# Start one worker that handles ALL queues with concurrency=2
# -P solo avoids multiprocessing issues with ML libraries on Linux/macOS
celery -A config.celery worker \
  --loglevel=info \
  --concurrency=2 \
  --queues=nlp,embeddings,celery \
  --hostname=synapse-worker@%h \
  -P prefork

# ─────────────────────────────────────────────────────────────────────────────
# Alternative: run queues in separate terminals for maximum throughput:
#
#   Terminal 1 — NLP + summarization (CPU-bound, ML models):
#   cd backend && celery -A config.celery worker -Q nlp --concurrency=1 --loglevel=info
#
#   Terminal 2 — Embedding generation:
#   cd backend && celery -A config.celery worker -Q embeddings --concurrency=1 --loglevel=info
#
#   Terminal 3 — Scraping tasks:
#   cd backend && celery -A config.celery worker -Q celery --concurrency=4 --loglevel=info
#
#   Optional — Celery Beat (periodic tasks scheduler):
#   cd backend && celery -A config.celery beat --loglevel=info
# ─────────────────────────────────────────────────────────────────────────────
