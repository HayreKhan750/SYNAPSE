'use client';

import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, BookOpen, GitBranch, Youtube, Zap, ArrowRight, TrendingUp, Bookmark, MessageSquare, FileText, Twitter } from 'lucide-react';
import Link from 'next/link';
import api from '@/utils/api';
import { ArticleCard, RepositoryCard, PaperCard, TweetCard } from '@/components/cards';
import { VideoCard } from '@/components/cards/VideoCard';
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

// ── TrendStrip — top 6 trending technologies ──────────────────────────────────
const CATEGORY_COLOUR: Record<string, string> = {
  language: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  ai_ml:    'bg-violet-500/15 text-violet-400 border-violet-500/30',
  devops:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  web:      'bg-amber-500/15 text-amber-400 border-amber-500/30',
  general:  'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

function TrendStrip() {
  const { data } = useQuery({
    queryKey: ['trends-strip'],
    queryFn: async () => {
      const { data } = await api.get('/trends/?ordering=-trend_score&limit=6')
      // Normalize: backend returns {success, count, results: [...]}
      const items: any[] = Array.isArray(data?.results) ? data.results
        : Array.isArray(data?.data) ? data.data
        : Array.isArray(data) ? data : []
      return items
    },
    staleTime: 120_000,
  })
  const trends: any[] = Array.isArray(data) ? data : []
  if (!trends.length) return null
  const maxScore = Math.max(...trends.map((t: any) => t.trend_score), 1)

  return (
    <div className="mb-6 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-card dark:shadow-none">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-amber-500 dark:text-amber-400" />
          <span className="text-sm font-bold text-slate-800 dark:text-white">🔥 Trending Technologies</span>
        </div>
        <Link href="/trends" className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors">
          View all <ArrowRight size={11} />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {trends.map((t: any) => {
          const pct = Math.round((t.trend_score / maxScore) * 100)
          const colour = CATEGORY_COLOUR[t.category] ?? CATEGORY_COLOUR.general
          return (
            <Link key={t.id} href="/trends" className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:scale-105 ${colour}`}>
              <span className="truncate max-w-[80px]">{t.technology_name}</span>
              <span className="opacity-60 text-[10px] font-bold">{pct}%</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

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
  const queryClient = useQueryClient();

  // When a workflow completes and scraping is queued, invalidate count badges
  // so the home page reflects the new article/paper/repo counts promptly.
  useEffect(() => {
    const invalidateCounts = () => {
      // Stat badge counts
      queryClient.invalidateQueries({ queryKey: ['articles', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['papers', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['repos', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['videos', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['tweets', 'count'] });
      // Content sections on home
      queryClient.invalidateQueries({ queryKey: ['articles', 'home'] });
      queryClient.invalidateQueries({ queryKey: ['repos', 'home'] });
      queryClient.invalidateQueries({ queryKey: ['papers', 'home'] });
      queryClient.invalidateQueries({ queryKey: ['videos', 'home'] });
      queryClient.invalidateQueries({ queryKey: ['tweets', 'home'] });
      // GitHub page list
      queryClient.invalidateQueries({ queryKey: ['repos', 'list'] });
    };

    // Same-page event (unlikely on home, but included for completeness)
    window.addEventListener('synapse:workflow-complete', invalidateCounts);

    // Cross-tab / cross-page: workflow completed on automation page then user navigated here
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'synapse:workflow-complete-at' && e.newValue) invalidateCounts();
    };
    window.addEventListener('storage', onStorage);

    // On mount: if there's a fresh workflow-complete signal (within 3 min),
    // immediately re-fetch counts so navigation to home shows updated numbers.
    const storedAt = localStorage.getItem('synapse:workflow-complete-at');
    if (storedAt) {
      const elapsed = Date.now() - parseInt(storedAt, 10);
      if (elapsed < 3 * 60 * 1000) invalidateCounts();
    }

    return () => {
      window.removeEventListener('synapse:workflow-complete', invalidateCounts);
      window.removeEventListener('storage', onStorage);
    };
  }, [queryClient]);

  // Latest content for the home sections — ordered by scraped_at so newly
  // fetched items always appear at the top immediately after a workflow run.
  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', 'home'],
    queryFn: () => api.get('/articles/', { params: { page_size: 6, ordering: '-scraped_at' } }).then(r => r.data),
    staleTime: 30_000,
    gcTime:   10 * 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: repos, isLoading: reposLoading } = useQuery({
    queryKey: ['repos', 'home'],
    queryFn: () => api.get('/repos/', { params: { page_size: 3, ordering: '-scraped_at' } }).then(r => r.data),
    staleTime: 30_000,
    gcTime:   10 * 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: papers, isLoading: papersLoading } = useQuery({
    queryKey: ['papers', 'home'],
    queryFn: () => api.get('/papers/', { params: { page_size: 3, ordering: '-fetched_at' } }).then(r => r.data),
    staleTime: 30_000,
    gcTime:   10 * 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: videosData, isLoading: videosLoading } = useQuery({
    queryKey: ['videos', 'home'],
    queryFn: () => api.get('/videos/', { params: { page_size: 4, ordering: '-fetched_at' } }).then(r => r.data),
    staleTime: 30_000,
    gcTime:   10 * 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: tweetsData, isLoading: tweetsLoading } = useQuery({
    queryKey: ['tweets', 'home'],
    queryFn: () => api.get('/tweets/', { params: { page_size: 4, ordering: '-scraped_at' } }).then(r => r.data),
    staleTime: 30_000,         // 30s — count stays fresh
    gcTime:   10 * 60_000,
    refetchOnWindowFocus: true, // re-fetch when user returns to the tab
  });

  // Derive counts from content queries — no extra network requests needed
  const articleCount = articles;
  const paperCount   = papers;
  const repoCount    = repos;
  const videoCount   = videosData;
  const tweetCount   = tweetsData;

  const extractList = (d: any, n: number) =>
    Array.isArray(d?.results) ? d.results.slice(0, n)
    : Array.isArray(d?.data) ? d.data.slice(0, n)
    : Array.isArray(d) ? (d as any[]).slice(0, n) : [];

  const trendingArticles = extractList(articles, 4);
  const trendingRepos    = extractList(repos, 3);
  const trendingPapers   = extractList(papers, 3);
  const trendingVideos   = extractList(videosData, 4);
  const trendingTweets   = extractList(tweetsData, 4);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="pb-10">

        {/* ── Hero Banner ──────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-slate-900 dark:via-indigo-950/80 dark:to-slate-900 px-6 pt-8 pb-12 overflow-hidden border-b border-indigo-100 dark:border-transparent">
          <div className="absolute inset-0 bg-grid-pattern opacity-10 dark:opacity-20" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-200/40 dark:bg-indigo-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/3 w-56 h-56 bg-violet-200/30 dark:bg-cyan-600/15 rounded-full blur-3xl translate-y-1/2" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 text-xs font-semibold mb-4">
              <Zap size={10} className="fill-indigo-500 text-indigo-500 dark:fill-indigo-400 dark:text-indigo-400" />
              AI-Powered Tech Intelligence
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-2 tracking-tight leading-tight">
              Welcome to <span className="gradient-text">SYNAPSE</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-base max-w-lg">
              Your personal AI-curated feed of articles, papers, repos, and videos — all searchable and summarized.
            </p>
          </div>
        </div>

        <div className="px-6 space-y-10 mt-6">

          {/* ── Stats Row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={BarChart3} label="Articles"      value={articleCount?.meta?.total ?? 0} gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"  href="/feed"     />
            <StatCard icon={BookOpen}  label="Papers"        value={paperCount?.meta?.total ?? 0}   gradient="bg-gradient-to-br from-violet-500 to-violet-700"   href="/research" />
            <StatCard icon={GitBranch} label="Repositories"  value={repoCount?.meta?.total ?? 0}    gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" href="/github"   />
            <StatCard icon={Youtube}   label="Videos"        value={videoCount?.meta?.total ?? 0}   gradient="bg-gradient-to-br from-red-500 to-red-700"         href="/videos"   />
            <StatCard icon={Twitter}   label="Tweets"        value={tweetCount?.meta?.total ?? 0}   gradient="bg-gradient-to-br from-sky-500 to-sky-700"         href="/tweets"   />
          </div>

          {/* ── Latest Articles + GitHub ───────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {/* ── Top Trends strip ── */}
              <TrendStrip />

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

          {/* ── Videos ───────────────────────────────────────────── */}
          <div>
            <SectionHeader title="Latest Videos" subtitle="AI-curated tech & ML videos" href="/videos" />
            {videosLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse aspect-video" />
                ))}
              </div>
            ) : trendingVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {trendingVideos.map((video: any) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <p className="text-slate-500 dark:text-slate-400">No videos yet</p>
              </div>
            )}
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

          {/* ── X/Tweets ───────────────────────────────────────────── */}
          <div>
            <SectionHeader title="Latest from X (Twitter)" subtitle="Curated tweets on AI, programming & tech" href="/tweets" />
            {tweetsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse h-48" />)}
              </div>
            ) : trendingTweets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {trendingTweets.map((tweet: any) => (
                  <TweetCard key={tweet.id} tweet={tweet} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <p className="text-slate-500 dark:text-slate-400">No tweets yet</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
