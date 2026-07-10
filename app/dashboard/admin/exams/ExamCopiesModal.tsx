'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { ExamAttempt } from '@/types'
import { StatsModal, PlagiatModal, BilanModal } from './ExamToolbarModals'

/* ── Types locaux ──────────────────────────────────────────────── */
type RichAttempt = ExamAttempt & {
  student_email?: string
  has_incidents?: boolean
  needs_correction?: boolean
  pre_exam_signature_data?: string
  pre_exam_signature_meta?: string
  signature_data?: string
  ban_reason?: string
}

/* ── Helpers ───────────────────────────────────────────────────── */
function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const TH = ({ label }: { label: string }) => (
  <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
    {label}
  </th>
)
const TD_S = 'padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:middle;'

/* ── ManualGradeModal ─────────────────────────────────────────── */
function ManualGradeModal({ attempt, onClose, onDone }: { attempt: RichAttempt; onClose: () => void; onDone: () => void }) {
  const [score, setScore]     = useState(attempt.score !== null && attempt.score !== undefined ? String(attempt.score) : '')
  const [fb,    setFb]        = useState(attempt.feedback ?? '')
  const [saving, setSaving]   = useState(false)
  const { success, error }    = useToast()

  async function save() {
    const s = parseFloat(score)
    if (isNaN(s) || s < 0 || s > 20) { error('Note invalide (0–20)'); return }
    setSaving(true)
    try {
      await api.put(`/api/exam_attempts/${attempt.id}/manual-grade`, { score: s, feedback: fb })
      success('Note enregistrée')
      onDone()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSaving(false) }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-pen" style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Correction manuelle — {attempt.student_name}</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-muted)' }}><i className="fas fa-times" /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Note /20
            <input type="number" min={0} max={20} step={0.5} value={score} onChange={e => setScore(e.target.value)}
              className="form-control" style={{ marginTop: 6, fontSize: 18, fontWeight: 800, textAlign: 'center' }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Feedback (optionnel)
            <textarea value={fb} onChange={e => setFb(e.target.value)} rows={4}
              className="form-control" style={{ marginTop: 6, fontSize: 13, resize: 'vertical' }} />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn btn-secondary">Annuler</button>
            <button onClick={save} disabled={saving} className="btn btn-primary" style={{ minWidth: 120 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />Sauvegarde…</> : <><i className="fas fa-save" style={{ marginRight: 6 }} />Enregistrer</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── ProctorNotesModal ────────────────────────────────────────── */
function ProctorNotesModal({ attemptId, studentName, onClose }: { attemptId: number; studentName: string; onClose: () => void }) {
  const [notes, setNotes]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText]     = useState('')
  const [saving, setSaving] = useState(false)
  const { error, success }  = useToast()

  useEffect(() => { load() }, [])  // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<any>(`/api/exam_attempts/${attemptId}/proctor-notes`)
      setNotes(Array.isArray(res) ? res : (res.notes ?? []))
    }
    catch { error('Impossible de charger les notes') }
    finally { setLoading(false) }
  }

  async function addNote() {
    if (!text.trim()) return
    setSaving(true)
    try {
      await api.post(`/api/exam_attempts/${attemptId}/proctor-note`, { note: text })
      success('Note ajoutée')
      setText(''); await load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSaving(false) }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-sticky-note" style={{ color: '#0284c7' }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Notes de surveillance — {studentName}</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-muted)' }}><i className="fas fa-times" /></button>
        </div>
        <div style={{ padding: 20, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}><i className="fas fa-spinner fa-spin" /></div>
            : notes.length === 0 ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucune note de surveillance</div>
            : notes.map((n: any, i) => (
              <div key={i} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, marginBottom: 4 }}>
                  {(n.timestamp || n.created_at) ? new Date(n.timestamp || n.created_at).toLocaleString('fr-FR') : '—'}
                  {n.author ? ` — ${n.author}` : ''}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{n.note}</div>
              </div>
            ))
          }
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Ajouter une note…"
            className="form-control" style={{ fontSize: 13 }}
            onKeyDown={e => { if (e.key === 'Enter') addNote() }} />
          <button onClick={addNote} disabled={saving || !text.trim()} className="btn btn-primary" style={{ flexShrink: 0 }}>
            {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-plus" />}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── ExtraTimeModal ───────────────────────────────────────────── */
function ExtraTimeModal({ attemptId, studentName, onClose, onDone }: { attemptId: number; studentName: string; onClose: () => void; onDone: () => void }) {
  const [min, setMin]     = useState('5')
  const [saving, setSaving] = useState(false)
  const { success, error }  = useToast()

  async function save() {
    const m = parseInt(min)
    if (!m || m < 1 || m > 120) { error('Durée invalide (1–120 min)'); return }
    setSaving(true)
    try {
      await api.put(`/api/exam_attempts/${attemptId}/extra-time`, { minutes: m })
      success(`${m} min accordées à ${studentName}`)
      onDone()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSaving(false) }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-clock" style={{ color: '#16a34a' }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Temps supplémentaire — {studentName}</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-muted)' }}><i className="fas fa-times" /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[5, 10, 15, 30].map(v => (
              <button key={v} onClick={() => setMin(String(v))}
                style={{ flex: 1, padding: '8px 0', border: `1.5px solid ${min === String(v) ? '#16a34a' : 'var(--border)'}`, borderRadius: 8, background: min === String(v) ? '#f0fdf4' : 'var(--surface)', color: min === String(v) ? '#16a34a' : 'var(--text)', fontWeight: min === String(v) ? 700 : 400, fontSize: 12, cursor: 'pointer' }}>
                {v} min
              </button>
            ))}
          </div>
          <input type="number" min={1} max={120} value={min} onChange={e => setMin(e.target.value)}
            className="form-control" style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn btn-secondary">Annuler</button>
            <button onClick={save} disabled={saving} className="btn btn-primary" style={{ minWidth: 120 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />…</> : <><i className="fas fa-plus" style={{ marginRight: 6 }} />Accorder</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main Modal ────────────────────────────────────────────────── */
interface Props {
  examId: number
  examTitle: string
  onClose: () => void
}

export default function ExamCopiesModal({ examId, examTitle, onClose }: Props) {
  const { error, success }    = useToast()
  const [attempts, setAttempts] = useState<RichAttempt[]>([])
  const [loading, setLoading]   = useState(true)
  const [acting, setActing]     = useState<number | null>(null)

  /* Sub-modals */
  const [manualAttempt, setManualAttempt]     = useState<RichAttempt | null>(null)
  const [notesAttemptId, setNotesAttemptId]   = useState<number | null>(null)
  const [notesStudent,   setNotesStudent]     = useState('')
  const [extraAttemptId, setExtraAttemptId]   = useState<number | null>(null)
  const [extraStudent,   setExtraStudent]     = useState('')

  /* Attempt review modal */
  const [reviewAttemptId, setReviewAttemptId] = useState<number | null>(null)

  /* Toolbar modals */
  const [showStats,  setShowStats]  = useState(false)
  const [showPlagiat, setShowPlagiat] = useState(false)
  const [showBilan,  setShowBilan]  = useState(false)
  const [correctingAll, setCorrectingAll] = useState(false)
  const [csvDownloading, setCsvDownloading] = useState(false)

  useEffect(() => { load() }, [])  // eslint-disable-line

  async function load() {
    setLoading(true)
    try { setAttempts(await api.get<RichAttempt[]>(`/api/online_exams/${examId}/attempts`)) }
    catch { error('Erreur de chargement des copies') }
    finally { setLoading(false) }
  }

  async function correctAttempt(id: number) {
    setActing(id)
    try {
      await api.post(`/api/exam_attempts/${id}/correct`, {})
      success('Correction IA lancée — actualisez dans quelques instants')
      await load()
    } catch (e: any) { error(e.message || 'Erreur correction') }
    finally { setActing(null) }
  }

  async function unban(id: number, name: string) {
    if (!confirm(`Débannir ${name} ?`)) return
    setActing(id)
    try {
      await api.post(`/api/exam_attempts/${id}/unban`, {})
      success(`${name} a été débanni(e)`)
      await load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActing(null) }
  }

  async function openIntegrityReport(id: number, studentName: string) {
    try {
      const blob = await api.blob(`/api/exam_attempts/${id}/integrity-report`)
      const url = URL.createObjectURL(blob)
      const safeName = studentName.trim().replace(/\s+/g, '_') || String(id)
      Object.assign(document.createElement('a'), { href: url, download: `rapport_integrite_${safeName}.pdf` }).click()
      URL.revokeObjectURL(url)
    } catch (e: any) { error(e.message || 'Rapport non disponible') }
  }

  async function exportCsv() {
    setCsvDownloading(true)
    try {
      const blob = await api.blob(`/api/online_exams/${examId}/export-csv`)
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: `examen_${examId}_resultats.csv` }).click()
      URL.revokeObjectURL(url)
    } catch { error('Erreur export CSV') }
    finally { setCsvDownloading(false) }
  }

  const inProgress = attempts.filter(a => a.status === 'in_progress')
  const done       = attempts.filter(a => a.status === 'submitted' || a.status === 'auto_submitted')
  const banned     = attempts.filter(a => a.status === 'banned')
  const hasToDo    = done.some(a => a.needs_correction)

  return (
    <>
      <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>

          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <i className="fas fa-file-alt" style={{ color: 'var(--primary)', fontSize: 18 }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{examTitle}</h3>
              <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Stats + actions rapides */}
            {!loading && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ background: 'rgba(16,185,129,.1)', color: '#059669', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                  <i className="fas fa-circle" style={{ fontSize: 8, marginRight: 4 }} />{inProgress.length} en cours
                </span>
                <span style={{ background: 'rgba(37,99,235,.1)', color: '#2563eb', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                  <i className="fas fa-check-circle" style={{ marginRight: 4 }} />{done.length} terminé(s)
                </span>
                {banned.length > 0 && (
                  <span style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                    <i className="fas fa-ban" style={{ marginRight: 4 }} />{banned.length} banni(s)
                  </span>
                )}
                {hasToDo && (
                  <button onClick={async () => {
                    if (!confirm('Corriger automatiquement TOUTES les tentatives soumises avec l\'IA ?')) return
                    setCorrectingAll(true)
                    let ok = 0, ko = 0
                    for (const a of done.filter(x => x.needs_correction)) {
                      try { await api.post(`/api/exam_attempts/${a.id}/correct`, {}); ok++ }
                      catch { ko++ }
                    }
                    success(`Correction terminée : ${ok} réussie(s)${ko > 0 ? `, ${ko} erreur(s)` : ''}`)
                    setCorrectingAll(false)
                    load()
                  }} disabled={correctingAll}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#059669', cursor: correctingAll ? 'not-allowed' : 'pointer' }}>
                    {correctingAll ? <><i className="fas fa-spinner fa-spin" />Correction…</> : <><i className="fas fa-wand-magic-sparkles" />Tout corriger (IA)</>}
                  </button>
                )}
              </div>
            )}

            {/* Toolbar */}
            {!loading && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <ToolBtn icon="fa-chart-bar"       label="Statistiques" bg="#eff6ff" color="#2563eb" onClick={() => setShowStats(true)} />
                <ToolBtn icon="fa-file-csv"         label={csvDownloading ? 'Export…' : 'Export CSV'}   bg="#d1fae5" color="#059669" onClick={exportCsv} />
                <ToolBtn icon="fa-magnifying-glass" label="Plagiat"      bg="#fee2e2" color="#ef4444" onClick={() => setShowPlagiat(true)} />
                <ToolBtn icon="fa-list-check"       label="Bilan"        bg="#e0f2fe" color="#0369a1" onClick={() => setShowBilan(true)} />
              </div>
            )}
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
              </div>
            ) : (
              <>
                {/* EN COURS */}
                <Section title={`EN COURS (${inProgress.length})`} color="#059669" dot>
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <TH label="Étudiant" /><TH label="Démarré" /><TH label="Alertes" /><TH label="Statut" /><TH label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {inProgress.length === 0
                          ? <tr><td colSpan={5} style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Aucun étudiant en cours</td></tr>
                          : inProgress.map(a => (
                            <tr key={a.id}>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                <strong>{a.student_name || 'N/A'}</strong>
                                {a.student_email && <><br /><small style={{ color: '#64748b' }}>{a.student_email}</small></>}
                              </td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                {a.started_at ? new Date(a.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                {(a.warnings_count ?? 0) > 0
                                  ? <span style={{ color: '#ef4444', fontWeight: 600 }}><i className="fas fa-exclamation-circle" style={{ marginRight: 4 }} />{a.warnings_count}</span>
                                  : <span style={{ color: '#10b981' }}><i className="fas fa-check" style={{ marginRight: 4 }} />0</span>}
                              </td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                <span style={{ background: 'rgba(16,185,129,.1)', color: '#059669', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                                  En cours
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                <div style={{ display: 'flex', gap: 5 }}>
                                  <button onClick={() => { setExtraAttemptId(a.id); setExtraStudent(a.student_name || '') }}
                                    style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                    <i className="fas fa-clock" style={{ marginRight: 4 }} />+temps
                                  </button>
                                  <button onClick={() => { setNotesAttemptId(a.id); setNotesStudent(a.student_name || '') }}
                                    style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                    <i className="fas fa-sticky-note" style={{ marginRight: 4 }} />Note
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </Section>

                {/* TERMINÉS */}
                <Section title={`TERMINÉS (${done.length})`} color="#2563eb" subtitle="Pré = signature avant exam · Post = signature à la soumission">
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <TH label="Étudiant" /><TH label="Statut" /><TH label="Soumis le" /><TH label="Signatures" /><TH label="Note" /><TH label="Action" />
                        </tr>
                      </thead>
                      <tbody>
                        {done.length === 0
                          ? <tr><td colSpan={6} style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Aucune copie soumise</td></tr>
                          : done.map(a => {
                            const isAuto = a.status === 'auto_submitted'
                            const busy   = acting === a.id
                            return (
                              <tr key={a.id}>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                  <strong>{a.student_name || 'N/A'}</strong>
                                  {a.student_email && <><br /><small style={{ color: '#64748b' }}>{a.student_email}</small></>}
                                </td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                  {isAuto
                                    ? <span style={{ background: 'rgba(245,158,11,.1)', color: '#d97706', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                                        <i className="fas fa-clock" style={{ marginRight: 4 }} />Auto-soumis
                                      </span>
                                    : <span style={{ background: 'rgba(16,185,129,.1)', color: '#059669', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                                        <i className="fas fa-check" style={{ marginRight: 4 }} />Soumis
                                      </span>}
                                </td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, whiteSpace: 'nowrap' }}>
                                  {a.submitted_at ? fmtDT(a.submitted_at) : '—'}
                                </td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {(a as any).pre_exam_signature_data
                                      ? <span style={{ background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.3)', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                                          <i className="fas fa-check-circle" style={{ marginRight: 2 }} />Pré
                                        </span>
                                      : <span style={{ color: '#94a3b8', fontSize: 10 }}><i className="fas fa-times-circle" style={{ marginRight: 2 }} />Pré absent</span>}
                                    {(a as any).signature_data
                                      ? <span style={{ background: 'rgba(37,99,235,.1)', color: '#2563eb', border: '1px solid rgba(37,99,235,.3)', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                                          <i className="fas fa-check-circle" style={{ marginRight: 2 }} />Post
                                        </span>
                                      : <span style={{ color: isAuto ? '#f59e0b' : '#94a3b8', fontSize: 10 }}>
                                          <i className={`fas fa-${isAuto ? 'clock' : 'times-circle'}`} style={{ marginRight: 2 }} />{isAuto ? 'Auto' : 'Post absent'}
                                        </span>}
                                  </div>
                                </td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                  {a.score !== null && a.score !== undefined
                                    ? <strong style={{ color: (a.score ?? 0) >= 10 ? '#10b981' : '#ef4444', fontSize: 15 }}>{a.score}/20</strong>
                                    : <span style={{ color: '#94a3b8', fontSize: 12 }}>Non corrigé</span>}
                                </td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {a.needs_correction
                                      ? <button onClick={() => correctAttempt(a.id)} disabled={busy}
                                          style={{ background: '#eff6ff', color: 'var(--primary)', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                                          {busy ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-wand-magic-sparkles" style={{ marginRight: 2 }} />Corriger</>}
                                        </button>
                                      : <button onClick={() => setReviewAttemptId(a.id)}
                                          style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                          <i className="fas fa-eye" />Voir
                                        </button>}
                                    <button onClick={() => setManualAttempt(a)}
                                      style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer' }} title="Correction manuelle">
                                      <i className="fas fa-pen" />
                                    </button>
                                    <button onClick={() => openIntegrityReport(a.id, a.student_name || '')}
                                      style={{ background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer' }} title="Rapport intégrité PDF">
                                      <i className="fas fa-file-pdf" />
                                    </button>
                                    <button onClick={() => { setNotesAttemptId(a.id); setNotesStudent(a.student_name || '') }}
                                      style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer' }} title="Notes de surveillance">
                                      <i className="fas fa-sticky-note" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        }
                      </tbody>
                    </table>
                  </div>
                </Section>

                {/* BANNIS */}
                {banned.length > 0 && (
                  <Section title={`EXCLUS (${banned.length})`} color="#ef4444">
                    <div style={{ overflowX: 'auto', border: '1px solid #fee2e2', borderRadius: 8, background: '#fff5f5' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#fef2f2' }}>
                            <TH label="Étudiant" /><TH label="Raison" /><TH label="Action" />
                          </tr>
                        </thead>
                        <tbody>
                          {banned.map(a => (
                            <tr key={a.id}>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #fee2e2', fontSize: 13 }}>
                                <strong>{a.student_name || 'N/A'}</strong>
                                {a.student_email && <><br /><small style={{ color: '#64748b' }}>{a.student_email}</small></>}
                              </td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #fee2e2', fontSize: 13, color: '#ef4444' }}>
                                {(a as any).ban_reason || 'Fraude détectée'}
                              </td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #fee2e2', fontSize: 13 }}>
                                <button onClick={() => unban(a.id, a.student_name || 'cet étudiant')} disabled={acting === a.id}
                                  style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                  <i className="fas fa-user-check" style={{ marginRight: 4 }} />Débannir
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Section>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
              <i className="fas fa-times" />Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modals tentatives */}
      {manualAttempt && (
        <ManualGradeModal attempt={manualAttempt} onClose={() => setManualAttempt(null)} onDone={() => { setManualAttempt(null); load() }} />
      )}
      {notesAttemptId !== null && (
        <ProctorNotesModal attemptId={notesAttemptId} studentName={notesStudent} onClose={() => setNotesAttemptId(null)} />
      )}
      {extraAttemptId !== null && (
        <ExtraTimeModal attemptId={extraAttemptId} studentName={extraStudent} onClose={() => setExtraAttemptId(null)} onDone={() => { setExtraAttemptId(null); load() }} />
      )}

      {/* Attempt review modal */}
      {reviewAttemptId !== null && <AttemptReviewModal attemptId={reviewAttemptId} onClose={() => setReviewAttemptId(null)} />}

      {/* Toolbar modals */}
      {showStats   && <StatsModal  examId={examId} examTitle={examTitle} onClose={() => setShowStats(false)} />}
      {showPlagiat && <PlagiatModal examId={examId} examTitle={examTitle} onClose={() => setShowPlagiat(false)} />}
      {showBilan   && <BilanModal  examId={examId} examTitle={examTitle} onClose={() => setShowBilan(false)} />}
    </>
  )
}

/* ── AttemptReviewModal ────────────────────────────────────────── */
interface ReviewData {
  attempt_id: number; student_name: string; student_email?: string; exam_title?: string; subject_title?: string;
  status: string; score: number | null; started_at?: string; submitted_at?: string; duration_min?: number | null;
  risk_score: number; tab_switches: number; warnings_count: number; no_face_count: number; extra_minutes: number;
  ban_reason?: string; student_answer?: string; raw_answers?: string; feedback?: string; corrector_name?: string;
  incidents: Array<{type: string; data?: any; timestamp?: string}>;
  proctor_notes: Array<{note: string; author?: string; timestamp?: string}>;
  corrected_at?: string;
}

const STATUS_LBL: Record<string, string> = { submitted: 'Soumis', auto_submitted: 'Auto-soumis', in_progress: 'En cours', banned: 'Exclu' }
const STATUS_CLR: Record<string, string> = { submitted: '#059669', auto_submitted: '#d97706', in_progress: '#3b82f6', banned: '#ef4444' }
const CHOICE_CLR: Record<string, string> = { A:'#3b82f6', B:'#10b981', C:'#f59e0b', D:'#ef4444', E:'#2563eb', F:'#06b6d4', Vrai:'#10b981', Faux:'#ef4444' }
const INCIDENT_FR: Record<string, string> = {
  tab_switch: 'Changement d\'onglet', window_blur: 'Fenêtre au second plan',
  fullscreen_exit: 'Plein écran quitté',
  copy_attempt: 'Tentative de copie', paste_attempt: 'Tentative de collage',
  right_click: 'Clic droit bloqué', keyboard_shortcut: 'Raccourci bloqué',
  devtools_attempt: 'Outils développeur', devtools: 'Outils développeur',
  no_face: 'Visage absent', no_face_detected: 'Visage non détecté', face_absent: 'Visage absent',
  face_mismatch: 'Visage différent', multiple_faces: 'Plusieurs visages',
  face_reference_captured: 'Photo de référence capturée', suspicious_audio: 'Audio suspect',
  unban: 'Débannissement', auto_submitted: 'Soumission automatique', auto_submit: 'Soumission automatique',
  submit: 'Soumission', proctor_note: 'Note surveillant', extra_time: 'Temps supplémentaire',
  student_message: "Message de l'étudiant", teacher_message: "Message de l'enseignant",
  teacher_warning: 'Avertissement envoyé', warning_issued: 'Avertissement envoyé',
  teacher_private_call: 'Appel privé lancé', teacher_end_call: 'Appel privé terminé',
  teacher_ban: "Exclusion par l'enseignant", proctor_ban: 'Exclusion par le surveillant', ban: 'Exclusion',
  unknown: 'Événement non catégorisé',
}

function renderAnswers(rawAnswers?: string): React.ReactNode {
  if (!rawAnswers) return <em style={{ color: '#94a3b8', fontSize: 13 }}>Aucune réponse enregistrée</em>
  let data: any = {}
  try { data = JSON.parse(rawAnswers) } catch {
    return <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7, color: 'var(--text)', maxHeight: 280, overflowY: 'auto' }}>{rawAnswers}</pre>
  }
  const qcm   = (data && typeof data === 'object') ? (data.qcm   || {}) : {}
  const texte = (data && typeof data === 'object') ? (data.texte || data.text || {}) : {}
  const hasQCM  = Object.keys(qcm).length   > 0
  const hasText = Object.keys(texte).length > 0
  if (!hasQCM && !hasText) {
    const plain = typeof data === 'object' ? (data.content || data.reponse || data.answer || data.text || '') : String(data)
    if (!String(plain).trim()) return <em style={{ color: '#94a3b8', fontSize: 13 }}>Aucune réponse enregistrée</em>
    return <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7, color: 'var(--text)', maxHeight: 280, overflowY: 'auto' }}>{String(plain)}</pre>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
      {hasQCM && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>QCM / Vrai-Faux</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.keys(qcm).sort((a, b) => parseInt(a) - parseInt(b)).map(k => {
              const val = String(qcm[k]); const col = CHOICE_CLR[val] || '#2563eb'
              return (
                <span key={k} style={{ background: col + '18', border: `1.5px solid ${col}44`, color: col, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ color: '#94a3b8', fontSize: 10 }}>Q{k}</span><span>{val}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
      {hasText && Object.keys(texte).sort((a, b) => parseInt(a) - parseInt(b)).map(k => (
        <div key={k}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>Question {k}</div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{String(texte[k])}</div>
        </div>
      ))}
    </div>
  )
}

function ReviewCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 2 }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: '10px 10px 0 0' }}>
        <i className={`fas ${icon}`} style={{ color: '#64748b', fontSize: 13 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{title}</span>
      </div>
      <div style={{ padding: '4px 0 4px 0', background: '#ffffff', borderRadius: '0 0 10px 10px' }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: 180, fontWeight: 700, fontSize: 13, color: '#475569', flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#0f172a', flex: 1 }}>{children}</div>
    </div>
  )
}

function AttemptReviewModal({ attemptId, onClose }: { attemptId: number; onClose: () => void }) {
  const { error }             = useToast()
  const [data, setData]       = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<ReviewData>(`/api/exam_attempts/${attemptId}/review`)
      .then(setData).catch(() => error('Impossible de charger les détails'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString('fr-FR') : '—'

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 780, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, background: '#eff6ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-file-alt" style={{ color: '#2563eb', fontSize: 15 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Détails de la Tentative</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginTop: 1 }}>{data?.student_name ?? '…'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 22 }} />
            </div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Données introuvables</div>
          ) : (
            <>
              {/* Informations */}
              <ReviewCard title="Informations" icon="fa-info-circle">
                <InfoRow label="Étudiant">{data.student_name}</InfoRow>
                <InfoRow label="Examen">{data.exam_title || '—'}</InfoRow>
                <InfoRow label="Démarré le">{fmt(data.started_at)}</InfoRow>
                <InfoRow label="Soumis le">{fmt(data.submitted_at)}</InfoRow>
                <InfoRow label="Statut">
                  <span style={{ background: (STATUS_CLR[data.status] ?? '#64748b') + '22', color: STATUS_CLR[data.status] ?? '#64748b', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>
                    {STATUS_LBL[data.status] ?? data.status}
                  </span>
                </InfoRow>
                <InfoRow label="Changements de fenêtre">{String(data.tab_switches ?? 0)}</InfoRow>
                <InfoRow label="Avertissements">{String(data.warnings_count ?? 0)}</InfoRow>
                {(data.extra_minutes ?? 0) > 0 && <InfoRow label="Temps supplémentaire">+{data.extra_minutes} min</InfoRow>}
                {data.ban_reason && <InfoRow label="Motif d'exclusion"><span style={{ color: '#ef4444' }}>{data.ban_reason}</span></InfoRow>}
              </ReviewCard>

              {/* Réponses */}
              <ReviewCard title="Réponses de l'Étudiant" icon="fa-pen">
                <div style={{ padding: '12px 16px' }}>{renderAnswers(data.raw_answers)}</div>
              </ReviewCard>

              {/* Résultat */}
              {data.score != null && (
                <ReviewCard title="Résultat" icon="fa-star">
                  <InfoRow label="Note">
                    <span style={{ fontSize: 22, fontWeight: 800, color: (data.score ?? 0) >= 10 ? '#10b981' : '#ef4444' }}>{data.score}/20</span>
                  </InfoRow>
                  <InfoRow label="Corrigé par">{data.corrector_name || 'Système'}</InfoRow>
                  <InfoRow label="Corrigé le">{fmt(data.corrected_at)}</InfoRow>
                </ReviewCard>
              )}

              {/* Feedback */}
              {data.feedback && (
                <ReviewCard title="Feedback" icon="fa-comment">
                  <div style={{ margin: '0 0 4px', padding: '12px 16px', maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: '#1e293b', background: '#f8fafc', borderRadius: '0 0 10px 10px' }}>
                    {data.feedback}
                  </div>
                </ReviewCard>
              )}

              {/* Notes de surveillance */}
              {(data.proctor_notes ?? []).length > 0 && (
                <ReviewCard title={`Notes de surveillance (${(data.proctor_notes ?? []).length})`} icon="fa-sticky-note">
                  <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(data.proctor_notes ?? []).map((n, i) => (
                      <div key={i} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, marginBottom: 3 }}>
                          {fmt(n.timestamp)}{n.author ? ` — ${n.author}` : ''}
                        </div>
                        <div style={{ fontSize: 13, color: '#1e293b' }}>{n.note}</div>
                      </div>
                    ))}
                  </div>
                </ReviewCard>
              )}

              {/* Incidents */}
              {(data.incidents ?? []).length > 0 && (
                <ReviewCard title={`Incidents (${(data.incidents ?? []).length})`} icon="fa-triangle-exclamation">
                  <div style={{ overflowX: 'auto', padding: '0 0 4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Horodatage</th>
                          <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.incidents ?? []).map((inc, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 16px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{fmt(inc.timestamp)}</td>
                            <td style={{ padding: '8px 16px', fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>{INCIDENT_FR[inc.type] ?? inc.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ReviewCard>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
            <i className="fas fa-times" />Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Helpers ───────────────────────────────────────────────────── */
function ToolBtn({ icon, label, bg, color, onClick }: { icon: string; label: string; bg: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: bg, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color, cursor: 'pointer' }}>
      <i className={`fas ${icon}`} />{label}
    </button>
  )
}

/* ── Section helper ────────────────────────────────────────────── */
function Section({ title, color, dot, subtitle, children }: { title: string; color: string; dot?: boolean; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        {dot && <span style={{ display: 'inline-block', width: 8, height: 8, background: color, borderRadius: '50%' }} />}
        {!dot && <i className="fas fa-check-circle" />}
        {title}
        {subtitle && <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11, textTransform: 'none', marginLeft: 6 }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}
