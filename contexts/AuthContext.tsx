'use client'

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/types'
import api from '@/lib/api'
import { getLtiReturn, clearLtiReturn } from '@/lib/ltiReturn'

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string, force?: boolean) => Promise<void>
  logout: () => void
  updateUser: (u: Partial<User>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// C-06 : ce cookie ne contient plus le jeton lui-même (avant : lisible par tout
// script JS, donc par une XSS — voir lib/api.ts pour où le vrai jeton vit
// désormais). Il ne sert qu'à indiquer au middleware Next.js (édge, côté
// serveur) qu'une session existe, pour rediriger vers /login sans round-trip —
// aucune valeur secrète dedans, donc aucun risque à ce qu'il reste lisible en JS.
function setAuthCookie() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `cei_logged_in=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict${secure}`
}

function clearAuthCookie() {
  document.cookie = 'cei_logged_in=; path=/; max-age=0; SameSite=Strict'
}

// Profil gardé dans le navigateur (nom, rôle… jamais le jeton) pour afficher
// le tableau de bord tout de suite au rechargement, pendant que la session est
// vérifiée. Les droits restent contrôlés par l'API à chaque appel ; si la
// vérification échoue, le profil est effacé et l'utilisateur renvoyé à la connexion.
const USER_CACHE_KEY = 'user'
function readCachedUser(): User | null {
  try {
    if (!document.cookie.includes('cei_logged_in=1')) return null
    const raw = localStorage.getItem(USER_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function cacheUser(u: User | null) {
  try { u ? localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_CACHE_KEY) } catch {}
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
    // Ouvert depuis Moodle (bouton « CEI ») : quitter CEI ramène dans Moodle.
    // On part AVANT de vider l'état React : sinon le garde du tableau de bord
    // affiche la page de connexion CEI le temps que Moodle réponde. Révocation
    // en keepalive, pour qu'elle survive au départ de la page.
    const moodle = getLtiReturn()
    if (moodle) {
      api.postBeacon('/api/auth/logout')   // lit le jeton : avant tout nettoyage
      localStorage.removeItem('user')
      clearAuthCookie()
      navigator.serviceWorker?.controller?.postMessage('CLEAR_PAGE_CACHE')
      clearLtiReturn()
      window.location.replace(moodle)
      return
    }
    // Révoque le refresh token côté serveur (blocklist) — best-effort : on ne
    // bloque pas la déconnexion locale si l'appel échoue (token déjà expiré,
    // réseau coupé, etc.), l'utilisateur doit pouvoir se déconnecter dans tous les cas.
    api.post('/api/auth/logout').catch(() => {})
    api.setToken(null)
    localStorage.removeItem('user')
    clearAuthCookie()
    // C-15 : filet de sécurité, purge tout cache de page qu'un Service Worker
    // antérieur à ce correctif aurait pu laisser (le SW actuel ne met déjà en
    // cache que les pages publiques, donc normalement rien à purger ici).
    navigator.serviceWorker?.controller?.postMessage('CLEAR_PAGE_CACHE')
    if (mounted.current) { setToken(null); setUser(null) }
    router.push('/login')
  }, [router])

  // Restore session on mount — le jeton d'accès n'est plus persisté (C-06), on le
  // reconstitue silencieusement via /api/auth/refresh, qui s'appuie sur le refresh
  // token déjà présent en cookie HttpOnly (posé par le serveur au login précédent).
  // Le profil gardé s'affiche aussitôt ; /api/auth/refresh renvoie le profil à
  // jour avec le jeton (plus de /api/auth/me séparé).
  useEffect(() => {
    const cached = readCachedUser()
    if (cached) { setUser(cached); setLoading(false) }
    api.refresh().then((t: string | null) => {
      if (!mounted.current) return
      if (!t) {
        cacheUser(null)
        if (cached) { clearAuthCookie(); setUser(null) }
        setLoading(false); return
      }
      setToken(t)
      const fresh = api.refreshUser()
      if (fresh) {
        setUser(fresh); cacheUser(fresh); setLoading(false)
        return
      }
      api.get<{ user: User }>('/api/auth/me')
        .then(res => { if (mounted.current) { const u = res.user ?? (res as any); setUser(u); cacheUser(u) } })
        .catch(() => {
          api.setToken(null)
          clearAuthCookie(); cacheUser(null)
          if (mounted.current) { setToken(null); setUser(null) }
        })
        .finally(() => { if (mounted.current) setLoading(false) })
    })
  }, [])

  const login = useCallback(async (email: string, password: string, force?: boolean) => {
    const res = await api.post<{ access_token: string; user: User; expires_in?: number }>('/api/auth/login', { email, password, force })
    const t = res.access_token
    api.setToken(t, res.expires_in)
    setAuthCookie()
    if (mounted.current) { setToken(t); setUser(res.user) }
    cacheUser(res.user)
    const role = res.user.role
    if      (role === 'admin')       router.push('/dashboard/admin')
    else if (role === 'professor')   router.push('/dashboard/professor')
    else if (role === 'student')     router.push('/dashboard/student')
    else if (role === 'surveillant') router.push('/dashboard/surveillant')
    else if (role === 'superviseur') router.push('/dashboard/superviseur')
    else router.push('/dashboard')
  }, [router])

  const updateUser = useCallback((u: Partial<User>) => {
    setUser(prev => { const next = prev ? { ...prev, ...u } : prev; cacheUser(next); return next })
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
