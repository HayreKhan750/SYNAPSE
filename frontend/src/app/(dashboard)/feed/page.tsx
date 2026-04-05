'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ForYouTab from './ForYouTab';
import TrendingTab from './TrendingTab';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Search, RefreshCw } from 'lucide-react';
import { api } from '@/utils/api';
import { ArticleCard } from '@/components/cards';
import RecommendedSection from './RecommendedSection';
import { ArticleSkeleton } from '@/components/cards/SkeletonCard';
import { cn } from '@/utils/helpers';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { ScrollSentinel } from '@/components/ui/ScrollSentinel';

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

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const { items: articles, sentinelRef, isFetchingNextPage, isLoading, hasNextPage, total: totalCount, reset: resetFeed } =
    useInfiniteScroll<any>({
      fetchPage: useCallback(async (page: number) => {
        const r = await api.get('/articles/', {
          params: {
            page,
            page_size: 12,
            topic: topicParam,
            ordering: sortBy === 'trending' ? '-trending_score' : '-published_at',
          },
        });
        const d = r.data;
        const items = Array.isArray(d?.data) ? d.data : Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
        const total = d?.meta?.total ?? d?.count ?? items.length;
        return { items, total };
      }, [topicParam, sortBy]),
      deps: [topicParam, sortBy],
    });

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
    resetFeed();
    queryClient.invalidateQueries({ queryKey: ['articles'] });
  }, [queryClient, resetFeed]);

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="pb-8">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">Tech Intelligence Feed</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">{totalCount} articles curated</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Manual refresh button */}
            <button
              onClick={handleRefreshFeed}
              disabled={isFetchingNextPage}
              className="flex items-center gap-1 sm:gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 sm:px-3 py-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
              title="Refresh feed"
            >
              <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{isLoading ? 'Refreshing…' : 'Refresh'}</span>
            </button>
            <span className="hidden xs:flex items-center gap-1 sm:gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 sm:px-3 py-1.5 rounded-full whitespace-nowrap">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${postWorkflowPolling ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="hidden sm:inline">{postWorkflowPolling ? 'Watching…' : 'Live'}</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 sm:gap-1 mt-3 sm:mt-4 overflow-x-auto scrollbar-hide">
          {(['latest', 'for-you', 'trending'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0',
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

      <div className="px-4 sm:px-6 pt-4 sm:pt-5 space-y-4 sm:space-y-5">

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {/* Topic pills - scrollable */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-0.5 flex-1">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => { setSelectedTopic(topic); }}
              className={cn(
                'px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0',
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
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1 sm:gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all whitespace-nowrap"
          >
            {sortBy === 'latest' ? '📅 Latest' : '🔥 Trending'}
            <ChevronDown size={13} className={cn('transition-transform', showSortDropdown && 'rotate-180')} />
          </button>
          {showSortDropdown && (
            <div className="absolute top-full mt-1 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 min-w-[120px] sm:min-w-[130px] overflow-hidden">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => { setSortBy(option.toLowerCase() as any); setShowSortDropdown(false); }}
                  className={cn(
                    'w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm transition-colors',
                    sortBy === option.toLowerCase()
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold'
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

      {/* ── New articles banner ── */}
      {showNewBanner && (
        <div className="flex items-center justify-between gap-2 sm:gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-indigo-600 dark:text-indigo-300">
            <span className="text-base sm:text-lg shrink-0">🆕</span>
            <span>
              <strong>{newArticleCount} new article{newArticleCount !== 1 ? 's' : ''}</strong> ready!
            </span>
          </div>
          <button
            onClick={handleRefreshFeed}
            className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-slate-800 dark:text-white bg-indigo-600 hover:bg-indigo-500 px-2.5 sm:px-3 py-1.5 rounded-xl transition-colors shrink-0"
          >
            <RefreshCw size={11} />
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
              <ScrollSentinel
                sentinelRef={sentinelRef}
                isFetchingNextPage={isFetchingNextPage}
                hasNextPage={hasNextPage}
                onRetry={resetFeed}
                endLabel={`All ${totalCount} articles loaded ✨`}
              />
            </>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col items-center gap-3 px-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Search size={28} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-slate-800 dark:text-slate-200 font-semibold text-lg">No articles found</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                  {selectedTopic !== 'All'
                    ? `No articles found for topic "${selectedTopic}". Try a different topic or clear the filter.`
                    : 'Your feed is empty. Complete onboarding to personalise it, or wait for new articles to be scraped.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-center">
                {selectedTopic !== 'All' && (
                  <button
                    onClick={() => { setSelectedTopic('All'); }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    Clear filter
                  </button>
                )}
                <a
                  href="/wizard"
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  ✨ Personalise feed
                </a>
              </div>
            </div>
          )}
        </>
      )}

      </div>
    </div>
    </div>
  );
}
