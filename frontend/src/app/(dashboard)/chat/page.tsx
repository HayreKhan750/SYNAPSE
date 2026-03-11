'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  Sparkles,
  ChevronRight,
  Bot,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';
import { ChatMessage as ChatMessageType, Conversation, ChatSource } from '@/types';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { cn } from '@/utils/helpers';

// ─── Suggested prompts shown on empty chat ────────────────────────────────────
const SUGGESTED_PROMPTS = [
  'What are the latest AI research papers about large language models?',
  'Summarize the top trending GitHub repositories this week',
  'Explain the differences between RAG and fine-tuning',
  'What are the key trends in cloud computing right now?',
  'Find articles about TypeScript best practices',
  'What new papers have been published about diffusion models?',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nanoid() {
  return Math.random().toString(36).slice(2, 11);
}

function formatChatDate(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

// ─── API functions ────────────────────────────────────────────────────────────
async function fetchConversations(): Promise<Conversation[]> {
  const res = await api.get('/ai/chat/conversations/');
  return res.data.conversations || [];
}

async function fetchHistory(conversationId: string) {
  const res = await api.get(`/ai/chat/${conversationId}/history/`);
  return res.data;
}

async function deleteConversation(conversationId: string) {
  await api.delete(`/ai/chat/${conversationId}/`);
}

// ─── Streaming chat via SSE ───────────────────────────────────────────────────
async function streamChat(
  question: string,
  conversationId: string,
  onToken: (token: string) => void,
  onSources: (sources: ChatSource[]) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/api\/v1\/?$/, '');
  const accessToken =
    typeof window !== 'undefined'
      ? localStorage.getItem('synapse_access_token') || ''
      : '';

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/ai/chat/stream/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ question, conversation_id: conversationId }),
    });
  } catch (e) {
    onError('Network error — please check your connection.');
    return;
  }

  if (!response.ok || !response.body) {
    onError('Server error — could not stream response.');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('event: sources')) {
        // next data line has sources JSON
        continue;
      }
      if (line.startsWith('event: done')) {
        onDone();
        return;
      }
      if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) {
            onError(parsed.error);
            return;
          }
          // Sources are delivered as a JSON array string
          if (Array.isArray(parsed)) {
            onSources(parsed as ChatSource[]);
            continue;
          }
          // Otherwise it's a token (string)
          if (typeof parsed === 'string') {
            onToken(parsed);
          }
        } catch {
          // raw SSE data line wasn't JSON — treat as plain text token
          onToken(raw);
        }
      }
    }
  }
  onDone();
}

