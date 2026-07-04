'use client'

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
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

function setAuthCookie(token: string) {
  // Cookie lisible par le middleware Next.js (edge runtime) pour le garde de routes.
  // Pas HttpOnly car posé côté client — ne remplace pas la validation serveur.
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict${secure}`
}

function clearAuthCookie() {
  document.cookie = 'token=; path=/; max-age=0; SameSite=Strict'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [token, setToken]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router   = useRouter()
  const mounted  = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    clearAuthCookie()
    if (mounted.current) { setToken(null); setUser(null) }
    router.push('/login')
  }, [router])

  // Restore session on mount — avec guard sur montage pour éviter setState orphelin
  useEffect(() => {
    const t = localStorage.getItem('token')
    if (!t) { setLoading(false); return }
    setToken(t)
    api.get<{ user: User }>('/api/auth/me')
      .then(res => { if (mounted.current) setUser(res.user ?? (res as any)) })
      .catch(() => {
        localStorage.removeItem('token')
        clearAuthCookie()
        if (mounted.current) setToken(null)
      })
      .finally(() => { if (mounted.current) setLoading(false) })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; user: User }>('/api/auth/login', { email, password })
    const t = res.access_token
    localStorage.setItem('token', t)
    setAuthCookie(t)
    if (mounted.current) { setToken(t); setUser(res.user) }
    const role = res.user.role
    if      (role === 'admin')       router.push('/dashboard/admin')
    else if (role === 'professor')   router.push('/dashboard/professor')
    else if (role === 'student')     router.push('/dashboard/student')
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
