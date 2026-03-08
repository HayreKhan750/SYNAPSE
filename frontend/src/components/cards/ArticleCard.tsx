'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Article } from '@/types';
import { formatRelativeTime, cn } from '@/utils/helpers';
import { BookmarkButton } from '@/components/BookmarkButton';

interface ArticleCardProps {
  article: Article;
  onBookmark?: (id: string) => void;
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const handleCardClick = () => {
    window.open(article.url, '_blank');
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
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatRelativeTime(article.published_at)}
        </span>
      </div>

      {/* Title */}
      <h3 className="line-clamp-2 font-semibold text-slate-900 dark:text-white mb-2 hover:text-indigo-600 dark:hover:text-indigo-400">
        {article.title}
      </h3>

      {/* AI Summary */}
      {article.summary && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
              AI Summary
            </span>
          </div>
          <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-400">
            {article.summary}
          </p>
        </div>
      )}

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
        <BookmarkButton contentType="article" objectId={article.id} size={16} />
      </div>
    </motion.div>
  );
};
