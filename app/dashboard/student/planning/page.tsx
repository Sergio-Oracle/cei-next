'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam } from '@/types'

export default function StudentPlanningPage() {
  const { error } = useToast()
  const [exams, setExams] = useState<OnlineExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<OnlineExam[]>('/api/online_exams')
      .then(r => { const list = Array.isArray(r) ? r : (r as any).exams ?? []; setExams(list.filter((e: OnlineExam) => e.status !== 'closed')) })
      .catch(() => error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [])

  const sorted = [...exams].sort((a, b) => new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime())

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-calendar-alt" style={{ marginRight: 10, color: 'var(--primary)' }} />Planning des Examens</h2>
          <p>Vos prochains examens planifiés</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} /></div>
      ) : sorted.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-calendar-check" style={{ fontSize: 48, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }} />
          <h3>Aucun examen planifié</h3>
          <p style={{ color: 'var(--text-muted)' }}>Vos prochains examens apparaîtront ici.</p>
        </div>
      ) : (
        <div className="card">
          {sorted.map((exam, i) => {
            const start = exam.start_time ? new Date(exam.start_time) : null
            const isActive = exam.status === 'active'
            return (
              <div key={exam.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, background: isActive ? '#10b981' + '20' : 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${isActive ? '#10b981' : 'var(--border)'}` }}>
                  {start ? (<><div style={{ fontWeight: 700, fontSize: 20, lineHeight: 1, color: isActive ? '#10b981' : 'var(--text)' }}>{start.getDate()}</div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{start.toLocaleString('fr-FR', { month: 'short' })}</div></>) : <i className="fas fa-calendar" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{exam.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {start ? start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'} · {exam.duration_minutes} min
                    {exam.end_time && <> · Fin : {new Date(exam.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: isActive ? '#dcfce7' : '#eff6ff', color: isActive ? '#166534' : '#1d4ed8' }}>
                  {isActive ? 'En cours' : 'Planifié'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
