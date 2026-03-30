'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileText, ExternalLink, MessageSquare } from 'lucide-react';
import { ResearchPaper } from '@/types';
import { formatRelativeTime, cn } from '@/utils/helpers';
import { BookmarkButton } from '@/components/BookmarkButton';

const getDifficultyColor = (difficulty: string) => {
  const colors: Record<string, string> = {
    beginner:     'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/40',
    intermediate: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40',
    advanced:     'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700/40',
  };
  return colors[difficulty?.toLowerCase()] || 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600/40';
};

interface PaperCardProps {
  paper: ResearchPaper;
  onBookmark?: (id: string) => void;
}

export const PaperCard = ({ paper }: PaperCardProps) => {
  const router = useRouter();

  const handleAskAI = (e: React.MouseEvent) => {
    e.stopPropagation();
    const q = encodeURIComponent(`Explain this research paper: "${paper.title}"`);
    router.push(`/chat?q=${q}`);
  };

  const handlePdfClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (paper.pdf_url) window.open(paper.pdf_url, '_blank');
  };

  const handleArxivClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(paper.url, '_blank');
  };

  const categories = paper.categories || paper.arxiv_categories || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'group relative bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/60',
        'p-4 sm:p-5 transition-all duration-200 overflow-hidden',
        'hover:shadow-xl hover:shadow-violet-500/10 hover:border-violet-400/50 dark:hover:border-violet-500/50',
        'hover:-translate-y-0.5'
      )}
    >
      {/* Accent bar */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" />

      {/* Top row: difficulty + date */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full shrink-0', getDifficultyColor(paper.difficulty_level))}>
          {paper.difficulty_level?.charAt(0).toUpperCase() + paper.difficulty_level?.slice(1) || 'Research'}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
          {formatRelativeTime(paper.fetched_at || null)}
        </span>
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {categories.slice(0, 3).map((category) => (
            <span
              key={category}
              className="text-xs px-2 py-0.5 rounded-full bg-violet-100/70 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium border border-violet-200 dark:border-violet-700/30 truncate max-w-[120px]"
            >
              {category}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h3 className="line-clamp-2 font-semibold text-sm sm:text-base text-slate-900 dark:text-white mb-2 leading-snug group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
        {paper.title}
      </h3>

      {/* Authors */}
      {paper.authors && paper.authors.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 truncate">
          {paper.authors.slice(0, 3).join(', ')}
          {paper.authors.length > 3 && <span className="text-slate-500 dark:text-slate-400"> +{paper.authors.length - 3} more</span>}
        </p>
      )}

      {/* Abstract */}
      {paper.abstract && (
        <p className="line-clamp-3 text-sm text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          {paper.abstract}
        </p>
      )}

      {/* Citation count */}
      {paper.citation_count && paper.citation_count > 0 && (
        <div className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-3 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
          💬 <span className="font-medium">{paper.citation_count}</span> citations
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-700/50 flex-wrap">
        <div className="flex items-center gap-1 shrink-0">
          {paper.pdf_url && (
            <button
              onClick={handlePdfClick}
              title="Open PDF"
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400"
            >
              <FileText size={15} />
            </button>
          )}
          <button
            onClick={handleArxivClick}
            title="Open on arXiv"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400"
          >
            <ExternalLink size={15} />
          </button>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleAskAI}
            title="Ask AI about this paper"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-violet-500 dark:text-violet-400 hover:text-white hover:bg-violet-600 transition-all border border-violet-400/30 hover:border-violet-500 whitespace-nowrap"
          >
            <MessageSquare size={11} />
            <span className="hidden xs:inline">Ask AI</span>
          </button>
          <BookmarkButton contentType="researchpaper" objectId={paper.id} size={15} />
        </div>
      </div>
    </motion.div>
  );
};
