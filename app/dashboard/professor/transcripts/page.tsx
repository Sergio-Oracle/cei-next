'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface Transcript {
  id:              number
  student_name:    string
  student_email:   string
  formation_name:  string
  semester_number: number
  average:         number | null
  published:       boolean
  created_at:      string
  validated:       boolean
  mention:         string | null
}

interface Student { id: number; full_name: string; email: string }
interface Semester { id: number; number: number; formation_id: number; formation_name?: string }

export default function ProfessorTranscriptsPage() {
  const { success, error: toastErr } = useToast()
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [students,    setStudents]    = useState<Student[]>([])
  const [semesters,   setSemesters]   = useState<Semester[]>([])
  const [loading,     setLoading]     = useState(true)
  const [genModal,    setGenModal]    = useState(false)
  const [genStudent,  setGenStudent]  = useState('')
  const [genSemester, setGenSemester] = useState('')
  const [generating,  setGenerating]  = useState(false)
  const [search,      setSearch]      = useState('')
  const [downloading, setDownloading] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [tRes, sRes] = await Promise.all([
        api.get<any>('/api/transcripts'),
        api.get<any>('/api/students/list'),
      ])
      setTranscripts(tRes.transcripts ?? tRes ?? [])
      setStudents(Array.isArray(sRes) ? sRes : sRes.students ?? [])
    } catch { toastErr('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function loadSemesters(studentId: string) {
    if (!studentId) return
    try {
      const res = await api.get<any>('/api/formations')
      const formations = Array.isArray(res) ? res : res.formations ?? []
      const allSems: Semester[] = []
      for (const f of formations) {
        try {
          const sr = await api.get<any>(`/api/formations/${f.id}/semesters`)
          const sems = Array.isArray(sr) ? sr : sr.semesters ?? []
          sems.forEach((s: any) => allSems.push({ ...s, formation_name: f.name }))
        } catch {}
      }
      setSemesters(allSems)
    } catch {}
  }

  async function generate() {
    if (!genStudent || !genSemester) return
    setGenerating(true)
    try {
      const res = await api.post<any>(`/api/transcripts/generate/${genStudent}/${genSemester}`, {})
      success(res.message || 'Relevé généré')
      setGenModal(false); setGenStudent(''); setGenSemester(''); load()
    } catch (e: any) { toastErr(e.message || 'Erreur de génération') }
    finally { setGenerating(false) }
  }

  async function downloadPDF(id: number, label: string) {
    setDownloading(id)
    try {
      const blob = await api.blob(`/api/transcripts/${id}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `releve_${label.replace(/\s+/g,'_')}.pdf`
      a.click(); URL.revokeObjectURL(url)
    } catch (e: any) { toastErr(e.message || 'Erreur de téléchargement') }
    finally { setDownloading(null) }
  }

  async function togglePublish(id: number, current: boolean) {
    try {
      await api.put(`/api/transcripts/${id}/publish`, {})
      success(current ? 'Relevé dépublié' : 'Relevé publié')
      setTranscripts(prev => prev.map(t => t.id === id ? { ...t, published: !current } : t))
    } catch (e: any) { toastErr(e.message || 'Erreur') }
  }

  async function deleteTranscript(id: number) {
    if (!confirm('Supprimer ce relevé ?')) return
    try {
      await api.delete(`/api/transcripts/${id}`)
      success('Relevé supprimé')
      setTranscripts(prev => prev.filter(t => t.id !== id))
    } catch (e: any) { toastErr(e.message || 'Erreur') }
  }

  const mention = (avg: number | null) => {
    if (avg == null) return { label: '—', color: 'var(--text-muted)' }
    if (avg >= 16) return { label: 'Très Bien', color: '#10b981' }
    if (avg >= 14) return { label: 'Bien', color: '#3b82f6' }
    if (avg >= 12) return { label: 'Assez Bien', color: '#f59e0b' }
    if (avg >= 10) return { label: 'Passable', color: '#94a3b8' }
    return { label: 'Insuffisant', color: '#ef4444' }
  }

  const filtered = transcripts.filter(t =>
    t.student_name.toLowerCase().includes(search.toLowerCase()) ||
    t.formation_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-file-alt" style={{ marginRight: 10, color: 'var(--primary)' }} />Relevés de Notes</h2>
          <p>Générer, publier et exporter les relevés de notes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><i className="fas fa-sync-alt" /> Actualiser</button>
          <button className="btn btn-primary" onClick={() => setGenModal(true)}><i className="fas fa-plus" /> Générer un relevé</button>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par étudiant ou formation…"
          style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, outline: 'none', width: 300 }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-file-alt" style={{ fontSize: 48, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }} />
            <h3>Aucun relevé</h3>
            <p style={{ color: 'var(--text-muted)' }}>Cliquez sur "Générer un relevé" pour créer le premier.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--background)' }}>
                {['Étudiant','Formation / Semestre','Moyenne','Mention','Statut','Généré le','Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const m = mention(t.average)
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{t.student_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.student_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      <div>{t.formation_name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Semestre {t.semester_number}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 16, color: t.average != null ? (t.average >= 10 ? '#10b981' : '#ef4444') : 'var(--text-muted)' }}>
                      {t.average != null ? `${Number(t.average).toFixed(2)}/20` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: m.color }}>{m.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {t.published
                        ? <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99 }}><i className="fas fa-eye" style={{ marginRight: 4 }} />Publié</span>
                        : <span style={{ background: '#f1f5f9', color: '#94a3b8', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99 }}><i className="fas fa-eye-slash" style={{ marginRight: 4 }} />Brouillon</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(t.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => downloadPDF(t.id, `${t.student_name} S${t.semester_number}`)}
                          disabled={downloading === t.id}
                          style={{ padding: '5px 10px', border: 'none', borderRadius: 6, background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          <i className={`fas ${downloading === t.id ? 'fa-spinner fa-spin' : 'fa-download'}`} /> PDF
                        </button>
                        <button onClick={() => togglePublish(t.id, t.published)}
                          style={{ padding: '5px 10px', border: 'none', borderRadius: 6, background: t.published ? '#fef9c3' : '#f0fdf4', color: t.published ? '#ca8a04' : '#16a34a', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          <i className={`fas ${t.published ? 'fa-eye-slash' : 'fa-eye'}`} /> {t.published ? 'Dépublier' : 'Publier'}
                        </button>
                        <button onClick={() => deleteTranscript(t.id)}
                          style={{ padding: '5px 8px', border: 'none', borderRadius: 6, background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal génération */}
      {genModal && (
        <div onClick={() => setGenModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ padding: 28, maxWidth: 440, width: '90%' }}>
            <h3 style={{ marginBottom: 20 }}><i className="fas fa-file-plus" style={{ color: 'var(--primary)', marginRight: 8 }} />Générer un relevé</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Étudiant</label>
              <select value={genStudent} onChange={e => { setGenStudent(e.target.value); loadSemesters(e.target.value) }}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, outline: 'none' }}>
                <option value="">— Choisir un étudiant —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Semestre</label>
              <select value={genSemester} onChange={e => setGenSemester(e.target.value)} disabled={!genStudent}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, outline: 'none' }}>
                <option value="">— Choisir un semestre —</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.formation_name} — Semestre {s.number}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setGenModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={generate} disabled={generating || !genStudent || !genSemester}>
                <i className="fas fa-file-alt" />{generating ? 'Génération…' : 'Générer le relevé'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
