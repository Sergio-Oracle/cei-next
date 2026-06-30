'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam } from '@/types'

interface OnlineResult {
  attempt_id: number
  exam_id: number
  exam_title: string
  subject_title?: string
  score: number | null
  feedback?: string
  corrected_at?: string
  submitted_at?: string
  auto_correct?: boolean
  has_reclamation?: boolean
  reclamation_status?: string
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const { error } = useToast()
  const [results, setResults] = useState<OnlineResult[]>([])
  const [exams, setExams] = useState<OnlineExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [resResults, resExams] = await Promise.allSettled([
        api.get<OnlineResult[]>('/api/student/online_results'),
        api.get<OnlineExam[]>('/api/online_exams'),
      ])
      if (resResults.status === 'fulfilled') {
        const r = resResults.value
        setResults(Array.isArray(r) ? r : (r as any).results ?? [])
      }
      if (resExams.status === 'fulfilled') {
        const e = resExams.value
        setExams(Array.isArray(e) ? e : (e as any).exams ?? [])
      }
    } catch { error('Erreur chargement') }
    finally { setLoading(false) }
  }

  const activeExams = exams.filter(e => e.status === 'active')
  const recentResults = results.slice(0, 5)

  const scoredResults = results.filter(r => r.score != null)
  const avgScore = scoredResults.length > 0
    ? scoredResults.reduce((s, r) => s + (r.score ?? 0), 0) / scoredResults.length
    : null
  const admisCount = scoredResults.filter(r => (r.score ?? 0) >= 10).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-graduation-cap" style={{ marginRight: 10, color: 'var(--primary)' }} />Mon espace</h2>
          <p>Bienvenue, {user?.full_name}</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><i className="fa-solid fa-spinner spin" style={{ fontSize: 32 }} /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
            <div className="stat-card" style={{ borderColor: '#3b82f6' }}>
              <div className="stat-label"><i className="fa-solid fa-clipboard-check" style={{ color: '#3b82f6' }} /> Évaluations</div>
              <div className="stat-value" style={{ color: '#3b82f6' }}>{results.length}</div>
            </div>
            <div className="stat-card" style={{ borderColor: '#10b981' }}>
              <div className="stat-label"><i className="fa-solid fa-star" style={{ color: '#10b981' }} /> Moyenne générale</div>
              <div className="stat-value" style={{ color: '#10b981' }}>{avgScore != null ? `${avgScore.toFixed(1)}/20` : '—'}</div>
            </div>
            <div className="stat-card" style={{ borderColor: '#3b82f6' }}>
              <div className="stat-label"><i className="fa-solid fa-trophy" style={{ color: '#3b82f6' }} /> Admis</div>
              <div className="stat-value" style={{ color: '#3b82f6' }}>{admisCount}</div>
            </div>
          </div>

          {/* Examens disponibles */}
          {activeExams.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 12, color: 'var(--success)' }}>
                <i className="fa-solid fa-circle" style={{ fontSize: 10, marginRight: 8 }} />Examens disponibles
              </h3>
              <div className="grid">
                {activeExams.map(exam => (
                  <div key={exam.id} className="card" style={{ borderLeft: '4px solid var(--success)' }}>
                    <div style={{ padding: 20 }}>
                      <h3 style={{ marginBottom: 8 }}>{exam.title}</h3>
                      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>
                        <i className="fa-solid fa-clock" /> {exam.duration_minutes} minutes
                        {exam.end_time && <> · Fin : {new Date(exam.end_time).toLocaleTimeString('fr-FR')}</>}
                      </div>
                      <Link href={`/exam/${exam.id}`} className="btn btn-success btn-block">
                        <i className="fa-solid fa-play" /> Commencer l'examen
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Résultats récents */}
          {recentResults.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 12 }}><i className="fa-solid fa-chart-line" style={{ marginRight: 8 }} />Résultats récents</h3>
              <div className="card">
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr><th>Examen</th><th>Matière</th><th>Score</th><th>Feedback</th><th>Correction</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {recentResults.map(r => (
                        <tr key={r.attempt_id}>
                          <td><div style={{ fontWeight: 600 }}>{r.exam_title}</div></td>
                          <td><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{r.subject_title ?? '—'}</span></td>
                          <td>
                            {r.score != null
                              ? <strong style={{ color: (r.score ?? 0) >= 10 ? 'var(--success)' : 'var(--danger)' }}>{r.score}/20</strong>
                              : <span className="status-badge warning">En correction</span>
                            }
                          </td>
                          <td>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {r.feedback ? r.feedback.substring(0, 60) + (r.feedback.length > 60 ? '...' : '') : '—'}
                            </span>
                          </td>
                          <td>{r.corrected_at ? new Date(r.corrected_at).toLocaleDateString('fr-FR') : '—'}</td>
                          <td>
                            {!r.has_reclamation && r.score != null && (
                              <Link href={`/dashboard/student/reclamations?attempt_id=${r.attempt_id}`} className="btn btn-sm btn-warning" title="Faire une réclamation">
                                <i className="fa-solid fa-comment-exclamation" />
                              </Link>
                            )}
                            {r.has_reclamation && (
                              <span className={`status-badge ${r.reclamation_status === 'resolved' ? 'success' : r.reclamation_status === 'rejected' ? 'danger' : 'warning'}`} style={{ fontSize: 11 }}>
                                {r.reclamation_status}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {results.length === 0 && activeExams.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <i className="fa-solid fa-graduation-cap" style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 16, display: 'block' }} />
              <h3>Aucune donnée disponible</h3>
              <p style={{ color: 'var(--text-muted)' }}>Vos examens et résultats apparaîtront ici.</p>
            </div>
          )}

          {/* Liens rapides */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 24 }}>
            {[
              { href: '/dashboard/student/results', icon: 'fa-chart-line', label: 'Mes résultats', color: '#3b82f6' },
              { href: '/dashboard/student/papers', icon: 'fa-file-pen', label: 'Mes copies', color: '#3b82f6' },
              { href: '/dashboard/student/transcripts', icon: 'fa-scroll', label: 'Relevés de notes', color: '#10b981' },
              { href: '/dashboard/student/reclamations', icon: 'fa-comment-exclamation', label: 'Réclamations', color: '#f59e0b' },
            ].map((a, i) => (
              <Link key={i} href={a.href} style={{ textDecoration: 'none' }}>
                <div className="stat-card" style={{ borderColor: a.color, cursor: 'pointer', textAlign: 'center' }}>
                  <i className={`fa-solid ${a.icon}`} style={{ fontSize: 24, color: a.color, marginBottom: 8, display: 'block' }} />
                  <div style={{ color: a.color, fontWeight: 600 }}>{a.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
