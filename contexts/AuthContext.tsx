'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, APIError } from '@/lib/api'
import { setTokens, clearTokens, getAccessToken } from '@/lib/auth'
import type { TokenResponse, User } from '@/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, fullName: string, password: string) => Promise<void>
  loginWithGoogle: (token: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAccessToken()
    if (!token) { setLoading(false); return }

    api.auth.me()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false))
  }, [])

  const handle = (data: TokenResponse) => {
    setTokens(data.access_token, data.refresh_token)
    setUser(data.user)
  }

  const login = async (email: string, password: string) => {
    handle(await api.auth.login({ email, password }))
  }

  const register = async (email: string, fullName: string, password: string) => {
    handle(await api.auth.register({ email, full_name: fullName, password }))
  }

  const loginWithGoogle = async (token: string) => {
    handle(await api.auth.google(token))
  }

  const logout = async () => {
    await api.auth.logout().catch(() => {})
    clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
