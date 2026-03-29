'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Star, GitFork, AlertCircle } from 'lucide-react';
import { Repository } from '@/types';
import { formatNumber, formatRelativeTime, cn } from '@/utils/helpers';
import { BookmarkButton } from '@/components/BookmarkButton';

interface RepositoryCardProps {
  repo: Repository;
  onBookmark?: (id: string) => void;
}

const languageColors: Record<string, string> = {
  python: 'bg-blue-500',
  javascript: 'bg-yellow-500',
  typescript: 'bg-blue-600',
  rust: 'bg-orange-700',
  go: 'bg-cyan-500',
  java: 'bg-orange-600',
  cpp: 'bg-blue-700',
  c: 'bg-slate-600',
  ruby: 'bg-red-600',
  php: 'bg-purple-600',
};

const getLanguageColor = (language?: string) => {
  if (!language) return 'bg-slate-400';
  return languageColors[language.toLowerCase()] || 'bg-slate-400';
};

export const RepositoryCard = ({ repo }: RepositoryCardProps) => {
  const handleCardClick = () => {
    window.open(repo.url, '_blank');
  };

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
      {/* Top: GitHub icon + language badge + trending badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐙</span>
          {repo.language && (
            <div className="flex items-center gap-1">
              <div className={cn('w-2.5 h-2.5 rounded-full', getLanguageColor(repo.language))} />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {repo.language}
              </span>
            </div>
          )}
        </div>
        {repo.is_trending && (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            🔥 Trending
          </span>
        )}
      </div>

      {/* Repo name */}
      <h3 className="font-bold text-slate-900 dark:text-white mb-2 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm">
        {repo.full_name}
      </h3>

      {/* Description */}
      {repo.description && (
        <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400 mb-3">
          {repo.description}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1">
          <Star size={14} className="fill-yellow-500 text-yellow-500" />
          <span>{formatNumber(repo.stars)}</span>
        </div>
        <div className="flex items-center gap-1">
          <GitFork size={14} />
          <span>{formatNumber(repo.forks)}</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertCircle size={14} />
          <span>{formatNumber(repo.open_issues)}</span>
        </div>
      </div>

      {/* Stars today */}
      {repo.stars_today && repo.stars_today > 0 && (
        <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-3">
          +{repo.stars_today} today
        </div>
      )}

      {/* Topics */}
      <div className="flex flex-wrap gap-1 mb-3">
        {repo.topics?.slice(0, 4).map((topic) => (
          <span
            key={topic}
            className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
          >
            {topic}
          </span>
        ))}
      </div>

      {/* Bottom: owner + relative time + bookmark */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
        <div className="flex flex-col gap-0.5 flex-1">
          {(repo.owner || repo.owner_name) && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              by {repo.owner || repo.owner_name}
            </span>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
            {formatRelativeTime(repo.scraped_at || null)}
          </span>
        </div>
        <BookmarkButton contentType="repository" objectId={repo.id} size={16} />
      </div>
    </motion.div>
  );
};
