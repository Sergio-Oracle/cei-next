'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { User } from '@/types'

interface ProctorEntry {
  id: number
  exam_id: number
  proctor_id: number
  proctor_name: string
  proctor_email?: string
  student_count?: number
}

interface AgentStatus {
  alive: boolean
  status: string
  status_label: string
  status_color: string
  last_check_ago_sec?: number | null
  risk_alert?: number
  risk_urgent?: number
  exam?: { students?: number; alerts_sent?: number; banned?: number }
}

interface Props {
  examId: number
  onClose: () => void
}

export default function ProctorsManageModal({ examId, onClose }: Props) {
  const { success, error } = useToast()
  const [loading, setLoading] = useState(true)
  const [proctors, setProctors] = useState<ProctorEntry[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [unassigned, setUnassigned] = useState(0)
  const [available, setAvailable] = useState<User[]>([])
  const [selected, setSelected] = useState('')
  const [agent, setAgent] = useState<AgentStatus | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)
  const [distributing, setDistributing] = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const [proctorsRes, usersRes] = await Promise.all([
        api.get<any>(`/api/online_exams/${examId}/proctors`),
        api.get<any>('/api/users/proctors').catch(() => []),
      ])
      const list: ProctorEntry[] = proctorsRes.proctors ?? []
      setProctors(list)
      setTotalStudents(proctorsRes.total_students ?? 0)
      setUnassigned(proctorsRes.unassigned_students ?? 0)

      const allUsers: User[] = Array.isArray(usersRes) ? usersRes : (usersRes.users ?? [])
      const assignedIds = list.map(p => p.proctor_id)
      setAvailable(allUsers.filter(u => !assignedIds.includes(u.id)))

      api.get<AgentStatus>(`/api/agent/status?exam_id=${examId}`).then(setAgent).catch(() => setAgent(null))
    } catch { error('Erreur de chargement des surveillants') }
    finally { setLoading(false) }
  }

  async function addProctor() {
    const proctorId = Number(selected)
    if (!proctorId) { error('Sélectionnez un surveillant'); return }
    setAdding(true)
    try {
      await api.post(`/api/online_exams/${examId}/proctors`, { proctor_id: proctorId })
      success('Surveillant ajouté avec succès')
      setSelected('')
      await load()
    } catch (e: any) { error(e.message || 'Erreur lors de l\'ajout') }
    finally { setAdding(false) }
  }

  async function removeProctor(proctorId: number) {
    if (!confirm('Retirer ce surveillant ? Ses affectations d\'étudiants seront supprimées.')) return
    setRemoving(proctorId)
    try {
      await api.delete(`/api/online_exams/${examId}/proctors/${proctorId}`)
      success('Surveillant retiré')
      await load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setRemoving(null) }
  }

  async function distribute() {
    if (!confirm('Répartir les étudiants entre les surveillants ? Les affectations existantes seront remplacées.')) return
    setDistributing(true)
    try {
      const res = await api.post<any>(`/api/online_exams/${examId}/distribute_proctors`, {})
      if (res.warning) { error(res.warning) }
      else { success(res.message || 'Répartition effectuée') }
      await load()
    } catch (e: any) {
      let msg = e.message || 'Erreur lors de la répartition'
      if (msg.includes('Aucun surveillant')) msg = 'Ajoutez d\'abord au moins un surveillant à cet examen avant de lancer la répartition.'
      error(msg)
    } finally { setDistributing(false) }
  }

  const lastCheckLabel = agent?.last_check_ago_sec != null
    ? (agent.last_check_ago_sec < 60 ? `il y a ${agent.last_check_ago_sec}s` : `il y a ${Math.floor(agent.last_check_ago_sec / 60)}min`)
    : '—'

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, background: '#fef3c7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fas fa-shield-alt" style={{ color: '#f59e0b', fontSize: 16 }} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Gestion de la Surveillance</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{totalStudents} étudiant(s) · {unassigned} non affecté(s)</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 22 }} />
            </div>
          ) : (
            <>
              {/* Agent IA Autonome */}
              {agent && (
                <div style={{
                  background: agent.alive ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${agent.alive ? '#a7f3d0' : '#fecaca'}`,
                  borderRadius: 10, padding: '14px 16px', marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, background: agent.alive ? '#10b981' : '#ef4444', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}><i className="fas fa-robot" style={{ marginRight: 6 }} />Agent IA Autonome</span>
                      <span style={{ background: agent.alive ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', color: agent.alive ? '#059669' : '#dc2626', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10 }}>
                        {agent.alive ? 'EN SERVICE' : 'HORS LIGNE'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dernier cycle : {lastCheckLabel}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                    {agent.alive
                      ? <>L'agent surveille <strong>tous les {agent.exam?.students ?? totalStudents ?? '?'} étudiant(s)</strong> automatiquement.
                        {' '}Seuil d'alerte : risque <strong>≥ {agent.risk_alert ?? 60}/100</strong> · Urgence : <strong>≥ {agent.risk_urgent ?? 80}/100</strong>.
                        {' '}Alertes envoyées cette session : <strong>{agent.exam?.alerts_sent ?? 0}</strong>.</>
                      : <>Le service de surveillance IA n'est pas actif.</>
                    }
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                    <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
                    L'agent est <strong>attribué automatiquement</strong> à tous les examens actifs — aucune action requise.
                    Il analyse les comportements et envoie des alertes aux surveillants et à l'enseignant en cas d'anomalie.
                  </p>
                </div>
              )}

              {/* Ajouter un surveillant */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Sélectionner un surveillant</label>
                    <select value={selected} onChange={e => setSelected(e.target.value)} className="form-control" style={{ fontSize: 13 }}>
                      <option value="">-- Sélectionner --</option>
                      {available.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </div>
                  <button onClick={addProctor} disabled={adding}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: adding ? '#fcd34d' : '#f59e0b', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                    {adding ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-plus" />} Ajouter
                  </button>
                </div>
              </div>

              {/* Liste des surveillants affectés */}
              <div style={{ marginBottom: 16 }}>
                {proctors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                    <i className="fas fa-eye-slash" style={{ display: 'block', fontSize: 28, marginBottom: 8 }} />
                    Aucun surveillant assigné à cet examen
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <thead><tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Surveillant</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Étudiants</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                    </tr></thead>
                    <tbody>
                      {proctors.map(p => (
                        <tr key={p.proctor_id}>
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.proctor_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.proctor_email || ''}</div>
                          </td>
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>{p.student_count || 0}</td>
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                            <button onClick={() => removeProctor(p.proctor_id)} disabled={removing === p.proctor_id}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#fff1f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: removing === p.proctor_id ? 'not-allowed' : 'pointer' }}>
                              {removing === p.proctor_id ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-times" />} Retirer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Répartition automatique */}
              {proctors.length > 0 && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 2 }}><i className="fas fa-random" style={{ marginRight: 6 }} />Répartition automatique</div>
                      <div style={{ fontSize: 12, color: '#047857' }}>Distribue les étudiants équitablement entre les {proctors.length} surveillant(s) (ordre alphabétique)</div>
                    </div>
                    <button onClick={distribute} disabled={distributing}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: distributing ? '#6ee7b7' : '#059669', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: distributing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                      {distributing ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-random" />} Répartir maintenant
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
