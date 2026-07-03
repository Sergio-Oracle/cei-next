'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam, ExamStatus } from '@/types'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; bar: string; icon: string }> = {
  draft:     { label: 'Brouillon', color: '#64748b', bg: '#f1f5f9', bar: '#cbd5e1', icon: 'fa-edit' },
  scheduled: { label: 'Planifié',  color: '#d97706', bg: '#fffbeb', bar: '#fcd34d', icon: 'fa-calendar-alt' },
  active:    { label: 'En cours',  color: '#059669', bg: '#ecfdf5', bar: '#34d399', icon: 'fa-play-circle' },
  closed:    { label: 'Terminé',   color: '#dc2626', bg: '#fff1f2', bar: '#fca5a5', icon: 'fa-check-circle' },
}

const LOCALE_OPTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' }

function fmtDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m} min`
}

function SecChip({ icon, label, color, bg }: { icon: string; label: string; color: string; bg: string }) {
  return (
    <span style={{ background: bg, color, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <i className={`fas ${icon}`} />{label}
    </span>
  )
}

/* ── Interfaces pour la modal surveillants ───────────────────────────────── */
interface ProctorInfo {
  proctor_id: number
  proctor_name: string
  proctor_email?: string
  student_count: number
}
interface ProctorData {
  proctors: ProctorInfo[]
  total_students: number
  unassigned_students: number
}
interface UserProctor {
  id: number
  full_name: string
}
interface AgentInfo {
  alive: boolean
  risk_alert?: number
  risk_urgent?: number
  last_check_ago_sec?: number | null
  exam?: { students?: number; alerts_sent?: number }
}

/* ── Modal Gestion Surveillants ──────────────────────────────────────────── */
function ProctorModal({ examId, onClose }: { examId: number; onClose: () => void }) {
  const { success, error } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData]       = useState<ProctorData | null>(null)
  const [users, setUsers]     = useState<UserProctor[]>([])
  const [agent, setAgent]     = useState<AgentInfo | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy]       = useState(false)

  useEffect(() => { loadData() }, []) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    try {
      const [pd, us] = await Promise.all([
        api.get<ProctorData>(`/api/online_exams/${examId}/proctors`),
        api.get<any>('/api/users/proctors').catch(() => []),
      ])
      setData(pd)
      setUsers(Array.isArray(us) ? us : (us as any)?.users ?? [])
      api.get<AgentInfo>(`/api/agent/status?exam_id=${examId}`).then(setAgent).catch(() => {})
    } catch { error('Erreur de chargement des surveillants') }
    finally { setLoading(false) }
  }

  async function addProctor() {
    if (!selectedId) { error('Veuillez sélectionner un surveillant'); return }
    setBusy(true)
    try {
      await api.post(`/api/online_exams/${examId}/proctors`, { proctor_id: parseInt(selectedId, 10) })
      success('Surveillant ajouté avec succès')
      setSelectedId('')
      await loadData()
    } catch (e: any) { error(e.message || 'Erreur lors de l\'ajout') }
    finally { setBusy(false) }
  }

  async function removeProctor(proctorId: number, name: string) {
    if (!confirm(`Retirer ${name} ? Ses affectations d'étudiants seront supprimées.`)) return
    setBusy(true)
    try {
      await api.delete(`/api/online_exams/${examId}/proctors/${proctorId}`)
      success('Surveillant retiré')
      await loadData()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setBusy(false) }
  }

  async function distribute() {
    if (!confirm('Répartir les étudiants entre les surveillants ? Les affectations existantes seront remplacées.')) return
    setBusy(true)
    try {
      const res = await api.post<any>(`/api/online_exams/${examId}/distribute_proctors`)
      if (res.success) {
        const parts = (res.distribution || []).map((p: any) => `${p.proctor_name} : ${p.student_count} étudiant(s)`)
        const modeNote = res.mode === 'pre_assignment' ? ' (pré-affectation, confirmée au démarrage)' : ''
        success(`${res.message}${modeNote}` + (parts.length ? ' — ' + parts.join(', ') : ''))
        await loadData()
      } else if (res.warning) {
        error(res.warning)
        await loadData()
      } else {
        let msg: string = res.error || 'Erreur lors de la répartition'
        if (msg.includes('Aucun surveillant')) msg = 'Ajoutez d\'abord au moins un surveillant avant de lancer la répartition.'
        error(msg)
      }
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setBusy(false) }
  }

  const assignedIds = (data?.proctors || []).map(p => p.proctor_id)
  const available   = users.filter(u => !assignedIds.includes(u.id))
  const proctors    = data?.proctors || []

  /* ── dernière vérif agent ── */
  let agentLastCheck = '—'
  if (agent && agent.last_check_ago_sec != null) {
    agentLastCheck = agent.last_check_ago_sec < 60
      ? `il y a ${agent.last_check_ago_sec}s`
      : `il y a ${Math.floor(agent.last_check_ago_sec / 60)}min`
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: '#fef3c7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-shield-alt" style={{ color: '#f59e0b', fontSize: 16 }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Gestion de la Surveillance</h2>
            {data && (
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                {data.total_students} étudiant(s) · {data.unassigned_students} non affecté(s)
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14 }}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: '#94a3b8' }} />
            </div>
          ) : (
            <>
              {/* Statut agent IA */}
              {agent && (
                <div style={{
                  background: agent.alive ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${agent.alive ? '#a7f3d0' : '#fecaca'}`,
                  borderRadius: 10, padding: '14px 16px', marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, background: agent.alive ? '#10b981' : '#ef4444', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Agent IA Autonome</span>
                      <span style={{
                        background: agent.alive ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                        color: agent.alive ? '#059669' : '#dc2626',
                        fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10,
                      }}>{agent.alive ? 'EN SERVICE' : 'HORS LIGNE'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Dernier cycle : {agentLastCheck}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                    {agent.alive
                      ? <>L'agent surveille <strong>tous les {agent.exam?.students ?? data?.total_students ?? '?'} étudiant(s)</strong> automatiquement.
                         Seuil alerte : <strong>{agent.risk_alert ?? 60}/100</strong> · Urgence : <strong>{agent.risk_urgent ?? 80}/100</strong>.
                         Alertes envoyées : <strong>{agent.exam?.alerts_sent ?? 0}</strong>.</>
                      : <>Le service <code>cei-agent-proctor</code> n'est pas actif.</>
                    }
                  </p>
                </div>
              )}

              {/* Ajouter un surveillant */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
                      Sélectionner un surveillant
                    </label>
                    <select
                      value={selectedId}
                      onChange={e => setSelectedId(e.target.value)}
                      disabled={busy}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: 'white' }}
                    >
                      <option value="">-- Sélectionner --</option>
                      {available.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={addProctor}
                    disabled={busy || !selectedId}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: busy ? '#94a3b8' : '#f59e0b', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {busy ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-plus" />} Ajouter
                  </button>
                </div>
                {available.length === 0 && users.length > 0 && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
                    <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
                    Tous les surveillants disponibles ont déjà été assignés.
                  </p>
                )}
              </div>

              {/* Tableau des surveillants assignés */}
              <div style={{ marginBottom: 16 }}>
                {proctors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
                    <i className="fas fa-eye-slash" style={{ display: 'block', fontSize: 28, marginBottom: 8 }} />
                    Aucun surveillant assigné à cet examen
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Surveillant</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Étudiants</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proctors.map(p => (
                        <tr key={p.proctor_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{p.proctor_name}</div>
                            {p.proctor_email && <div style={{ fontSize: 11, color: '#64748b' }}>{p.proctor_email}</div>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                            {p.student_count}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <button
                              onClick={() => removeProctor(p.proctor_id, p.proctor_name)}
                              disabled={busy}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#fff1f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}
                            >
                              <i className="fas fa-times" /> Retirer
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
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 2 }}>
                        <i className="fas fa-random" style={{ marginRight: 6 }} />Répartition automatique
                      </div>
                      <div style={{ fontSize: 12, color: '#047857' }}>
                        Distribue les étudiants équitablement entre les {proctors.length} surveillant(s) (ordre alphabétique)
                      </div>
                    </div>
                    <button
                      onClick={distribute}
                      disabled={busy}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: busy ? '#94a3b8' : '#059669', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {busy ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-random" />} Répartir maintenant
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Page principale ─────────────────────────────────────────────────────── */
export default function ProfessorExamsPage() {
  const { success, error } = useToast()
  const [exams, setExams]           = useState<OnlineExam[]>([])
  const [loading, setLoading]       = useState(true)
  const [actioning, setActioning]   = useState<number | null>(null)
  const [proctorModal, setProctorModal] = useState<number | null>(null)

  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<any>('/api/online_exams')
      setExams(Array.isArray(res) ? res : (res as any).exams ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function activate(id: number) {
    setActioning(id)
    try {
      await api.post(`/api/online_exams/${id}/activate`)
      success('Examen activé')
      setExams(prev => prev.map(e => e.id === id ? { ...e, status: 'active' as ExamStatus } : e))
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActioning(null) }
  }

  async function closeExam(id: number) {
    if (!confirm('Clôturer cet examen ?')) return
    setActioning(id)
    try {
      await api.post(`/api/online_exams/${id}/close`)
      success('Examen clôturé')
      setExams(prev => prev.map(e => e.id === id ? { ...e, status: 'closed' as ExamStatus } : e))
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActioning(null) }
  }

  async function extend(id: number) {
    const raw = prompt('Rallonger de combien de minutes ? (ex: 15)', '15')
    if (!raw) return
    const minutes = parseInt(raw, 10)
    if (isNaN(minutes) || minutes <= 0) { error('Nombre de minutes invalide'); return }
    setActioning(id)
    try {
      await api.post(`/api/online_exams/${id}/extend`, { minutes })
      success(`+${minutes} min ajoutées`)
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActioning(null) }
  }

  async function deleteExam(id: number, title: string) {
    if (!confirm(`Supprimer l'examen "${title}" ? Cette action est irréversible.`)) return
    setActioning(id)
    try {
      await api.delete(`/api/online_exams/${id}`)
      success('Examen supprimé')
      setExams(prev => prev.filter(e => e.id !== id))
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setActioning(null) }
  }

  const stats = {
    total:     exams.length,
    active:    exams.filter(e => e.status === 'active').length,
    scheduled: exams.filter(e => e.status === 'scheduled').length,
    closed:    exams.filter(e => e.status === 'closed').length,
  }

  return (
    <div>
      {/* Modal surveillants */}
      {proctorModal !== null && (
        <ProctorModal examId={proctorModal} onClose={() => setProctorModal(null)} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#3b82f6', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-laptop-code" style={{ color: 'white', fontSize: 18 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Examens en Ligne</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Créez et gérez des examens avec surveillance anti-triche</p>
          </div>
        </div>
        <Link href="/dashboard/professor/exams/new"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#3b82f6', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          <i className="fas fa-plus" /> Créer un Examen
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} />
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          {exams.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 28 }}>
              <MiniTile icon="fa-list"         label="Total"     value={stats.total}     color="#3b82f6" />
              <MiniTile icon="fa-play-circle"  label="En cours"  value={stats.active}    color="#10b981" />
              <MiniTile icon="fa-calendar-alt" label="Planifiés" value={stats.scheduled} color="#f59e0b" />
              <MiniTile icon="fa-check-circle" label="Terminés"  value={stats.closed}    color="#ef4444" />
            </div>
          )}

          {exams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <i className="fas fa-laptop-code" style={{ fontSize: 52, color: '#cbd5e1', display: 'block', marginBottom: 16 }} />
              <h3 style={{ color: '#475569', fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Aucun examen disponible</h3>
              <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 24px' }}>Créez votre premier examen en ligne avec surveillance intégrée.</p>
              <Link href="/dashboard/professor/exams/new"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: '#3b82f6', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                <i className="fas fa-plus" /> Créer un Examen
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {exams.map(exam => (
                <ExamCard key={exam.id} exam={exam} actioning={actioning}
                  onActivate={activate} onClose={closeExam} onExtend={extend}
                  onDelete={deleteExam} onProctors={setProctorModal} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Carte examen ─────────────────────────────────────────────────────────── */
function ExamCard({
  exam, actioning, onActivate, onClose, onExtend, onDelete, onProctors,
}: {
  exam: OnlineExam
  actioning: number | null
  onActivate: (id: number) => void
  onClose:    (id: number) => void
  onExtend:   (id: number) => void
  onDelete:   (id: number, title: string) => void
  onProctors: (id: number) => void
}) {
  const now   = new Date()
  const start = new Date(exam.start_time)
  const end   = new Date(exam.end_time)

  const effectiveStatus = exam.status === 'active' && now > end ? 'closed' : exam.status
  const sc = STATUS_CFG[effectiveStatus] ?? STATUS_CFG.draft
  const busy = actioning === exam.id

  const maxNF = exam.max_no_face_count ?? 10

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,.07)', transition: 'box-shadow .2s, transform .2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>

      {/* Barre colorée */}
      <div style={{ height: 4, background: sc.bar }} />

      <div style={{ padding: '18px 20px', flex: 1 }}>
        {/* Titre + badge statut */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.35, flex: 1 }}>{exam.title}</h3>
          <span style={{ background: sc.bg, color: sc.color, padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <i className={`fas ${sc.icon}`} /> {sc.label}
          </span>
        </div>

        {/* Sujet */}
        {exam.subject_title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
            <i className="fas fa-book" style={{ color: '#3b82f6', width: 13 }} />{exam.subject_title}
          </div>
        )}

        {/* Participants */}
        {(exam.attempts_count ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
            <i className="fas fa-users" style={{ width: 13 }} />{exam.attempts_count} participant(s)
          </div>
        )}

        {/* Dates + durée */}
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: 12, border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 12, marginBottom: 5 }}>
            <i className="fas fa-play" style={{ color: '#10b981', fontSize: 9 }} />
            <span style={{ flex: 1 }}>{start.toLocaleString('fr-FR', LOCALE_OPTS)}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="fas fa-clock" style={{ color: '#3b82f6', fontSize: 11 }} /> {fmtDuration(exam.duration_minutes)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 12 }}>
            <i className="fas fa-stop" style={{ color: '#ef4444', fontSize: 9 }} />{end.toLocaleString('fr-FR', LOCALE_OPTS)}
          </div>
        </div>

        {/* Chips sécurité */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <SecChip icon="fa-exchange-alt" label={`${exam.max_tab_switches ?? 2} chgt${(exam.max_tab_switches ?? 2) !== 1 ? 's' : ''}`} color="#c2410c" bg="#fff7ed" />
          {maxNF >= 0 && <SecChip icon="fa-eye-slash" label={`${maxNF} visage${maxNF !== 1 ? 's' : ''}`} color="#ef4444" bg="#fef2f2" />}
          {exam.ban_on_devtools      && <SecChip icon="fa-terminal"  label="Dev ban"    color="#1d4ed8" bg="#eff6ff" />}
          {!exam.enable_copy_paste   && <SecChip icon="fa-ban"       label="C/C"         color="#64748b" bg="#f1f5f9" />}
          {!exam.enable_right_click  && <SecChip icon="fa-ban"       label="Clic droit"  color="#64748b" bg="#f1f5f9" />}
          {exam.auto_correct         && <SecChip icon="fa-robot"     label="IA auto"     color="#15803d" bg="#f0fdf4" />}
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: '#fafafa', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Détails — always */}
        <Link href={`/dashboard/professor/exams/${exam.id}`} style={btn('#f1f5f9', '#475569')}>
          <i className="fas fa-eye" /> Détails
        </Link>

        {/* Surveillants — if not closed */}
        {exam.status !== 'closed' && (
          <button onClick={() => onProctors(exam.id)} style={btn('rgba(245,158,11,.1)', '#d97706')} disabled={busy}>
            <i className="fas fa-user-shield" /> Surveillants
          </button>
        )}

        {/* Actions active */}
        {exam.status === 'active' && (
          <>
            <Link href={`/proctor/monitor/${exam.id}`} style={btn('rgba(124,58,237,.1)', '#1d4ed8')}>
              <i className="fas fa-shield-alt" /> Surveiller
            </Link>
            <button onClick={() => onExtend(exam.id)} disabled={busy} style={btn('rgba(16,185,129,.1)', '#059669')}>
              {busy ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-clock" />} Rallonger
            </button>
            <button onClick={() => onClose(exam.id)} disabled={busy} style={btn('rgba(239,68,68,.15)', '#ef4444')}>
              {busy ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-stop-circle" />} Clôturer
            </button>
          </>
        )}

        {/* Actions scheduled / draft */}
        {(exam.status === 'scheduled' || exam.status === 'draft') && (
          <>
            <button onClick={() => onActivate(exam.id)} disabled={busy} style={btn('rgba(16,185,129,.15)', '#059669')}>
              {busy ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-play-circle" />} Activer
            </button>
            <button onClick={() => onExtend(exam.id)} disabled={busy} style={btn('rgba(16,185,129,.1)', '#059669')}>
              {busy ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-clock" />} Rallonger
            </button>
            <Link href={`/dashboard/professor/exams/${exam.id}`} style={btn('rgba(59,130,246,.1)', '#3b82f6')}>
              <i className="fas fa-pencil-alt" /> Éditer
            </Link>
          </>
        )}

        {/* Supprimer — always */}
        <button onClick={() => onDelete(exam.id, exam.title)} disabled={busy}
          style={{ ...btn('rgba(239,68,68,.08)', '#ef4444'), marginLeft: 'auto', flex: '0 0 auto' }}>
          <i className="fas fa-trash" />
        </button>
      </div>
    </div>
  )
}

function btn(bg: string, color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '6px 11px', background: bg, color, border: 'none', borderRadius: 7, cursor: 'pointer', textDecoration: 'none', fontWeight: 600 }
}

function MiniTile({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, background: `${color}15`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fas ${icon}`} style={{ color, fontSize: 16 }} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}
