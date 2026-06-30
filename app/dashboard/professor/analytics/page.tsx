'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface SubjectStat {
  subject_id: number
  subject_title: string
  total_papers: number
  average_score: number
  pass_rate: number
  min_score: number
  max_score: number
}

interface Analytics {
  subjects_stats?: SubjectStat[]
  total_exams?: number
  total_papers?: number
  overall_average?: number
  overall_pass_rate?: number
}

export default function ProfessorAnalyticsPage() {
  const { error } = useToast()
  const [analytics, setAnalytics] = useState<Analytics>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<Analytics>('/api/professor/analytics')
      setAnalytics(res)
    } catch { error('Erreur chargement analytiques') }
    finally { setLoading(false) }
  }

  function scoreColor(score: number) {
    if (score >= 14) return '#10b981'
    if (score >= 10) return '#3b82f6'
    if (score >= 7) return '#f59e0b'
    return '#ef4444'
  }

  function passColor(rate: number) {
    if (rate >= 80) return '#10b981'
    if (rate >= 60) return '#3b82f6'
    if (rate >= 40) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-chart-bar" style={{ marginRight: 10, color: 'var(--primary)' }} />Analytiques</h2>
          <p>Statistiques et résultats de vos examens</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <i className="fa-solid fa-rotate" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><i className="fa-solid fa-spinner spin" style={{ fontSize: 32 }} /></div>
      ) : (
        <>
          {/* Global stats */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
            {[
              { label: 'Examens',        value: analytics.total_exams ?? 0,          icon: 'fa-monitor-waveform', color: '#3b82f6' },
              { label: 'Copies',         value: analytics.total_papers ?? 0,         icon: 'fa-file-pen',         color: '#3b82f6' },
              { label: 'Moy. générale',  value: analytics.overall_average != null ? `${analytics.overall_average.toFixed(1)}/20` : '—', icon: 'fa-star', color: scoreColor(analytics.overall_average ?? 0) },
              { label: 'Taux réussite',  value: analytics.overall_pass_rate != null ? `${analytics.overall_pass_rate.toFixed(0)}%` : '—', icon: 'fa-trophy', color: passColor(analytics.overall_pass_rate ?? 0) },
            ].map((s, i) => (
              <div key={i} className="stat-card" style={{ borderColor: s.color }}>
                <div className="stat-label"><i className={`fa-solid ${s.icon}`} style={{ color: s.color }} /> {s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Par sujet */}
          {(analytics.subjects_stats ?? []).length > 0 && (
            <div className="card">
              <div className="card-header"><h3><i className="fa-solid fa-chart-column" /> Statistiques par sujet</h3></div>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr><th>Sujet</th><th>Copies</th><th>Moyenne</th><th>Min</th><th>Max</th><th>Taux réussite</th></tr>
                  </thead>
                  <tbody>
                    {(analytics.subjects_stats ?? []).map(s => (
                      <tr key={s.subject_id}>
                        <td><div style={{ fontWeight: 600 }}>{s.subject_title}</div></td>
                        <td>{s.total_papers}</td>
                        <td>
                          <strong style={{ color: scoreColor(s.average_score) }}>{s.average_score?.toFixed(1)}/20</strong>
                        </td>
                        <td style={{ color: '#ef4444' }}>{s.min_score?.toFixed(1)}</td>
                        <td style={{ color: '#10b981' }}>{s.max_score?.toFixed(1)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', minWidth: 80 }}>
                              <div style={{ height: '100%', width: `${Math.min(s.pass_rate ?? 0, 100)}%`, background: passColor(s.pass_rate ?? 0), borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: 13, color: passColor(s.pass_rate ?? 0), fontWeight: 600 }}>{s.pass_rate?.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(analytics.subjects_stats ?? []).length === 0 && (
            <div className="card">
              <p className="empty-message">Aucune donnée analytique disponible pour le moment</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
