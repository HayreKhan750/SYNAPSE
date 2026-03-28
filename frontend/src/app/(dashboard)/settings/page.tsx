'use client'

/**
 * /settings — App settings page
 * Covers: notifications, theme, API keys, account danger zone, MFA
 */

import React, { useState } from 'react'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/store/authStore'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import {
  Settings,
  Bell,
  Palette,
  Key,
  Shield,
  Trash2,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  Save,
  Loader2,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react'

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">{icon}</div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          checked ? 'bg-indigo-600' : 'bg-slate-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

// ── Change Password form ──────────────────────────────────────────────────────

function ChangePasswordForm() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.new_password !== form.confirm_password) {
      toast.error('New passwords do not match.')
      return
    }
    if (form.new_password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      await api.post('/users/change-password/', {
        current_password: form.current_password,
        new_password: form.new_password,
      })
      toast.success('Password updated!')
      setForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data?.error
        ?? (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Failed to update password.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {(['current_password', 'new_password', 'confirm_password'] as const).map(field => (
        <div key={field}>
          <label className="block text-xs font-medium text-slate-400 mb-1 capitalize">
            {field.replace(/_/g, ' ')}
          </label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={form[field]}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
      ))}
      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Update Password
      </button>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { logout } = useAuthStore()
  const router = useRouter()

  // Notification prefs (stored locally for MVP — can be persisted via API)
  const [notifPrefs, setNotifPrefs] = useState({
    email_on_workflow_complete: true,
    email_on_agent_complete: true,
    in_app_notifications: true,
    weekly_digest: false,
  })

  // API key visibility
  const [showKey, setShowKey] = useState(false)
  const [apiKey] = useState('sk-synapse-demo-key-xxxxxxxx') // placeholder

  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      toast.error('Type DELETE to confirm.')
      return
    }
    setDeletingAccount(true)
    try {
      await api.delete('/users/account/')
      logout()
      router.push('/login')
      toast.success('Account deleted.')
    } catch {
      toast.error('Failed to delete account. Contact support.')
      setDeletingAccount(false)
    }
  }

  const themeOptions = [
    { value: 'system', icon: Monitor, label: 'System' },
    { value: 'light',  icon: Sun,     label: 'Light'  },
    { value: 'dark',   icon: Moon,    label: 'Dark'   },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24 lg:pb-8 space-y-6">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30">
            <Settings size={24} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-slate-400 text-sm">Manage your preferences and account</p>
          </div>
        </div>

        {/* Appearance */}
        <Section title="Appearance" icon={<Palette size={16} />}>
          <div>
            <p className="text-sm font-medium text-white mb-3">Theme</p>
            <div className="flex gap-3 flex-wrap">
              {themeOptions.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    theme === value
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={<Bell size={16} />}>
          <div className="space-y-5 divide-y divide-slate-800">
            <Toggle
              label="Email on workflow complete"
              description="Receive an email when an automation workflow finishes"
              checked={notifPrefs.email_on_workflow_complete}
              onChange={v => setNotifPrefs(p => ({ ...p, email_on_workflow_complete: v }))}
            />
            <div className="pt-4">
              <Toggle
                label="Email on agent task complete"
                description="Receive an email when an AI agent task finishes"
                checked={notifPrefs.email_on_agent_complete}
                onChange={v => setNotifPrefs(p => ({ ...p, email_on_agent_complete: v }))}
              />
            </div>
            <div className="pt-4">
              <Toggle
                label="In-app notifications"
                description="Show real-time notifications in the sidebar bell"
                checked={notifPrefs.in_app_notifications}
                onChange={v => setNotifPrefs(p => ({ ...p, in_app_notifications: v }))}
              />
            </div>
            <div className="pt-4">
              <Toggle
                label="Weekly digest"
                description="Get a weekly summary of top tech trends in your inbox"
                checked={notifPrefs.weekly_digest}
                onChange={v => setNotifPrefs(p => ({ ...p, weekly_digest: v }))}
              />
            </div>
          </div>
          <button
            onClick={() => toast.success('Notification preferences saved!')}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium"
          >
            <Save size={14} /> Save Preferences
          </button>
        </Section>

        {/* Security */}
        <Section title="Security" icon={<Shield size={16} />}>
          <ChangePasswordForm />

          <div className="pt-4 border-t border-slate-800">
            <p className="text-sm font-medium text-white mb-1">Multi-Factor Authentication</p>
            <p className="text-xs text-slate-500 mb-3">Add an extra layer of security to your account</p>
            <a
              href="/mfa/setup/"
              className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Set up MFA <ChevronRight size={14} />
            </a>
          </div>
        </Section>

        {/* API Key */}
        <Section title="API Access" icon={<Key size={16} />}>
          <p className="text-sm text-slate-400">Use this key to access the SYNAPSE API from external apps.</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 font-mono text-sm text-slate-300 overflow-x-auto">
              {showKey ? apiKey : '•'.repeat(apiKey.length)}
            </div>
            <button
              onClick={() => setShowKey(s => !s)}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(apiKey); toast.success('API key copied!') }}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0 text-xs font-medium px-3"
            >
              Copy
            </button>
          </div>
        </Section>

        {/* Sign out */}
        <Section title="Session" icon={<LogOut size={16} />}>
          <p className="text-sm text-slate-400">Sign out of your current session on this device.</p>
          <button
            onClick={() => { logout(); router.push('/login') }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </Section>

        {/* Danger zone */}
        <Section title="Danger Zone" icon={<Trash2 size={16} />}>
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
            <p className="text-sm font-medium text-red-400 mb-1">Delete Account</p>
            <p className="text-xs text-slate-400 mb-4">
              This will permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <div className="space-y-3">
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                className="w-full bg-slate-800 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirm !== 'DELETE'}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors font-medium"
              >
                {deletingAccount ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete My Account
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
