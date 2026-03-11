'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, FileText, GitBranch, BookOpen, Loader2 } from 'lucide-react'
import api from '@/utils/api'
import { useDebounce } from '@/hooks/useDebounce'
import { ArticleCard } from '@/components/cards/ArticleCard'
import { RepositoryCard } from '@/components/cards/RepositoryCard'
import { PaperCard } from '@/components/cards/PaperCard'
import { cn } from '@/utils/helpers'

type TabType = 'all' | 'articles' | 'repos' | 'papers'

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'articles', label: 'Articles', icon: FileText },
  { id: 'repos', label: 'Repositories', icon: GitBranch },
  { id: 'papers', label: 'Papers', icon: BookOpen },
]

export default function SearchPage() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams?.get('q') || ''
  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const debouncedQuery = useDebounce(query, 300)

  // Sync URL param changes to input
  useEffect(() => {
    setQuery(searchParams?.get('q') || '')
  }, [searchParams])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () =>
      api
        .get('/search/', { params: { q: debouncedQuery, limit: 20 } })
        .then(r => r.data),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  const articles = data?.data?.articles || []
  const repos = data?.data?.repos || []
  const papers = data?.data?.papers || []
  const total = data?.meta?.total || 0

  const showLoading = (isLoading || isFetching) && debouncedQuery.length >= 2

  const renderResults = () => {
    if (debouncedQuery.length < 2) {
      return (
        <div className="text-center py-24">
          <Search size={48} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-lg">Type at least 2 characters to search</p>
        </div>
      )
    }
    if (showLoading) {
      return (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
        </div>
      )
    }
    if (total === 0) {
      return (
        <div className="text-center py-24">
          <Search size={48} className="mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-lg">No results for &quot;{debouncedQuery}&quot;</p>
          <p className="text-slate-500 text-sm mt-2">Try different keywords or broaden your search</p>
        </div>
      )
    }

    return (
      <div className="space-y-10">
        {/* Articles */}
        {(activeTab === 'all' || activeTab === 'articles') && articles.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText size={18} className="text-indigo-400" />
              Articles
              <span className="text-sm text-slate-500 font-normal">({articles.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {articles.map((article: any) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </section>
        )}

        {/* Repositories */}
        {(activeTab === 'all' || activeTab === 'repos') && repos.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <GitBranch size={18} className="text-emerald-400" />
              Repositories
              <span className="text-sm text-slate-500 font-normal">({repos.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {repos.map((repo: any) => (
                <RepositoryCard key={repo.id} repo={repo} />
              ))}
            </div>
          </section>
        )}

        {/* Papers */}
        {(activeTab === 'all' || activeTab === 'papers') && papers.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-violet-400" />
              Research Papers
              <span className="text-sm text-slate-500 font-normal">({papers.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {papers.map((paper: any) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Search</h1>
        <p className="text-slate-400 mt-1 text-sm">Search across articles, repositories, and research papers</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
        {showLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" size={18} />
        )}
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search articles, papers, repositories..."
          autoFocus
          className="w-full pl-12 pr-12 py-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg"
        />
      </div>

      {/* Results summary + Tabs */}
      {debouncedQuery.length >= 2 && !showLoading && total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-slate-400 text-sm">
            <span className="text-white font-semibold">{total}</span> results for{' '}
            <span className="text-indigo-400">&quot;{debouncedQuery}&quot;</span>
          </p>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <tab.icon size={14} />
                {tab.label}
                {tab.id !== 'all' && (
                  <span className="text-xs opacity-70">
                    ({tab.id === 'articles' ? articles.length : tab.id === 'repos' ? repos.length : papers.length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {renderResults()}
    </div>
    </div>
  )
}
