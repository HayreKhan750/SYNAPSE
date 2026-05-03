'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ExternalLink, MessageSquare, Loader2,
  Clock, Share2, BookOpen, Tag,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '@/utils/api'
import { BookmarkButton } from '@/components/BookmarkButton'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn } from '@/utils/helpers'

export interface ReaderArticle {
  id:          string
  title:       string
  summary?:    string
  url:         string
  scraped_at:  string
  tags?:       string[]
  topic?:      string
  source_type?: string
  content_type?: string  // 'article' | 'paper' | 'repo'
}

interface Props {
  article: ReaderArticle | null
  onClose: () => void
}

function ReadingTime({ text }: { text: string }) {
  const mins = Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200))
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
      <Clock size={11} /> {mins} min read
    </span>
  )
}

const SOURCE_COLOURS: Record<string, string> = {
  hackernews: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  reddit:     'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  arxiv:      'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  github:     'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
  youtube:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  default:    'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
}

export function ContentReaderModal({ article, onClose }: Props) {
  const router = useRouter()
  const [aiAnalysis, setAiAnalysis]   = useState<string>('')
  const [loading,    setLoading]      = useState(false)
  const [tab,        setTab]          = useState<'summary' | 'ai'>('summary')

  useEffect(() => {
    if (!article) { setAiAnalysis(''); return }
    setAiAnalysis('')
    setLoading(true)
    setTab('summary')

    api.post('/ai/summarize/', {
      title:   article.title,
      content: article.summary || '',
      url:     article.url,
      mode:    'extended',
    })
      .then(r => {
        const text = r.data?.summary || r.data?.content || r.data?.result || ''
        setAiAnalysis(text)
      })
      .catch(() => setAiAnalysis(article.summary || ''))
      .finally(() => setLoading(false))
  }, [article?.id])

  const handleShare = () => {
    if (!article) return
    navigator.clipboard.writeText(article.url)
      .then(() => toast.success('Link copied!'))
      .catch(() => {})
  }

  const handleAskAI = () => {
    if (!article) return
    const q = encodeURIComponent(`Discuss this article in depth: "${article.title}"`)
    router.push(`/chat?q=${q}`)
    onClose()
  }

  const srcColour = SOURCE_COLOURS[article?.source_type?.toLowerCase() ?? ''] ?? SOURCE_COLOURS.default

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {article && (
        <motion.div
          key="reader-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-6 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="reader-panel"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{ y: 60,    opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <div className="flex-1 min-w-0">
                {article.source_type && (
                  <span className={cn('inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2', srcColour)}>
                    {article.source_type}
                  </span>
                )}
                <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
                  {article.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {(aiAnalysis || article.summary) && (
                    <ReadingTime text={aiAnalysis || article.summary || ''} />
                  )}
                  {article.tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <Tag size={9} /> {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0 transition-colors mt-0.5"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Tab switcher ────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 px-5 sm:px-6 pt-3 pb-0 flex-shrink-0">
              {(['summary', 'ai'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                    tab === t
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  {t === 'summary' ? '📝 Quick Summary' : '🤖 AI Deep-Dive'}
                </button>
              ))}
            </div>

            {/* ── Body ────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
              {tab === 'summary' ? (
                article.summary ? (
                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {article.summary}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                    <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No summary available yet.</p>
                    <p className="text-xs mt-1">Switch to AI Deep-Dive or read the original article.</p>
                  </div>
                )
              ) : loading ? (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                  <Loader2 size={28} className="animate-spin text-indigo-500" />
                  <p className="text-sm font-medium">Generating AI analysis…</p>
                  <p className="text-xs text-slate-400">This takes a few seconds</p>
                </div>
              ) : aiAnalysis ? (
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiAnalysis}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-sm">AI analysis unavailable. Visit the original article.</p>
                </div>
              )}
            </div>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <BookmarkButton
                  contentType={(article.content_type as any) || 'article'}
                  objectId={article.id}
                  size={15}
                />
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <Share2 size={12} /> Share
                </button>
                <button
                  onClick={handleAskAI}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  <MessageSquare size={12} /> Ask AI
                </button>
              </div>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-colors shadow-sm"
              >
                Read Original <ExternalLink size={12} />
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
