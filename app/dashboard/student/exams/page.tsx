'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam } from '@/types'

export default function StudentExamsPage() {
  const { error } = useToast()
  const [exams, setExams] = useState<OnlineExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get<OnlineExam[]>('/api/online_exams')
      .then(r => setExams(Array.isArray(r) ? r : (r as any).exams ?? []))
      .catch(() => error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [])

  function statusStyle(status: string) {
    switch (status) {
      case 'active':    return { color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0', label: 'En cours' }
      case 'scheduled': return { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', label: 'Planifié' }
      case 'closed':    return { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Clôturé' }
      default:          return { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', label: status }
    }
  }

  const active    = exams.filter(e => e.status === 'active')
  const scheduled = exams.filter(e => e.status === 'scheduled')
  const closed    = exams.filter(e => e.status === 'closed')

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-laptop-code" style={{ marginRight: 10, color: 'var(--primary)' }} />Mes Examens en Ligne</h2>
          <p>{exams.length} examen(s) disponible(s)</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} /></div>
      ) : exams.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-laptop-code" style={{ fontSize: 48, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }} />
          <h3>Aucun examen disponible</h3>
          <p style={{ color: 'var(--text-muted)' }}>Vos examens apparaîtront ici lorsqu'ils seront planifiés.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 12, color: '#10b981' }}><i className="fas fa-circle" style={{ fontSize: 10, marginRight: 8 }} />En cours</h3>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {active.map(exam => {
                  const s = statusStyle(exam.status)
                  return (
                    <div key={exam.id} className="card" style={{ border: `2px solid ${s.border}`, background: s.bg }}>
                      <div style={{ padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <h3 style={{ flex: 1, marginRight: 8 }}>{exam.title}</h3>
                          <span style={{ fontSize: 12, fontWeight: 700, color: s.color, background: s.color + '20', padding: '2px 8px', borderRadius: 20 }}>{s.label}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                          <i className="fas fa-clock" /> {exam.duration_minutes} min
                          {exam.end_time && <> · Fin : {new Date(exam.end_time).toLocaleTimeString('fr-FR')}</>}
                        </div>
                        <Link href={`/exam/${exam.id}`} className="btn btn-success btn-block">
                          <i className="fas fa-play" /> Commencer l'examen
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {scheduled.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 12 }}><i className="fas fa-calendar-alt" style={{ marginRight: 8 }} />Planifiés</h3>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {scheduled.map(exam => {
                  const s = statusStyle(exam.status)
                  return (
                    <div key={exam.id} className="card" style={{ border: `1px solid ${s.border}` }}>
                      <div style={{ padding: 20 }}>
                        <h3 style={{ marginBottom: 8 }}>{exam.title}</h3>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          <i className="fas fa-calendar" /> Début : {exam.start_time ? new Date(exam.start_time).toLocaleString('fr-FR') : '—'}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          <i className="fas fa-clock" /> Durée : {exam.duration_minutes} min
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {closed.length > 0 && (
            <div>
              <h3 style={{ marginBottom: 12, color: 'var(--text-muted)' }}><i className="fas fa-history" style={{ marginRight: 8 }} />Terminés</h3>
              <div className="card">
                <table>
                  <thead><tr><th>Titre</th><th>Fin</th><th>Durée</th><th>Actions</th></tr></thead>
                  <tbody>
                    {closed.map(exam => (
                      <tr key={exam.id}>
                        <td>{exam.title}</td>
                        <td style={{ fontSize: 13 }}>{exam.end_time ? new Date(exam.end_time).toLocaleDateString('fr-FR') : '—'}</td>
                        <td>{exam.duration_minutes} min</td>
                        <td><Link href="/dashboard/student/results" className="btn btn-sm btn-secondary"><i className="fas fa-chart-bar" /> Voir notes</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
