'use client'

import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { Reclamation, ReclamationStatus } from '@/types'

const AI_STEPS = [
  { at: 0,  label: 'Lecture de la réclamation et du barème…' },
  { at: 8,  label: 'Comparaison avec la correction originale…' },
  { at: 20, label: "Analyse par l'IA en cours (peut basculer entre plusieurs modèles)…" },
  { at: 45, label: 'Rédaction de la décision et de la nouvelle note…' },
]

function fmtElapsed(s: number) {
  const m = Math.floor(s / 60), r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function StatusBadge({ status }: { status: ReclamationStatus }) {
  const map: Record<ReclamationStatus, { label: string; cls: string }> = {
    pending:          { label: 'En attente',      cls: 'warning' },
    in_review:        { label: 'En révision',     cls: 'info' },
    resolved:         { label: 'Résolue',         cls: 'success' },
    rejected:         { label: 'Rejetée',         cls: 'danger' },
    ai_processed:     { label: 'Traitée IA',      cls: 'info' },
    proposal_pending: { label: 'Proposition IA',  cls: 'warning' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'secondary' }
  return <span className={`status-badge ${cls}`}>{label}</span>
}

export default function AdminReclamationsPage() {
  const { success, error } = useToast()
  const [reclamations, setReclamations] = useState<Reclamation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Reclamation | null>(null)
  const [response, setResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actioning, setActioning] = useState<number | null>(null)
  const [aiModal, setAiModal] = useState<{ id: number; studentName: string } | null>(null)
  const [aiElapsed, setAiElapsed] = useState(0)
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { load() }, [])
  useEffect(() => () => { if (aiTimerRef.current) clearInterval(aiTimerRef.current) }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<Reclamation[]>('/api/reclamations')
      setReclamations(Array.isArray(res) ? res : (res as any).reclamations ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function handleRespond() {
    if (!selected) return
    if (!response.trim()) { error('La réponse est requise'); return }
    setSubmitting(true)
    try {
      await api.put(`/api/reclamations/${selected.id}`, { response, status: 'resolved' })
      success('Réponse envoyée')
      setSelected(null)
      setResponse('')
      load()
    } catch (e: any) {
      error(e.message || 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  async function analyzeAI(id: number, studentName: string) {
    setActioning(id)
    setAiElapsed(0)
    setAiModal({ id, studentName })
    aiTimerRef.current = setInterval(() => setAiElapsed(s => s + 1), 1000)
    try {
      await api.aiPost(`/api/reclamations/${id}/process_ia`)
      success('Analyse IA terminée')
      load()
    } catch (e: any) {
      error(e.message || 'Erreur analyse IA')
    } finally {
      setActioning(null)
      setAiModal(null)
      if (aiTimerRef.current) { clearInterval(aiTimerRef.current); aiTimerRef.current = null }
    }
  }

  async function applyProposal(id: number) {
    if (!confirm('Appliquer la proposition de l\'IA ?')) return
    setActioning(id)
    try {
      await api.post(`/api/reclamations/${id}/apply_proposal`)
      success('Proposition appliquée')
      load()
    } catch (e: any) {
      error(e.message || 'Erreur')
    } finally {
      setActioning(null)
    }
  }

  async function rejectProposal(id: number) {
    setActioning(id)
    try {
      await api.post(`/api/reclamations/${id}/reject_proposal`)
      success('Proposition rejetée')
      load()
    } catch (e: any) {
      error(e.message || 'Erreur')
    } finally {
      setActioning(null)
    }
  }

  const pending = reclamations.filter(r => r.status === 'pending' || r.status === 'in_review').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-comment-exclamation" style={{ marginRight: 10, color: 'var(--warning)' }} />Réclamations</h2>
          <p>{pending} réclamation{pending > 1 ? 's' : ''} en attente</p>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Sujet</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>
                  <i className="fa-solid fa-spinner spin" /> Chargement...
                </td></tr>
              ) : reclamations.length === 0 ? (
                <tr><td colSpan={5} className="empty-message">Aucune réclamation</td></tr>
              ) : reclamations.map(r => (
                <tr key={r.id}>
                  <td>{r.student_name ?? `Étudiant #${r.student_id}`}</td>
                  <td>{r.subject_title ?? '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => { setSelected(r); setResponse(r.response ?? '') }} title="Répondre">
                        <i className="fa-solid fa-reply" />
                      </button>
                      {(r.status === 'pending' || r.status === 'in_review') && (
                        <button className="btn btn-sm btn-info" onClick={() => analyzeAI(r.id, r.student_name ?? `Étudiant #${r.student_id}`)} disabled={actioning === r.id} title="Analyser avec IA">
                          {actioning === r.id ? <i className="fa-solid fa-spinner spin" /> : <i className="fa-solid fa-wand-magic-sparkles" />}
                        </button>
                      )}
                      {r.status === 'proposal_pending' && (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => applyProposal(r.id)} disabled={actioning === r.id} title="Appliquer proposition IA">
                            <i className="fa-solid fa-check" />
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => rejectProposal(r.id)} disabled={actioning === r.id} title="Rejeter proposition">
                            <i className="fa-solid fa-xmark" />
                          </button>
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
          <div style={{ marginBottom: 16 }}>
            <strong>Étudiant :</strong> {selected.student_name}<br />
            <strong>Sujet :</strong> {selected.subject_title}<br />
            <strong>Statut :</strong> <StatusBadge status={selected.status} />
          </div>

          <div className="form-group">
            <label>Contenu de la réclamation</label>
            <div style={{ padding: 12, background: 'var(--background)', borderRadius: 'var(--radius)', fontSize: 14, whiteSpace: 'pre-wrap' }}>
              {selected.reason}
            </div>
          </div>

          {selected.ia_proposed_score != null && (
            <div className="alert alert-info">
              <strong><i className="fa-solid fa-robot" /> Proposition IA :</strong><br />
              Score proposé : <strong>{selected.ia_proposed_score}</strong>{selected.ia_proposed_grade && ` (${selected.ia_proposed_grade})`}<br />
              {selected.ia_proposed_reason && <span style={{ fontSize: 13 }}>{selected.ia_proposed_reason}</span>}
            </div>
          )}

          <div className="form-group">
            <label>Votre réponse</label>
            <textarea className="form-control" rows={5} value={response} onChange={e => setResponse(e.target.value)} placeholder="Réponse à l'étudiant..." />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>Fermer</button>
            <button className="btn btn-primary" onClick={handleRespond} disabled={submitting}>
              {submitting ? <><i className="fa-solid fa-spinner spin" /> Envoi...</> : <><i className="fa-solid fa-reply" /> Répondre</>}
            </button>
          </div>
        </Modal>
      )}

      {aiModal && (
        <Modal title="Analyse IA en cours" onClose={() => setAiModal(null)} maxWidth={440}>
          <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
            <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 16px' }}>
              <i className="fa-solid fa-robot" style={{ fontSize: 30, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)' }} />
              <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="var(--info)" strokeWidth="4"
                  strokeDasharray={2 * Math.PI * 28} strokeDashoffset={2 * Math.PI * 28 * (1 - Math.min(aiElapsed, 180) / 180)}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtElapsed(aiElapsed)}</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 16px' }}>
              Réclamation de <strong>{aiModal.studentName}</strong>
            </p>
            <p style={{ fontSize: 14, minHeight: 20 }}>
              {[...AI_STEPS].reverse().find(s => aiElapsed >= s.at)?.label}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
              Peut prendre jusqu'à 3 minutes selon la charge du modèle IA — vous pouvez fermer cette fenêtre, l'analyse continue en arrière-plan.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
