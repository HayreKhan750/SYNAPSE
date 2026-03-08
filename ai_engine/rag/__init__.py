"""
SYNAPSE RAG (Retrieval-Augmented Generation) Pipeline
Phase 3.1 — LangChain + pgvector + OpenAI

Imports are lazy to avoid loading heavy ML dependencies at Django startup.
Use get_rag_pipeline() as the primary entry point.
"""


def get_rag_pipeline(*args, **kwargs):
    """Lazy entry point — imports RAGPipeline only when first called."""
    from .pipeline import get_rag_pipeline as _get
    return _get(*args, **kwargs)


def __getattr__(name):
    """Lazy attribute access for the public symbols."""
    _map = {
        "SynapseRetriever": ("ai_engine.rag.retriever", "SynapseRetriever"),
        "SynapseRAGChain": ("ai_engine.rag.chain", "SynapseRAGChain"),
        "ConversationMemoryManager": ("ai_engine.rag.memory", "ConversationMemoryManager"),
        "RAGPipeline": ("ai_engine.rag.pipeline", "RAGPipeline"),
    }
    if name in _map:
        import importlib
        module_path, cls_name = _map[name]
        mod = importlib.import_module(module_path)
        return getattr(mod, cls_name)
    raise AttributeError(f"module 'ai_engine.rag' has no attribute {name!r}")


__all__ = [
    "SynapseRetriever",
    "SynapseRAGChain",
    "ConversationMemoryManager",
    "RAGPipeline",
    "get_rag_pipeline",
]
