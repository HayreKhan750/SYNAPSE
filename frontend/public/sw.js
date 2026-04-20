/**
 * SYNAPSE Service Worker — Phase 7.2 PWA
 *
 * Strategy: Network-first for all requests.
 * Vercel CDN handles caching — the SW only provides offline fallback.
 */

const CACHE_NAME = 'synapse-v2'
const OFFLINE_URL = '/offline'

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
  )
  self.skipWaiting()
})

// ── Activate — delete ALL old caches ───────────────────────────────────────────
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

// ── Fetch — Network-first for everything ───────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  // Navigation requests → network with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  // All other same-origin GET → network-first (no caching of stale assets)
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
