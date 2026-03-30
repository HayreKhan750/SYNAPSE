'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Zap, Search, GitBranch, Bot, Workflow, BookOpen,
  Star, TrendingUp, FileText, ChevronRight, Check,
  Menu, X, ArrowRight, Sparkles, Shield, Clock,
  BarChart3, MessageSquare, Brain
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/utils/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrendingItem {
  id: string
  title: string
  source_type?: string
  source?: { name: string }
  stars?: number
  topic?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [threshold])
  return scrolled
}

function useInView(ref: React.RefObject<HTMLElement>) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
  return inView
}

function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref as React.RefObject<HTMLElement>)
  useEffect(() => {
    if (!inView) return
    let start = 0
    const steps = 40
    const inc = target / steps
    const timer = setInterval(() => {
      start += inc
      if (start >= target) { setVal(target); clearInterval(timer) }
      else setVal(Math.floor(start))
    }, 30)
    return () => clearInterval(timer)
  }, [inView, target])
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function LandingNavbar() {
  const scrolled = useScrolled()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm'
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-sm">S</span>
            </div>
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              SYNAPSE
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {[['Features', '#features'], ['Pricing', '#pricing'], ['Trending', '#trending']].map(([label, href]) => (
              <a key={label} href={href}
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login"
              className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-3 py-1.5">
              Log in
            </Link>
            <Link href="/register"
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]">
              Get started free <ChevronRight size={14} />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-slate-200 dark:border-slate-800 mt-1">
            <div className="flex flex-col gap-1">
              {[['Features', '#features'], ['Pricing', '#pricing'], ['Trending', '#trending']].map(([label, href]) => (
                <a key={label} href={href} onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  {label}
                </a>
              ))}
              <div className="flex gap-2 mt-2 px-1">
                <Link href="/login" className="flex-1 text-center text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Log in</Link>
                <Link href="/register" className="flex-1 text-center text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-2.5 rounded-xl shadow-lg shadow-indigo-500/25">Get started</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: TrendingUp,
    color: 'from-indigo-500 to-violet-600',
    glow: 'shadow-indigo-500/20',
    title: 'Tech Intelligence Feed',
    desc: 'Real-time aggregation from Hacker News, arXiv, GitHub trending and YouTube. AI-summarized, filtered by topic, personalized to your interests.',
  },
  {
    icon: MessageSquare,
    color: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/20',
    title: 'AI Chat (RAG)',
    desc: 'Ask anything about tech — SYNAPSE answers grounded in your knowledge base with source citations, not hallucinations. Full conversation history.',
  },
  {
    icon: GitBranch,
    color: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/20',
    title: 'GitHub Radar',
    desc: 'Discover trending repositories with star sparklines, language breakdown and topic filters. Bookmark repos and track ecosystem momentum.',
  },
  {
    icon: Bot,
    color: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/20',
    title: 'Autonomous AI Agents',
    desc: 'Agents that research, generate PDFs/PPTs/Word docs, scaffold code projects and analyze trends — all from a single natural language command.',
  },
  {
    icon: Workflow,
    color: 'from-cyan-500 to-blue-600',
    glow: 'shadow-cyan-500/20',
    title: 'Automation Center',
    desc: 'No-code workflows: connect triggers (new article, scheduled time, events) to actions (generate doc, send notification, call webhook). Zero friction.',
  },
  {
    icon: BookOpen,
    color: 'from-rose-500 to-pink-600',
    glow: 'shadow-rose-500/20',
    title: 'Research Explorer',
    desc: 'Semantic search across 50K+ arXiv papers with AI-generated summaries, difficulty ratings, citation counts and one-click Ask AI for any paper.',
  },
]

function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref as React.RefObject<HTMLElement>)
  return (
    <section id="features" ref={ref} className="py-24 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            <Zap size={12} /> Everything you need
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4">
            Built for the way tech builders actually work
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-slate-600 dark:text-slate-400">
            Seven tools in one — designed to save you 10+ hours every week so you can focus on building.
          </p>
        </div>
        <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {FEATURES.map(({ icon: Icon, color, glow, title, desc }) => (
            <div key={title} className={`group relative bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-6 hover:shadow-xl hover:${glow} transition-all duration-300 hover:-translate-y-1 overflow-hidden`}>
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" style={{backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`}} />
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg shadow-black/10`}>
                <Icon size={22} className="text-white" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2">{title}</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

const STATS = [
  { icon: FileText, label: 'Articles indexed', value: 50000, suffix: '+' },
  { icon: Clock,    label: 'Refresh interval', value: 30,    suffix: ' min' },
  { icon: Shield,   label: 'Uptime SLA',        value: 99,    suffix: '.9%' },
  { icon: Brain,    label: 'AI tools available', value: 10,   suffix: '+' },
  { icon: BarChart3,label: 'Avg response time',  value: 200,  suffix: 'ms' },
]

function StatsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref as React.RefObject<HTMLElement>)
  return (
    <section ref={ref} className="py-20 bg-white dark:bg-slate-950 border-y border-slate-100 dark:border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {STATS.map(({ icon: Icon, label, value, suffix }) => (
            <div key={label} className="text-center">
              <Icon size={20} className="text-indigo-500 mx-auto mb-2" />
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-1">
                {inView ? <AnimatedNumber target={value} suffix={suffix} /> : '—'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-500 font-medium">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for individuals exploring tech intelligence.',
    cta: 'Get started free',
    href: '/register',
    highlight: false,
    features: [
      '50 AI chat messages / day',
      '10 documents generated',
      '5 automation workflows',
      'Tech feed (7-day history)',
      'Basic keyword search',
      'Bookmark collections',
      '1 AI Agent mode',
    ],
    missing: ['Semantic search', 'Unlimited AI agents', 'SSO / SAML', 'Team workspaces'],
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'Everything you need to stay ahead — unlimited AI power.',
    cta: 'Start Pro trial',
    href: '/register?plan=pro',
    highlight: true,
    features: [
      'Unlimited AI chat messages',
      'Unlimited documents',
      'Unlimited automations',
      'Full history (all time)',
      'Semantic + hybrid search',
      'All AI Agents modes',
      'Google Drive & S3 export',
      'Priority support',
    ],
    missing: ['SSO / SAML', 'Team workspaces'],
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: '/month',
    description: 'For high-performance teams with custom requirements.',
    cta: 'Contact sales',
    href: 'mailto:sales@synapse.app',
    highlight: false,
    features: [
      'Everything in Pro',
      'Team workspaces & RBAC',
      'SSO / SAML integration',
      'Custom AI model tuning',
      'White-label licensing',
      'Advanced audit logs',
      'Dedicated support channel',
      'SLA guarantee',
    ],
    missing: [],
  },
]

function PricingSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref as React.RefObject<HTMLElement>)
  return (
    <section id="pricing" ref={ref} className="py-24 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            <Star size={12} /> Pricing
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Start free. Upgrade when your team is ready. No surprises.
          </p>
        </div>
        <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {PLANS.map((plan) => (
            <div key={plan.name} className={`relative flex flex-col rounded-2xl border p-7 ${
              plan.highlight
                ? 'bg-gradient-to-b from-indigo-600 to-violet-700 border-indigo-500 shadow-2xl shadow-indigo-500/30 scale-[1.02]'
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
            }`}>
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-amber-400 text-amber-900 text-xs font-black px-3 py-1 rounded-full shadow-lg">
                    ✦ Most Popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${plan.highlight ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                  {plan.name}
                </div>
                <div className="flex items-end gap-1 mb-2">
                  <span className={`text-5xl font-black ${plan.highlight ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm font-medium mb-2 ${plan.highlight ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`text-sm ${plan.highlight ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>
                  {plan.description}
                </p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check size={15} className={`shrink-0 mt-0.5 ${plan.highlight ? 'text-emerald-300' : 'text-emerald-500'}`} />
                    <span className={plan.highlight ? 'text-indigo-50' : 'text-slate-700 dark:text-slate-300'}>{f}</span>
                  </li>
                ))}
                {plan.missing.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm opacity-40">
                    <X size={15} className="shrink-0 mt-0.5 text-slate-400" />
                    <span className={plan.highlight ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-500'}>{f}</span>
                  </li>
                ))}
              </ul>
              <a href={plan.href}
                className={`w-full text-center font-bold py-3 rounded-xl transition-all text-sm ${
                  plan.highlight
                    ? 'bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg'
                    : 'border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}>
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Live Trending ─────────────────────────────────────────────────────────────

function TrendingSection() {
  const { data } = useQuery({
    queryKey: ['landing-trending'],
    queryFn: async () => {
      const res = await api.get('/api/v1/trending/?limit=8&hours=48')
      return res.data?.data || {}
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  const items: TrendingItem[] = [
    ...(data?.articles || []).slice(0, 3),
    ...(data?.repos || []).slice(0, 3),
    ...(data?.papers || []).slice(0, 2),
  ]

  const FALLBACK: TrendingItem[] = [
    { id: '1', title: 'GPT-4o mini outperforms larger models on coding benchmarks', source_type: 'hackernews' },
    { id: '2', title: 'microsoft/phi-3-mini · 3.8B model with 128K context', source_type: 'github', stars: 12400 },
    { id: '3', title: 'Attention Is All You Need — Revisited with Flash Attention 3', source_type: 'arxiv' },
    { id: '4', title: 'Rust overtakes Go in GitHub star growth for second consecutive quarter', source_type: 'hackernews' },
    { id: '5', title: 'vercel/next.js — Turbopack now default in Next.js 15', source_type: 'github', stars: 118000 },
    { id: '6', title: 'Constitutional AI: Harmlessness from AI Feedback — Anthropic', source_type: 'arxiv' },
  ]

  const displayItems = items.length >= 4 ? items : FALLBACK

  const sourceColor = (type?: string) => {
    const map: Record<string, string> = {
      hackernews: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
      github:     'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
      arxiv:      'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
      youtube:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    }
    return map[type || ''] || 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
  }
  const sourceLabel = (type?: string) => ({ hackernews: 'HN', github: 'GitHub', arxiv: 'arXiv', youtube: 'YouTube' }[type || ''] || 'Feed')

  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref as React.RefObject<HTMLElement>)

  return (
    <section id="trending" ref={ref} className="py-24 bg-white dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            <TrendingUp size={12} /> Live Trending
          </div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-3">
            What's trending in tech right now
          </h2>
          <p className="text-slate-600 dark:text-slate-400">Updated every 30 minutes from Hacker News, GitHub, arXiv and YouTube.</p>
        </div>
        <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {displayItems.slice(0, 6).map((item, i) => (
            <div key={item.id || i} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 hover:shadow-md transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sourceColor(item.source_type)}`}>
                  {sourceLabel(item.source_type)}
                </span>
                {item.stars && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    {item.stars >= 1000 ? `${(item.stars / 1000).toFixed(1)}k` : item.stars}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                {item.title}
              </p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/register" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors">
            See the full feed after signing up <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-semibold mb-8">
          <Sparkles size={12} /> No credit card required
        </div>
        <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
          Ready to discover what's next in tech?
        </h2>
        <p className="text-lg text-indigo-100 mb-10">
          Join thousands of engineers, researchers and founders who use SYNAPSE to stay ahead. Free forever, upgrade anytime.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/register"
            className="flex items-center gap-2 bg-white text-indigo-700 font-bold px-8 py-4 rounded-2xl shadow-xl hover:bg-indigo-50 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
            Create your account <ArrowRight size={16} />
          </Link>
          <Link href="/login"
            className="text-white/80 hover:text-white font-medium text-sm transition-colors">
            Already have an account? Sign in →
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800/60 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <span className="text-white font-black text-xs">S</span>
            </div>
            <span className="font-black text-base bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              SYNAPSE
            </span>
            <span className="text-slate-500 text-sm ml-1">· AI-Powered Tech Intelligence</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[['Features', '#features'], ['Pricing', '#pricing'], ['Trending', '#trending'], ['Log in', '/login'], ['Register', '/register']].map(([label, href]) => (
              <a key={label} href={href}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-slate-800/60 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} SYNAPSE. All rights reserved. Built with ❤️ for the tech community.
        </div>
      </div>
    </footer>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 pb-24 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-600/20 blur-3xl dark:from-indigo-500/10 dark:to-violet-700/10" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-cyan-400/15 to-indigo-400/15 blur-3xl dark:from-cyan-500/8 dark:to-indigo-500/8" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-r from-violet-400/5 to-indigo-400/5 blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-8 animate-fadeIn">
          <Sparkles size={12} className="text-indigo-500" />
          Now with Autonomous AI Agents · Powered by Gemini + OpenRouter
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.05]">
          The AI intelligence platform
          <br />
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
            built for tech builders
          </span>
        </h1>

        {/* Subtext */}
        <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
          SYNAPSE aggregates articles, research papers, GitHub repos and videos — 
          then lets AI agents research, summarize, and automate so you 
          <span className="font-semibold text-slate-800 dark:text-slate-200"> never miss a breakthrough</span>.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Link href="/register"
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-7 py-3.5 rounded-2xl shadow-xl shadow-indigo-500/30 transition-all hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] text-base">
            Start for free <ArrowRight size={16} />
          </Link>
          <Link href="/login"
            className="flex items-center gap-2 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-7 py-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-base shadow-sm">
            Sign in to workspace
          </Link>
        </div>

        {/* App mockup */}
        <div className="relative max-w-3xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-950 z-10 bottom-0 h-24 top-auto rounded-b-2xl" />
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
            {/* Mockup titlebar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/60">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-md w-48 mx-auto" />
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                10 tools ready
              </div>
            </div>
            {/* Mockup content */}
            <div className="p-5 text-left font-mono text-xs sm:text-sm space-y-3 bg-slate-950 dark:bg-slate-950">
              <div className="flex items-start gap-3">
                <div className="flex gap-1 mt-1">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <span className="text-slate-400">synapse-agent ~ general</span>
              </div>
              <div className="pl-6 text-slate-300">
                <span className="text-indigo-400">{'>'} </span>
                <span className="text-white">Fetch the top 5 trending ML papers from arXiv this week and generate a PDF summary report</span>
              </div>
              <div className="pl-6 space-y-1.5 text-slate-400">
                <div className="flex items-center gap-2"><span className="text-emerald-400">✓</span> <span>Searching arXiv for recent ML papers…</span></div>
                <div className="flex items-center gap-2"><span className="text-emerald-400">✓</span> <span>Fetched 5 papers · Summarizing with AI…</span></div>
                <div className="flex items-center gap-2"><span className="text-violet-400">⚙</span> <span className="text-violet-300">Generating PDF report via generate_pdf tool…</span></div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-emerald-400">✓</span>
                  <span className="text-emerald-300 font-semibold">Done! <span className="underline">ML_Trends_Week13.pdf</span> ready to download</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Social Proof / Logo Bar ──────────────────────────────────────────────────

const USED_BY = ['Engineers', 'Researchers', 'CTOs', 'Founders', 'Data Scientists', 'DevRel Teams', 'ML Engineers', 'Open Source Devs']

function SocialProofBar() {
  return (
    <section className="py-10 bg-slate-50 dark:bg-slate-900/60 border-y border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-6">
        Trusted by tech professionals worldwide
      </p>
      <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex gap-10 animate-marquee whitespace-nowrap">
          {[...USED_BY, ...USED_BY].map((label, i) => (
            <span key={i} className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-500 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    step: '01',
    color: 'from-indigo-500 to-violet-600',
    title: 'Connect your sources',
    desc: 'SYNAPSE automatically aggregates from Hacker News, arXiv, GitHub trending, and YouTube — zero configuration. Your personalized feed is ready in seconds.',
    visual: (
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Hacker News', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/40' },
          { label: 'GitHub', color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600' },
          { label: 'arXiv', color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/40' },
          { label: 'YouTube', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/40' },
        ].map(s => (
          <span key={s.label} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${s.color}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />{s.label}
          </span>
        ))}
        <span className="text-xs font-bold px-3 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500">+ more coming</span>
      </div>
    ),
  },
  {
    step: '02',
    color: 'from-violet-500 to-purple-600',
    title: 'AI summarizes everything',
    desc: 'Every article, paper and repo gets an AI-generated summary, topic tag, reading time and sentiment score. Never read a disappointing link again.',
    visual: (
      <div className="space-y-2.5">
        {[
          { title: 'FlashAttention-3: Fast and Accurate Attention', tag: 'AI/ML', time: '4 min', score: '92%' },
          { title: 'Rust async runtimes compared: Tokio vs async-std', tag: 'Systems', time: '6 min', score: '87%' },
          { title: 'Next.js 15 ships with Turbopack by default', tag: 'Frontend', time: '2 min', score: '95%' },
        ].map(a => (
          <div key={a.title} className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-slate-700/60 text-xs">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 dark:text-white truncate">{a.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">{a.tag}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">{a.time} read</span>
              </div>
            </div>
            <span className="shrink-0 font-bold text-emerald-600 dark:text-emerald-400">{a.score}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    step: '03',
    color: 'from-emerald-500 to-teal-600',
    title: 'Chat, research & automate',
    desc: 'Ask your AI anything, send autonomous agents to research topics, and build workflows that run while you sleep. Your personal tech research team.',
    visual: (
      <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs space-y-2">
        <div className="text-slate-400 flex items-center gap-2">
          <span className="text-emerald-400">▶</span> Ask SYNAPSE
        </div>
        <div className="text-white">"What are the best new Rust frameworks for building APIs?"</div>
        <div className="border-t border-slate-700 pt-2 space-y-1.5 text-slate-300">
          <div className="flex gap-2"><span className="text-emerald-400">✓</span> Searched 3,420 articles, 847 repos</div>
          <div className="flex gap-2"><span className="text-emerald-400">✓</span> Found 6 relevant frameworks</div>
          <div className="flex gap-2"><span className="text-violet-400">→</span> <span className="text-violet-300">Axum leads with 47k ⭐ · active ecosystem</span></div>
        </div>
      </div>
    ),
  },
]

function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref as React.RefObject<HTMLElement>)
  return (
    <section ref={ref} className="py-24 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            <Search size={12} /> How it works
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4">
            From noise to knowledge in 3 steps
          </h2>
          <p className="max-w-xl mx-auto text-slate-600 dark:text-slate-400 text-lg">
            Set up once. Stay ahead forever.
          </p>
        </div>
        <div className="space-y-16">
          {STEPS.map((step, i) => (
            <div key={step.step}
              className={`flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 150}ms` }}>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} text-white font-black text-xl mb-5 shadow-lg`}>
                  {step.step}
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-4">{step.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">{step.desc}</p>
              </div>
              {/* Visual */}
              <div className="flex-1 w-full max-w-md">
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-6 shadow-xl shadow-black/5">
                  {step.visual}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "SYNAPSE replaced my 6 different RSS feeds, newsletter subscriptions AND my daily GitHub browse. I get more signal in 10 minutes than I used to in 2 hours.",
    name: 'Alex Chen',
    role: 'Senior Engineer @ Scale AI',
    avatar: 'AC',
    color: 'from-indigo-500 to-violet-600',
  },
  {
    quote: "The AI agent feature is insane. I tell it to 'research the latest LLM quantization techniques and write me a summary doc' and it just does it. Perfectly.",
    name: 'Sarah Kim',
    role: 'ML Researcher @ DeepMind',
    avatar: 'SK',
    color: 'from-violet-500 to-purple-600',
  },
  {
    quote: "We set up an automation that monitors arXiv for new papers on our research topic and emails the team every morning. Game changer for staying current.",
    name: 'Marcus Torres',
    role: 'CTO @ Inference Labs',
    avatar: 'MT',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    quote: "The GitHub Radar alone is worth it. I discovered 3 libraries that replaced tools we were building ourselves. Saved weeks of work.",
    name: 'Priya Patel',
    role: 'Open Source Engineer',
    avatar: 'PP',
    color: 'from-rose-500 to-pink-600',
  },
  {
    quote: "I use the RAG chat every day to query my bookmarked articles. It's like having a research assistant who's read everything I've saved.",
    name: 'David Park',
    role: 'Staff Engineer @ Stripe',
    avatar: 'DP',
    color: 'from-amber-500 to-orange-600',
  },
  {
    quote: "Finally a tool that treats developers as intelligent adults. No bloat, no gamification, just pure signal. The automation workflows are incredibly powerful.",
    name: 'Lena Fischer',
    role: 'DevRel Lead @ Vercel',
    avatar: 'LF',
    color: 'from-cyan-500 to-blue-600',
  },
]

function TestimonialsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref as React.RefObject<HTMLElement>)
  return (
    <section ref={ref} className="py-24 bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            <Star size={12} /> Testimonials
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4">
            Loved by tech professionals
          </h2>
          <div className="flex items-center justify-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-5 h-5 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>
            ))}
            <span className="ml-2 text-sm font-semibold text-slate-600 dark:text-slate-400">4.9 / 5 from early users</span>
          </div>
        </div>
        <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-6 flex flex-col gap-4 hover:shadow-lg transition-shadow">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>
                ))}
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed flex-1">"{t.quote}"</p>
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-xs font-black shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

const COMPARISON_ROWS = [
  { feature: 'Real-time tech feed', synapse: true, others: 'Partial' },
  { feature: 'AI summaries on every item', synapse: true, others: false },
  { feature: 'RAG chat with your bookmarks', synapse: true, others: false },
  { feature: 'GitHub trending + star analytics', synapse: true, others: 'Partial' },
  { feature: 'Autonomous AI agents', synapse: true, others: false },
  { feature: 'No-code automation workflows', synapse: true, others: false },
  { feature: 'arXiv research with semantic search', synapse: true, others: false },
  { feature: 'PDF / PPT / Word doc generation', synapse: true, others: false },
  { feature: 'Free tier available', synapse: true, others: 'Partial' },
]

function ComparisonSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref as React.RefObject<HTMLElement>)
  return (
    <section ref={ref} className="py-24 bg-white dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            <Shield size={12} /> Why SYNAPSE
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4">
            Everything. In one place.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Stop paying for 5 separate tools. SYNAPSE replaces all of them.
          </p>
        </div>
        <div className={`rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-xl transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Header */}
          <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/60">
            <div className="px-5 py-4 text-sm font-bold text-slate-600 dark:text-slate-400">Feature</div>
            <div className="px-5 py-4 text-sm font-black text-center">
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">SYNAPSE</span>
            </div>
            <div className="px-5 py-4 text-sm font-bold text-center text-slate-400 dark:text-slate-500">Other tools</div>
          </div>
          {/* Rows */}
          {COMPARISON_ROWS.map((row, i) => (
            <div key={row.feature} className={`grid grid-cols-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-900/30'}`}>
              <div className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300 font-medium">{row.feature}</div>
              <div className="px-5 py-3.5 flex justify-center">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="px-5 py-3.5 flex justify-center items-center">
                {row.others === true ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                    <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                ) : row.others === false ? (
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                    <X size={13} className="text-red-500 dark:text-red-400" />
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/20">{row.others}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  { q: 'Is SYNAPSE really free?', a: 'Yes! The Free tier gives you 50 AI messages/day, 10 document generations, 5 automation workflows and full access to the tech feed. No credit card required.' },
  { q: 'What AI models does SYNAPSE use?', a: 'SYNAPSE supports Google Gemini 2.0 Flash (default) and 50+ models via OpenRouter including GPT-4o, Claude 3.5, Llama 3, and Mistral. You can bring your own API key for dedicated access.' },
  { q: 'How does the RAG chat work?', a: 'SYNAPSE embeds every article, paper and repo you bookmark into a vector database. When you chat, it retrieves the most relevant items and uses them as context — so answers are grounded in real sources, not hallucinations.' },
  { q: 'Can I use SYNAPSE for my team?', a: 'Enterprise plan includes team workspaces, RBAC (role-based access), SSO/SAML, shared automations, and a dedicated support channel.' },
  { q: 'How often is the feed updated?', a: 'Content is scraped every 30 minutes from Hacker News, GitHub trending, arXiv, and YouTube. AI summaries are generated within 2 minutes of discovery.' },
  { q: 'Can agents generate real documents?', a: 'Yes — AI agents can generate PDFs, PowerPoints, Word docs, Markdown files and scaffold complete project structures with real code. Files are downloadable immediately.' },
]

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref as React.RefObject<HTMLElement>)
  return (
    <section ref={ref} className="py-24 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            <MessageSquare size={12} /> FAQ
          </div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-3">Questions? Answered.</h2>
        </div>
        <div className={`space-y-3 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
              >
                <span className="font-semibold text-slate-900 dark:text-white text-sm">{faq.q}</span>
                <span className={`shrink-0 w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center transition-transform ${open === i ? 'rotate-45 bg-indigo-600 border-indigo-600' : ''}`}>
                  <svg viewBox="0 0 12 12" className={`w-3 h-3 ${open === i ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 1v10M1 6h10" />
                  </svg>
                </span>
              </button>
              {open === i && (
                <div className="px-6 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700/60 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  // Redirect logged-in users straight to the feed
  useEffect(() => {
    if (isAuthenticated) router.replace('/feed')
  }, [isAuthenticated, router])

  // Don't flash the landing page while redirecting
  if (isAuthenticated) return null

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      <LandingNavbar />
      <HeroSection />
      <SocialProofBar />
      <StatsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <TestimonialsSection />
      <ComparisonSection />
      <TrendingSection />
      <FAQSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  )
}