// ─── Fallback non-streaming chat ──────────────────────────────────────────────
async function regularChat(question: string, conversationId: string) {
  const res = await api.post('/ai/chat/', { question, conversation_id: conversationId });
  return res.data;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const queryClient = useQueryClient();

  // Conversation state
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const searchParams = useSearchParams();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const didAutoSend = useRef(false);

  // Fetch conversation list
  const { data: conversations = [], isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    staleTime: 30_000,
  });

  // Auto-scroll to bottom — scroll within the messages container only,
  // never the document body.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [inputValue]);

  // Load history when switching conversations
  const loadConversation = useCallback(
    async (conversationId: string) => {
      if (!conversationId) return;
      try {
        const data = await fetchHistory(conversationId);
        const loaded: ChatMessageType[] = (data.messages || []).map(
          (m: { role: 'human' | 'ai'; content: unknown; ts: number }) => ({
            id: nanoid(),
            role: m.role,
            // Backend may return content as a nested object; always extract a plain string
            content: typeof m.content === 'string'
              ? m.content
              : typeof (m.content as any)?.answer === 'string'
                ? (m.content as any).answer
                : typeof (m.content as any)?.text === 'string'
                  ? (m.content as any).text
                  : String(m.content ?? ''),
            ts: m.ts,
          })
        );
        setMessages(loaded);
        setActiveConversationId(conversationId);
      } catch {
        toast.error('Could not load conversation history.');
      }
    },
    []
  );

  // Delete conversation mutation
  const deleteMutation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (deletedId === activeConversationId) {
        setActiveConversationId('');
        setMessages([]);
      }
    },
    onError: () => toast.error('Failed to delete conversation.'),
  });

  // Start a new chat — reset ALL conversation state completely
  const startNewChat = useCallback(() => {
    setActiveConversationId('');
    setMessages([]);
    setInputValue('');
    setIsGenerating(false);
    didAutoSend.current = false;
    textareaRef.current?.focus();
  }, []);

  // Delete a message pair from UI and backend
  const deleteMessagePair = useCallback(
    async (msgIndex: number) => {
      if (!activeConversationId) {
        // No backend record yet — just remove from local state
        setMessages((prev) => {
          const next = [...prev];
          // remove AI reply if present
          if (next[msgIndex + 1]?.role === 'ai') next.splice(msgIndex + 1, 1);
          next.splice(msgIndex, 1);
          return next;
        });
        return;
      }
      // Find the DB index (count only persisted messages up to this point)
      const dbIndex = msgIndex; // 1:1 with messages array since we persist in order
      try {
        await api.delete(`/ai/chat/${activeConversationId}/messages/${dbIndex}/`);
      } catch {
        // best-effort
      }
      setMessages((prev) => {
        const next = [...prev];
        if (next[msgIndex + 1]?.role === 'ai') next.splice(msgIndex + 1, 1);
        next.splice(msgIndex, 1);
        return next;
      });
    },
    [activeConversationId]
  );

  // Edit a message — repopulate input and strip messages from that point
  const editMessage = useCallback(
    (msgIndex: number, content: string) => {
      setInputValue(content);
      setMessages((prev) => prev.slice(0, msgIndex));
      textareaRef.current?.focus();
    },
    []
  );

  // Send message — always creates a fresh conversation_id when activeConversationId is empty
  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || isGenerating) return;

      // IMPORTANT: generate a brand-new ID when starting fresh so backend
      // creates a new Conversation record, not appending to an old one.
      const conversationId = activeConversationId || nanoid();
      if (!activeConversationId) setActiveConversationId(conversationId);

      // Append user message immediately
      const userMsg: ChatMessageType = {
        id: nanoid(),
        role: 'human',
        content: question.trim(),
        ts: Date.now() / 1000,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');
      setIsGenerating(true);

      // Placeholder AI message for streaming
      const aiMsgId = nanoid();
      const aiPlaceholder: ChatMessageType = {
        id: aiMsgId,
        role: 'ai',
        content: '',
        ts: Date.now() / 1000,
        isStreaming: true,
      };
      setMessages((prev) => [...prev, aiPlaceholder]);

      let streamedContent = '';
      let streamedSources: ChatSource[] = [];
      let streamingWorked = false;

      try {
        await streamChat(
          question.trim(),
          conversationId,
          (token) => {
            streamingWorked = true;
            streamedContent += token;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, content: streamedContent, isStreaming: true }
                  : m
              )
            );
          },
          (sources) => {
            streamedSources = sources;
          },
          () => {
            // done
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      content: streamedContent,
                      sources: streamedSources,
                      isStreaming: false,
                    }
                  : m
              )
            );
            setIsGenerating(false);
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          },
          (err) => {
            if (!streamingWorked) {
              // Fall back to regular (non-streaming) endpoint
              regularChat(question.trim(), conversationId)
                .then((data) => {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgId
                        ? {
                            ...m,
                            content: data.answer || 'No response received.',
                            sources: data.sources || [],
                            isStreaming: false,
                          }
                        : m
                    )
                  );
                  queryClient.invalidateQueries({ queryKey: ['conversations'] });
                })
                .catch(() => {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgId
                        ? {
                            ...m,
                            content: `Error: ${err}`,
                            isStreaming: false,
                          }
                        : m
                    )
                  );
                })
                .finally(() => setIsGenerating(false));
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, isStreaming: false } : m
                )
              );
              setIsGenerating(false);
            }
          }
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: 'Unexpected error. Please try again.', isStreaming: false }
              : m
          )
        );
        setIsGenerating(false);
      }
    },
    [activeConversationId, isGenerating, queryClient]
  );

  // Auto-send ?q= prompt from "Ask AI" card buttons (runs once after sendMessage is stable)
  useEffect(() => {
    const q = searchParams?.get('q');
    if (q && !didAutoSend.current) {
      didAutoSend.current = true;
      sendMessage(decodeURIComponent(q));
    }
  }, [sendMessage, searchParams]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    // Absolutely fill the parent <main> element which is flex-1.
    // Using absolute inset-0 makes this 100% immune to any ancestor flex chain.
    <div className="absolute inset-0 flex overflow-hidden bg-slate-950">

      {/* ── Conversation Sidebar ── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="chat-sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col bg-slate-900 border-r border-slate-700 overflow-hidden flex-shrink-0"
          >
            {/* Sidebar header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-sm font-semibold text-slate-200">Conversations</h2>
              <button
                onClick={startNewChat}
                title="New chat"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                <Plus size={13} />
                New
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
              {convsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-slate-500" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <MessageSquare size={32} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-xs text-slate-500">No conversations yet</p>
                  <p className="text-xs text-slate-600 mt-1">Start a new chat to begin</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.conversation_id}
                    className={cn(
                      'group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                      activeConversationId === conv.conversation_id
                        ? 'bg-indigo-600/20 border border-indigo-600/40'
                        : 'hover:bg-slate-800 border border-transparent'
                    )}
                    onClick={() => loadConversation(conv.conversation_id)}
                  >
                    <MessageSquare
                      size={14}
                      className={cn(
                        'flex-shrink-0 mt-0.5',
                        activeConversationId === conv.conversation_id
                          ? 'text-indigo-400'
                          : 'text-slate-500'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">
                        {conv.title || 'Untitled'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {formatChatDate(conv.updated_at)} · {conv.message_count} msgs
                      </p>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(conv.conversation_id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-all flex-shrink-0"
                      title="Delete conversation"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main Chat Area ── */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-slate-950">

        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={sidebarOpen ? 'Hide history' : 'Show history'}
          >
            <ChevronRight
              size={18}
              className={cn('transition-transform', sidebarOpen && 'rotate-180')}
            />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">SYNAPSE AI</h1>
              <p className="text-[10px] text-slate-400">RAG-powered · grounded in your knowledge base</p>
            </div>
          </div>
          {activeConversationId && (
            <button
              onClick={startNewChat}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
            >
              <Plus size={12} />
              New Chat
            </button>
          )}
        </div>

        {/* Messages area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center justify-center h-full gap-8 text-center px-4">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-900/40">
                  <Sparkles size={28} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Ask SYNAPSE AI</h2>
                <p className="text-sm text-slate-400 max-w-md">
                  Get answers grounded in your knowledge base — articles, papers, repositories, and more.
                </p>
              </div>

              {/* Suggested prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className={cn(
                      'text-left px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/60',
                      'text-sm text-slate-300 hover:text-white hover:border-indigo-500/60 hover:bg-slate-800',
                      'transition-all duration-150'
                    )}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Messages ── */
            <>
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChatMessage
                      message={msg}
                      messageIndex={idx}
                      onEdit={msg.role === 'human' ? editMessage : undefined}
                      onDelete={msg.role === 'human' ? deleteMessagePair : undefined}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator — shown ONLY while waiting for the very first
                  token (content is still empty string).
                  Once ANY content arrives, ChatMessage takes over and renders
                  a streaming cursor instead — TypingIndicator must be gone.
                  Condition: generating + last msg is AI + streaming + NO content yet.
                  ChatMessage returns null for this same state, so exactly ONE
                  bot avatar is ever visible at a time. */}
              {(() => {
                const last = messages[messages.length - 1];
                const showTyping =
                  isGenerating &&
                  last?.role === 'ai' &&
                  last?.isStreaming === true &&
                  (last?.content ?? '') === '';
                return showTyping ? <TypingIndicator /> : null;
              })()}
            </>
          )}
          <div />
        </div>

        {/* ── Input Area ── */}
        <div className="flex-shrink-0 border-t border-slate-800 bg-slate-900/50 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div
              className={cn(
                'flex items-end gap-3 bg-slate-800 border rounded-2xl px-4 py-3 transition-colors',
                isGenerating
                  ? 'border-slate-700'
                  : 'border-slate-600 focus-within:border-indigo-500'
              )}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about articles, papers, repos… (Enter to send, Shift+Enter for newline)"
                disabled={isGenerating}
                rows={1}
                className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none focus:outline-none min-h-[24px] max-h-[160px] py-0.5 disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || isGenerating}
                className={cn(
                  'flex-shrink-0 p-2 rounded-xl transition-all',
                  inputValue.trim() && !isGenerating
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-900/40'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                )}
                title="Send message"
              >
                {isGenerating ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-600 mt-2">
              Responses are grounded in the SYNAPSE knowledge base. Always verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
