'use client'

/**
 * Premium Tooltip Component
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~
 * Usage:
 *   <Tooltip content="Hello world">
 *     <button>Hover me</button>
 *   </Tooltip>
 *
 *   <Tooltip content="Hello" side="right">
 *     <button>Hover me</button>
 *   </Tooltip>
 *
 * Sides: top (default) | bottom | left | right
 * All positioning is done via CSS so it works inside any overflow context.
 */

import React from 'react'
import { cn } from '@/utils/helpers'

interface TooltipProps {
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactElement
  className?: string
  delay?: boolean
}

export function Tooltip({ content, side = 'top', children, className, delay = false }: TooltipProps) {
  const [show, setShow] = React.useState(false)

  const positionClasses: Record<string, string> = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses: Record<string, string> = {
    top:    'top-full left-1/2 -translate-x-1/2 border-l border-b border-slate-700 -mt-1',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l border-t border-slate-700 -mb-1',
    left:   'left-full top-1/2 -translate-y-1/2 border-r border-t border-slate-700 -ml-1',
    right:  'right-full top-1/2 -translate-y-1/2 border-l border-b border-slate-700 -mr-1',
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && content && (
        <div
          className={cn(
            'pointer-events-none absolute z-[9999] whitespace-nowrap',
            positionClasses[side],
            delay && 'animate-in fade-in-0 zoom-in-95 duration-150',
            className
          )}
        >
          <div className="bg-slate-800 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 shadow-xl shadow-black/40">
            {content}
          </div>
          {/* Arrow */}
          <div className={cn('absolute w-2 h-2 bg-slate-800 rotate-45', arrowClasses[side])} />
        </div>
      )}
    </div>
  )
}
