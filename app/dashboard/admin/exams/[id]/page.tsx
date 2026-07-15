'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam, ExamAttempt, ExamStatus } from '@/types'

function SBadge({ s }: { s: string }) {
  const m: Record<string, [string, string]> = {
    draft:          ['Brouillon',   '#64748b'],
    scheduled:      ['Planifié',    '#3b82f6'],
    active:         ['Actif',       '#10b981'],
    closed:         ['Clôturé',     '#ef4444'],
    in_progress:    ['En cours',    '#3b82f6'],
    submitted:      ['Soumis',      '#10b981'],
    auto_submitted: ['Auto-soumis', '#3b82f6'],
    banned:         ['Exclu',       '#ef4444'],
    not_started:    ['Pas commencé','#94a3b8'],
  }
  const [l, c] = m[s] ?? [s, '#94a3b8']
  return <span style={{ background: c + '20', color: c, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, border: `1px solid ${c}40` }}>{l}</span>
}

interface AttemptEx extends ExamAttempt {
  student_name?: string; student_email?: string; has_incidents?: boolean; needs_correction?: boolean; feedback?: string; extra_minutes?: number;
}

export default function AdminExamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { success, error } = useToast()

  const [exam, setExam]       = useState<OnlineExam | null>(null)
  const [attempts, setAttempts] = useState<AttemptEx[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)

  /* Modals */
  const [gradeModal, setGradeModal]     = useState<AttemptEx | null>(null)
  const [gradeForm, setGradeForm]       = useState({ score: '', feedback: '' })
  const [grading, setGrading]           = useState(false)
  const [extraModal, setExtraModal]     = useState<AttemptEx | null>(null)
  const [extraMin, setExtraMin]         = useState(10)
  const [addingExtra, setAddingExtra]   = useState(false)
  const [banModal, setBanModal]         = useState<AttemptEx | null>(null)
  const [banReason, setBanReason]       = useState('')
  const [banning, setBanning]           = useState(false)
  const [correctingId, setCorrectingId] = useState<number | null>(null)
  const [downloading, setDownloading]   = useState(false)
  const [downloadingSecurity, setDownloadingSecurity] = useState(false)
  const [importingGrades, setImportingGrades] = useState(false)
  const gradesFileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    try {
      const [examData, attData] = await Promise.all([
        api.get<OnlineExam>(`/api/online_exams/${id}/details`),
        api.get<any>(`/api/online_exams/${id}/attempts`).catch(() => []),
      ])
      setExam(examData as OnlineExam)
      setAttempts(Array.isArray(attData) ? attData : attData.attempts ?? [])
    } catch { error('Examen introuvable') }
    finally { setLoading(false) }
  }

  async function activate() {
    setActing(true)
    try { await api.post(`/api/online_exams/${id}/activate`); success('Activé'); setExam(e => e && { ...e, status: 'active' as ExamStatus }) }
    catch (e: any) { error(e.message) } finally { setActing(false) }
  }
  async function close() {
    if (!confirm('Clôturer cet examen ?')) return
    setActing(true)
    try { await api.post(`/api/online_exams/${id}/close`); success('Clôturé'); setExam(e => e && { ...e, status: 'closed' as ExamStatus }) }
    catch (e: any) { error(e.message) } finally { setActing(false) }
  }
  async function del() {
    if (!confirm('Supprimer définitivement ?')) return
    setActing(true)
    try { await api.delete(`/api/online_exams/${id}`); success('Supprimé'); router.push('/dashboard/admin/exams') }
    catch (e: any) { error(e.message); setActing(false) }
  }

  async function unban(a: AttemptEx) {
    if (!confirm(`Réintégrer ${a.student_name} ?`)) return
    try {
      await api.post(`/api/exam_attempts/${a.id}/unban`)
      success('Étudiant réintégré')
      setAttempts(prev => prev.map(x => x.id === a.id ? { ...x, status: 'in_progress', banned: false } : x))
    } catch (e: any) { error(e.message) }
  }

  async function submitBan() {
    if (!banModal) return
    setBanning(true)
    try {
      await api.post(`/api/exam_attempts/${banModal.id}/proctor_ban`, { reason: banReason })
      success('Étudiant exclu')
      setAttempts(prev => prev.map(x => x.id === banModal.id ? { ...x, status: 'banned', banned: true } : x))
      setBanModal(null); setBanReason('')
    } catch (e: any) { error(e.message) } finally { setBanning(false) }
  }

  async function submitExtraTime() {
    if (!extraModal) return
    setAddingExtra(true)
    try {
      await api.put(`/api/exam_attempts/${extraModal.id}/extra-time`, { minutes: extraMin })
      success(`+${extraMin} min accordées`)
      setAttempts(prev => prev.map(x => x.id === extraModal.id ? { ...x, extra_minutes: (x.extra_minutes ?? 0) + extraMin } : x))
      setExtraModal(null)
    } catch (e: any) { error(e.message) } finally { setAddingExtra(false) }
  }

  async function submitGrade() {
    if (!gradeModal) return
    const s = parseFloat(gradeForm.score)
    if (isNaN(s) || s < 0 || s > 20) { error('Note invalide (0–20)'); return }
    setGrading(true)
    try {
      await api.put(`/api/exam_attempts/${gradeModal.id}/manual-grade`, { score: s, feedback: gradeForm.feedback })
      success('Note enregistrée')
      setAttempts(prev => prev.map(x => x.id === gradeModal.id ? { ...x, score: s, feedback: gradeForm.feedback, needs_correction: false } : x))
      setGradeModal(null)
    } catch (e: any) { error(e.message) } finally { setGrading(false) }
  }

  async function autoCorrect(attemptId: number) {
    setCorrectingId(attemptId)
    try { await api.post(`/api/exam_attempts/${attemptId}/correct`); success('Correction IA lancée'); load() }
    catch (e: any) { error(e.message) } finally { setCorrectingId(null) }
  }

  async function downloadCsv() {
    setDownloading(true)
    try {
      const blob = await api.blob(`/api/online_exams/${id}/export-csv`)
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: `examen_${id}.csv` }).click()
      URL.revokeObjectURL(url)
    } catch (e: any) { error(e.message) } finally { setDownloading(false) }
  }

  async function downloadPdf() {
    try {
      const blob = await api.blob(`/api/online_exams/${id}/bilan/pdf`)
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: `bilan_examen_${id}.pdf` }).click()
      URL.revokeObjectURL(url)
    } catch (e: any) { error('PDF non disponible') }
  }

  async function downloadSecurityReport() {
    setDownloadingSecurity(true)
    try {
      const blob = await api.blob(`/api/online_exams/${id}/security-report/pdf`)
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: `examen_${id}_rapport_securite.pdf` }).click()
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

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} /></div>
  if (!exam) return (
    <div className="card" style={{ textAlign: 'center', padding: 60 }}>
      <i className="fas fa-exclamation-triangle" style={{ fontSize: 32 }} />
      <p style={{ marginTop: 16 }}>Examen introuvable</p>
      <Link href="/dashboard/admin/exams" className="btn btn-secondary" style={{ marginTop: 16 }}>Retour</Link>
    </div>
  )

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('fr-FR') : '—'
  const corrected   = attempts.filter(a => a.score != null).length
  const toCorrect   = attempts.filter(a => a.needs_correction && a.score == null).length
  const banned      = attempts.filter(a => a.status === 'banned').length
  const avgScore    = corrected > 0 ? (attempts.filter(a => a.score != null).reduce((s, a) => s + (a.score ?? 0), 0) / corrected).toFixed(1) : null

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-file-alt" style={{ color: 'var(--primary)' }} />
            {exam.title} <SBadge s={exam.status} />
          </h2>
          <p>{exam.formation_name ?? 'Examen en ligne'} · {exam.duration_minutes} min · {attempts.length} tentative(s)</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {exam.status === 'active' && <Link href={`/proctor/${id}`} className="btn btn-info"><i className="fas fa-eye" /> Surveiller</Link>}
          {(exam.status === 'draft' || exam.status === 'scheduled') && <button className="btn btn-success" onClick={activate} disabled={acting}><i className="fas fa-play" /> Activer</button>}
          {exam.status === 'active' && <button className="btn btn-warning" onClick={close} disabled={acting}><i className="fas fa-stop" /> Clôturer</button>}
          <button className="btn btn-secondary" onClick={downloadCsv} disabled={downloading}><i className="fas fa-file-csv" /> CSV</button>
          <button className="btn btn-secondary" onClick={downloadPdf}><i className="fas fa-file-pdf" /> PDF Bilan</button>
          <button className="btn btn-secondary" onClick={downloadSecurityReport} disabled={downloadingSecurity}
            title="Rapport de sécurité agrégé (risques, incidents) pour cet examen">
            <i className={`fas ${downloadingSecurity ? 'fa-spinner fa-spin' : 'fa-shield-halved'}`} /> Rapport sécurité
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
            <i className={`fas ${importingGrades ? 'fa-spinner fa-spin' : 'fa-file-import'}`} /> {importingGrades ? 'Import...' : 'Importer notes'}
          </button>
          <button className="btn btn-danger" onClick={del} disabled={acting}><i className="fas fa-trash" /> Supprimer</button>
          <Link href="/dashboard/admin/exams" className="btn btn-secondary"><i className="fas fa-arrow-left" /> Retour</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { icon: 'fa-users',     label: 'Participants', val: attempts.length,                       color: '#3b82f6' },
          { icon: 'fa-check',     label: 'Corrigées',    val: corrected,                             color: '#10b981' },
          { icon: 'fa-pen',       label: 'À corriger',   val: toCorrect,                             color: toCorrect > 0 ? '#f59e0b' : '#10b981' },
          { icon: 'fa-ban',       label: 'Exclus',       val: banned,                                color: banned > 0 ? '#ef4444' : '#10b981' },
          { icon: 'fa-chart-bar', label: 'Moyenne',      val: avgScore ? `${avgScore}/20` : '—',     color: '#3b82f6' },
        ].map(({ icon, label, val, color }) => (
          <div key={label} className="stat-card" style={{ borderColor: color }}>
            <div className="stat-label"><i className={`fas ${icon}`} style={{ color }} /> {label}</div>
            <div className="stat-value" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Infos + Sécurité */}
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <h3 className="card-title"><i className="fas fa-clock" /> Horaires</h3>
          {[
            ['Début', fmt(exam.start_time)],
            ['Fin',   fmt(exam.end_time)],
            ['Durée', `${exam.duration_minutes} min`],
            ['Correction IA', exam.auto_correct ? 'Activée' : 'Désactivée'],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
              <span style={{ color: 'var(--text-muted)' }}>{l}</span><strong>{v}</strong>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="card-title"><i className="fas fa-shield-alt" /> Sécurité</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              [`Onglets max : ${exam.max_tab_switches ?? 2}`, true],
              [`Alertes caméra max : ${exam.max_no_face_count ?? 10}`, true],
              ['Copier/coller', !!exam.enable_copy_paste],
              ['Clic droit', !!exam.enable_right_click],
              ['Questions mélangées', !!exam.randomize_questions],
              ['Ban sur DevTools', !!exam.ban_on_devtools],
            ].map(([label, ok]) => (
              <span key={String(label)} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, background: ok ? '#dcfce7' : '#f1f5f9', color: ok ? '#166534' : '#64748b' }}>
                <i className={`fas ${ok ? 'fa-check' : 'fa-times'}`} style={{ marginRight: 4 }} />{String(label)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tableau tentatives */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="card-title" style={{ marginBottom: 0 }}><i className="fas fa-users" /> Tentatives ({attempts.length})</h3>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Étudiant</th><th>Statut</th><th>Début</th><th>Soumission</th><th>Score</th><th>Risque</th><th>Onglets</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {attempts.length === 0
                ? <tr><td colSpan={8} className="empty-message">Aucune tentative</td></tr>
                : attempts.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{a.student_name ?? `Étudiant #${a.student_id}`}</div>
                      {a.student_email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.student_email}</div>}
                      {(a.extra_minutes ?? 0) > 0 && <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>+{a.extra_minutes}min</span>}
                    </td>
                    <td><SBadge s={a.status} /></td>
                    <td style={{ fontSize: 12 }}>{fmt(a.started_at)}</td>
                    <td style={{ fontSize: 12 }}>{a.submitted_at ? fmt(a.submitted_at) : '—'}</td>
                    <td>
                      {a.score != null
                        ? <strong style={{ color: a.score >= 10 ? '#10b981' : '#ef4444' }}>{a.score}/20</strong>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td>
                      {a.risk_score != null
                        ? <span style={{ fontWeight: 700, fontSize: 12, color: a.risk_score >= 70 ? '#ef4444' : a.risk_score >= 40 ? '#f59e0b' : '#10b981' }}>{a.risk_score}%</span>
                        : '—'}
                    </td>
                    <td>{a.tab_switches ?? 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {/* Note manuelle */}
                        {(a.status === 'submitted' || a.status === 'auto_submitted') && (
                          <button onClick={() => { setGradeModal(a); setGradeForm({ score: a.score != null ? String(a.score) : '', feedback: a.feedback ?? '' }) }}
                            style={{ fontSize: 11, padding: '3px 8px', background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640', borderRadius: 6, cursor: 'pointer' }}>
                            <i className="fas fa-pen" /> Note
                          </button>
                        )}
                        {/* Correction IA */}
                        {a.needs_correction && a.score == null && (
                          <button onClick={() => autoCorrect(a.id)} disabled={correctingId === a.id}
                            style={{ fontSize: 11, padding: '3px 8px', background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640', borderRadius: 6, cursor: 'pointer' }}>
                            <i className={`fas ${correctingId === a.id ? 'fa-spinner fa-spin' : 'fa-robot'}`} /> IA
                          </button>
                        )}
                        {/* Temps extra */}
                        {a.status === 'in_progress' && (
                          <button onClick={() => { setExtraModal(a); setExtraMin(10) }}
                            style={{ fontSize: 11, padding: '3px 8px', background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', borderRadius: 6, cursor: 'pointer' }}>
                            <i className="fas fa-clock" /> +Temps
                          </button>
                        )}
                        {/* Exclure */}
                        {a.status === 'in_progress' && (
                          <button onClick={() => { setBanModal(a); setBanReason('') }}
                            style={{ fontSize: 11, padding: '3px 8px', background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: 6, cursor: 'pointer' }}>
                            <i className="fas fa-ban" /> Exclure
                          </button>
                        )}
                        {/* Réintégrer */}
                        {a.status === 'banned' && (
                          <button onClick={() => unban(a)}
                            style={{ fontSize: 11, padding: '3px 8px', background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', borderRadius: 6, cursor: 'pointer' }}>
                            <i className="fas fa-undo" /> Réintégrer
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

      {/* Modal Note manuelle */}
      {gradeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: 420, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 20 }}><i className="fas fa-pen" /> Note manuelle — {gradeModal.student_name}</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Note (0–20)</label>
              <input type="number" min={0} max={20} step={0.5} value={gradeForm.score}
                onChange={e => setGradeForm(f => ({ ...f, score: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Commentaire (optionnel)</label>
              <textarea value={gradeForm.feedback} onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setGradeModal(null)} className="btn btn-secondary">Annuler</button>
              <button onClick={submitGrade} disabled={grading} className="btn btn-primary">
                <i className={`fas ${grading ? 'fa-spinner fa-spin' : 'fa-save'}`} /> {grading ? 'Enregistrement…' : 'Enregistrer'}
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
              <input type="range" min={5} max={60} step={5} value={extraMin} onChange={e => setExtraMin(+e.target.value)}
                style={{ width: '100%' }} />
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
                <i className={`fas ${banning ? 'fa-spinner fa-spin' : 'fa-ban'}`} /> {banning ? 'Exclusion…' : 'Confirmer l\'exclusion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
