'use client'

/**
 * Phase 5.4 — Agent UI
 * /agents page: command interface, active tasks panel, task history, SSE progress
 * Premium rewrite — full markdown rendering, rich Document/Project result cards
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
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
  Copy,
  Check,
  FileCode,
  FileJson,
  Archive,
  FolderOpen,
  Presentation,
  FileType,
  Cpu,
  Package,
  ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/utils/api'
import type { AgentTask, AgentTaskType, AgentTool, AgentIntermediateStep } from '@/types'
import { useApiKeyStatus } from '@/hooks/useApiKeyStatus'
import Link from 'next/link'

// ─── constants ───────────────────────────────────────────────────────────────

const TASK_TYPES: { value: AgentTaskType; label: string; icon: React.ElementType; description: string; locked?: boolean; lockReason?: string }[] = [
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
  { label: 'Generate PDF report',    prompt: 'Generate a PDF report on the current state of generative AI with key trends and breakthroughs.', type: 'document' as AgentTaskType },
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

function fileExtIcon(name: string): React.ElementType {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['pdf'].includes(ext)) return FileType
  if (['pptx', 'ppt'].includes(ext)) return Presentation
  if (['docx', 'doc'].includes(ext)) return FileText
  if (['zip', 'tar', 'gz'].includes(ext)) return Archive
  if (['json', 'yaml', 'yml', 'toml'].includes(ext)) return FileJson
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cs', 'cpp', 'c', 'rb', 'sh'].includes(ext)) return FileCode
  return FileText
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }
  return (
    <button onClick={handle} title="Copy" className="p-1.5 rounded text-slate-500 hover:text-slate-200 transition-colors">
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  )
}

// ─── sub-components ──────────────────────────────────────────────────────────

/** Full-featured markdown renderer — same pipeline as ChatMessage */
function AgentMarkdown({ content }: { content: string }) {
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null)
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }: any) {
            const language = (className ?? '').replace('language-', '').trim()
            const raw = String(children).replace(/\n$/, '')
            const isBlock = Boolean(className?.startsWith('language-'))
            if (!isBlock) {
              return (
                <code className="bg-slate-900 text-indigo-300 rounded px-1.5 py-0.5 text-xs font-mono" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <div className="my-3 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                  <span className="text-xs font-mono text-slate-400">{language || 'code'}</span>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(raw)
                      setCopiedBlock(Date.now())
                      setTimeout(() => setCopiedBlock(null), 1800)
                    }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200 transition-colors"
                  >
                    {copiedBlock ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copiedBlock ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="overflow-x-auto p-4 text-sm text-slate-200 font-mono leading-relaxed m-0">
                  <code>{raw}</code>
                </pre>
              </div>
            )
          },
          pre({ children }: any) { return <>{children}</> },
          h1: ({ children }: any) => <h1 className="text-xl font-bold text-white mt-5 mb-2 pb-1 border-b border-slate-700">{children}</h1>,
          h2: ({ children }: any) => <h2 className="text-lg font-semibold text-white mt-4 mb-2 flex items-center gap-2">{children}</h2>,
          h3: ({ children }: any) => <h3 className="text-base font-semibold text-slate-100 mt-3 mb-1">{children}</h3>,
          h4: ({ children }: any) => <h4 className="text-sm font-semibold text-slate-200 mt-2 mb-1">{children}</h4>,
          p: ({ children }: any) => <p className="mb-3 last:mb-0 leading-relaxed text-slate-200">{children}</p>,
          ul: ({ children }: any) => <ul className="list-disc pl-5 mb-3 space-y-1 text-slate-200">{children}</ul>,
          ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-slate-200">{children}</ol>,
          li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }: any) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }: any) => <em className="italic text-slate-300">{children}</em>,
          blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-indigo-500 bg-slate-900/50 pl-4 pr-2 py-2 my-3 rounded-r-lg text-slate-400 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }: any) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors inline-flex items-center gap-1">
              {children}<ExternalLink size={11} className="opacity-60" />
            </a>
          ),
          hr: () => <hr className="border-slate-700 my-4" />,
          table: ({ children }: any) => (
            <div className="my-4 rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">{children}</table>
              </div>
            </div>
          ),
          thead: ({ children }: any) => <thead className="bg-slate-800">{children}</thead>,
          tbody: ({ children }: any) => <tbody className="divide-y divide-slate-700">{children}</tbody>,
          tr: ({ children }: any) => <tr className="even:bg-slate-800/40 hover:bg-slate-700/40 transition-colors">{children}</tr>,
          th: ({ children }: any) => <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">{children}</th>,
          td: ({ children }: any) => <td className="px-4 py-2.5 text-slate-300">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

