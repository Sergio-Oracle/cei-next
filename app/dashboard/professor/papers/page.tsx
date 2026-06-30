'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { Subject, StudentPaper } from '@/types'

export default function ProfessorPapersPage() {
  const { success, error } = useToast()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [papers, setPapers] = useState<StudentPaper[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null)
  const [loadingPapers, setLoadingPapers] = useState(false)
  const [showSingleModal, setShowSingleModal] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [singleForm, setSingleForm] = useState({ subject_id: '', student_id: '', file: null as File | null })
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [batchSubjectId, setBatchSubjectId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get<Subject[]>('/api/subjects')
      .then(r => setSubjects(Array.isArray(r) ? r : (r as any).subjects ?? []))
      .catch(() => error('Erreur chargement sujets'))
  }, [])

  async function loadPapers(subjectId: number) {
    setSelectedSubjectId(subjectId)
    setLoadingPapers(true)
    try {
      const res = await api.get<StudentPaper[]>(`/api/papers/subject/${subjectId}`)
      setPapers(Array.isArray(res) ? res : (res as any).papers ?? [])
    } catch { error('Erreur chargement copies') }
    finally { setLoadingPapers(false) }
  }

  async function handleSingleCorrect() {
    if (!singleForm.file || !singleForm.subject_id || !singleForm.student_id) {
      error('Tous les champs sont requis'); return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', singleForm.file)
      fd.append('subject_id', singleForm.subject_id)
      fd.append('student_id', singleForm.student_id)
      await api.upload('/api/papers/correct', fd)
      success('Copie envoyée en correction')
      setShowSingleModal(false)
      setSingleForm({ subject_id: '', student_id: '', file: null })
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  async function handleBatchCorrect() {
    if (!batchFile) { error('Sélectionnez un fichier'); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', batchFile)
      if (batchSubjectId) fd.append('subject_id', batchSubjectId)
      await api.upload('/api/papers/upload-batch', fd)
      success('Batch envoyé en correction')
      setShowBatchModal(false)
      setBatchFile(null)
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-pen-ruler" style={{ marginRight: 10, color: 'var(--primary)' }} />Correction de copies</h2>
          <p>Correction individuelle ou en lot</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowBatchModal(true)}>
            <i className="fa-solid fa-layer-group" /> Correction batch
          </button>
          <button className="btn btn-primary" onClick={() => setShowSingleModal(true)}>
            <i className="fa-solid fa-upload" /> Corriger une copie
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '280px 1fr', alignItems: 'start' }}>
        {/* Sidebar sujets */}
        <div className="card">
          <div className="card-header"><h3><i className="fa-solid fa-list" /> Sujets</h3></div>
          {subjects.length === 0 ? (
            <p className="empty-message">Aucun sujet</p>
          ) : subjects.map(s => (
            <div
              key={s.id}
              className="reclamation-item"
              style={{ cursor: 'pointer', background: selectedSubjectId === s.id ? 'var(--primary)15' : undefined }}
              onClick={() => loadPapers(s.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.papers_count ?? 0} copie(s)</div>
              </div>
              <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 12 }} />
            </div>
          ))}
        </div>

        {/* Copies */}
        <div className="card">
          {!selectedSubjectId ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-arrow-left" style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
              Sélectionnez un sujet pour voir les copies
            </div>
          ) : loadingPapers ? (
            <div style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner spin" /></div>
          ) : papers.length === 0 ? (
            <p className="empty-message">Aucune copie pour ce sujet</p>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Étudiant</th><th>Note</th><th>Score</th><th>Date correction</th><th>Réclamation</th>
                  </tr>
                </thead>
                <tbody>
                  {papers.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.student_name ?? `Étudiant #${p.student_id}`}</div>
                        {p.student_email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.student_email}</div>}
                      </td>
                      <td>{p.grade ?? '—'}</td>
                      <td>{p.score != null ? <strong style={{ color: (p.score ?? 0) >= 10 ? 'var(--success)' : 'var(--danger)' }}>{p.score}/20</strong> : '—'}</td>
                      <td>{p.corrected_at ? new Date(p.corrected_at).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>
                        {p.has_reclamation ? (
                          <span className={`status-badge ${p.reclamation_status === 'resolved' ? 'success' : 'warning'}`}>
                            {p.reclamation_status}
                          </span>
                        ) : <span className="status-badge secondary">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showSingleModal && (
        <Modal title="Corriger une copie" onClose={() => setShowSingleModal(false)}>
          <div className="form-group">
            <label>Sujet *</label>
            <select className="form-control" value={singleForm.subject_id} onChange={e => setSingleForm(p => ({ ...p, subject_id: e.target.value }))}>
              <option value="">-- Choisir un sujet --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>ID Étudiant *</label>
            <input type="number" className="form-control" value={singleForm.student_id} onChange={e => setSingleForm(p => ({ ...p, student_id: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Fichier copie *</label>
            <input type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setSingleForm(p => ({ ...p, file: e.target.files?.[0] ?? null }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowSingleModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSingleCorrect} disabled={submitting}>
              {submitting ? <><i className="fa-solid fa-spinner spin" /> Envoi...</> : 'Corriger'}
            </button>
          </div>
        </Modal>
      )}

      {showBatchModal && (
        <Modal title="Correction en lot" onClose={() => setShowBatchModal(false)}>
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            <i className="fa-solid fa-circle-info" /> Uploadez un ZIP contenant toutes les copies.
          </div>
          <div className="form-group">
            <label>Sujet</label>
            <select className="form-control" value={batchSubjectId} onChange={e => setBatchSubjectId(e.target.value)}>
              <option value="">-- Choisir un sujet --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fichier ZIP *</label>
            <input type="file" className="form-control" accept=".zip" onChange={e => setBatchFile(e.target.files?.[0] ?? null)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowBatchModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleBatchCorrect} disabled={submitting || !batchFile}>
              {submitting ? <><i className="fa-solid fa-spinner spin" /> Envoi...</> : 'Envoyer le lot'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
