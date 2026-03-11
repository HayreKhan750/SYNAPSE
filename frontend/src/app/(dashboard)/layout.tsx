'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { useAuthStore } from '@/store/authStore'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated } = useAuthStore()
  const [isCollapsed, setIsCollapsed] = useState(false)   // desktop: collapsed/expanded
  const [mobileOpen, setMobileOpen] = useState(false)     // mobile: sidebar open/closed
  const [isMounted, setIsMounted] = useState(false)

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

  // Show nothing until mounted (avoids SSR/hydration flash)
  if (!isMounted) return null
  // After mount: if not authenticated, we're redirecting — show nothing
  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">

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
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-200 ${
          isCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        {/* Navbar */}
        <Navbar
          onMenuClick={() => setIsCollapsed(!isCollapsed)}
          onMobileMenuClick={() => setMobileOpen(true)}
        />

        {/* Page Content — overflow-hidden so each page controls its own scroll.
            The chat page uses an internal flex layout with a scrollable message
            area and a pinned input bar. Other pages wrap their content in a
            scrollable div via the page-scroll utility class. */}
        <main className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
          {children}
        </main>
      </div>
    </div>
  )
}
