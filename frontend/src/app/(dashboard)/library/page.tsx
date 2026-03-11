'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookMarked, FolderPlus, Trash2, FileText, GitBranch, BookOpen, Loader2, Plus, X } from 'lucide-react'
import api from '@/utils/api'
import { cn } from '@/utils/helpers'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

type ContentTab = 'all' | 'article' | 'repository' | 'researchpaper'

const contentTabs = [
  { id: 'all' as ContentTab, label: 'All', icon: BookMarked },
  { id: 'article' as ContentTab, label: 'Articles', icon: FileText },
  { id: 'repository' as ContentTab, label: 'Repos', icon: GitBranch },
  { id: 'researchpaper' as ContentTab, label: 'Papers', icon: BookOpen },
]

function NewCollectionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.post('/collections/', { name, description, is_public: isPublic }).then(r => r.data),
    onSuccess: () => {
      toast.success('Collection created!', { style: { background: '#1e293b', color: '#f1f5f9' } })
      onCreated()
      onClose()
    },
    onError: () => {
      toast.error('Failed to create collection', { style: { background: '#1e293b', color: '#f1f5f9' } })
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">New Collection</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. AI Papers, Rust Resources..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this collection about?"
              rows={2}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIsPublic(!isPublic)}
              className={cn(
                'w-10 h-5 rounded-full transition-colors relative',
                isPublic ? 'bg-indigo-600' : 'bg-slate-700'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                isPublic ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </div>
            <span className="text-sm text-slate-300">Make public</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors text-sm">
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={!name.trim() || isPending}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg text-white transition-colors text-sm font-medium"
          >
            {isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<ContentTab>('all')
  const [showNewCollection, setShowNewCollection] = useState(false)
  const queryClient = useQueryClient()

  const { data: bookmarksData, isLoading: bookmarksLoading } = useQuery({
    queryKey: ['bookmarks', activeTab],
    queryFn: () =>
      api.get('/bookmarks/', {
        params: activeTab !== 'all' ? { type: activeTab } : {},
      }).then(r => r.data),
  })

  const { data: collectionsData, isLoading: collectionsLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => api.get('/collections/').then(r => r.data),
  })

  const { mutate: deleteBookmark } = useMutation({
    mutationFn: (bookmark: any) =>
      api.post(`/bookmarks/${bookmark.content_type_name}/${bookmark.object_id}/`).then(r => r.data),
    onSuccess: () => {
      toast.success('Bookmark removed', { style: { background: '#1e293b', color: '#f1f5f9' } })
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
    },
  })

  const { mutate: deleteCollection } = useMutation({
    mutationFn: (id: string) => api.delete(`/collections/${id}/`).then(r => r.data),
    onSuccess: () => {
      toast.success('Collection deleted', { style: { background: '#1e293b', color: '#f1f5f9' } })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const bookmarks = bookmarksData?.data || []
  const collections = collectionsData?.data || []

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'article': return <FileText size={14} className="text-indigo-400" />
      case 'repository': return <GitBranch size={14} className="text-emerald-400" />
      case 'researchpaper': return <BookOpen size={14} className="text-violet-400" />
      default: return <BookMarked size={14} className="text-slate-400" />
    }
  }

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      article: 'bg-indigo-900/50 text-indigo-300',
      repository: 'bg-emerald-900/50 text-emerald-300',
      researchpaper: 'bg-violet-900/50 text-violet-300',
    }
    const labels: Record<string, string> = {
      article: 'Article',
      repository: 'Repo',
      researchpaper: 'Paper',
    }
    return (
      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', styles[type] || 'bg-slate-700 text-slate-300')}>
        {labels[type] || type}
      </span>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Knowledge Library</h1>
          <p className="text-slate-400 mt-1 text-sm">Your saved articles, repos, and papers</p>
        </div>
        <button
          onClick={() => setShowNewCollection(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm font-medium transition-colors"
        >
          <FolderPlus size={16} />
          New Collection
        </button>
      </div>

      {/* Collections */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FolderPlus size={18} className="text-cyan-400" />
          Collections
          <span className="text-sm text-slate-500 font-normal">({collections.length})</span>
        </h2>
        {collectionsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-400" /></div>
        ) : collections.length === 0 ? (
          <div className="text-center py-10 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <FolderPlus size={32} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No collections yet</p>
            <button
              onClick={() => setShowNewCollection(true)}
              className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mx-auto"
            >
              <Plus size={14} /> Create your first collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {collections.map((col: any) => (
                <motion.div
                  key={col.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">{col.name}</h3>
                      {col.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{col.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteCollection(col.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all ml-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-slate-500">{col.bookmark_count} items</span>
                    {col.is_public && (
                      <span className="text-xs bg-cyan-900/40 text-cyan-400 px-2 py-0.5 rounded-full">Public</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {/* Add new collection card */}
            <button
              onClick={() => setShowNewCollection(true)}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-600 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-indigo-400 transition-colors min-h-[100px]"
            >
              <Plus size={20} />
              <span className="text-sm">New Collection</span>
            </button>
          </div>
        )}
      </section>

      {/* Bookmarks */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BookMarked size={18} className="text-rose-400" />
            Bookmarks
            <span className="text-sm text-slate-500 font-normal">({bookmarks.length})</span>
          </h2>
          {/* Type filter tabs */}
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
            {contentTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {bookmarksLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-400" /></div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <BookMarked size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No bookmarks yet</p>
            <p className="text-slate-500 text-sm mt-1">
              Click the ♡ on any article, repo, or paper to save it here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {bookmarks.map((bookmark: any) => (
                <motion.div
                  key={bookmark.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-4 p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors group"
                >
                  <div className="flex-shrink-0">{getTypeIcon(bookmark.content_type_name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getTypeBadge(bookmark.content_type_name)}
                      <span className="text-xs text-slate-500">
                        {new Date(bookmark.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <a
                      href={bookmark.content_object_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-white hover:text-indigo-300 transition-colors truncate block"
                    >
                      {bookmark.content_object_title || 'Untitled'}
                    </a>
                    {bookmark.notes && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{bookmark.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteBookmark(bookmark)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-all flex-shrink-0"
                    title="Remove bookmark"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* New Collection Modal */}
      <AnimatePresence>
        {showNewCollection && (
          <NewCollectionModal
            onClose={() => setShowNewCollection(false)}
            onCreated={() => queryClient.invalidateQueries({ queryKey: ['collections'] })}
          />
        )}
      </AnimatePresence>
    </div>
    </div>
  )
}
