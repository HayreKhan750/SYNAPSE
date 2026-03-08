"""
SYNAPSE RAG Chain — ConversationalRetrievalChain powered by LangChain + OpenAI.
Includes system prompt grounded in the knowledge base with source citation support.
"""

import logging
import os
from typing import Any, AsyncIterator, Dict, Iterator, List, Optional

from langchain.chains import ConversationalRetrievalChain
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder, PromptTemplate
from langchain_openai import ChatOpenAI

from .memory import ConversationMemoryManager
from .retriever import SynapseRetriever

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are SYNAPSE AI, an intelligent assistant with deep knowledge \
of technology, software engineering, AI/ML research, and developer tools. \
You answer questions based on the curated knowledge base of articles, research papers, \
GitHub repositories, and videos collected by SYNAPSE.

Guidelines:
- Ground your answers in the retrieved context documents provided.
- If the context does not contain enough information, say so honestly and provide \
  general knowledge while noting it is not from the SYNAPSE knowledge base.
- Always cite the sources you used by referencing the document titles and URLs.
- Be concise, accurate, and helpful.
- Format code snippets with appropriate markdown code fences.
- When discussing research papers, mention the key findings and authors when known.

Knowledge Base Context:
{context}
"""

CONDENSE_QUESTION_PROMPT = PromptTemplate.from_template(
    """Given the following conversation history and a follow-up question, \
rephrase the follow-up question to be a standalone question that captures \
all necessary context from the conversation.

Conversation History:
{chat_history}

Follow-up Question: {question}

