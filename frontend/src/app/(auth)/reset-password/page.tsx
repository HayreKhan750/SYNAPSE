'use client'

import React, { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { authApi } from '@/utils/api'

const schema = z.object({
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  new_password2: z.string(),
}).refine(d => d.new_password === d.new_password2, {
  message: 'Passwords do not match',
  path: ['new_password2'],
})
type FormData = z.infer<typeof schema>

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const uid   = params.get('uid')
  const token = params.get('token')

  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showPw, setShowPw]       = useState(false)
  const [showCf, setShowCf]       = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Invalid link — no uid/token in URL
  if (!uid || !token) {
    return (
      <div className="text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto mb-5">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Invalid link</h2>
        <p className="text-slate-400 text-sm mb-8">This password reset link is invalid or has expired.</p>
        <Link href="/forgot-password"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
            bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
            text-white text-sm font-bold transition-all">
          Request a new link <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 mx-auto mb-5">
          <CheckCircle2 size={28} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Password reset!</h2>
        <p className="text-slate-400 text-sm mb-8">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="relative w-full group overflow-hidden rounded-xl font-bold text-sm py-3.5
            bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
            text-white flex items-center justify-center gap-2 transition-all">
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          Sign In <ArrowRight size={16} />
        </button>
      </div>
    )
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setError(null)
    try {
      await authApi.post('/auth/password-reset/confirm/', {
        uid,
        token,
        new_password:  data.new_password,
        new_password2: data.new_password2,
      })
      setSuccess(true)
    } catch (err: any) {
      const msg = err?.response?.data?.token?.[0]
        || err?.response?.data?.uid?.[0]
        || err?.response?.data?.new_password?.[0]
        || err?.response?.data?.non_field_errors?.[0]
        || 'Something went wrong. Please request a new reset link.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-5 mx-auto">
          <Lock size={22} className="text-indigo-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-1.5 tracking-tight text-center">Set new password</h2>
        <p className="text-slate-400 text-sm text-center">Must be at least 8 characters</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* New Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">New Password</label>
          <div className="relative group">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input
              {...register('new_password')}
              type={showPw ? 'text' : 'password'}
              placeholder="Min 8 characters"
              className="auth-input w-full pl-10 pr-11 py-3 rounded-xl text-sm"
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.new_password && (
            <p className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={11} />{errors.new_password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirm Password</label>
          <div className="relative group">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input
              {...register('new_password2')}
              type={showCf ? 'text' : 'password'}
              placeholder="Confirm new password"
              className="auth-input w-full pl-10 pr-11 py-3 rounded-xl text-sm"
            />
            <button type="button" onClick={() => setShowCf(!showCf)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
              {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.new_password2 && (
            <p className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={11} />{errors.new_password2.message}</p>
          )}
        </div>

        <div className="pt-1">
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
              <><Loader2 size={16} className="animate-spin" /> Resetting…</>
            ) : (
              <>Reset Password <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></>
            )}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-white/15" />
      </div>
      <Link href="/login"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 hover:border-white/20
          text-slate-300 hover:text-white text-sm font-medium transition-all duration-200 bg-white/5 hover:bg-white/10">
        Back to Sign In
      </Link>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
