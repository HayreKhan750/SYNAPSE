# ── Stage 1: Builder ─────────────────────────────────────
FROM python:3.11-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y \
    build-essential libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --upgrade pip && pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# ── Stage 2: Development ─────────────────────────────────
FROM python:3.11-slim AS development
WORKDIR /app
RUN apt-get update && apt-get install -y libpq-dev curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache /wheels/*
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
COPY --chown=appuser:appuser . .
USER appuser
EXPOSE 8000

# ── Stage 3: Production ──────────────────────────────────
FROM python:3.11-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y libpq-dev curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache /wheels/* && pip install gunicorn
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
COPY --chown=appuser:appuser . .
USER appuser
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120"]
