'use client'

import React from 'react'
import Link from 'next/link'
import { Zap, Brain, TrendingUp, Shield, ArrowRight } from 'lucide-react'

const features = [
  { icon: Brain, title: 'AI-Powered Insights', desc: 'Intelligent summaries from thousands of tech sources daily' },
  { icon: TrendingUp, title: 'Real-time Trends', desc: 'Stay ahead with live signals from GitHub, arXiv & HN' },
  { icon: Zap, title: 'Workflow Automation', desc: 'Build AI agents that research and report automatically' },
  { icon: Shield, title: 'Enterprise Ready', desc: 'SOC2 compliant with SSO, audit logs and team controls' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex relative bg-gradient-to-br from-indigo-950 via-violet-950 to-slate-950">

      {/* ── Full-page background layers (shared across both panels) ── */}
      {/* Animated glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      {/* Full-page grid overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* ── Left Panel – branding & social proof ── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-between p-12 overflow-hidden">

        {/* Content */}
        <div className="relative z-10">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <span className="text-white font-black text-xl">S</span>
            </div>
            <span className="text-2xl font-black text-white tracking-tight">SYNAPSE</span>
          </Link>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-cyan-400 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Trusted by 10,000+ engineers worldwide
          </div>
          <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1]">
            The intelligence layer<br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              for tech builders.
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-md leading-relaxed">
            AI agents that scan, summarise and surface what matters across GitHub, arXiv, HackerNews and more — so you never miss a breakthrough.
          </p>

          {/* Feature list */}
          <div className="grid grid-cols-1 gap-3 pt-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10">
          <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
            <p className="text-slate-300 text-sm leading-relaxed italic">
              "SYNAPSE cut my research time by 80%. I get everything I need to know about AI/ML in one feed, every morning."
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center text-white text-xs font-bold">AK</div>
              <div>
                <p className="text-white text-xs font-semibold">Alex Kim</p>
                <p className="text-slate-500 text-xs">Staff Engineer, Scale AI</p>
              </div>
              <div className="ml-auto flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400 text-xs">★</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel – auth form ── */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col items-center justify-center p-6 sm:p-10 relative">

        {/* Mobile logo */}
        <div className="lg:hidden mb-10 text-center">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-lg">S</span>
            </div>
            <span className="text-2xl font-black text-white tracking-tight">SYNAPSE</span>
          </div>
          <p className="text-slate-500 text-sm">AI-Powered Technology Intelligence</p>
        </div>

        {/* Form card */}
        <div className="relative w-full max-w-sm">
          {/* Glow border */}
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-indigo-500/40 via-violet-500/20 to-cyan-500/30" />
          <div className="relative rounded-2xl bg-white/[0.07] backdrop-blur-md border border-white/[0.12] p-8 shadow-2xl shadow-black/40">
            {children}
          </div>
        </div>

        {/* Footer */}
        <p className="relative mt-8 text-xs text-slate-600">
          © {new Date().getFullYear()} SYNAPSE · <Link href="/" className="hover:text-slate-400 transition-colors">Home</Link>
        </p>
      </div>
    </div>
  )
}
