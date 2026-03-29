'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, TrendingUp, ArrowUpDown } from 'lucide-react';
import api from '@/utils/api';
import { RepositoryCard } from '@/components/cards';
import { RepositorySkeleton } from '@/components/cards/SkeletonCard';
import { cn } from '@/utils/helpers';

const LANGUAGES = ['All', 'Python', 'JavaScript', 'TypeScript', 'Rust', 'Go', 'Java'];

const SORT_OPTIONS = [
  { label: '⭐ Most Stars', value: '-stars' },
  { label: '🍴 Most Forks', value: '-forks' },
  { label: '🔥 Stars Today', value: '-stars_today' },
  { label: '🕐 Newest', value: '-scraped_at' },
];

export default function GitHubPage() {
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [sortBy, setSortBy] = useState('-stars');

  // Total count from lightweight query
  const { data: countData } = useQuery({
    queryKey: ['repos', 'count'],
    queryFn: () => api.get('/repos/?page_size=1').then(r => r.data),
    staleTime: 30_000,
  });
  const totalCount = countData?.meta?.total ?? 0;

  // Main list — uses RepositoryListView which supports ordering + language filter
  const { data, isLoading } = useQuery({
    queryKey: ['repos', 'list', selectedLanguage, sortBy],
    queryFn: () =>
      api.get('/repos/', {
        params: {
          page_size: 50,
          ordering: sortBy,
          ...(selectedLanguage !== 'All' ? { language: selectedLanguage } : {}),
        },
      }).then(r => r.data),
    staleTime: 30_000,
  });

  const repos: any[] = Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data) ? data : [];

  // "Scraped in last 24h" as a proxy for "new today"
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const newToday = repos.filter((r: any) =>
    r.scraped_at && new Date(r.scraped_at).getTime() > oneDayAgo
  ).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="space-y-4 sm:space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white leading-tight">GitHub Radar</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1 sm:mt-2 text-sm sm:text-base">Discover trending repositories</p>
      </div>

      {/* Header stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-3 sm:p-4 text-white overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm opacity-90 truncate">Added Today</p>
              <p className="text-xl sm:text-2xl font-bold">{newToday}</p>
            </div>
            <TrendingUp size={24} className="opacity-75 shrink-0 sm:size-8" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl p-3 sm:p-4 text-white overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm opacity-90 truncate">Total Repos</p>
              <p className="text-xl sm:text-2xl font-bold">{totalCount}</p>
            </div>
            <GitBranch size={24} className="opacity-75 shrink-0 sm:size-8" />
          </div>
        </div>
      </div>

      {/* Sort + Language filters */}
      <div className="space-y-2 sm:space-y-3">
        {/* Sort pills — scrollable on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          <span className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            <ArrowUpDown size={13} /> Sort:
          </span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={cn(
                'px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0',
                sortBy === opt.value
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Language pills — scrollable on mobile */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {LANGUAGES.map((language) => (
            <button
              key={language}
              onClick={() => setSelectedLanguage(language)}
              className={cn(
                'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0',
                selectedLanguage === language
                  ? 'bg-indigo-600 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {language}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      {!isLoading && (
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          {repos.length} repositories{selectedLanguage !== 'All' ? ` · ${selectedLanguage}` : ''}
        </p>
      )}

      {/* Repositories grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <RepositorySkeleton key={i} />
          ))}
        </div>
      ) : repos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {repos.map((repo: any) => (
            <RepositoryCard key={repo.id} repo={repo} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          <GitBranch size={40} className="mx-auto text-slate-400 dark:text-slate-500 mb-3" />
          <p className="text-slate-600 dark:text-slate-400 text-sm">No repositories found for {selectedLanguage}</p>
          <button
            onClick={() => setSelectedLanguage('All')}
            className="text-indigo-500 hover:text-indigo-600 font-semibold mt-2 text-sm"
          >
            View all repositories
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
