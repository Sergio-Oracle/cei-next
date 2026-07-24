'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'

interface OnlineResult {
  attempt_id: number
  exam_id: number
  exam_title: string
  subject_title?: string
  score: number | null
  feedback?: string
  corrected_at?: string
  submitted_at?: string
  auto_correct?: boolean
  has_reclamation?: boolean
  reclamation_status?: string
}

export default function StudentResultsPage() {
  const { success, error } = useToast()
  const [results, setResults] = useState<OnlineResult[]>([])
  const [loading, setLoading] = useState(true)
  const [viewItem, setViewItem] = useState<OnlineResult | null>(null)
  const [showReclamation, setShowReclamation] = useState(false)
  const [reclamationText, setReclamationText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<OnlineResult[]>('/api/student/online_results')
      setResults(Array.isArray(res) ? res : (res as any).results ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function submitReclamation(item: OnlineResult) {
    if (!reclamationText.trim()) { error('Veuillez décrire votre réclamation'); return }
    setSubmitting(true)
    try {
      await api.post('/api/reclamations', {
        attempt_id: item.attempt_id,
        reason: reclamationText,
      })
      success('Réclamation soumise')
      setShowReclamation(false)
      setReclamationText('')
      setViewItem(null)
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  function statusInfo(r: OnlineResult) {
    if (r.score == null) return { label: 'En correction', cls: 'warning' }
    if ((r.score ?? 0) >= 10) return { label: 'Admis', cls: 'success' }
    return { label: 'Ajourné', cls: 'danger' }
  }

  const RECLAMATION_LABELS: Record<string, string> = {
    pending: 'En attente', in_review: 'En cours d\'examen', resolved: 'Résolue', rejected: 'Rejetée',
  }

  const scoredResults = results.filter(r => r.score != null)
  const avgScore = scoredResults.length > 0
    ? scoredResults.reduce((s, r) => s + (r.score ?? 0), 0) / scoredResults.length
    : null

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-chart-line" style={{ marginRight: 10, color: 'var(--primary)' }} />Mes résultats</h2>
          <p>Historique de vos examens corrigés</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card" style={{ borderColor: '#3b82f6' }}>
          <div className="stat-label"><i className="fa-solid fa-clipboard-check" style={{ color: '#3b82f6' }} /> Évaluations</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{results.length}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#10b981' }}>
          <div className="stat-label"><i className="fa-solid fa-star" style={{ color: '#10b981' }} /> Moyenne générale</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{avgScore != null ? `${avgScore.toFixed(1)}/20` : '—'}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#3b82f6' }}>
          <div className="stat-label"><i className="fa-solid fa-trophy" style={{ color: '#3b82f6' }} /> Admis</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{scoredResults.filter(r => (r.score ?? 0) >= 10).length}</div>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Examen</th>
                <th>Matière</th>
                <th>Score</th>
                <th>Feedback</th>
                <th>Statut</th>
                <th>Date correction</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner spin" /> Chargement...</td></tr>
              ) : results.length === 0 ? (
                <tr><td colSpan={7} className="empty-message">Aucun résultat disponible</td></tr>
              ) : results.map(r => {
                const si = statusInfo(r)
                return (
                  <tr key={r.attempt_id}>
                    <td><div style={{ fontWeight: 600 }}>{r.exam_title}</div></td>
                    <td><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{r.subject_title ?? '—'}</span></td>
                    <td>
                      {r.score != null
                        ? <strong style={{ fontSize: 16, color: (r.score ?? 0) >= 10 ? 'var(--success)' : 'var(--danger)' }}>{r.score}/20</strong>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>
                    <td>
                      {r.feedback
                        ? <button className="btn btn-sm btn-secondary" onClick={() => setViewItem(r)}>
                            <i className="fa-solid fa-comment-dots" /> Voir
                          </button>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>
                    <td><span className={`status-badge ${si.cls}`}>{si.label}</span></td>
                    <td>{r.corrected_at ? new Date(r.corrected_at).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => setViewItem(r)} title="Voir détails">
                          <i className="fa-solid fa-eye" />
                        </button>
                        {!r.has_reclamation && r.score != null && (
                          <button className="btn btn-sm btn-warning" onClick={() => { setViewItem(r); setShowReclamation(true) }} title="Faire une réclamation">
                            <i className="fa-solid fa-triangle-exclamation" />
                          </button>
                        )}
                        {r.has_reclamation && (
                          <span className={`status-badge ${r.reclamation_status === 'resolved' ? 'success' : r.reclamation_status === 'rejected' ? 'danger' : 'warning'}`} style={{ fontSize: 11 }}>
                            {RECLAMATION_LABELS[r.reclamation_status ?? ''] ?? r.reclamation_status}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Détail résultat */}
      {viewItem && !showReclamation && (
        <Modal title={viewItem.exam_title} onClose={() => setViewItem(null)} maxWidth={700}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
            <div><strong>Matière :</strong> {viewItem.subject_title ?? '—'}</div>
            <div>
              <strong>Score :</strong>{' '}
              {viewItem.score != null
                ? <strong style={{ color: (viewItem.score ?? 0) >= 10 ? 'var(--success)' : 'var(--danger)' }}>{viewItem.score}/20</strong>
                : <span className="status-badge warning">En correction</span>
              }
            </div>
          </div>
          {viewItem.corrected_at && (
            <div style={{ marginBottom: 16 }}>
              <strong>Corrigé le :</strong> {new Date(viewItem.corrected_at).toLocaleString('fr-FR')}
            </div>
          )}
          {viewItem.auto_correct && (
            <div className="alert alert-info" style={{ marginBottom: 12 }}>
              <i className="fa-solid fa-robot" /> Correction automatique par IA
            </div>
          )}
          {viewItem.feedback && (
            <div className="form-group">
              <label>Feedback du correcteur</label>
              <div style={{ padding: 12, background: 'var(--background)', borderRadius: 'var(--radius)', fontSize: 14, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                {viewItem.feedback}
              </div>
            </div>
          )}
          {!viewItem.has_reclamation && viewItem.score != null && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-warning" onClick={() => setShowReclamation(true)}>
                <i className="fa-solid fa-triangle-exclamation" /> Faire une réclamation
              </button>
            </div>
          )}
          {viewItem.has_reclamation && (
            <div className="alert alert-info" style={{ marginTop: 12 }}>
              <i className="fa-solid fa-circle-check" /> Réclamation déjà soumise — statut : <strong>{RECLAMATION_LABELS[viewItem.reclamation_status ?? ''] ?? viewItem.reclamation_status}</strong>
            </div>
          )}
        </Modal>
      )}

      {/* Formulaire réclamation */}
      {viewItem && showReclamation && (
        <Modal title="Faire une réclamation" onClose={() => { setShowReclamation(false); setReclamationText('') }} maxWidth={600}>
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            <i className="fa-solid fa-circle-info" /> Réclamation pour : <strong>{viewItem.exam_title}</strong>
            {viewItem.score != null && <> (Note : {viewItem.score}/20)</>}
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
            <button className="btn btn-secondary" onClick={() => { setShowReclamation(false); setReclamationText('') }}>Annuler</button>
            <button className="btn btn-warning" onClick={() => submitReclamation(viewItem)} disabled={submitting}>
              {submitting ? <><i className="fa-solid fa-spinner spin" /> Envoi...</> : <><i className="fa-solid fa-paper-plane" /> Soumettre</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
