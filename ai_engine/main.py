"""
SYNAPSE AI Engine — FastAPI Service Entry Point
Phase 5.1 — Agent Framework

Provides REST endpoints for:
- Agent task execution (sync + streaming)
- RAG chat pipeline
- Health checks

Usage (Docker / local):
    uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Iterator, List, Optional

from dotenv import load_dotenv

# Load .env from project root (two levels up from ai_engine/)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ────────────────────────────────────────────────────────────
# FastAPI App
# ────────────────────────────────────────────────────────────

app = FastAPI(
    title="SYNAPSE AI Engine",
    description="AI Agent Framework & RAG Pipeline Service for SYNAPSE",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────────────────────────────────────────────
# Request / Response Models
# ────────────────────────────────────────────────────────────

class AgentRunRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=4000, description="Task prompt for the agent")
    tool_names: Optional[List[str]] = Field(None, description="Restrict agent to specific tools")
    stream: bool = Field(False, description="Whether to stream the response")


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = Field(None, description="Conversation session ID")
    content_types: Optional[List[str]] = Field(None, description="Filter retrieval by content type")
    stream: bool = Field(False, description="Whether to stream the response")


# ────────────────────────────────────────────────────────────
# Health Check
# ────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health() -> Dict[str, Any]:
    """Basic liveness probe."""
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    return {
        "status": "ok",
        "service": "synapse-ai-engine",
        "llm": "openrouter" if openrouter_key else ("gemini" if gemini_key else "unconfigured"),
        "model": os.environ.get("OPENROUTER_MODEL", os.environ.get("GEMINI_MODEL", "unknown")),
    }


@app.get("/health/rag", tags=["System"])
async def health_rag() -> Dict[str, Any]:
    """RAG pipeline health check."""
    try:
        from ai_engine.rag import get_rag_pipeline
        pipeline = get_rag_pipeline()
        return pipeline.health_check()
    except Exception as exc:
        return {"status": "degraded", "error": str(exc)}


# ────────────────────────────────────────────────────────────
# Agent Endpoints
# ────────────────────────────────────────────────────────────

@app.get("/agents/tools", tags=["Agents"])
async def list_tools() -> Dict[str, Any]:
    """List all registered agent tools."""
    try:
        from ai_engine.agents import get_executor
        executor = get_executor()
        return {"tools": executor.list_tools(), "count": len(executor.list_tools())}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/agents/run", tags=["Agents"])
async def run_agent(request: AgentRunRequest) -> Any:
    """Execute an agent task synchronously or as a stream."""
    from ai_engine.agents import get_executor
    executor = get_executor()

    if request.stream:
        def _stream_generator() -> Iterator[str]:
            import json
            try:
                for event in executor.stream(task=request.task, tool_names=request.tool_names):
                    yield f"data: {json.dumps(event)}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(_stream_generator(), media_type="text/event-stream")

    try:
        result = executor.run(task=request.task, tool_names=request.tool_names)
        return result
    except Exception as exc:
        logger.exception("Agent run failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/agents/health", tags=["Agents"])
async def agent_health() -> Dict[str, Any]:
    """Agent executor health check."""
    try:
        from ai_engine.agents import get_executor
        executor = get_executor()
        return executor.health()
    except Exception as exc:
        return {"status": "degraded", "error": str(exc)}


# ────────────────────────────────────────────────────────────
# RAG Chat Endpoints
# ────────────────────────────────────────────────────────────

@app.post("/chat", tags=["Chat"])
async def chat(request: ChatRequest) -> Any:
    """Send a question to the RAG pipeline."""
    import uuid
    from ai_engine.rag import get_rag_pipeline

    conversation_id = request.conversation_id or str(uuid.uuid4())

    if request.stream:
        def _stream():
            import json
            try:
                pipeline = get_rag_pipeline()
                for token in pipeline.stream_chat(
                    question=request.question,
                    conversation_id=conversation_id,
                    content_types=request.content_types,
                ):
                    if token.startswith("__SOURCES__:"):
                        meta = token[len("__SOURCES__:"):]
                        yield f"event: sources\ndata: {meta}\n\n"
                    else:
                        yield f"data: {json.dumps(token)}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "event: done\ndata: {}\n\n"

        return StreamingResponse(_stream(), media_type="text/event-stream")

    try:
        pipeline = get_rag_pipeline()
        result = pipeline.chat(
            question=request.question,
            conversation_id=conversation_id,
            content_types=request.content_types,
        )
        return result
    except Exception as exc:
        logger.exception("RAG chat failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ────────────────────────────────────────────────────────────
# Embeddings endpoint (used by scraper/Django to trigger embedding)
# ────────────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to embed")


@app.post("/embeddings", tags=["Embeddings"])
async def embed_texts(request: EmbedRequest) -> Dict[str, Any]:
    """Embed a list of texts using local sentence-transformers."""
    try:
        from ai_engine.embeddings import get_embedder
        embedder = get_embedder()
        vectors = embedder.embed_batch(request.texts)
        # Convert numpy arrays to lists for JSON serialisation
        if hasattr(vectors, "tolist"):
            vectors = vectors.tolist()
        else:
            vectors = [v.tolist() if hasattr(v, "tolist") else v for v in vectors]
        return {"embeddings": vectors, "count": len(vectors), "dimensions": len(vectors[0]) if vectors else 0}
    except Exception as exc:
        logger.exception("Embedding failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
