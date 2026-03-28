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
  Bot,
  Youtube,
  TrendingUp,
  Bell,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ isCollapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  const navLinks = [
    { href: '/',              label: 'Home',          icon: LayoutDashboard, color: 'text-indigo-400' },
    { href: '/feed',          label: 'Tech Feed',     icon: Newspaper,       color: 'text-cyan-400'   },
    { href: '/github',        label: 'GitHub Radar',  icon: GitBranch,       color: 'text-emerald-400'},
    { href: '/research',      label: 'Research',      icon: BookOpen,        color: 'text-violet-400' },
    { href: '/videos',        label: 'Videos',        icon: Youtube,         color: 'text-red-400'    },
    { href: '/trends',        label: 'Trends',        icon: TrendingUp,      color: 'text-amber-400'  },
    { href: '/chat',          label: 'AI Chat',       icon: MessageSquare,   color: 'text-sky-400'    },
    { href: '/automation',    label: 'Automation',    icon: Zap,             color: 'text-yellow-400' },
    { href: '/agents',        label: 'AI Agents',     icon: Bot,             color: 'text-pink-400'   },
    { href: '/documents',     label: 'Documents',     icon: FileText,        color: 'text-orange-400' },
    { href: '/library',       label: 'Library',       icon: Library,         color: 'text-teal-400'   },
    { href: '/notifications', label: 'Notifications', icon: Bell,            color: 'text-rose-400'   },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen flex flex-col z-50
        transition-all duration-300 ease-in-out
        bg-slate-950 border-r border-slate-800/60
        ${isCollapsed ? 'w-[72px]' : 'w-64'}
        md:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
    >
      {/* Subtle top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-indigo-500 via-cyan-500 to-violet-500" />

      {/* Header with Logo and Toggle */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800/60">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg animated-gradient flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-xs">S</span>
            </div>
            <h1 className="text-lg font-black gradient-text truncate tracking-tight">
              SYNAPSE
            </h1>
          </div>
        )}
        {isCollapsed && (
          <div className="w-8 h-8 rounded-lg animated-gradient flex items-center justify-center mx-auto">
            <span className="text-white font-black text-sm">S</span>
          </div>
        )}

        {/* Desktop toggle — hidden on mobile */}
        {!isCollapsed && (
          <button
            onClick={onToggle}
            className="hidden md:flex p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-slate-200"
            title="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-slate-200"
          title="Close sidebar"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide py-3 px-2 space-y-0.5">
        {/* Expand button when collapsed */}
        {isCollapsed && (
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center p-2.5 mb-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
            title="Expand sidebar"
          >
            <ChevronRight size={18} />
          </button>
        )}
        {navLinks.map((link) => {
          const Icon = link.icon
          const active = isActive(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              title={isCollapsed ? link.label : ''}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative
                ${active
                  ? 'bg-indigo-600/20 text-white border border-indigo-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              {/* Active indicator */}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-r-full" />
              )}
              <Icon
                size={18}
                className={`flex-shrink-0 transition-colors ${active ? 'text-indigo-400' : link.color + ' opacity-70 group-hover:opacity-100'}`}
              />
              {!isCollapsed && (
                <span className={`text-sm font-medium truncate ${active ? 'text-white' : ''}`}>
                  {link.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom User Section */}
      <div className="border-t border-slate-800/60 p-3">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-glow-indigo">
              <span className="text-white font-bold text-xs">
                {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">
                  {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate leading-tight">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors flex-shrink-0"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
