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
 *  ✓ GoogleOAuthProvider for Google Sign-In
 */

import React, { useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { UpgradeModalProvider } from '@/components/modals/UpgradeModal'
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
import { AnalyticsProvider } from '@/components/AnalyticsProvider'

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
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
        staleTime: 5 * 60 * 1000,   // 5 min — data considered fresh, no refetch on nav
        gcTime: 15 * 60 * 1000,  // 15 min — keep in memory longer
        retry: 1,               // Only 1 retry (was 2) — faster failure feedback
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
        // KEY PERF FIX: disable refetchOnWindowFocus globally — this was causing every tab
        // switch to re-fetch ALL active queries, making navigation feel slow.
        // Individual queries that need live data can override this explicitly.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        // Structural sharing avoids unnecessary re-renders when data hasn't changed
        structuralSharing: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())

  // Always provide GoogleOAuthProvider so useGoogleLogin hooks don't crash.
  // Use 'not-configured' as placeholder — Google Sign-In won't work until the
  // real NEXT_PUBLIC_GOOGLE_CLIENT_ID is set, but the app won't crash.
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'not-configured'

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {/* TASK-401-2: ThemeProvider — respect OS prefers-color-scheme on first visit,
           store preference in localStorage via next-themes built-in mechanism */}
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem={true}
        disableTransitionOnChange={true}
        storageKey="synapse-theme"
      >
        <QueryClientProvider client={queryClient}>
          <UpgradeModalProvider>
            {/* TASK-203: PostHog analytics — page view tracking & user identification */}
            <AnalyticsProvider />

            {children}

            <Toaster
              position="top-right"
              gutter={8}
              toastOptions={{
                duration: 3500,
                style: {
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  maxWidth: '380px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                },
                success: { iconTheme: { primary: '#22c55e', secondary: '#ffffff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' }, duration: 5000 },
              }}
            />

            {/* Tree-shaken from production builds automatically */}
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          </UpgradeModalProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  )
}
