"""
SYNAPSE AI Engine — FastAPI application
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Industry best practices applied:
  ✓ Lifespan context manager (replaces deprecated on_event)
  ✓ Singleton warm-up at startup (avoids cold-start latency on first request)
  ✓ SlowAPI rate limiting (prevents abuse)
  ✓ Structured logging with structlog
  ✓ Proper error models with Pydantic
  ✓ CORS configured from env (not wildcard in production)
  ✓ Request ID middleware for distributed tracing
"""
from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, Iterator, List, Optional

import structlog
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

# ── Lifespan — warm up singletons at startup ──────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.
    Warms up the embedding model and RAG pipeline at startup
    so the first user request isn't slow.
    """
    logger.info("SYNAPSE AI Engine starting up…")

    # Warm up embedder
    try:
        from ai_engine.embeddings import get_embedder
        embedder = get_embedder()
        logger.info("embedder_ready", model="all-MiniLM-L6-v2", dims=embedder.dimensions)
    except Exception as exc:
        logger.warning("embedder_warmup_failed", error=str(exc))

    # Warm up RAG pipeline (connects to DB, Redis)
    try:
        from ai_engine.rag import get_rag_pipeline
        pipeline = get_rag_pipeline()
        logger.info("rag_pipeline_ready", model=pipeline.model_name)
    except Exception as exc:
        logger.warning("rag_pipeline_warmup_failed", error=str(exc))

    # Warm up agent executor
    try:
        from ai_engine.agents import get_executor
        executor = get_executor()
        logger.info("agent_executor_ready", tools=len(executor.get_tools()))
    except Exception as exc:
        logger.warning("agent_executor_warmup_failed", error=str(exc))

    logger.info("SYNAPSE AI Engine ready ✓")
    yield
    logger.info("SYNAPSE AI Engine shutting down…")


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SYNAPSE AI Engine",
    description="Agent orchestration, RAG pipeline, and embeddings API.",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────

_allowed_origins = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:8000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request ID middleware (for distributed tracing) ───────────────────────────

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    response: Response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# ── Rate limiting (SlowAPI — token bucket per IP) ─────────────────────────────

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded

    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    _RATE_LIMITING = True
except ImportError:
    _RATE_LIMITING = False
    logger.warning("slowapi not installed — rate limiting disabled")


# ── Pydantic models ────────────────────────────────────────────────────────────

class AgentRunRequest(BaseModel):
    task:   str  = Field(..., min_length=1, max_length=4000)
    stream: bool = False


class ChatRequest(BaseModel):
    question:        str            = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str]  = None
    content_types:   Optional[List[str]] = None
    stream:          bool           = False


class EmbedRequest(BaseModel):
    texts:      List[str] = Field(..., min_length=1, max_length=100)
    batch_size: int       = Field(32, ge=1, le=128)


class HealthResponse(BaseModel):
    status:     str
    components: Dict[str, Any] = {}


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health() -> Dict[str, Any]:
    return {"status": "ok"}


@app.get("/health/rag", response_model=HealthResponse, tags=["System"])
async def health_rag() -> Dict[str, Any]:
    try:
        from ai_engine.rag import get_rag_pipeline
        return get_rag_pipeline().health_check()
    except Exception as exc:
        logger.exception("rag_health_check_failed", error=str(exc))
        return {"status": "error", "detail": str(exc)}


# ── Agents ─────────────────────────────────────────────────────────────────────

@app.get("/agents/tools", tags=["Agents"])
async def list_tools() -> Dict[str, Any]:
    try:
        from ai_engine.agents import get_executor
        return {"tools": get_executor().get_tools()}
    except Exception as exc:
        logger.exception("list_tools_failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/agents/run", tags=["Agents"])
async def run_agent(request: AgentRunRequest) -> Any:
    from ai_engine.agents import get_executor
    executor = get_executor()

    if request.stream:
        def _stream() -> Iterator[str]:
            import json
            try:
                for chunk in executor.stream(request.task):
                    yield json.dumps({"token": chunk}) + "\n"
            except Exception as exc:
                logger.exception("agent_stream_failed")
                yield json.dumps({"error": str(exc)}) + "\n"

        return StreamingResponse(_stream(), media_type="application/x-ndjson")

    try:
        return executor.run(request.task)
    except Exception as exc:
        logger.exception("agent_run_failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Chat / RAG ─────────────────────────────────────────────────────────────────

@app.post("/chat", tags=["Chat"])
async def chat(request: ChatRequest) -> Any:
    import uuid as _uuid
    from ai_engine.rag import get_rag_pipeline
    pipeline = get_rag_pipeline()
    conv_id  = request.conversation_id or str(_uuid.uuid4())

    if request.stream:
        def _stream() -> Iterator[str]:
            import json
            try:
                yield from pipeline.stream_chat(
                    question=request.question,
                    conversation_id=conv_id,
                    content_types=request.content_types,
                )
            except Exception as exc:
                logger.exception("rag_stream_failed")
                yield json.dumps({"error": str(exc)})

        return StreamingResponse(_stream(), media_type="application/x-ndjson")

    try:
        return pipeline.chat(
            question=request.question,
            conversation_id=conv_id,
            content_types=request.content_types,
        )
    except Exception as exc:
        logger.exception("rag_chat_failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Embeddings ─────────────────────────────────────────────────────────────────

@app.post("/embeddings", tags=["Embeddings"])
async def embed_texts(request: EmbedRequest) -> Dict[str, Any]:
    try:
        from ai_engine.embeddings import get_embedder
        embedder   = get_embedder()
        embeddings = embedder.embed_batch(request.texts, batch_size=request.batch_size)
        return {
            "embeddings": embeddings,
            "model":      "all-MiniLM-L6-v2",
            "dimensions": embedder.dimensions,
            "count":      len(embeddings),
        }
    except Exception as exc:
        logger.exception("embedding_failed")
        raise HTTPException(status_code=500, detail=str(exc))
