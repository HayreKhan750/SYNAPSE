/**
 * useNotificationSocket
 * ~~~~~~~~~~~~~~~~~~~~~
 * Connects to the Django Channels WebSocket at ws[s]://host/ws/notifications/
 * using the JWT access token from the auth store.
 *
 * On receiving a "notification" message, it:
 *  1. Invalidates the React Query cache for notifications + unread count
 *  2. Shows a toast with the notification title
 *
 * Includes exponential backoff reconnection (max 30s).
 */
'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

const MAX_RETRIES = 8
const BASE_DELAY_MS = 1_000

function getWsUrl(): string {
  // SECURITY: token is NOT passed in URL (would leak to server logs/browser history).
  // The Django Channels middleware authenticates via the session cookie or
  // a token sent as the first WebSocket message after connection.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const url = new URL(apiUrl)
  const proto = url.protocol === 'https:' ? 'wss' : 'ws'
  const host = process.env.NEXT_PUBLIC_WS_HOST || url.host
  return `${proto}://${host}/ws/notifications/`
}

const NOTIF_TYPE_TOAST: Record<string, (msg: string) => void> = {
  success:          (m) => toast.success(m, { style: { background: '#1e293b', color: '#f1f5f9' } }),
  error:            (m) => toast.error(m,   { style: { background: '#1e293b', color: '#f1f5f9' } }),
  warning:          (m) => toast(m,          { icon: '⚠️', style: { background: '#1e293b', color: '#f59e0b' } }),
  workflow_complete:(m) => toast(m,          { icon: '⚙️', style: { background: '#1e293b', color: '#818cf8' } }),
  info:             (m) => toast(m,          { icon: 'ℹ️', style: { background: '#1e293b', color: '#f1f5f9' } }),
}

export function useNotificationSocket() {
  const queryClient = useQueryClient()
  const { accessToken: token, isAuthenticated } = useAuthStore()
  const wsRef   = useRef<WebSocket | null>(null)
  const retries = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token) return

    let alive = true

    function connect() {
      if (!alive) return
      const url = getWsUrl()
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        retries.current = 0
        // SECURITY: send token as first message (not in URL query param)
        // This keeps the token out of server logs, browser history, and referer headers
        if (token) {
          ws.send(JSON.stringify({ type: 'auth', token: token as string }))
        }
        // keepalive ping every 25s
        const ping = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 25_000)
        ;(ws as any)._ping = ping
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'notification' && msg.data) {
            const { title, notif_type } = msg.data
            // Invalidate React Query caches so all components update
            queryClient.invalidateQueries({ queryKey: ['all-notifications'] })
            queryClient.invalidateQueries({ queryKey: ['unread-count'] })
            // Show toast
            const showToast = NOTIF_TYPE_TOAST[notif_type] ?? NOTIF_TYPE_TOAST.info
            showToast(title || 'New notification')
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = (event) => {
        clearInterval((ws as any)._ping)
        if (!alive) return
        if (event.code === 4001) return // auth failed — don't retry
        // Don't retry on server errors (500 handshake) — these need a server fix, not retries
        if (!event.wasClean && retries.current === 0) {
          // First unclean close — likely 500 from server. Try once more after a long delay.
          retries.current = MAX_RETRIES - 1 // only one more attempt
          timerRef.current = setTimeout(connect, 30_000)
          return
        }
        const maxRetries = event.wasClean ? MAX_RETRIES : 3
        if (retries.current >= maxRetries) return
        // Exponential backoff
        const delay = Math.min(BASE_DELAY_MS * 2 ** retries.current, 30_000)
        retries.current = Math.min(retries.current + 1, maxRetries)
        timerRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      alive = false
      if (timerRef.current) clearTimeout(timerRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [isAuthenticated, token, queryClient])
}
