'use client'

/**
 * Providers — global React context providers.
 *
 * Industry best practices:
 *  ✓ QueryClient created with useState (not module-level) → correct for Next.js App Router,
 *    prevents shared state between server renders and fixes HMR.
 *  ✓ Global error handling via QueryCache/MutationCache onError
 *  ✓ Optimised defaults: staleTime 5min, gcTime 10min, retry with exponential backoff
 *  ✓ ReactQueryDevtools only in development (zero prod bundle cost)
 *  ✓ Structured toast styles matching design system
 */

import React, { useState } from 'react'
import { ThemeProvider } from 'next-themes'
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { normaliseApiError } from '@/utils/api'

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only show toast for background refetch errors (not initial load failures)
        if (query.state.data !== undefined) {
          const { message } = normaliseApiError(error)
          toast.error(`Sync error: ${message}`, { id: 'bg-error', duration: 4000 })
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        const { message } = normaliseApiError(error)
        toast.error(message, { duration: 5000 })
      },
    }),
    defaultOptions: {
      queries: {
        staleTime:            5 * 60 * 1000,   // 5 min
        gcTime:               10 * 60 * 1000,  // 10 min
        retry:                2,
        retryDelay:           (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
        refetchOnWindowFocus: true,
        refetchOnReconnect:   'always',
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {children}

        <Toaster
          position="top-right"
          gutter={8}
          toastOptions={{
            duration: 3500,
            style: {
              background:   '#1e293b',
              color:        '#f1f5f9',
              borderRadius: '12px',
              border:       '1px solid rgba(99,102,241,0.2)',
              fontSize:     '13px',
              maxWidth:     '380px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#f1f5f9' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' }, duration: 5000 },
          }}
        />

        {/* Tree-shaken from production builds automatically */}
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
