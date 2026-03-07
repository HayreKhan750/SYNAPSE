'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronDown, Search } from 'lucide-react';
import api from '@/utils/api';
import { PaperCard } from '@/components/cards';
import { PaperSkeleton } from '@/components/cards/SkeletonCard';
import { cn } from '@/utils/helpers';

const DIFFICULTIES = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const ARXIV_CATEGORIES = [
  'cs.AI',
  'cs.LG',
  'cs.CL',
  'cs.CV',
  'cs.CR',
  'cs.DB',
  'cs.DS',
  'cs.SE',
  'math.ST',
];
const SORT_OPTIONS = ['Date', 'Citations', 'Difficulty'];

export default function ResearchPage() {
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('Date');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [page, setPage] = useState(1);

  const difficultyParam =
    selectedDifficulty === 'All' ? undefined : selectedDifficulty.toLowerCase();

  const getSortOrdering = () => {
    switch (sortBy) {
      case 'Citations':
        return '-citation_count';
      case 'Difficulty':
        return 'difficulty_level';
      default:
        return '-published_date';
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['papers', difficultyParam, selectedCategory, sortBy, page],
    queryFn: () =>
      api.get('/papers/', {
        params: {
          page,
          difficulty_level: difficultyParam,
          category: selectedCategory || undefined,
          ordering: getSortOrdering(),
        },
      }),
  });

  const papers = data?.results || [];
  const totalCount = data?.count || 0;
  const pageSize = data?.results?.length || 0;

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Research Explorer</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">Explore cutting-edge research papers</p>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Difficulty filter pills */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Difficulty</h3>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((difficulty) => (
              <button
                key={difficulty}
                onClick={() => {
                  setSelectedDifficulty(difficulty);
                  setPage(1);
                }}
                className={cn(
                  'px-4 py-2 rounded-full font-medium transition-all',
                  selectedDifficulty === difficulty
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                {difficulty}
              </button>
            ))}
          </div>
        </div>

        {/* Category and sort controls */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Category dropdown */}
          <div className="relative flex-1 min-w-[200px]">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-2">
              Category
            </label>
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className={cn(
                'w-full px-4 py-2 rounded-lg font-medium flex items-center justify-between transition-all',
                'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {selectedCategory || 'All Categories'}
              <ChevronDown size={16} className={cn('transition-transform', showCategoryDropdown && 'rotate-180')} />
            </button>

            {showCategoryDropdown && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedCategory('');
                    setShowCategoryDropdown(false);
                    setPage(1);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm transition-colors first:rounded-t-lg',
                    selectedCategory === ''
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )}
                >
                  All Categories
                </button>
                {ARXIV_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category);
                      setShowCategoryDropdown(false);
                      setPage(1);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm transition-colors',
                      selectedCategory === category
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-2">
              Sort by
            </label>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className={cn(
                'px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all',
                'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {sortBy}
              <ChevronDown size={16} className={cn('transition-transform', showSortDropdown && 'rotate-180')} />
            </button>

            {showSortDropdown && (
              <div className="absolute top-full mt-2 left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 min-w-[150px]">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSortBy(option);
                      setShowSortDropdown(false);
                      setPage(1);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg',
                      sortBy === option
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Papers grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <PaperSkeleton key={i} />
          ))}
        </div>
      ) : papers.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {papers.map((paper: any) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>

          {/* Load More button */}
          {pageSize >= 12 && papers.length < totalCount && (
            <div className="flex justify-center mt-8">
              <button
                onClick={handleLoadMore}
                className={cn(
                  'px-6 py-3 rounded-lg font-medium transition-all',
                  'bg-indigo-500 hover:bg-indigo-600 text-white',
                  'hover:shadow-lg'
                )}
              >
                Load More Papers
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <BookOpen size={48} className="mx-auto text-slate-400 dark:text-slate-500 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">No papers found for your filters</p>
          <button
            onClick={() => {
              setSelectedDifficulty('All');
              setSelectedCategory('');
              setSortBy('Date');
              setPage(1);
            }}
            className="text-indigo-500 hover:text-indigo-600 font-medium mt-2"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
