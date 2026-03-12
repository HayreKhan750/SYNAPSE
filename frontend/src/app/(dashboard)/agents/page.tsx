'use client'

/**
 * Phase 5.4 — Agent UI
 * /agents page: command interface, active tasks panel, task history, SSE progress
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  DollarSign,
  Timer,
  FileText,
  Search,
  TrendingUp,
  GitBranch,
  BookOpen,
  Sparkles,
  AlertCircle,
  Download,
  RefreshCw,
  Terminal,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/utils/api'
import type { AgentTask, AgentTaskType, AgentTool, AgentIntermediateStep } from '@/types'

// ─── constants ───────────────────────────────────────────────────────────────

const TASK_TYPES: { value: AgentTaskType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'general',  label: 'General',  icon: Sparkles,   description: 'Open-ended reasoning and Q&A' },
  { value: 'research', label: 'Research', icon: Search,     description: 'Deep research using knowledge base' },
  { value: 'trends',   label: 'Trends',   icon: TrendingUp, description: 'Analyze technology trends' },
  { value: 'github',   label: 'GitHub',   icon: GitBranch,  description: 'Search GitHub repositories' },
  { value: 'arxiv',    label: 'arXiv',    icon: BookOpen,   description: 'Fetch and analyze research papers' },
  { value: 'document', label: 'Document', icon: FileText,   description: 'Generate PDF / PPT / Word docs' },
  { value: 'project',  label: 'Project',  icon: Terminal,   description: 'Scaffold a new code project' },
]

const COMMAND_TEMPLATES = [
  { label: 'Research AI trends',     prompt: 'Research the latest trends in large language models and summarize key findings.', type: 'research' as AgentTaskType },
  { label: 'Analyze React repos',    prompt: 'Search GitHub for trending React repositories and provide an analysis.', type: 'github' as AgentTaskType },
  { label: 'Fetch ML papers',        prompt: 'Fetch the latest machine learning papers from arXiv and summarize them.', type: 'arxiv' as AgentTaskType },
  { label: 'Tech trend report',      prompt: 'Analyze current technology trends in AI and cloud computing.', type: 'trends' as AgentTaskType },
  { label: 'Generate PDF report',    prompt: 'Generate a PDF report on the current state of generative AI.', type: 'document' as AgentTaskType },
  { label: 'Scaffold Django API',    prompt: 'Create a Django REST API project with JWT auth, Docker, and CI/CD.', type: 'project' as AgentTaskType },
]

const STATUS_CONFIG = {
  pending:    { color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/30',  icon: Clock,     label: 'Pending' },
  processing: { color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30',   icon: Loader2,   label: 'Running' },
  completed:  { color: 'text-emerald-400',bg: 'bg-emerald-400/10',border: 'border-emerald-400/30',icon: CheckCircle,label: 'Completed' },
  failed:     { color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30',    icon: XCircle,   label: 'Failed' },
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatCost(cost: string | number): string {
  const n = typeof cost === 'string' ? parseFloat(cost) : cost
  if (isNaN(n) || n === 0) return '$0.00'
  if (n < 0.001) return `$${n.toFixed(6)}`
  return `$${n.toFixed(4)}`
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StepTrace({ steps }: { steps: AgentIntermediateStep[] }) {
  const [open, setOpen] = useState(false)
  if (!steps?.length) return null
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {steps.length} tool call{steps.length !== 1 ? 's' : ''}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-indigo-400 font-semibold">{step.tool}</span>
                  </div>
                  <div className="text-slate-400 mb-1">
                    <span className="text-slate-500">Input: </span>
                    {typeof step.input === 'string' ? step.input : JSON.stringify(step.input)}
                  </div>
                  <div className="text-slate-300">
                    <span className="text-slate-500">Output: </span>
                    {String(step.output).slice(0, 300)}{String(step.output).length > 300 ? '…' : ''}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TaskCard({
  task,
  onCancel,
  onRefresh,
}: {
  task: AgentTask
  onCancel: (id: string) => void
  onRefresh: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(task.status === 'processing' || task.status === 'pending')
  const cfg = STATUS_CONFIG[task.status]
  const StatusIcon = cfg.icon
  const TypeInfo = TASK_TYPES.find(t => t.value === task.task_type)
  const TypeIcon = TypeInfo?.icon ?? Bot
  const isActive = task.status === 'pending' || task.status === 'processing'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`mt-0.5 p-1.5 rounded-lg bg-slate-800 ${cfg.color}`}>
          <TypeIcon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
              <StatusIcon size={11} className={task.status === 'processing' ? 'animate-spin' : ''} />
              {cfg.label}
            </span>
            <span className="text-xs text-slate-500">{timeAgo(task.created_at)}</span>
          </div>
          <p className="mt-1 text-sm text-slate-200 font-medium line-clamp-2">{task.prompt}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isActive && (
            <button
              onClick={e => { e.stopPropagation(); onCancel(task.id) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Cancel task"
            >
              <X size={15} />
            </button>
          )}
          {!isActive && (
            <button
              onClick={e => { e.stopPropagation(); onRefresh(task.id) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </div>
      </div>

      {/* Metrics strip */}
      <div className="flex items-center gap-4 px-4 pb-2 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Zap size={11} />
          {task.tokens_used.toLocaleString()} tokens
        </span>
        <span className="flex items-center gap-1">
          <DollarSign size={11} />
          {formatCost(task.cost_usd)}
        </span>
        {task.execution_time_s != null && (
          <span className="flex items-center gap-1">
            <Timer size={11} />
            {formatDuration(task.execution_time_s)}
          </span>
        )}
      </div>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
              {task.status === 'processing' && (
                <div className="flex items-center gap-2 text-blue-400 text-sm mb-3">
                  <Loader2 size={14} className="animate-spin" />
                  Agent is working…
                </div>
              )}
              {task.status === 'failed' && task.error_message && (
                <div className="flex items-start gap-2 text-red-400 text-sm mb-3">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{task.error_message}</span>
                </div>
              )}
              {task.answer && (
                <div className="text-sm text-slate-200 bg-slate-800/60 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                  {task.answer}
                </div>
              )}
              {/* Download link for generated files */}
              {task.result?.download_url && (
                <a
                  href={task.result.download_url as string}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <Download size={14} />
                  Download {task.result.file_name as string || 'file'}
                </a>
              )}
              <StepTrace steps={task.intermediate_steps ?? task.result?.intermediate_steps as AgentIntermediateStep[] ?? []} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [prompt, setPrompt]           = useState('')
  const [taskType, setTaskType]       = useState<AgentTaskType>('general')
  const [submitting, setSubmitting]   = useState(false)
  const [tasks, setTasks]             = useState<AgentTask[]>([])
  const [tools, setTools]             = useState<AgentTool[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [activeTab, setActiveTab]     = useState<'active' | 'history'>('active')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sseRefs = useRef<Map<string, EventSource>>(new Map())

  // ── fetch task list ────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get('/agents/tasks/?ordering=-created_at')
      // StandardPagination returns {success, data, meta}
      // Fall back through common shapes to always get an array
      const payload = res.data
      const items: AgentTask[] =
        Array.isArray(payload)            ? payload            :
        Array.isArray(payload?.data)      ? payload.data       :
        Array.isArray(payload?.results)   ? payload.results    :
        []
      setTasks(items)
    } catch {
      // silently fail on background refreshes
    } finally {
      setLoadingTasks(false)
    }
  }, [])

  // ── fetch tool list ────────────────────────────────────────────────────────
  const fetchTools = useCallback(async () => {
    try {
      const res = await api.get('/agents/tools/')
      setTools(res.data.tools ?? [])
    } catch {
      // tools are non-critical
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchTools()
  }, [fetchTasks, fetchTools])

  // ── SSE subscription for a single task ────────────────────────────────────
  const subscribeSSE = useCallback((taskId: string) => {
    if (sseRefs.current.has(taskId)) return   // already subscribed
    const token = localStorage.getItem('access_token') ||
      (() => {
        try {
          const s = JSON.parse(localStorage.getItem('synapse-auth') || '{}')
          return s?.state?.accessToken ?? ''
        } catch { return '' }
      })()

    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '')
    // Always ensure the base URL ends with /api/v1 (not just the origin)
    const apiBase = baseUrl.endsWith('/api/v1') ? baseUrl : `${baseUrl}/api/v1`
    const url = `${apiBase}/agents/tasks/${taskId}/stream/?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setTasks(prev => prev.map(t =>
          t.id === taskId
            ? {
                ...t,
                status:           data.status,
                answer:           data.answer,
                tokens_used:      data.tokens_used,
                cost_usd:         data.cost_usd,
                execution_time_s: data.execution_time_s,
                intermediate_steps: data.intermediate_steps,
                error_message:    data.error_message,
                completed_at:     data.completed_at,
              }
            : t
        ))
        if (data.status === 'completed' || data.status === 'failed') {
          es.close()
          sseRefs.current.delete(taskId)
          if (data.status === 'completed') toast.success('Agent task completed!')
          else toast.error('Agent task failed.')
        }
      } catch { /* ignore parse errors */ }
    }

    es.addEventListener('done', () => {
      es.close()
      sseRefs.current.delete(taskId)
    })

    es.addEventListener('error', () => {
      es.close()
      sseRefs.current.delete(taskId)
    })

    sseRefs.current.set(taskId, es)
  }, [])

  // ── subscribe SSE for any active tasks on load ─────────────────────────────
  useEffect(() => {
    tasks
      .filter(t => t.status === 'pending' || t.status === 'processing')
      .forEach(t => subscribeSSE(t.id))
  }, [tasks, subscribeSSE])

  // cleanup SSE on unmount
  useEffect(() => {
    return () => {
      sseRefs.current.forEach(es => es.close())
      sseRefs.current.clear()
    }
  }, [])

  // ── auto-resize textarea ───────────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }, [prompt])

  // ── submit new task ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = prompt.trim()
    if (!p || submitting) return
    if (p.length < 10) { toast.error('Prompt must be at least 10 characters.'); return }

    setSubmitting(true)
    try {
      const res = await api.post('/agents/tasks/', { task_type: taskType, prompt: p })
      const newTask: AgentTask = res.data
      setTasks(prev => [newTask, ...prev])
      setPrompt('')
      setActiveTab('active')
      toast.success('Task queued!')
      subscribeSSE(newTask.id)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to queue task.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── cancel task ────────────────────────────────────────────────────────────
  const handleCancel = async (taskId: string) => {
    try {
      await api.post(`/agents/tasks/${taskId}/cancel/`)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'failed' as const, error_message: 'Cancelled by user.' } : t))
      toast.success('Task cancelled.')
      sseRefs.current.get(taskId)?.close()
      sseRefs.current.delete(taskId)
    } catch {
      toast.error('Failed to cancel task.')
    }
  }

  // ── refresh single task ────────────────────────────────────────────────────
  const handleRefresh = async (taskId: string) => {
    try {
      const res = await api.get(`/agents/tasks/${taskId}/`)
      setTasks(prev => prev.map(t => t.id === taskId ? res.data : t))
    } catch {
      toast.error('Failed to refresh task.')
    }
  }

  // ── derived lists ──────────────────────────────────────────────────────────
  const activeTasks  = tasks.filter(t => t.status === 'pending' || t.status === 'processing')
  const historyTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Page Header ── */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30">
            <Bot size={28} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Agents</h1>
            <p className="text-slate-400 text-sm">Command autonomous agents to research, analyse, generate documents &amp; scaffold projects</p>
          </div>
        </div>

        {/* ── Command Interface ── */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Terminal size={15} className="text-indigo-400" />
            Command Interface
          </h2>

          {/* Task type picker */}
          <div className="flex flex-wrap gap-2 mb-4">
            {TASK_TYPES.map(tt => {
              const Icon = tt.icon
              const active = taskType === tt.value
              return (
                <button
                  key={tt.value}
                  onClick={() => setTaskType(tt.value)}
                  title={tt.description}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    active
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-indigo-500/50 hover:text-slate-200'
                  }`}
                >
                  <Icon size={13} />
                  {tt.label}
                </button>
              )
            })}
          </div>

          {/* Prompt input */}
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent) } }}
                placeholder={`Describe what you want the ${TASK_TYPES.find(t => t.value === taskType)?.label ?? ''} agent to do…`}
                rows={3}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 pr-14 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={submitting || !prompt.trim()}
                className="absolute right-3 bottom-3 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Press Enter to run · Shift+Enter for new line · 10–4000 characters</p>
          </form>

          {/* Quick command templates */}
          <div className="mt-4">
            <p className="text-xs text-slate-500 mb-2">Quick commands:</p>
            <div className="flex flex-wrap gap-2">
              {COMMAND_TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  onClick={() => { setPrompt(tpl.prompt); setTaskType(tpl.type) }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-indigo-500/50 transition-all"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Registered Tools Strip ── */}
        {tools.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
              <Zap size={12} className="text-indigo-400" />
              {tools.length} registered tools
            </p>
            <div className="flex flex-wrap gap-2">
              {tools.map(tool => (
                <span
                  key={tool.name}
                  title={tool.description}
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-mono cursor-default"
                >
                  {tool.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-1 mb-5 bg-slate-900 border border-slate-700 rounded-xl p-1 w-fit">
          {([
            { id: 'active',  label: 'Active',  count: activeTasks.length },
            { id: 'history', label: 'History', count: historyTasks.length },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Task Lists ── */}
        {loadingTasks ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 size={24} className="animate-spin mr-3" />
            Loading tasks…
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'active' ? (
              <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {activeTasks.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">
                    <Bot size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No active tasks · run a command above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {activeTasks.map(task => (
                        <TaskCard key={task.id} task={task} onCancel={handleCancel} onRefresh={handleRefresh} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {historyTasks.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">
                    <Clock size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No completed tasks yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {historyTasks.map(task => (
                        <TaskCard key={task.id} task={task} onCancel={handleCancel} onRefresh={handleRefresh} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
