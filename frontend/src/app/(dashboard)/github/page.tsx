'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, TrendingUp } from 'lucide-react';
import { api } from '@/utils/api';
import { RepositoryCard } from '@/components/cards';
import { RepositorySkeleton } from '@/components/cards/SkeletonCard';
import { cn } from '@/utils/helpers';

const LANGUAGES = ['All', 'Python', 'JavaScript', 'TypeScript', 'Rust', 'Go', 'Java'];

export default function GitHubPage() {
  const [selectedLanguage, setSelectedLanguage] = useState('All');

  const { data, isLoading } = useQuery({
    queryKey: ['repos', 'trending', selectedLanguage],
    queryFn: () =>
      api.get('/repos/trending/', {
        params: {
          language: selectedLanguage === 'All' ? undefined : selectedLanguage.toLowerCase(),
          is_trending: true,
        },
      }),
  });

  const repos = data?.results || [];
  const totalCount = data?.count || 0;

  const filteredRepos = useMemo(() => {
    if (selectedLanguage === 'All') return repos;
    return repos.filter((repo: any) =>
      repo.language?.toLowerCase() === selectedLanguage.toLowerCase()
    );
  }, [repos, selectedLanguage]);

  const trendingToday = filteredRepos.filter((repo: any) => repo.stars_today && repo.stars_today > 0).length;

  return (
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
              <p className="text-sm opacity-90">Trending Today</p>
              <p className="text-2xl font-bold">{trendingToday}</p>
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

      {/* Language filter pills */}
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((language) => (
          <button
            key={language}
            onClick={() => setSelectedLanguage(language)}
            className={cn(
              'px-4 py-2 rounded-full font-medium transition-all',
              selectedLanguage === language
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            {language}
          </button>
        ))}
      </div>

      {/* Repositories grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <RepositorySkeleton key={i} />
          ))}
        </div>
      ) : filteredRepos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRepos.map((repo: any) => (
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
  );
}
