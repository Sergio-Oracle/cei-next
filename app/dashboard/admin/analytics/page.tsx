'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface AdminDashboard {
  total_users?: number
  total_students?: number
  total_professors?: number
  total_surveillants?: number
  total_subjects?: number
  total_papers?: number
  total_corrected_papers?: number
  pending_reclamations?: number
}

interface ExamStat {
  title: string
  avg_score: number
  pass_rate: number
  corrected: number
}

interface RecentCorrection {
  student_name: string
  exam_title: string
  score: number | null
  corrected_at: string
}

interface ExamAnalytics {
  total_exams?: number
  total_attempts?: number
  total_submitted?: number
  total_corrected?: number
  overall_avg?: number | null
  overall_pass_rate?: number | null
  status_counts?: Record<string, number>
  top_exams?: ExamStat[]
  bottom_exams?: ExamStat[]
  recent_corrections?: RecentCorrection[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Actif',      color: '#10b981' },
  scheduled: { label: 'Planifié',   color: '#3b82f6' },
  closed:    { label: 'Terminé',    color: '#64748b' },
  draft:     { label: 'Brouillon',  color: '#f59e0b' },
}

function scoreColor(v: number | null | undefined): string {
  if (v == null) return '#64748b'
  if (v >= 14)  return '#10b981'
  if (v >= 10)  return '#3b82f6'
  if (v >= 7)   return '#f59e0b'
  return '#ef4444'
}

export default function AdminAnalyticsPage() {
  const { error } = useToast()
  const [dash, setDash]   = useState<AdminDashboard>({})
  const [exams, setExams] = useState<ExamAnalytics>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [dashRes, examRes] = await Promise.allSettled([
        api.get<AdminDashboard>('/api/admin/dashboard'),
        api.get<ExamAnalytics>('/api/professor/analytics'),
      ])
      if (dashRes.status === 'fulfilled') setDash(dashRes.value)
      if (examRes.status === 'fulfilled') setExams(examRes.value)
    } catch { error('Erreur de chargement des analytiques') }
    finally { setLoading(false) }
  }

  const statusCounts = exams.status_counts ?? {}

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-chart-bar" style={{ color: 'var(--primary)' }} />Analytique
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
            Statistiques et analyses de la plateforme
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <i className="fas fa-rotate" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--primary)', display: 'block', marginBottom: 14 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chargement des analytiques…</span>
        </div>
      ) : (
        <>
          {/* Section utilisateurs */}
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 10px' }}>
              <i className="fas fa-users" style={{ marginRight: 6 }} />Utilisateurs de la plateforme
            </p>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { icon: 'fa-users',              label: 'Total utilisateurs',  value: dash.total_users ?? 0,              color: '#2563eb', bg: '#dbeafe' },
                { icon: 'fa-user-graduate',       label: 'Étudiants',          value: dash.total_students ?? 0,           color: '#0ea5e9', bg: '#e0f2fe' },
                { icon: 'fa-chalkboard-teacher',  label: 'Professeurs',        value: dash.total_professors ?? 0,         color: '#10b981', bg: '#d1fae5' },
                { icon: 'fa-eye',                 label: 'Surveillants',       value: dash.total_surveillants ?? 0,       color: '#f59e0b', bg: '#fef3c7' },
              ].map(({ icon, label, value, color, bg }) => (
                <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fas ${icon}`} style={{ color, fontSize: 16 }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color }}>{value}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section copies et examens */}
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 10px' }}>
              <i className="fas fa-file-alt" style={{ marginRight: 6 }} />Sujets & Corrections
            </p>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { icon: 'fa-file-alt',          label: 'Sujets créés',        value: dash.total_subjects ?? 0,            color: '#0f766e', bg: '#f0fdfa' },
                { icon: 'fa-file',              label: 'Copies totales',      value: dash.total_papers ?? 0,              color: '#0891b2', bg: '#e0f2fe' },
                { icon: 'fa-clipboard-check',   label: 'Copies corrigées',   value: dash.total_corrected_papers ?? 0,    color: '#10b981', bg: '#d1fae5' },
                { icon: 'fa-exclamation-triangle', label: 'Réclamations en attente', value: dash.pending_reclamations ?? 0, color: '#ef4444', bg: '#fee2e2' },
              ].map(({ icon, label, value, color, bg }) => (
                <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fas ${icon}`} style={{ color, fontSize: 16 }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color }}>{value}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KPI Examens en ligne */}
          {(exams.total_exams != null || exams.overall_avg != null) && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 10px' }}>
                <i className="fas fa-laptop-code" style={{ marginRight: 6 }} />Examens en Ligne
                {Object.keys(statusCounts).length > 0 && (
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 12 }}>
                    {Object.entries(statusCounts).map(([s, n]) => {
                      const st = STATUS_LABELS[s] ?? { label: s, color: '#94a3b8' }
                      return (
                        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, display: 'inline-block' }} />
                          {st.label} <strong>{n}</strong>
                        </span>
                      )
                    })}
                  </span>
                )}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                {[
                  { icon: 'fa-laptop-code',    label: 'Examens',          value: exams.total_exams ?? 0,      color: '#2563eb', bg: '#dbeafe' },
                  { icon: 'fa-users',           label: 'Tentatives',       value: exams.total_attempts ?? 0,   color: '#0ea5e9', bg: '#e0f2fe' },
                  { icon: 'fa-paper-plane',     label: 'Soumissions',      value: exams.total_submitted ?? 0,  color: '#2563eb', bg: '#dbeafe' },
                  { icon: 'fa-clipboard-check', label: 'Corrigées',        value: exams.total_corrected ?? 0,  color: '#10b981', bg: '#d1fae5' },
                  { icon: 'fa-star',            label: 'Moyenne globale',  value: exams.overall_avg != null ? `${exams.overall_avg}/20` : '—', color: scoreColor(exams.overall_avg), bg: '#fef3c7' },
                  { icon: 'fa-trophy',          label: 'Taux réussite',    value: exams.overall_pass_rate != null ? `${exams.overall_pass_rate}%` : '—', color: exams.overall_pass_rate != null && exams.overall_pass_rate >= 50 ? '#10b981' : '#f59e0b', bg: '#d1fae5' },
                ].map(({ icon, label, value, color, bg }) => (
                  <div key={label} style={{ flex: '1 1 130px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <i className={`fas ${icon}`} style={{ color, fontSize: 14 }} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top & Bottom exams */}
          {((exams.top_exams ?? []).length > 0 || (exams.bottom_exams ?? []).length > 0) && (
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fas fa-trophy" style={{ color: '#f59e0b' }} />Meilleurs examens
                </h3>
                {(exams.top_exams ?? []).length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: 12 }}>Pas encore de données (min. 2 copies corrigées)</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {(exams.top_exams ?? []).map((exam, i) => (
                        <tr key={i} style={{ borderBottom: i < (exams.top_exams!.length - 1) ? '1px solid #f1f5f9' : 'none' }}>
                          <td style={{ padding: '8px 10px', fontSize: 13 }}>
                            <span style={{ marginRight: 6 }}>{['🥇','🥈','🥉'][i] ?? '•'}</span>
                            {exam.title}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 13, color: scoreColor(exam.avg_score), whiteSpace: 'nowrap' }}>{exam.avg_score}/20</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{exam.pass_rate}%</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{exam.corrected} copie(s)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fas fa-arrow-down" style={{ color: '#ef4444' }} />Examens à améliorer
                </h3>
                {(exams.bottom_exams ?? []).length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: 12 }}>Pas encore de données (min. 2 copies corrigées)</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {(exams.bottom_exams ?? []).map((exam, i) => (
                        <tr key={i} style={{ borderBottom: i < (exams.bottom_exams!.length - 1) ? '1px solid #f1f5f9' : 'none' }}>
                          <td style={{ padding: '8px 10px', fontSize: 13 }}>
                            <i className="fas fa-arrow-down" style={{ color: '#ef4444', marginRight: 6, fontSize: 10 }} />
                            {exam.title}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 13, color: scoreColor(exam.avg_score), whiteSpace: 'nowrap' }}>{exam.avg_score}/20</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{exam.pass_rate}%</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{exam.corrected} copie(s)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Corrections récentes */}
          {(exams.recent_corrections ?? []).length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="fas fa-clock" style={{ color: '#2563eb' }} />Corrections récentes (10 dernières)
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Étudiant','Examen','Note','Date'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(exams.recent_corrections ?? []).map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 600 }}>{c.student_name}</td>
                      <td style={{ padding: '7px 10px', fontSize: 13, color: '#64748b' }}>{c.exam_title}</td>
                      <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 700, color: scoreColor(c.score) }}>
                        {c.score != null ? `${c.score}/20` : <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ padding: '7px 10px', fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {c.corrected_at ? new Date(c.corrected_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* État vide */}
          {!exams.total_exams && !dash.total_users && (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <i className="fas fa-chart-bar" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 14, opacity: .3 }} />
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Aucune donnée analytique disponible pour le moment</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
