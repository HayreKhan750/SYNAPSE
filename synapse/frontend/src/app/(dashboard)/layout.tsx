'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Sidebar, MobileBottomNav } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { AIAssistantPanel } from '@/components/layout/AIAssistantPanel'
import { useAuthStore } from '@/store/authStore'
import { OrganizationProvider } from '@/contexts/OrganizationContext'

// ── Lazy-load CommandPalette — only downloaded when user presses ⌘K ──────────
// This alone saves ~40KB from the initial dashboard bundle.
const CommandPalette = dynamic(
  () => import('@/components/ui/CommandPalette').then(m => ({ default: m.CommandPalette })),
  { ssr: false },
)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated } = useAuthStore()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [cmdOpen,    setCmdOpen]      = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  // Wait for Zustand persist to finish reading from localStorage before
  // making any auth decisions — prevents race-condition redirect to /login.
  // Must start as false (useState initializer runs on server where persist is unavailable).
  const [hydrated, setHydrated] = useState(false)

  // Global ⌘K / Ctrl+K listener
  const handleGlobalKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCmdOpen(prev => !prev)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [handleGlobalKey])

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
    return () => unsub()
  }, [])

  useEffect(() => {
    // Only redirect after Zustand has rehydrated from localStorage
    if (hydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [hydrated, isAuthenticated, router])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse">
            <span className="text-white font-black text-base">S</span>
          </div>
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <OrganizationProvider>
      {/* Phase 4 A11y: skip-to-main-content link for keyboard and screen reader users */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
        {/* Mobile backdrop — click to close */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={() => setIsCollapsed(!isCollapsed)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main Content Area — sidebar width handled via CSS transition */}
        <div
          className={`flex-1 flex flex-col overflow-hidden transition-[margin] duration-200 ${
            isCollapsed ? 'md:ml-[72px]' : 'md:ml-64'
          }`}
        >
          <Navbar
            onMobileMenuClick={() => setMobileOpen(true)}
            onSearchClick={() => setCmdOpen(true)}
            onAIPanelToggle={pathname !== '/chat' ? () => setAiPanelOpen(prev => !prev) : undefined}
            aiPanelOpen={aiPanelOpen}
          />

          {/* 3-panel: main content + right AI assistant */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            <main id="main-content" className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
              {children}
            </main>

            {/* Right panel — AI Assistant (xl screens only, hidden on /chat page) */}
            {pathname !== '/chat' && (
              <AIAssistantPanel
                isOpen={aiPanelOpen}
                onToggle={() => setAiPanelOpen(prev => !prev)}
              />
            )}
          </div>
        </div>
      </div>

      {/* CommandPalette — lazy-loaded, only mounted when open */}
      {cmdOpen && <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />}

      {/* TASK-404-1: Mobile bottom navigation bar */}
      <MobileBottomNav />
    </OrganizationProvider>
  )
}
