'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam, ExamStatus } from '@/types'

function StatusBadge({ status }: { status: ExamStatus }) {
  const map: Record<ExamStatus, { label: string; cls: string }> = {
    draft:     { label: 'Brouillon', cls: 'secondary' },
    scheduled: { label: 'Planifié',  cls: 'info' },
    active:    { label: 'Actif',     cls: 'success' },
    closed:    { label: 'Clôturé',   cls: 'danger' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'secondary' }
  return <span className={`status-badge ${cls}`}>{label}</span>
}

export default function ProfessorExamsPage() {
  const { success, error } = useToast()
  const [exams, setExams] = useState<OnlineExam[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<OnlineExam[]>('/api/online_exams')
      setExams(Array.isArray(res) ? res : (res as any).exams ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function activate(id: number) {
    setActioning(id)
    try {
      await api.post(`/api/online_exams/${id}/activate`)
      success('Examen activé')
      setExams(prev => prev.map(e => e.id === id ? { ...e, status: 'active' } : e))
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActioning(null) }
  }

  async function close(id: number) {
    if (!confirm('Clôturer cet examen ?')) return
    setActioning(id)
    try {
      await api.post(`/api/online_exams/${id}/close`)
      success('Examen clôturé')
      setExams(prev => prev.map(e => e.id === id ? { ...e, status: 'closed' } : e))
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActioning(null) }
  }

  async function extend(id: number) {
    setActioning(id)
    try {
      await api.post(`/api/online_exams/${id}/extend`, { minutes: 15 })
      success('+15 minutes ajoutées')
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActioning(null) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-monitor-waveform" style={{ marginRight: 10, color: 'var(--primary)' }} />Mes examens</h2>
          <p>Gérez vos examens en ligne</p>
        </div>
        <Link href="/dashboard/professor/exams/new" className="btn btn-primary">
          <i className="fa-solid fa-plus" /> Nouvel examen
        </Link>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Titre</th><th>Statut</th><th>Début</th><th>Durée</th><th>Participants</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner spin" /> Chargement...</td></tr>
              ) : exams.length === 0 ? (
                <tr><td colSpan={6} className="empty-message">Aucun examen</td></tr>
              ) : exams.map(exam => (
                <tr key={exam.id}>
                  <td>
                    <Link href={`/dashboard/professor/exams/${exam.id}`} style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                      {exam.title}
                    </Link>
                  </td>
                  <td><StatusBadge status={exam.status} /></td>
                  <td>{exam.start_time ? new Date(exam.start_time).toLocaleString('fr-FR') : '—'}</td>
                  <td>{exam.duration_minutes} min</td>
                  <td><span className="status-badge info">{exam.attempts_count ?? 0}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {exam.status === 'active' && (
                        <Link href={`/proctor/${exam.id}`} className="btn btn-sm btn-info" title="Surveiller">
                          <i className="fa-solid fa-eye" />
                        </Link>
                      )}
                      {(exam.status === 'draft' || exam.status === 'scheduled') && (
                        <button className="btn btn-sm btn-success" onClick={() => activate(exam.id)} disabled={actioning === exam.id} title="Activer">
                          {actioning === exam.id ? <i className="fa-solid fa-spinner spin" /> : <i className="fa-solid fa-play" />}
                        </button>
                      )}
                      {exam.status === 'active' && (
                        <>
                          <button className="btn btn-sm btn-warning" onClick={() => close(exam.id)} disabled={actioning === exam.id} title="Clôturer">
                            {actioning === exam.id ? <i className="fa-solid fa-spinner spin" /> : <i className="fa-solid fa-stop" />}
                          </button>
                          <button className="btn btn-sm btn-secondary" onClick={() => extend(exam.id)} disabled={actioning === exam.id} title="+15 min">
                            <i className="fa-solid fa-clock" /> +15
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
