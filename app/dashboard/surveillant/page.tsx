'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

interface StudentInfo {
  student_id:    number
  student_name:  string
  student_email: string
  attempt_id:    number | null
  status:        string
  risk_score:    number
}

interface ExamWithStudents {
  id:               number
  title:            string
  status:           string
  duration_minutes: number
  start_time?:      string
  end_time?:        string
  attempts_count?:  number
  my_students:      StudentInfo[]
  my_student_count: number
}

function attemptLabel(status: string) {
  switch (status) {
    case 'not_started': return { label: 'Absent / Attente', color: '#94a3b8', bg: '#f1f5f9' }
    case 'in_progress':
    case 'started':     return { label: 'En cours',          color: '#f59e0b', bg: '#fffbeb' }
    case 'submitted':   return { label: 'Soumis',            color: '#10b981', bg: '#f0fdf4' }
    case 'auto_submitted': return { label: 'Soumis automatiquement', color: '#10b981', bg: '#f0fdf4' }
    case 'graded':      return { label: 'Corrigé',           color: '#3b82f6', bg: '#eff6ff' }
    case 'banned':      return { label: 'Exclu',             color: '#ef4444', bg: '#fef2f2' }
    default:            return { label: status,               color: '#94a3b8', bg: '#f1f5f9' }
  }
}

function riskColor(score: number) {
  if (!score || score === 0) return '#94a3b8'
  if (score < 30) return '#10b981'
  if (score < 60) return '#f59e0b'
  return '#ef4444'
}

function fmtDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m} min`
}

export default function SurveillantDashboard() {
  const { user } = useAuth()
  const { error } = useToast()
  const [exams, setExams]   = useState<ExamWithStudents[]>([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 30_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, []) // eslint-disable-line

  async function load() {
    try {
      const res = await api.get<any>('/api/surveillant/exams')
      const list: ExamWithStudents[] = res.exams ?? (Array.isArray(res) ? res : [])
      setExams(list)
    } catch { error('Erreur de chargement des examens') }
    finally { setLoading(false) }
  }

  const activeExams   = exams.filter(e => e.status === 'active')
  const totalStudents = exams.reduce((s, e) => s + (e.my_student_count ?? 0), 0)

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#3b82f6', width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-tachometer-alt" style={{ color: 'white', fontSize: 20 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Tableau de bord Surveillant</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Bienvenue, <strong>{user?.full_name}</strong></p>
          </div>
        </div>
        <button onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#f1f5f9', color: '#475569', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <i className="fas fa-sync-alt" /> Actualiser
        </button>
      </div>

      {/* ── Stat tiles ───────────────────────────────────────────────── */}
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatTile icon="fa-play-circle" label="En cours"            value={activeExams.length}  color="#10b981" />
        <StatTile icon="fa-laptop-code" label="Examens assignés"    value={exams.length}         color="#3b82f6" />
        <StatTile icon="fa-user-graduate" label="Étudiants à surveiller" value={totalStudents}  color="#3b82f6" />
      </div>

      {/* ── Bannière examens en cours ────────────────────────────────── */}
      {activeExams.length > 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, background: '#10b981', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#065f46' }}>
              {activeExams.length} examen{activeExams.length > 1 ? 's' : ''} en cours actuellement
            </span>
            <span style={{ fontSize: 13, color: '#047857' }}>— Votre présence est requise</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {activeExams.map(ex => (
              <Link key={ex.id} href={`/proctor/monitor/${ex.id}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#10b981', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                <i className="fas fa-shield-alt" /> Surveiller maintenant
                {activeExams.length > 1 && <span style={{ opacity: .8 }}>— {ex.title}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Corps ────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} />
        </div>
      ) : exams.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', textAlign: 'center', padding: '64px 24px' }}>
          <i className="fas fa-eye-slash" style={{ fontSize: 52, color: '#cbd5e1', display: 'block', marginBottom: 16 }} />
          <h3 style={{ color: '#475569', fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Aucun examen assigné</h3>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Vous serez notifié lorsque des examens vous seront assignés.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Titre section */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-users" style={{ color: '#3b82f6' }} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
              Mes étudiants par examen
            </h3>
          </div>

          {exams.map(exam => {
            const isActive = exam.status === 'active'
            const statusColor = isActive ? '#10b981' : exam.status === 'scheduled' ? '#3b82f6' : '#94a3b8'
            return (
              <div key={exam.id} style={{ borderBottom: '1px solid var(--border)' }}>
                {/* En-tête examen */}
                <div style={{ padding: '12px 24px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{exam.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {exam.my_student_count} étudiant(s) ·{' '}
                      {exam.duration_minutes ? fmtDuration(exam.duration_minutes) : ''}
                    </span>
                  </div>
                  {isActive && (
                    <Link href={`/proctor/monitor/${exam.id}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#10b981', color: 'white', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <i className="fas fa-shield-alt" /> Surveiller
                    </Link>
                  )}
                </div>

                {/* Tableau étudiants */}
                {exam.my_students && exam.my_students.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '8px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>Étudiant</th>
                        <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>Statut</th>
                        <th style={{ padding: '8px 24px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>Risque</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exam.my_students.map(student => {
                        const st = attemptLabel(student.status)
                        return (
                          <tr key={student.student_id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <i className="fas fa-user-circle" style={{ fontSize: 18, color: '#3b82f6' }} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{student.student_name}</div>
                                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{student.student_email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color }}>
                                {st.label}
                              </span>
                            </td>
                            <td style={{ padding: '10px 24px', textAlign: 'right' }}>
                              {student.risk_score > 0 ? (
                                <span style={{ fontWeight: 700, color: riskColor(student.risk_score), fontSize: 14 }}>
                                  {student.risk_score}%
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>
                ) : (
                  <div style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
                    <i className="fas fa-info-circle" style={{ marginRight: 8 }} />
                    Aucun étudiant affecté pour cet examen.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatTile({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: `2px solid ${color}22`, borderRadius: 14, padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, background: `${color}15`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fas ${icon}`} style={{ color, fontSize: 18 }} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  )
}
