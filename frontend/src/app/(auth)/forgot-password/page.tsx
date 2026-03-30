'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { authApi } from '@/utils/api'

const schema = z.object({
  email: z.string().email('Invalid email address'),
})
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setError(null)
    try {
      await authApi.post('/auth/password-reset/', { email: data.email })
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 mx-auto mb-5">
          <CheckCircle2 size={28} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Check your inbox</h2>
        <p className="text-slate-400 text-sm mb-2">
          We sent a password reset link to
        </p>
        <p className="text-indigo-400 font-semibold text-sm mb-6">{getValues('email')}</p>
        <p className="text-slate-500 text-xs mb-8">
          Didn't get it? Check your spam folder or wait a few minutes. The link expires in 1 hour.
        </p>
        <Link href="/login"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 hover:border-white/20
            text-slate-300 hover:text-white text-sm font-medium transition-all duration-200 bg-white/5 hover:bg-white/10">
          <ArrowLeft size={14} /> Back to Sign In
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-5 mx-auto">
          <Mail size={22} className="text-indigo-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-1.5 tracking-tight text-center">Forgot password?</h2>
        <p className="text-slate-400 text-sm text-center">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Email address
          </label>
          <div className="relative group">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="auth-input w-full pl-10 pr-4 py-3 rounded-xl text-sm"
            />
          </div>
          {errors.email && (
            <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
              <AlertCircle size={11} /> {errors.email.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="relative w-full group overflow-hidden rounded-xl font-bold text-sm py-3.5 transition-all duration-200
            bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
            disabled:opacity-60 disabled:cursor-not-allowed
            shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99]
            text-white flex items-center justify-center gap-2"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          {isLoading ? (
            <><Loader2 size={16} className="animate-spin" /> Sending…</>
          ) : (
            <>Send Reset Link <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></>
          )}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-white/15" />
        <span className="text-slate-400 text-xs">Remember it?</span>
        <div className="flex-1 h-px bg-white/15" />
      </div>

      <Link href="/login"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 hover:border-white/20
          text-slate-300 hover:text-white text-sm font-medium transition-all duration-200 bg-white/5 hover:bg-white/10">
        <ArrowLeft size={14} /> Back to Sign In
      </Link>
    </div>
  )
}
