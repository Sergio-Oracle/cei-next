'use client'
/**
 * Long-polling Redis Pub/Sub via /api/notifications/poll.
 *
 * Le endpoint Flask attend au plus 25 s un événement Redis, puis répond
 * 200 (événement) ou 204 (timeout silencieux). Ce hook se reconnecte
 * immédiatement dans les deux cas — simulant un flux continu.
 *
 * Avantage vs setInterval : délai ≈ 0 dès qu'un événement arrive côté serveur.
 * Avantage vs WebSocket   : aucun état serveur, compat Nginx sans config spéciale.
 */
import { useEffect, useRef } from 'react'

const API_URL      = process.env.NEXT_PUBLIC_API_URL || 'https://dev-cei.ddns.net'
const POLL_MS      = 27_000   // légèrement inférieur au timeout serveur (25 s)
const RETRY_MS     = 3_000    // délai avant retry sur erreur réseau
const HIDDEN_WAIT  = 15_000   // onglet caché : on ne poll pas en continu

export interface NotifEvent {
  type:    string
  title:   string
  message: string
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.access_token) {
        localStorage.setItem('token', data.access_token)
        if (data.expires_in) localStorage.setItem('token_expires_at', String(Date.now() + data.expires_in * 1000))
        return true
      }
    }
  } catch {}
  return false
}

// Le token PASETO expire toutes les 15 min (ACCESS_TTL côté serveur) ; sans ça,
// le long-polling — qui tourne en continu tant que l'onglet reste ouvert —
// finit *systématiquement* par présenter un token expiré au serveur, provoquant
// un 401 visible dans la console à chaque cycle d'expiration. Le code gère déjà
// ce cas proprement (refresh + retry, cf. plus bas), mais le 401 reste visible
// dans les DevTools même quand il est intercepté côté JS. On rafraîchit donc le
// token *avant* qu'il n'expire quand on le peut, pour que ce cas attendu ne
// génère plus jamais de requête en échec.
function tokenExpiringSoon(): boolean {
  const raw = typeof window === 'undefined' ? null : localStorage.getItem('token_expires_at')
  if (!raw) return false   // pas d'info d'expiration connue (ancien login) — laisser le repli réactif faire son travail
  const expiresAt = Number(raw)
  return Number.isFinite(expiresAt) && expiresAt - Date.now() < POLL_MS
}

function isPageVisible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState !== 'hidden'
}

/**
 * @param enabled  Activer le long-polling (lier à `!!user`)
 * @param onEvent  Callback appelé à chaque événement reçu du serveur
 */
export function useNotificationPoll(
  enabled: boolean,
  onEvent: (ev: NotifEvent) => void,
): void {
  const activeRef  = useRef(false)
  const onEventRef = useRef(onEvent)
  const timeoutRef = useRef<number | null>(null)
  onEventRef.current = onEvent   // toujours la version la plus récente

  useEffect(() => {
    if (!enabled) {
      activeRef.current = false
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    activeRef.current = true
    let cancelled = false

    const schedule = (delay: number) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = window.setTimeout(() => {
        if (!cancelled && activeRef.current) {
          void poll()
        }
      }, delay)
    }

    async function poll(): Promise<void> {
      if (!activeRef.current || cancelled) return
      if (!isPageVisible()) {
        schedule(HIDDEN_WAIT)
        return
      }

      let token = getToken()
      if (!token) {
        schedule(5_000)
        return
      }

      if (tokenExpiringSoon()) {
        await tryRefresh()
        if (!activeRef.current || cancelled) return
        token = getToken()
      }

      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), POLL_MS)

      try {
        const res = await fetch(`${API_URL}/api/notifications/poll`, {
          headers:     { Authorization: `Bearer ${token}` },
          credentials: 'include',
          signal:      controller.signal,
        })

        if (!activeRef.current || cancelled) return

        if (res.status === 401) {
          const refreshed = await tryRefresh()
          if (!refreshed) {
            activeRef.current = false
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            window.location.href = '/login'
            return
          }
          schedule(0)
          return
        }

        if (res.ok && res.status !== 204) {
          const data = await res.json()
          if (data?.has_event && data.event) {
            onEventRef.current(data.event as NotifEvent)
          }
        }
      } catch (err: unknown) {
        if (!activeRef.current || cancelled) return
        const isAbort = (err as { name?: string })?.name === 'AbortError'
        if (!isAbort) {
          schedule(RETRY_MS)
          return
        }
      } finally {
        window.clearTimeout(timer)
      }

      if (!cancelled && activeRef.current) {
        schedule(0)
      }
    }

    const handleVisibility = () => {
      if (!activeRef.current || cancelled) return
      if (isPageVisible()) {
        schedule(0)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleVisibility)
    schedule(0)

    return () => {
      cancelled = true
      activeRef.current = false
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleVisibility)
    }
  }, [enabled])
}