/** Tool-call trace accordion */
function StepTrace({ steps }: { steps: AgentIntermediateStep[] }) {
  const [open, setOpen] = useState(false)
  if (!steps?.length) return null
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors group"
      >
        <div className="p-0.5 rounded bg-slate-800 border border-slate-700 group-hover:border-indigo-500/50 transition-colors">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
        <Cpu size={11} className="text-indigo-400" />
        <span>{steps.length} tool call{steps.length !== 1 ? 's' : ''}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border-b border-slate-700">
                    <div className="w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-indigo-400">{i + 1}</span>
                    </div>
                    <span className="font-mono text-xs text-indigo-300 font-semibold">{step.tool}</span>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Input</span>
                      <pre className="mt-1 text-slate-300 font-mono whitespace-pre-wrap break-words bg-slate-800 rounded-lg p-2 border border-slate-700">
                        {typeof step.input === 'string' ? step.input : JSON.stringify(step.input, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Output</span>
                      <pre className="mt-1 text-slate-300 font-mono whitespace-pre-wrap break-words bg-slate-800 rounded-lg p-2 border border-slate-700 max-h-40 overflow-y-auto">
                        {String(step.output).slice(0, 600)}{String(step.output).length > 600 ? '\n…(truncated)' : ''}
                      </pre>
                    </div>
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

/** Collapsible file list for project scaffolds */
function FileListAccordion({ files }: { files: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
      >
        <FolderOpen size={11} />
        {open ? 'Hide' : 'View'} {files.length} included files
      </button>
      {open && (
        <div className="mt-2 bg-slate-900/70 rounded-lg p-2 border border-slate-700 max-h-36 overflow-y-auto">
          {files.map((f, i) => {
            const FI = fileExtIcon(f) as React.ComponentType<{ size?: number; className?: string }>
            return (
              <div key={i} className="flex items-center gap-1.5 py-0.5 text-xs text-slate-400 font-mono">
                <FI size={11} className="text-slate-500 flex-shrink-0" />
                {f}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Rich download card for Document & Project results */
function DownloadResultCard({ task }: { task: AgentTask }) {
  const result = task.result ?? {}
  const downloadUrl = result.download_url as string | undefined
  const fileName = result.file_name as string | undefined
  const filePath = result.file_path as string | undefined
  const fileSize = result.file_size_bytes as number | undefined
  const isProject = task.task_type === 'project'
  const isDoc = task.task_type === 'document'
  if (!downloadUrl && !filePath) return null

  const displayName = fileName ?? (filePath ? filePath.split('/').pop() : 'Generated file') ?? 'file'
  const FileIcon = fileExtIcon(displayName) as React.ComponentType<{ size?: number }>
  const ext = displayName.split('.').pop()?.toUpperCase() ?? 'FILE'
  const sizeStr = fileSize
    ? fileSize > 1024 * 1024 ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
    : fileSize > 1024 ? `${(fileSize / 1024).toFixed(1)} KB`
    : `${fileSize} B`
    : null

  const accentClass = isProject
    ? 'from-emerald-600/20 to-cyan-600/10 border-emerald-500/30'
    : 'from-indigo-600/20 to-violet-600/10 border-indigo-500/30'
  const iconClass = isProject ? 'text-emerald-400 bg-emerald-500/10' : 'text-indigo-400 bg-indigo-500/10'
  const btnClass = isProject
    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
    : 'bg-indigo-600 hover:bg-indigo-500 text-white'

  return (
    <div className={`mt-4 rounded-xl border bg-gradient-to-br ${accentClass} p-4`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${iconClass} flex-shrink-0`}>
          {isProject ? <Package size={22} /> : <FileIcon size={22} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {isProject ? 'Project Scaffold' : 'Generated Document'}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono font-bold">{ext}</span>
          </div>
          <p className="text-sm font-semibold text-white truncate">{displayName}</p>
          {sizeStr && (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Archive size={11} />
              {sizeStr}
            </p>
          )}
          {isProject && Array.isArray(result.file_list) && (result.file_list as string[]).length > 0 && (
            <FileListAccordion files={result.file_list as string[]} />
          )}
        </div>
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg ${btnClass}`}
          >
            <Download size={15} />
            Download
          </a>
        )}
      </div>
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
  const answer = task.answer ?? (task.result?.answer as string | undefined)
  const steps = task.intermediate_steps ?? (task.result?.intermediate_steps as AgentIntermediateStep[] | undefined) ?? []
  const hasDownload = !!(task.result?.download_url || task.result?.file_path)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`rounded-2xl border ${cfg.border} bg-slate-900/80 backdrop-blur-sm overflow-hidden shadow-lg`}
    >
      {/* Status accent bar */}
      <div className={`h-0.5 w-full ${
        task.status === 'processing' ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 animate-pulse' :
        task.status === 'completed'  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' :
        task.status === 'failed'     ? 'bg-gradient-to-r from-red-500 to-rose-500' :
        'bg-gradient-to-r from-amber-500 to-orange-500'
      }`} />

      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`mt-0.5 p-2 rounded-xl ${cfg.bg} ${cfg.color} border ${cfg.border} flex-shrink-0`}>
          <TypeIcon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
              <StatusIcon size={10} className={task.status === 'processing' ? 'animate-spin' : ''} />
              {cfg.label}
            </span>
            <span className="text-xs font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
              {TypeInfo?.label ?? task.task_type}
            </span>
            <span className="text-xs text-slate-600">{timeAgo(task.created_at)}</span>
            {hasDownload && task.status === 'completed' && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                <Download size={9} />
                Ready
              </span>
            )}
          </div>
          <p className="text-sm text-slate-200 font-medium leading-snug line-clamp-2">{task.prompt}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {isActive && (
            <button
              onClick={e => { e.stopPropagation(); onCancel(task.id) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Cancel task"
            >
              <X size={14} />
            </button>
          )}
          {!isActive && (
            <button
              onClick={e => { e.stopPropagation(); onRefresh(task.id) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
          )}
          {answer && <CopyButton text={answer} />}
          <div className={`p-1 rounded transition-colors ${expanded ? 'text-slate-300' : 'text-slate-600'}`}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="flex items-center gap-4 px-4 pb-3 text-xs text-slate-600 border-b border-slate-800">
        <span className="flex items-center gap-1 text-slate-500">
          <Zap size={10} className="text-amber-500" />
          {(task.tokens_used || 0).toLocaleString()} tokens
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          <DollarSign size={10} className="text-emerald-500" />
          {formatCost(task.cost_usd)}
        </span>
        {task.execution_time_s != null && (
          <span className="flex items-center gap-1 text-slate-500">
            <Timer size={10} className="text-blue-400" />
            {formatDuration(task.execution_time_s)}
          </span>
        )}
        {steps.length > 0 && (
          <span className="flex items-center gap-1 text-slate-500">
            <Cpu size={10} className="text-indigo-400" />
            {steps.length} tool{steps.length !== 1 ? 's' : ''} used
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 pt-4 space-y-4">

              {/* Processing state */}
              {task.status === 'processing' && (
                <div className="flex items-center gap-3 text-blue-400 text-sm bg-blue-400/5 border border-blue-400/20 rounded-xl px-4 py-3">
                  <Loader2 size={15} className="animate-spin flex-shrink-0" />
                  <div>
                    <p className="font-medium">Agent is working…</p>
                    <p className="text-xs text-blue-400/70 mt-0.5">Streaming results in real-time via SSE</p>
                  </div>
                </div>
              )}

              {/* Pending state */}
              {task.status === 'pending' && (
                <div className="flex items-center gap-3 text-amber-400 text-sm bg-amber-400/5 border border-amber-400/20 rounded-xl px-4 py-3">
                  <Clock size={15} className="flex-shrink-0 animate-pulse" />
                  <p className="font-medium">Queued — waiting for agent worker</p>
                </div>
              )}

              {/* Error state */}
              {task.status === 'failed' && task.error_message && (
                <div className="flex items-start gap-3 text-red-400 text-sm bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-0.5">Task failed</p>
                    <p className="text-xs text-red-400/80">{task.error_message}</p>
                  </div>
                </div>
              )}

              {/* Answer — rendered as beautiful markdown */}
              {answer && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 px-5 py-4">
                  <AgentMarkdown content={answer} />
                </div>
              )}

              {/* Premium download card for document/project tasks */}
              {hasDownload && <DownloadResultCard task={task} />}

              {/* Tool trace accordion */}
              {steps.length > 0 && <StepTrace steps={steps} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const { status: apiKeyStatus } = useApiKeyStatus()
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
    const token =
      localStorage.getItem('synapse_access_token') ||
      localStorage.getItem('access_token') ||
      (() => {
        try {
          const s = JSON.parse(localStorage.getItem('synapse-auth') || '{}')
          return s?.state?.accessToken ?? s?.state?.access ?? ''
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
    <div className="flex-1 overflow-y-auto bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24 lg:pb-8">

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

        {/* ── No API key warning banner ── */}
        {apiKeyStatus && !apiKeyStatus.any_configured && (
          <div className="flex items-center gap-3 px-4 py-3 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 text-amber-400" />
            <span>
              No AI API key configured — agents are using the shared server key.{' '}
              <Link href="/settings" className="underline hover:text-amber-200 font-medium">
                Add your own key in Settings → AI Engine
              </Link>{' '}
              to use your own quota.
            </span>
          </div>
        )}

        {/* ── Command Interface — Premium Diamond ── */}
        <div className="relative rounded-2xl mb-6 overflow-hidden" style={{
          background: 'linear-gradient(135deg, #0c0e17 0%, #0e1020 50%, #0c0e17 100%)',
          border: '1px solid rgba(99,102,241,0.18)',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.06), 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          {/* Subtle gradient shimmer top */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          <div className="p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
                  <Terminal size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Command Interface</h2>
                  <p className="text-[10px] text-slate-500">Autonomous AI agent execution</p>
                </div>
              </div>
              {/* Tools count chip */}
              {tools.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold">
                  <Zap size={10} />
                  {tools.length} tools ready
                </div>
              )}
            </div>

            {/* Task type picker — segmented control style */}
            <div className="mb-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Agent Mode</p>
              <div className="flex flex-wrap gap-1.5">
                {TASK_TYPES.map(tt => {
                  if (tt.locked) return (
                    <div
                      key={tt.value}
                      title={tt.lockReason}
                      className="relative group/lock flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/30 bg-slate-800/20 opacity-40 cursor-not-allowed select-none"
                    >
                      <tt.icon size={12} className="text-slate-600 shrink-0" />
                      <span className="text-xs font-semibold text-slate-600">{tt.label}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-600 shrink-0"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                  )
                  const Icon = tt.icon
                  const active = taskType === tt.value
                  return (
                    <button
                      key={tt.value}
                      onClick={() => setTaskType(tt.value)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border',
                        active
                          ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-300 shadow-sm shadow-indigo-500/20'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-indigo-500/30 hover:text-slate-200 hover:bg-slate-800'
                      )}
                    >
                      <Icon size={12} className={active ? 'text-indigo-400' : 'text-slate-500'} />
                      {tt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Prompt input — premium terminal style */}
            <form onSubmit={handleSubmit}>
              <div className="relative rounded-xl overflow-hidden" style={{
                background: 'rgba(8,9,14,0.8)',
                border: '1px solid rgba(99,102,241,0.15)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
              }}>
                {/* Terminal bar */}
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-amber-500/60" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                  <span className="ml-2 text-[10px] text-slate-600 font-mono">
                    synapse-agent ~ {TASK_TYPES.find(t => t.value === taskType)?.label?.toLowerCase() ?? 'general'}
                  </span>
                </div>
                <div className="flex items-start px-3 py-3">
                  <span className="text-indigo-500 font-mono text-sm mr-2 mt-[2px] shrink-0">▶</span>
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent) } }}
                    placeholder={`${TASK_TYPES.find(t => t.value === taskType)?.description ?? 'Describe your task'}…`}
                    rows={3}
                    className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none font-mono leading-relaxed min-h-[72px]"
                  />
                </div>
                {/* Bottom toolbar */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-white/5">
                  <p className="text-[10px] text-slate-600 font-mono">Enter ↵ to run · Shift+Enter for newline</p>
                  <button
                    type="submit"
                    disabled={submitting || !prompt.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white text-xs font-semibold shadow-md shadow-indigo-500/20"
                  >
                    {submitting
                      ? <><Loader2 size={12} className="animate-spin" /> Running…</>
                      : <><Send size={12} /> Execute</>
                    }
                  </button>
                </div>
              </div>
            </form>

            {/* Quick commands */}
            <div className="mt-4">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Quick Commands</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMAND_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.label}
                    onClick={() => { setPrompt(tpl.prompt); setTaskType(tpl.type) }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-500 hover:text-indigo-300 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all font-medium"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Available tools strip */}
            {tools.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex flex-wrap gap-1">
                  {tools.map(tool => (
                    <span
                      key={tool.name}
                      title={tool.description}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/50 text-slate-500 font-mono cursor-default hover:text-slate-300 transition-colors"
                    >
                      {tool.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-1 mb-5 bg-slate-900/80 border border-slate-700/60 rounded-xl p-1 w-fit">
          {([
            { id: 'active',  label: 'Active',  count: activeTasks.length },
            { id: 'history', label: 'History', count: historyTasks.length },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full font-bold',
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
                )}>
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
