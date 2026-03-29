'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

function SummaryText({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!text) return null;
  return (
    <div>
      <p className={expanded ? 'text-sm text-slate-600 dark:text-slate-400' : 'line-clamp-3 text-sm text-slate-600 dark:text-slate-400'}>
        {text}
      </p>
      {text.split(' ').length > 40 && (
        <button
          type="button"
          className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { Article } from '@/types';
import { formatRelativeTime, cn } from '@/utils/helpers';
import { BookmarkButton } from '@/components/BookmarkButton';

interface ArticleCardProps {
  article: Article;
  onBookmark?: (id: string) => void;
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const router = useRouter();

  const handleCardClick = () => {
    window.open(article.url, '_blank');
  };

  const handleAskAI = (e: React.MouseEvent) => {
    e.stopPropagation();
    const q = encodeURIComponent(`Explain this article: "${article.title}"`);
    router.push(`/chat?q=${q}`);
  };

  const getSourceColor = (sourceType: string) => {
    const colors: Record<string, string> = {
      hackernews: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
      reddit: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      github: 'bg-slate-100 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300',
      blog: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      news: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    };
    return colors[sourceType] || 'bg-slate-100 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300';
  };

  const getTagColor = (index: number) => {
    const colors = [
      'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
      'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
      'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
    ];
    return colors[index % colors.length];
  };

  const wordCount = article.summary?.split(' ').length || article.title.split(' ').length;
  const readingTime = Math.ceil(wordCount / 200);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={handleCardClick}
      className={cn(
        'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700',
        'p-4 cursor-pointer transition-all duration-150',
        'hover:shadow-lg hover:border-indigo-500/50 hover:scale-[1.01]'
      )}
    >
      {/* Top row: source badge + published time */}
      <div className="flex items-center justify-between mb-3">
        <span className={cn('text-xs font-medium px-2 py-1 rounded-full', getSourceColor(article.source?.source_type || article.source_type || 'blog'))}>
          {(article.source?.name || article.source_type || 'Blog')}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {formatRelativeTime(article.scraped_at)}
        </span>
      </div>

      {/* Title */}
      <h3 className="line-clamp-2 font-semibold text-slate-900 dark:text-white mb-2 hover:text-indigo-600 dark:hover:text-indigo-400">
        {article.title}
      </h3>

      {/* Summary section:
          1. Real AI summary → show with sparkle badge (swapped in by polling)
          2. Pending (empty summary, not sentinel) → show excerpt/title instantly
             with a subtle "AI Summarizing" pill — no empty space, no long wait
          3. Failed sentinel → show nothing (article had no summarizable content) */}
      {article.summary && article.summary !== '__failed__' ? (
        /* ── Real AI summary available ── */
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              AI Summary
            </span>
          </div>
          <SummaryText text={article.summary} />
        </div>
      ) : !article.summary || article.summary === '' ? (
        /* ── Summary pending: show best available content immediately ── */
        <div className="mb-3">
          {/* Priority: real web excerpt → tags/topic description → nothing */}
          {(article as any).excerpt ? (
            <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400 mb-1.5">
              {(article as any).excerpt}
            </p>
          ) : (article.tags?.length > 0 || article.topic) ? (
            /* Build a readable description from tags + topic when no excerpt */
            <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400 mb-1.5">
              {[
                article.topic ? `A ${article.topic} article` : null,
                article.tags?.length > 0 ? `covering ${article.tags.slice(0, 3).join(', ')}` : null,
              ].filter(Boolean).join(' ')}
              {article.tags?.length > 0 || article.topic ? '.' : ''}
            </p>
          ) : null}
          {/* Subtle pill — only shown when no real excerpt yet */}
          {!(article as any).excerpt && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500">
              <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              AI summarizing…
            </span>
          )}
        </div>
      ) : null /* sentinel (__failed__): render nothing */}

      {/* Tags row */}
      <div className="flex flex-wrap gap-1 mb-3">
        {article.tags?.slice(0, 3).map((tag, idx) => (
          <span
            key={tag}
            className={cn('text-xs px-2 py-1 rounded-full font-medium', getTagColor(idx))}
          >
            {tag}
          </span>
        ))}
        {article.topic && (
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            {article.topic}
          </span>
        )}
      </div>

      {/* Bottom row: author, reading time, bookmark */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 flex-1">
          {article.author && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {article.author}
            </span>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {readingTime} min read
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAskAI}
            title="Ask AI about this article"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-indigo-400 hover:text-white hover:bg-indigo-600 transition-colors border border-indigo-500/30 hover:border-indigo-500"
          >
            <MessageSquare size={12} />
            Ask AI
          </button>
          <BookmarkButton contentType="article" objectId={article.id} size={16} />
        </div>
      </div>
    </motion.div>
  );
};
