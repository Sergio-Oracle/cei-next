'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'

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

interface CorrectionResult {
  student_name: string
  score: number | null
  success: boolean
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  in_progress:    { label: 'En cours',    bg: '#fef3c7', color: '#d97706' },
  submitted:      { label: 'Soumis',      bg: '#dcfce7', color: '#15803d' },
  auto_submitted: { label: 'Auto-soumis', bg: '#dbeafe', color: '#1d4ed8' },
  banned:         { label: 'Banni',       bg: '#fee2e2', color: '#dc2626' },
}

const CORRECTION_STEPS = [
  { at: 0,  label: "Lecture des réponses de l'étudiant…" },
  { at: 6,  label: 'Analyse selon le barème du sujet…' },
  { at: 15, label: 'Rédaction de la correction détaillée…' },
  { at: 35, label: 'Calcul de la note finale…' },
]

function fmtElapsed(s: number) {
  const m = Math.floor(s / 60), r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function OnlineCorrectionPage() {
  const router = useRouter()
  const { success, error } = useToast()
  const [exams, setExams]   = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [correcting, setCorrecting] = useState<number | null>(null)
  const [correctingAll, setCorrectingAll] = useState<number | null>(null)

  const [progress, setProgress] = useState<{ total: number; index: number; studentName: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [resultModal, setResultModal] = useState<{ examTitle: string; items: CorrectionResult[] } | null>(null)

  useEffect(() => { load() }, [])
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  function startTimer() {
    setElapsed(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

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

  async function correctSingle(attempt: Attempt) {
    if (!confirm('Lancer la correction automatique avec IA pour cette tentative ?')) return
    setCorrecting(attempt.id)
    setProgress({ total: 1, index: 1, studentName: attempt.student_name })
    startTimer()
    try {
      const res = await api.aiPost<{ success: boolean; attempt: { score: number } }>(`/api/exam_attempts/${attempt.id}/correct`, {})
      success(`Correction terminée — ${attempt.student_name} : ${res.attempt.score}/20`)
      load()
    } catch (e: any) { error(e.message || 'Erreur de correction') }
    finally { setCorrecting(null); setProgress(null); stopTimer() }
  }

  async function correctAll(examId: number) {
    const exam = exams.find(e => e.id === examId)
    if (!exam) return
    const toCorrect = exam.attempts.filter(a => a.needs_correction)
    if (toCorrect.length === 0) return
    if (!confirm(`Corriger ${toCorrect.length} tentative(s) en attente pour cet examen avec l'IA ?`)) return
    setCorrectingAll(examId)
    const items: CorrectionResult[] = []
    for (let i = 0; i < toCorrect.length; i++) {
      const attempt = toCorrect[i]
      setProgress({ total: toCorrect.length, index: i + 1, studentName: attempt.student_name })
      startTimer()
      try {
        const res = await api.aiPost<{ success: boolean; attempt: { score: number } }>(`/api/exam_attempts/${attempt.id}/correct`, {})
        items.push({ student_name: attempt.student_name, score: res.attempt.score, success: true })
      } catch {
        items.push({ student_name: attempt.student_name, score: null, success: false })
      }
    }
    stopTimer()
    setProgress(null)
    setCorrectingAll(null)
    setResultModal({ examTitle: exam.title, items })
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
                              <button onClick={() => correctSingle(attempt)} disabled={correcting === attempt.id}
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

      {/* Modal de progression */}
      {progress && (
        <Modal title="Correction IA en cours" onClose={() => {}} maxWidth={440}>
          <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
            <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 16px' }}>
              <i className="fa-solid fa-robot" style={{ fontSize: 30, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }} />
              <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="#10b981" strokeWidth="4"
                  strokeDasharray={2 * Math.PI * 28} strokeDashoffset={2 * Math.PI * 28 * (1 - Math.min(elapsed, 180) / 180)}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
            </div>
            {progress.total > 1 && (
              <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                Tentative {progress.index} / {progress.total}
              </div>
            )}
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtElapsed(elapsed)}</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 16px' }}>
              Copie de <strong>{progress.studentName}</strong>
            </p>
            <p style={{ fontSize: 14, minHeight: 20 }}>
              {[...CORRECTION_STEPS].reverse().find(s => elapsed >= s.at)?.label}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
              Peut prendre jusqu'à 3 minutes par copie selon la charge du modèle IA.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal de résultat */}
      {resultModal && (
        <Modal title="Correction terminée" onClose={() => setResultModal(null)} maxWidth={480}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,185,129,.12)',
            }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 28, color: '#10b981' }} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{resultModal.examTitle}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {resultModal.items.filter(r => r.success).length} corrigée(s) avec succès
              {resultModal.items.some(r => !r.success) && `, ${resultModal.items.filter(r => !r.success).length} échec(s)`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {resultModal.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--background)', borderRadius: 8, fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className={`fa-solid ${it.success ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ color: it.success ? '#10b981' : '#ef4444' }} />
                  {it.student_name}
                </span>
                {it.success
                  ? <strong style={{ color: (it.score ?? 0) >= 10 ? '#10b981' : '#ef4444' }}>{it.score}/20</strong>
                  : <span style={{ color: '#ef4444', fontSize: 12 }}>Échec</span>}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => setResultModal(null)}>Fermer</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
