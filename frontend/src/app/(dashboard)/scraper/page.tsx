'use client'

/**
 * /scraper — Scraper Control Center
 * Premium diamond-level UI for configuring and running all scrapers.
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Youtube, GitBranch, Newspaper, BookOpen, Play, Loader2,
  Settings2, ChevronDown, ChevronUp, Zap, Clock, CheckCircle2,
  AlertCircle, RefreshCw, Plus, X, BarChart2, Activity,
  Database, Cpu, Globe,
} from 'lucide-react'
import api from '@/utils/api'
import { cn } from '@/utils/helpers'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScraperJob {
  id: string
  scraper: string
  status: 'queued' | 'running' | 'success' | 'failed'
  started_at: string
  completed_at?: string
  result?: Record<string, unknown>
  error?: string
}

// ── Scraper Config ─────────────────────────────────────────────────────────────

const SCRAPERS = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    colour: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    activeBorder: 'border-red-500/60',
    glow: 'shadow-red-500/20',
    description: 'Scrape YouTube videos by custom search queries',
    endpoint: '/scraper/run/youtube/',
    fields: [
      { key: 'queries', label: 'Search Queries', type: 'textarea', placeholder: 'machine learning tutorial\nAI agents explained\nLLM fine-tuning\nPython data science\nReact tutorial 2024', help: 'One search query per line. Leave blank to use smart defaults.' },
      { key: 'max_results', label: 'Max Videos', type: 'number', placeholder: '20', min: 5, max: 100, default: 20 },
      { key: 'days_back', label: 'Days Back', type: 'number', placeholder: '30', min: 1, max: 365, default: 30 },
    ],
    defaultParams: { queries: '', max_results: 20, days_back: 30 },
  },
  {
    id: 'github',
    name: 'GitHub Trending',
    icon: GitBranch,
    colour: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    activeBorder: 'border-emerald-500/60',
    glow: 'shadow-emerald-500/20',
    description: 'Fetch trending repositories from GitHub',
    endpoint: '/scraper/run/github/',
    fields: [
      { key: 'language', label: 'Language Filter', type: 'select', options: ['All', 'Python', 'JavaScript', 'TypeScript', 'Rust', 'Go', 'Java', 'C++'], default: 'All' },
      { key: 'since', label: 'Trending Since', type: 'select', options: ['daily', 'weekly', 'monthly'], default: 'daily' },
      { key: 'max_repos', label: 'Max Repos', type: 'number', placeholder: '25', min: 5, max: 100, default: 25 },
    ],
    defaultParams: { language: 'All', since: 'daily', max_repos: 25 },
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    icon: Newspaper,
    colour: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    activeBorder: 'border-orange-500/60',
    glow: 'shadow-orange-500/20',
    description: 'Collect top stories from Hacker News',
    endpoint: '/scraper/run/hackernews/',
    fields: [
      { key: 'story_type', label: 'Story Type', type: 'select', options: ['top', 'new', 'best', 'ask', 'show'], default: 'top' },
      { key: 'max_stories', label: 'Max Stories', type: 'number', placeholder: '30', min: 5, max: 200, default: 30 },
      { key: 'min_score', label: 'Min Score', type: 'number', placeholder: '10', min: 0, max: 1000, default: 10 },
    ],
    defaultParams: { story_type: 'top', max_stories: 30, min_score: 10 },
  },
  {
    id: 'arxiv',
    name: 'arXiv Papers',
    icon: BookOpen,
    colour: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    activeBorder: 'border-violet-500/60',
    glow: 'shadow-violet-500/20',
    description: 'Fetch cutting-edge research papers from arXiv',
    endpoint: '/scraper/run/arxiv/',
    fields: [
      { key: 'categories', label: 'arXiv Categories', type: 'textarea', placeholder: 'cs.AI\ncs.LG\ncs.CL\ncs.CV\nstat.ML', help: 'One arXiv category per line (e.g. cs.AI, cs.LG)' },
      { key: 'max_papers', label: 'Max Papers', type: 'number', placeholder: '20', min: 5, max: 100, default: 20 },
      { key: 'days_back', label: 'Days Back', type: 'number', placeholder: '7', min: 1, max: 90, default: 7 },
    ],
    defaultParams: { categories: 'cs.AI\ncs.LG\ncs.CL', max_papers: 20, days_back: 7 },
  },
]

// ── Scraper Backend API ───────────────────────────────────────────────────────

async function triggerScraper(scraperId: string, params: Record<string, unknown>) {
  const res = await api.post('/scraper/run/', { scraper: scraperId, params })
  return res.data
}

async function fetchScraperStats() {
  const res = await api.get('/scraper/stats/')
  return res.data
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { icon: React.ElementType; colour: string; bg: string; label: string }> = {
    queued:  { icon: Clock,         colour: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',   label: 'Queued'  },
    running: { icon: Loader2,       colour: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',     label: 'Running' },
    success: { icon: CheckCircle2,  colour: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20',label: 'Done'   },
    failed:  { icon: AlertCircle,   colour: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',       label: 'Failed'  },
  }
  const c = cfg[status] ?? cfg.queued
  const Icon = c.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', c.bg, c.colour)}>
      <Icon size={9} className={status === 'running' ? 'animate-spin' : ''} />
      {c.label}
    </span>
  )
}

// ── ScraperCard ───────────────────────────────────────────────────────────────

function ScraperCard({ scraper, onRun }: { scraper: typeof SCRAPERS[0]; onRun: (id: string, params: Record<string, unknown>) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [params, setParams] = useState<Record<string, unknown>>(scraper.defaultParams)
  const [running, setRunning] = useState(false)
  const Icon = scraper.icon

  const setParam = (key: string, val: unknown) => setParams(p => ({ ...p, [key]: val }))

  const handleRun = async () => {
    setRunning(true)
    try {
      await onRun(scraper.id, params)
    } finally {
      setTimeout(() => setRunning(false), 2000)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-2xl border overflow-hidden transition-all duration-200',
        expanded ? scraper.activeBorder : scraper.border,
        'hover:shadow-xl',
        expanded && `shadow-lg ${scraper.glow}`
      )}
      style={{ background: 'linear-gradient(135deg, #0c0e17 0%, #0d1020 100%)' }}
    >
      {/* Top shimmer */}
      {expanded && (
        <div className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent', scraper.colour.replace('text-', 'via-'))} />
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between p-4 sm:p-5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border', scraper.bg, scraper.border)}>
            <Icon size={20} className={scraper.colour} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm sm:text-base leading-tight">{scraper.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{scraper.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            onClick={e => { e.stopPropagation(); handleRun() }}
            disabled={running}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
              running
                ? 'bg-slate-700/50 border-slate-600 text-slate-400 cursor-not-allowed'
                : `${scraper.bg} ${scraper.border} ${scraper.colour} hover:opacity-80`
            )}
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} className="fill-current" />}
            {running ? 'Running…' : 'Run'}
          </button>
          {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </div>
      </div>

      {/* Config panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5 pt-1 space-y-3 border-t border-white/5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-3">Configuration</p>
              {scraper.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {field.label}
                  </label>
                  {field.type === 'textarea' && (
                    <>
                      <textarea
                        value={String(params[field.key] ?? field.default ?? '')}
                        onChange={e => setParam(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={4}
                        className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 resize-none font-mono transition-all"
                      />
                      {field.help && <p className="text-[10px] text-slate-600 mt-1">{field.help}</p>}
                    </>
                  )}
                  {field.type === 'number' && (
                    <input
                      type="number"
                      value={Number(params[field.key] ?? field.default ?? 0)}
                      onChange={e => setParam(field.key, Number(e.target.value))}
                      min={field.min}
                      max={field.max}
                      placeholder={field.placeholder}
                      className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    />
                  )}
                  {field.type === 'select' && (
                    <select
                      value={String(params[field.key] ?? field.default ?? '')}
                      onChange={e => setParam(field.key, e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60 transition-all"
                    >
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}

              {/* Run button */}
              <button
                onClick={handleRun}
                disabled={running}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all mt-2',
                  running
                    ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
                    : `${scraper.bg} border ${scraper.activeBorder} ${scraper.colour} hover:opacity-90 shadow-lg`
                )}
              >
                {running ? <><Loader2 size={14} className="animate-spin" /> Running…</> : <><Zap size={14} /> Run {scraper.name} Scraper</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Stats Card ────────────────────────────────────────────────────────────────

function StatsGrid() {
  const { data } = useQuery({
    queryKey: ['scraper-stats'],
    queryFn: async () => {
      try {
        const [articles, videos, repos, papers] = await Promise.all([
          api.get('/articles/?limit=1'),
          api.get('/videos/?limit=1'),
          api.get('/repositories/?limit=1'),
          api.get('/papers/?limit=1'),
        ])
        return {
          articles: articles.data?.meta?.total ?? 0,
          videos: videos.data?.meta?.total ?? 0,
          repos: repos.data?.meta?.total ?? 0,
          papers: papers.data?.meta?.total ?? 0,
        }
      } catch { return { articles: 0, videos: 0, repos: 0, papers: 0 } }
    },
    staleTime: 60_000,
  })

  const stats = [
    { label: 'Articles',     value: data?.articles ?? '…', icon: Newspaper,  colour: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    { label: 'Videos',       value: data?.videos   ?? '…', icon: Youtube,    colour: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
    { label: 'Repositories', value: data?.repos    ?? '…', icon: GitBranch,  colour: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/20'},
    { label: 'Papers',       value: data?.papers   ?? '…', icon: BookOpen,   colour: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
      {stats.map(s => {
        const Icon = s.icon
        return (
          <div key={s.label} className={cn('rounded-2xl border p-3 sm:p-4 flex items-center gap-3 overflow-hidden', s.bg, s.border)}>
            <Icon size={20} className={cn(s.colour, 'shrink-0')} />
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-black text-white">{s.value.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 truncate">{s.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ScraperPage() {
  const queryClient = useQueryClient()
  const [runLog, setRunLog] = useState<{ id: string; scraper: string; status: string; time: string; result?: string }[]>([])

  const handleRun = async (scraperId: string, params: Record<string, unknown>) => {
    const jobId = `${scraperId}-${Date.now()}`
    const scr = SCRAPERS.find(s => s.id === scraperId)
    setRunLog(prev => [{ id: jobId, scraper: scr?.name ?? scraperId, status: 'queued', time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)])

    try {
      const result = await api.post('/scraper/run/', { scraper: scraperId, params })
      const msg = result.data?.message ?? `Task queued`
      setRunLog(prev => prev.map(j => j.id === jobId ? { ...j, status: 'success', result: msg } : j))
      toast.success(`${scr?.name} scraper started!`, { icon: '🚀', style: { background: '#1e293b', color: '#f1f5f9' } })
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['scraper-stats'] }), 5000)
    } catch (err: any) {
      const errMsg = err?.response?.data?.error ?? 'Scraper failed'
      setRunLog(prev => prev.map(j => j.id === jobId ? { ...j, status: 'failed', result: errMsg } : j))
      toast.error(`${scr?.name} failed: ${errMsg}`, { style: { background: '#1e293b', color: '#f1f5f9' } })
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto pb-10 space-y-5 sm:space-y-6">

        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/15 p-5 sm:p-7"
          style={{ background: 'linear-gradient(135deg, #0a0c15 0%, #0d1022 50%, #0a0c15 100%)', boxShadow: '0 0 0 1px rgba(99,102,241,0.08), 0 8px 40px rgba(0,0,0,0.5)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Database size={15} className="text-white" />
                </div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Data Pipeline</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">Scraper Control Center</h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                Configure and trigger data scrapers — YouTube, GitHub, Hacker News &amp; arXiv.<br className="hidden sm:block" />
                Each scraper can be customised with your own queries and parameters.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {SCRAPERS.length} scrapers ready
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <StatsGrid />

        {/* ── Scraper Cards ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={14} className="text-indigo-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available Scrapers</span>
          </div>
          <div className="space-y-3">
            {SCRAPERS.map(scraper => (
              <ScraperCard key={scraper.id} scraper={scraper} onRun={handleRun} />
            ))}
          </div>
        </div>

        {/* ── Run Log ── */}
        {runLog.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Run Log</span>
              </div>
              <button onClick={() => setRunLog([])} className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors font-medium">Clear</button>
            </div>
            <div className="space-y-1.5">
              <AnimatePresence>
                {runLog.map(job => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/50 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusBadge status={job.status} />
                      <span className="font-semibold text-slate-300">{job.scraper}</span>
                      {job.result && <span className="text-slate-500 truncate hidden sm:inline">{job.result}</span>}
                    </div>
                    <span className="text-slate-600 whitespace-nowrap shrink-0">{job.time}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
