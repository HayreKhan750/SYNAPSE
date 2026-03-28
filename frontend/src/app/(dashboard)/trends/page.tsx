'use client'

/**
 * /trends — Technology Trend Analysis page
 * Shows TechnologyTrend data: top techs by score, category filters, sparkline bars.
 * Wires to GET /api/v1/trends/technology-trends/
 */

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
import { TrendingUp, Loader2, RefreshCw, BarChart2, Zap } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface TechnologyTrend {
  id: string
  technology_name: string
  date: string
  mention_count: number
  trend_score: number
  category: 'language' | 'ai_ml' | 'devops' | 'web' | 'general'
  sources: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; colour: string; bg: string }> = {
  all:      { label: 'All',       colour: 'text-slate-300',  bg: 'bg-slate-700'      },
  language: { label: 'Languages', colour: 'text-cyan-400',   bg: 'bg-cyan-500/20'    },
  ai_ml:    { label: 'AI / ML',   colour: 'text-violet-400', bg: 'bg-violet-500/20'  },
  devops:   { label: 'DevOps',    colour: 'text-emerald-400',bg: 'bg-emerald-500/20' },
  web:      { label: 'Web',       colour: 'text-amber-400',  bg: 'bg-amber-500/20'   },
  general:  { label: 'General',   colour: 'text-slate-400',  bg: 'bg-slate-500/20'   },
}

// ── API helper ────────────────────────────────────────────────────────────────

function extractList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj['data'])) return obj['data'] as T[]
    if (Array.isArray(obj['results'])) return obj['results'] as T[]
  }
  return []
}

const fetchTrends = async (): Promise<TechnologyTrend[]> => {
  // GET /api/v1/trends/?ordering=-trend_score&limit=50
  // Returns { success, count, results: [...] }
  const { data } = await api.get('/trends/?ordering=-trend_score&limit=50')
  // Try data.results first, then data.data, then plain array
  if (Array.isArray(data?.results)) return data.results
  return extractList<TechnologyTrend>(data)
}

// ── TrendBar ──────────────────────────────────────────────────────────────────

function TrendBar({ score, maxScore, colour }: { score: number; maxScore: number; colour: string }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  return (
    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colour.replace('text-', 'bg-')}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── TrendCard ─────────────────────────────────────────────────────────────────

function TrendCard({ trend, rank, maxScore }: { trend: TechnologyTrend; rank: number; maxScore: number }) {
  const cfg = CATEGORY_CONFIG[trend.category] ?? CATEGORY_CONFIG.general

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-indigo-500/40 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        {/* Rank */}
        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-slate-400">#{rank}</span>
        </div>

        {/* Name + category */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white text-sm">{trend.technology_name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.colour}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Zap size={11} className="text-yellow-500" />
              Score: <strong className="text-slate-300 ml-0.5">{trend.trend_score.toFixed(1)}</strong>
            </span>
            <span className="flex items-center gap-1">
              <BarChart2 size={11} />
              {trend.mention_count} mentions
            </span>
            {trend.sources?.length > 0 && (
              <span className="text-slate-600">{trend.sources.join(', ')}</span>
            )}
          </div>
        </div>

        {/* Score badge */}
        <div className="flex-shrink-0 text-right">
          <p className="text-lg font-black text-white">{Math.round(trend.trend_score)}</p>
          <p className="text-xs text-slate-500">score</p>
        </div>
      </div>

      <TrendBar score={trend.trend_score} maxScore={maxScore} colour={cfg.colour} />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [category, setCategory] = useState<string>('all')

  const { data: trends = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['technology-trends'],
    queryFn: fetchTrends,
    staleTime: 5 * 60_000,
  })

  const filtered = category === 'all'
    ? trends
    : trends.filter(t => t.category === category)

  const maxScore = filtered.reduce((m, t) => Math.max(m, t.trend_score), 0)

  // Count per category for badges
  const categoryCounts = trends.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24 lg:pb-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30">
              <TrendingUp size={24} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Technology Trends</h1>
              <p className="text-slate-400 text-sm">
                Daily trend scores mined from articles &amp; repositories
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm rounded-xl transition-colors"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Summary stats */}
        {trends.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Technologies tracked', value: trends.length },
              { label: 'AI / ML entries',       value: trends.filter(t => t.category === 'ai_ml').length },
              { label: 'Avg trend score',        value: Math.round(trends.reduce((s, t) => s + t.trend_score, 0) / trends.length) },
              { label: 'Top score',              value: Math.round(maxScore) },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const count = key === 'all' ? trends.length : (categoryCounts[key] ?? 0)
            const active = category === key
            return (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  active
                    ? `${cfg.bg} ${cfg.colour} border-current`
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {cfg.label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-black/20' : 'bg-slate-700'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 size={28} className="animate-spin mr-3" /> Loading trends…
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <TrendingUp size={48} className="mx-auto mb-3 opacity-20 text-slate-500" />
            <p className="text-slate-400 text-sm mb-4">Could not load trends data.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <TrendingUp size={48} className="mx-auto mb-3 opacity-20 text-slate-500" />
            <p className="text-slate-400 text-sm">
              {trends.length === 0
                ? 'No trend data yet. The daily analysis task will populate this automatically.'
                : 'No trends in this category.'}
            </p>
            {trends.length === 0 && (
              <p className="text-xs text-slate-600 mt-2">
                Runs daily at midnight UTC via Celery Beat (analyze_trends_task).
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((trend, i) => (
              <TrendCard key={trend.id} trend={trend} rank={i + 1} maxScore={maxScore} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
