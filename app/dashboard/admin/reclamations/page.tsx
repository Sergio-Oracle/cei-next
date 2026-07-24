'use client'

import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { Reclamation, ReclamationStatus } from '@/types'

const AI_STEPS = [
  { at: 0,  label: 'Lecture de la réclamation et du barème…' },
  { at: 8,  label: 'Comparaison avec la correction originale…' },
  { at: 20, label: "Analyse en cours…" },
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
  const [respondStatus, setRespondStatus] = useState('')
  const [newScore, setNewScore] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actioning, setActioning] = useState<number | null>(null)
  const [aiModal, setAiModal] = useState<{ id: number; studentName: string } | null>(null)
  const [aiElapsed, setAiElapsed] = useState(0)
  const [aiResult, setAiResult] = useState<Reclamation | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { load() }, [])
  useEffect(() => () => { if (aiTimerRef.current) clearInterval(aiTimerRef.current) }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<Reclamation[]>('/api/reclamations')
      const list = Array.isArray(res) ? res : (res as any).reclamations ?? []
      setReclamations(list)
      return list
    } catch { error('Erreur de chargement'); return [] }
    finally { setLoading(false) }
  }

  function openRespond(r: Reclamation) {
    setSelected(r)
    setResponse(r.response ?? r.ia_proposed_reason ?? '')
    setRespondStatus(r.ia_proposed_status === 'resolved' ? 'resolved' : r.ia_proposed_status === 'rejected' ? 'rejected' : '')
    setNewScore(r.ia_proposed_score != null ? String(r.ia_proposed_score) : '')
  }

  async function handleRespond() {
    if (!selected) return
    if (!respondStatus) { error('Veuillez choisir une décision (accepter ou rejeter)'); return }
    if (!response.trim()) { error('La réponse est requise'); return }
    setSubmitting(true)
    try {
      const body: any = { response, status: respondStatus }
      if (respondStatus === 'resolved' && newScore.trim() !== '') body.new_score = parseFloat(newScore)
      await api.put(`/api/reclamations/${selected.id}`, body)
      success('Réponse envoyée')
      setSelected(null)
      setResponse(''); setRespondStatus(''); setNewScore('')
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
      const list = await load()
      const updated = list.find((r: Reclamation) => r.id === id)
      setAiModal(null)
      if (updated) setAiResult(updated)
      success('Analyse IA terminée')
    } catch (e: any) {
      error(e.message || 'Erreur analyse IA')
      setAiModal(null)
    } finally {
      setActioning(null)
      if (aiTimerRef.current) { clearInterval(aiTimerRef.current); aiTimerRef.current = null }
    }
  }

  const pending = reclamations.filter(r => r.status === 'pending' || r.status === 'in_review').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 10, color: 'var(--warning)' }} />Réclamations</h2>
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
              ) : reclamations.map(r => {
                const hasProposal = !!r.ia_proposed_status && r.status === 'pending'
                return (
                <tr key={r.id}>
                  <td>
                    {r.student_name ?? `Étudiant #${r.student_id}`}
                    {hasProposal && (
                      <div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600, marginTop: 2 }}>
                        <i className="fa-solid fa-lightbulb" /> Proposition IA disponible
                      </div>
                    )}
                  </td>
                  <td>{r.subject_title ?? '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => openRespond(r)} title="Répondre">
                        <i className="fa-solid fa-reply" />
                      </button>
                      {(r.status === 'pending' || r.status === 'in_review') && (
                        <button className="btn btn-sm btn-info" onClick={() => analyzeAI(r.id, r.student_name ?? `Étudiant #${r.student_id}`)} disabled={actioning === r.id} title="Analyser avec IA">
                          {actioning === r.id ? <i className="fa-solid fa-spinner spin" /> : <i className="fa-solid fa-wand-magic-sparkles" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
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

          {selected.ia_proposed_status && (
            <div className="alert alert-warning">
              <strong><i className="fa-solid fa-robot" /> Proposition IA :</strong>{' '}
              {selected.ia_proposed_status === 'resolved' ? '✅ Accepter' : '❌ Rejeter'}
              {selected.ia_proposed_score != null && ` — Note proposée : ${selected.ia_proposed_score}/20`}<br />
              {selected.ia_proposed_reason && <span style={{ fontSize: 13 }}>{selected.ia_proposed_reason}</span>}
              <div style={{ marginTop: 6, fontSize: 12, opacity: .8 }}>Pré-remplie ci-dessous — modifiez-la si vous n'êtes pas d'accord.</div>
            </div>
          )}

          <div className="form-group">
            <label>Décision *</label>
            <select className="form-control" value={respondStatus} onChange={e => setRespondStatus(e.target.value)}>
              <option value="">-- Choisir --</option>
              <option value="resolved">✅ Accepter la réclamation</option>
              <option value="rejected">❌ Rejeter la réclamation</option>
            </select>
          </div>
          {respondStatus === 'resolved' && (
            <div className="form-group">
              <label>Nouvelle note (sur 20)</label>
              {selected.attempt_score != null && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Note actuelle : {selected.attempt_score}/20</div>}
              <input className="form-control" type="number" min={0} max={20} step={0.5} value={newScore} onChange={e => setNewScore(e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label>Votre réponse *</label>
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

      {aiResult && (
        <Modal title="Résultat de l'analyse IA" onClose={() => setAiResult(null)} maxWidth={520}>
          {(() => {
            const accepted = aiResult.ia_proposed_status === 'resolved'
            const tint = accepted ? '#10b981' : '#ef4444'
            return <>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: accepted ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                }}>
                  <i className={`fa-solid ${accepted ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ fontSize: 28, color: tint }} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: tint }}>
                  {accepted ? 'Réclamation à accepter' : 'Réclamation à rejeter'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Proposition de l'IA — {aiResult.student_name ?? `Étudiant #${aiResult.student_id}`}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  <i className="fa-solid fa-comment-dots" style={{ marginRight: 6 }} />Justification
                </div>
                <div style={{ padding: 14, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto' }}>
                  {aiResult.ia_proposed_reason || 'Aucune justification fournie'}
                </div>
              </div>

              {accepted && aiResult.ia_proposed_score != null && (
                <div style={{ textAlign: 'center', padding: '14px 16px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Note proposée</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: tint, margin: '2px 0' }}>{aiResult.ia_proposed_score}/20</div>
                  {aiResult.attempt_score != null && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Note actuelle : {aiResult.attempt_score}/20</div>}
                </div>
              )}

              <div className="alert alert-warning" style={{ fontSize: 13, marginBottom: 0 }}>
                <i className="fa-solid fa-triangle-exclamation" />
                <span>Cette proposition est une aide à la décision — vous devez la valider ou la corriger via « Répondre ».</span>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                <button className="btn btn-secondary" onClick={() => setAiResult(null)}>Fermer</button>
                <button className="btn btn-primary" onClick={() => { openRespond(aiResult); setAiResult(null) }}>
                  <i className="fa-solid fa-reply" /> Répondre maintenant
                </button>
              </div>
            </>
          })()}
        </Modal>
      )}
    </div>
  )
}
