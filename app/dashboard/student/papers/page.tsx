'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { StudentPaper } from '@/types'

export default function StudentPapersPage() {
  const { success, error } = useToast()
  const [papers, setPapers] = useState<StudentPaper[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<StudentPaper | null>(null)
  const [showReclamation, setShowReclamation] = useState(false)
  const [reclamationText, setReclamationText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<StudentPaper[]>('/api/student/papers')
      setPapers(Array.isArray(res) ? res : (res as any).papers ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  function canReclaim(paper: StudentPaper) {
    if (paper.has_reclamation) return false
    if (!paper.reclamation_window_end) return paper.corrected_at != null
    return new Date() < new Date(paper.reclamation_window_end)
  }

  async function submitReclamation() {
    if (!selected || !reclamationText.trim()) { error('Veuillez décrire votre réclamation'); return }
    setSubmitting(true)
    try {
      await api.post('/api/reclamations', {
        paper_id: selected.id,
        content: reclamationText,
      })
      success('Réclamation soumise')
      setShowReclamation(false)
      setReclamationText('')
      setSelected(null)
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-file-pen" style={{ marginRight: 10, color: 'var(--primary)' }} />Mes copies</h2>
          <p>Consultez vos copies corrigées</p>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Sujet</th>
                <th>Note</th>
                <th>Score</th>
                <th>Correction</th>
                <th>Réclamation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner spin" /></td></tr>
              ) : papers.length === 0 ? (
                <tr><td colSpan={6} className="empty-message">Aucune copie corrigée</td></tr>
              ) : papers.map(p => (
                <tr key={p.id}>
                  <td><div style={{ fontWeight: 600 }}>{p.subject_title ?? `Sujet #${p.subject_id}`}</div></td>
                  <td>{p.grade ?? '—'}</td>
                  <td>
                    {p.score != null
                      ? <strong style={{ color: (p.score ?? 0) >= 10 ? 'var(--success)' : 'var(--danger)' }}>{p.score}/20</strong>
                      : <span className="status-badge warning">En attente</span>
                    }
                  </td>
                  <td>{p.corrected_at ? new Date(p.corrected_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td>
                    {p.has_reclamation
                      ? <span className={`status-badge ${p.reclamation_status === 'resolved' ? 'success' : p.reclamation_status === 'rejected' ? 'danger' : 'warning'}`}>{p.reclamation_status}</span>
                      : canReclaim(p)
                        ? <span className="status-badge secondary">Possible</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => setSelected(p)} title="Voir détails">
                        <i className="fa-solid fa-eye" />
                      </button>
                      {canReclaim(p) && (
                        <button className="btn btn-sm btn-warning" onClick={() => { setSelected(p); setShowReclamation(true) }} title="Faire une réclamation">
                          <i className="fa-solid fa-comment-exclamation" />
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

      {/* Détail copie */}
      {selected && !showReclamation && (
        <Modal title={`Copie – ${selected.subject_title ?? 'Sujet'}`} onClose={() => setSelected(null)} maxWidth={700}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
            <div><strong>Note :</strong> {selected.grade ?? '—'}</div>
            <div><strong>Score :</strong> {selected.score != null ? <strong style={{ color: (selected.score ?? 0) >= 10 ? 'var(--success)' : 'var(--danger)' }}>{selected.score}/20</strong> : '—'}</div>
          </div>
          {selected.corrected_at && (
            <div style={{ marginBottom: 16 }}>
              <strong>Corrigé le :</strong> {new Date(selected.corrected_at).toLocaleString('fr-FR')}
            </div>
          )}
          {selected.content && (
            <div className="form-group">
              <label>Feedback</label>
              <div style={{ padding: 12, background: 'var(--background)', borderRadius: 'var(--radius)', fontSize: 14, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                {selected.content}
              </div>
            </div>
          )}
          {canReclaim(selected) && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-warning" onClick={() => setShowReclamation(true)}>
                <i className="fa-solid fa-comment-exclamation" /> Faire une réclamation
              </button>
              {selected.reclamation_window_end && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Délai : {new Date(selected.reclamation_window_end).toLocaleString('fr-FR')}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Formulaire réclamation */}
      {selected && showReclamation && (
        <Modal title="Faire une réclamation" onClose={() => { setShowReclamation(false); setReclamationText('') }} maxWidth={600}>
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            <i className="fa-solid fa-circle-info" /> Réclamation pour : <strong>{selected.subject_title}</strong> (Note : {selected.score}/20)
          </div>
          <div className="form-group">
            <label>Motif de la réclamation *</label>
            <textarea
              className="form-control"
              rows={6}
              value={reclamationText}
              onChange={e => setReclamationText(e.target.value)}
              placeholder="Expliquez en détail le motif de votre réclamation..."
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowReclamation(false)}>Annuler</button>
            <button className="btn btn-warning" onClick={submitReclamation} disabled={submitting}>
              {submitting ? <><i className="fa-solid fa-spinner spin" /> Envoi...</> : <><i className="fa-solid fa-paper-plane" /> Soumettre</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
