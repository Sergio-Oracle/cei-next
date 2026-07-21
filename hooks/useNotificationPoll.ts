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

const API_URL    = process.env.NEXT_PUBLIC_API_URL || 'https://dev-cei.ddns.net'
const POLL_MS    = 27_000   // légèrement inférieur au timeout serveur (25 s)
const RETRY_MS   = 3_000    // délai avant retry sur erreur réseau

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
        return true
      }
    }
  } catch {}
  return false
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
  onEventRef.current = onEvent   // toujours la version la plus récente

  useEffect(() => {
    if (!enabled) return
    activeRef.current = true

    async function poll(): Promise<void> {
      if (!activeRef.current) return

      const token = getToken()
      if (!token) {
        // Pas encore authentifié — réessayer après un délai
        await new Promise(r => setTimeout(r, 5_000))
        if (activeRef.current) poll()
        return
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), POLL_MS)

      try {
        const res = await fetch(`${API_URL}/api/notifications/poll`, {
          headers:     { Authorization: `Bearer ${token}` },
          credentials: 'include',
          signal:      controller.signal,
        })

        if (!activeRef.current) return

        if (res.status === 401) {
          const refreshed = await tryRefresh()
          if (!refreshed) {
            // Session réellement expirée — arrêter le polling au lieu de
            // boucler indéfiniment sur le même jeton invalide, et aligner
            // le comportement sur celui de lib/api.ts (déconnexion propre).
            activeRef.current = false
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            window.location.href = '/login'
            return
          }
          if (activeRef.current) poll()
          return
        }

        if (res.ok && res.status !== 204) {
          const data = await res.json()
          if (data?.has_event && data.event) {
            onEventRef.current(data.event as NotifEvent)
          }
        }
        // 204 = timeout serveur → reconnexion immédiate (comportement attendu)

      } catch (err: unknown) {
        if (!activeRef.current) return
        // AbortError = timeout ou démontage composant
        const isAbort = (err as { name?: string })?.name === 'AbortError'
        if (!isAbort) {
          // Erreur réseau réelle — attendre avant de réessayer
          await new Promise(r => setTimeout(r, RETRY_MS))
        }
      } finally {
        clearTimeout(timer)
      }

      if (activeRef.current) poll()
    }

    poll()
    return () => { activeRef.current = false }
  }, [enabled])
}
