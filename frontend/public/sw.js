/**
 * SYNAPSE Service Worker — Phase 7.2 PWA
 *
 * Strategy:
 *  - App shell (HTML, CSS, JS) → Cache-first with network fallback
 *  - API calls (/api/v1/*) → Network-first with cache fallback
 *  - Offline fallback → /offline
 */

const CACHE_NAME = 'synapse-v1'
const OFFLINE_URL = '/offline'

const APP_SHELL = [
  '/',
  '/offline',
  '/manifest.json',
]

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL)
    })
  )
  self.skipWaiting()
})

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and non-same-origin
  if (request.method !== 'GET' || url.origin !== location.origin) return

  // API calls → Network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          return cached ?? new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        })
    )
    return
  }

  // HTML navigation → Network-first, fallback to /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        return caches.match(OFFLINE_URL)
      })
    )
    return
  }

  // Static assets → Cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})
