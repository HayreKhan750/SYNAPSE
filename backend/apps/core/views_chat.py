"""
SYNAPSE AI Chat API — Phase 3.1 RAG Pipeline
Endpoints for conversational Q&A powered by LangChain + pgvector.
"""

import json
import logging
import uuid
from typing import Any, Dict, Optional

from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import Conversation

logger = logging.getLogger(__name__)

# ─── Explain endpoint (Phase 3.2) ────────────────────────────────────────────


class MessageDeleteView(APIView):
    """
    DELETE /api/v1/ai/chat/<conversation_id>/messages/<int:index>/

    Removes the human message at *index* (0-based) and the AI reply below it.
    Used by the frontend Edit/Delete buttons on user bubbles.
    """
    permission_classes = [AllowAny]

    def delete(self, request: Request, conversation_id: str, index: int) -> Response:
        try:
            conv = Conversation.objects.get(conversation_id=conversation_id)
        except Conversation.DoesNotExist:
            return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

        deleted = conv.delete_message_pair(index)
        if not deleted:
            return Response({"error": "Message index out of range"}, status=status.HTTP_400_BAD_REQUEST)

        # Also drop from Redis memory so the LLM context stays consistent
        try:
            from ai_engine.rag.memory import ConversationMemoryManager
            mgr = ConversationMemoryManager()
            mgr.delete_conversation(conversation_id)
            # Re-seed Redis from the updated DB messages
            if conv.messages:
                mem = mgr.get_or_create(conversation_id)
                from langchain_core.messages import HumanMessage as LCHuman, AIMessage as LCAi
                for m in conv.messages:
                    if m.get("role") == "human":
                        mem.chat_memory.add_message(LCHuman(content=m["content"]))
                    elif m.get("role") == "ai":
                        mem.chat_memory.add_message(LCAi(content=m["content"]))
        except Exception as exc:
            logger.warning("Could not sync Redis memory after message delete: %s", exc)

        return Response({"success": True, "remaining_messages": len(conv.messages)})


