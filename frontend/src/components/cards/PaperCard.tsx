'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ExternalLink } from 'lucide-react';
import { ResearchPaper } from '@/types';
import { cn } from '@/utils/helpers';
import { BookmarkButton } from '@/components/BookmarkButton';

interface PaperCardProps {
  paper: ResearchPaper;
  onBookmark?: (id: string) => void;
}

const getDifficultyColor = (difficulty: string) => {
  const colors: Record<string, string> = {
    beginner: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    intermediate: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    advanced: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };
  return colors[difficulty.toLowerCase()] || 'bg-slate-100 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300';
};

export const PaperCard = ({ paper }: PaperCardProps) => {
  const handlePdfClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (paper.pdf_url) {
      window.open(paper.pdf_url, '_blank');
    }
  };

  const handleArxivClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(paper.url, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700',
        'p-4 transition-all duration-150',
        'hover:shadow-lg hover:border-indigo-500/50 hover:scale-[1.01]'
      )}
    >
      {/* Top: difficulty badge + date + categories */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <span className={cn('text-xs font-medium px-2 py-1 rounded-full', getDifficultyColor(paper.difficulty_level))}>
          {paper.difficulty_level.charAt(0).toUpperCase() + paper.difficulty_level.slice(1)}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {paper.published_date ? new Date(paper.published_date).toLocaleDateString() : ''}
        </span>
      </div>

      {/* Category pills */}
      {(paper.categories || paper.arxiv_categories) && (paper.categories || paper.arxiv_categories)!.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {(paper.categories || paper.arxiv_categories)!.map((category) => (
            <span
              key={category}
              className="text-xs px-2 py-0.5 rounded bg-indigo-100/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium"
            >
              {category}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h3 className="line-clamp-2 font-semibold text-slate-900 dark:text-white mb-2">
        {paper.title}
      </h3>

      {/* Authors */}
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        {paper.authors?.slice(0, 3).join(', ')}
        {paper.authors && paper.authors.length > 3 && ` + ${paper.authors.length - 3} more`}
      </p>

      {/* Abstract */}
      {paper.abstract && (
        <p className="line-clamp-3 text-sm text-slate-500 dark:text-slate-400 mb-3">
          {paper.abstract}
        </p>
      )}

      {/* Citation count */}
      {paper.citation_count && paper.citation_count > 0 && (
        <div className="text-xs text-slate-600 dark:text-slate-400 mb-3">
          💬 {paper.citation_count} citations
        </div>
      )}

      {/* Action buttons and bookmark */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          {paper.pdf_url && (
            <button
              onClick={handlePdfClick}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <FileText size={16} />
            </button>
          )}
          <button
            onClick={handleArxivClick}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            <ExternalLink size={16} />
          </button>
        </div>
        <BookmarkButton contentType="researchpaper" objectId={paper.id} size={16} />
      </div>
    </motion.div>
  );
};