Standalone Question:"""
)


def _format_context_with_sources(docs: List[Document]) -> str:
    """Format retrieved documents into a numbered context block."""
    parts = []
    for i, doc in enumerate(docs, 1):
        meta = doc.metadata
        title = meta.get("title", meta.get("name", "Untitled"))
        url = meta.get("source", meta.get("url", ""))
        content_type = meta.get("content_type", "document")
        score = meta.get("similarity_score", "")
        score_str = f" (relevance: {score:.3f})" if score else ""

        header = f"[{i}] {content_type.upper()}: {title}{score_str}"
        if url:
            header += f"\n    URL: {url}"
        body = doc.page_content.strip()
        parts.append(f"{header}\n{body}")
    return "\n\n---\n\n".join(parts)


# ---------------------------------------------------------------------------
# SynapseRAGChain
# ---------------------------------------------------------------------------

class SynapseRAGChain:
    """
    Wraps LangChain's ConversationalRetrievalChain with SYNAPSE-specific:
      - System prompt grounded in the knowledge base
      - Source citation extraction
      - Streaming support
      - Conversation memory integration
    """

    def __init__(
        self,
        retriever: SynapseRetriever,
        memory_manager: ConversationMemoryManager,
        model_name: str = "gpt-3.5-turbo",
        temperature: float = 0.2,
        max_tokens: int = 1024,
        streaming: bool = False,
    ) -> None:
        self.retriever = retriever
        self.memory_manager = memory_manager
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.streaming = streaming

        self._llm = ChatOpenAI(
            model=model_name,
            temperature=temperature,
            max_tokens=max_tokens,
            streaming=streaming,
            openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
        )

        # Text splitter for chunking long retrieved documents
        self._text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chat(
        self,
        question: str,
        conversation_id: str,
        content_types: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Process a user question and return the answer with source citations.

        Returns:
            {
                "answer": str,
                "sources": [{"title": str, "url": str, "content_type": str, "snippet": str}],
                "conversation_id": str,
            }
        """
        memory = self.memory_manager.get_or_create(conversation_id)

        # Override retriever content types if specified
        if content_types:
            self.retriever.content_types = content_types

        # Retrieve relevant documents
        docs = self.retriever.get_relevant_documents(question)

        # Build context string
        context = _format_context_with_sources(docs) if docs else "No relevant documents found in the knowledge base."

        # Build the full prompt with context injected
        system_msg_with_ctx = SYSTEM_PROMPT.format(context=context)

        # Build conversation messages
        chat_history = memory.chat_memory.messages

        # Build chain
        chain = ConversationalRetrievalChain.from_llm(
            llm=self._llm,
            retriever=self.retriever,
            memory=memory,
            condense_question_prompt=CONDENSE_QUESTION_PROMPT,
            return_source_documents=True,
            verbose=False,
            combine_docs_chain_kwargs={
                "prompt": self._build_qa_prompt(system_msg_with_ctx),
                "document_variable_name": "context",
            },
        )

        try:
            result = chain({"question": question})
        except Exception as exc:
            logger.error("RAG chain error: %s", exc)
            raise

        answer = result.get("answer", "")
        source_docs = result.get("source_documents", docs)

        # Persist turn to Redis
        self.memory_manager.save_turn(conversation_id, question, answer)

        return {
            "answer": answer,
            "sources": self._extract_sources(source_docs),
            "conversation_id": conversation_id,
        }

    def chat_with_context(
        self,
        question: str,
        conversation_id: str,
        content_types: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Alternative: manually retrieve docs, build prompt, and call LLM directly.
        Used for SSE streaming where we want more control.
        """
        memory = self.memory_manager.get_or_create(conversation_id)

        if content_types:
            self.retriever.content_types = content_types

        # Step 1: Retrieve docs
        docs = self.retriever.get_relevant_documents(question)
        context = _format_context_with_sources(docs) if docs else "No relevant documents found."

        # Step 2: Condense question if there's history
        chat_history = memory.chat_memory.messages
        condensed_question = question
        if chat_history:
            condensed_question = self._condense_question(question, chat_history)

        # Step 3: Build final prompt
        system_content = SYSTEM_PROMPT.format(context=context)

        from langchain_core.messages import SystemMessage
        messages = [SystemMessage(content=system_content)]
        messages.extend(chat_history)
        from langchain_core.messages import HumanMessage
        messages.append(HumanMessage(content=condensed_question))

        # Step 4: Call LLM
        response = self._llm.invoke(messages)
        answer = response.content if hasattr(response, "content") else str(response)

        # Persist
        self.memory_manager.save_turn(conversation_id, question, answer)

        return {
            "answer": answer,
            "sources": self._extract_sources(docs),
            "conversation_id": conversation_id,
        }

    def stream_chat(
        self,
        question: str,
        conversation_id: str,
        content_types: Optional[List[str]] = None,
    ) -> Iterator[str]:
        """
        Stream chat response token-by-token. Returns an iterator of token strings.
        Final item is a JSON-encoded metadata dict prefixed with '__SOURCES__:'.
        """
        from langchain_openai import ChatOpenAI as StreamingChatOpenAI
        import json

        memory = self.memory_manager.get_or_create(conversation_id)

        if content_types:
            self.retriever.content_types = content_types

        docs = self.retriever.get_relevant_documents(question)
        context = _format_context_with_sources(docs) if docs else "No relevant documents found."

        chat_history = memory.chat_memory.messages
        condensed_question = question
        if chat_history:
            condensed_question = self._condense_question(question, chat_history)

        system_content = SYSTEM_PROMPT.format(context=context)

        from langchain_core.messages import SystemMessage, HumanMessage
        messages = [SystemMessage(content=system_content)]
        messages.extend(chat_history)
        messages.append(HumanMessage(content=condensed_question))

        streaming_llm = ChatOpenAI(
            model=self.model_name,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            streaming=True,
            openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
        )

        full_answer = []
        for chunk in streaming_llm.stream(messages):
            token = chunk.content if hasattr(chunk, "content") else str(chunk)
            full_answer.append(token)
            yield token

        complete_answer = "".join(full_answer)
        self.memory_manager.save_turn(conversation_id, question, complete_answer)

        sources = self._extract_sources(docs)
        yield f"__SOURCES__:{json.dumps({'sources': sources, 'conversation_id': conversation_id})}"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_qa_prompt(self, system_message: str) -> ChatPromptTemplate:
        """Build the QA prompt template for the chain."""
        return ChatPromptTemplate.from_messages([
            ("system", system_message),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ])

    def _condense_question(self, question: str, chat_history: list) -> str:
        """Use LLM to rephrase follow-up question as standalone."""
        try:
            history_str = "\n".join(
                f"{'Human' if isinstance(m, type(chat_history[0])) else 'AI'}: {m.content}"
                for m in chat_history[-6:]  # last 3 turns
            )
            prompt = CONDENSE_QUESTION_PROMPT.format(
                chat_history=history_str,
                question=question,
            )
            condensed_llm = ChatOpenAI(
                model=self.model_name,
                temperature=0,
                max_tokens=256,
                openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
            )
            result = condensed_llm.invoke(prompt)
            return result.content if hasattr(result, "content") else question
        except Exception as exc:
            logger.warning("Question condensation failed: %s", exc)
            return question

    @staticmethod
    def _extract_sources(docs: List[Document]) -> List[Dict[str, Any]]:
        """Extract structured source info from retrieved documents."""
        sources = []
        seen_urls: set = set()
        for doc in docs:
            meta = doc.metadata
            url = meta.get("source", meta.get("url", ""))
            if url and url in seen_urls:
                continue
            if url:
                seen_urls.add(url)
            sources.append({
                "title": meta.get("title", meta.get("name", "Untitled")),
                "url": url,
                "content_type": meta.get("content_type", "document"),
                "snippet": doc.page_content[:200].strip() + "..." if len(doc.page_content) > 200 else doc.page_content.strip(),
                "similarity_score": meta.get("similarity_score", None),
            })
        return sources
