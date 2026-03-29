'use client'

/**
 * /settings — App settings page
 * Covers: notifications, theme, API keys, account danger zone, MFA
 */

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/store/authStore'
import api from '@/utils/api'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { GoogleDriveSection } from './GoogleDriveSection'
import { MFASection } from './MFASection'
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
  Cpu,
} from 'lucide-react'

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">{icon}</div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-white">{title}</h2>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-white">{label}</p>
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

// ── AI Keys form ──────────────────────────────────────────────────────────────

function AiKeysForm() {
  const [geminiKey, setGeminiKey]       = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [showGemini, setShowGemini]     = useState(false);
  const [showOpenrouter, setShowOpenrouter] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [loaded, setLoaded]             = useState(false);

  const [geminiConfigured, setGeminiConfigured]         = useState(false);
  const [openrouterConfigured, setOpenrouterConfigured] = useState(false);

  useEffect(() => {
    // Load masked key status from backend — always refetch fresh on mount
    const controller = new AbortController();
    api.get('/users/ai-keys/', { signal: controller.signal }).then(({ data }) => {
      setGeminiConfigured(!!data.gemini_configured);
      setOpenrouterConfigured(!!data.openrouter_configured);
      // Only set bullets if key is configured AND user hasn't started typing
      setGeminiKey(data.gemini_configured ? '••••••••••••••••' : '');
      setOpenrouterKey(data.openrouter_configured ? '••••••••••••••••' : '');
      setLoaded(true);
    }).catch((e) => { if (!axios.isCancel(e)) setLoaded(true); });
    return () => controller.abort();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (geminiKey && !geminiKey.startsWith('•'))     payload.gemini_api_key = geminiKey;
      if (openrouterKey && !openrouterKey.startsWith('•')) payload.openrouter_api_key = openrouterKey;
      if (!Object.keys(payload).length) { toast.error('No new keys to save.'); setSaving(false); return; }
      await api.post('/users/ai-keys/', payload);
      toast.success('AI keys saved! Chat, Agent, Documents & Automation now use your keys.');
      if (payload.gemini_api_key)     { setGeminiKey('••••••••••••••••');     setGeminiConfigured(true); }
      if (payload.openrouter_api_key) { setOpenrouterKey('••••••••••••••••'); setOpenrouterConfigured(true); }
    } catch {
      toast.error('Failed to save keys.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 pr-10 text-sm text-slate-800 dark:text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  if (!loaded) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-48 bg-slate-700 rounded" />
      <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      <div className="h-4 w-48 bg-slate-700 rounded" />
      <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      <div className="h-9 w-32 bg-indigo-900/50 rounded-lg" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Gemini */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-2">
          Google Gemini API Key
          <span className="text-indigo-400 text-xs font-normal">gemini-1.5-flash / gemini-2.0</span>
          {loaded && (geminiConfigured
            ? <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 font-semibold">✓ Saved</span>
            : <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">Not set</span>
          )}
        </label>
        <div className="relative">
          <input
            type={showGemini ? 'text' : 'password'}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza..."
            className={fieldClass}
          />
          <button type="button" onClick={() => setShowGemini(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showGemini ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Get from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>
        </p>
      </div>

      {/* OpenRouter */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-2">
          OpenRouter API Key
          <span className="text-violet-400 text-xs font-normal">Fallback / GPT-4o / Claude</span>
          {loaded && (openrouterConfigured
            ? <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 font-semibold">✓ Saved</span>
            : <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">Not set</span>
          )}
        </label>
        <div className="relative">
          <input
            type={showOpenrouter ? 'text' : 'password'}
            value={openrouterKey}
            onChange={(e) => setOpenrouterKey(e.target.value)}
            placeholder="sk-or-..."
            className={fieldClass}
          />
          <button type="button" onClick={() => setShowOpenrouter(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showOpenrouter ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Get from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">OpenRouter</a> — 200+ models available
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Save API Keys
      </button>
    </div>
  );
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
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 pr-10 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24 lg:pb-8 space-y-6">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 shrink-0">
            <Settings size={20} className="text-indigo-400 sm:size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">Settings</h1>
            <p className="text-slate-400 text-xs sm:text-sm">Manage your preferences and account</p>
          </div>
        </div>

        {/* Integrations */}
        <Section title="Integrations" icon={<Settings size={16} />}>
          <p className="text-sm text-slate-400 mb-4">
            Connect external services to power automation actions like{' '}
            <span className="text-indigo-400 font-mono text-xs">upload_to_drive</span>.
          </p>
          <GoogleDriveSection />
        </Section>

        {/* Appearance */}
        <Section title="Appearance" icon={<Palette size={16} />}>
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-white mb-3">Theme</p>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              {themeOptions.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    theme === value
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                      : 'border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={<Bell size={16} />}>
          <div className="space-y-5 divide-y divide-slate-200 dark:divide-slate-800">
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
            <p className="text-sm font-medium text-slate-800 dark:text-white mb-3">Two-Factor Authentication (MFA)</p>
            <MFASection />
          </div>
        </Section>

        {/* AI Engine Keys */}
        <Section title="AI Engine" icon={<Cpu size={16} />}>
          <p className="text-sm text-slate-400 mb-4">
            Configure your personal AI provider keys to power all AI features — 
            <span className="text-indigo-400 font-medium"> Chat</span>,{' '}
            <span className="text-indigo-400 font-medium">AI Agent</span>,{' '}
            <span className="text-indigo-400 font-medium">Documents</span>, and{' '}
            <span className="text-indigo-400 font-medium">Automation</span>.
            Your keys are stored server-side and never exposed in the browser.
            Each feature uses your key — you're billed directly by the provider, not by SYNAPSE.
          </p>
          <AiKeysForm />
        </Section>

        {/* API Key */}
        <Section title="API Access" icon={<Key size={16} />}>
          <p className="text-sm text-slate-400">Use this key to access the SYNAPSE API from external apps.</p>
          <div className="flex items-center gap-2 flex-wrap xs:flex-nowrap">
            <div className="w-full xs:flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs sm:text-sm text-slate-600 dark:text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">
              {showKey ? apiKey : '•'.repeat(Math.min(apiKey.length, 32))}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => setShowKey(s => !s)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(apiKey); toast.success('API key copied!') }}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold whitespace-nowrap"
              >
                Copy
              </button>
            </div>
          </div>
        </Section>

        {/* Sign out */}
        <Section title="Session" icon={<LogOut size={16} />}>
          <p className="text-sm text-slate-400">Sign out of your current session on this device.</p>
          <button
            onClick={() => { logout(); router.push('/login') }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg transition-colors"
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
                className="w-full bg-slate-100 dark:bg-slate-800 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500"
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
