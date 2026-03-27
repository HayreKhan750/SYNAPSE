FROM python:3.11-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
COPY ai_engine/requirements.txt .
RUN pip install --upgrade pip && pip wheel --no-cache-dir --no-deps --wheel-dir /wheels -r requirements.txt

FROM python:3.11-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y libpq-dev curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /wheels /wheels
COPY --from=builder /build/requirements.txt .
RUN pip install --no-cache /wheels/*
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
# Copy entire project so ai_engine package is importable as /app/ai_engine
COPY --chown=appuser:appuser . .
ENV PYTHONPATH=/app
USER appuser
EXPOSE 8001
CMD ["uvicorn", "ai_engine.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
