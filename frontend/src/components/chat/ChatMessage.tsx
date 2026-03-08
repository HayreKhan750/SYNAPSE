'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Bot, User } from 'lucide-react';
import { ChatMessage as ChatMessageType, ChatSource } from '@/types';
import { cn } from '@/utils/helpers';
import { SourceCitationCard } from './SourceCitationCard';

interface ChatMessageProps {
  message: ChatMessageType;
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

export function ChatMessage({ message }: ChatMessageProps) {
  const isHuman = message.role === 'human';

  return (
    <div
      className={cn(
        'flex gap-3 w-full',
        isHuman ? 'flex-row-reverse' : 'flex-row'
      )}
    >
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

      {/* Bubble */}
      <div
        className={cn(
          'flex flex-col gap-2 max-w-[80%]',
          isHuman ? 'items-end' : 'items-start'
        )}
      >
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
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5 rounded-sm align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Actions row for AI messages */}
        {!isHuman && !message.isStreaming && (
          <div className="flex items-center gap-1 px-1">
            <CopyButton text={message.content} />
          </div>
        )}

        {/* Source citations */}
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
    </div>
  );
}
