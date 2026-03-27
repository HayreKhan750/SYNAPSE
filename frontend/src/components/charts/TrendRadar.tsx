'use client'

/**
 * TrendRadar — Technology Trend Radar chart.
 *
 * Phase 7.1 — Design System & Animations (Week 19)
 *
 * Uses Recharts RadarChart to visualise topic/technology scores across axes.
 *
 * Props:
 *   data — array of { topic: string; score: number; prevScore?: number }
 *   height — chart height (default 320)
 */

import React from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { SkeletonChart } from '@/components/ui/SkeletonLoader'
import { clsx } from 'clsx'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RadarDataPoint {
  topic:      string
  score:      number
  prevScore?: number
}

interface TrendRadarProps {
  data?:      RadarDataPoint[]
  height?:    number
  className?: string
  loading?:   boolean
  title?:     string
}

// ── Default demo data ──────────────────────────────────────────────────────────

const DEFAULT_DATA: RadarDataPoint[] = [
  { topic: 'AI/ML',       score: 95, prevScore: 80 },
  { topic: 'Web Dev',     score: 78, prevScore: 82 },
  { topic: 'DevOps',      score: 70, prevScore: 65 },
  { topic: 'Security',    score: 60, prevScore: 55 },
  { topic: 'Data Eng.',   score: 72, prevScore: 60 },
  { topic: 'Mobile',      score: 55, prevScore: 58 },
  { topic: 'Blockchain',  score: 38, prevScore: 50 },
]

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as RadarDataPoint
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-slate-900 dark:text-white mb-1">{d.topic}</p>
      <p className="text-indigo-500">Score: <span className="font-bold">{d.score}</span></p>
      {d.prevScore !== undefined && (
        <p className="text-slate-400 text-xs">
          Previous: {d.prevScore}
          <span className={clsx('ml-1', d.score >= d.prevScore ? 'text-green-400' : 'text-red-400')}>
            ({d.score >= d.prevScore ? '+' : ''}{d.score - d.prevScore})
          </span>
        </p>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TrendRadar({
  data    = DEFAULT_DATA,
  height  = 320,
  className,
  loading = false,
  title   = 'Technology Trend Radar',
}: TrendRadarProps) {
  if (loading) {
    return <SkeletonChart height={height} className={className} />
  }

  return (
    <div className={clsx('w-full', className)}>
      {title && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid
            gridType="polygon"
            stroke="rgba(148,163,184,0.2)"
          />
          <PolarAngleAxis
            dataKey="topic"
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 9 }}
            axisLine={false}
          />
          {/* Current period */}
          <Radar
            name="Current"
            dataKey="score"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ fill: '#6366f1', r: 3 }}
          />
          {/* Previous period (if available) */}
          {data.some((d) => d.prevScore !== undefined) && (
            <Radar
              name="Previous"
              dataKey="prevScore"
              stroke="#06b6d4"
              fill="#06b6d4"
              fillOpacity={0.08}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconSize={8}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TrendRadar
