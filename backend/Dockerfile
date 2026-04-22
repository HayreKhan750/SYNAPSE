# ── Stage 1: Dependencies (cached unless requirements.txt changes) ────────────
# Build context is the REPO ROOT (Render sends entire repo as context).
# So paths like backend/requirements.txt and scraper/ are available.
FROM python:3.11-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*

# Copy ONLY backend requirements first — Docker caches this layer
COPY backend/requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt --use-deprecated=legacy-resolver

# ── Stage 2: Development ──────────────────────────────────────────────────────
FROM python:3.11-slim AS development
WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev curl && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

RUN pip install yt-dlp --no-cache-dir

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

# Copy backend source code (not the whole repo)
COPY --chown=appuser:appuser backend/ .

USER appuser
EXPOSE 8000

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM python:3.11-slim AS production
WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# yt-dlp is required by the YouTube scraper (scrape_videos workflow)
# beautifulsoup4 is required by the direct HTTP tweet scraper
RUN pip install yt-dlp beautifulsoup4 --no-cache-dir

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

# Copy backend source code (manage.py, config/, apps/ etc. go to /app/)
COPY --chown=appuser:appuser backend/ .

USER appuser
EXPOSE 8000

# Ensure production settings are used (asgi.py defaults to development)
ENV DJANGO_SETTINGS_MODULE=config.settings.production

# Runs migrations, collectstatic, Celery worker+beat, then Daphne ASGI server
CMD python manage.py migrate --noinput 2>&1; \
    python manage.py collectstatic --noinput 2>/dev/null; \
    celery -A config.celery worker -B \
      -Q default,scraping,agents,nlp,embeddings,slow_scraping \
      -c 2 -l info \
      --scheduler django_celery_beat.schedulers:DatabaseScheduler \
      --pidfile=/tmp/celerybeat.pid & \
    exec daphne config.asgi:application \
      --bind 0.0.0.0 \
      --port $PORT \
      --verbosity 1
