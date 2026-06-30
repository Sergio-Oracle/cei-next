'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { Reclamation, ReclamationStatus } from '@/types'

function StatusBadge({ status }: { status: ReclamationStatus }) {
  const map: Record<ReclamationStatus, { label: string; cls: string }> = {
    pending:          { label: 'En attente',     cls: 'warning' },
    in_review:        { label: 'En révision',    cls: 'info' },
    resolved:         { label: 'Résolue',        cls: 'success' },
    rejected:         { label: 'Rejetée',        cls: 'danger' },
    ai_processed:     { label: 'Traitée IA',     cls: 'info' },
    proposal_pending: { label: 'Proposition IA', cls: 'warning' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'secondary' }
  return <span className={`status-badge ${cls}`}>{label}</span>
}

export default function ProfessorReclamationsPage() {
  const { success, error } = useToast()
  const [reclamations, setReclamations] = useState<Reclamation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Reclamation | null>(null)
  const [response, setResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actioning, setActioning] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<Reclamation[]>('/api/reclamations')
      setReclamations(Array.isArray(res) ? res : (res as any).reclamations ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function handleRespond() {
    if (!selected || !response.trim()) { error('La réponse est requise'); return }
    setSubmitting(true)
    try {
      await api.put(`/api/reclamations/${selected.id}`, { response, status: 'resolved' })
      success('Réponse envoyée')
      setSelected(null)
      setResponse('')
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  async function analyzeAI(id: number) {
    setActioning(id)
    try {
      await api.post(`/api/reclamations/${id}/process_ia`)
      success('Analyse IA lancée')
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActioning(null) }
  }

  async function applyProposal(id: number) {
    if (!confirm('Appliquer la proposition IA ?')) return
    setActioning(id)
    try {
      await api.post(`/api/reclamations/${id}/apply_proposal`)
      success('Appliqué')
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActioning(null) }
  }

  async function rejectProposal(id: number) {
    setActioning(id)
    try {
      await api.post(`/api/reclamations/${id}/reject_proposal`)
      success('Proposition rejetée')
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActioning(null) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-comment-exclamation" style={{ marginRight: 10, color: 'var(--warning)' }} />Réclamations</h2>
          <p>Gérez les réclamations de vos étudiants</p>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Étudiant</th><th>Sujet</th><th>Statut</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner spin" /></td></tr>
              ) : reclamations.length === 0 ? (
                <tr><td colSpan={5} className="empty-message">Aucune réclamation</td></tr>
              ) : reclamations.map(r => (
                <tr key={r.id}>
                  <td>{r.student_name ?? `Étudiant #${r.student_id}`}</td>
                  <td>{r.subject ?? '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => { setSelected(r); setResponse(r.response ?? '') }}><i className="fa-solid fa-reply" /></button>
                      {(r.status === 'pending' || r.status === 'in_review') && (
                        <button className="btn btn-sm btn-info" onClick={() => analyzeAI(r.id)} disabled={actioning === r.id}>
                          {actioning === r.id ? <i className="fa-solid fa-spinner spin" /> : <i className="fa-solid fa-wand-magic-sparkles" />}
                        </button>
                      )}
                      {r.status === 'proposal_pending' && (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => applyProposal(r.id)} disabled={actioning === r.id}><i className="fa-solid fa-check" /></button>
                          <button className="btn btn-sm btn-danger" onClick={() => rejectProposal(r.id)} disabled={actioning === r.id}><i className="fa-solid fa-xmark" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <Modal title={`Réclamation #${selected.id}`} onClose={() => setSelected(null)} maxWidth={700}>
          <div style={{ marginBottom: 12 }}>
            <strong>Étudiant :</strong> {selected.student_name} &nbsp;|&nbsp; <strong>Sujet :</strong> {selected.subject} &nbsp;|&nbsp; <StatusBadge status={selected.status} />
          </div>
          <div className="form-group">
            <label>Contenu</label>
            <div style={{ padding: 12, background: 'var(--background)', borderRadius: 'var(--radius)', fontSize: 14, whiteSpace: 'pre-wrap' }}>{selected.content}</div>
          </div>
          {selected.ai_proposed_score != null && (
            <div className="alert alert-info">
              <i className="fa-solid fa-robot" /> <strong>Proposition IA :</strong> Score {selected.ai_proposed_score}{selected.ai_proposed_grade && ` (${selected.ai_proposed_grade})`}
              {selected.ai_proposed_reason && <div style={{ marginTop: 4, fontSize: 13 }}>{selected.ai_proposed_reason}</div>}
            </div>
          )}
          <div className="form-group">
            <label>Réponse</label>
            <textarea className="form-control" rows={4} value={response} onChange={e => setResponse(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>Fermer</button>
            <button className="btn btn-primary" onClick={handleRespond} disabled={submitting}>
              {submitting ? <><i className="fa-solid fa-spinner spin" /> Envoi...</> : <><i className="fa-solid fa-reply" /> Répondre</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
