'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, BookOpen, GitBranch, Youtube, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import api from '@/utils/api';
import { ArticleCard, RepositoryCard, PaperCard } from '@/components/cards';
import { ArticleSkeleton, RepositorySkeleton, PaperSkeleton } from '@/components/cards/SkeletonCard';

const StatCard = ({ icon: Icon, label, value, gradient, href }: any) => (
  <Link href={href || '#'} className="group">
    <div className={`rounded-2xl p-5 text-white relative overflow-hidden transition-all duration-200 group-hover:scale-[1.02] group-hover:shadow-xl ${gradient}`}>
      <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '20px 20px'}} />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="text-3xl font-black mt-0.5">{value?.toLocaleString?.() ?? value}</p>
        </div>
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
          <Icon size={24} />
        </div>
      </div>
      <div className="relative mt-3 flex items-center gap-1 text-xs font-medium opacity-70 group-hover:opacity-100 transition-opacity">
        <span>View all</span>
        <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  </Link>
);

const SectionHeader = ({ title, subtitle, href }: { title: string; subtitle?: string; href?: string }) => (
  <div className="flex items-center justify-between mb-5">
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {href && (
      <Link href={href} className="flex items-center gap-1 text-sm font-medium text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group">
        View all <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>
    )}
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
  const trendingRepos = Array.isArray(repos?.data) ? repos.data.slice(0, 4)
    : Array.isArray(repos?.results) ? repos.results.slice(0, 4)
    : Array.isArray(repos) ? (repos as any[]).slice(0, 4) : [];
  const trendingPapers = Array.isArray(papers?.data) ? papers.data.slice(0, 3)
    : Array.isArray(papers?.results) ? papers.results.slice(0, 3)
    : Array.isArray(papers) ? (papers as any[]).slice(0, 3) : [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="pb-10">

        {/* ── Hero Banner ──────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950/80 to-slate-900 px-6 pt-8 pb-12 overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-20" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/3 w-56 h-56 bg-cyan-600/15 rounded-full blur-3xl translate-y-1/2" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-4">
              <Zap size={10} className="fill-indigo-400 text-indigo-400" />
              AI-Powered Tech Intelligence
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight leading-tight">
              Welcome to <span className="gradient-text">SYNAPSE</span>
            </h1>
            <p className="text-slate-400 text-base max-w-lg">
              Your personal AI-curated feed of articles, papers, repos, and videos — all searchable and summarized.
            </p>
          </div>
        </div>

        <div className="px-6 space-y-10 mt-6">

          {/* ── Stats Row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={BarChart3} label="Articles" value={articles?.meta?.total || 0} gradient="bg-gradient-to-br from-indigo-500 to-indigo-700" href="/feed" />
            <StatCard icon={BookOpen} label="Papers" value={papers?.meta?.total || 0} gradient="bg-gradient-to-br from-violet-500 to-violet-700" href="/research" />
            <StatCard icon={GitBranch} label="Repositories" value={repos?.meta?.total || 0} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" href="/github" />
            <StatCard icon={Youtube} label="Videos" value={300} gradient="bg-gradient-to-br from-red-500 to-red-700" href="/videos" />
          </div>

          {/* ── Latest Articles + GitHub ───────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <SectionHeader title="Latest from Tech Feed" subtitle="Curated articles from around the web" href="/feed" />
              {articlesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <ArticleSkeleton key={i} />)}
                </div>
              ) : trendingArticles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trendingArticles.map((article: any) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                  <p className="text-slate-500 dark:text-slate-400">No articles yet</p>
                </div>
              )}
            </div>

            <div>
              <SectionHeader title="Trending on GitHub" subtitle="Hot repos today" href="/github" />
              {reposLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => <RepositorySkeleton key={i} />)}
                </div>
              ) : trendingRepos.length > 0 ? (
                <div className="space-y-4">
                  {trendingRepos.map((repo: any) => (
                    <RepositoryCard key={repo.id} repo={repo} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                  <p className="text-slate-500 dark:text-slate-400">No repos yet</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Research Papers ───────────────────────────────────── */}
          <div>
            <SectionHeader title="Latest Research Papers" subtitle="New papers from arXiv (cs.AI, cs.LG, cs.CL)" href="/research" />
            {papersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <PaperSkeleton key={i} />)}
              </div>
            ) : trendingPapers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {trendingPapers.map((paper: any) => (
                  <PaperCard key={paper.id} paper={paper} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <p className="text-slate-500 dark:text-slate-400">No papers yet</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
