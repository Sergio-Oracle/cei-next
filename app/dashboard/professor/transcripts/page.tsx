'use client'

import { useEffect, useState, useRef } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface Transcript {
  id:               number
  student_name:     string
  student_email:    string
  formation_name:   string
  semester_name:    string
  semester_id:      number
  gpa:              number | null
  obtained_credits: number
  total_credits:    number
  validated:        boolean
  is_published:     boolean
  generated_at:     string
  generated_by?:    string
  generated_by_id?: number
}

interface Student { id: number; full_name: string }
interface Semester { id: number; name: string; formation_name: string }
interface Formation { id: number; name: string }

function gpaColor(v: number | null) { return v == null ? '#64748b' : v >= 10 ? '#10b981' : '#ef4444' }

/* Télécharge un blob depuis l'API authentifiée et déclenche le download navigateur */
async function downloadBlob(path: string, filename: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://62.171.190.6:8100') + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  URL.revokeObjectURL(url); document.body.removeChild(a)
}

export default function ProfessorTranscriptsPage() {
  const { success, error: toastErr } = useToast()

  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [students,    setStudents]    = useState<Student[]>([])
  const [semesters,   setSemesters]   = useState<Semester[]>([])
  const [semLoading,  setSemLoading]  = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [downloading, setDownloading] = useState<number | 'bulk' | null>(null)
  const [search,      setSearch]      = useState('')
  const [formError,   setFormError]   = useState<string | null>(null)
  const [successModal,setSuccessModal]= useState<{ name: string; semName: string; transcriptId: number } | null>(null)

  const studentRef  = useRef<HTMLSelectElement>(null)
  const semesterRef = useRef<HTMLSelectElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [tRes, sRes] = await Promise.all([
        api.get<any>('/api/transcripts'),
        api.get<any>('/api/students/list'),
      ])
      setTranscripts(Array.isArray(tRes) ? tRes : tRes.transcripts ?? [])
      setStudents(Array.isArray(sRes) ? sRes : sRes.students ?? [])
    } catch { toastErr('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function loadSemesters(studentId: string) {
    if (!studentId) return
    setSemLoading(true)
    setSemesters([])
    if (semesterRef.current) { semesterRef.current.disabled = true; semesterRef.current.value = '' }
    try {
      const fRes = await api.get<any>('/api/formations')
      const formations: Formation[] = Array.isArray(fRes) ? fRes : fRes.formations ?? []
      const all: Semester[] = []
      for (const f of formations) {
        try {
          const sr = await api.get<any>(`/api/formations/${f.id}/semesters`)
          const sems = Array.isArray(sr) ? sr : sr.semesters ?? []
          sems.forEach((s: any) => all.push({ id: s.id, name: s.name, formation_name: f.name }))
        } catch {}
      }
      setSemesters(all)
      if (semesterRef.current) semesterRef.current.disabled = false
    } catch { toastErr('Impossible de charger les semestres') }
    finally { setSemLoading(false) }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const studentId  = studentRef.current?.value  || ''
    const semesterId = semesterRef.current?.value || ''
    const studentName  = studentRef.current?.selectedOptions[0]?.text  || 'l\'étudiant'
    const semesterName = semesterRef.current?.selectedOptions[0]?.text || 'ce semestre'
    if (!studentId || !semesterId) return

    setGenerating(true)
    try {
      const res = await api.post<any>(`/api/transcripts/generate/${studentId}/${semesterId}`, {})
      if (res.success || res.transcript) {
        const tid = res.transcript?.id
        /* Téléchargement PDF automatique */
        if (tid) {
          try {
            await downloadBlob(`/api/transcripts/${tid}/pdf`, `releve_notes_${studentName}.pdf`)
          } catch { /* PDF raté mais relevé créé */ }
          setSuccessModal({ name: studentName, semName: semesterName, transcriptId: tid })
        } else {
          success(res.message || 'Relevé généré')
        }
        await load()
        if (studentRef.current)  { studentRef.current.value  = '' }
        if (semesterRef.current) { semesterRef.current.value = ''; semesterRef.current.disabled = true }
        setSemesters([])
      } else {
        const msg = res.error || 'Erreur de génération'
        setFormError(msg)
        document.getElementById('form-error-box')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    } catch (err: any) {
      const msg = err.message || 'Erreur de génération'
      setFormError(msg)
    } finally { setGenerating(false) }
  }

  async function downloadPDF(id: number, studentName: string) {
    setDownloading(id)
    try {
      await downloadBlob(`/api/transcripts/${id}/pdf`, `releve_notes_${studentName}.pdf`)
      success('Relevé téléchargé avec succès !')
    } catch (err: any) {
      toastErr(err.message?.includes('404') ? 'Fichier PDF introuvable' : err.message || 'Erreur de téléchargement')
    } finally { setDownloading(null) }
  }

  async function togglePublish(id: number, current: boolean) {
    try {
      const res = await api.put<any>(`/api/transcripts/${id}/publish`, { is_published: !current })
      if (res.success !== false) {
        const np = res.is_published ?? !current
        setTranscripts(prev => prev.map(t => t.id === id ? { ...t, is_published: np } : t))
        success(np ? 'Relevé publié' : 'Relevé masqué')
      } else { toastErr(res.error || 'Erreur') }
    } catch (e: any) { toastErr(e.message || 'Erreur') }
  }

  async function deleteTranscript(id: number, name: string) {
    if (!confirm(`Supprimer le relevé de ${name} ?`)) return
    try {
      await api.delete(`/api/transcripts/${id}`)
      success('Relevé supprimé')
      setTranscripts(prev => prev.filter(t => t.id !== id))
    } catch (e: any) { toastErr(e.message || 'Erreur') }
  }

  async function downloadBulk(semesterId: number, semesterName: string) {
    setDownloading('bulk')
    try {
      await downloadBlob(`/api/transcripts/bulk-pdf?semester_id=${semesterId}`, `releves_${semesterName.replace(/\s+/g,'_')}.zip`)
      success('Archive ZIP téléchargée !')
    } catch (e: any) { toastErr(e.message || 'Erreur téléchargement ZIP') }
    finally { setDownloading(null) }
  }

  const filtered = transcripts.filter(t =>
    t.student_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.formation_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  /* Semesters uniques pour le bulk zip */
  const semMap: Record<number, string> = {}
  transcripts.forEach(t => { if (t.semester_id && !semMap[t.semester_id]) semMap[t.semester_id] = t.semester_name })
  const semEntries = Object.entries(semMap)

  /* Groupes de semestres pour l'optgroup */
  const semGroups: Record<string, Semester[]> = {}
  semesters.forEach(s => { (semGroups[s.formation_name] ??= []).push(s) })

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h2><i className="fas fa-file-alt" style={{ marginRight: 10, color: 'var(--primary)' }} />Relevés de Notes</h2>
          <p>Générer et consulter les relevés de notes des étudiants</p>
        </div>
        <button className="btn btn-secondary" onClick={load}><i className="fas fa-rotate" /> Actualiser</button>
      </div>

      {/* ── Section 1 : Relevés générés ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0 }}><i className="fas fa-list" style={{ marginRight: 8 }} />Relevés Générés ({transcripts.length})</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {semEntries.length > 0 && (
              <>
                <select id="bulk-semester-select" defaultValue={semEntries[0][0]}
                  style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }}>
                  {semEntries.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <button className="btn btn-secondary" disabled={downloading === 'bulk'}
                  onClick={() => {
                    const sel = document.getElementById('bulk-semester-select') as HTMLSelectElement
                    downloadBulk(Number(sel.value), sel.selectedOptions[0]?.text || '')
                  }}>
                  <i className={`fas ${downloading === 'bulk' ? 'fa-spinner fa-spin' : 'fa-file-archive'}`} /> Télécharger tout (ZIP)
                </button>
              </>
            )}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, outline: 'none', width: 210 }} />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--primary)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '28px 24px' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 20 }}>
              <i className="fas fa-file-circle-plus" style={{ fontSize: 36, color: '#94a3b8', flexShrink: 0, marginTop: 4 }} />
              <div>
                <strong style={{ fontSize: '1.05em', color: '#334155' }}>Aucun relevé n'a encore été généré</strong>
                <p style={{ margin: '8px 0 4px', color: '#64748b' }}>Pour créer le premier relevé d'un étudiant, utilisez le formulaire ci-dessous. Assurez-vous que :</p>
                <ul style={{ margin: '6px 0 0 20px', color: '#64748b', lineHeight: 1.9 }}>
                  <li>L'étudiant a passé au moins un examen pour ce semestre</li>
                  <li>Les copies ont été corrigées (note attribuée)</li>
                  <li>Les UEs/ECs du semestre ont des coefficients renseignés</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th><i className="fas fa-user" style={{ marginRight: 5 }} />Étudiant</th>
                  <th><i className="fas fa-graduation-cap" style={{ marginRight: 5 }} />Formation</th>
                  <th><i className="fas fa-calendar" style={{ marginRight: 5 }} />Semestre</th>
                  <th><i className="fas fa-star" style={{ marginRight: 5 }} />Moyenne</th>
                  <th><i className="fas fa-award" style={{ marginRight: 5 }} />Crédits</th>
                  <th><i className="fas fa-check-circle" style={{ marginRight: 5 }} />Statut</th>
                  <th><i className="fas fa-eye" style={{ marginRight: 5 }} />Publié</th>
                  <th><i className="fas fa-clock" style={{ marginRight: 5 }} />Généré le</th>
                  <th><i className="fas fa-cog" style={{ marginRight: 5 }} />Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const gColor = gpaColor(t.gpa)
                  return (
                    <tr key={t.id}>
                      <td>
                        <strong style={{ fontSize: 14 }}>{t.student_name}</strong>
                        <br /><small style={{ color: '#64748b' }}>{t.student_email}</small>
                      </td>
                      <td style={{ fontSize: 13 }}>{t.formation_name}</td>
                      <td style={{ fontSize: 13 }}>{t.semester_name}</td>
                      <td>
                        <strong style={{ color: gColor, fontSize: 16 }}>{t.gpa != null ? `${t.gpa}/20` : '—'}</strong>
                      </td>
                      <td style={{ fontSize: 13 }}>{t.obtained_credits ?? '—'}/{t.total_credits ?? '—'}</td>
                      <td>
                        <span className={`status-badge ${t.validated ? 'success' : 'danger'}`}>
                          {t.validated ? 'Validé' : 'Non validé'}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => togglePublish(t.id, t.is_published)}
                          style={{ border: 'none', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', transition: 'all .2s',
                            background: t.is_published ? '#dcfce7' : '#f1f5f9',
                            color: t.is_published ? '#15803d' : '#64748b' }}
                          title={t.is_published ? 'Cliquer pour masquer' : 'Cliquer pour publier'}>
                          <i className={`fas fa-${t.is_published ? 'eye' : 'eye-slash'}`} style={{ marginRight: 4 }} />
                          {t.is_published ? 'Publié' : 'Masqué'}
                        </button>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <div>{new Date(t.generated_at).toLocaleDateString('fr-FR')}</div>
                        {t.generated_by && <small style={{ color: '#64748b' }}>{t.generated_by}</small>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button onClick={() => downloadPDF(t.id, t.student_name)} disabled={downloading === t.id}
                            className="btn btn-sm btn-primary">
                            <i className={`fas ${downloading === t.id ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} /> PDF
                          </button>
                          <button onClick={() => deleteTranscript(t.id, t.student_name)}
                            className="btn btn-sm btn-danger">
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 2 : Générer un nouveau relevé ── */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0 }}><i className="fas fa-plus" style={{ marginRight: 8 }} />Générer un Nouveau Relevé</h3>
        </div>

        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
            <i className="fas fa-lightbulb" style={{ fontSize: 22, marginTop: 2, flexShrink: 0, color: '#2563eb' }} />
            <div style={{ fontSize: '0.93em' }}>
              <strong style={{ color: '#1e40af' }}>Prérequis avant de générer un relevé :</strong>
              <ol style={{ margin: '6px 0 0 18px', lineHeight: 1.8, color: '#3b5998' }}>
                <li>Sélectionnez l'étudiant concerné dans la liste</li>
                <li>Choisissez le semestre pour lequel vous souhaitez générer le relevé</li>
                <li>Assurez-vous que les copies de l'étudiant pour ce semestre ont été corrigées (sinon le relevé ne peut pas être calculé)</li>
              </ol>
              <p style={{ margin: '8px 0 0', color: '#475569' }}>Le relevé sera calculé automatiquement à partir des notes des examens corrigés, puis téléchargé en PDF.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleGenerate} style={{ padding: '0 20px 20px' }}>
          <div className="form-group">
            <label><i className="fas fa-user" style={{ marginRight: 6 }} />Étudiant *</label>
            <select ref={studentRef} required className="form-control"
              onChange={e => { loadSemesters(e.target.value) }}>
              <option value="">-- Sélectionner un étudiant --</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <small style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'block' }}>
              <i className="fas fa-info-circle" style={{ marginRight: 4 }} />Sélectionnez d'abord l'étudiant pour charger ses semestres disponibles
            </small>
          </div>

          <div className="form-group">
            <label><i className="fas fa-calendar" style={{ marginRight: 6 }} />Semestre *</label>
            <select ref={semesterRef} required disabled className="form-control">
              {semLoading
                ? <option>Chargement des semestres…</option>
                : semesters.length === 0
                  ? <option value="">-- D'abord sélectionner un étudiant --</option>
                  : <>
                      <option value="">-- Sélectionner un semestre --</option>
                      {Object.entries(semGroups).map(([fName, sems]) => (
                        <optgroup key={fName} label={fName}>
                          {sems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </optgroup>
                      ))}
                    </>
              }
            </select>
            <small style={{ color: semesters.length > 0 ? '#10b981' : '#64748b', fontSize: 12, marginTop: 4, display: 'block' }}>
              {semesters.length > 0
                ? <><i className="fas fa-check" style={{ marginRight: 4 }} />{semesters.length} semestre(s) disponible(s)</>
                : <><i className="fas fa-arrow-up" style={{ marginRight: 4 }} />Sélectionnez d'abord un étudiant pour activer ce champ</>}
            </small>
          </div>

          {formError && (
            <div id="form-error-box" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
              <i className="fas fa-exclamation-circle" style={{ fontSize: 20, color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: '#dc2626' }}>Erreur lors de la génération</strong>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>{formError}</p>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={generating}>
            <i className={`fas ${generating ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} style={{ marginRight: 6 }} />
            {generating ? 'Génération en cours…' : 'Générer le Relevé'}
          </button>
        </form>
      </div>

      {/* ── Modal succès ── */}
      {successModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSuccessModal(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '32px 28px', maxWidth: 460, width: '90%', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <i className="fas fa-check-circle" style={{ fontSize: 56, color: '#10b981', display: 'block', marginBottom: 16 }} />
            <h2 style={{ marginBottom: 8 }}>Relevé généré avec succès !</h2>
            <p style={{ color: '#64748b', marginBottom: 20 }}>
              Le relevé de <strong>{successModal.name}</strong> pour <strong>{successModal.semName}</strong> a été généré et le téléchargement PDF a démarré automatiquement.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => { setSuccessModal(null); load() }}>
                <i className="fas fa-list" /> Voir tous les relevés
              </button>
              <button className="btn btn-secondary" onClick={() => downloadPDF(successModal.transcriptId, successModal.name)}>
                <i className="fas fa-file-pdf" /> Télécharger à nouveau
              </button>
              <button className="btn btn-secondary" onClick={() => setSuccessModal(null)}>
                <i className="fas fa-times" /> Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
