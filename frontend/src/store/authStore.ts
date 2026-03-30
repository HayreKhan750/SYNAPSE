import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, LoginCredentials, RegisterData } from '@/types'
import api, { authApi } from '@/utils/api'
import axios from 'axios'

interface AuthStore {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  fetchUser: () => Promise<void>
  setTokens: (access: string, refresh: string) => void
  googleAuth: (accessToken: string) => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true })
        try {
          const response = await authApi.post('/auth/login/', credentials)
          const { access, refresh, user } = response.data

          set({
            accessToken: access,
            refreshToken: refresh,
            user,
            isAuthenticated: true,
            isLoading: false,
          })

          // Store tokens in localStorage for the axios interceptor
          localStorage.setItem('synapse_access_token', access)
          localStorage.setItem('synapse_refresh_token', refresh)
        } catch (error: unknown) {
          set({ isLoading: false })
          // Extract a human-readable message from the API error response
          if (axios.isAxiosError(error)) {
            const data = error.response?.data
            const msg =
              data?.error?.message ||
              data?.detail ||
              data?.non_field_errors?.[0] ||
              (error.response?.status === 401
                ? 'Invalid email or password.'
                : 'Login failed. Please try again.')
            throw new Error(msg)
          }
          throw error
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true })
        try {
          await authApi.post('/auth/register/', data)

          // Auto-login after successful registration
          const loginCredentials: LoginCredentials = {
            email: data.email,
            password: data.password,
          }
          await get().login(loginCredentials)
        } catch (error: unknown) {
          set({ isLoading: false })
          if (axios.isAxiosError(error)) {
            const data = error.response?.data
            // Collect all field errors into a readable message
            const details = data?.error?.details || data?.details || data
            if (details && typeof details === 'object') {
              const msgs = Object.entries(details)
                .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
                .join(' | ')
              if (msgs) throw new Error(msgs)
            }
            const msg = data?.error?.message || data?.detail || 'Registration failed. Please try again.'
            throw new Error(msg)
          }
          throw error
        }
      },

      logout: async () => {
        set({ isLoading: true })
        try {
          const refreshToken = get().refreshToken
          if (refreshToken) {
            try {
              await api.post('/auth/logout/', {
                refresh: refreshToken,
              })
            } catch {
              // Always continue with local logout regardless of API error
              // (token may already be expired or blacklist not enabled)
            }
          }

          // Clear state and localStorage
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          })

          localStorage.removeItem('synapse_access_token')
          localStorage.removeItem('synapse_refresh_token')
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      fetchUser: async () => {
        set({ isLoading: true })
        try {
          const response = await api.get('/auth/me/')
          set({ user: response.data, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      setTokens: (access: string, refresh: string) => {
        set({
          accessToken: access,
          refreshToken: refresh,
          isAuthenticated: true,
        })

        localStorage.setItem('synapse_access_token', access)
        localStorage.setItem('synapse_refresh_token', refresh)
      },

      googleAuth: async (accessToken: string) => {
        set({ isLoading: true })
        try {
          const response = await authApi.post('/auth/google/', { access_token: accessToken })
          const { tokens, user } = response.data

          set({
            accessToken: tokens.access,
            refreshToken: tokens.refresh,
            user,
            isAuthenticated: true,
            isLoading: false,
          })

          localStorage.setItem('synapse_access_token', tokens.access)
          localStorage.setItem('synapse_refresh_token', tokens.refresh)
        } catch (error: unknown) {
          set({ isLoading: false })
          if (axios.isAxiosError(error)) {
            const msg = error.response?.data?.error || 'Google sign-in failed. Please try again.'
            throw new Error(msg)
          }
          throw error
        }
      },
    }),
    {
      name: 'synapse-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
      // On rehydration, sync tokens back to direct localStorage keys so the interceptor finds them
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          localStorage.setItem('synapse_access_token', state.accessToken)
        }
        if (state?.refreshToken) {
          localStorage.setItem('synapse_refresh_token', state.refreshToken)
        }
      },
    }
  )
)
