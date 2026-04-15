/**
 * supabase.ts — Supabase client configuration for SYNAPSE
 *
 * This integrates Supabase as an additional authentication layer alongside
 * the existing Django JWT authentication. Supabase handles:
 * - Real-time authentication via email/password, magic links
 * - Social login providers (Google, GitHub, etc.)
 * - Multi-factor authentication (MFA/TOTP)
 * - Account recovery and password reset
 *
 * The user's session is synced with Django JWT tokens for API access.
 */
import { createClient } from '@supabase/supabase-js'

// Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create Supabase client only if credentials are available
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Storage key for persistence
        storageKey: 'synapse-supabase-auth',
      },
    })
  : null

// Type definitions for Supabase auth
export interface SupabaseUser {
  id: string
  email: string
  user_metadata: {
    username?: string
    first_name?: string
    last_name?: string
    avatar_url?: string
    provider?: string
  }
  app_metadata: {
    provider?: string
    providers?: string[]
  }
}

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!supabase
}

// Helper to get current Supabase session
export const getSupabaseSession = async () => {
  if (!supabase) return null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  } catch {
    return null
  }
}

// Helper to get Supabase user
export const getSupabaseUser = async () => {
  if (!supabase) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export default supabase
