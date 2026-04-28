'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuthStore } from '@/store/authStore'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type LoginFormData = z.infer<typeof loginSchema>

// OAuth provider availability — checked at build time via NEXT_PUBLIC_* env vars.
// Falsy values disable the relevant button so users see a clear "not configured"
// state rather than a popup that fails silently.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const GOOGLE_CONFIGURED = !!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'not-configured'
const GITHUB_CONFIGURED = !!API_URL

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  github_denied:         'GitHub access was denied. Please try again.',
  github_no_email:       'Could not retrieve your GitHub email. Make sure your email is public or verified on GitHub.',
  github_token_failed:   'GitHub authentication failed. Please try again.',
  github_profile_failed: 'Could not fetch your GitHub profile. Please try again.',
  github_no_token:       'GitHub did not return an access token. Please try again.',
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, googleAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Surface OAuth errors propagated from backend redirect (?error=github_denied etc.)
  useEffect(() => {
    const errorCode = searchParams?.get('error')
    if (errorCode) {
      setError(OAUTH_ERROR_MESSAGES[errorCode] ?? 'Sign-in failed. Please try again.')
    }
  }, [searchParams])

  // useGoogleLogin must be called unconditionally to satisfy the rules of hooks.
  // We gate the *button* on GOOGLE_CONFIGURED instead of the hook itself.
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true)
      setError(null)
      try {
        await googleAuth(tokenResponse.access_token)
        toast.success('Signed in with Google!')
        router.push('/home')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google sign-in failed.')
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => setError('Google sign-in was cancelled or failed.'),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      await login({ email: data.email, password: data.password })
      toast.success('Welcome back!')
      router.push('/home')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-black mb-1.5 tracking-tight text-slate-900 dark:text-white">Welcome back</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to your SYNAPSE account</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20">
          <AlertCircle size={16} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400 leading-snug">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Email address
          </label>
          <div className="relative group">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors
              text-slate-400 group-focus-within:text-indigo-500 dark:text-slate-500 dark:group-focus-within:text-indigo-400" />
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="auth-input w-full pl-10 pr-4 py-3 rounded-xl text-sm"
            />
          </div>
          {errors.email && (
            <p className="text-xs flex items-center gap-1 mt-1 text-red-500 dark:text-red-400">
              <AlertCircle size={11} /> {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-medium transition-colors text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300">
              Forgot password?
            </Link>
          </div>
          <div className="relative group">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors
              text-slate-400 group-focus-within:text-indigo-500 dark:text-slate-500 dark:group-focus-within:text-indigo-400" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="auth-input w-full pl-10 pr-11 py-3 rounded-xl text-sm"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs flex items-center gap-1 mt-1 text-red-500 dark:text-red-400">
              <AlertCircle size={11} /> {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button type="submit" disabled={isLoading}
            className="relative w-full group overflow-hidden rounded-xl font-bold text-sm py-3.5 transition-all duration-200
              bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
              disabled:opacity-60 disabled:cursor-not-allowed text-white
              shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99]
              flex items-center justify-center gap-2">
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {isLoading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : <>Sign In <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></>}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-slate-200 dark:bg-white/15" />
        <span className="text-xs text-slate-400">or continue with</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-white/15" />
      </div>

      {/* Google Sign In */}
      <button
        type="button"
        onClick={() => GOOGLE_CONFIGURED && handleGoogleLogin()}
        disabled={googleLoading || !GOOGLE_CONFIGURED}
        title={GOOGLE_CONFIGURED ? 'Sign in with Google' : 'Google sign-in is not configured on this deployment'}
        className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-medium transition-all duration-200
          border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700
          dark:border-white/10 dark:hover:border-white/20 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-200
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-white/5
          shadow-sm mb-3"
      >
        {googleLoading ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
        )}
        {GOOGLE_CONFIGURED ? 'Sign in with Google' : 'Google sign-in unavailable'}
      </button>

      {/* GitHub Sign In */}
      <button
        type="button"
        onClick={() => {
          if (GITHUB_CONFIGURED) {
            window.location.href = `${API_URL.replace(/\/$/, '')}/api/v1/auth/github/`
          }
        }}
        disabled={!GITHUB_CONFIGURED}
        title={GITHUB_CONFIGURED ? 'Sign in with GitHub' : 'GitHub sign-in is not configured on this deployment'}
        className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-medium transition-all duration-200
          border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700
          dark:border-white/10 dark:hover:border-white/20 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-200
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-white/5
          shadow-sm mb-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
        {GITHUB_CONFIGURED ? 'Sign in with GitHub' : 'GitHub sign-in unavailable'}
      </button>

      {/* Note when SSO providers are not configured on this deployment */}
      {(!GOOGLE_CONFIGURED || !GITHUB_CONFIGURED) && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mb-6 leading-relaxed">
          {!GOOGLE_CONFIGURED && !GITHUB_CONFIGURED
            ? 'Single sign-on providers are not configured on this environment. Please use email and password.'
            : !GOOGLE_CONFIGURED
              ? 'Google sign-in is not configured on this environment.'
              : 'GitHub sign-in is not configured on this environment.'}
        </p>
      )}
      {GOOGLE_CONFIGURED && GITHUB_CONFIGURED && <div className="mb-6" />}

      {/* New to SYNAPSE */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-slate-200 dark:bg-white/15" />
        <span className="text-xs text-slate-400">New to SYNAPSE?</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-white/15" />
      </div>

      <Link href="/register"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all duration-200
          border border-slate-200 hover:border-indigo-300 bg-white/50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700
          dark:border-white/10 dark:hover:border-white/20 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 dark:hover:text-white">
        Create a free account <ArrowRight size={14} className="text-slate-400 dark:text-slate-500" />
      </Link>
    </div>
  )
}
