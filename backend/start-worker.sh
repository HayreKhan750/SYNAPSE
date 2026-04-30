#!/bin/sh
# ── synapse-celery-worker Background Worker start script ─────────────────────
# Runs the Celery worker only (no Beat). Concurrency is intentionally low (-c 2)
# and we recycle each worker process after 50 tasks (--max-tasks-per-child=50)
# so that Python releases any leaked memory and we stay under the 512 MB free
# tier cap. Beat lives in start-beat.sh on a separate service when needed.
set -e

echo "[start-worker] starting celery worker..."
exec celery -A config.celery worker \
  -Q default,scraping,agents,nlp,embeddings \
  -c 2 \
  -l info \
  --max-tasks-per-child=50
