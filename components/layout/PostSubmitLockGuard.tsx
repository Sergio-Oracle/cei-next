'use client'

/**
 * Empêche un étudiant qui vient de soumettre son examen en avance de
 * continuer à naviguer dans la plateforme tant que l'examen est encore
 * ouvert pour les autres — pour éviter qu'il aille aider des camarades
 * pendant que ceux-ci composent encore. Vérifié côté serveur (voir
 * /api/student/post_submit_lock) à chaque connexion : fermer l'onglet et
 * revenir ne permet pas de contourner le verrou.
 *
 * Volontairement absent de app/exam/[id] (une autre composition légitime en
 * cours ne doit jamais être bloquée) — actif uniquement dans le layout du
 * tableau de bord, là où l'étudiant irait justement "traîner" après avoir fini.
 */
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'

interface LockStatus {
  locked: boolean
  unlock_at?: string
  exam_title?: string
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PostSubmitLockGuard() {
  const { user } = useAuth()
  const [status, setStatus] = useState<LockStatus | null>(null)
  const [now, setNow] = useState(Date.now())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (user?.role !== 'student') return

    async function check() {
      try {
        const res = await api.get<LockStatus>('/api/student/post_submit_lock')
        setStatus(res)
      } catch { /* en cas d'échec réseau, ne pas bloquer l'étudiant par erreur */ }
    }

    check()
    pollRef.current = setInterval(check, 20_000)
    tickRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [user?.role])

  if (user?.role !== 'student' || !status?.locked || !status.unlock_at) return null

  const remaining = new Date(status.unlock_at).getTime() - now
  if (remaining <= 0) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.94)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '36px 32px', maxWidth: 440, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <i className="fas fa-hourglass-half" style={{ fontSize: 40, color: '#d97706', marginBottom: 16, display: 'block' }} />
        <h2 style={{ margin: '0 0 10px', fontSize: 19 }}>Merci d&apos;avoir soumis votre copie</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
          {status.exam_title && <>« {status.exam_title} » n&apos;est pas encore terminé pour tous les étudiants. </>}
          Par équité, l&apos;accès à la plateforme reste bloqué quelques minutes après votre soumission.
        </p>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#d97706', fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>
          {formatRemaining(remaining)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>avant de pouvoir continuer</div>
      </div>
    </div>
  )
}
