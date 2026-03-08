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


def _get_pipeline():
    """Lazy-import RAG pipeline to avoid loading at Django startup."""
    try:
        from ai_engine.rag import get_rag_pipeline
        return get_rag_pipeline()
    except Exception as exc:
        logger.error("Failed to load RAG pipeline: %s", exc)
        return None


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
