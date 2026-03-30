'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, Mail, Lock, User, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const registerSchema = z
  .object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    email: z.string().email('Invalid email address'),
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

const inputClass = `w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/20 text-white placeholder-slate-400 text-sm
  bg-white/[0.08] focus:bg-white/[0.12]
  focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400/50
  hover:border-white/30 hover:bg-white/[0.11] transition-all duration-200
  [&:-webkit-autofill]:!bg-indigo-950 [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:shadow-[0_0_0_1000px_rgba(79,70,229,0.15)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]`

const labelClass = "block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"

export default function RegisterPage() {
  const router = useRouter()
  const { register: registerUser } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      await registerUser({
        username: data.username,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        password: data.password,
        password2: data.confirm_password,
      })
      toast.success('Account created successfully!')
      router.push('/home')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-black text-white mb-1.5 tracking-tight">Create your account</h2>
        <p className="text-slate-400 text-sm">Join SYNAPSE and explore AI-powered tech intelligence</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm leading-snug">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* First + Last name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First Name</label>
            <div className="relative group">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
              <input {...register('first_name')} type="text" placeholder="John" className={inputClass} />
            </div>
            {errors.first_name && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.first_name.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <div className="relative group">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
              <input {...register('last_name')} type="text" placeholder="Doe" className={inputClass} />
            </div>
            {errors.last_name && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.last_name.message}</p>}
          </div>
        </div>

        {/* Username */}
        <div>
          <label className={labelClass}>Username</label>
          <div className="relative group">
            <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input {...register('username')} type="text" placeholder="johndoe" className={inputClass} />
          </div>
          {errors.username && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.username.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label className={labelClass}>Email address</label>
          <div className="relative group">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input {...register('email')} type="email" autoComplete="email" placeholder="you@example.com" className={inputClass} />
          </div>
          {errors.email && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label className={labelClass}>Password</label>
          <div className="relative group">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input {...register('password')} type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters"
              className={`${inputClass} pr-11`} />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.password.message}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label className={labelClass}>Confirm Password</label>
          <div className="relative group">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input {...register('confirm_password')} type={showConfirm ? 'text' : 'password'} placeholder="Confirm password"
              className={`${inputClass} pr-11`} />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.confirm_password && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.confirm_password.message}</p>}
        </div>

        {/* Submit */}
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
              <><Loader2 size={16} className="animate-spin" /> Creating account…</>
            ) : (
              <>Create Account <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></>
            )}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-slate-500 text-xs">Already have an account?</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <Link href="/login"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 hover:border-white/20
          text-slate-300 hover:text-white text-sm font-medium transition-all duration-200 bg-white/5 hover:bg-white/10">
        Sign in instead <ArrowRight size={14} className="text-slate-500" />
      </Link>
    </div>
  )
}
