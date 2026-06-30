'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface StudentInfo {
  student_name:  string
  student_email: string
  status:        string
  risk_score:    number
}

interface SurveillantExam {
  id:               number
  title:            string
  status:           string
  duration_minutes: number
  start_time?:      string
  end_time?:        string
  my_students:      StudentInfo[]
  my_student_count: number
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'En cours',  color: '#059669', bg: '#ecfdf5' },
  scheduled: { label: 'Planifié', color: '#d97706', bg: '#fffbeb' },
  closed:    { label: 'Terminé',  color: '#dc2626', bg: '#fff1f2' },
  draft:     { label: 'Brouillon',color: '#64748b', bg: '#f1f5f9' },
}

const STUDENT_STATUS: Record<string, [string, string, string]> = {
  in_progress:    ['En cours',     '#3b82f6', '#dbeafe'],
  submitted:      ['Soumis',       '#10b981', '#dcfce7'],
  auto_submitted: ['Auto-soumis',  '#3b82f6', '#f3e8ff'],
  banned:         ['Exclu',        '#ef4444', '#fef2f2'],
  not_started:    ['Pas commencé', '#94a3b8', '#f1f5f9'],
}

export default function SurveillantExamsPage() {
  const { error } = useToast()
  const [exams, setExams]   = useState<SurveillantExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<any>('/api/surveillant/exams')
      setExams(res.exams ?? (Array.isArray(res) ? res : []))
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>
            <span style={{ background: '#3b82f6', width: 36, height: 36, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <i className="fas fa-clipboard-list" style={{ color: 'white', fontSize: 16 }} />
            </span>
            Mes Examens
          </h2>
          <p>{loading ? '…' : `${exams.length} examen(s) assigné(s) — liste complète avec étudiants`}</p>
        </div>
        <button className="btn btn-secondary" onClick={load}><i className="fas fa-sync-alt" /> Actualiser</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} /></div>
      ) : exams.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-clipboard-list" style={{ fontSize: 48, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }} />
          <h3>Aucun examen assigné</h3>
          <p style={{ color: 'var(--text-muted)' }}>Vos examens assignés apparaîtront ici.</p>
        </div>
      ) : exams.map(exam => {
        const sc = STATUS_CFG[exam.status] ?? STATUS_CFG.draft
        const students = exam.my_students ?? []
        const inProgress  = students.filter(s => s.status === 'in_progress').length
        const submitted   = students.filter(s => ['submitted','auto_submitted'].includes(s.status)).length
        const notStarted  = students.filter(s => s.status === 'not_started').length
        const bannedCount = students.filter(s => s.status === 'banned').length
        const dt = exam.start_time ? new Date(exam.start_time).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

        return (
          <div key={exam.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>

            {/* En-tête carte */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sc.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{exam.title}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span><i className="fas fa-calendar" style={{ marginRight: 4 }} />{dt}</span>
                  <span><i className="fas fa-clock" style={{ marginRight: 4 }} />{exam.duration_minutes} min</span>
                  <span><i className="fas fa-users" style={{ marginRight: 4 }} />{students.length} étudiant(s)</span>
                </div>
              </div>
              {exam.status === 'active' && (
                <Link href={`/proctor/${exam.id}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                  <i className="fas fa-shield-alt" /> Surveiller
                </Link>
              )}
            </div>

            {/* Barre progression mini-stats */}
            <div style={{ padding: '8px 20px', background: 'var(--background)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}><strong>{inProgress}</strong> en cours</span>
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}><strong>{submitted}</strong> soumis</span>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}><strong>{notStarted}</strong> pas commencé</span>
              {bannedCount > 0 && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}><strong>{bannedCount}</strong> exclu(s)</span>}
            </div>

            {/* Tableau étudiants */}
            {students.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--background)' }}>
                    {['Étudiant','Statut','Risque'].map(h => (
                      <th key={h} style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => {
                    const [sl, sc2, sbg] = STUDENT_STATUS[s.status] ?? ['—', '#94a3b8', '#f1f5f9']
                    const riskColor = s.risk_score >= 70 ? '#ef4444' : s.risk_score >= 40 ? '#f59e0b' : '#10b981'
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--background)' : 'transparent' }}>
                        <td style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                          {idx + 1}. {s.student_name}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.student_email}</div>
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{ background: sbg, color: sc2, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{sl}</span>
                        </td>
                        <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: riskColor }}>
                          {exam.status === 'active' || exam.status === 'closed' ? `${s.risk_score}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: 13 }}>Aucun étudiant assigné.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
