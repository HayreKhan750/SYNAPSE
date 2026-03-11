"""
SYNAPSE RAG Retriever — pgvector-backed document retrieval using LangChain PGVector.

Embeddings: always sentence-transformers (local, free, no API key required).
OpenAI / langchain_openai is NOT used anywhere in this file.
"""

import logging
import os
from typing import List, Optional

from langchain_community.vectorstores import PGVector
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from pydantic import Field

from ai_engine.embeddings import get_embedder

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Connection string helper
# ---------------------------------------------------------------------------

def _build_connection_string() -> str:
    """Build PostgreSQL connection string from environment variables."""
    return (
        f"postgresql+psycopg2://"
        f"{os.environ.get('DB_USER', 'synapse_user')}:"
        f"{os.environ.get('DB_PASSWORD', 'synapse_pass')}@"
        f"{os.environ.get('DB_HOST', 'localhost')}:"
        f"{os.environ.get('DB_PORT', '5432')}/"
        f"{os.environ.get('DB_NAME', 'synapse_db')}"
    )


# ---------------------------------------------------------------------------
# LangChain-compatible embedding wrapper
# ---------------------------------------------------------------------------

class SynapseEmbeddingWrapper:
    """Wraps SynapseEmbedder so it satisfies LangChain's Embeddings interface."""

    def __init__(self) -> None:
        self._embedder = get_embedder()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        import numpy as np
        vectors = self._embedder.embed_batch(texts)
        if isinstance(vectors, np.ndarray):
            return vectors.tolist()
        return [v.tolist() if hasattr(v, "tolist") else v for v in vectors]

    def embed_query(self, text: str) -> List[float]:
        import numpy as np
        vector = self._embedder.embed(text)
        if isinstance(vector, np.ndarray):
            return vector.tolist()
        return vector


def _get_lc_embeddings():
    """Return LangChain-compatible embedding function (always local sentence-transformers)."""
    return SynapseEmbeddingWrapper()


# ---------------------------------------------------------------------------
# PGVector collection names — one per content type
# ---------------------------------------------------------------------------

COLLECTION_NAMES = {
    "articles": "article_embeddings",
    "papers": "researchpaper_embeddings",
    "repositories": "repository_embeddings",
    "videos": "video_embeddings",
}

ALL_COLLECTIONS = list(COLLECTION_NAMES.values())


# ---------------------------------------------------------------------------
# SynapseRetriever
# ---------------------------------------------------------------------------

class SynapseRetriever(BaseRetriever):
    """
    Retrieves the most relevant SYNAPSE knowledge-base documents for a query.

    Searches across all content types (articles, papers, repositories, videos)
    using cosine similarity in pgvector, then merges and re-ranks results.
    """

    k: int = Field(default=5, description="Number of documents to retrieve per collection")
    score_threshold: float = Field(default=0.0, description="Minimum similarity score")
    content_types: List[str] = Field(
        default_factory=lambda: list(COLLECTION_NAMES.keys()),
        description="Content types to search",
    )
    connection_string: str = Field(default_factory=_build_connection_string)

    class Config:
        arbitrary_types_allowed = True

    def _get_vectorstore(self, collection_name: str) -> PGVector:
        """Return a PGVector store for the given collection."""
        return PGVector(
            collection_name=collection_name,
            connection_string=self.connection_string,
            embedding_function=_get_lc_embeddings(),
        )

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> List[Document]:
        """Retrieve and merge documents from all enabled content-type collections."""
        all_docs: List[Document] = []

        for content_type in self.content_types:
            collection = COLLECTION_NAMES.get(content_type)
            if not collection:
                continue
            try:
                store = self._get_vectorstore(collection)
                if self.score_threshold > 0:
                    docs_with_scores = store.similarity_search_with_score(
                        query, k=self.k
                    )
                    docs = [
                        doc
                        for doc, score in docs_with_scores
                        if score >= self.score_threshold
                    ]
                    # Attach score to metadata
                    for doc, score in docs_with_scores:
                        if score >= self.score_threshold:
                            doc.metadata["similarity_score"] = float(score)
                else:
                    docs = store.similarity_search(query, k=self.k)

                # Tag each doc with its content type
                for doc in docs:
                    doc.metadata.setdefault("content_type", content_type)

                all_docs.extend(docs)
            except Exception as exc:
                logger.warning(
                    "Failed to retrieve from collection '%s': %s",
                    collection,
                    exc,
                )

        # De-duplicate by source URL / id, keep highest-scored
        seen: dict = {}
        for doc in all_docs:
            key = doc.metadata.get("source") or doc.metadata.get("id") or doc.page_content[:80]
            score = doc.metadata.get("similarity_score", 0.0)
            if key not in seen or score > seen[key].metadata.get("similarity_score", 0.0):
                seen[key] = doc

        # Sort by similarity score descending, return top k overall
        merged = sorted(
            seen.values(),
            key=lambda d: d.metadata.get("similarity_score", 0.0),
            reverse=True,
        )
        return merged[: self.k * len(self.content_types)]
