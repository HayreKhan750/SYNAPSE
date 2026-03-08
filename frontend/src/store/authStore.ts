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

          // Store tokens in localStorage
          localStorage.setItem('synapse_access_token', access)
          localStorage.setItem('synapse_refresh_token', refresh)
        } catch (error) {
          set({ isLoading: false })
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
        } catch (error) {
          set({ isLoading: false })
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
            } catch (error) {
              // Continue with logout even if API call fails
              if (axios.isAxiosError(error) && error.response?.status !== 401) {
                throw error
              }
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
    }),
    {
      name: 'synapse-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
