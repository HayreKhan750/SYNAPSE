'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { ArticleCard, PaperCard } from '@/components/cards';
import { ArticleSkeleton, PaperSkeleton } from '@/components/cards/SkeletonCard';

export default function ForYouTab() {
  const [offset, setOffset] = useState(0);
  const limit = 12;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['recommendations', offset],
    queryFn: () => api.get('/recommendations/', { params: { limit, offset } }).then(r => r.data),
    keepPreviousData: true,
  });

  const articles = data?.data?.articles || [];
  const papers = data?.data?.papers || [];
  const hasMore = (articles.length + papers.length) >= limit; // naive hasMore for minimal path

  const loadMore = () => {
    setOffset((o) => o + limit);
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ArticleSkeleton key={`a-${i}`} />
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <PaperSkeleton key={`p-${i}`} />
          ))}
        </div>
      ) : (
        <>
          {articles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {articles.map((a: any) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          )}

          {papers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {papers.map((p: any) => (
                <PaperCard key={p.id} paper={p} />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                disabled={isFetching}
                className="px-6 py-3 rounded-lg font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-60"
              >
                {isFetching ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
