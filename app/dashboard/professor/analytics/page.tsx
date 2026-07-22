'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface ExamStat { title: string; avg_score: number; pass_rate: number; corrected: number }
interface RecentCorrection { student_name: string; exam_title: string; score: number | null; corrected_at: string }
interface Ratios {
  students_per_proctor:    { total_assignments: number; distinct_proctors: number; avg: number | null }
  students_per_exam:       { avg_eligible: number | null; avg_attempts: number | null; participation_rate: number | null }
  students_per_grade:      { total_submitted: number; total_corrected: number; completion_rate: number | null }
  students_per_validation: { total_scored: number; total_validated: number; validation_rate: number | null }
}
interface Analytics {
  total_exams?: number; total_attempts?: number; total_submitted?: number; total_corrected?: number
  overall_avg?: number | null; overall_pass_rate?: number | null
  status_counts?: Record<string, number>
  top_exams?: ExamStat[]; bottom_exams?: ExamStat[]; recent_corrections?: RecentCorrection[]
  ratios?: Ratios
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: '#10b981' }, scheduled: { label: 'Planifié', color: '#3b82f6' },
  closed: { label: 'Terminé', color: '#64748b' }, draft: { label: 'Brouillon', color: '#f59e0b' },
}

function sc(v: number | null | undefined) {
  if (v == null) return '#64748b'
  return v >= 14 ? '#10b981' : v >= 10 ? '#3b82f6' : v >= 7 ? '#f59e0b' : '#ef4444'
}

