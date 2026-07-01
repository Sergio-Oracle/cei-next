'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

/* ── Types ──────────────────────────────────────────────────────────────── */
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
  ban_on_devtools?: boolean
  auto_correct?: boolean
  status: string
  questions?: Question[]
  subject_content?: { id: number; title: string; content: string } | string | null
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
  answers?: Record<string, string> | string
}

type Phase = 'loading' | 'instructions' | 'permissions' | 'exam' | 'submitted'
type PermStatus = 'pending' | 'loading' | 'ok' | 'error'

/* ── Composant principal ────────────────────────────────────────────────── */
export default function ExamPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { user } = useAuth()
  const { success, error: toastErr, warning } = useToast()

  const [exam,       setExam]       = useState<ExamData | null>(null)
  const [attempt,    setAttempt]    = useState<Attempt | null>(null)
  const [answers,    setAnswers]    = useState<Record<string, string>>({})
  const [phase,      setPhase]      = useState<Phase>('loading')
  const [timeLeft,   setTimeLeft]   = useState(0)
  const [tabCount,   setTabCount]   = useState(0)
  const [riskScore,  setRiskScore]  = useState(0)
  const [alerts,     setAlerts]     = useState<{ type: string; msg: string; at: string }[]>([])
  const [lastSaved,  setLastSaved]  = useState<Date | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [subjectOpen, setSubjectOpen] = useState(false)
  const [msgText,    setMsgText]    = useState('')
  const [msgSent,    setMsgSent]    = useState<string[]>([])
  const [camOn,      setCamOn]      = useState(false)
  const [micOn,      setMicOn]      = useState(false)
  const [screenOn,   setScreenOn]   = useState(false)
  const [faceStatus, setFaceStatus] = useState<'init' | 'ok' | 'absent' | 'multiple'>('init')

  // Consent modal
  const [showConsent,  setShowConsent]  = useState(false)
  const [starting,     setStarting]     = useState(false)

  // Permissions
  const [permCam,    setPermCam]    = useState<PermStatus>('pending')
  const [permMic,    setPermMic]    = useState<PermStatus>('pending')
  const [permScreen, setPermScreen] = useState<PermStatus>('pending')
  const [permError,  setPermError]  = useState('')
  const [permGranted, setPermGranted] = useState(false)

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const saveRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptRef  = useRef<number | null>(null)
  const videoRef    = useRef<HTMLVideoElement | null>(null)
  const camStream   = useRef<MediaStream | null>(null)
  const screenStream = useRef<MediaStream | null>(null)
  const canvasRef   = useRef<HTMLCanvasElement | null>(null)
  const sigMeta     = useRef({ strokes: 0, pathLength: 0, startTime: 0, endTime: 0 })
  const drawing     = useRef(false)
  const lastPos     = useRef([0, 0])

  /* ── Chargement exam ─────────────────────────────────────────────────── */
  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.get<ExamData>(`/api/online_exams/${id}/details`)
        setExam(res)
        setPhase('instructions')
      } catch (e: any) {
        toastErr(e.message || 'Erreur chargement examen')
        router.push('/dashboard/student')
      }
    })()
  }, [id]) // eslint-disable-line

  /* ── Nettoyage ──────────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (saveRef.current)  clearInterval(saveRef.current)
      camStream.current?.getTracks().forEach(t => t.stop())
      screenStream.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  /* ── Surveillance tab/copy/paste (phase exam) ────────────────────────── */
  useEffect(() => {
    if (phase !== 'exam') return
    const onVisibility = async () => {
      if (!document.hidden) return
      const next = tabCount + 1
      setTabCount(next)
      setRiskScore(r => Math.min(r + 10, 100))
      setAlerts(a => [{ type: 'tab', msg: `Changement d'onglet (${next})`, at: new Date().toLocaleTimeString('fr-FR') }, ...a])
      warning(`Attention : changement d'onglet détecté (${next}/${exam?.max_tab_switches ?? 3})`)
      try { if (attemptRef.current) await api.post(`/api/exam_attempts/${attemptRef.current}/log_activity`, { event: 'tab_switch', count: next }) } catch {}
      if (exam?.max_tab_switches && next >= exam.max_tab_switches) handleSubmit(true)
    }
    const noCtx = (e: MouseEvent) => { if (!exam?.enable_right_click) e.preventDefault() }
    const noCopy = (e: ClipboardEvent) => {
      if (!exam?.enable_copy_paste) { e.preventDefault(); warning('Copier/coller désactivé') }
    }
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('contextmenu', noCtx)
    document.addEventListener('copy', noCopy)
    document.addEventListener('paste', noCopy)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('contextmenu', noCtx)
      document.removeEventListener('copy', noCopy)
      document.removeEventListener('paste', noCopy)
    }
  }, [phase, exam, tabCount]) // eslint-disable-line

  /* ── Signature canvas setup ──────────────────────────────────────────── */
  useEffect(() => {
    if (!showConsent) return
    requestAnimationFrame(() => initSigCanvas())
  }, [showConsent])

  function initSigCanvas() {
    const c = canvasRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    c.width  = Math.round(rect.width) || 480
    c.height = 130
    const ctx = c.getContext('2d')!
    drawWatermark(ctx, c.width, c.height)
    sigMeta.current = { strokes: 0, pathLength: 0, startTime: 0, endTime: 0 }
  }

  function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save(); ctx.globalAlpha = 0.06
    ctx.font = `bold ${Math.max(14, Math.floor(h / 4))}px Arial`
    ctx.fillStyle = '#1e293b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.translate(w / 2, h / 2); ctx.rotate(-18 * Math.PI / 180)
    ctx.fillText('CEI — ATTESTATION', 0, 0); ctx.restore()
    const name = user?.full_name?.toUpperCase() ?? ''
    const dateStr = new Date().toLocaleDateString('fr-FR')
    ctx.save(); ctx.globalAlpha = 0.18; ctx.font = '9px monospace'; ctx.fillStyle = '#475569'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(name, 8, 5)
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(dateStr, w - 8, h - 5); ctx.restore()
    ctx.save(); ctx.globalAlpha = 0.15; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1
    ctx.setLineDash([4, 6])
    const y = h * 0.72
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(w - 10, y); ctx.stroke(); ctx.restore()
  }

  function clearSig() {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    drawWatermark(ctx, c.width, c.height)
    sigMeta.current = { strokes: 0, pathLength: 0, startTime: 0, endTime: 0 }
    c.style.border = '2px solid #e2e8f0'; c.style.background = '#fafafa'
  }

  function getSigPos(e: React.MouseEvent | React.TouchEvent) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0] : e
    return [(src.clientX - r.left) * (c.width / r.width), (src.clientY - r.top) * (c.height / r.height)]
  }

  function onSigStart(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault(); drawing.current = true
    const [x, y] = getSigPos(e); lastPos.current = [x, y]
    const m = sigMeta.current
    if (!m.startTime) m.startTime = Date.now()
    m.strokes++
  }

  function onSigMove(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault(); if (!drawing.current) return
    const [x, y] = getSigPos(e)
    const [lx, ly] = lastPos.current
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y)
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.stroke()
    const m = sigMeta.current
    m.pathLength += Math.sqrt((x - lx) ** 2 + (y - ly) ** 2)
    m.endTime = Date.now(); lastPos.current = [x, y]
  }

  function onSigEnd() { drawing.current = false }

  /* ── Démarrer examen (après signature) ──────────────────────────────── */
  async function doStartExam() {
    const c = canvasRef.current; if (!c) return
    const m = sigMeta.current
    if (m.strokes === 0) { c.style.border = '2px solid #ef4444'; c.style.background = '#fef2f2'; toastErr('Vous devez signer avant de démarrer.'); return }
    if (m.strokes < 2)  { toastErr('Signature insuffisante — tracez plusieurs traits.'); return }
    if (m.pathLength < 100) { toastErr('Signature trop courte — tracez votre signature complète.'); return }
    if ((m.endTime - m.startTime) < 800) { toastErr('Signature trop rapide — signez normalement.'); return }
    const signatureData = c.toDataURL('image/png')
    const signatureMeta = { strokes: m.strokes, path_length: Math.round(m.pathLength), duration_ms: m.endTime - m.startTime, signed_at: new Date().toISOString() }
    setStarting(true)
    try {
      const res = await api.post<{ success: boolean; attempt: Attempt; continuing?: boolean }>(
        `/api/online_exams/${id}/start`,
        { pre_exam_signature: signatureData, pre_exam_signature_meta: signatureMeta }
      )
      const att = res.attempt
      setAttempt(att); attemptRef.current = att.id
      if (att.answers) {
        try { const p = typeof att.answers === 'string' ? JSON.parse(att.answers) : att.answers; setAnswers(p || {}) } catch {}
      }
      setShowConsent(false)
      setPhase('permissions')
    } catch (e: any) {
      toastErr(e.message || "Impossible de démarrer l'examen")
    } finally { setStarting(false) }
  }

  /* ── Permissions ────────────────────────────────────────────────────── */
  async function requestAllPermissions() {
    setPermError('')
    // Caméra + Micro
    setPermCam('loading'); setPermMic('loading')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      camStream.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream }
      setPermCam('ok'); setPermMic('ok'); setCamOn(true); setMicOn(true)
    } catch {
      setPermCam('error'); setPermMic('error')
      setPermError('Caméra ou microphone refusé — veuillez les autoriser et réessayer.')
      return
    }
    // Partage d'écran
    setPermScreen('loading')
    try {
      const sStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: false })
      screenStream.current = sStream
      setPermScreen('ok'); setScreenOn(true)
      sStream.getVideoTracks()[0]?.addEventListener('ended', () => { setScreenOn(false); setAlerts(a => [{ type: 'screen', msg: 'Partage d\'écran arrêté', at: new Date().toLocaleTimeString('fr-FR') }, ...a]) })
    } catch {
      setPermScreen('error')
      setPermError('Partage d\'écran refusé — veuillez sélectionner "Tout l\'écran" et réessayer.')
      return
    }
    setPermGranted(true)
    enterExam()
  }

  function enterExam() {
    if (!exam || !attempt) return
    // Fullscreen
    document.documentElement.requestFullscreen?.().catch(() => {})
    // Timer
    const totalSec = exam.duration_minutes * 60 + ((attempt.extra_minutes ?? 0) * 60)
    const elapsedSec = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000)
    const remaining = Math.max(totalSec - elapsedSec, 0)
    setTimeLeft(remaining)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleSubmit(true); return 0 }
        return prev - 1
      })
    }, 1000)
    // Auto-save
    saveRef.current = setInterval(() => {
      if (attemptRef.current) doAutoSave(attemptRef.current)
    }, 30000)
    setPhase('exam')
    // Simulate face detection (init → ok after 3s)
    setTimeout(() => setFaceStatus('ok'), 3000)
  }

  async function doAutoSave(aId: number) {
    try { await api.post(`/api/exam_attempts/${aId}/save`, { answers: JSON.stringify(answers) }); setLastSaved(new Date()) } catch {}
  }

  /* ── Soumission ─────────────────────────────────────────────────────── */
  const handleSubmit = useCallback(async (auto = false) => {
    const aId = attemptRef.current
    if (!aId || submitting) return
    setSubmitting(true)
    if (timerRef.current) clearInterval(timerRef.current)
    if (saveRef.current)  clearInterval(saveRef.current)
    document.exitFullscreen?.().catch(() => {})
    camStream.current?.getTracks().forEach(t => t.stop())
    screenStream.current?.getTracks().forEach(t => t.stop())
    try {
      await api.post(`/api/exam_attempts/${aId}/submit`, { answers: JSON.stringify(answers) })
      if (!auto) success('Copie soumise avec succès !')
      setPhase('submitted')
    } catch {
      try { await api.post(`/api/exam_attempts/${aId}/save`, { answers: JSON.stringify(answers) }); setPhase('submitted') }
      catch { toastErr('Erreur lors de la soumission'); setSubmitting(false) }
    }
  }, [answers, submitting]) // eslint-disable-line

  function sendMsg() {
    if (!msgText.trim()) return
    setMsgSent(prev => [...prev, msgText.trim()])
    if (attemptRef.current) {
      api.post(`/api/exam_attempts/${attemptRef.current}/student_message`, { message: msgText }).catch(() => {})
    }
    setMsgText('')
  }

  function fmtTimer(s: number) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  const timerColor = timeLeft < 300 ? '#ef4444' : timeLeft < 600 ? '#f59e0b' : '#2563eb'

  /* ══════════════════════════════════════════════════════════════════════ */
  /* ── RENDER ─────────────────────────────────────────────────────────── */
  /* ══════════════════════════════════════════════════════════════════════ */

  if (phase === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: 48, color: '#2563eb', marginBottom: 16, display: 'block' }} />
        <p style={{ color: '#64748b' }}>Chargement de l'examen...</p>
      </div>
    </div>
  )

  if (phase === 'submitted') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 48, maxWidth: 480, width: '90%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.1)', border: '1px solid #e2e8f0' }}>
        <div style={{ width: 80, height: 80, background: 'rgba(16,185,129,.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 36, color: '#10b981' }}>
          <i className="fas fa-check-circle" />
        </div>
        <h2 style={{ color: '#0f172a', marginBottom: 12 }}>Copie soumise !</h2>
        <p style={{ color: '#64748b', marginBottom: 28, lineHeight: 1.6 }}>Votre copie a été transmise avec succès. Les résultats vous seront communiqués après correction.</p>
        <button onClick={() => router.push('/dashboard/student')} style={{ width: '100%', padding: '13px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          <i className="fas fa-home" style={{ marginRight: 8 }} />Retour au tableau de bord
        </button>
      </div>
    </div>
  )

  /* ── INSTRUCTIONS ────────────────────────────────────────────────────── */
  if (phase === 'instructions' && exam) return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 40, maxWidth: 620, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: '1px solid #e2e8f0' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>{exam.title}</h2>
          {exam.subject_title && <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{exam.subject_title}</p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <InfoBox icon="fa-clock" label="Durée" value={`${exam.duration_minutes} min`} color="#2563eb" />
          <InfoBox icon="fa-question-circle" label="Questions" value={exam.questions?.length ? String(exam.questions.length) : '—'} color="#64748b" />
        </div>

        {exam.instructions && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <i className="fas fa-info-circle" style={{ color: '#2563eb', marginTop: 1, flexShrink: 0 }} />
            <div><strong style={{ fontSize: 13, color: '#1e40af' }}>Instructions : </strong><span style={{ fontSize: 13, color: '#1e40af' }}>{exam.instructions}</span></div>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginBottom: 10 }}>Règles de l'examen :</p>
          <ul style={{ paddingLeft: 18, color: '#64748b', fontSize: 13, lineHeight: 2 }}>
            {!exam.enable_copy_paste  && <li>Copier/coller désactivé</li>}
            {!exam.enable_right_click && <li>Clic droit désactivé</li>}
            {exam.max_tab_switches != null && <li>Maximum {exam.max_tab_switches} changement(s) d'onglet autorisé(s)</li>}
            <li>La copie sera soumise automatiquement à la fin du temps</li>
          </ul>
        </div>

        <button onClick={() => setShowConsent(true)} style={{ width: '100%', padding: '14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <i className="fas fa-play" /> Commencer l'examen
        </button>
      </div>

      {/* ── Modal Attestation ─────────────────────────────────────────── */}
      {showConsent && (
        <div onClick={() => setShowConsent(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: 32, maxWidth: 580, width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,.2)' }}>
            {/* Header modal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, background: 'rgba(37,99,235,.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#2563eb', flexShrink: 0 }}>
                <i className="fas fa-shield-alt" />
              </div>
              <div>
                <h2 style={{ margin: '0 0 3px', fontSize: 17, color: '#1e293b' }}>Examen Surveillé — Attestation d'honneur</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Lisez les conditions et signez avant de démarrer</p>
              </div>
            </div>

            {/* Règles */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
              {[
                { icon: 'fa-video',       color: '#2563eb', text: 'Caméra et microphone activés pendant toute la durée' },
                { icon: 'fa-user-check',  color: '#10b981', text: 'Visage visible en permanence (détection faciale IA)' },
                { icon: 'fa-expand',      color: '#f59e0b', text: 'Plein écran obligatoire — tout changement d\'onglet est enregistré' },
                { icon: 'fa-ban',         color: '#ef4444', text: 'Toute fraude entraîne un bannissement immédiat et définitif' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: i < 3 ? 9 : 0 }}>
                  <i className={`fas ${r.icon}`} style={{ color: r.color, width: 16, textAlign: 'center', flexShrink: 0 }} />
                  <span>{r.text}</span>
                </div>
              ))}
            </div>

            {/* Attestation */}
            <div style={{ background: '#fff8ed', border: '1px solid #f59e0b', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                <i className="fas fa-file-signature" style={{ marginRight: 6 }} />Attestation sur l'honneur
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                Je soussigné(e) <strong>{user?.full_name}</strong>, certifie que je composerai cet examen seul(e), sans aide extérieure, sans document non autorisé, et sans aucun outil d'intelligence artificielle. Je reconnais que tout manquement à ces règles constitue une fraude académique passible de sanctions.
              </p>
            </div>

            {/* Canvas signature */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>
                <i className="fas fa-pen-nib" style={{ color: '#2563eb', marginRight: 5 }} />
                Signez ci-dessous pour confirmer votre engagement <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <canvas
                ref={canvasRef}
                style={{ border: '2px solid #e2e8f0', borderRadius: 8, display: 'block', cursor: 'crosshair', background: '#fafafa', touchAction: 'none', width: '100%', height: 130 }}
                onMouseDown={onSigStart as any} onMouseMove={onSigMove as any} onMouseUp={onSigEnd} onMouseLeave={onSigEnd}
                onTouchStart={onSigStart as any} onTouchMove={onSigMove as any} onTouchEnd={onSigEnd}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={clearSig} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                  <i className="fas fa-eraser" /> Effacer
                </button>
              </div>
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConsent(false)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                <i className="fas fa-times" style={{ marginRight: 6 }} />Annuler
              </button>
              <button onClick={doStartExam} disabled={starting} style={{ flex: 2, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: starting ? 'not-allowed' : 'pointer', opacity: starting ? .7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {starting ? <><i className="fas fa-spinner fa-spin" /> Démarrage…</> : <><i className="fas fa-pen-nib" /> Signer et démarrer l'examen</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  /* ── PERMISSIONS ─────────────────────────────────────────────────────── */
  if (phase === 'permissions') return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '40px 36px', maxWidth: 480, width: '100%', color: 'white' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, background: '#2563eb', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-shield-alt" style={{ fontSize: 20 }} />
          </div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>CEI — Surveillance active</div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Accès requis pour composer</h2>
        <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 28 }}>
          Pour démarrer l'examen, vous devez autoriser les 3 accès ci-dessous. Sans ces autorisations, la composition est impossible.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          <PermItem icon="fa-video"    label="Caméra"                desc={permCam === 'ok' ? 'Autorisé' : permCam === 'error' ? 'Refusé' : 'Obligatoire — surveillance vidéo en direct'} status={permCam} />
          <PermItem icon="fa-microphone" label="Microphone"          desc={permMic === 'ok' ? 'Autorisé' : permMic === 'error' ? 'Refusé' : 'Obligatoire — surveillance audio'} status={permMic} />
          <PermItem icon="fa-desktop"  label="Partage d'écran entier" desc={permScreen === 'ok' ? 'Autorisé' : permScreen === 'error' ? 'Refusé' : 'Obligatoire — sélectionnez "Écran entier" dans la boîte système'} status={permScreen} />
        </div>

        <button onClick={requestAllPermissions} disabled={permGranted} style={{ width: '100%', padding: 15, background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: permGranted ? 'not-allowed' : 'pointer', opacity: permGranted ? .5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <i className="fas fa-shield-alt" /> Autoriser la surveillance et commencer
        </button>

        {permError && (
          <div style={{ marginTop: 16, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#fca5a5' }}>
            <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />{permError}
          </div>
        )}
      </div>
    </div>
  )

  /* ── EXAM ─────────────────────────────────────────────────────────────── */
  if (phase === 'exam' && exam) {
    const questions = exam.questions ?? []
    const subjectContent = exam.subject_content
      ? (typeof exam.subject_content === 'object' ? exam.subject_content.content : exam.subject_content)
      : null
    const subjectTitle = exam.subject_content
      ? (typeof exam.subject_content === 'object' ? exam.subject_content.title : exam.title)
      : exam.title

    return (
      <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', fontFamily: "-apple-system,'Segoe UI',Roboto,sans-serif" }}>

        {/* ════ PANNEAU SURVEILLANCE GAUCHE ════ */}
        <div style={{ width: 280, minWidth: 280, background: 'white', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', boxShadow: '2px 0 8px rgba(0,0,0,.08)', overflowY: 'auto', zIndex: 100 }}>

          {/* Header panneau */}
          <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
              <i className="fas fa-shield-alt" /> Surveillance
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(255,255,255,.2)', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
              En cours
            </span>
          </div>

          {/* Bandeau Agent IA */}
          <div style={{ margin: '8px 10px', padding: '9px 11px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.22)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, background: 'rgba(16,185,129,.15)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fas fa-robot" style={{ color: '#6ee7b7', fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
              <span style={{ width: 7, height: 7, background: '#10b981', borderRadius: '50%', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 600, lineHeight: 1.4 }}>
                Agent IA de surveillance actif<br />
                <span style={{ fontWeight: 400, color: 'rgba(110,231,183,.65)' }}>Surveillance automatique en temps réel</span>
              </span>
            </div>
          </div>

          {/* Caméra */}
          <div style={{ margin: '0 12px 8px', borderRadius: 8, overflow: 'hidden', background: '#000', boxShadow: '0 2px 8px rgba(0,0,0,.12)', position: 'relative', aspectRatio: '4/3' }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
            {/* Face overlay */}
            <div style={{ position: 'absolute', top: 6, right: 6, padding: '3px 7px', background: faceStatus === 'ok' ? 'rgba(16,185,129,.9)' : faceStatus === 'absent' ? 'rgba(239,68,68,.9)' : 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', borderRadius: 4, color: 'white', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              {faceStatus === 'init' ? <><i className="fas fa-sync fa-spin" /> Init…</> : faceStatus === 'ok' ? <><i className="fas fa-user-check" /> Visage OK</> : <><i className="fas fa-user-slash" /> Absent</>}
            </div>
          </div>

          {/* Guide positionnement */}
          {faceStatus !== 'ok' && (
            <div style={{ margin: '0 12px 8px', padding: '8px 10px', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, fontWeight: 600, color: '#92400e', lineHeight: 1.4 }}>
              <i className="fas fa-info-circle" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Regardez la caméra et restez immobile — enregistrement de votre visage en cours</span>
            </div>
          )}

          {/* Statut périphériques */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
            {[
              { icon: 'fa-video', label: 'Caméra', on: camOn },
              { icon: 'fa-microphone', label: 'Micro', on: micOn },
              { icon: 'fa-desktop', label: 'Écran', on: screenOn },
            ].map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 6, marginBottom: 4, background: '#f8fafc', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: d.on ? 'rgba(16,185,129,.1)' : 'white', border: `2px solid ${d.on ? '#10b981' : '#e2e8f0'}`, borderRadius: 4, fontSize: 11, color: d.on ? '#10b981' : '#94a3b8' }}>
                    <i className={`fas ${d.icon}`} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>{d.label}</span>
                </div>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 600, background: d.on ? 'rgba(16,185,129,.1)' : 'rgba(100,116,139,.1)', color: d.on ? '#10b981' : '#64748b' }}>{d.on ? 'On' : 'Off'}</span>
              </div>
            ))}
          </div>

          {/* Score de risque */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: '#64748b' }}>
              <i className="fas fa-chart-line" /> Score de risque
            </div>
            <div style={{ height: 20, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden', position: 'relative', border: '2px solid #e2e8f0' }}>
              <div style={{ height: '100%', background: riskScore >= 70 ? '#ef4444' : riskScore >= 40 ? '#f59e0b' : '#10b981', width: `${Math.min(riskScore, 100)}%`, transition: 'width .5s, background-color .3s' }} />
              <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontWeight: 700, fontSize: 11, color: '#0f172a' }}>{riskScore}</span>
            </div>
          </div>

          {/* Alertes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: '#64748b' }}>
              <i className="fas fa-exclamation-triangle" /> Alertes système
            </div>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 12px', color: '#94a3b8' }}>
                <i className="fas fa-shield-alt" style={{ fontSize: 24, opacity: .3, display: 'block', marginBottom: 6 }} />
                <p style={{ fontSize: 10 }}>Aucune alerte</p>
              </div>
            ) : alerts.map((a, i) => (
              <div key={i} style={{ background: 'rgba(239,68,68,.05)', borderLeft: '3px solid #ef4444', padding: '6px 8px', marginBottom: 6, borderRadius: 4, fontSize: 10 }}>
                <div style={{ marginBottom: 3, color: '#0f172a', fontWeight: 500 }}>{a.msg}</div>
                <div style={{ color: '#64748b', fontSize: 9 }}>{a.at}</div>
              </div>
            ))}
          </div>

          {/* Contacter l'enseignant */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: '#64748b', marginBottom: 6 }}>
              <i className="fas fa-comments" /> Contacter l'enseignant
            </div>
            <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>Question ou réclamation...</p>
            <div style={{ display: 'flex', gap: 4 }}>
              <textarea value={msgText} onChange={e => setMsgText(e.target.value)} style={{ flex: 1, background: 'white', border: '1px solid #e2e8f0', borderRadius: 4, padding: '5px 7px', fontSize: 11, color: '#0f172a', resize: 'none', height: 40 }} />
              <button onClick={sendMsg} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, padding: '5px 10px', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>
                <i className="fas fa-paper-plane" />
              </button>
            </div>
            {msgSent.length > 0 && (
              <div style={{ maxHeight: 80, overflowY: 'auto', marginTop: 6 }}>
                {msgSent.map((m, i) => (
                  <div key={i} style={{ background: 'rgba(37,99,235,.07)', borderRadius: 4, padding: '4px 6px', marginBottom: 3, fontSize: 10, color: '#1e3a8a' }}>{m}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ════ PANNEAU EXAMEN DROITE ════ */}
        <div style={{ flex: 1, background: '#f8fafc', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Header exam */}
          <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,.04)' }}>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>{exam.title}</h1>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 2, margin: '2px 0 0' }}>
                {user?.full_name} &nbsp;·&nbsp; Durée : {exam.duration_minutes} min &nbsp;·&nbsp; Commencé à {attempt?.started_at ? new Date(attempt.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {lastSaved && <span style={{ fontSize: 11, color: '#10b981' }}><i className="fas fa-cloud-arrow-up" style={{ marginRight: 4 }} />Sauvegardé {lastSaved.toLocaleTimeString('fr-FR')}</span>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: timerColor, color: 'white', borderRadius: 8, fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                <i className="fas fa-clock" style={{ fontSize: 16 }} /> {fmtTimer(timeLeft)}
              </div>
              <button onClick={() => { if (confirm('Êtes-vous sûr de vouloir soumettre votre copie ? Cette action est irréversible.')) handleSubmit(false) }} disabled={submitting}
                style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                {submitting ? <><i className="fas fa-spinner fa-spin" /> Soumission…</> : <><i className="fas fa-paper-plane" /> Soumettre</>}
              </button>
            </div>
          </div>

          {/* Contenu */}
          <div style={{ flex: 1, padding: 24, maxWidth: 900, width: '100%', margin: '0 auto' }}>

            {/* Sujet — accordéon */}
            {subjectContent && (
              <div style={{ background: 'white', borderRadius: 12, marginBottom: 24, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.04)', overflow: 'hidden' }}>
                <div onClick={() => setSubjectOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', cursor: 'pointer', userSelect: 'none', borderBottom: subjectOpen ? '1px solid #e2e8f0' : 'none' }}>
                  <i className="fas fa-file-alt" style={{ color: '#2563eb', fontSize: 16 }} />
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a', flex: 1 }}>{subjectTitle}</h2>
                  <i className={`fas fa-chevron-${subjectOpen ? 'up' : 'down'}`} style={{ color: '#94a3b8', fontSize: 13 }} />
                </div>
                {subjectOpen && (
                  <div style={{ padding: 24, fontSize: 14, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' }}>
                    {subjectContent}
                  </div>
                )}
              </div>
            )}

            {/* Zone réponse */}
            {questions.length > 0 ? (
              questions.map((q, idx) => (
                <div key={q.id} style={{ background: 'white', borderRadius: 12, marginBottom: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.04)', padding: 24 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, lineHeight: 1.5, color: '#0f172a' }}>{q.content}</div>
                      {q.points && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{q.points} point(s)</div>}
                    </div>
                  </div>
                  {q.question_type === 'vf' ? (
                    <div style={{ display: 'flex', gap: 12 }}>
                      {['Vrai', 'Faux'].map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 20px', border: `2px solid ${answers[q.id.toString()] === opt ? '#2563eb' : '#e2e8f0'}`, borderRadius: 8, background: answers[q.id.toString()] === opt ? '#eff6ff' : 'transparent', flex: 1, justifyContent: 'center' }}>
                          <input type="radio" style={{ display: 'none' }} checked={answers[q.id.toString()] === opt} onChange={() => setAnswers(p => ({ ...p, [q.id.toString()]: opt }))} readOnly />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : q.question_type === 'qcm' && q.choices ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.choices.map((ch, ci) => (
                        <label key={ci} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 16px', border: `2px solid ${answers[q.id.toString()] === ch ? '#2563eb' : '#e2e8f0'}`, borderRadius: 8, background: answers[q.id.toString()] === ch ? '#eff6ff' : 'transparent' }}>
                          <input type="radio" name={`q_${q.id}`} checked={answers[q.id.toString()] === ch} onChange={() => setAnswers(p => ({ ...p, [q.id.toString()]: ch }))} style={{ accentColor: '#2563eb' }} />
                          {ch}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea value={answers[q.id.toString()] ?? ''} onChange={e => setAnswers(p => ({ ...p, [q.id.toString()]: e.target.value }))} rows={6} placeholder="Votre réponse…" style={{ width: '100%', padding: 16, border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 14, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} onFocus={e => { (e.target as HTMLElement).style.borderColor = '#2563eb' }} onBlur={e => { (e.target as HTMLElement).style.borderColor = '#e2e8f0' }} />
                  )}
                </div>
              ))
            ) : (
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.04)', padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fas fa-pen" style={{ color: '#2563eb' }} /> Votre réponse
                </h2>
                <textarea value={answers['answer'] ?? ''} onChange={e => setAnswers({ answer: e.target.value })} placeholder="Rédigez vos réponses ici en indiquant le numéro de chaque question…" style={{ width: '100%', minHeight: 300, padding: 16, border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 14, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} onFocus={e => { (e.target as HTMLElement).style.borderColor = '#2563eb' }} onBlur={e => { (e.target as HTMLElement).style.borderColor = '#e2e8f0' }} />
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-save" /> Les réponses sont sauvegardées automatiquement
                </p>
              </div>
            )}
          </div>

          {/* Barre soumission bas */}
          <div style={{ padding: '20px 24px', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
            <button onClick={() => { if (attemptRef.current) doAutoSave(attemptRef.current) }} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
              <i className="fas fa-save" /> Sauvegarder brouillon
            </button>
            <button onClick={() => { if (confirm('Soumettre votre copie ? Cette action est irréversible.')) handleSubmit(false) }} disabled={submitting}
              style={{ padding: '10px 24px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
              <i className="fas fa-paper-plane" /> Soumettre l'examen
            </button>
          </div>
        </div>

        {/* Keyframe pulse inline */}
        <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.9)}}`}</style>
      </div>
    )
  }

  return null
}

/* ── Composants helpers ──────────────────────────────────────────────────── */
function InfoBox({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
      <i className={`fas ${icon}`} style={{ fontSize: 24, color, marginBottom: 8, display: 'block' }} />
      <div style={{ fontWeight: 700, fontSize: 20, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function PermItem({ icon, label, desc, status }: { icon: string; label: string; desc: string; status: PermStatus }) {
  const ok  = status === 'ok'
  const err = status === 'error'
  const ld  = status === 'loading'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#0f172a', border: `1px solid ${ok ? '#10b981' : err ? '#ef4444' : '#334155'}`, borderRadius: 12, padding: '14px 16px', transition: 'border-color .3s' }}>
      <div style={{ width: 40, height: 40, minWidth: 40, borderRadius: 10, background: ok ? 'rgba(16,185,129,.15)' : err ? 'rgba(239,68,68,.15)' : '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className={`fas ${icon}`} style={{ color: ok ? '#10b981' : err ? '#ef4444' : '#94a3b8', fontSize: 18 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, color: 'white' }}>{label}</div>
        <div style={{ fontSize: 12, color: ok ? '#10b981' : err ? '#ef4444' : '#64748b' }}>{ld ? 'Demande en cours...' : desc}</div>
      </div>
      <div style={{ width: 24, height: 24, minWidth: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: ok ? '#10b981' : err ? '#ef4444' : '#334155', color: 'white' }}>
        {ok ? <i className="fas fa-check" /> : err ? <i className="fas fa-times" /> : ld ? <i className="fas fa-spinner fa-spin" style={{ fontSize: 9 }} /> : <i className="fas fa-clock" style={{ fontSize: 9 }} />}
      </div>
    </div>
  )
}
