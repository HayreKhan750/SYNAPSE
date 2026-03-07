import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Create separate axios instances
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const authApi: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for main API client (with auth)
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = typeof window !== 'undefined' ? localStorage.getItem('synapse_access_token') : null
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor for main API client (with token refresh logic)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Only retry once and only on 401 errors
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('synapse_refresh_token')
        if (!refreshToken) {
          throw new Error('No refresh token available')
        }

        // Attempt token refresh
        const response = await authApi.post('/api/v1/auth/token/refresh/', {
          refresh: refreshToken,
        })

        const { access } = response.data
        if (access) {
          // Update tokens in localStorage
          localStorage.setItem('synapse_access_token', access)

          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`

          // Retry the original request
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Token refresh failed - clear tokens and redirect to login
        localStorage.removeItem('synapse_access_token')
        localStorage.removeItem('synapse_refresh_token')

        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }

        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api

export { api }
