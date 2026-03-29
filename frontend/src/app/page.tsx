'use client'

/**
 * SYNAPSE — Premium Landing Page
 * Accessible at http://localhost:3000/
 * Redirects authenticated users to /feed automatically.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import {
  Brain, Zap, GitBranch, BookOpen, Youtube, Newspaper, Bot,
  TrendingUp, Shield, Globe, ArrowRight, ChevronDown, Sparkles,
  BarChart2, MessageSquare, Database, Layers, Activity, Check,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/helpers'

// ── Feature Data ───────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Brain,      label: 'AI Chat + RAG',         desc: 'Context-aware chat grounded in your curated knowledge base.',    colour: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { icon: Bot,        label: 'Autonomous Agents',      desc: 'Multi-step AI agents that research, analyse, and generate.',     colour: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { icon: Newspaper,  label: 'Tech Intelligence Feed', desc: 'AI-curated articles from HN, Reddit, GitHub & more.',           colour: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { icon: Youtube,    label: 'Video Library',          desc: 'Scraped & summarized YouTube tutorials on any tech topic.',     colour: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
  { icon: GitBranch,  label: 'GitHub Radar',           desc: 'Trending repositories ranked by stars, language & topic.',      colour: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/20' },
  { icon: BookOpen,   label: 'Research Explorer',      desc: 'arXiv papers with AI synthesis across multiple papers at once.',colour: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20'   },
  { icon: TrendingUp, label: 'Trend Radar',            desc: 'Real-time technology trend scores mined from all data sources.',colour: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20'  },
  { icon: Zap,        label: 'Automation Workflows',   desc: 'Schedule and chain scraping, summarisation and AI tasks.',      colour: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/20'   },
]

const STATS = [
  { value: '75+',   label: 'Technologies tracked' },
  { value: '4',     label: 'AI-powered scrapers'  },
  { value: '∞',     label: 'Knowledge sources'    },
  { value: 'Free',  label: 'Open source core'     },
]

const STEPS = [
  { n: '01', title: 'Connect your sources',   desc: 'Scrapers pull from HN, GitHub, YouTube & arXiv automatically.' },
  { n: '02', title: 'AI processes content',   desc: 'Summaries, embeddings and trend scores are generated per item.'  },
  { n: '03', title: 'Chat & discover',        desc: 'Ask questions grounded in your entire knowledge base via RAG.'  },
  { n: '04', title: 'Automate everything',    desc: 'Build workflows that run on schedule, event or on-demand.'       },
]

const TECH_PILLS = ['Python','LLM','React','Rust','Go','TypeScript','RAG','pgvector','Docker','LangChain','FastAPI','Next.js']

// ── Particle Background ────────────────────────────────────────────────────────

function StarField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 60 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-px h-px bg-white rounded-full"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: Math.random() * 0.6 + 0.1 }}
          animate={{ opacity: [0.1, 0.8, 0.1] }}
          transition={{ duration: Math.random() * 4 + 2, repeat: Infinity, delay: Math.random() * 4 }}
        />
      ))}
    </div>
  )
}

// ── Typed Headline ─────────────────────────────────────────────────────────────

const HEADLINES = ['Intelligence.', 'Research.', 'Automation.', 'Discovery.']

function TypedHeadline() {
  const [idx, setIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const word = HEADLINES[idx]
    let timeout: ReturnType<typeof setTimeout>
    if (!deleting && displayed.length < word.length) {
      timeout = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 80)
    } else if (!deleting && displayed.length === word.length) {
      timeout = setTimeout(() => setDeleting(true), 2000)
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 40)
    } else if (deleting && displayed.length === 0) {
      setDeleting(false)
      setIdx(i => (i + 1) % HEADLINES.length)
    }
    return () => clearTimeout(timeout)
  }, [displayed, deleting, idx])

  return (
    <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
      {displayed}<span className="animate-pulse">|</span>
    </span>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { scrollYProgress } = useScroll()
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -60])

  // Auto-redirect authenticated users
  useEffect(() => {
    if (isAuthenticated) router.push('/feed')
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4"
        style={{ background: 'rgba(2,4,15,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
            <Brain size={15} className="text-white" />
          </div>
          <span className="text-base font-black text-white tracking-tight">SYNAPSE</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link href="/register"
            className="flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-indigo-500/25">
            Get started <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-20">
        <StarField />

        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-bold mb-6 sm:mb-8"
          >
            <Sparkles size={11} />
            AI-Powered Technology Intelligence Platform
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] mb-4 sm:mb-6"
          >
            Your AI-Powered<br />
            Tech <TypedHeadline />
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-slate-400 text-base sm:text-xl max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed"
          >
            SYNAPSE aggregates articles, GitHub repos, arXiv papers & YouTube videos,
            then lets you <strong className="text-white">chat with your knowledge base</strong>,
            run AI agents, and automate everything — all in one platform.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-16"
          >
            <Link href="/register"
              className="group flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm sm:text-base transition-all shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 w-full sm:w-auto justify-center"
            >
              <Zap size={16} />
              Start for free
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/login"
              className="flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold text-sm sm:text-base transition-all hover:bg-slate-800/50 w-full sm:w-auto justify-center"
            >
              Sign in to dashboard
            </Link>
          </motion.div>

          {/* Floating tech pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {TECH_PILLS.map((pill, i) => (
              <motion.span
                key={pill}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.05 }}
                className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs font-mono hover:border-indigo-500/40 hover:text-indigo-300 transition-all cursor-default"
              >
                {pill}
              </motion.span>
            ))}
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-slate-600"
          >
            <ChevronDown size={20} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section className="relative py-16 sm:py-20 px-4 border-y border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 text-center">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-indigo-400 to-violet-400 bg-clip-text text-transparent mb-1">
                {s.value}
              </div>
              <div className="text-xs sm:text-sm text-slate-500 font-medium">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-700 bg-slate-800/50 text-slate-400 text-xs font-bold mb-4">
              <Layers size={11} /> Everything you need
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
              One platform.<br />
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Infinite intelligence.</span>
            </h2>
            <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
              Every tool a modern developer, researcher, or tech professional needs — powered by AI.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className={cn('group relative rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-default', f.bg, f.border)}
                  style={{ background: 'linear-gradient(135deg, rgba(15,17,23,0.9) 0%, rgba(12,14,20,0.95) 100%)' }}
                >
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4 border', f.bg, f.border)}>
                    <Icon size={20} className={f.colour} />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-2 leading-tight">{f.label}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 sm:py-28 px-4 border-y border-white/5" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-700 bg-slate-800/50 text-slate-400 text-xs font-bold mb-4">
              <Activity size={11} /> How it works
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
              From data to insight<br />
              <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">in minutes.</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-4 p-5 sm:p-6 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all"
                style={{ background: 'linear-gradient(135deg, #0c0e17 0%, #0d1020 100%)' }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600/30 to-violet-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <span className="text-indigo-400 font-black text-xs">{step.n}</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm mb-1">{step.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 sm:py-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-3xl" />
        </div>
        <div className="max-w-2xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4 sm:mb-6">
              Ready to power your<br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">tech intelligence?</span>
            </h2>
            <p className="text-slate-400 text-base sm:text-lg mb-8 sm:mb-10">
              Join and start discovering, researching, and automating — powered entirely by AI.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register"
                className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-base transition-all shadow-2xl shadow-indigo-500/30 hover:scale-105 w-full sm:w-auto justify-center">
                <Zap size={18} />
                Get started free
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/login" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">
                Already have an account →
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Brain size={11} className="text-white" />
            </div>
            <span className="text-sm font-black text-white">SYNAPSE</span>
          </div>
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} SYNAPSE — AI-Powered Technology Intelligence</p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <Link href="/login" className="hover:text-slate-300 transition-colors">Login</Link>
            <Link href="/register" className="hover:text-slate-300 transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
