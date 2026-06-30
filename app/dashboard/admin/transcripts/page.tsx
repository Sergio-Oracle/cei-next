'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { GradeTranscript } from '@/types'

export default function AdminTranscriptsPage() {
  const { success, error } = useToast()
  const [transcripts, setTranscripts] = useState<GradeTranscript[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<number | null>(null)
  const [showGenModal, setShowGenModal] = useState(false)
  const [genForm, setGenForm] = useState({ student_id: '', semester_id: '' })
  const [generating, setGenerating] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<GradeTranscript[]>('/api/transcripts')
      setTranscripts(Array.isArray(res) ? res : (res as any).transcripts ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function togglePublish(t: GradeTranscript) {
    setActioning(t.id)
    try {
      await api.put(`/api/transcripts/${t.id}/publish`, { is_published: !t.is_published })
      success(t.is_published ? 'Relevé dépublié' : 'Relevé publié')
      setTranscripts(prev => prev.map(tr => tr.id === t.id ? { ...tr, is_published: !tr.is_published } : tr))
    } catch (e: any) {
      error(e.message || 'Erreur')
    } finally {
      setActioning(null)
    }
  }

  async function downloadPdf(id: number) {
    try {
      const blob = await api.blob(`/api/transcripts/${id}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transcript_${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      error(e.message || 'Erreur téléchargement')
    }
  }

  async function handleGenerate() {
    if (!genForm.student_id || !genForm.semester_id) { error('ID étudiant et semestre requis'); return }
    setGenerating(true)
    try {
      await api.post(`/api/transcripts/generate/${genForm.student_id}/${genForm.semester_id}`)
      success('Relevé généré')
      setShowGenModal(false)
      setGenForm({ student_id: '', semester_id: '' })
      load()
    } catch (e: any) {
      error(e.message || 'Erreur génération')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-scroll" style={{ marginRight: 10, color: 'var(--primary)' }} />Relevés de notes</h2>
          <p>Gestion des transcripts LMD</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowGenModal(true)}>
          <i className="fa-solid fa-plus" /> Générer un relevé
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Semestre</th>
                <th>GPA</th>
                <th>Crédits</th>
                <th>Publié</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                  <i className="fa-solid fa-spinner spin" /> Chargement...
                </td></tr>
              ) : transcripts.length === 0 ? (
                <tr><td colSpan={7} className="empty-message">Aucun relevé de notes</td></tr>
              ) : transcripts.map(t => (
                <tr key={t.id}>
                  <td>{t.student_name ?? `Étudiant #${t.student_id}`}</td>
                  <td>{t.semester_name ?? `S${t.semester_id}`}</td>
                  <td>
                    {t.gpa != null ? (
                      <strong style={{ color: t.gpa >= 10 ? 'var(--success)' : 'var(--danger)' }}>{t.gpa.toFixed(2)}</strong>
                    ) : '—'}
                  </td>
                  <td>{t.obtained_credits ?? '—'} / {t.total_credits}</td>
                  <td>
                    <span className={`status-badge ${t.is_published ? 'success' : 'secondary'}`}>
                      {t.is_published ? 'Publié' : 'Brouillon'}
                    </span>
                  </td>
                  <td>{new Date(t.generated_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className={`btn btn-sm ${t.is_published ? 'btn-warning' : 'btn-success'}`}
                        onClick={() => togglePublish(t)}
                        disabled={actioning === t.id}
                        title={t.is_published ? 'Dépublier' : 'Publier'}
                      >
                        {actioning === t.id
                          ? <i className="fa-solid fa-spinner spin" />
                          : <i className={`fa-solid ${t.is_published ? 'fa-eye-slash' : 'fa-eye'}`} />
                        }
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => downloadPdf(t.id)} title="Télécharger PDF">
                        <i className="fa-solid fa-file-pdf" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showGenModal && (
        <Modal title="Générer un relevé de notes" onClose={() => setShowGenModal(false)}>
          <div className="form-group">
            <label>ID Étudiant *</label>
            <input type="number" className="form-control" value={genForm.student_id} onChange={e => setGenForm(p => ({ ...p, student_id: e.target.value }))} placeholder="ID de l'étudiant" />
          </div>
          <div className="form-group">
            <label>ID Semestre *</label>
            <input type="number" className="form-control" value={genForm.semester_id} onChange={e => setGenForm(p => ({ ...p, semester_id: e.target.value }))} placeholder="ID du semestre" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowGenModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? <><i className="fa-solid fa-spinner spin" /> Génération...</> : 'Générer'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
