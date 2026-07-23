'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam, ExamAttempt, ExamStatus } from '@/types'
import SecurityReportPanel from '@/components/shared/SecurityReportPanel'
import StatTile from '@/components/ui/StatTile'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:          { label: 'Brouillon',   cls: 'secondary' },
    scheduled:      { label: 'Planifié',    cls: 'info' },
    active:         { label: 'Actif',       cls: 'success' },
    closed:         { label: 'Clôturé',     cls: 'danger' },
    in_progress:    { label: 'En cours',    cls: 'info' },
    submitted:      { label: 'Soumis',      cls: 'success' },
    auto_submitted: { label: 'Auto-soumis', cls: 'warning' },
    banned:         { label: 'Banni',       cls: 'danger' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'secondary' }
  return <span className={`status-badge ${cls}`}>{label}</span>
}

interface AttemptWithMeta extends ExamAttempt {
  needs_correction?: boolean
  has_incidents?: boolean
  student_name?: string
  student_email?: string
}

export default function ProfessorExamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { success, error } = useToast()
  const [exam, setExam] = useState<OnlineExam | null>(null)
  const [attempts, setAttempts] = useState<AttemptWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)

  const [gradeModal, setGradeModal] = useState<AttemptWithMeta | null>(null)
  const [gradeForm, setGradeForm] = useState({ score: '', feedback: '' })
  const [grading, setGrading] = useState(false)
  const [correcting, setCorrecting] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadingSecurity, setDownloadingSecurity] = useState(false)
  const [importingGrades, setImportingGrades] = useState(false)
  const gradesFileRef = useRef<HTMLInputElement | null>(null)
  const [rescheduleModal, setRescheduleModal] = useState(false)
  const [rescheduleForm, setRescheduleForm] = useState({ start_time: '', end_time: '', duration_minutes: 60 })
  const [rescheduling, setRescheduling] = useState(false)
  const [extraModal, setExtraModal]   = useState<AttemptWithMeta | null>(null)
  const [extraMin, setExtraMin]       = useState(10)
  const [addingExtra, setAddingExtra] = useState(false)
  const [banModal, setBanModal]       = useState<AttemptWithMeta | null>(null)
  const [banReason, setBanReason]     = useState('')
  const [banning, setBanning]         = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    try {
      const [examData, attemptsData] = await Promise.all([
        api.get<OnlineExam>(`/api/online_exams/${id}/details`),
        api.get<AttemptWithMeta[]>(`/api/online_exams/${id}/attempts`).catch(() => []),
      ])
      setExam(examData)
      setAttempts(Array.isArray(attemptsData) ? attemptsData : (attemptsData as any).attempts ?? [])
    } catch {
      error('Examen introuvable ou accès refusé')
    } finally {
      setLoading(false)
    }
  }

  async function handleActivate() {
    setActioning(true)
    try {
      await api.post(`/api/online_exams/${id}/activate`)
      success('Examen activé')
      setExam(e => e ? { ...e, status: 'active' as ExamStatus } : e)
    } catch (e: any) { error(e.message) } finally { setActioning(false) }
  }

  async function handleClose() {
    if (!confirm('Clôturer cet examen ?')) return
    setActioning(true)
    try {
      await api.post(`/api/online_exams/${id}/close`)
      success('Examen clôturé')
      setExam(e => e ? { ...e, status: 'closed' as ExamStatus } : e)
    } catch (e: any) { error(e.message) } finally { setActioning(false) }
  }

  // Retour #29 — publication des notes aux étudiants (après délibération) ;
  // le prof/admin voit toujours les notes, seul l'étudiant est concerné
  async function togglePublish() {
    if (!exam) return
    const next = !exam.results_published
    try {
      await api.put(`/api/online_exams/${id}/publish-results`, { published: next })
      success(next ? 'Notes publiées aux étudiants' : 'Publication des notes retirée')
      setExam(e => e ? { ...e, results_published: next } : e)
    } catch (e: any) { error(e.message) }
  }

  // Retour #6 — reprogrammation d'un examen déjà planifié, sans repasser par
  // toutes les étapes de création. Début/fin/durée restent synchronisés entre
  // eux quel que soit le champ modifié par l'utilisateur.
  function parseLocalInput(v: string) { return new Date(v + ':00Z') }
  function toLocalInput(d: Date) { return d.toISOString().slice(0, 16) }

  function openRescheduleModal() {
    if (!exam) return
    const start = exam.start_time ? new Date(exam.start_time) : new Date()
    const end = exam.end_time ? new Date(exam.end_time) : new Date(start.getTime() + exam.duration_minutes * 60000)
    setRescheduleForm({
      start_time: toLocalInput(start),
      end_time: toLocalInput(end),
      duration_minutes: exam.duration_minutes,
    })
    setRescheduleModal(true)
  }
  function onRescheduleStartChange(v: string) {
    const newStart = parseLocalInput(v)
    const newEnd = new Date(newStart.getTime() + rescheduleForm.duration_minutes * 60000)
    setRescheduleForm(f => ({ ...f, start_time: v, end_time: toLocalInput(newEnd) }))
  }
  function onRescheduleDurationChange(min: number) {
    const start = parseLocalInput(rescheduleForm.start_time)
    const newEnd = new Date(start.getTime() + min * 60000)
    setRescheduleForm(f => ({ ...f, duration_minutes: min, end_time: toLocalInput(newEnd) }))
  }
  function onRescheduleEndChange(v: string) {
    const start = parseLocalInput(rescheduleForm.start_time)
    const end = parseLocalInput(v)
    const diffMin = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000))
    setRescheduleForm(f => ({ ...f, end_time: v, duration_minutes: diffMin }))
  }
  async function handleReschedule() {
    setRescheduling(true)
    try {
      const res = await api.put<{ success: boolean; exam: OnlineExam }>(`/api/admin/online_exams/${id}`, {
        start_time: rescheduleForm.start_time,
        end_time: rescheduleForm.end_time,
        duration_minutes: rescheduleForm.duration_minutes,
      })
      success('Examen reprogrammé')
      setExam(e => e && res.exam ? { ...e, ...res.exam } : e)
      setRescheduleModal(false)
    } catch (e: any) { error(e.message) } finally { setRescheduling(false) }
  }

  async function openGradeModal(a: AttemptWithMeta) {
    setGradeModal(a)
    setGradeForm({ score: a.score != null ? String(a.score) : '', feedback: a.feedback ?? '' })
  }

  async function submitGrade() {
    if (!gradeModal) return
    const s = parseFloat(gradeForm.score)
    if (isNaN(s) || s < 0 || s > 20) { error('Note invalide (0–20)'); return }
    setGrading(true)
    try {
      await api.put(`/api/exam_attempts/${gradeModal.id}/manual-grade`, {
        score: s,
        feedback: gradeForm.feedback,
      })
      success('Note enregistrée')
      setAttempts(prev => prev.map(a => a.id === gradeModal.id
        ? { ...a, score: s, feedback: gradeForm.feedback, needs_correction: false }
        : a))
      setGradeModal(null)
    } catch (e: any) { error(e.message || 'Erreur') } finally { setGrading(false) }
  }

  async function autoCorrect(attemptId: number) {
    setCorrecting(attemptId)
    try {
      await api.post(`/api/exam_attempts/${attemptId}/correct`)
      success('Correction IA lancée')
      load()
    } catch (e: any) { error(e.message || 'Erreur') } finally { setCorrecting(null) }
  }

  async function unban(a: AttemptWithMeta) {
    if (!confirm(`Réintégrer ${a.student_name} ?`)) return
    try {
      await api.post(`/api/exam_attempts/${a.id}/unban`)
      success('Étudiant réintégré')
      setAttempts(prev => prev.map(x => x.id === a.id ? { ...x, status: 'in_progress' } : x))
    } catch (e: any) { error(e.message) }
  }

  async function submitBan() {
    if (!banModal) return
    setBanning(true)
    try {
      await api.post(`/api/exam_attempts/${banModal.id}/proctor_ban`, { reason: banReason })
      success('Étudiant exclu')
      setAttempts(prev => prev.map(x => x.id === banModal.id ? { ...x, status: 'banned' } : x))
      setBanModal(null); setBanReason('')
    } catch (e: any) { error(e.message) } finally { setBanning(false) }
  }

  async function submitExtraTime() {
    if (!extraModal) return
    setAddingExtra(true)
    try {
      await api.put(`/api/exam_attempts/${extraModal.id}/extra-time`, { minutes: extraMin })
      success(`+${extraMin} min accordées`)
      setExtraModal(null)
    } catch (e: any) { error(e.message) } finally { setAddingExtra(false) }
  }

  async function downloadCsv() {
    setDownloading(true)
    try {
      const blob = await api.blob(`/api/online_exams/${id}/export-csv`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `examen_${id}_notes.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { error(e.message || 'Erreur export') } finally { setDownloading(false) }
  }

  async function downloadSecurityReport() {
    setDownloadingSecurity(true)
    try {
      const blob = await api.blob(`/api/online_exams/${id}/security-report/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `examen_${id}_rapport_securite.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { error(e.message || 'Erreur rapport sécurité') } finally { setDownloadingSecurity(false) }
  }

  async function handleImportGrades(file: File) {
    setImportingGrades(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.upload<{ created: number; updated: number; errors: string[] }>(
        `/api/online_exams/${id}/import-grades`, fd
      )
      success(`Import terminé : ${res.created} note(s) créée(s), ${res.updated} mise(s) à jour${res.errors.length ? `, ${res.errors.length} erreur(s)` : ''}`)
      if (res.errors.length) console.warn('Erreurs import notes:', res.errors)
      await load()
    } catch (e: any) { error(e.message || 'Erreur import') } finally {
      setImportingGrades(false)
      if (gradesFileRef.current) gradesFileRef.current.value = ''
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <i className="fa-solid fa-spinner spin" style={{ fontSize: 32, color: 'var(--primary)' }} />
    </div>
  )

  if (!exam) return (
    <div className="card" style={{ textAlign: 'center', padding: 60 }}>
      <i className="fa-solid fa-exclamation-triangle" style={{ fontSize: 32, color: 'var(--warning)' }} />
      <p style={{ marginTop: 16 }}>Examen introuvable ou accès refusé</p>
      <Link href="/dashboard/professor/exams" className="btn btn-secondary" style={{ marginTop: 16 }}>Retour</Link>
    </div>
  )

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('fr-FR') : '—'
  const toCorrect = attempts.filter(a => a.needs_correction).length
  const corrected = attempts.filter(a => a.score != null).length
  const avgScore = corrected > 0
    ? (attempts.filter(a => a.score != null).reduce((s, a) => s + (a.score ?? 0), 0) / corrected).toFixed(1)
    : null

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fa-solid fa-file-alt" style={{ color: 'var(--primary)' }} />
            {exam.title}
            <StatusBadge status={exam.status} />
          </h2>
          <p>{exam.formation_name ?? 'Examen en ligne'} · {exam.duration_minutes} min</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {exam.status === 'active' && (
            <Link href={`/proctor/${exam.id}`} className="btn btn-info">
              <i className="fa-solid fa-eye" /> Surveiller
            </Link>
          )}
          {(exam.status === 'draft' || exam.status === 'scheduled') && (
            <button className="btn btn-success" onClick={handleActivate} disabled={actioning}>
              <i className="fa-solid fa-play" /> Activer
            </button>
          )}
          {(exam.status === 'draft' || exam.status === 'scheduled') && (
            <button className="btn btn-secondary" onClick={openRescheduleModal} title="Reprogrammer sans recréer l'examen">
              <i className="fa-solid fa-calendar-days" /> Reprogrammer
            </button>
          )}
          {exam.status === 'active' && (
            <button className="btn btn-warning" onClick={handleClose} disabled={actioning}>
              <i className="fa-solid fa-stop" /> Clôturer
            </button>
          )}

          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '0 2px' }} />

          <button className="btn btn-secondary" onClick={downloadCsv} disabled={downloading}>
            {downloading
              ? <><i className="fa-solid fa-spinner spin" /> Export...</>
              : <><i className="fa-solid fa-file-csv" /> Export CSV</>}
          </button>
          <button className="btn btn-secondary" onClick={downloadSecurityReport} disabled={downloadingSecurity}
            title="Rapport de sécurité agrégé (risques, incidents) pour cet examen">
            {downloadingSecurity
              ? <><i className="fa-solid fa-spinner spin" /> Rapport...</>
              : <><i className="fa-solid fa-shield-halved" /> Rapport sécurité</>}
          </button>
          <input
            ref={gradesFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportGrades(f) }}
          />
          <button className="btn btn-secondary" onClick={() => gradesFileRef.current?.click()} disabled={importingGrades}
            title="Importer des notes déjà calculées (étudiants n'ayant pas composé sur la plateforme)">
            {importingGrades
              ? <><i className="fa-solid fa-spinner spin" /> Import...</>
              : <><i className="fa-solid fa-file-import" /> Importer notes</>}
          </button>
          <button className={exam.results_published ? 'btn btn-warning' : 'btn btn-success'} onClick={togglePublish}
            title="Publier/masquer les notes aux étudiants (après délibération)">
            {exam.results_published
              ? <><i className="fa-solid fa-eye-slash" /> Dépublier les notes</>
              : <><i className="fa-solid fa-bullhorn" /> Publier les notes</>}
          </button>

          <Link href="/dashboard/professor/exams" className="btn btn-secondary" style={{ marginLeft: 'auto' }}>
            <i className="fa-solid fa-arrow-left" /> Retour
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatTile icon="fa-users" label="Participants" value={attempts.length} color="#3b82f6" />
        <StatTile icon="fa-pen" label="À corriger" value={toCorrect} color={toCorrect > 0 ? '#f59e0b' : '#10b981'} />
        <StatTile icon="fa-check" label="Corrigées" value={corrected} color="#10b981" />
        <StatTile icon="fa-chart-bar" label="Moyenne" value={avgScore ? `${avgScore}/20` : '—'} color="#3b82f6" />
      </div>

      {/* Horaires + sécurité */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}><i className="fa-solid fa-clock" style={{ color: 'var(--primary)', marginRight: 8 }} />Horaires</h3>
          </div>
          <div style={{ padding: '18px 24px' }}>
            <table style={{ width: '100%' }}>
              <tbody>
                {[
                  { label: 'Début', val: fmt(exam.start_time) },
                  { label: 'Fin',   val: fmt(exam.end_time) },
                  { label: 'Durée', val: `${exam.duration_minutes} min` },
                  { label: 'Correction IA', val: exam.auto_correct ? 'Activée' : 'Désactivée' },
                ].map(({ label, val }) => (
                  <tr key={label}>
                    <td style={{ color: 'var(--text-muted)', width: '40%', border: 'none', padding: '7px 0' }}>{label}</td>
                    <td style={{ fontWeight: 600, border: 'none', padding: '7px 0' }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}><i className="fa-solid fa-shield-alt" style={{ color: 'var(--primary)', marginRight: 8 }} />Sécurité</h3>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: `Onglets max : ${exam.max_tab_switches ?? 2}`, ok: true },
                { label: `Alertes caméra max : ${exam.max_no_face_count ?? 10}`, ok: true },
                { label: 'Copier/coller', ok: !!exam.enable_copy_paste },
                { label: 'Clic droit', ok: !!exam.enable_right_click },
                { label: 'Questions mélangées', ok: !!exam.randomize_questions },
                { label: 'Bannir DevTools', ok: !!exam.ban_on_devtools },
              ].map(({ label, ok }) => (
                <span key={label} style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 500, background: ok ? '#dcfce7' : 'var(--background)', color: ok ? '#166534' : 'var(--text-muted)', border: `1px solid ${ok ? '#bbf7d0' : 'var(--border)'}` }}>
                  <i className={`fa-solid ${ok ? 'fa-check' : 'fa-times'}`} style={{ marginRight: 5 }} />{label}
                </span>
              ))}
            </div>
            {exam.instructions && (
              <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--background)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-muted)', borderLeft: '3px solid var(--primary)' }}>
                <strong style={{ color: 'var(--text)' }}>Instructions :</strong> {exam.instructions}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rapport de sécurité — propre à cet examen (mêmes stats/tableaux que
          la page globale "Sécurité", filtrés sur cet examen uniquement) */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}><i className="fa-solid fa-shield-halved" style={{ color: 'var(--danger)', marginRight: 8 }} />Rapport de sécurité de cet examen</h3>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <SecurityReportPanel fixedExamId={Number(id)} hideHeader />
        </div>
      </div>

      {/* Tentatives */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>
            <i className="fa-solid fa-users" style={{ color: 'var(--primary)', marginRight: 8 }} />Tentatives ({attempts.length})
            {toCorrect > 0 && (
              <span style={{ marginLeft: 10, background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                {toCorrect} à corriger
              </span>
            )}
          </h3>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Statut</th>
                <th>Début</th>
                <th>Soumission</th>
                <th>Score</th>
                <th>Risque</th>
                <th>Onglets</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attempts.length === 0 ? (
                <tr><td colSpan={8} className="empty-message">Aucune tentative</td></tr>
              ) : attempts.map(a => (
                <tr key={a.id} style={{ background: a.needs_correction ? '#fffbeb' : undefined }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.student_name ?? `Étudiant #${a.student_id}`}</div>
                    {a.student_email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.student_email}</div>}
                  </td>
                  <td><StatusBadge status={a.status} /></td>
                  <td style={{ fontSize: 13 }}>{fmt(a.started_at)}</td>
                  <td style={{ fontSize: 13 }}>{a.submitted_at ? fmt(a.submitted_at) : '—'}</td>
                  <td>
                    {a.score != null
                      ? <strong style={{ color: a.score >= 10 ? 'var(--success)' : 'var(--danger)' }}>{a.score}/20</strong>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    {a.risk_score != null ? (
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                        background: a.risk_score >= 70 ? '#fee2e2' : a.risk_score >= 40 ? '#fef3c7' : '#dcfce7',
                        color: a.risk_score >= 70 ? '#991b1b' : a.risk_score >= 40 ? '#92400e' : '#166534' }}>
                        {a.risk_score}%
                      </span>
                    ) : '—'}
                  </td>
                  <td>{a.tab_switches ?? 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(a.status === 'submitted' || a.status === 'auto_submitted') && (
                        <>
                          <button onClick={() => openGradeModal(a)} title={a.score != null ? 'Modifier la note' : 'Noter'}
                            style={{ fontSize: 12, padding: '5px 10px', fontWeight: 600, background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640', borderRadius: 6, cursor: 'pointer' }}>
                            <i className="fa-solid fa-pen" /> Note
                          </button>
                          {exam.auto_correct && a.score == null && (
                            <button onClick={() => autoCorrect(a.id)} disabled={correcting === a.id} title="Correction IA"
                              style={{ fontSize: 12, padding: '5px 10px', fontWeight: 600, background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640', borderRadius: 6, cursor: 'pointer' }}>
                              <i className={`fa-solid ${correcting === a.id ? 'fa-spinner fa-spin' : 'fa-robot'}`} /> IA
                            </button>
                          )}
                        </>
                      )}
                      {a.status === 'in_progress' && (
                        <button onClick={() => { setExtraModal(a); setExtraMin(10) }}
                          style={{ fontSize: 12, padding: '5px 10px', fontWeight: 600, background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', borderRadius: 6, cursor: 'pointer' }}>
                          <i className="fa-solid fa-clock" /> +Temps
                        </button>
                      )}
                      {a.status === 'in_progress' && (
                        <button onClick={() => { setBanModal(a); setBanReason('') }}
                          style={{ fontSize: 12, padding: '5px 10px', fontWeight: 600, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: 6, cursor: 'pointer' }}>
                          <i className="fa-solid fa-ban" /> Exclure
                        </button>
                      )}
                      {a.status === 'banned' && (
                        <button onClick={() => unban(a)}
                          style={{ fontSize: 12, padding: '5px 10px', fontWeight: 600, background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', borderRadius: 6, cursor: 'pointer' }}>
                          <i className="fa-solid fa-undo" /> Réintégrer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Reprogrammer */}
      {rescheduleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: 380, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 20 }}><i className="fas fa-calendar-days" /> Reprogrammer l'examen</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nouvelle date/heure de début</label>
              <input type="datetime-local" className="form-control" value={rescheduleForm.start_time}
                onChange={e => onRescheduleStartChange(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nouvelle date/heure de fin</label>
              <input type="datetime-local" className="form-control" value={rescheduleForm.end_time}
                min={rescheduleForm.start_time || undefined}
                onChange={e => onRescheduleEndChange(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Durée (minutes)</label>
              <input type="number" min={5} className="form-control" value={rescheduleForm.duration_minutes}
                onChange={e => onRescheduleDurationChange(Math.max(5, Number(e.target.value) || 5))} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                <i className="fas fa-circle-info" style={{ marginRight: 4 }} />
                Début, fin et durée restent synchronisés — modifiez l'un ou l'autre.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRescheduleModal(false)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleReschedule} disabled={rescheduling || !rescheduleForm.start_time} className="btn btn-success">
                <i className={`fas ${rescheduling ? 'fa-spinner fa-spin' : 'fa-check'}`} /> {rescheduling ? 'Enregistrement…' : 'Reprogrammer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Temps extra */}
      {extraModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: 380, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 20 }}><i className="fas fa-clock" /> Temps supplémentaire — {extraModal.student_name}</h3>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Minutes à ajouter : <strong style={{ color: 'var(--primary)' }}>{extraMin} min</strong></label>
              <input type="range" min={5} max={60} step={5} value={extraMin} onChange={e => setExtraMin(+e.target.value)} style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}><span>5 min</span><span>60 min</span></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setExtraModal(null)} className="btn btn-secondary">Annuler</button>
              <button onClick={submitExtraTime} disabled={addingExtra} className="btn btn-success">
                <i className={`fas ${addingExtra ? 'fa-spinner fa-spin' : 'fa-plus'}`} /> {addingExtra ? 'Ajout…' : `+${extraMin} min`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Exclure */}
      {banModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: 420, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 20, color: '#ef4444' }}><i className="fas fa-ban" /> Exclure {banModal.student_name}</h3>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Motif d'exclusion</label>
              <textarea value={banReason} onChange={e => setBanReason(e.target.value)} rows={3} placeholder="Fraude, comportement suspect…"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ef4444', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setBanModal(null)} className="btn btn-secondary">Annuler</button>
              <button onClick={submitBan} disabled={banning || !banReason.trim()} className="btn btn-danger">
                <i className={`fas ${banning ? 'fa-spinner fa-spin' : 'fa-ban'}`} /> {banning ? 'Exclusion…' : "Confirmer l'exclusion"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal notation manuelle */}
      {gradeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginBottom: 16 }}>
              <i className="fa-solid fa-pen" style={{ color: 'var(--primary)', marginRight: 8 }} />
              Notation — {gradeModal.student_name ?? `Étudiant #${gradeModal.student_id}`}
            </h3>

            <div className="form-group">
              <label>Note /20 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="number"
                min={0}
                max={20}
                step={0.25}
                value={gradeForm.score}
                onChange={e => setGradeForm(f => ({ ...f, score: e.target.value }))}
                placeholder="Ex: 14.5"
                autoFocus
                style={{ fontSize: 18, fontWeight: 700 }}
              />
            </div>

            <div className="form-group">
              <label>Commentaire / Feedback</label>
              <textarea
                rows={4}
                value={gradeForm.feedback}
                onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))}
                placeholder="Commentaires sur la copie..."
                style={{ width: '100%', padding: '10px 14px', border: '2px solid var(--border)', borderRadius: 'var(--radius)', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setGradeModal(null)} disabled={grading}>Annuler</button>
              <button className="btn btn-primary" onClick={submitGrade} disabled={grading}>
                {grading ? <><i className="fa-solid fa-spinner spin" /> Enregistrement...</> : <><i className="fa-solid fa-check" /> Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
