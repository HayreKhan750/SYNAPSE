/**
 * AuthProvider.tsx — Wraps Supabase AuthProvider for SYNAPSE
 *
 * Provides Supabase authentication context alongside the existing
 * Zustand auth store. This enables:
 * - Real-time session management
 * - MFA/TOTP support
 * - Social login (Google, GitHub)
 * - Magic links and passwordless auth
 */
'use client'

import { createContext, useContext, useEffect, ReactNode, useState, useCallback } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/utils/supabase'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/utils/api'
import toast from 'react-hot-toast'

interface AuthContextType {
  session: Session | null
  isLoading: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUpWithEmail: (email: string, password: string, metadata?: Record<string, string>) => Promise<{ success: boolean; error?: string }>
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { setTokens, logout, fetchUser } = useAuthStore()

  // Sync Supabase session with Django backend
  const syncSessionWithBackend = useCallback(async (supabaseSession: Session) => {
    try {
      // Get the Supabase access token
      const supabaseToken = supabaseSession.access_token

      // Exchange Supabase token for Django JWT tokens
      const response = await authApi.post('/auth/supabase/', {
        access_token: supabaseToken,
      })

      const { access, refresh, user } = response.data

      // Update the Zustand auth store with Django tokens
      setTokens(access, refresh)

      // Fetch full user profile from Django
      await fetchUser()

      return true
    } catch (error) {
      console.error('Failed to sync Supabase session with Django:', error)
      return false
    }
  }, [setTokens, fetchUser])

  // Initialize Supabase auth listener
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setIsLoading(false)
      return
    }

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()

        if (initialSession) {
          setSession(initialSession)
          // Sync with Django backend
          await syncSessionWithBackend(initialSession)
        }
      } catch (error) {
        console.error('Failed to initialize Supabase auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, supabaseSession) => {
        console.log('Supabase auth event:', event)

        if (event === 'SIGNED_IN' && supabaseSession) {
          setSession(supabaseSession)
          await syncSessionWithBackend(supabaseSession)
          toast.success('Signed in successfully!')
        } else if (event === 'SIGNED_OUT') {
          setSession(null)
          await logout()
        } else if (event === 'TOKEN_REFRESHED' && supabaseSession) {
          setSession(supabaseSession)
          // Optionally sync refreshed token with Django
        } else if (event === 'USER_UPDATED' && supabaseSession) {
          setSession(supabaseSession)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [syncSessionWithBackend, logout])

  // Sign in with email/password via Supabase
  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data.session) {
        setSession(data.session)
        await syncSessionWithBackend(data.session)
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Sign in failed. Please try again.' }
    }
  }

  // Sign up with email/password via Supabase
  const signUpWithEmail = async (email: string, password: string, metadata?: Record<string, string>) => {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // If email confirmation is required, user won't be logged in yet
      if (!data.session && data.user) {
        return { success: true, error: 'Please check your email to confirm your account.' }
      }

      if (data.session) {
        setSession(data.session)
        await syncSessionWithBackend(data.session)
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Sign up failed. Please try again.' }
    }
  }

  // Sign in with Google via Supabase
  const signInWithGoogle = async () => {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'email profile',
        },
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // User will be redirected to Google, then back
      return { success: true }
    } catch (error) {
      return { success: false, error: 'Google sign in failed. Please try again.' }
    }
  }

  // Sign out from both Supabase and Django
  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    await logout()
  }

  // Send password reset email via Supabase
  const resetPassword = async (email: string) => {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Password reset failed. Please try again.' }
    }
  }

  // Update password
  const updatePassword = async (newPassword: string) => {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Password update failed. Please try again.' }
    }
  }

  // Refresh session
  const refreshSession = async () => {
    if (!supabase) return

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession) {
        await syncSessionWithBackend(currentSession)
      }
    } catch (error) {
      console.error('Failed to refresh session:', error)
    }
  }

  const value: AuthContextType = {
    session,
    isLoading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    refreshSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
