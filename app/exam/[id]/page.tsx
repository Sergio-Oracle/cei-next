'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

interface ExamData {
  id: number
  title: string
  instructions?: string
  duration_minutes: number
  start_time: string
  end_time: string
  subject_title?: string
  max_tab_switches?: number
  enable_copy_paste?: boolean
  enable_right_click?: boolean
  camera_required?: boolean
  status: string
  questions?: Question[]
  subject_content?: { id: number; title: string; content: string } | string
}

interface Question {
  id: number
  content: string
  question_type: string
  choices?: string[]
  points?: number
}

interface Attempt {
  id: number
  status: string
  started_at: string
  extra_minutes?: number
  answers?: Record<string, string>
}

export default function ExamPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { success, error, warning } = useToast()

  const [exam, setExam] = useState<ExamData | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'instructions' | 'exam' | 'submitted'>('loading')
  const [tabSwitches, setTabSwitches] = useState(0)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const saveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptIdRef = useRef<number | null>(null)

  useEffect(() => {
    loadExam()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (saveRef.current) clearInterval(saveRef.current)
    }
  }, [id])

  useEffect(() => {
    if (phase !== 'exam') return

    // Tab visibility change detection
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches(prev => {
          const next = prev + 1
          warning(`Attention : changement d'onglet détecté (${next}/${exam?.max_tab_switches ?? 3})`)
          if (exam?.max_tab_switches && next >= exam.max_tab_switches) {
            handleSubmit(true)
          }
          return next
        })
      }
    }

    // Disable copy/paste if not enabled
    const preventCopy = (e: ClipboardEvent) => {
      if (!exam?.enable_copy_paste) { e.preventDefault(); warning('Copier/coller désactivé') }
    }
    const preventContextMenu = (e: MouseEvent) => {
      if (!exam?.enable_right_click) { e.preventDefault() }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    document.addEventListener('copy', preventCopy)
    document.addEventListener('paste', preventCopy)
    document.addEventListener('contextmenu', preventContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('copy', preventCopy)
      document.removeEventListener('paste', preventCopy)
      document.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [phase, exam])

  async function loadExam() {
    setLoading(true)
    try {
      const res = await api.get<ExamData>(`/api/online_exams/${id}/details`)
      setExam(res)
      setPhase('instructions')
    } catch (e: any) {
      error(e.message || 'Erreur chargement examen')
      router.push('/dashboard/student')
    } finally {
      setLoading(false)
    }
  }

  function startTimer(durationSeconds: number) {
    setTimeLeft(durationSeconds)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleSubmit(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function startAutoSave(attemptId: number) {
    saveRef.current = setInterval(() => {
      autoSave(attemptId)
    }, 30000)
  }

  async function autoSave(attemptId: number) {
    try {
      /* answers doit être envoyé comme chaîne JSON — le backend stocke answers en Text */
      await api.post(`/api/exam_attempts/${attemptId}/save`, { answers: JSON.stringify(answers) })
      setLastSaved(new Date())
    } catch {
      /* silent fail */
    }
  }

  async function startExam() {
    if (!exam) return
    setStarting(true)
    try {
      const res = await api.post<{ success: boolean; attempt: Attempt; continuing?: boolean }>(`/api/online_exams/${id}/start`)
      const att = res.attempt
      setAttempt(att)
      attemptIdRef.current = att.id

      /* answers est stocké comme chaîne JSON dans la DB → parser avant de l'utiliser */
      if (att.answers) {
        try {
          const parsed = typeof att.answers === 'string' ? JSON.parse(att.answers) : att.answers
          setAnswers(parsed || {})
        } catch { setAnswers({}) }
      }

      const totalMinutes = exam.duration_minutes + (att.extra_minutes ?? 0)
      startTimer(totalMinutes * 60)
      startAutoSave(att.id)
      setPhase('exam')
    } catch (e: any) {
      error(e.message || "Impossible de démarrer l'examen")
    } finally {
      setStarting(false)
    }
  }

  const handleSubmit = useCallback(async (auto = false) => {
    const attemptId = attemptIdRef.current
    if (!attemptId || submitting) return
    setSubmitting(true)
    if (timerRef.current) clearInterval(timerRef.current)
    if (saveRef.current) clearInterval(saveRef.current)
    try {
      await api.post(`/api/exam_attempts/${attemptId}/submit`, { answers: JSON.stringify(answers) })
      if (!auto) success('Copie soumise avec succès !')
      setPhase('submitted')
    } catch (e: any) {
      /* fallback: essayer de sauvegarder si la soumission échoue */
      try {
        await api.post(`/api/exam_attempts/${attemptId}/save`, { answers: JSON.stringify(answers) })
        setPhase('submitted')
      } catch {
        error('Erreur lors de la soumission')
        setSubmitting(false)
      }
    }
  }, [answers, submitting])

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const timeColor = timeLeft < 300 ? '#ef4444' : timeLeft < 600 ? '#f59e0b' : '#10b981'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fa-solid fa-spinner spin" style={{ fontSize: 48, color: 'var(--primary)', marginBottom: 16 }} />
          <p>Chargement de l'examen...</p>
        </div>
      </div>
    )
  }

  if (phase === 'submitted') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)' }}>
        <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: 48 }}>
          <i className="fa-solid fa-circle-check" style={{ fontSize: 64, color: 'var(--success)', marginBottom: 24 }} />
          <h2 style={{ marginBottom: 12 }}>Copie soumise !</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            Votre copie a été transmise avec succès. Les résultats vous seront communiqués après correction.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => router.push('/dashboard/student')}>
            <i className="fa-solid fa-home" /> Retour au tableau de bord
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'instructions' && exam) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--background)', padding: 24 }}>
        <div className="card" style={{ maxWidth: 640, width: '100%' }}>
          <div style={{ padding: 32 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <i className="fa-solid fa-monitor-waveform" style={{ fontSize: 48, color: 'var(--primary)', marginBottom: 12, display: 'block' }} />
              <h2>{exam.title}</h2>
              {exam.subject_title && <p style={{ color: 'var(--text-muted)' }}>{exam.subject_title}</p>}
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 24, gap: 12 }}>
              <div style={{ textAlign: 'center', padding: 16, background: 'var(--background)', borderRadius: 'var(--radius)' }}>
                <i className="fa-solid fa-clock" style={{ fontSize: 24, color: 'var(--primary)', marginBottom: 8, display: 'block' }} />
                <div style={{ fontWeight: 700, fontSize: 20 }}>{exam.duration_minutes} min</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Durée</div>
              </div>
              <div style={{ textAlign: 'center', padding: 16, background: 'var(--background)', borderRadius: 'var(--radius)' }}>
                <i className="fa-solid fa-question-circle" style={{ fontSize: 24, color: 'var(--info)', marginBottom: 8, display: 'block' }} />
                <div style={{ fontWeight: 700, fontSize: 20 }}>{exam.questions?.length ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Questions</div>
              </div>
            </div>

            {exam.instructions && (
              <div className="alert alert-info" style={{ marginBottom: 24 }}>
                <strong><i className="fa-solid fa-circle-info" /> Instructions :</strong>
                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 14 }}>{exam.instructions}</div>
              </div>
            )}

            <div style={{ marginBottom: 24, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Règles de l'examen :</div>
              <ul style={{ paddingLeft: 20, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                {!exam.enable_copy_paste && <li>Copier/coller désactivé</li>}
                {!exam.enable_right_click && <li>Clic droit désactivé</li>}
                {exam.max_tab_switches != null && exam.max_tab_switches > 0 && (
                  <li>Maximum {exam.max_tab_switches} changement(s) d'onglet autorisé(s)</li>
                )}
                {exam.camera_required && <li>Caméra requise pendant l'examen</li>}
                <li>La copie sera soumise automatiquement à la fin du temps</li>
              </ul>
            </div>

            <button className="btn btn-primary btn-block" onClick={startExam} disabled={starting}>
              {starting
                ? <><i className="fa-solid fa-spinner spin" /> Démarrage...</>
                : <><i className="fa-solid fa-play" /> Commencer l'examen</>
              }
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'exam' && exam) {
    const questions = exam.questions ?? []

    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
        {/* Header barre d'examen */}
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 60, background: 'var(--surface)', borderBottom: '2px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{exam.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.full_name}</div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {tabSwitches > 0 && (
              <div style={{ fontSize: 13, color: '#f59e0b' }}>
                <i className="fa-solid fa-triangle-exclamation" /> {tabSwitches} changement(s) d'onglet
              </div>
            )}
            {lastSaved && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-cloud-arrow-up" /> Sauvegardé {lastSaved.toLocaleTimeString('fr-FR')}
              </div>
            )}
            <div style={{ fontSize: 24, fontWeight: 700, color: timeColor, minWidth: 80, textAlign: 'center', fontFamily: 'monospace' }}>
              <i className="fa-solid fa-clock" style={{ fontSize: 16 }} /> {formatTime(timeLeft)}
            </div>
            <button
              className="btn btn-success"
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir soumettre votre copie ? Cette action est irréversible.')) {
                  handleSubmit(false)
                }
              }}
              disabled={submitting}
            >
              {submitting ? <><i className="fa-solid fa-spinner spin" /> Soumission...</> : <><i className="fa-solid fa-paper-plane" /> Soumettre</>}
            </button>
          </div>
        </div>

        {/* Contenu examen */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px 40px' }}>
          {/* Sujet / contenu */}
          {exam.subject_content && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <h3><i className="fa-solid fa-file-lines" /> {typeof exam.subject_content === 'object' ? exam.subject_content.title : 'Sujet'}</h3>
              </div>
              <div style={{ padding: 24, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8 }}>
                {typeof exam.subject_content === 'object' ? exam.subject_content.content : exam.subject_content}
              </div>
            </div>
          )}

          {/* Questions */}
          {questions.length > 0 ? (
            questions.map((q, idx) => (
              <div key={q.id} className="card" style={{ marginBottom: 16 }}>
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, lineHeight: 1.5 }}>{q.content}</div>
                      {q.points && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{q.points} point(s)</div>}
                    </div>
                  </div>

                  {q.question_type === 'vf' ? (
                    <div style={{ display: 'flex', gap: 12 }}>
                      {['Vrai', 'Faux'].map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 20px', border: `2px solid ${answers[q.id.toString()] === opt ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: answers[q.id.toString()] === opt ? 'var(--primary)10' : 'transparent' }}>
                          <input type="radio" name={`q_${q.id}`} value={opt} checked={answers[q.id.toString()] === opt} onChange={() => setAnswers(prev => ({ ...prev, [q.id.toString()]: opt }))} style={{ display: 'none' }} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : q.question_type === 'qcm' && q.choices ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.choices.map((choice, ci) => (
                        <label key={ci} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 16px', border: `2px solid ${answers[q.id.toString()] === choice ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: answers[q.id.toString()] === choice ? 'var(--primary)10' : 'transparent' }}>
                          <input type="radio" name={`q_${q.id}`} value={choice} checked={answers[q.id.toString()] === choice} onChange={() => setAnswers(prev => ({ ...prev, [q.id.toString()]: choice }))} style={{ accentColor: 'var(--primary)' }} />
                          {choice}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      className="form-control"
                      rows={6}
                      placeholder="Votre réponse..."
                      value={answers[q.id.toString()] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id.toString()]: e.target.value }))}
                      style={{ resize: 'vertical' }}
                    />
                  )}
                </div>
              </div>
            ))
          ) : (
            /* Open answer if no structured questions */
            <div className="card">
              <div style={{ padding: 24 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Votre réponse</div>
                <textarea
                  className="form-control"
                  rows={20}
                  placeholder="Rédigez votre réponse ici..."
                  value={answers['answer'] ?? ''}
                  onChange={e => setAnswers({ answer: e.target.value })}
                  style={{ resize: 'vertical', minHeight: 400 }}
                />
              </div>
            </div>
          )}

          {/* Bottom submit */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              className="btn btn-success"
              style={{ minWidth: 200 }}
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir soumettre votre copie ? Cette action est irréversible.')) {
                  handleSubmit(false)
                }
              }}
              disabled={submitting}
            >
              {submitting ? <><i className="fa-solid fa-spinner spin" /> Soumission en cours...</> : <><i className="fa-solid fa-paper-plane" /> Soumettre ma copie</>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
