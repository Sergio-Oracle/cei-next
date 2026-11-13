'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import type { OnlineExam } from '@/types'

/* Surveillance en direct — point d'entrée de l'administrateur et du responsable d'examen : les examens en cours,
   chacun avec son bouton « Surveiller » (page de surveillance), et ceux qui démarrent bientôt. */

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ', ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const SOON_MS = 24 * 3600 * 1000

export default function AdminSurveillancePage() {
  const [exams, setExams] = useState<OnlineExam[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  async function load() {
    try {
      const res = await api.get<OnlineExam[]>('/api/online_exams')
      setExams(Array.isArray(res) ? res : (res as any).exams ?? [])
      setNow(Date.now())
      setFailed(false)
    } catch { setFailed(true) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  const active = exams.filter(e => e.status === 'active')
  const soon = exams
    .filter(e => e.status === 'scheduled' && e.start_time && new Date(e.start_time).getTime() - now < SOON_MS && new Date(e.start_time).getTime() > now - 3600_000)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  const row = (e: OnlineExam, live: boolean) => (
    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: live ? '#16a34a' : '#94a3b8', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: '#1e3a8a' }}>{e.title}</div>
        <div style={{ fontSize: 14.5, color: 'var(--text-muted)' }}>
          {e.subject_title ? `${e.subject_title} · ` : ''}{e.start_time ? fmtDate(e.start_time) : '—'} → {e.end_time ? fmtDate(e.end_time) : '—'}
        </div>
      </div>
      {live ? (
        <Link href={`/proctor/monitor/${e.id}`} className="btn btn-primary">
          <i className="fas fa-shield-alt" /> Surveiller
        </Link>
      ) : (
        <Link href={`/dashboard/admin/exams/${e.id}`} className="btn btn-secondary">
          <i className="fas fa-eye" /> Détails
        </Link>
      )}
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-shield-alt" style={{ color: 'var(--primary)', fontSize: 24 }} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Surveillance</h2>
            <p style={{ margin: 0, fontSize: 15.5, color: 'var(--text-muted)' }}>Suivez en direct les examens en cours</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" /></div>
      ) : failed && exams.length === 0 ? (
        <div className="card" style={{ padding: 24, color: 'var(--text-muted)' }}>Impossible de charger les examens. Réessayez dans un instant.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><h3><i className="fas fa-circle-play" style={{ marginRight: 8, color: '#16a34a' }} />Examens en cours ({active.length})</h3></div>
            {active.length === 0
              ? <div style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: 15.5 }}>Aucun examen en cours pour le moment.</div>
              : active.map(e => row(e, true))}
          </div>
          <div className="card">
            <div className="card-header"><h3><i className="fas fa-calendar-day" style={{ marginRight: 8, color: 'var(--primary)' }} />À venir dans les 24 h ({soon.length})</h3></div>
            {soon.length === 0
              ? <div style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: 15.5 }}>Aucun examen planifié dans les prochaines 24 heures.</div>
              : soon.map(e => row(e, false))}
          </div>
        </>
      )}
    </div>
  )
}
