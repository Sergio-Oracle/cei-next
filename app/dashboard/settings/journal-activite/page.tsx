'use client'

/**
 * Journal d'activité des comptes à privilèges — adresse DIRECTE, non liée depuis aucun menu ni aucune page.
 * Seul le propriétaire de la plateforme y accède : pour tout autre compte, la page se comporte comme une page
 * inexistante (et le serveur répond « introuvable » à toutes les routes /api/audit/*, voir routes/audit.py).
 */
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'

const ActivityJournal = dynamic(() => import('@/components/settings/ActivityJournal'), { ssr: false })

export default function JournalActivitePage() {
  const { user } = useAuth()
  const [state, setState] = useState<'check' | 'ok' | 'no'>('check')

  useEffect(() => {
    if (!user) return
    if (user.role !== 'admin') { setState('no'); return }
    api.get('/api/audit/access').then(() => setState('ok')).catch(() => setState('no'))
  }, [user])

  if (state === 'no') notFound()
  if (state === 'check') return <div className="loader"><div className="spinner" /></div>
  return <ActivityJournal />
}