class ExplainView(APIView):
    """
    POST /api/v1/ai/explain

    Ask the RAG pipeline to explain a specific content item (article, paper, repo).

    Request body::

        {
            "content_type": "article" | "paper" | "repository",
            "content_id": "<uuid>",
            "title": "Optional title for context",
            "conversation_id": "optional-uuid"
        }

    Response: same shape as ChatView — {answer, sources, conversation_id}
    """
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        content_type = request.data.get('content_type', '').strip()
        content_id = request.data.get('content_id', '').strip()
        title = request.data.get('title', '').strip()
        conversation_id = request.data.get('conversation_id') or str(uuid.uuid4())

        if not content_type or not content_id:
            return Response(
                {'error': 'content_type and content_id are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build a focused question
        type_label = {'article': 'article', 'paper': 'research paper', 'repository': 'GitHub repository'}.get(
            content_type, content_type
        )
        if title:
            question = f'Explain this {type_label}: "{title}"'
        else:
            question = f'Explain the {type_label} with ID {content_id}'

        pipeline = _get_pipeline()
        if pipeline is None:
            return Response(
                {'error': 'AI pipeline is temporarily unavailable'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            result = pipeline.chat(
                question=question,
                conversation_id=conversation_id,
                content_types=[content_type + 's'] if not content_type.endswith('s') else [content_type],
            )
        except Exception as exc:
            logger.error("RAG explain error: %s", exc)
            return Response(
                {'error': 'Failed to process explain request. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Persist
        try:
            user = request.user if request.user.is_authenticated else None
            conv = _get_or_create_conversation(conversation_id, user=user)
            conv.add_message('human', question)
            conv.add_message('ai', result['answer'])
            if not conv.title and title:
                conv.title = f'Explain: {title}'[:100]
                conv.save(update_fields=['title'])
        except Exception as exc:
            logger.warning("Failed to persist explain conversation: %s", exc)

        return Response({**result, 'conversation_id': conversation_id}, status=status.HTTP_200_OK)


def _get_pipeline():
    """
    Lazy-import RAG pipeline to avoid loading at Django startup.
    Uses Google Gemini when GOOGLE_API_KEY is set; falls back to mock otherwise.
    """
    import os
    google_key = os.environ.get("GEMINI_API_KEY", "")
    has_real_key = bool(google_key and not google_key.startswith("your-"))

    if has_real_key:
        try:
            from ai_engine.rag import get_rag_pipeline
            return get_rag_pipeline()
        except Exception as exc:
            logger.error("Failed to load RAG pipeline: %s", exc)
            # fall through to mock

    logger.warning("Using mock RAG pipeline (no valid GEMINI_API_KEY configured).")
    return _MockPipeline()


class _MockPipeline:
    """
    Lightweight demo pipeline used when no real OpenAI key is configured.
    Returns plausible-looking responses drawn from the local DB so the UI
    can be tested end-to-end without any external API calls.
    """

    def chat(self, question: str, conversation_id: str, content_types=None) -> dict:
        answer = self._generate_answer(question)
        sources = self._fetch_sources(content_types)
        return {"answer": answer, "sources": sources, "conversation_id": conversation_id}

    def stream_chat(self, question: str, conversation_id: str, content_types=None):
        import json, time
        answer = self._generate_answer(question)
        sources = self._fetch_sources(content_types)
        # Yield answer word by word to simulate streaming
        words = answer.split(" ")
        for i, word in enumerate(words):
            yield (word + " ") if i < len(words) - 1 else word
        # Yield sources metadata
        yield f"__SOURCES__:{json.dumps(sources)}"

    def get_history(self, conversation_id: str):
        return []

    def delete_conversation(self, conversation_id: str):
        pass

    def _generate_answer(self, question: str) -> str:
        q = question.lower()
        if any(w in q for w in ["rag", "retrieval", "augmented"]):
            return (
                "**Retrieval-Augmented Generation (RAG)** is a technique that combines "
                "a retrieval system with a generative language model.\n\n"
                "Instead of relying solely on the model's parametric knowledge, RAG first "
                "**retrieves relevant documents** from a knowledge base (using semantic search "
                "over embeddings stored in pgvector), then feeds those documents as context "
                "into the LLM to generate a grounded answer.\n\n"
                "SYNAPSE uses RAG to answer questions about articles, research papers, "
                "GitHub repositories, and videos indexed in the platform."
            )
        if any(w in q for w in ["llm", "large language", "gpt", "transformer"]):
            return (
                "**Large Language Models (LLMs)** are neural networks trained on massive "
                "text corpora using the transformer architecture.\n\n"
                "Key properties:\n"
                "- **Scale** — billions of parameters enable emergent reasoning abilities\n"
                "- **In-context learning** — can follow instructions without fine-tuning\n"
                "- **Few-shot prompting** — examples in the prompt guide behaviour\n\n"
                "Popular LLMs include GPT-4, Claude, Gemini, LLaMA, and Mistral."
            )
        if any(w in q for w in ["trend", "trending", "popular", "top"]):
            return (
                "Based on the SYNAPSE knowledge base, here are the **top technology trends** "
                "right now:\n\n"
                "1. **Agentic AI** — autonomous agents that plan and execute multi-step tasks\n"
                "2. **Multimodal models** — vision + language + audio in a single model\n"
                "3. **Inference efficiency** — quantisation, speculative decoding, MoE\n"
                "4. **Edge AI** — running small models on devices (Phi-3, Gemma)\n"
                "5. **AI-assisted coding** — Copilot, Cursor, Devin-style tools\n\n"
                "*Note: this is a demo response — connect an OpenAI key for live RAG answers.*"
            )
        if any(w in q for w in ["explain", "summarize", "summary", "what is", "describe"]):
            topic = question.replace("Explain this", "").replace("Explain the", "").strip('" ')
            return (
                f"Here is a summary of **{topic}**:\n\n"
                "This content covers cutting-edge developments in AI and software engineering. "
                "Key themes include neural architecture innovations, scalable systems design, "
                "and practical engineering trade-offs.\n\n"
                "The work demonstrates significant improvements over prior baselines and "
                "introduces novel techniques that are likely to influence the field.\n\n"
                "*Note: this is a demo response — connect an OpenAI API key for real RAG-powered answers.*"
            )
        return (
            f"You asked: *\"{question}\"*\n\n"
            "SYNAPSE AI is ready to answer questions grounded in your knowledge base — "
            "articles, research papers, GitHub repositories, and videos.\n\n"
            "**To enable real AI answers**, set a valid `OPENAI_API_KEY` in your `.env` file "
            "and restart the backend server.\n\n"
            "In the meantime, I can demonstrate the chat UI with this demo mode. "
            "Try asking about **RAG**, **LLMs**, **trending technologies**, or click "
            "**Ask AI** on any article or paper card."
        )

    def _fetch_sources(self, content_types=None) -> list:
        """Pull a few real records from the DB to show as demo sources."""
        sources = []
        try:
            from apps.articles.models import Article
            for a in Article.objects.order_by("-published_at")[:2]:
                sources.append({
                    "title": a.title,
                    "url": a.url or "",
                    "content_type": "article",
                    "snippet": (a.summary or a.content or "")[:160],
                })
        except Exception:
            pass
        try:
            from apps.papers.models import ResearchPaper
            for p in ResearchPaper.objects.order_by("-published_at")[:1]:
                sources.append({
                    "title": p.title,
                    "url": p.pdf_url or p.arxiv_url or "",
                    "content_type": "paper",
                    "snippet": (p.summary or p.abstract or "")[:160],
                })
        except Exception:
            pass
        return sources


def _get_or_create_conversation(conversation_id: str, user=None) -> Conversation:
    """Get or create a Conversation DB record."""
    conv, _ = Conversation.objects.get_or_create(
        conversation_id=conversation_id,
        defaults={'user': user if user and user.is_authenticated else None},
    )
    return conv


class ChatView(APIView):
    """
    POST /api/v1/ai/chat

    Request body::

        {
            "question": "What is LangChain?",
            "conversation_id": "optional-uuid",     # omit to start new conversation
            "content_types": ["articles", "papers"]  # optional filter
        }

    Response::

        {
            "answer": "...",
            "sources": [{"title": ..., "url": ..., "content_type": ..., "snippet": ...}],
            "conversation_id": "uuid-..."
        }
    """
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        question = request.data.get('question', '').strip()
        if not question:
            return Response(
                {'error': 'question is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        conversation_id = request.data.get('conversation_id') or str(uuid.uuid4())
        content_types = request.data.get('content_types') or None

        pipeline = _get_pipeline()
        if pipeline is None:
            return Response(
                {'error': 'AI pipeline is temporarily unavailable'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            result = pipeline.chat(
                question=question,
                conversation_id=conversation_id,
                content_types=content_types,
            )
        except Exception as exc:
            logger.error("RAG chat error: %s", exc)
            return Response(
                {'error': 'Failed to process question. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Persist to DB
        try:
            user = request.user if request.user.is_authenticated else None
            conv = _get_or_create_conversation(conversation_id, user=user)
            conv.add_message('human', question)
            conv.add_message('ai', result['answer'])
            if not conv.title and question:
                conv.title = question[:100]
                conv.save(update_fields=['title'])
        except Exception as exc:
            logger.warning("Failed to persist conversation: %s", exc)

        return Response(result, status=status.HTTP_200_OK)


class ChatStreamView(APIView):
    """
    POST /api/v1/ai/chat/stream

    Server-Sent Events streaming endpoint. Same request body as ChatView.
    Streams tokens as SSE data events. Final event contains sources metadata.
    """
    permission_classes = [AllowAny]

    def post(self, request: Request) -> StreamingHttpResponse:
        question = request.data.get('question', '').strip()
        if not question:
            def _error():
                yield 'data: {"error": "question is required"}\n\n'
            return StreamingHttpResponse(_error(), content_type='text/event-stream')

        conversation_id = request.data.get('conversation_id') or str(uuid.uuid4())
        content_types = request.data.get('content_types') or None

        pipeline = _get_pipeline()
        if pipeline is None:
            def _unavailable():
                yield 'data: {"error": "AI pipeline unavailable"}\n\n'
            return StreamingHttpResponse(_unavailable(), content_type='text/event-stream')

        def _stream_generator():
            try:
                for token in pipeline.stream_chat(
                    question=question,
                    conversation_id=conversation_id,
                    content_types=content_types,
                ):
                    if token.startswith('__SOURCES__:'):
                        meta = token[len('__SOURCES__:'):]
                        yield f'event: sources\ndata: {meta}\n\n'
                    else:
                        safe = json.dumps(token)
                        yield f'data: {safe}\n\n'
            except Exception as exc:
                logger.error("SSE stream error: %s", exc)
                yield f'data: {{"error": "{str(exc)}"}}\n\n'
            yield 'event: done\ndata: {}\n\n'

        response = StreamingHttpResponse(
            _stream_generator(),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class ConversationHistoryView(APIView):
    """
    GET /api/v1/ai/chat/{conversation_id}/history

    Returns the full message history for a conversation.
    """
    permission_classes = [AllowAny]

    def get(self, request: Request, conversation_id: str) -> Response:
        try:
            conv = Conversation.objects.get(conversation_id=conversation_id)
        except Conversation.DoesNotExist:
            # Try fetching from pipeline memory (may exist there even if not in DB)
            pipeline = _get_pipeline()
            if pipeline:
                history = pipeline.get_history(conversation_id)
                if history:
                    return Response({
                        'conversation_id': conversation_id,
                        'messages': history,
                        'title': '',
                    })
            return Response(
                {'error': 'Conversation not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            'conversation_id': conv.conversation_id,
            'title': conv.get_title(),
            'messages': conv.messages,
            'created_at': conv.created_at.isoformat(),
            'updated_at': conv.updated_at.isoformat(),
        })


class ConversationListView(APIView):
    """
    GET /api/v1/ai/chat/conversations

    Lists conversations for the authenticated user (or anonymous sessions).
    """
    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        user = request.user if request.user.is_authenticated else None
        if user:
            conversations = Conversation.objects.filter(user=user).order_by('-updated_at')[:50]
        else:
            conversations = Conversation.objects.none()

        data = [{
            'conversation_id': c.conversation_id,
            'title': c.get_title(),
            'message_count': len(c.messages),
            'created_at': c.created_at.isoformat(),
            'updated_at': c.updated_at.isoformat(),
        } for c in conversations]

        return Response({'conversations': data})


class ConversationDeleteView(APIView):
    """
    DELETE /api/v1/ai/chat/{conversation_id}

    Deletes a conversation from DB and pipeline memory.
    """
    permission_classes = [AllowAny]

    def delete(self, request: Request, conversation_id: str) -> Response:
        # Delete from DB
        deleted_count, _ = Conversation.objects.filter(
            conversation_id=conversation_id
        ).delete()

        # Delete from pipeline memory
        pipeline = _get_pipeline()
        if pipeline:
            try:
                pipeline.delete_conversation(conversation_id)
            except Exception:
                pass

        if deleted_count == 0:
            return Response(
                {'error': 'Conversation not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({'status': 'deleted', 'conversation_id': conversation_id})
