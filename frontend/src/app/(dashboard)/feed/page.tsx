'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ForYouTab from './ForYouTab';
import TrendingTab from './TrendingTab';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Search, RefreshCw } from 'lucide-react';
import api from '@/utils/api';
import { ArticleCard } from '@/components/cards';
import RecommendedSection from './RecommendedSection';
import { ArticleSkeleton } from '@/components/cards/SkeletonCard';
import { cn } from '@/utils/helpers';

const TOPICS = ['All', 'AI', 'Web Dev', 'Security', 'Cloud', 'Research', 'DevOps'];
const SORT_OPTIONS = ['Latest', 'Trending'];

// Poll every 15 s while any article is still missing a summary.
const SUMMARY_POLL_INTERVAL = 15_000;
// After a workflow run finishes, poll aggressively for 3 min to pick up new scraped data.
const POST_WORKFLOW_POLL_INTERVAL = 10_000;
const POST_WORKFLOW_POLL_DURATION = 3 * 60 * 1000; // 3 minutes

export default function FeedPage() {
  const queryClient = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'latest' | 'trending'>('latest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'latest' | 'for-you' | 'trending'>('latest');
  // Banner shown when new articles arrive after a workflow run
  const [newArticleCount, setNewArticleCount] = useState(0);
  const [showNewBanner, setShowNewBanner] = useState(false);
  // Whether to poll aggressively (after a workflow run triggered scraping)
  const [postWorkflowPolling, setPostWorkflowPolling] = useState(false);
  const postWorkflowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevArticleCount = useRef<number>(0);

  const topicParam = selectedTopic === 'All' ? undefined : selectedTopic.toLowerCase();

  // Activate post-workflow polling mode for the given duration from now.
  const activatePostWorkflowPolling = useCallback(() => {
    setPostWorkflowPolling(true);
    if (postWorkflowTimer.current) clearTimeout(postWorkflowTimer.current);
    postWorkflowTimer.current = setTimeout(() => {
      setPostWorkflowPolling(false);
      localStorage.removeItem('synapse:workflow-complete-at');
    }, POST_WORKFLOW_POLL_DURATION);
  }, []);

  // On mount: check if a workflow completed recently (within the last 3 min)
  // and activate polling immediately — handles the "navigate to feed" case.
  useEffect(() => {
    const storedAt = localStorage.getItem('synapse:workflow-complete-at');
    if (storedAt) {
      const elapsed = Date.now() - parseInt(storedAt, 10);
      if (elapsed < POST_WORKFLOW_POLL_DURATION) {
        // Still within the 3-minute window — activate polling for the remainder
        setPostWorkflowPolling(true);
        const remaining = POST_WORKFLOW_POLL_DURATION - elapsed;
        postWorkflowTimer.current = setTimeout(() => {
          setPostWorkflowPolling(false);
          localStorage.removeItem('synapse:workflow-complete-at');
        }, remaining);
      } else {
        // Signal is stale — clear it
        localStorage.removeItem('synapse:workflow-complete-at');
      }
    }
    return () => {
      if (postWorkflowTimer.current) clearTimeout(postWorkflowTimer.current);
    };
  }, []);

  // Also listen for same-page event (if user stays on feed while workflow runs
  // in background, or in a different tab via storage event).
  useEffect(() => {
    const onWorkflowComplete = () => activatePostWorkflowPolling();
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === 'synapse:workflow-complete-at' && e.newValue) {
        activatePostWorkflowPolling();
      }
    };
    window.addEventListener('synapse:workflow-complete', onWorkflowComplete);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.removeEventListener('synapse:workflow-complete', onWorkflowComplete);
      window.removeEventListener('storage', onStorageChange);
    };
  }, [activatePostWorkflowPolling]);

  // Fire-and-forget: kick off summarization when the feed mounts so articles
  // get summaries even if the Celery beat worker hasn't run yet.
  const didTrigger = useRef(false);
  useEffect(() => {
    if (didTrigger.current) return;
    didTrigger.current = true;
    api.post('/articles/summarize/', { batch_size: 20 }).catch(() => {});
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['articles', topicParam, page, sortBy],
    queryFn: () =>
      api.get('/articles/', {
        params: {
          page,
          topic: topicParam,
          ordering: sortBy === 'trending' ? '-trending_score' : '-published_at',
        },
      }).then(r => r.data),
    // Poll aggressively after a workflow run; otherwise only while summaries are pending.
    refetchInterval: (query) => {
      if (postWorkflowPolling) return POST_WORKFLOW_POLL_INTERVAL;
      const articles: any[] = Array.isArray(query.state.data?.data)
        ? query.state.data.data
        : Array.isArray(query.state.data?.results)
        ? query.state.data.results
        : [];
      const hasPending = articles.some((a: any) => !a.summary || a.summary === '');
      return hasPending ? SUMMARY_POLL_INTERVAL : false;
    },
    refetchIntervalInBackground: false,
  });

  const articles = Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  const totalCount = data?.meta?.total || data?.count || 0;

  // Detect when new articles arrive during post-workflow polling and show banner
  useEffect(() => {
    if (!postWorkflowPolling) return;
    const current = totalCount;
    if (prevArticleCount.current > 0 && current > prevArticleCount.current) {
      const diff = current - prevArticleCount.current;
      setNewArticleCount(diff);
      setShowNewBanner(true);
    }
    prevArticleCount.current = current;
  }, [totalCount, postWorkflowPolling]);

  const handleRefreshFeed = useCallback(() => {
    setShowNewBanner(false);
    setNewArticleCount(0);
    setPage(1);
    queryClient.invalidateQueries({ queryKey: ['articles'] });
  }, [queryClient]);

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
          <div className="flex items-center gap-2">
            {/* Manual refresh button */}
            <button
              onClick={handleRefreshFeed}
              disabled={isFetching}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
              title="Refresh feed"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <span className={`w-1.5 h-1.5 rounded-full ${postWorkflowPolling ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
              {postWorkflowPolling ? 'Watching for new articles…' : 'Live updates'}
            </span>
          </div>
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

      {/* ── New articles banner (appears after workflow scraping completes) ── */}
      {showNewBanner && (
        <div className="flex items-center justify-between gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-indigo-300">
            <span className="text-lg">🆕</span>
            <span>
              <strong>{newArticleCount} new article{newArticleCount !== 1 ? 's' : ''}</strong> scraped and ready!
            </span>
          </div>
          <button
            onClick={handleRefreshFeed}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw size={12} />
            Show now
          </button>
        </div>
      )}

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
