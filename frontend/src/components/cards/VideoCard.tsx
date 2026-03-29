'use client'

import React from 'react'
import { Play, Eye, ThumbsUp, Clock, Youtube } from 'lucide-react'
import { formatRelativeTime } from '@/utils/helpers'

interface Video {
  id: string
  youtube_id: string
  title: string
  description: string
  summary: string
  channel_name: string
  url: string
  thumbnail_url: string
  duration_seconds: number
  view_count: number
  like_count: number
  published_at: string
  fetched_at: string
  topics: string[] | string
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}


function parseTopics(topics: string[] | string): string[] {
  if (Array.isArray(topics)) return topics
  if (typeof topics === 'string') {
    try {
      const parsed = JSON.parse(topics.replace(/'/g, '"'))
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return topics ? [topics] : []
    }
  }
  return []
}

export function VideoCard({ video }: { video: Video }) {
  const topics = parseTopics(video.topics)
  const duration = formatDuration(video.duration_seconds)
  const views = formatViews(video.view_count)
  const likes = formatViews(video.like_count)
  const ago = formatRelativeTime(video.fetched_at || null)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg hover:border-red-300 dark:hover:border-red-500 transition-all duration-200 group">
      {/* Thumbnail */}
      <a href={video.url} target="_blank" rel="noopener noreferrer" className="block relative">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity"
          />
        ) : (
          <div className="w-full aspect-video bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <Youtube size={48} className="text-red-500 opacity-60" />
          </div>
        )}
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded">
          {duration}
        </div>
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-red-600/90 rounded-full p-4 shadow-lg">
            <Play size={24} className="text-white fill-white ml-1" />
          </div>
        </div>
      </a>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-semibold text-slate-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 transition-colors line-clamp-2 text-sm leading-snug mb-1"
        >
          {video.title}
        </a>

        {/* Channel */}
        <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-2">
          {video.channel_name}
        </p>

        {/* Summary */}
        {video.summary && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
            {video.summary}
          </p>
        )}

        {/* Topics */}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {topics.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full capitalize"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {views}
          </span>
          {video.like_count > 0 && (
            <span className="flex items-center gap-1">
              <ThumbsUp size={12} />
              {likes}
            </span>
          )}
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Clock size={12} />
            {ago}
          </span>
        </div>
      </div>
    </div>
  )
}

export function VideoSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-pulse">
      <div className="w-full aspect-video bg-slate-200 dark:bg-slate-700" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
      </div>
    </div>
  )
}
