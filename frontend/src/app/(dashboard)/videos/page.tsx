'use client'

import React, { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Youtube, TrendingUp, Eye, Play } from 'lucide-react'
import api from '@/utils/api'
import { VideoCard, VideoSkeleton, type Video } from '@/components/cards/VideoCard'
import { VideoPlayerModal } from '@/components/modals/VideoPlayerModal'
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
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null)
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

  // Handle both paginated {data: {results: [], count: N}} and flat {data: []}
  const rawData = data?.data
  const videos: any[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.results)
    ? rawData.results
    : []
  const meta = data?.meta || {}
  const totalVideos = meta.total ?? rawData?.count ?? videos.length
  const totalPages = meta.total_pages ?? Math.ceil(totalVideos / PAGE_SIZE) ?? 1
  const totalViews = videos.reduce((s: number, v: any) => s + (v.view_count || 0), 0)

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <VideoPlayerModal video={playingVideo} onClose={() => setPlayingVideo(null)} />
      <div className="space-y-4 sm:space-y-6 pb-8 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white flex items-center gap-2 sm:gap-3 leading-tight">
            <Youtube size={28} className="text-red-500 sm:size-9 shrink-0" />
            Video Library
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 sm:mt-2 text-sm sm:text-base">
            AI-curated tech & ML videos — summarized and searchable
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-3 sm:p-4 text-white overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-xs opacity-90 truncate">Videos</p>
                <p className="text-xl sm:text-3xl font-bold">{totalVideos}</p>
              </div>
              <Play size={22} className="opacity-75 fill-white shrink-0 sm:size-8" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-3 sm:p-4 text-white overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-xs opacity-90 truncate">Topics</p>
                <p className="text-xl sm:text-3xl font-bold">{TOPICS.length - 1}</p>
              </div>
              <TrendingUp size={22} className="opacity-75 shrink-0 sm:size-8" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl p-3 sm:p-4 text-white overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-xs opacity-90 truncate">Views</p>
                <p className="text-xl sm:text-3xl font-bold">
                  {totalViews >= 1_000_000
                    ? `${(totalViews / 1_000_000).toFixed(1)}M`
                    : totalViews >= 1_000
                    ? `${(totalViews / 1_000).toFixed(0)}K`
                    : totalViews}
                </p>
              </div>
              <Eye size={22} className="opacity-75 shrink-0 sm:size-8" />
            </div>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Sort — scrollable on mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-semibold shrink-0">Sort:</span>
            <div className="flex gap-1.5 sm:gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setPage(1) }}
                  className={cn(
                    'px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0',
                    sortBy === opt.value
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result count */}
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {totalVideos} videos
          </p>
        </div>

        {/* Topic pills - horizontal scroll */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-2 scrollbar-hide">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => { setSelectedTopic(topic); setPage(1) }}
              className={cn(
                'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0',
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
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <VideoSkeleton key={i} />
            ))}
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {videos.map((video: any) => (
              <VideoCard key={video.id} video={video} onPlay={(v) => setPlayingVideo(v)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 sm:py-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <Youtube size={44} className="mx-auto text-slate-400 dark:text-slate-500 mb-3" />
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg font-semibold">No videos found</p>
            <p className="text-slate-500 dark:text-slate-500 text-xs sm:text-sm mt-1">
              Try selecting a different topic
            </p>
            <button
              onClick={() => setSelectedTopic('All')}
              className="mt-3 text-red-500 hover:text-red-600 font-semibold text-sm"
            >
              View all videos
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4 flex-wrap">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 sm:px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs sm:text-sm font-semibold"
            >
              ← Prev
            </button>
            <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 px-2 sm:px-4">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 sm:px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs sm:text-sm font-semibold"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
