# ── Stage 1: Dependencies (cached unless requirements.txt changes) ────────────
FROM python:3.11-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*

# Copy ONLY requirements first — Docker caches this layer until requirements.txt changes
COPY requirements.txt .
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

# Copy source code last — changes here don't invalidate the pip cache
COPY --chown=appuser:appuser . .

USER appuser
EXPOSE 8000

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM python:3.11-slim AS production
WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# daphne is already installed via requirements.txt (needed for ASGI/WebSocket)
# yt-dlp is required by the YouTube spider (scrape_videos workflow)
RUN pip install yt-dlp --no-cache-dir

COPY --chown=appuser:appuser . .
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

# Debug: verify start_prod.sh exists
RUN ls -la /app/start_prod.sh || echo "WARNING: start_prod.sh not found"

USER appuser
EXPOSE 8000
# Runs BOTH Daphne ASGI server AND Celery worker+beat in one container (free tier)
CMD ["bash", "/app/start_prod.sh"]
