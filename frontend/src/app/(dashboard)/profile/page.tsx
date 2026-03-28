'use client'

/**
 * /profile — User profile page
 * Shows avatar, name, email, bio, stats and lets the user update their info.
 */

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import {
  User,
  Mail,
  Calendar,
  BookOpen,
  Bookmark,
  MessageSquare,
  FileText,
  Edit3,
  Save,
  X,
  Loader2,
  Shield,
  TrendingUp,
} from 'lucide-react'

interface ProfileStats {
  articles_bookmarked: number
  papers_bookmarked: number
  repos_bookmarked: number
  chat_sessions: number
  documents_generated: number
  agent_tasks: number
}

interface ProfileData {
  id: string
  username: string
  first_name: string
  last_name: string
  email: string
  bio: string
  date_joined: string
  subscription_plan: string
  stats: ProfileStats
}

function StatCard({ icon, label, value, colour }: { icon: React.ReactNode; label: string; value: number; colour: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colour}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', bio: '' })

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/users/profile/')
        const p: ProfileData = data?.data ?? data
        setProfile(p)
        setForm({ first_name: p.first_name || '', last_name: p.last_name || '', bio: p.bio || '' })
      } catch {
        toast.error('Failed to load profile.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await api.patch('/users/profile/', form)
      const updated: ProfileData = data?.data ?? data
      setProfile(updated)
      if (setUser) setUser({ ...user, ...form })
      toast.success('Profile updated!')
      setEditing(false)
    } catch {
      toast.error('Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const initials = profile
    ? (profile.first_name?.[0] ?? '') + (profile.last_name?.[0] ?? '') || profile.username?.[0]?.toUpperCase() || '?'
    : '?'

  const planBadge: Record<string, string> = {
    free: 'bg-slate-700 text-slate-300',
    pro: 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40',
    enterprise: 'bg-amber-600/30 text-amber-300 border border-amber-500/40',
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24 lg:pb-8">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30">
            <User size={24} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">My Profile</h1>
            <p className="text-slate-400 text-sm">Manage your account details and preferences</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 size={28} className="animate-spin mr-3" /> Loading profile…
          </div>
        ) : !profile ? (
          <div className="text-center py-20 text-slate-400">
            <User size={48} className="mx-auto mb-3 opacity-30" />
            <p>Could not load profile. Please refresh.</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Avatar + info card */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
              <div className="flex items-start gap-5 flex-wrap">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                  <span className="text-white font-black text-2xl">{initials}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {editing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">First Name</label>
                          <input
                            value={form.first_name}
                            onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Last Name</label>
                          <input
                            value={form.last_name}
                            onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Bio</label>
                        <textarea
                          value={form.bio}
                          onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                          rows={3}
                          placeholder="Tell us about yourself…"
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
                        >
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditing(false)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h2 className="text-xl font-bold text-white">
                          {profile.first_name} {profile.last_name}
                        </h2>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${planBadge[profile.subscription_plan] ?? planBadge.free}`}>
                          {profile.subscription_plan}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mb-1">@{profile.username}</p>
                      {profile.bio && <p className="text-slate-300 text-sm mb-3">{profile.bio}</p>}
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-4">
                        <span className="flex items-center gap-1.5">
                          <Mail size={13} className="text-slate-600" />
                          {profile.email}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-600" />
                          Joined {new Date(profile.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                      >
                        <Edit3 size={14} /> Edit Profile
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            {profile.stats && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-indigo-400" />
                  Activity Stats
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard icon={<Bookmark size={16} className="text-amber-400" />} label="Bookmarks" value={(profile.stats.articles_bookmarked || 0) + (profile.stats.papers_bookmarked || 0) + (profile.stats.repos_bookmarked || 0)} colour="bg-amber-500/10" />
                  <StatCard icon={<MessageSquare size={16} className="text-sky-400" />} label="Chat Sessions" value={profile.stats.chat_sessions || 0} colour="bg-sky-500/10" />
                  <StatCard icon={<FileText size={16} className="text-violet-400" />} label="Documents" value={profile.stats.documents_generated || 0} colour="bg-violet-500/10" />
                  <StatCard icon={<BookOpen size={16} className="text-emerald-400" />} label="Papers Bookmarked" value={profile.stats.papers_bookmarked || 0} colour="bg-emerald-500/10" />
                  <StatCard icon={<Shield size={16} className="text-indigo-400" />} label="Agent Tasks" value={profile.stats.agent_tasks || 0} colour="bg-indigo-500/10" />
                </div>
              </div>
            )}

            {/* Account info */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Account Information</h3>
              <div className="space-y-3">
                {[
                  { label: 'Username', value: profile.username },
                  { label: 'Email', value: profile.email },
                  { label: 'Plan', value: profile.subscription_plan?.charAt(0).toUpperCase() + profile.subscription_plan?.slice(1) },
                  { label: 'Member since', value: new Date(profile.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                    <span className="text-sm text-slate-400">{label}</span>
                    <span className="text-sm text-white font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
