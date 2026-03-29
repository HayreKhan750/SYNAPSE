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
    <div className="flex-1 overflow-y-auto p-6">
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">GitHub Radar</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">Discover trending repositories</p>
      </div>

      {/* Header stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Added Today</p>
              <p className="text-2xl font-bold">{newToday}</p>
            </div>
            <TrendingUp size={32} className="opacity-75" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Repositories</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
            <GitBranch size={32} className="opacity-75" />
          </div>
        </div>
      </div>

      {/* Sort + Language filters */}
      <div className="space-y-3">
        {/* Sort pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            <ArrowUpDown size={14} /> Sort:
          </span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                sortBy === opt.value
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Language pills */}
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((language) => (
            <button
              key={language}
              onClick={() => setSelectedLanguage(language)}
              className={cn(
                'px-4 py-2 rounded-full font-medium transition-all',
                selectedLanguage === language
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900'
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
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {repos.length} repositories{selectedLanguage !== 'All' ? ` · ${selectedLanguage}` : ''}
        </p>
      )}

      {/* Repositories grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <RepositorySkeleton key={i} />
          ))}
        </div>
      ) : repos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {repos.map((repo: any) => (
            <RepositoryCard key={repo.id} repo={repo} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <GitBranch size={48} className="mx-auto text-slate-400 dark:text-slate-500 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">No repositories found for {selectedLanguage}</p>
          <button
            onClick={() => setSelectedLanguage('All')}
            className="text-indigo-500 hover:text-indigo-600 font-medium mt-2"
          >
            View all repositories
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
