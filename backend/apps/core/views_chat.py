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


def _extract_text_content(content) -> str:
    """
    Safely extract a plain string from an LLM response content field.
    Gemini can return content as a string or as a list of content blocks
    e.g. [{'type': 'text', 'text': '...', 'extras': {...}}].
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                parts.append(str(block.get('text', '')))
            else:
                parts.append(str(block))
        return ''.join(parts)
    return str(content) if content is not None else ''


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
                content_types=[_pluralize_content_type(content_type)],
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
            conv.save()
        except Exception as exc:
            logger.warning("Failed to persist explain conversation: %s", exc)

        return Response({**result, 'conversation_id': conversation_id}, status=status.HTTP_200_OK)


def _get_openrouter_key() -> str:
    """Return the OpenRouter API key if configured."""
    import os
    key = os.environ.get("OPENROUTER_API_KEY", "")
    if key and not key.startswith("your-"):
        return key
    return ""


def _get_gemini_keys() -> list:
    """
    Collect all configured Gemini API keys for round-robin rotation.
    Reads GEMINI_API_KEY (primary) + GEMINI_API_KEY_1 … GEMINI_API_KEY_10.
    """
    import os
    keys = []
    primary = os.environ.get("GEMINI_API_KEY", "")
    if primary and not primary.startswith("your-"):
        keys.append(primary)
    for i in range(1, 11):
        k = os.environ.get(f"GEMINI_API_KEY_{i}", "")
        if k and not k.startswith("your-") and k not in keys:
            keys.append(k)
    return keys


# Thread-safe rotation index for chat key rotation
import threading as _threading
_chat_key_lock = _threading.Lock()
_chat_key_index = 0


def _next_chat_key(keys: list) -> str:
    global _chat_key_index
    with _chat_key_lock:
        key = keys[_chat_key_index % len(keys)]
        _chat_key_index = (_chat_key_index + 1) % len(keys)
    return key


# Canonical pluralization for content_type filter values
_CONTENT_TYPE_PLURAL = {
    'article': 'articles',
    'articles': 'articles',
    'paper': 'papers',
    'papers': 'papers',
    'repository': 'repositories',
    'repositories': 'repositories',
    'video': 'videos',
    'videos': 'videos',
}


def _pluralize_content_type(ct: str) -> str:
    """Normalize a singular or plural content_type to the plural form used by the retriever."""
    return _CONTENT_TYPE_PLURAL.get(ct.lower().strip(), ct + 's')


def _get_pipeline(model: str = None):
    """
    Lazy-import RAG pipeline to avoid loading at Django startup.
    Priority: OpenRouter → Gemini → unavailable.
    Tries full RAG pipeline first; falls back to direct LLM if pgvector retriever unavailable.

    Args:
        model: Optional model override requested by the client.
    """
    import os

    openrouter_key = _get_openrouter_key()
    gemini_keys = _get_gemini_keys()

    default_model = os.environ.get("OPENROUTER_MODEL", os.environ.get("GEMINI_MODEL", "google/gemini-2.0-flash-001"))
    resolved_model = model or default_model

    if not openrouter_key and not gemini_keys:
        logger.error("No LLM API key configured (OPENROUTER_API_KEY or GEMINI_API_KEY) — chat unavailable.")
        return None

    logger.info("_get_pipeline: using model=%s openrouter=%s gemini_keys=%d",
                resolved_model, bool(openrouter_key), len(gemini_keys))

    # Try the full RAG pipeline first (pgvector + embeddings + retrieval)
    if not model:
        try:
            from ai_engine.rag import get_rag_pipeline
            return get_rag_pipeline()
        except Exception as exc:
            logger.warning("Full RAG pipeline unavailable (%s). Falling back to direct LLM.", exc)

    # Fallback: direct LLM pipeline (no retrieval, still useful for chat)
    if openrouter_key:
        return _OpenRouterDirectPipeline(api_key=openrouter_key, model=resolved_model)
    else:
        api_key = _next_chat_key(gemini_keys)
        return _GeminiDirectPipeline(api_key=api_key, model=resolved_model, all_keys=gemini_keys)


class _OpenRouterDirectPipeline:
    """
    Direct pipeline that calls any model via OpenRouter's OpenAI-compatible API.
    Supports all models available on OpenRouter (Gemini, GPT-4, Claude, etc.)
    """

    def __init__(self, api_key: str, model: str) -> None:
        import os
        self._api_key = api_key
        self._model = model
        self._base_url = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        self._histories: Dict[str, list] = {}

    def _build_llm(self, streaming: bool = False):
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=self._model,
            temperature=0.7,
            openai_api_key=self._api_key,
            openai_api_base=self._base_url,
            streaming=streaming,
            default_headers={
                "HTTP-Referer": "https://synapse.ai",
                "X-Title": "SYNAPSE Chat",
            },
        )

    def chat(self, question: str, conversation_id: str, content_types=None, files=None) -> dict:
        from langchain_core.messages import HumanMessage, SystemMessage
        history = self._histories.get(conversation_id, [])
        messages = [
            SystemMessage(content=(
                "You are SYNAPSE AI, a helpful assistant for developers and researchers. "
                "Answer questions clearly and concisely."
            ))
        ] + history + [HumanMessage(content=question)]
        response = self._build_llm().invoke(messages)
        answer = _extract_text_content(response.content if hasattr(response, 'content') else response).strip()
        self._histories.setdefault(conversation_id, [])
        self._histories[conversation_id].append(HumanMessage(content=question))
        self._histories[conversation_id].append(response)
        return {"answer": answer, "sources": [], "conversation_id": conversation_id}

    def stream_chat(self, question: str, conversation_id: str, content_types=None, files=None):
        import json
        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
        history = self._histories.get(conversation_id, [])
        messages = [
            SystemMessage(content=(
                "You are SYNAPSE AI, a helpful assistant for developers and researchers. "
                "Answer questions clearly and concisely."
            ))
        ] + history + [HumanMessage(content=question)]
        full_answer = ""
        for chunk in self._build_llm(streaming=True).stream(messages):
            token = _extract_text_content(chunk.content if hasattr(chunk, 'content') else chunk)
            if token:
                full_answer += token
                yield token
        self._histories.setdefault(conversation_id, [])
        self._histories[conversation_id].append(HumanMessage(content=question))
        self._histories[conversation_id].append(AIMessage(content=full_answer))
        yield f"__SOURCES__:{json.dumps([])}"

    def get_history(self, conversation_id: str):
        return []

    def delete_conversation(self, conversation_id: str):
        self._histories.pop(conversation_id, None)


class _GeminiDirectPipeline:
    """
    Fallback pipeline that calls Google Gemini directly via langchain-google-genai
    when the full RAG pipeline (pgvector retriever) is unavailable.
    Supports multi-key rotation — tries next key on 429 quota errors.
    """

    def __init__(self, api_key: str, model: str, all_keys: list = None) -> None:
        self._api_key = api_key
        self._model = model
        self._all_keys = all_keys or [api_key]
        self._histories: Dict[str, list] = {}

    def _build_llm(self, api_key: str = None):
        from langchain_google_genai import ChatGoogleGenerativeAI  # noqa: PLC0415
        return ChatGoogleGenerativeAI(
            model=self._model,
            temperature=0.7,
            google_api_key=api_key or self._api_key,
        )

    def _invoke_with_rotation(self, messages):
        """Try each API key in rotation until one succeeds."""
        last_exc = None
        for key in self._all_keys:
            try:
                llm = self._build_llm(api_key=key)
                return llm.invoke(messages)
            except Exception as exc:
                exc_str = str(exc).lower()
                if "429" in exc_str or "resource_exhausted" in exc_str or "quota" in exc_str:
                    logger.warning("Key quota exhausted, trying next key. Error: %s", exc)
                    last_exc = exc
                    continue
                raise  # non-quota error — raise immediately
        raise last_exc or Exception("All Gemini API keys exhausted")

    def _stream_with_rotation(self, messages):
        """Try each API key in rotation for streaming until one succeeds."""
        last_exc = None
        for key in self._all_keys:
            try:
                llm = self._build_llm(api_key=key)
                yield from llm.stream(messages)
                return
            except Exception as exc:
                exc_str = str(exc).lower()
                if "429" in exc_str or "resource_exhausted" in exc_str or "quota" in exc_str:
                    logger.warning("Key quota exhausted for streaming, trying next. Error: %s", exc)
                    last_exc = exc
                    continue
                raise
        raise last_exc or Exception("All Gemini API keys exhausted")

    def _build_human_message(self, question: str, files=None):
        """
        Build a HumanMessage that includes any uploaded files as inline data parts.
        Supports images (sent as base64 inline) and text files (sent as text).
        """
        from langchain_core.messages import HumanMessage  # noqa: PLC0415
        import base64  # noqa: PLC0415

        if not files:
            return HumanMessage(content=question)

        # Build multipart content list for Gemini vision
        content_parts = []
        for f in files:
            mime = f.content_type or 'application/octet-stream'
            if mime.startswith('image/'):
                data = base64.b64encode(f.read()).decode('utf-8')
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{data}"},
                })
            else:
                # Text-based files — read and inject as text
                try:
                    text = f.read().decode('utf-8', errors='replace')
                    content_parts.append({
                        "type": "text",
                        "text": f"[File: {f.name}]\n{text}",
                    })
                except Exception:
                    pass

        if question:
            content_parts.append({"type": "text", "text": question})

        return HumanMessage(content=content_parts)

    def chat(self, question: str, conversation_id: str, content_types=None, files=None) -> dict:
        from langchain_core.messages import HumanMessage, SystemMessage  # noqa: PLC0415
        history = self._histories.get(conversation_id, [])
        human_msg = self._build_human_message(question, files)
        messages = [
            SystemMessage(content=(
                "You are SYNAPSE AI, a helpful assistant for developers and researchers. "
                "Answer questions clearly and concisely. When images are provided, describe and analyse them thoroughly."
            ))
        ] + history + [human_msg]
        response = self._invoke_with_rotation(messages)
        raw = response.content if hasattr(response, 'content') else response
        answer = _extract_text_content(raw).strip()
        self._histories.setdefault(conversation_id, [])
        # Store only plain text version in history to avoid huge base64 in memory
        self._histories[conversation_id].append(HumanMessage(content=question or '[image/file]'))
        self._histories[conversation_id].append(response)
        return {"answer": answer, "sources": [], "conversation_id": conversation_id}

    def stream_chat(self, question: str, conversation_id: str, content_types=None, files=None):
        import json  # noqa: PLC0415
        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage  # noqa: PLC0415
        history = self._histories.get(conversation_id, [])
        human_msg = self._build_human_message(question, files)
        messages = [
            SystemMessage(content=(
                "You are SYNAPSE AI, a helpful assistant for developers and researchers. "
                "Answer questions clearly and concisely. When images are provided, describe and analyse them thoroughly."
            ))
        ] + history + [human_msg]
        full_answer = ""
        for chunk in self._stream_with_rotation(messages):
            token = _extract_text_content(chunk.content if hasattr(chunk, 'content') else chunk)
            if token:
                full_answer += token
                yield token
        self._histories.setdefault(conversation_id, [])
        self._histories[conversation_id].append(HumanMessage(content=question or '[image/file]'))
        self._histories[conversation_id].append(AIMessage(content=full_answer))
        yield f"__SOURCES__:{json.dumps([])}"

    def get_history(self, conversation_id: str):
        return []

    def delete_conversation(self, conversation_id: str):
        self._histories.pop(conversation_id, None)


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
        model = request.data.get('model', '').strip() or None
        files = request.FILES.getlist('files') or []

        pipeline = _get_pipeline(model=model)
        if pipeline is None:
            return Response(
                {'error': 'AI pipeline is temporarily unavailable'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            chat_kwargs: dict = {
                "question": question,
                "conversation_id": conversation_id,
                "content_types": content_types,
            }
            # Only pass files to pipelines that support multimodal input
            if files and hasattr(pipeline, '_build_human_message'):
                chat_kwargs["files"] = files
            result = pipeline.chat(**chat_kwargs)
        except Exception as exc:
            logger.error("RAG chat error: %s", exc, exc_info=True)
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
            conv.save()
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
        model = request.data.get('model', '').strip() or None
        files = request.FILES.getlist('files') or []

        pipeline = _get_pipeline(model=model)
        if pipeline is None:
            def _unavailable():
                yield 'data: {"error": "AI pipeline unavailable"}\n\n'
            return StreamingHttpResponse(_unavailable(), content_type='text/event-stream')

        user = request.user if request.user.is_authenticated else None
        use_files = files if hasattr(pipeline, '_build_human_message') else None

        def _stream_generator():
            full_answer = ""
            try:
                for token in pipeline.stream_chat(
                    question=question,
                    conversation_id=conversation_id,
                    content_types=content_types,
                    **({"files": use_files} if use_files is not None else {}),
                ):
                    if token.startswith('__SOURCES__:'):
                        meta = token[len('__SOURCES__:'):]
                        yield f'event: sources\ndata: {meta}\n\n'
                    else:
                        full_answer += token
                        safe = json.dumps(token)
                        yield f'data: {safe}\n\n'
            except Exception as exc:
                exc_str = str(exc).lower()
                logger.error("SSE stream error: %s", exc, exc_info=True)
                if "429" in exc_str or "resource_exhausted" in exc_str or "quota" in exc_str:
                    msg = "All AI quota limits reached. Please try again in a few minutes or add more API keys."
                elif "api_key" in exc_str or "invalid" in exc_str or "authentication" in exc_str:
                    msg = "AI service authentication error. Please check your API key configuration."
                else:
                    msg = "AI service temporarily unavailable. Please try again."
                yield f'data: {{"error": {json.dumps(msg)}}}\n\n'

            # Persist conversation to DB after streaming completes
            try:
                conv = _get_or_create_conversation(conversation_id, user=user)
                conv.add_message('human', question)
                conv.add_message('ai', full_answer)
                if not conv.title and question:
                    conv.title = question[:100]
                conv.save()
            except Exception as exc:
                logger.warning("Failed to persist streamed conversation: %s", exc)

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
                    # Normalize: pipeline memory stores turns as {"human": ..., "ai": ..., "ts": ...}
                    # but the frontend expects {"role": ..., "content": ..., "ts": ...}
                    normalized = []
                    for turn in history:
                        if 'role' in turn and 'content' in turn:
                            # Already in the correct format
                            normalized.append({
                                'role': turn['role'],
                                'content': str(turn['content']) if not isinstance(turn['content'], str) else turn['content'],
                                'ts': turn.get('ts', 0),
                            })
                        else:
                            # Convert from {"human": ..., "ai": ..., "ts": ...} format
                            ts = turn.get('ts', 0)
                            if 'human' in turn:
                                normalized.append({'role': 'human', 'content': str(turn['human']), 'ts': ts})
                            if 'ai' in turn:
                                normalized.append({'role': 'ai', 'content': str(turn['ai']), 'ts': ts})
                    return Response({
                        'conversation_id': conversation_id,
                        'messages': normalized,
                        'title': '',
                    })
            return Response(
                {'error': 'Conversation not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Ensure every message's content is a plain string — legacy records may
        # have had a dict/object accidentally stored as content.
        safe_messages = []
        for m in conv.messages:
            content = m.get('content', '')
            if not isinstance(content, str):
                content = str(content)
            safe_messages.append({**m, 'content': content})

        return Response({
            'conversation_id': conv.conversation_id,
            'title': conv.get_title(),
            'messages': safe_messages,
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
