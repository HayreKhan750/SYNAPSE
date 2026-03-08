'use client'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Search, Sun, Moon, Bell, Menu, LogOut, Settings, User } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface NavbarProps {
  onMenuClick: () => void
  onMobileMenuClick: () => void
}

export function Navbar({ onMenuClick, onMobileMenuClick }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [notificationCount] = useState(3) // Mock notification count

  // Get page title based on route
  const getPageTitle = () => {
    const routeTitles: Record<string, string> = {
      '/': 'Dashboard',
      '/feed': 'Tech Feed',
      '/github': 'GitHub Radar',
      '/research': 'Research',
      '/chat': 'AI Chat',
      '/automation': 'Automation',
      '/documents': 'Documents',
      '/library': 'Library',
      '/notifications': 'Notifications',
    }
    return (pathname && routeTitles[pathname]) || 'SYNAPSE'
  }

  // Debounced search handler
  const handleSearch = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && searchQuery.trim()) {
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
        setSearchQuery('')
      }
    },
    [searchQuery, router]
  )

  const handleLogout = () => {
    logout()
    router.push('/login')
    setIsUserMenuOpen(false)
  }

  return (
    <nav className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur border-b border-slate-700">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left: Page Title / Menu Button */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger — strictly hidden on md+ screens */}
          <div className="md:hidden">
            <button
              onClick={onMobileMenuClick}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Open sidebar"
            >
              <Menu size={20} />
            </button>
          </div>
          {/* Desktop collapse toggle — strictly hidden below md */}
          <div className="hidden md:block">
            <button
              onClick={onMenuClick}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
          </div>
          <h1 className="text-lg font-semibold text-white">{getPageTitle()}</h1>
        </div>

        {/* Center: Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search articles, papers, repos..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Right: Theme Toggle, Notifications, User Menu */}
        <div className="flex items-center gap-4">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            title="Toggle dark mode"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Notifications */}
          <Link
            href="/notifications"
            className="relative p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            title="Notifications"
          >
            <Bell size={20} />
            {notificationCount > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-cyan-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </Link>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
                <span className="text-white font-bold text-xs">
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </span>
              </div>
              <span className="hidden sm:inline text-sm text-slate-300">{user?.first_name}</span>
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700">
                  <p className="text-sm font-medium text-white">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <User size={16} />
                  <span className="text-sm">Profile</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <Settings size={16} />
                  <span className="text-sm">Settings</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-slate-300 hover:bg-slate-700 transition-colors border-t border-slate-700"
                >
                  <LogOut size={16} />
                  <span className="text-sm">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
