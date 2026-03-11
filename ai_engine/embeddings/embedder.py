"""
ai_engine.embeddings.embedder
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Embedding generation using sentence-transformers (all-MiniLM-L6-v2).

Model choice:
  - Primary (and only): sentence-transformers/all-MiniLM-L6-v2 (384 dims, local, free)
  - No OpenAI or external embedding API is used — EMBEDDING_PROVIDER=local always.

Batch processing defaults: 32 items per batch (configurable via env).

Phase 2.3 — Vector embeddings & semantic search (pgvector)
"""
from __future__ import annotations

import logging
import os
import time
from typing import List, Optional

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────
_MODEL_NAME = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
_BATCH_SIZE = int(os.environ.get("EMBEDDING_BATCH_SIZE", "32"))
# EMBEDDING_PROVIDER is always "local" — sentence-transformers, no API key needed.

# Singleton instance (loaded lazily)
_embedder_instance: Optional["SynapseEmbedder"] = None


class SynapseEmbedder:
    """
    Local sentence-transformers embedding engine.
    Use :func:`get_embedder` to obtain the module-level singleton.
    """

    def __init__(self) -> None:
        self._model = None
        self.dimensions: int = 384
        self._load_model()

    # ── Model Loading ──────────────────────────────────────────────────────────

    def _load_model(self) -> None:
        """Load the embedding model (lazy, called once at startup)."""
        self._load_sentence_transformers()

    def _load_sentence_transformers(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer  # noqa: PLC0415
            logger.info("Loading sentence-transformer model: %s", _MODEL_NAME)
            self._model = SentenceTransformer(_MODEL_NAME)
            self.dimensions = self._model.get_sentence_embedding_dimension()
            logger.info(
                "Sentence-transformer loaded — model=%s, dims=%d",
                _MODEL_NAME, self.dimensions,
            )
        except ImportError:
            logger.error(
                "sentence-transformers not installed. "
                "Run: pip install sentence-transformers"
            )
            raise

    # ── Public API ─────────────────────────────────────────────────────────────

    def embed(self, text: str) -> List[float]:
        """
        Generate an embedding vector for a single text string.

        Args:
            text: The input text to embed.

        Returns:
            A list of floats representing the embedding vector.
        """
        if not text or not text.strip():
            return [0.0] * self.dimensions

        text = _truncate_text(text)

        return self._embed_local([text])[0]

    def embed_batch(self, texts: List[str], batch_size: int = _BATCH_SIZE) -> List[List[float]]:
        """
        Generate embeddings for a list of text strings in batches.

        Args:
            texts:      List of input texts.
            batch_size: Number of texts to process per batch.

        Returns:
            List of embedding vectors, one per input text.
        """
        if not texts:
            return []

        # Sanitise inputs
        clean_texts = [_truncate_text(t) if t and t.strip() else "" for t in texts]
        results: List[List[float]] = []

        for i in range(0, len(clean_texts), batch_size):
            batch = clean_texts[i: i + batch_size]
            start = time.time()
            batch_embeddings = self._embed_local(batch)
            elapsed = round(time.time() - start, 2)
            logger.debug(
                "Embedded batch %d-%d in %.2fs",
                i, i + len(batch), elapsed,
            )
            results.extend(batch_embeddings)

        return results

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _embed_local(self, texts: List[str]) -> List[List[float]]:
        """Embed texts using sentence-transformers (local inference)."""
        embeddings = self._model.encode(
            texts,
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        return [emb.tolist() for emb in embeddings]

# ── Utilities ──────────────────────────────────────────────────────────────────

def _truncate_text(text: str, max_chars: int = 8192) -> str:
    """Truncate text to avoid exceeding model token limits."""
    return text[:max_chars] if len(text) > max_chars else text


# ── Singleton helpers ──────────────────────────────────────────────────────────

def get_embedder() -> SynapseEmbedder:
    """Return the singleton SynapseEmbedder, loading it on first call."""
    global _embedder_instance
    if _embedder_instance is None:
        _embedder_instance = SynapseEmbedder()
    return _embedder_instance


def embed_text(text: str) -> List[float]:
    """Convenience wrapper — embed a single text string."""
    return get_embedder().embed(text)


def embed_batch(texts: List[str], batch_size: int = _BATCH_SIZE) -> List[List[float]]:
    """Convenience wrapper — embed a list of text strings in batches."""
    return get_embedder().embed_batch(texts, batch_size=batch_size)
