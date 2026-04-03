'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar, MobileBottomNav } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { useAuthStore } from '@/store/authStore'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import { CommandPalette } from '@/components/ui/CommandPalette'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated } = useAuthStore()
  const [isCollapsed, setIsCollapsed] = useState(false)   // desktop: collapsed/expanded
  const [mobileOpen, setMobileOpen] = useState(false)     // mobile: sidebar open/closed
  const [isMounted, setIsMounted] = useState(false)
  // TASK-402: Command palette state
  const [cmdOpen, setCmdOpen] = useState(false)

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
    setIsMounted(true)
  }, [])

  useEffect(() => {
    // Only redirect after mount so Zustand has time to rehydrate from localStorage
    if (isMounted && !isAuthenticated) {
      router.push('/login')
    }
  }, [isMounted, isAuthenticated, router])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Show a dark loading screen while auth state rehydrates — prevents flash of landing page
  if (!isMounted || !isAuthenticated) {
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

        {/* Main Content Area */}
        {/* On desktop: offset by sidebar width. On mobile: no margin (sidebar overlays) */}
        <div
          className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
            isCollapsed ? 'md:ml-[72px]' : 'md:ml-64'
          }`}
        >
          {/* Navbar */}
          <Navbar
            onMenuClick={() => setIsCollapsed(!isCollapsed)}
            onMobileMenuClick={() => setMobileOpen(true)}
            onSearchClick={() => setCmdOpen(true)}
          />

          {/* Page Content */}
          <main id="main-content" className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
            {children}
          </main>
        </div>
      </div>

      {/* TASK-402-4: CommandPalette — global ⌘K portal */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* TASK-404-1: Mobile bottom navigation bar */}
      <MobileBottomNav />
    </OrganizationProvider>
  )
}
