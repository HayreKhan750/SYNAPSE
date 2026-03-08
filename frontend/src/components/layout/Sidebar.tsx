'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Newspaper,
  GitBranch,
  BookOpen,
  MessageSquare,
  Zap,
  FileText,
  Library,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  const navLinks = [
    { href: '/', label: 'Home', icon: LayoutDashboard },
    { href: '/feed', label: 'Tech Feed', icon: Newspaper },
    { href: '/github', label: 'GitHub Radar', icon: GitBranch },
    { href: '/research', label: 'Research', icon: BookOpen },
    { href: '/chat', label: 'AI Chat', icon: MessageSquare },
    { href: '/automation', label: 'Automation', icon: Zap },
    { href: '/documents', label: 'Documents', icon: FileText },
    { href: '/library', label: 'Library', icon: Library },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-700 flex flex-col transition-all duration-200 z-40 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Header with Logo and Toggle */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
        {!isCollapsed && (
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 via-cyan-500 to-violet-500 bg-clip-text text-transparent truncate">
            SYNAPSE
          </h1>
        )}
        {isCollapsed && <span className="text-xl font-bold text-indigo-500">S</span>}

        <button
          onClick={onToggle}
          className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navLinks.map((link) => {
          const Icon = link.icon
          const active = isActive(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              title={isCollapsed ? link.label : ''}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-2 ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium truncate">{link.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom User Section */}
      <div className="border-t border-slate-700 p-4">
        {isCollapsed ? (
          /* Collapsed: just centered avatar */
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut size={16} className="flex-shrink-0" />
            </button>
          </div>
        ) : (
          /* Expanded: avatar + name on left, logout icon on right — same row */
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors flex-shrink-0"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
