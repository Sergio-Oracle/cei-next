'use client'
/**
 * Abonnement ntfy via Server-Sent Events (EventSource).
 *
 * ntfy expose /{topic}/sse — le navigateur maintient une connexion HTTP
 * persistante et reçoit les événements en streaming sans WebSocket.
 *
 * Variable d'environnement :
 *   NEXT_PUBLIC_NTFY_URL = https://dev-cei.ddns.net/ntfy
 *
 * Usage — surveillance :
 *   useNtfy(`exam-${examId}`, (msg) => showAlert(msg.message))
 *
 * Usage — étudiant :
 *   useNtfy(`student-${user.id}`, (msg) => refreshGrades())
 */
import { useEffect, useRef } from 'react'

const NTFY_URL  = (process.env.NEXT_PUBLIC_NTFY_URL || '').replace(/\/$/, '')
const RETRY_MS  = 5_000

export interface NtfyMessage {
  id?:       string
  title?:    string
  message:   string
  priority?: number
  tags?:     string[]
  event?:    string   // 'message' | 'keepalive' | 'open'
}

/**
 * @param topic     Nom du topic ntfy, ou null pour désactiver
 * @param onMessage Callback appelé à chaque notification reçue
 */
export function useNtfy(
  topic: string | null,
  onMessage: (msg: NtfyMessage) => void,
): void {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (!topic || !NTFY_URL) return

    const url = `${NTFY_URL}/${topic}/sse`
    let active = true
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (!active) return
      es = new EventSource(url)

      es.onmessage = (e: MessageEvent) => {
        try {
          const msg: NtfyMessage = JSON.parse(e.data)
          // Ignorer les keepalives ntfy
          if (msg.event === 'keepalive' || msg.event === 'open') return
          onMessageRef.current(msg)
        } catch {}
      }

      es.addEventListener('open', () => {
        // Connexion établie — rien à faire
      })

      es.onerror = () => {
        es?.close()
        es = null
        if (active) retryTimer = setTimeout(connect, RETRY_MS)
      }
    }

    connect()

    return () => {
      active = false
      if (retryTimer) clearTimeout(retryTimer)
      es?.close()
    }
  }, [topic])  // se reconnecte uniquement si le topic change
}