export default function ProfessorAnalyticsPage() {
  const { error } = useToast()
  const [data, setData] = useState<Analytics>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setData(await api.get<Analytics>('/api/professor/analytics')) }
    catch { error('Erreur de chargement des analytiques') }
    finally { setLoading(false) }
  }

  const statusCounts = data.status_counts ?? {}
  const passRate = data.overall_pass_rate ?? 0
  const passDeg = Math.round(Math.min(passRate, 100) / 100 * 360)

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-chart-bar" style={{ color: '#2563eb' }} />Analytique
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14, display: 'flex', flexWrap: 'wrap', gap: '0 14px' }}>
            {Object.entries(statusCounts).map(([s, n]) => {
              const st = STATUS_LABELS[s] ?? { label: s, color: '#94a3b8' }
              return (
                <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.color, display: 'inline-block' }} />
                  {st.label} <strong>{n}</strong>
                </span>
              )
            })}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}><i className="fas fa-rotate" /> Actualiser</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--primary)', display: 'block', marginBottom: 14 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chargement…</span>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            {[
              { icon: 'fa-laptop-code',     label: 'Examens',          value: data.total_exams ?? 0,      color: '#2563eb', bg: '#dbeafe' },
              { icon: 'fa-users',            label: 'Tentatives',       value: data.total_attempts ?? 0,   color: '#0ea5e9', bg: '#e0f2fe' },
              { icon: 'fa-paper-plane',      label: 'Soumissions',      value: data.total_submitted ?? 0,  color: '#2563eb', bg: '#dbeafe' },
              { icon: 'fa-clipboard-check',  label: 'Copies corrigées', value: data.total_corrected ?? 0,  color: '#10b981', bg: '#d1fae5' },
              { icon: 'fa-star',             label: 'Moyenne globale',  value: data.overall_avg != null ? `${data.overall_avg}/20` : '—', color: sc(data.overall_avg), bg: '#fef3c7' },
              { icon: 'fa-trophy',           label: 'Taux de réussite', value: data.overall_pass_rate != null ? `${data.overall_pass_rate}%` : '—', color: passRate >= 50 ? '#10b981' : '#f59e0b', bg: '#d1fae5' },
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

          {/* ── Ratios (Retour #21) ── */}
          {data.ratios && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="fas fa-scale-balanced" style={{ color: '#7c3aed' }} />Ratios
              </h3>
              <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {[
                  {
                    icon: 'fa-user-shield', color: '#7c3aed', bg: '#ede9fe',
                    label: 'Étudiants / surveillant',
                    value: data.ratios.students_per_proctor.avg != null ? data.ratios.students_per_proctor.avg : '—',
                    caption: `${data.ratios.students_per_proctor.total_assignments} affectation(s) — ${data.ratios.students_per_proctor.distinct_proctors} surveillant(s)`,
                  },
                  {
                    icon: 'fa-laptop-code', color: '#2563eb', bg: '#dbeafe',
                    label: 'Étudiants / examen',
                    value: data.ratios.students_per_exam.avg_attempts != null ? data.ratios.students_per_exam.avg_attempts : '—',
                    caption: `Éligibles en moy. ${data.ratios.students_per_exam.avg_eligible ?? '—'}/examen — participation ${data.ratios.students_per_exam.participation_rate != null ? data.ratios.students_per_exam.participation_rate + '%' : '—'}`,
                  },
                  {
                    icon: 'fa-clipboard-check', color: '#10b981', bg: '#d1fae5',
                    label: 'Étudiants / note',
                    value: data.ratios.students_per_grade.completion_rate != null ? `${data.ratios.students_per_grade.completion_rate}%` : '—',
                    caption: `${data.ratios.students_per_grade.total_corrected}/${data.ratios.students_per_grade.total_submitted} soumission(s) corrigée(s)`,
                  },
                  {
                    icon: 'fa-trophy', color: '#f59e0b', bg: '#fef3c7',
                    label: 'Étudiants / validation',
                    value: data.ratios.students_per_validation.validation_rate != null ? `${data.ratios.students_per_validation.validation_rate}%` : '—',
                    caption: `${data.ratios.students_per_validation.total_validated}/${data.ratios.students_per_validation.total_scored} noté(s) validé(s) (≥10)`,
                  },
                ].map(({ icon, color, bg, label, value, caption }) => (
                  <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <i className={`fas ${icon}`} style={{ color, fontSize: 13 }} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>{label}</div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3, lineHeight: 1.4 }}>{caption}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Graphiques CSS ── */}
          {(data.total_corrected ?? 0) > 0 && (
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {/* Réussite / Échec — donut CSS */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fas fa-chart-pie" style={{ color: '#10b981' }} />Réussite / Échec
                </p>
                <div style={{ position: 'relative', width: 140, height: 140, borderRadius: '50%',
                  background: `conic-gradient(#10b981 ${passDeg}deg, #ef4444 ${passDeg}deg)` }}>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    width: 88, height: 88, borderRadius: '50%', background: 'var(--surface)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: passRate >= 50 ? '#10b981' : '#ef4444' }}>{passRate}%</span>
                    <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>réussite</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />Réussite (≥10)
                  </span>
                  <span style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} />Échec (&lt;10)
                  </span>
                </div>
              </div>

              {/* Examens — synthèse */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fas fa-chart-bar" style={{ color: '#2563eb' }} />Synthèse des examens
                </p>
                {[
                  { label: 'Soumissions / Tentatives', ratio: data.total_attempts ? (data.total_submitted ?? 0) / data.total_attempts : 0, a: data.total_submitted ?? 0, b: data.total_attempts ?? 0, color: '#2563eb' },
                  { label: 'Copies corrigées / Soumissions', ratio: data.total_submitted ? (data.total_corrected ?? 0) / data.total_submitted : 0, a: data.total_corrected ?? 0, b: data.total_submitted ?? 0, color: '#10b981' },
                  { label: 'Taux de réussite global', ratio: passRate / 100, a: passRate, b: 100, color: passRate >= 50 ? '#10b981' : '#f59e0b' },
                ].map(({ label, ratio, a, b, color }) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: '#64748b' }}>{label}</span>
                      <span style={{ fontWeight: 700, color }}>{a}/{b}</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99 }}>
                      <div style={{ width: `${Math.min(ratio * 100, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .4s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Top / Bottom examens ── */}
          {((data.top_exams ?? []).length > 0 || (data.bottom_exams ?? []).length > 0) && (
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fas fa-trophy" style={{ color: '#f59e0b' }} />Meilleurs examens
                </h3>
                {(data.top_exams ?? []).length === 0
                  ? <p style={{ color: '#94a3b8', fontSize: 12 }}>Min. 2 copies corrigées requises</p>
                  : <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                    {(data.top_exams ?? []).map((exam, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontSize: 13 }}><span style={{ marginRight: 6 }}>{['🥇','🥈','🥉'][i] ?? '•'}</span>{exam.title}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 13, color: sc(exam.avg_score), whiteSpace: 'nowrap' }}>{exam.avg_score}/20</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{exam.pass_rate}%</td>
                      </tr>
                    ))}
                  </tbody></table>}
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fas fa-arrow-down" style={{ color: '#ef4444' }} />Examens à améliorer
                </h3>
                {(data.bottom_exams ?? []).length === 0
                  ? <p style={{ color: '#94a3b8', fontSize: 12 }}>Min. 2 copies corrigées requises</p>
                  : <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                    {(data.bottom_exams ?? []).map((exam, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontSize: 13 }}><i className="fas fa-arrow-down" style={{ color: '#ef4444', marginRight: 6, fontSize: 10 }} />{exam.title}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 13, color: sc(exam.avg_score), whiteSpace: 'nowrap' }}>{exam.avg_score}/20</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{exam.pass_rate}%</td>
                      </tr>
                    ))}
                  </tbody></table>}
              </div>
            </div>
          )}

          {/* ── Corrections récentes ── */}
          {(data.recent_corrections ?? []).length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="fas fa-clock" style={{ color: '#2563eb' }} />Corrections récentes (10 dernières)
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Étudiant','Examen','Note','Date'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(data.recent_corrections ?? []).map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 600 }}>{c.student_name}</td>
                      <td style={{ padding: '7px 10px', fontSize: 13, color: '#64748b' }}>{c.exam_title}</td>
                      <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 700, color: sc(c.score) }}>
                        {c.score != null ? `${c.score}/20` : <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ padding: '7px 10px', fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {c.corrected_at ? new Date(c.corrected_at).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!data.total_exams && (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <i className="fas fa-chart-bar" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 14, opacity: .3 }} />
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Aucune donnée analytique disponible</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Créez des examens en ligne et corrigez des copies pour voir les statistiques.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
