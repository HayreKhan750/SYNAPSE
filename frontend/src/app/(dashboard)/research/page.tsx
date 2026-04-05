'use client';

import React, { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { ScrollSentinel } from '@/components/ui/ScrollSentinel';
import {
  BookOpen, ChevronDown, Search, Sparkles, Brain, X,
  FileText, Loader2, ExternalLink, Copy, CheckCircle2,
  TrendingUp, BarChart2, Layers, Zap, Download, Network,
  Clock, CheckCheck, AlertCircle, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/utils/api';
import { PaperCard } from '@/components/cards';
import { PaperSkeleton } from '@/components/cards/SkeletonCard';
import { cn } from '@/utils/helpers';
import { useAuthStore } from '@/store/authStore';

// ─── Constants ────────────────────────────────────────────────────────────────
const DIFFICULTIES = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const ARXIV_CATEGORIES = [
  'cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.CR',
  'cs.DB', 'cs.DS', 'cs.SE', 'math.ST',
];
const SORT_OPTIONS = [
  { label: 'Newest',     value: '-fetched_at'      },
  { label: 'Date',       value: '-published_date'   },
  { label: 'Citations',  value: '-citation_count'   },
  { label: 'Difficulty', value: 'difficulty_level'  },
];

const CATEGORY_LABELS: Record<string, string> = {
  'cs.AI': '🤖 AI',          'cs.LG': '📈 Machine Learning',
  'cs.CL': '💬 NLP',         'cs.CV': '👁 Computer Vision',
  'cs.CR': '🔐 Security',    'cs.DB': '🗄 Databases',
  'cs.DS': '📊 Data Structures', 'cs.SE': '⚙ Software Eng',
  'math.ST': '📐 Statistics',
};

const SYNTHESIS_PROMPTS = [
  'Summarise the key findings and implications of these papers',
  'What are the main methodologies used across these papers?',
  'What open problems or future research directions are identified?',
  'Compare and contrast the approaches taken by these papers',
  'What datasets and benchmarks are commonly used in this area?',
];

// ── TASK-601-F2/F3: Research Session — Progress Tracker + Report Viewer ────────

const RESEARCH_STEPS = [
  { key: 'queued',   label: 'Queued',          icon: Clock },
  { key: 'running',  label: 'Researching…',    icon: Network },
  { key: 'complete', label: 'Report Ready',    icon: CheckCheck },
  { key: 'failed',   label: 'Failed',          icon: AlertCircle },
]

function ResearchProgressBadge({ status }: { status: string }) {
  const step = RESEARCH_STEPS.find(s => s.key === status) ?? RESEARCH_STEPS[0]
  const Icon = step.icon
  const colorMap: Record<string, string> = {
    queued:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    running:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    complete: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    failed:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${colorMap[status] ?? colorMap.queued}`}>
      {status === 'running' ? <Loader2 size={10} className="animate-spin" /> : <Icon size={10} />}
      {step.label}
    </span>
  )
}

function ResearchSessionCard({ session, onSelect }: { session: any; onSelect: (s: any) => void }) {
  return (
    <div
      onClick={() => onSelect(session)}
      className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 hover:border-violet-200 dark:hover:border-violet-700/40 hover:shadow-sm transition-all cursor-pointer"
    >
      <Brain size={16} className="text-violet-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2">{session.query}</p>
        <div className="flex items-center gap-2 mt-1">
          <ResearchProgressBadge status={session.status} />
          {session.sub_questions?.length > 0 && (
            <span className="text-[10px] text-slate-400">{session.sub_questions.length} sub-questions</span>
          )}
        </div>
      </div>
      <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 flex-shrink-0 mt-1" />
    </div>
  )
}

function ResearchReportModal({ session, onClose, onRefresh }: {
  session: any; onClose: () => void; onRefresh: () => void
}) {
  const [activeSource, setActiveSource] = React.useState<number | null>(null)
  const [copied, setCopied] = React.useState(false)

  // Poll for updates while running
  const { data: fresh } = useQuery({
    queryKey: ['research-session', session.id],
    queryFn:  () => api.get(`/agents/research/${session.id}/`).then(r => r.data?.data),
    refetchInterval: session.status === 'running' || session.status === 'queued' ? 3000 : false,
    staleTime: 5000,
    initialData: session,
  })

  const current = fresh ?? session
  const sources: any[] = current.sources ?? []
  const subQuestions: string[] = current.sub_questions ?? []

  const copyMarkdown = () => {
    navigator.clipboard.writeText(current.report || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const exportPDF = () => {
    const url = `/api/v1/research/${session.id}/export-pdf/`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ResearchProgressBadge status={current.status} />
              {current.completed_at && (
                <span className="text-xs text-slate-400">
                  {new Date(current.completed_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 line-clamp-2">{current.query}</h2>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {current.status === 'complete' && current.report && (
              <>
                <button onClick={copyMarkdown}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  {copied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy MD'}
                </button>
                <button onClick={exportPDF}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors">
                  <Download size={12} /> PDF
                </button>
              </>
            )}
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X size={16} className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">

          {/* ── Main: report or progress ── */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* Sub-questions progress */}
            {subQuestions.length > 0 && (
              <div className="mb-5 p-4 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-100 dark:border-violet-800/30">
                <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-2">
                  Research Plan — {subQuestions.length} Sub-Questions
                </p>
                <ol className="space-y-1.5">
                  {subQuestions.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">{i+1}</span>
                      {q}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Running state */}
            {(current.status === 'running' || current.status === 'queued') && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="relative w-16 h-16">
                  <Loader2 size={64} className="animate-spin text-violet-400" />
                  <Brain size={24} className="absolute inset-0 m-auto text-violet-600" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {current.status === 'queued' ? 'Queued — starting soon…' : 'Researching across ArXiv, GitHub, and knowledge base…'}
                </p>
                <p className="text-xs text-slate-400 text-center max-w-xs">
                  This typically takes 30–90 seconds. You can close this and come back.
                </p>
              </div>
            )}

            {/* Failed state */}
            {current.status === 'failed' && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <AlertCircle size={48} className="text-red-400 opacity-60" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Research failed</p>
                <p className="text-xs text-slate-400">Please try again or refine your query.</p>
              </div>
            )}

            {/* Report */}
            {current.status === 'complete' && current.report && (
              <div className="prose prose-slate dark:prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {current.report}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* ── Right panel: Sources ── */}
          {sources.length > 0 && (
            <div className="w-64 flex-shrink-0 border-l border-slate-200 dark:border-slate-700 p-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
                Sources ({sources.length})
              </p>
              <ol className="space-y-2">
                {sources.map((src: any, i: number) => (
                  <li key={i}>
                    <button
                      onClick={() => setActiveSource(i === activeSource ? null : i)}
                      className={`w-full text-left p-2 rounded-lg transition-colors ${
                        activeSource === i
                          ? 'bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="text-[10px] font-bold text-violet-500 flex-shrink-0">[{i+1}]</span>
                        <span className="text-[11px] text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug">
                          {src.title || src.url || 'Source'}
                        </span>
                      </div>
                      {activeSource === i && src.url && (
                        <a href={src.url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="mt-1 flex items-center gap-1 text-[10px] text-violet-500 hover:underline">
                          <ExternalLink size={9} /> Open
                        </a>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DeepResearchPanel() {
  const queryClient = useQueryClient()
  const [query, setQuery] = React.useState('')
  const [selectedSession, setSelectedSession] = React.useState<any | null>(null)

  const { data: sessionsData } = useQuery({
    queryKey: ['research-sessions'],
    queryFn:  () => api.get('/agents/research/').then(r => r.data?.data ?? []),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
  const sessions: any[] = sessionsData ?? []

  const startMutation = useMutation({
    mutationFn: (q: string) => api.post('/agents/research/', { query: q }),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['research-sessions'] })
      setSelectedSession(resp.data?.data)
      setQuery('')
      toast.success('Research session started!')
    },
    onError: () => toast.error('Failed to start research session'),
  })

  return (
    <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={18} className="text-violet-500" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Deep Research Mode</h2>
        <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">— Plan-and-Execute AI agent</span>
      </div>

      {/* Start new session */}
      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="e.g. How do diffusion models work and what are their limitations?"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && query.trim() && startMutation.mutate(query)}
        />
        <button
          onClick={() => query.trim() && startMutation.mutate(query)}
          disabled={startMutation.isPending || !query.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {startMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Research
        </button>
      </div>

      {/* Sessions list */}
      {sessions.length > 0 && (
        <div className="space-y-2">
          {sessions.slice(0, 5).map((s: any) => (
            <ResearchSessionCard key={s.id} session={s} onSelect={setSelectedSession} />
          ))}
        </div>
      )}

      {/* Report modal */}
      {selectedSession && (
        <ResearchReportModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['research-sessions'] })}
        />
      )}
    </div>
  )
}

// ─── AI Synthesis Panel ───────────────────────────────────────────────────────
function AISynthesisPanel({ papers }: { papers: any[] }) {
  const [query, setQuery]           = useState('');
  const [result, setResult]         = useState('');
  const [streaming, setStreaming]   = useState(false);
  const [copied, setCopied]         = useState(false);
  const [showPanel, setShowPanel]   = useState(false);
  const resultRef                   = useRef<HTMLDivElement>(null);

  const handleSynthesize = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;

    setStreaming(true);
    setResult('');
    setShowPanel(true);

    try {
      const token = useAuthStore.getState().accessToken;
      const paperContext = papers.slice(0, 8).map((p, i) =>
        `[${i+1}] "${p.title}" — ${p.authors?.slice(0,2).join(', ') || 'Unknown'} (${p.published_date?.slice(0,4) || ''})\nAbstract: ${(p.abstract || p.summary || '').slice(0, 300)}…`
      ).join('\n\n');

      // Use the AI chat stream endpoint (bypasses Next.js proxy trailing-slash bug)
      const backendBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '').replace(/\/api\/v1$/, '');
      const response = await fetch(`${backendBase}/api/v1/ai/chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: `You are a senior research analyst. Analyse the following ${papers.length} research papers and answer: ${q}\n\nPapers:\n${paperContext}\n\nProvide a structured, insightful synthesis with key findings, comparisons, and actionable insights.`,
          conversation_id: `synthesis-${Date.now()}`,
        }),
      });

      if (!response.ok || !response.body) {
        setResult('⚠ Synthesis failed — server error. Please check your API key in Settings → AI Engine.');
        setStreaming(false);
        return;
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: done')) { setStreaming(false); return; }
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) { setResult(`⚠ ${parsed.error}`); setStreaming(false); return; }
            if (typeof parsed === 'string') { accumulated += parsed; setResult(accumulated); }
          } catch {
            accumulated += raw;
            setResult(accumulated);
          }
        }
      }
    } catch (err) {
      setResult('⚠ Synthesis failed. Please check your API key in Settings → AI Engine.');
    } finally {
      setStreaming(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-indigo-600 to-violet-600 flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-white dark:text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white dark:text-white">AI Research Synthesis</h2>
            <p className="text-xs text-indigo-200">
              {papers.length > 0 ? `${Math.min(papers.length, 8)} papers in context` : 'Load papers to analyse'}
            </p>
          </div>
        </div>
        {papers.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-semibold shrink-0 whitespace-nowrap">
            {papers.length} papers
          </span>
        )}
      </div>

      {/* Prompt suggestions */}
      <div className="p-3 sm:p-4 border-b border-indigo-100 dark:border-indigo-800/50">
        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Quick analyses:</p>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {SYNTHESIS_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => { setQuery(p); handleSynthesize(p); }}
              disabled={streaming || papers.length === 0}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/60 transition disabled:opacity-40 disabled:cursor-not-allowed text-left leading-snug"
            >
              {p.slice(0, 40)}…
            </button>
          ))}
        </div>
      </div>

      {/* Custom query input */}
      <div className="p-3 sm:p-4 flex gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSynthesize()}
            placeholder="Ask anything about these papers…"
            className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={streaming || papers.length === 0}
          />
        </div>
        <button
          onClick={() => handleSynthesize()}
          disabled={streaming || !query.trim() || papers.length === 0}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50 shrink-0 whitespace-nowrap"
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span className="hidden xs:inline">{streaming ? 'Synthesising…' : 'Analyse'}</span>
        </button>
      </div>

      {/* Result display */}
      <AnimatePresence>
        {(result || streaming) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-indigo-100 dark:border-indigo-800/50"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    {streaming ? 'Synthesising…' : 'Synthesis Complete'}
                  </span>
                </div>
                {result && !streaming && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 transition"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
              <div
                ref={resultRef}
                className="prose prose-sm dark:prose-invert max-w-none leading-relaxed max-h-96 overflow-y-auto rounded-xl bg-slate-900 p-5 border border-slate-700/50
                  prose-headings:text-white prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
                  prose-p:text-slate-300 prose-p:leading-relaxed prose-p:my-2
                  prose-strong:text-white prose-strong:font-semibold
                  prose-em:text-slate-300 prose-em:italic
                  prose-code:text-indigo-300 prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                  prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700 prose-pre:rounded-lg prose-pre:p-4
                  prose-ul:text-slate-300 prose-ul:my-2 prose-ul:space-y-1
                  prose-ol:text-slate-300 prose-ol:my-2 prose-ol:space-y-1
                  prose-li:text-slate-300 prose-li:leading-relaxed
                  prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-950/30 prose-blockquote:text-slate-300 prose-blockquote:rounded-r-lg prose-blockquote:py-1
                  prose-hr:border-slate-700
                  prose-a:text-indigo-400 hover:prose-a:text-indigo-300
                  prose-table:text-sm prose-th:text-white prose-th:bg-slate-800 prose-td:text-slate-300 prose-td:border-slate-700"
              >
                {streaming && !result ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Generating synthesis…
                  </div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {result}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ papers }: { papers: any[] }) {
  const totalCitations = papers.reduce((s, p) => s + (p.citation_count || 0), 0);
  const categories     = Array.from(new Set(
    papers.flatMap((p: any) => Array.isArray(p.categories) ? p.categories : (Array.isArray(p.arxiv_categories) ? p.arxiv_categories : []))
  )).filter(Boolean);
  const avgYear        = papers.length
    ? Math.round(papers.reduce((s, p) => s + parseInt(p.published_date?.slice(0,4) || '2024'), 0) / papers.length)
    : 2024;

  const stats = [
    { icon: FileText,   label: 'Papers',     value: papers.length,                       color: 'text-indigo-600' },
    { icon: TrendingUp, label: 'Citations',  value: totalCitations.toLocaleString(),      color: 'text-emerald-600' },
    { icon: Layers,     label: 'Categories', value: categories.length,                    color: 'text-violet-600' },
    { icon: Zap,        label: 'Avg Year',   value: papers.length ? avgYear : '—',        color: 'text-amber-600' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Research Page ───────────────────────────────────────────────────────
export default function ResearchPage() {
  const [selectedDifficulty,    setSelectedDifficulty]    = useState('All');
  const [selectedCategory,      setSelectedCategory]      = useState('');
  const [sortBy, setSortBy] = useState('-fetched_at');
  const [showCategoryDropdown,  setShowCategoryDropdown]  = useState(false);
  const [showSortDropdown,      setShowSortDropdown]      = useState(false);
  const [searchQuery,           setSearchQuery]           = useState('');
  const [searchInput,           setSearchInput]           = useState('');

  const difficultyParam = selectedDifficulty === 'All' ? undefined : selectedDifficulty.toLowerCase();

  const { items: papers, sentinelRef, isFetchingNextPage, isLoading, hasNextPage, total: totalCount, reset: resetPapers } =
    useInfiniteScroll<any>({
      fetchPage: useCallback(async (page: number) => {
        const r = await api.get('/papers/', {
          params: {
            page,
            page_size: 12,
            difficulty_level: difficultyParam,
            category:         selectedCategory || undefined,
            ordering:         sortBy,
            search:           searchQuery || undefined,
          },
        });
        const d = r.data;
        const items: any[] = Array.isArray(d?.data) ? d.data : Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
        const total = d?.meta?.total ?? d?.count ?? items.length;
        return { items, total };
      }, [difficultyParam, selectedCategory, sortBy, searchQuery]),
      deps: [difficultyParam, selectedCategory, sortBy, searchQuery],
    });

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const clearFilters = () => {
    setSelectedDifficulty('All');
    setSelectedCategory('');
    setSortBy('-fetched_at');
    setSearchQuery('');
    setSearchInput('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-12">

        {/* ── Hero Header ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-2xl p-5 sm:p-8 text-white dark:text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-12 w-32 h-32 rounded-full bg-white" />
            <div className="absolute bottom-0 left-24 w-48 h-48 rounded-full bg-white" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-200" />
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest">SYNAPSE AI</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold mb-2 leading-tight">Research Explorer</h1>
            <p className="text-indigo-200 text-sm sm:text-lg max-w-xl leading-relaxed">
              Discover, analyse, and synthesise cutting-edge research papers with AI-powered insights.
            </p>
          </div>
        </div>

        {/* ── Search Bar ──────────────────────────────────────────── */}
        <div className="flex gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search papers by title, author, or keyword…"
              className="w-full pl-9 sm:pl-12 pr-4 py-2.5 sm:py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={clearFilters}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition shadow-sm shrink-0"
          >
            <Search className="w-4 h-4" />
            <span className="hidden xs:inline">Search</span>
          </button>
        </div>

        {/* ── Stats Bar ───────────────────────────────────────────── */}
        <StatsBar papers={papers} />

        {/* ── AI Synthesis Panel ──────────────────────────────────── */}
        <AISynthesisPanel papers={papers} />

        {/* TASK-601-F2/F3: Deep Research Mode — Plan-and-Execute agent */}
        <DeepResearchPanel />

        {/* ── Filters ─────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" /> Filters
          </h3>

          {/* Difficulty pills */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">Difficulty</p>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => { setSelectedDifficulty(d); }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                    selectedDifficulty === d
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 hover:text-indigo-700',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Category + Sort */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-start sm:items-end">
            {/* Category */}
            <div className="relative w-full sm:flex-1 sm:min-w-[180px]">
              <p className="text-xs text-gray-500 mb-2 font-medium">Category</p>
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full px-3 sm:px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-between bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-300 transition"
              >
                <span className="truncate mr-2">{selectedCategory ? CATEGORY_LABELS[selectedCategory] || selectedCategory : 'All Categories'}</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform shrink-0', showCategoryDropdown && 'rotate-180')} />
              </button>
              {showCategoryDropdown && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 max-h-56 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedCategory(''); setShowCategoryDropdown(false); }}
                    className={cn('w-full text-left px-4 py-2.5 text-sm transition rounded-t-xl',
                      !selectedCategory ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50')}
                  >
                    All Categories
                  </button>
                  {ARXIV_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); }}
                      className={cn('w-full text-left px-4 py-2.5 text-sm transition',
                        selectedCategory === cat ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50')}
                    >
                      {CATEGORY_LABELS[cat] || cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="relative w-full sm:w-auto">
              <p className="text-xs text-gray-500 mb-2 font-medium">Sort by</p>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-300 transition"
              >
                {SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? "Sort"}
                <ChevronDown className={cn('w-4 h-4 transition-transform shrink-0', showSortDropdown && 'rotate-180')} />
              </button>
              {showSortDropdown && (
                <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 min-w-[140px]">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
                      className={cn('w-full text-left px-4 py-2.5 text-sm transition first:rounded-t-xl last:rounded-b-xl',
                        sortBy === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear filters */}
            {(searchQuery || selectedDifficulty !== 'All' || selectedCategory || sortBy !== '-fetched_at') && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 transition border border-gray-200 dark:border-gray-600"
              >
                <X className="w-3.5 h-3.5" /> Clear all
              </button>
            )}
          </div>
        </div>

        {/* ── Results header ───────────────────────────────────────── */}
        {!isLoading && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {searchQuery ? (
                <><strong className="text-gray-900 dark:text-white">"{searchQuery}"</strong> — {totalCount} results</>
              ) : (
                <>{totalCount} papers{selectedCategory ? ` in ${CATEGORY_LABELS[selectedCategory] || selectedCategory}` : ''}</>
              )}
            </p>
          </div>
        )}

        {/* ── Papers grid ──────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <PaperSkeleton key={i} />)}
          </div>
        ) : papers.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {papers.map((paper: any) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
            <ScrollSentinel
              sentinelRef={sentinelRef}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              onRetry={resetPapers}
              endLabel={`All ${totalCount} papers loaded ✨`}
            />
          </>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col items-center gap-3 px-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <p className="text-gray-800 dark:text-gray-200 font-semibold text-lg">No papers found</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xs mx-auto">
                {searchQuery
                  ? `No research papers matched "${searchQuery}". Try a different search term.`
                  : 'No papers match the current filters. Try clearing them or explore a different category.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-center">
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Clear filters
              </button>
              <a
                href="/wizard"
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                ✨ Personalise research
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
