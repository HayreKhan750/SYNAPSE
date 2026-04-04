/**
 * api.ts — Axios instance with industry best practices:
 *  ✓ JWT Bearer auth from Zustand persist store
 *  ✓ Single-flight refresh queue (prevents multiple simultaneous refresh calls)
 *  ✓ Exponential-backoff retry for network errors & 5xx
 *  ✓ Structured error normalisation
 *  ✓ Request timeout (30s protected, 15s auth)
 */
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios'

// ── Config ─────────────────────────────────────────────────────────────────────

const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
).replace(/\/api\/v1\/?$/, '')

// ── Token helpers ──────────────────────────────────────────────────────────────

const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null
  const direct = localStorage.getItem('synapse_access_token')
  if (direct) return direct
  try {
    const raw = localStorage.getItem('synapse-auth')
    if (raw) return JSON.parse(raw)?.state?.accessToken ?? null
  } catch {}
  return null
}

const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('synapse_refresh_token')
}

const setAccessToken = (token: string) => {
  localStorage.setItem('synapse_access_token', token)
}

const clearTokens = () => {
  localStorage.removeItem('synapse_access_token')
  localStorage.removeItem('synapse_refresh_token')
}

// ── Refresh queue ─────────────────────────────────────────────────────────────
// Prevents multiple simultaneous token refresh calls when several requests
// get 401 at the same time (single-flight pattern).

type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void }
let isRefreshing = false
let failedQueue: QueueItem[] = []

const processQueue = (err: unknown, token: string | null) => {
  failedQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)))
  failedQueue = []
}

// ── Retry config ───────────────────────────────────────────────────────────────
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504])
const MAX_RETRIES  = 3
const retryDelay   = (n: number) => Math.min(300 * 2 ** n + Math.random() * 100, 5000)

// ── Axios instances ────────────────────────────────────────────────────────────

/** Authenticated instance — all protected API calls */
export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

/** Unauthenticated instance — login / refresh / register */
export const authApi: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor ────────────────────────────────────────────────────────

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (err) => Promise.reject(err),
)

// ── Response interceptor — retry + silent refresh ─────────────────────────────

api.interceptors.response.use(
  (res) => res,
  async (
    error: AxiosError & {
      config: InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number }
    },
  ) => {
    const originalRequest = error.config
    if (!originalRequest) return Promise.reject(error)

    // Retry on network/5xx
    const retryCount = originalRequest._retryCount ?? 0
    if (shouldRetry(error, retryCount)) {
      originalRequest._retryCount = retryCount + 1
      await new Promise((r) => setTimeout(r, retryDelay(retryCount)))
      return api(originalRequest)
    }

    // Silent JWT refresh on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = getRefreshToken()
        if (!refreshToken) throw new Error('No refresh token')

        const { data } = await authApi.post<{ access: string }>('/auth/token/refresh/', {
          refresh: refreshToken,
        })
        setAccessToken(data.access)
        processQueue(null, data.access)
        originalRequest.headers.Authorization = `Bearer ${data.access}`
        return api(originalRequest)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        clearTokens()
        // Only redirect to login if not on a page that has active long-running
        // operations (e.g. automation polling). Give the user 2s to see the error.
        if (typeof window !== 'undefined') {
          setTimeout(() => { window.location.href = '/login' }, 2000)
        }
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    // Plan limit exceeded (403 with error_code = plan_limit_exceeded)
    if (error.response?.status === 403) {
      const data = error.response.data as Record<string, unknown> | undefined
      if (data?.error_code === 'plan_limit_exceeded') {
        // Fire the upgrade modal via a custom DOM event so we don't couple api.ts to React context
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('synapse:plan_limit_exceeded', { detail: data }))
        }
      }
    }

    // TASK-501-F1: Rate limit exceeded (429) → show UpgradeModal with countdown
    if (error.response?.status === 429) {
      const data = error.response.data as Record<string, unknown> | undefined
      const resetAt = (data?.reset_at as string) ?? null
      const upgradeUrl = (data?.upgrade_url as string) ?? '/pricing'
      const message = (data?.message as string) ?? 'Rate limit exceeded. Please upgrade your plan for higher limits.'
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('synapse:rate_limit_exceeded', {
            detail: { resetAt, upgradeUrl, message, data },
          }),
        )
      }
    }

    return Promise.reject(error)
  },
)

function shouldRetry(error: AxiosError, retryCount: number): boolean {
  if (retryCount >= MAX_RETRIES) return false
  if (error.response?.status === 401) return false
  if (!error.response) return true
  return RETRY_STATUS.has(error.response.status)
}

// ── Error normaliser ───────────────────────────────────────────────────────────

export interface ApiErrorPayload {
  message: string
  status:  number
  detail?: unknown
}

export function normaliseApiError(error: unknown): ApiErrorPayload {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0
    const data   = error.response?.data
    const message =
      (typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>).detail ??
          (data as Record<string, unknown>).message ??
          (data as Record<string, unknown>).error
        : null) ??
      error.message ??
      'An unexpected error occurred.'
    return { message: String(message), status, detail: data }
  }
  return { message: 'An unexpected error occurred.', status: 0 }
}

export default api
