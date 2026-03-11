'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, BookOpen, GitBranch } from 'lucide-react';
import api from '@/utils/api';
import { ArticleCard, RepositoryCard, PaperCard } from '@/components/cards';
import { ArticleSkeleton, RepositorySkeleton, PaperSkeleton } from '@/components/cards/SkeletonCard';
import { cn } from '@/utils/helpers';

const StatCard = ({ icon: Icon, label, value, gradient }: any) => (
  <div className={cn('rounded-lg p-4 text-white', gradient)}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm opacity-90">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <Icon size={32} className="opacity-75" />
    </div>
  </div>
);

export default function Dashboard() {
  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', 'trending'],
    queryFn: () => api.get('/articles/trending/').then(r => r.data),
  });

  const { data: repos, isLoading: reposLoading } = useQuery({
    queryKey: ['repos', 'trending'],
    queryFn: () => api.get('/repos/trending/').then(r => r.data),
  });

  const { data: papers, isLoading: papersLoading } = useQuery({
    queryKey: ['papers', 'trending'],
    queryFn: () => api.get('/papers/trending/').then(r => r.data),
  });

  const trendingArticles = Array.isArray(articles?.data) ? articles.data.slice(0, 6)
    : Array.isArray(articles?.results) ? articles.results.slice(0, 6)
    : Array.isArray(articles) ? (articles as any[]).slice(0, 6) : [];
  const trendingRepos = Array.isArray(repos?.data) ? repos.data.slice(0, 3)
    : Array.isArray(repos?.results) ? repos.results.slice(0, 3)
    : Array.isArray(repos) ? (repos as any[]).slice(0, 3) : [];
  const trendingPapers = Array.isArray(papers?.data) ? papers.data.slice(0, 3)
    : Array.isArray(papers?.results) ? papers.results.slice(0, 3)
    : Array.isArray(papers) ? (papers as any[]).slice(0, 3) : [];

  return (
    <div className="flex-1 overflow-y-auto p-6">
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">Welcome back to SYNAPSE</p>
      </div>

      {/* Hero stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BarChart3}
          label="Total Articles"
          value={articles?.meta?.total || articles?.count || 0}
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Trending Topics"
          value={trendingArticles.length}
          gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
        />
        <StatCard
          icon={BookOpen}
          label="Papers Today"
          value={papers?.meta?.total || papers?.count || 0}
          gradient="bg-gradient-to-br from-violet-500 to-violet-600"
        />
        <StatCard
          icon={GitBranch}
          label="GitHub Stars"
          value={repos?.meta?.total || repos?.count || 0}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Latest from Tech Feed */}
        <div className="lg:col-span-2">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Latest from Tech Feed</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Curated articles from around the web</p>
          </div>

          {articlesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <ArticleSkeleton key={i} />
              ))}
            </div>
          ) : trendingArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trendingArticles.map((article: any) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-slate-600 dark:text-slate-400">No articles available</p>
            </div>
          )}
        </div>

        {/* Right: Trending on GitHub */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Trending on GitHub</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Hot repositories today</p>
          </div>

          {reposLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <RepositorySkeleton key={i} />
              ))}
            </div>
          ) : trendingRepos.length > 0 ? (
            <div className="space-y-4">
              {trendingRepos.map((repo: any) => (
                <RepositoryCard key={repo.id} repo={repo} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-slate-600 dark:text-slate-400">No repositories available</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Latest Research Papers */}
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Latest Research Papers</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">New papers from arXiv</p>
        </div>

        {papersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <PaperSkeleton key={i} />
            ))}
          </div>
        ) : trendingPapers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trendingPapers.map((paper: any) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-slate-600 dark:text-slate-400">No papers available</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
