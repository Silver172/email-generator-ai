'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { APIError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type Form = z.infer<typeof schema>

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password',
  account_inactive: 'This account has been deactivated',
  use_google_login: 'This account uses Google Sign-In',
}

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [showPw, setShowPw] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    try {
      await login(data.email, data.password)
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof APIError) {
        toast.error(ERROR_MESSAGES[err.data?.detail as string] ?? 'Something went wrong')
      }
    }
  }

  return (
    <div className="bg-[#111118] border border-white/8 rounded-xl p-8 shadow-2xl">
      {/* Logo */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-semibold text-white tracking-tight">EmailGen</span>
        </div>
        <h1 className="text-xl font-semibold text-white">Sign in</h1>
        <p className="text-sm text-zinc-500 mt-1">Enter your credentials to continue</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className={`w-full rounded-lg border bg-white/5 px-3 py-2.5 pr-10 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors duration-150 ${
                errors.password
                  ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                  : 'border-white/10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
              }`}
              {...register('password')}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPw ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {errors.password && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <ErrorIcon /> {errors.password.message}
            </p>
          )}
        </div>

        <div className="pt-1">
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-xs text-zinc-600">or</span>
        <div className="flex-1 h-px bg-white/8" />
      </div>

      <button
        type="button"
        onClick={() => toast.info('Configure GOOGLE_CLIENT_ID in .env to enable Google login')}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm font-medium text-zinc-300 hover:bg-white/10 hover:border-white/20 transition-colors duration-150"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="text-center text-sm text-zinc-500 mt-6">
        No account?{' '}
        <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
          Sign up
        </Link>
      </p>
    </div>
  )
}

function Eye() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function EyeOff() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm.75-3.75a.75.75 0 0 1-1.5 0V5.75a.75.75 0 0 1 1.5 0v2z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
