'use client'

/**
 * BottomNav — Mobile bottom navigation bar.
 * Replaces the sidebar on screens < lg (1024px).
 *
 * Phase 7.2 — Mobile & Performance (Week 20)
 */

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Home,
  Rss,
  GitBranch,
  BookOpen,
  MessageSquare,
  Zap,
  FileText,
  Search,
  Library,
} from 'lucide-react'
import { clsx } from 'clsx'

// ── Nav items (most important 5 for thumb reach) ──────────────────────────────

const PRIMARY_NAV = [
  { href: '/',           icon: Home,         label: 'Home'     },
  { href: '/feed',       icon: Rss,          label: 'Feed'     },
  { href: '/search',     icon: Search,       label: 'Search'   },
  { href: '/chat',       icon: MessageSquare,label: 'Chat'     },
  { href: '/automation', icon: Zap,          label: 'Auto'     },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 safe-bottom">
      <div className="flex items-stretch h-16">
        {PRIMARY_NAV.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === '/'
              ? pathname === '/'
              : pathname?.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group"
            >
              {/* Active indicator pill */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-indigo-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <motion.div
                whileTap={{ scale: 0.85 }}
                className={clsx(
                  'flex flex-col items-center gap-0.5 pt-1',
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300',
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </motion.div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
