'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface Attempt {
  id: number
  student_name: string
  submitted_at: string | null
  has_incidents: boolean
  warnings_count: number
  score: number | null
  needs_correction: boolean
  status: 'in_progress' | 'submitted' | 'auto_submitted' | 'banned'
}

interface Exam {
  id: number
  title: string
  status: 'active' | 'closed' | 'draft'
  attempts: Attempt[]
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  in_progress:    { label: 'En cours',    bg: '#fef3c7', color: '#d97706' },
  submitted:      { label: 'Soumis',      bg: '#dcfce7', color: '#15803d' },
  auto_submitted: { label: 'Auto-soumis', bg: '#dbeafe', color: '#1d4ed8' },
  banned:         { label: 'Banni',       bg: '#fee2e2', color: '#dc2626' },
}

export default function OnlineCorrectionPage() {
  const router = useRouter()
  const { success, error } = useToast()
  const [exams, setExams]   = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [correcting, setCorrecting] = useState<number | null>(null)
  const [correctingAll, setCorrectingAll] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const all = await api.get<any[]>('/api/online_exams')
      const relevant = (Array.isArray(all) ? all : []).filter((e: any) => e.status === 'active' || e.status === 'closed')
      const withAttempts = await Promise.all(
        relevant.map(async (exam: any) => {
          try {
            const attempts = await api.get<Attempt[]>(`/api/online_exams/${exam.id}/attempts`)
            return { ...exam, attempts: Array.isArray(attempts) ? attempts : [] }
          } catch { return { ...exam, attempts: [] } }
        })
      )
      setExams((withAttempts as Exam[]).filter(e => e.attempts.length > 0))
    } catch { error('Erreur de chargement des examens') }
    finally { setLoading(false) }
  }

  async function correctSingle(attemptId: number) {
    if (!confirm('Lancer la correction automatique avec IA pour cette tentative ?')) return
    setCorrecting(attemptId)
    try {
      await api.post(`/api/exam_attempts/${attemptId}/correct`, {})
      success('Correction lancée avec succès')
      load()
    } catch (e: any) { error(e.message || 'Erreur de correction') }
    finally { setCorrecting(null) }
  }

  async function correctAll(examId: number) {
    const exam = exams.find(e => e.id === examId)
    if (!exam) return
    const toCorrect = exam.attempts.filter(a => a.needs_correction)
    if (toCorrect.length === 0) return
    if (!confirm(`Corriger ${toCorrect.length} tentative(s) en attente pour cet examen avec l'IA ?`)) return
    setCorrectingAll(examId)
    let done = 0, failed = 0
    for (const attempt of toCorrect) {
      try {
        await api.post(`/api/exam_attempts/${attempt.id}/correct`, {})
        done++
      } catch { failed++ }
    }
    setCorrectingAll(null)
    if (failed === 0) success(`${done} tentative(s) corrigée(s) avec succès`)
    else error(`${done} corrigée(s), ${failed} échec(s)`)
    load()
  }

  async function exportCSV(examId: number, examTitle: string) {
    try {
      const blob = await api.blob(`/api/online_exams/${examId}/export/csv`)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `resultats_${examTitle.replace(/\s+/g, '_')}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { error('Impossible de générer le CSV') }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-check-circle" style={{ color: 'var(--primary)' }} />Corrections d'Examens en Ligne
        </h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>Corrigez automatiquement les examens soumis avec l'IA</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--primary)', display: 'block', marginBottom: 14 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chargement des examens…</span>
        </div>
      ) : exams.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: '#dbeafe', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="fas fa-laptop-code" style={{ fontSize: 26, color: '#2563eb' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Aucun examen à corriger</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Les examens actifs ou terminés avec des tentatives soumises apparaîtront ici.
          </div>
        </div>
      ) : exams.map(exam => {
        const needsCorrection = exam.attempts.filter(a => a.needs_correction)
        const corrected       = exam.attempts.filter(a => a.score !== null)

        return (
          <div key={exam.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 24, overflow: 'hidden' }}>
            {/* Card header */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <i className="fas fa-laptop-code" style={{ color: 'var(--primary)' }} />
                  <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{exam.title}</span>
                  <span style={{
                    padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    background: exam.status === 'active' ? '#dcfce7' : '#f1f5f9',
                    color: exam.status === 'active' ? '#15803d' : '#64748b'
                  }}>
                    {exam.status === 'active' ? 'En cours' : 'Terminé'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {exam.attempts.length} tentative(s) · {needsCorrection.length} à corriger · {corrected.length} corrigée(s)
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {needsCorrection.length > 0 && (
                  <button onClick={() => correctAll(exam.id)} disabled={correctingAll === exam.id}
                    style={{ padding: '8px 14px', background: correctingAll === exam.id ? '#6ee7b7' : '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: correctingAll === exam.id ? 'not-allowed' : 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {correctingAll === exam.id
                      ? <><i className="fas fa-spinner fa-spin" />Correction en cours…</>
                      : <><i className="fas fa-magic" />Tout Corriger avec IA</>}
                  </button>
                )}
                <button onClick={() => exportCSV(exam.id, exam.title)}
                  style={{ padding: '8px 14px', background: '#0f766e', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-file-csv" />Export CSV
                </button>
              </div>
            </div>

            {/* Attempts table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {[
                      { label: 'Étudiant',  icon: 'fa-user' },
                      { label: 'Soumis le', icon: 'fa-calendar' },
                      { label: 'Incidents', icon: 'fa-triangle-exclamation' },
                      { label: 'Note',      icon: 'fa-star' },
                      { label: 'Actions',   icon: 'fa-cog' },
                    ].map(({ label, icon }) => (
                      <th key={label} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, borderBottom: '1px solid var(--border)' }}>
                        <i className={`fas ${icon}`} style={{ marginRight: 6 }} />{label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exam.attempts.map((attempt, i) => {
                    const sb = STATUS_BADGE[attempt.status] ?? { label: attempt.status, bg: '#f1f5f9', color: '#475569' }
                    return (
                      <tr key={attempt.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0f9ff' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14, marginBottom: 3 }}>{attempt.student_name}</div>
                          <span style={{ background: sb.bg, color: sb.color, padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 600 }}>{sb.label}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
                          {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString('fr-FR') : 'N/A'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {attempt.has_incidents ? (
                            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <i className="fas fa-circle-exclamation" />{attempt.warnings_count}
                            </span>
                          ) : (
                            <span style={{ color: '#10b981', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <i className="fas fa-check" />Aucun
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {attempt.score !== null
                            ? <strong style={{ color: attempt.score >= 10 ? '#10b981' : '#ef4444', fontSize: 16 }}>{attempt.score}/20</strong>
                            : <span style={{ color: '#94a3b8', fontSize: 13 }}>Non corrigé</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {attempt.status === 'banned' ? (
                              <span style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>Banni</span>
                            ) : attempt.needs_correction ? (
                              <button onClick={() => correctSingle(attempt.id)} disabled={correcting === attempt.id}
                                style={{ padding: '6px 12px', background: correcting === attempt.id ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: 7, fontWeight: 600, cursor: correcting === attempt.id ? 'not-allowed' : 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                {correcting === attempt.id
                                  ? <><i className="fas fa-spinner fa-spin" />…</>
                                  : <><i className="fas fa-magic" />Corriger</>}
                              </button>
                            ) : (
                              <button onClick={() => router.push(`/dashboard/professor/attempts/${attempt.id}`)}
                                style={{ padding: '6px 12px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <i className="fas fa-eye" />Voir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
