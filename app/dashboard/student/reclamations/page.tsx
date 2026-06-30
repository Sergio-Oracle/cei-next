'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'

interface Reclamation {
  id: number
  paper_id: number | null
  attempt_id: number | null
  type: 'online_exam' | 'paper'
  student_name: string
  subject_title: string
  exam_title?: string
  attempt_score?: number | null
  attempt_feedback?: string | null
  reason: string
  status: string
  response?: string | null
  ia_decision?: string | null
  ia_proposed_score?: number | null
  ia_proposed_grade?: string | null
  ia_proposed_reason?: string | null
  responder_name?: string | null
  created_at: string
  updated_at?: string | null
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:          { label: 'En attente',    cls: 'warning' },
  in_review:        { label: 'En révision',   cls: 'info' },
  resolved:         { label: 'Résolue',       cls: 'success' },
  rejected:         { label: 'Rejetée',       cls: 'danger' },
  ai_processed:     { label: 'Traitée IA',    cls: 'info' },
  proposal_pending: { label: 'Proposition IA', cls: 'warning' },
}

function StatusBadge({ status }: { status: string }) {
  const { label, cls } = STATUS_MAP[status] ?? { label: status, cls: 'secondary' }
  return <span className={`status-badge ${cls}`}>{label}</span>
}

function ReclamationsContent() {
  const searchParams = useSearchParams()
  const { success, error } = useToast()
  const [reclamations, setReclamations] = useState<Reclamation[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    reason: '',
    attempt_id: searchParams.get('attempt_id') ?? '',
    paper_id: searchParams.get('paper_id') ?? '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [viewItem, setViewItem] = useState<Reclamation | null>(null)

  useEffect(() => {
    load()
    if (searchParams.get('attempt_id') || searchParams.get('paper_id')) {
      setShowCreate(true)
    }
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<Reclamation[]>('/api/reclamations')
      setReclamations(Array.isArray(res) ? res : (res as any).reclamations ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!createForm.reason.trim()) { error('Le motif est requis'); return }
    if (!createForm.attempt_id && !createForm.paper_id) {
      error('Précisez l\'examen ou la copie concernée'); return
    }
    setSubmitting(true)
    try {
      const body: any = { reason: createForm.reason }
      if (createForm.attempt_id) body.attempt_id = Number(createForm.attempt_id)
      if (createForm.paper_id) body.paper_id = Number(createForm.paper_id)
      await api.post('/api/reclamations', body)
      success('Réclamation soumise')
      setShowCreate(false)
      setCreateForm({ reason: '', attempt_id: '', paper_id: '' })
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-comment-exclamation" style={{ marginRight: 10, color: 'var(--warning)' }} />Mes réclamations</h2>
          <p>{reclamations.length} réclamation(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <i className="fa-solid fa-plus" /> Nouvelle réclamation
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Examen / Matière</th>
                <th>Type</th>
                <th>Note obtenue</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                  <i className="fa-solid fa-spinner spin" />
                </td></tr>
              ) : reclamations.length === 0 ? (
                <tr><td colSpan={6} className="empty-message">Aucune réclamation</td></tr>
              ) : reclamations.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.exam_title ?? r.subject_title}</div>
                    {r.exam_title && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.subject_title}</div>}
                  </td>
                  <td>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 99,
                      background: r.type === 'online_exam' ? '#eff6ff' : '#f0fdf4',
                      color: r.type === 'online_exam' ? '#1d4ed8' : '#166534' }}>
                      {r.type === 'online_exam' ? 'En ligne' : 'Copie papier'}
                    </span>
                  </td>
                  <td>
                    {r.attempt_score != null
                      ? <strong style={{ color: r.attempt_score >= 10 ? 'var(--success)' : 'var(--danger)' }}>{r.attempt_score}/20</strong>
                      : '—'}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ fontSize: 13 }}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => setViewItem(r)} title="Voir détails">
                      <i className="fa-solid fa-eye" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal création */}
      {showCreate && (
        <Modal title="Nouvelle réclamation" onClose={() => setShowCreate(false)}>
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            <i className="fa-solid fa-circle-info" /> Décrivez clairement le motif de votre réclamation. Vous disposez de 7 jours après la correction.
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>ID Examen en ligne</label>
              <input
                type="number"
                className="form-control"
                value={createForm.attempt_id}
                onChange={e => setCreateForm(p => ({ ...p, attempt_id: e.target.value, paper_id: '' }))}
                placeholder="ID de la tentative"
              />
            </div>
            <div className="form-group">
              <label>ID Copie papier</label>
              <input
                type="number"
                className="form-control"
                value={createForm.paper_id}
                onChange={e => setCreateForm(p => ({ ...p, paper_id: e.target.value, attempt_id: '' }))}
                placeholder="ID de la copie"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Motif de la réclamation *</label>
            <textarea
              className="form-control"
              rows={6}
              value={createForm.reason}
              onChange={e => setCreateForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Expliquez en détail le motif de votre réclamation..."
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? <><i className="fa-solid fa-spinner spin" /> Envoi...</> : <><i className="fa-solid fa-paper-plane" /> Soumettre</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal détail */}
      {viewItem && (
        <Modal title={`Réclamation #${viewItem.id}`} onClose={() => setViewItem(null)}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge status={viewItem.status} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {new Date(viewItem.created_at).toLocaleString('fr-FR')}
            </span>
          </div>

          {viewItem.attempt_score != null && (
            <div className="alert alert-info">
              <i className="fa-solid fa-star" /> Note initiale :
              <strong style={{ marginLeft: 4, color: viewItem.attempt_score >= 10 ? 'var(--success)' : 'var(--danger)' }}>
                {viewItem.attempt_score}/20
              </strong>
            </div>
          )}

          <div className="form-group">
            <label>Votre motif</label>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: 14, whiteSpace: 'pre-wrap', border: '1px solid var(--border)' }}>
              {viewItem.reason}
            </div>
          </div>

          {viewItem.response && (
            <div className="form-group">
              <label>Réponse {viewItem.responder_name ? `de ${viewItem.responder_name}` : ''}</label>
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 'var(--radius)', fontSize: 14, border: '1px solid #bbf7d0', whiteSpace: 'pre-wrap' }}>
                {viewItem.response}
              </div>
            </div>
          )}

          {viewItem.ia_proposed_score != null && (
            <div className="alert alert-warning">
              <i className="fa-solid fa-robot" /> <strong>Proposition IA :</strong>{' '}
              Score {viewItem.ia_proposed_score}
              {viewItem.ia_proposed_grade && ` (${viewItem.ia_proposed_grade})`}
              {viewItem.ia_proposed_reason && (
                <div style={{ marginTop: 6, fontSize: 13 }}>{viewItem.ia_proposed_reason}</div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

export default function StudentReclamationsPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 60 }}><i className="fa-solid fa-spinner spin" /></div>}>
      <ReclamationsContent />
    </Suspense>
  )
}
