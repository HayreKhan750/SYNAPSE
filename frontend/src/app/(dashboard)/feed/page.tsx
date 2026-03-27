'use client';

import React, { useState, useEffect, useRef } from 'react';
import ForYouTab from './ForYouTab';
import TrendingTab from './TrendingTab';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search } from 'lucide-react';
import api from '@/utils/api';
import { ArticleCard } from '@/components/cards';
import RecommendedSection from './RecommendedSection';
import { ArticleSkeleton } from '@/components/cards/SkeletonCard';
import { cn } from '@/utils/helpers';

const TOPICS = ['All', 'AI', 'Web Dev', 'Security', 'Cloud', 'Research', 'DevOps'];
const SORT_OPTIONS = ['Latest', 'Trending'];

// How often to refetch articles while there are still pending summaries (ms).
const SUMMARY_POLL_INTERVAL = 15_000; // 15 s

export default function FeedPage() {
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'latest' | 'trending'>('latest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'latest' | 'for-you' | 'trending'>('latest');

  const topicParam = selectedTopic === 'All' ? undefined : selectedTopic.toLowerCase();

  // Fire-and-forget: kick off summarization when the feed mounts so articles
  // get summaries even if the Celery beat worker hasn't run yet.
  const didTrigger = useRef(false);
  useEffect(() => {
    if (didTrigger.current) return;
    didTrigger.current = true;
    api.post('/articles/summarize/', { batch_size: 20 }).catch(() => {
      // Non-critical — silently ignore if the worker/endpoint is unavailable
    });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['articles', topicParam, page, sortBy],
    queryFn: () =>
      api.get('/articles/', {
        params: {
          page,
          topic: topicParam,
          ordering: sortBy === 'trending' ? '-trending_score' : '-published_at',
        },
      }).then(r => r.data),
    // Poll every 15 s while any article on this page still has no summary.
    // React Query will stop polling automatically when refetchInterval returns false.
    refetchInterval: (query) => {
      const articles: any[] = Array.isArray(query.state.data?.data)
        ? query.state.data.data
        : Array.isArray(query.state.data?.results)
        ? query.state.data.results
        : [];
      const hasPending = articles.some(
        (a: any) => !a.summary || a.summary === ''
      );
      return hasPending ? SUMMARY_POLL_INTERVAL : false;
    },
    refetchIntervalInBackground: false, // only poll when the tab is visible
  });

  const articles = Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  const totalCount = data?.meta?.total || data?.count || 0;
  const pageSize = articles.length;

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="pb-8">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Tech Intelligence Feed</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{totalCount} articles curated from around the web</p>
          </div>
          <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live updates
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['latest', 'for-you', 'trending'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                activeTab === tab
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              {tab === 'for-you' ? 'For You ✨' : tab === 'trending' ? '🔥 Trending' : 'Latest'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-5 space-y-5">

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Topic pills - scrollable */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 flex-1">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => { setSelectedTopic(topic); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0',
                selectedTopic === topic
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {topic}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            {sortBy === 'latest' ? '📅 Latest' : '🔥 Trending'}
            <ChevronDown size={14} className={cn('transition-transform', showSortDropdown && 'rotate-180')} />
          </button>
          {showSortDropdown && (
            <div className="absolute top-full mt-1 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 min-w-[130px] overflow-hidden animate-scale-in">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => { setSortBy(option.toLowerCase() as any); setShowSortDropdown(false); setPage(1); }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors',
                    sortBy === option.toLowerCase()
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      {activeTab === 'for-you' ? (
        <ForYouTab />
      ) : activeTab === 'trending' ? (
        <TrendingTab />
      ) : (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <ArticleSkeleton key={i} />)}
            </div>
          ) : articles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {articles.map((article: any) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
              {articles.length < totalCount && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={handleLoadMore}
                    className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white transition-all shadow-sm hover:shadow-md"
                  >
                    Load more articles
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <Search size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">No articles found</p>
              <button onClick={() => { setSelectedTopic('All'); setPage(1); }} className="mt-3 text-sm text-indigo-500 hover:text-indigo-600 font-medium">
                Clear filters
              </button>
            </div>
          )}
        </>
      )}

      </div>
    </div>
    </div>
  );
}
