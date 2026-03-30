'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
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
        <h2 className="text-2xl font-black text-white mb-1.5 tracking-tight">Welcome back</h2>
        <p className="text-slate-400 text-sm">Sign in to your SYNAPSE account</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm leading-snug">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Email address
          </label>
          <div className="relative group">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-white placeholder-slate-600 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50
                hover:border-slate-600 transition-all duration-200"
            />
          </div>
          {errors.email && (
            <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
              <AlertCircle size={11} /> {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
              Forgot password?
            </Link>
          </div>
          <div className="relative group">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-white placeholder-slate-600 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50
                hover:border-slate-600 transition-all duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
              <AlertCircle size={11} /> {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="relative w-full group overflow-hidden rounded-xl font-bold text-sm py-3.5 transition-all duration-200
              bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
              disabled:opacity-60 disabled:cursor-not-allowed
              shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99]
              text-white flex items-center justify-center gap-2"
          >
            {/* Shimmer effect */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-slate-800" />
        <span className="text-slate-600 text-xs">New to SYNAPSE?</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>

      {/* Register link */}
      <Link
        href="/register"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-slate-700/60 hover:border-slate-600
          text-slate-300 hover:text-white text-sm font-medium transition-all duration-200
          bg-slate-800/30 hover:bg-slate-800/60"
      >
        Create a free account
        <ArrowRight size={14} className="text-slate-500" />
      </Link>
    </div>
  )
}
