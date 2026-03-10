'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Bot, User, Pencil, Trash2 } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/types';
import { cn } from '@/utils/helpers';
import { SourceCitationCard } from './SourceCitationCard';

interface ChatMessageProps {
  message: ChatMessageType;
  messageIndex?: number;
  onEdit?: (index: number, content: string) => void;
  onDelete?: (index: number) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy response"
      className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
    >
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

export function ChatMessage({ message, messageIndex = 0, onEdit, onDelete }: ChatMessageProps) {
  const isHuman = message.role === 'human';
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleEdit = () => {
    onEdit?.(messageIndex, message.content);
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete?.(messageIndex);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div className={cn('flex gap-3 w-full', isHuman ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isHuman
            ? 'bg-gradient-to-br from-indigo-500 to-cyan-500'
            : 'bg-gradient-to-br from-violet-600 to-indigo-600'
        )}
      >
        {isHuman ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-white" />
        )}
      </div>

      {/* Bubble + actions — hide bubble entirely when AI placeholder is empty
          (TypingIndicator is shown instead, so we only render the avatar) */}
      {(!message.isStreaming || message.content !== '') && (
      <div className={cn('flex flex-col gap-1.5 max-w-[80%]', isHuman ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isHuman
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-sm'
          )}
        >
          {isHuman ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }: any) {
                    const isBlock = className?.includes('language-');
                    return isBlock ? (
                      <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto my-3 border border-slate-700">
                        <code className="text-slate-100 text-xs font-mono leading-relaxed" {...props}>
                          {children}
                        </code>
                      </pre>
                    ) : (
                      <code className="bg-slate-900 text-indigo-300 rounded px-1.5 py-0.5 text-xs font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                  h1: ({ children }: any) => <h1 className="text-xl font-bold text-white mt-4 mb-2">{children}</h1>,
                  h2: ({ children }: any) => <h2 className="text-lg font-semibold text-white mt-3 mb-2">{children}</h2>,
                  h3: ({ children }: any) => <h3 className="text-base font-semibold text-slate-100 mt-3 mb-1">{children}</h3>,
                  p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                  ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-1 pl-2">{children}</ul>,
                  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-1 pl-2">{children}</ol>,
                  li: ({ children }: any) => <li className="text-slate-200">{children}</li>,
                  strong: ({ children }: any) => <strong className="font-semibold text-white">{children}</strong>,
                  em: ({ children }: any) => <em className="italic text-slate-300">{children}</em>,
                  blockquote: ({ children }: any) => (
                    <blockquote className="border-l-4 border-indigo-500 pl-4 my-2 text-slate-400 italic">{children}</blockquote>
                  ),
                  a: ({ href, children }: any) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                      {children}
                    </a>
                  ),
                  hr: () => <hr className="border-slate-700 my-3" />,
                  table: ({ children }: any) => (
                    <div className="overflow-x-auto my-3">
                      <table className="min-w-full border border-slate-700 rounded text-sm">{children}</table>
                    </div>
                  ),
                  th: ({ children }: any) => <th className="border border-slate-700 px-3 py-2 bg-slate-800 text-white font-semibold text-left">{children}</th>,
                  td: ({ children }: any) => <td className="border border-slate-700 px-3 py-2 text-slate-300">{children}</td>,
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5 rounded-sm align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Action row */}
        <div className={cn('flex items-center gap-1 px-1', isHuman ? 'flex-row-reverse' : 'flex-row')}>
          {isHuman && !message.isStreaming && (
            <>
              <CopyButton text={message.content} />
              {onEdit && (
                <button
                  onClick={handleEdit}
                  title="Edit message"
                  className="p-1.5 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-700 transition-colors"
                >
                  <Pencil size={13} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  title={confirmDelete ? 'Click again to confirm delete' : 'Delete message'}
                  className={cn(
                    'p-1.5 rounded-md transition-colors text-xs flex items-center gap-1',
                    confirmDelete
                      ? 'text-red-400 bg-red-900/30 hover:bg-red-900/50'
                      : 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
                  )}
                >
                  <Trash2 size={13} />
                  {confirmDelete && <span className="text-[10px] font-medium">Confirm?</span>}
                </button>
              )}
            </>
          )}
          {!isHuman && !message.isStreaming && (
            <CopyButton text={message.content} />
          )}
        </div>

        {/* Source citations (AI only) */}
        {!isHuman && message.sources && message.sources.length > 0 && (
          <div className="w-full space-y-2">
            <p className="text-xs text-slate-500 px-1 font-medium">Sources</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {message.sources.map((source, idx) => (
                <SourceCitationCard key={idx} source={source} />
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
