"""
SYNAPSE Conversation Memory Manager
Manages per-conversation history using ConversationBufferWindowMemory (last 10 turns).
Redis is used for persistence. Redis is REQUIRED — no in-memory fallback to prevent
silent data loss on worker restarts.
"""

import json
import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional

import redis
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

logger = logging.getLogger(__name__)

# TTL for conversation sessions in Redis (24 hours)
CONVERSATION_TTL = 86400
# Maximum turns to keep in window memory
MEMORY_WINDOW_K = 10


# ---------------------------------------------------------------------------
# Redis client (lazy, best-effort)
# ---------------------------------------------------------------------------

def _get_redis_client() -> redis.Redis:
    """
    Return a connected Redis client. Raises RuntimeError if Redis is unreachable.
    Redis is required — there is no in-memory fallback (would cause silent data loss
    on worker restart).
    """
    try:
        client = redis.Redis(
            host=os.environ.get("REDIS_HOST", "localhost"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
            db=int(os.environ.get("REDIS_CHAT_DB", 3)),
            decode_responses=True,
            socket_connect_timeout=2,
        )
        client.ping()
        return client
    except Exception as exc:
        logger.critical(
            "Redis connection failed — conversation history unavailable. "
            "Ensure Redis is running and REDIS_HOST/REDIS_PORT are set correctly. "
            "Error: %s", exc
        )
        raise RuntimeError(
            f"Redis connection failed — conversation history disabled. "
            f"Check REDIS_HOST and REDIS_PORT environment variables. Original error: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# ConversationMemoryManager
# ---------------------------------------------------------------------------

class SimpleWindowMemory:
    """
    Lightweight replacement for ConversationBufferWindowMemory.
    Stores the last k turns as LangChain message objects.
    """

    def __init__(self, k: int = MEMORY_WINDOW_K) -> None:
        self.k = k
        self._messages: List[BaseMessage] = []

    @property
    def messages(self) -> List[BaseMessage]:
        """Return the last 2*k messages (k human + k ai pairs)."""
        return self._messages[-(self.k * 2):]

    def add_user_message(self, content: str) -> None:
        self._messages.append(HumanMessage(content=content))

    def add_ai_message(self, content: str) -> None:
        self._messages.append(AIMessage(content=content))


class ConversationMemoryManager:
    """
    Manages SimpleWindowMemory instances keyed by conversation_id.
    Persists message history to Redis so memory survives worker restarts.
    Redis is REQUIRED — instantiation will raise RuntimeError if Redis is down.
    """

    def __init__(self) -> None:
        self._cache: Dict[str, SimpleWindowMemory] = {}
        self._redis = _get_redis_client()  # raises RuntimeError if unavailable

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_or_create(self, conversation_id: str) -> SimpleWindowMemory:
        """Return existing memory for *conversation_id* or create a new one."""
        if conversation_id not in self._cache:
            memory = SimpleWindowMemory(k=MEMORY_WINDOW_K)
            # Hydrate from Redis if history exists
            history = self._load_history(conversation_id)
            for turn in history:
                memory.add_user_message(turn["human"])
                memory.add_ai_message(turn["ai"])
            self._cache[conversation_id] = memory
        return self._cache[conversation_id]

    def save_turn(
        self,
        conversation_id: str,
        human_message: str,
        ai_message: str,
    ) -> None:
        """Persist a new conversation turn to Redis."""
        key = self._redis_key(conversation_id)
        try:
            history = self._load_history(conversation_id)
            history.append({"human": human_message, "ai": ai_message, "ts": time.time()})
            # Keep only the last MEMORY_WINDOW_K turns in Redis too
            history = history[-MEMORY_WINDOW_K:]
            self._redis.setex(key, CONVERSATION_TTL, json.dumps(history))
        except Exception as exc:
            logger.warning("Failed to persist conversation turn: %s", exc)

    def get_history(self, conversation_id: str) -> List[Dict[str, Any]]:
        """Return the raw message history for *conversation_id*."""
        return self._load_history(conversation_id)

    def delete_conversation(self, conversation_id: str) -> None:
        """Remove conversation from both in-memory cache and Redis."""
        self._cache.pop(conversation_id, None)
        try:
            self._redis.delete(self._redis_key(conversation_id))
        except Exception:
            pass

    def list_conversations(self, user_prefix: str) -> List[str]:
        """List conversation IDs for a given user prefix (best-effort)."""
        try:
            pattern = self._redis_key(f"{user_prefix}:*")
            keys = self._redis.keys(pattern)
            return [k.replace("synapse:chat:", "") for k in keys]
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _redis_key(conversation_id: str) -> str:
        return f"synapse:chat:{conversation_id}"

    def _load_history(self, conversation_id: str) -> List[Dict[str, Any]]:
        if self._redis is None:
            return []
        try:
            raw = self._redis.get(self._redis_key(conversation_id))
            if raw:
                return json.loads(raw)
        except Exception as exc:
            logger.warning("Failed to load conversation history: %s", exc)
        return []

    # ------------------------------------------------------------------
    # Static factory helpers
    # ------------------------------------------------------------------

    @staticmethod
    def new_conversation_id(user_id: Optional[str] = None) -> str:
        """Generate a unique conversation ID, optionally namespaced by user."""
        uid = str(uuid.uuid4())
        if user_id:
            return f"{user_id}:{uid}"
        return uid
