'use client'
/**
 * Poll court de /api/notifications/poll.
 *
 * L'endpoint Flask draine la file Redis de l'utilisateur et répond
 * *immédiatement* : `{ has_events, events: [...] }` (éventuellement vide).
 * Aucune connexion tenue côté serveur — ce hook rappelle simplement
 * l'endpoint toutes les ~15 s (onglet visible) ou ~60 s (onglet caché),
 * avec rattrapage immédiat au retour au premier plan / retour réseau.
 *
 * Remplace l'ancien long-polling Redis Pub/Sub (une connexion Gunicorn
 * tenue 25 s par client). Compromis assumé : latence de bout en bout
 * jusqu'à l'intervalle de poll au lieu de ≈ 0.
 */
import { useEffect, useRef } from 'react'

const API_URL         = process.env.NEXT_PUBLIC_API_URL || 'https://dev-cei.ddns.net'
const POLL_VISIBLE_MS = 15_000   // onglet au premier plan
const POLL_HIDDEN_MS  = 60_000   // onglet caché — on ralentit sans couper
const RETRY_MS        = 5_000    // délai avant retry sur erreur réseau
const REQ_TIMEOUT_MS  = 12_000   // garde-fou : la requête doit être quasi instantanée

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

// Le token PASETO expire toutes les 15 min (ACCESS_TTL côté serveur). On le
// rafraîchit avant expiration quand on le peut, pour qu'un cycle de poll ne
// tombe pas systématiquement sur un 401 (attendu, géré, mais visible dans les
// DevTools).
function tokenExpiringSoon(): boolean {
  const raw = typeof window === 'undefined' ? null : localStorage.getItem('token_expires_at')
  if (!raw) return false
  const expiresAt = Number(raw)
  return Number.isFinite(expiresAt) && expiresAt - Date.now() < POLL_VISIBLE_MS
}

function isPageVisible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState !== 'hidden'
}

function nextDelay(): number {
  return isPageVisible() ? POLL_VISIBLE_MS : POLL_HIDDEN_MS
}

/**
 * @param enabled  Activer le poll (lier à `!!user`)
 * @param onEvent  Callback appelé une fois par événement reçu
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
      const timer = window.setTimeout(() => controller.abort(), REQ_TIMEOUT_MS)

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

        if (res.ok) {
          const data = await res.json()
          const events: NotifEvent[] = Array.isArray(data?.events)
            ? data.events
            : (data?.event ? [data.event] : [])   // repli client d'une version précédente
          for (const ev of events) {
            if (ev && ev.type) onEventRef.current(ev as NotifEvent)
          }
        }
      } catch {
        if (!activeRef.current || cancelled) return
        // AbortError (timeout requête) ou erreur réseau → retry rapproché
        schedule(RETRY_MS)
        return
      } finally {
        window.clearTimeout(timer)
      }

      if (!cancelled && activeRef.current) {
        schedule(nextDelay())
      }
    }

    const handleWake = () => {
      if (!activeRef.current || cancelled) return
      if (isPageVisible()) schedule(0)   // rattrapage immédiat
    }

    document.addEventListener('visibilitychange', handleWake)
    window.addEventListener('online', handleWake)
    schedule(0)

    return () => {
      cancelled = true
      activeRef.current = false
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      document.removeEventListener('visibilitychange', handleWake)
      window.removeEventListener('online', handleWake)
    }
  }, [enabled])
}
