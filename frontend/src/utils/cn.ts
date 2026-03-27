/**
 * cn() — merge Tailwind classes with clsx + tailwind-merge.
 *
 * Industry best practice: always compose these two to avoid class conflicts.
 * e.g. cn('px-2 py-1 bg-red-500', 'bg-blue-500') → 'px-2 py-1 bg-blue-500'
 *
 * Usage:
 *   import { cn } from '@/utils/cn'
 *   <div className={cn('base-class', condition && 'conditional-class', className)} />
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
