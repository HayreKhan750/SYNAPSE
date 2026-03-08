'use client';

import React, { useState } from 'react';
import ForYouTab from './ForYouTab';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search } from 'lucide-react';
import api from '@/utils/api';
import { ArticleCard } from '@/components/cards';
import RecommendedSection from './RecommendedSection';
import { ArticleSkeleton } from '@/components/cards/SkeletonCard';
import { cn } from '@/utils/helpers';

const TOPICS = ['All', 'AI', 'Web Dev', 'Security', 'Cloud', 'Research', 'DevOps'];
const SORT_OPTIONS = ['Latest', 'Trending'];

export default function FeedPage() {
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'latest' | 'trending'>('latest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'latest' | 'for-you'>('latest');

  const topicParam = selectedTopic === 'All' ? undefined : selectedTopic.toLowerCase();

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
  });

  const articles = Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  const totalCount = data?.meta?.total || data?.count || 0;
  const pageSize = articles.length;

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Tech Intelligence Feed</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">Stay updated with the latest in tech</p>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Topic filter pills */}
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => {
                setSelectedTopic(topic);
                setPage(1);
              }}
              className={cn(
                'px-4 py-2 rounded-full font-medium transition-all',
                selectedTopic === topic
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {topic}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center justify-between">
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className={cn(
                'px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all',
                'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              Sort: {sortBy === 'latest' ? 'Latest' : 'Trending'}
              <ChevronDown size={16} className={cn('transition-transform', showSortDropdown && 'rotate-180')} />
            </button>

            {showSortDropdown && (
              <div className="absolute top-full mt-2 left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 min-w-[150px]">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSortBy(option.toLowerCase() as 'latest' | 'trending');
                      setShowSortDropdown(false);
                      setPage(1);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg',
                      sortBy === option.toLowerCase()
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

          {/* Total count */}
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Showing {articles.length} of {totalCount} articles
          </div>
        </div>
      </div>

     {/* Tabs */}
     <div className="flex gap-2 mb-2">
       <button
         onClick={() => setActiveTab('latest')}
         className={cn('px-4 py-2 rounded-lg font-medium', activeTab === 'latest' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300')}
       >
         Latest
       </button>
       <button
         onClick={() => setActiveTab('for-you')}
         className={cn('px-4 py-2 rounded-lg font-medium', activeTab === 'for-you' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300')}
       >
         For You
       </button>
     </div>

     {activeTab === 'for-you' ? (
       <ForYouTab />
     ) : (
       <>
         {/* Articles grid */}
         {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ArticleSkeleton key={i} />
          ))}
        </div>
      ) : articles.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articles.map((article: any) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {/* Load More button */}
          {pageSize >= 12 && articles.length < totalCount && (
            <div className="flex justify-center mt-8">
              <button
                onClick={handleLoadMore}
                className={cn(
                  'px-6 py-3 rounded-lg font-medium transition-all',
                  'bg-indigo-500 hover:bg-indigo-600 text-white',
                  'hover:shadow-lg'
                )}
              >
                Load More Articles
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <Search size={48} className="mx-auto text-slate-400 dark:text-slate-500 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">No articles found for your filters</p>
          <button
            onClick={() => {
              setSelectedTopic('All');
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
