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

/* Statut tentative → libellé français */
function attemptLabel(status: string) {
  switch (status) {
    case 'not_started': return { label: 'Absent/Attente', color: '#94a3b8', bg: '#f1f5f9' }
    case 'in_progress':
    case 'started':     return { label: 'En cours',       color: '#f59e0b', bg: '#fffbeb' }
    case 'submitted':   return { label: 'Soumis',         color: '#10b981', bg: '#f0fdf4' }
    case 'graded':      return { label: 'Corrigé',        color: '#3b82f6', bg: '#eff6ff' }
    case 'banned':      return { label: 'Exclu',          color: '#ef4444', bg: '#fef2f2' }
    default:            return { label: status,            color: '#94a3b8', bg: '#f1f5f9' }
  }
}

/* Couleur du score de risque */
function riskColor(score: number) {
  if (!score || score === 0) return 'var(--text-muted)'
  if (score < 30) return '#10b981'
  if (score < 60) return '#f59e0b'
  return '#ef4444'
}

export default function SurveillantDashboard() {
  const { user } = useAuth()
  const { error } = useToast()
  const [exams, setExams] = useState<ExamWithStudents[]>([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  async function load() {
    try {
      const res = await api.get<any>('/api/surveillant/exams')
      const list: ExamWithStudents[] = res.exams ?? (Array.isArray(res) ? res : [])
      setExams(list)
    } catch {
      error('Erreur de chargement des examens')
    } finally {
      setLoading(false)
    }
  }

  const activeExams   = exams.filter(e => e.status === 'active')
  const totalStudents = exams.reduce((s, e) => s + (e.my_student_count ?? 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>
            <i className="fas fa-tachometer-alt" style={{ marginRight: 10, color: 'var(--primary)' }} />
            Tableau de Bord Surveillant
          </h2>
          <p>Bienvenue, {user?.full_name}</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <i className="fas fa-sync-alt" /> Actualiser
        </button>
      </div>

      {/* Cartes de stats */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 28 }}>
        <div className="stat-card" style={{ borderColor: '#10b981' }}>
          <div className="stat-icon" style={{ background: '#f0fdf4' }}>
            <i className="fas fa-play" style={{ color: '#10b981' }} />
          </div>
          <div>
            <div className="stat-value" style={{ color: '#10b981' }}>{activeExams.length}</div>
            <div className="stat-label">En cours</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: '#3b82f6' }}>
          <div className="stat-icon" style={{ background: '#eff6ff' }}>
            <i className="fas fa-laptop-code" style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div className="stat-value" style={{ color: '#3b82f6' }}>{exams.length}</div>
            <div className="stat-label">Examens assignés</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: '#3b82f6' }}>
          <div className="stat-icon" style={{ background: '#eff6ff' }}>
            <i className="fas fa-user-graduate" style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div className="stat-value" style={{ color: '#3b82f6' }}>{totalStudents}</div>
            <div className="stat-label">Étudiants à surveiller</div>
          </div>
        </div>
      </div>

      {/* Liste des étudiants par examen */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--primary)' }} />
        </div>
      ) : exams.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-eye-slash" style={{ fontSize: 48, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }} />
          <h3>Aucun examen assigné</h3>
          <p style={{ color: 'var(--text-muted)' }}>Vous serez notifié lorsque des examens vous seront assignés.</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
              <i className="fas fa-users" style={{ marginRight: 8 }} />
              Mes Étudiants par Examen
            </h3>
          </div>

          {exams.map(exam => {
            const isActive = exam.status === 'active'
            return (
              <div key={exam.id} style={{ borderBottom: '1px solid var(--border)' }}>
                {/* En-tête de l'examen */}
                <div style={{ padding: '12px 24px', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: isActive ? '#10b981' : exam.status === 'scheduled' ? '#3b82f6' : '#94a3b8',
                      display: 'inline-block' }} />
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{exam.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {exam.my_student_count} étudiant(s)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {exam.duration_minutes && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <i className="fas fa-clock" /> {exam.duration_minutes} min
                      </span>
                    )}
                    {isActive && (
                      <Link href={`/proctor/${exam.id}`} className="btn btn-success" style={{ fontSize: 12, padding: '4px 12px' }}>
                        <i className="fas fa-eye" /> Accéder à la salle
                      </Link>
                    )}
                  </div>
                </div>

                {/* Tableau des étudiants */}
                {exam.my_students && exam.my_students.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--background)' }}>
                        <th style={{ padding: '8px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
                          Étudiant
                        </th>
                        <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
                          Statut
                        </th>
                        <th style={{ padding: '8px 24px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
                          Risque
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {exam.my_students.map(student => {
                        const st = attemptLabel(student.status)
                        return (
                          <tr key={student.student_id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                                  <i className="fas fa-user-circle" style={{ fontSize: 18, color: 'var(--text-muted)' }} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 14 }}>{student.student_name}</div>
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
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
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
