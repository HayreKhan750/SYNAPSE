'use client'

import React, { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Youtube, TrendingUp, Eye, Play } from 'lucide-react'
import api from '@/utils/api'
import { VideoCard, VideoSkeleton } from '@/components/cards/VideoCard'
import { cn } from '@/utils/helpers'

const TOPICS = [
  'All',
  'machine learning',
  'artificial intelligence',
  'AI agents',
  'LangChain tutorial',
  'RAG retrieval augmented generation',
  'vector databases',
  'Django REST API',
  'FastAPI',
  'Next.js',
  'system design',
  'large language models',
  'Kubernetes',
  'data engineering',
  'Transformers PyTorch',
  'MLOps',
]

const SORT_OPTIONS = [
  { label: 'Most Viewed', value: '-view_count' },
  { label: 'Most Liked', value: '-like_count' },
  { label: 'Newest', value: '-published_at' },
  { label: 'Longest', value: '-duration_seconds' },
]

export default function VideosPage() {
  const [selectedTopic, setSelectedTopic] = useState('All')
  const [sortBy, setSortBy] = useState('-view_count')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 24

  const { data, isLoading } = useQuery({
    queryKey: ['videos', selectedTopic, sortBy, page],
    queryFn: () =>
      api
        .get('/videos/', {
          params: {
            page,
            page_size: PAGE_SIZE,
            ordering: sortBy,
            ...(selectedTopic !== 'All' ? { search: selectedTopic } : {}),
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  const videos = Array.isArray(data?.data) ? data.data : []
  const meta = data?.meta || {}
  const totalVideos = meta.total || 0
  const totalPages = meta.total_pages || 1
  const totalViews = videos.reduce((s: number, v: any) => s + (v.view_count || 0), 0)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-6 pb-8 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Youtube size={36} className="text-red-500" />
            Video Library
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            AI-curated tech & ML videos — summarized and searchable
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Videos</p>
                <p className="text-3xl font-bold">{totalVideos}</p>
              </div>
              <Play size={32} className="opacity-75 fill-white" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Topics Covered</p>
                <p className="text-3xl font-bold">{TOPICS.length - 1}</p>
              </div>
              <TrendingUp size={32} className="opacity-75" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Views This Page</p>
                <p className="text-3xl font-bold">
                  {totalViews >= 1_000_000
                    ? `${(totalViews / 1_000_000).toFixed(1)}M`
                    : totalViews >= 1_000
                    ? `${(totalViews / 1_000).toFixed(0)}K`
                    : totalViews}
                </p>
              </div>
              <Eye size={32} className="opacity-75" />
            </div>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Sort:</span>
            <div className="flex gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setPage(1) }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    sortBy === opt.value
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result count */}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {totalVideos} videos
          </p>
        </div>

        {/* Topic pills - horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => { setSelectedTopic(topic); setPage(1) }}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0',
                selectedTopic === topic
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {topic === 'All' ? '🎬 All' : topic}
            </button>
          ))}
        </div>

        {/* Videos grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <VideoSkeleton key={i} />
            ))}
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video: any) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <Youtube size={56} className="mx-auto text-slate-400 dark:text-slate-500 mb-4" />
            <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">No videos found</p>
            <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">
              Try selecting a different topic
            </p>
            <button
              onClick={() => setSelectedTopic('All')}
              className="mt-4 text-red-500 hover:text-red-600 font-medium text-sm"
            >
              View all videos
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm font-medium"
            >
              ← Prev
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-400 px-4">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm font-medium"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
