'use client';

/**
 * TASK-602-F1: GitHub Intelligence Dashboard — fully overhauled
 *
 * Sections:
 *  1. Trending Now        — repos sorted by 7d star velocity + sparklines
 *  2. Rising Stars        — repos < 6 months old, high velocity
 *  3. Ecosystem Health    — language cards with growth indicators
 *  4. Tech Radar          — trending topics/frameworks via TrendRadar component
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GitBranch, Star, TrendingUp, ExternalLink,
  ArrowUp, ArrowDown, Minus, Globe,
  Flame, Sparkles, Activity,
} from 'lucide-react';
import { api } from '@/utils/api';
import dynamic from 'next/dynamic';

// Lazy-load recharts-based chart components — recharts is ~200KB and only
// needed when the user actually visits this page (not on initial dashboard load).
const StarSparkline = dynamic(
  () => import('@/components/charts/StarSparkline').then(m => ({ default: m.StarSparkline })),
  { ssr: false, loading: () => <div className="h-8 w-24 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" /> },
)
const TrendRadar = dynamic(
  () => import('@/components/charts/TrendRadar').then(m => ({ default: m.TrendRadar })),
  { ssr: false, loading: () => <div className="h-64 bg-slate-100 dark:bg-slate-700 rounded-2xl animate-pulse" /> },
)

// ── Types ──────────────────────────────────────────────────────────────────────

interface Repo {
  id: string;
  full_name: string;
  url: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  stars_7d_delta: number;
  velocity_7d: number;
  trend_class: 'rising_star' | 'stable' | 'declining';
  is_rising_star: boolean;
  star_history: { date: string; stars: number }[];
  topics: string[];
}

interface EcosystemData {
  language: string;
  total_repos: number;
  total_stars: number;
  avg_velocity_7d: number;
  rising_star_count: number;
  top_repos: { full_name: string; url: string; stars: number; velocity_7d: number }[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LANGUAGES = ['All', 'Python', 'TypeScript', 'Rust', 'Go', 'JavaScript', 'Java', 'C++'];

const TREND_CONFIG = {
  rising_star: { icon: Flame,     color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30',  label: 'Rising Star' },
  stable:      { icon: Minus,     color: 'text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-800/40',    label: 'Stable'      },
  declining:   { icon: ArrowDown, color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950/30',        label: 'Declining'   },
};

const LANG_COLORS: Record<string, string> = {
  Python: '#3b82f6', TypeScript: '#f59e0b', Rust: '#f97316',
  Go: '#06b6d4', JavaScript: '#eab308', Java: '#ef4444', 'C++': '#8b5cf6',
};

const ECOSYSTEM_LANGS = ['Python', 'TypeScript', 'Rust', 'Go', 'JavaScript'];

// ── TrendBadge ─────────────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: keyof typeof TREND_CONFIG }) {
  const cfg = TREND_CONFIG[trend] ?? TREND_CONFIG.stable;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} />{cfg.label}
    </span>
  );
}

// ── VelocityBadge ──────────────────────────────────────────────────────────────

function VelocityBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const positive = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
      {positive ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {Math.abs(delta).toLocaleString()}
      <span className="font-normal text-[10px] text-slate-400 ml-0.5">7d</span>
    </span>
  );
}

// ── RepoCard ───────────────────────────────────────────────────────────────────

function RepoCard({ repo, rank }: { repo: Repo; rank: number }) {
  const langColor = LANG_COLORS[repo.language] || '#6366f1';
  return (
    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700/40 transition-all flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-bold text-slate-300 dark:text-slate-600 w-5 flex-shrink-0">#{rank}</span>
          <div className="min-w-0">
            <a href={repo.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100 text-sm hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              <GitBranch size={13} className="flex-shrink-0 text-slate-400" />
              <span className="truncate">{repo.full_name}</span>
              <ExternalLink size={11} className="flex-shrink-0 text-slate-300 dark:text-slate-600" />
            </a>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
              {repo.description || 'No description'}
            </p>
          </div>
        </div>
        <TrendBadge trend={repo.trend_class} />
      </div>

      {/* Sparkline */}
      {repo.star_history?.length > 1 && (
        <div className="h-10">
          <StarSparkline data={repo.star_history} color={langColor} />
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><Star size={11} className="text-amber-400" />{repo.stars.toLocaleString()}</span>
        <span className="flex items-center gap-1"><GitBranch size={11} />{repo.forks.toLocaleString()}</span>
        {repo.language && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor }} />
            {repo.language}
          </span>
        )}
        <VelocityBadge delta={repo.stars_7d_delta} />
        <span className="text-[11px] text-slate-400">
          {repo.velocity_7d > 0 ? '+' : ''}{repo.velocity_7d.toFixed(1)} ★/day
        </span>
      </div>

      {/* Topics */}
      {repo.topics?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {repo.topics.slice(0, 4).map(t => (
            <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ecosystem card ─────────────────────────────────────────────────────────────

function EcosystemCard({ language }: { language: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['github-ecosystem', language],
    queryFn:  () => api.get(`/repos/ecosystem/${language}/`).then(r => r.data?.data as EcosystemData),
    staleTime: 5 * 60_000, retry: false,
  });
  const color = LANG_COLORS[language] || '#6366f1';

  if (isLoading) return <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl h-36 animate-pulse" />;
  if (!data) return null;

  const growthPositive = data.avg_velocity_7d >= 0;

  return (
    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{language}</h3>
        </div>
        <span className={`text-xs font-semibold flex items-center gap-0.5 ${growthPositive ? 'text-emerald-500' : 'text-red-500'}`}>
          {growthPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(data.avg_velocity_7d).toFixed(1)} ★/day avg
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div>
          <div className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{data.total_repos.toLocaleString()}</div>
          <div>Repositories</div>
        </div>
        <div>
          <div className="font-semibold text-orange-500 text-sm">{data.rising_star_count}</div>
          <div className="flex items-center gap-1"><Flame size={10} /> Rising Stars</div>
        </div>
      </div>
      {data.top_repos?.[0] && (
        <a href={data.top_repos[0].url} target="_blank" rel="noopener noreferrer"
          className="mt-3 flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline truncate">
          <Star size={10} className="text-amber-400 flex-shrink-0" />
          <span className="truncate">{data.top_repos[0].full_name}</span>
          <span className="text-slate-400 flex-shrink-0">+{data.top_repos[0].velocity_7d.toFixed(1)}/d</span>
        </a>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const PAGE_STEP = 12; // how many repos to reveal per scroll

export default function GitHubPage() {
  const [language, setLanguage] = useState('All');
  const [section, setSection]   = useState<'trending' | 'rising'>('trending');
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data: trendingData, isLoading } = useQuery({
    queryKey: ['github-trending-velocity', language],
    queryFn:  () => api.get('/repos/trending-velocity/', {
      params: language !== 'All' ? { language } : {},
    }).then(r => r.data?.data as Repo[]),
    staleTime: 2 * 60_000,
  });

  const repos       = trendingData ?? [];
  const risingStars = repos.filter(r => r.is_rising_star);
  const allDisplayRepos = section === 'rising' ? risingStars : repos;
  const displayRepos = allDisplayRepos.slice(0, visibleCount);
  const hasMore = visibleCount < allDisplayRepos.length;

  // Reset visible count when filter/section changes
  useEffect(() => { setVisibleCount(PAGE_STEP); }, [language, section]);

  // IntersectionObserver to auto-reveal more repos
  const observerRef = useRef<IntersectionObserver | null>(null);
  const setSentinel = useCallback((node: HTMLDivElement | null) => {
    sentinelRef.current = node;
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(c => c + PAGE_STEP);
        }
      },
      { rootMargin: '300px' },
    );
    observerRef.current.observe(node);
  }, []);
  useEffect(() => () => { observerRef.current?.disconnect(); }, []);

  const radarData = React.useMemo(() => {
    const topicCount: Record<string, number> = {};
    for (const r of repos) for (const t of (r.topics || [])) topicCount[t] = (topicCount[t] || 0) + 1;
    return Object.entries(topicCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([name, count]) => ({ topic: name, score: Math.min(count * 8, 100) }));
  }, [repos]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="pb-12">

        {/* ── Header ── */}
        <div className="px-6 pt-8 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <GitBranch size={28} className="text-emerald-500" />
                GitHub Intelligence
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                Real-time star velocity, rising stars, and ecosystem health — updated daily at 04:00 UTC.
              </p>
            </div>
            {!isLoading && repos.length > 0 && (
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="font-bold text-slate-800 dark:text-slate-100">{repos.length}</div>
                  <div className="text-xs text-slate-400">Tracked</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-orange-500">{risingStars.length}</div>
                  <div className="text-xs text-slate-400">Rising Stars</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-emerald-500">
                    +{repos.slice(0, 10).reduce((s, r) => s + Math.max(0, r.stars_7d_delta), 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400">Stars 7d (top 10)</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 mt-6 space-y-10">

          {/* ── Trending Now / Rising Stars ── */}
          <section>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                {(['trending', 'rising'] as const).map(s => (
                  <button key={s} onClick={() => setSection(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      section === s
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {s === 'trending' ? <><TrendingUp size={14} /> Trending Now</> : (
                      <><Flame size={14} className="text-orange-500" /> Rising Stars
                        {risingStars.length > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 text-[10px] font-bold">
                            {risingStars.length}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {LANGUAGES.map(lang => (
                  <button key={lang} onClick={() => setLanguage(lang)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      language === lang
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}>
                    {lang !== 'All' && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: LANG_COLORS[lang] || '#6366f1' }} />}
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-2xl h-48 animate-pulse" />)}
              </div>
            ) : displayRepos.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Sparkles size={40} className="mx-auto mb-4 opacity-30" />
                <p className="font-medium">{section === 'rising' ? 'No rising stars yet' : 'No repos found'}</p>
                <p className="text-sm mt-1">Star velocity is computed daily at 04:00 UTC.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayRepos.map((repo, i) => <RepoCard key={repo.id} repo={repo} rank={i + 1} />)}
                </div>
                {/* Infinite reveal sentinel */}
                <div ref={setSentinel} className="flex justify-center py-8">
                  {hasMore ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      Loading more repos…
                    </div>
                  ) : allDisplayRepos.length > 0 ? (
                    <p className="text-slate-400 text-sm">✅ All {allDisplayRepos.length} repos shown</p>
                  ) : null}
                </div>
              </>
            )}
          </section>

          {/* ── Ecosystem Health ── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Globe size={18} className="text-cyan-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Ecosystem Health</h2>
              <span className="text-xs text-slate-400 ml-1">language growth indicators</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {ECOSYSTEM_LANGS.map(lang => <EcosystemCard key={lang} language={lang} />)}
            </div>
          </section>

          {/* ── Tech Radar ── */}
          {radarData.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-violet-500" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tech Radar</h2>
                <span className="text-xs text-slate-400 ml-1">trending topics across all repos</span>
              </div>
              <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6">
                <TrendRadar data={radarData} />
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
