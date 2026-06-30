'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/types'
import api from '@/lib/api'

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (u: Partial<User>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [token, setToken]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    document.cookie = 'token=; path=/; max-age=0'
    setToken(null)
    setUser(null)
    router.push('/login')
  }, [router])

  // Restore session on mount
  useEffect(() => {
    const t = localStorage.getItem('token')
    if (!t) { setLoading(false); return }
    setToken(t)
    api.get<{ user: User }>('/api/auth/me')
      .then(res => setUser(res.user ?? res as any))
      .catch(() => { localStorage.removeItem('token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; user: User }>('/api/auth/login', { email, password })
    const t = res.access_token
    localStorage.setItem('token', t)
    // Also set httpOnly-style cookie for Server Components
    document.cookie = `token=${t}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
    setToken(t)
    setUser(res.user)
    // Redirect by role
    const role = res.user.role
    if (role === 'admin')       router.push('/dashboard/admin')
    else if (role === 'professor') router.push('/dashboard/professor')
    else if (role === 'student')   router.push('/dashboard/student')
    else if (role === 'surveillant') router.push('/dashboard/surveillant')
    else router.push('/dashboard')
  }, [router])

  const updateUser = useCallback((u: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...u } : prev)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
