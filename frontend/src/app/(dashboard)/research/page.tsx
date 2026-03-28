'use client';

import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, ChevronDown, Search, Sparkles, Brain, X,
  FileText, Loader2, ExternalLink, Copy, CheckCircle2,
  TrendingUp, BarChart2, Layers, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/utils/api';
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
const SORT_OPTIONS = ['Date', 'Citations', 'Difficulty'];

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

      const response = await fetch('/api/v1/documents/generate-stream/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          doc_type: 'markdown',
          title: `Research Synthesis: ${q.slice(0, 60)}`,
          prompt: `You are a senior research analyst. Based on the following ${papers.length} research papers, ${q}\n\nPapers:\n${paperContext}`,
          model: 'openai/gpt-4o-mini',
        }),
      });

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.step === 'generating' || evt.step === 'sections_ready') {
              setResult(`✨ Generating synthesis…\n\n${evt.message}`);
            }
            if (evt.done && evt.document) {
              // Fetch the markdown content from the generated file
              try {
                const dl = await api.get(
                  evt.document.download_url
                    .replace(/^https?:\/\/[^/]+/, '')
                    .replace(/^\/api\/v1/, ''),
                  { responseType: 'text' }
                );
                // Strip YAML front-matter for display
                let md = dl.data as string;
                if (md.startsWith('---')) {
                  const end = md.indexOf('---', 3);
                  if (end > 0) md = md.slice(end + 3).trim();
                }
                setResult(md);
              } catch {
                setResult(`Synthesis complete. ${evt.document.title}`);
              }
            }
          } catch { /* ignore */ }
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
      <div className="flex items-center justify-between p-5 bg-gradient-to-r from-indigo-600 to-violet-600">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">AI Research Synthesis</h2>
            <p className="text-xs text-indigo-200">
              {papers.length > 0 ? `${Math.min(papers.length, 8)} papers in context` : 'Load papers to analyse'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {papers.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
              {papers.length} papers
            </span>
          )}
        </div>
      </div>

      {/* Prompt suggestions */}
      <div className="p-4 border-b border-indigo-100 dark:border-indigo-800/50">
        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Quick analyses:</p>
        <div className="flex flex-wrap gap-2">
          {SYNTHESIS_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => { setQuery(p); handleSynthesize(p); }}
              disabled={streaming || papers.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/60 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {p.slice(0, 45)}…
            </button>
          ))}
        </div>
      </div>

      {/* Custom query input */}
      <div className="p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSynthesize()}
            placeholder="Ask anything about these papers… (press Enter)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={streaming || papers.length === 0}
          />
        </div>
        <button
          onClick={() => handleSynthesize()}
          disabled={streaming || !query.trim() || papers.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {streaming ? 'Synthesising…' : 'Analyse'}
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
                className="prose prose-sm dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-h-72 overflow-y-auto rounded-lg bg-white dark:bg-gray-900 p-4 border border-gray-100 dark:border-gray-700 whitespace-pre-wrap font-mono text-xs"
              >
                {result || 'Generating synthesis…'}
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
  const categories     = Array.from(new Set(papers.map((p: any) => p.category).filter(Boolean)));
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
  const [sortBy,                setSortBy]                = useState('Date');
  const [showCategoryDropdown,  setShowCategoryDropdown]  = useState(false);
  const [showSortDropdown,      setShowSortDropdown]      = useState(false);
  const [page,                  setPage]                  = useState(1);
  const [searchQuery,           setSearchQuery]           = useState('');
  const [searchInput,           setSearchInput]           = useState('');

  const difficultyParam = selectedDifficulty === 'All' ? undefined : selectedDifficulty.toLowerCase();

  const getSortOrdering = () => {
    switch (sortBy) {
      case 'Citations':  return '-citation_count';
      case 'Difficulty': return 'difficulty_level';
      default:           return '-published_date';
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['papers', difficultyParam, selectedCategory, sortBy, page, searchQuery],
    queryFn: () =>
      api.get('/papers/', {
        params: {
          page,
          difficulty_level:  difficultyParam,
          category:          selectedCategory || undefined,
          ordering:          getSortOrdering(),
          search:            searchQuery || undefined,
        },
      }).then(r => r.data),
  });

  const papers     = Array.isArray(data?.data) ? data.data
                   : Array.isArray(data?.results) ? data.results
                   : Array.isArray(data) ? data : [];
  const totalCount = data?.meta?.total || data?.count || 0;

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setSelectedDifficulty('All');
    setSelectedCategory('');
    setSortBy('Date');
    setSearchQuery('');
    setSearchInput('');
    setPage(1);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6 pb-12">

        {/* ── Hero Header ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-12 w-32 h-32 rounded-full bg-white" />
            <div className="absolute bottom-0 left-24 w-48 h-48 rounded-full bg-white" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-5 h-5 text-indigo-200" />
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest">SYNAPSE AI</span>
            </div>
            <h1 className="text-4xl font-extrabold mb-2">Research Explorer</h1>
            <p className="text-indigo-200 text-lg max-w-xl">
              Discover, analyse, and synthesise cutting-edge research papers with AI-powered insights.
            </p>
          </div>
        </div>

        {/* ── Search Bar ──────────────────────────────────────────── */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search papers by title, author, or keyword…"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
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
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition shadow-sm"
          >
            <Search className="w-4 h-4" /> Search
          </button>
        </div>

        {/* ── Stats Bar ───────────────────────────────────────────── */}
        <StatsBar papers={papers} />

        {/* ── AI Synthesis Panel ──────────────────────────────────── */}
        <AISynthesisPanel papers={papers} />

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
                  onClick={() => { setSelectedDifficulty(d); setPage(1); }}
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
          <div className="flex flex-wrap gap-4 items-end">
            {/* Category */}
            <div className="relative flex-1 min-w-[180px]">
              <p className="text-xs text-gray-500 mb-2 font-medium">Category</p>
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-between bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-300 transition"
              >
                <span>{selectedCategory ? CATEGORY_LABELS[selectedCategory] || selectedCategory : 'All Categories'}</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', showCategoryDropdown && 'rotate-180')} />
              </button>
              {showCategoryDropdown && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 max-h-56 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedCategory(''); setShowCategoryDropdown(false); setPage(1); }}
                    className={cn('w-full text-left px-4 py-2.5 text-sm transition rounded-t-xl',
                      !selectedCategory ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50')}
                  >
                    All Categories
                  </button>
                  {ARXIV_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); setPage(1); }}
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
            <div className="relative">
              <p className="text-xs text-gray-500 mb-2 font-medium">Sort by</p>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-300 transition"
              >
                {sortBy}
                <ChevronDown className={cn('w-4 h-4 transition-transform', showSortDropdown && 'rotate-180')} />
              </button>
              {showSortDropdown && (
                <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 min-w-[140px]">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setSortBy(opt); setShowSortDropdown(false); setPage(1); }}
                      className={cn('w-full text-left px-4 py-2.5 text-sm transition first:rounded-t-xl last:rounded-b-xl',
                        sortBy === opt ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50')}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear filters */}
            {(searchQuery || selectedDifficulty !== 'All' || selectedCategory || sortBy !== 'Date') && (
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
            {papers.length < totalCount && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition shadow-sm"
                >
                  Load More Papers
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No papers found</p>
            <button onClick={clearFilters} className="mt-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
