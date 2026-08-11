'use client'

import { useEffect, useState, useRef } from 'react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import AnswerCallModal from '@/components/exam/AnswerCallModal'
import SupervisorCallModal from '@/components/exam/SupervisorCallModal'

interface CallRequest {
  attempt_id: number
  exam_id: number
  exam_title: string
  student_name: string
  timestamp: string
}

type ProctorStatus = 'engaged' | 'idle' | 'disconnected'

interface ProctorSignals {
  engaged: boolean
  viewed?: boolean
  face?: boolean
}

interface Member {
  id: number | null
  full_name: string | null
  email: string | null
  is_active_now: boolean
  status: ProctorStatus
  vigilance_level: 'A' | 'B' | 'C'
  signals: ProctorSignals | null
}

// Explique le badge "Présent, inactif" en désignant le signal manquant —
// notamment la caméra du palier C, qui dégrade silencieusement côté
// surveillant (permission refusée/jamais accordée) sans que rien ne le
// signale ailleurs que sur sa propre page de monitoring.
function missingSignalLabel(signals: ProctorSignals | null): string | null {
  if (!signals) return null
  if (signals.face === false) return 'Caméra de vérification non détectée (palier C)'
  if (signals.viewed === false) return "N'a pas encore consulté un étudiant"
  if (signals.engaged === false) return 'Aucune interaction récente (souris/clavier)'
  return null
}

interface Group {
  id: number
  name: string
  vigilance_level: 'A' | 'B' | 'C'
  members: Member[]
}

const STATUS_META: Record<ProctorStatus, { label: string; color: string; bg: string; dot: string }> = {
  engaged:      { label: 'Actif et engagé',   color: '#10b981', bg: '#f0fdf4', dot: '#10b981' },
  idle:         { label: 'Présent, inactif',  color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
  disconnected: { label: 'Déconnecté',        color: '#94a3b8', bg: '#f1f5f9', dot: '#94a3b8' },
}

interface DashboardData {
  groups: Group[]
  total_groups: number
  total_surveillants: number
  active_surveillants: number
}

export default function SuperviseurDashboard() {
  const { user } = useAuth()
  const { error } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [callRequests, setCallRequests] = useState<CallRequest[]>([])
  const [activeCall, setActiveCall] = useState<CallRequest | null>(null)
  const [proctorCall, setProctorCall] = useState<{ id: number; name: string } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const callPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    load()
    loadCallRequests()
    pollRef.current = setInterval(load, 30_000)
    callPollRef.current = setInterval(loadCallRequests, 15_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (callPollRef.current) clearInterval(callPollRef.current)
    }
  }, []) // eslint-disable-line

  async function load() {
    try {
      const res = await api.get<DashboardData>('/api/superviseur/dashboard')
      setData(res)
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function loadCallRequests() {
    try {
      const res = await api.get<{ requests: CallRequest[] }>('/api/superviseur/call_requests')
      setCallRequests(res.requests || [])
    } catch {}
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#0891b2', width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-user-shield" style={{ color: 'white', fontSize: 20 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Tableau de bord Superviseur</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Bienvenue, <strong>{user?.full_name}</strong></p>
          </div>
        </div>
        <button onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#f1f5f9', color: '#475569', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <i className="fas fa-sync-alt" /> Actualiser
        </button>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatTile icon="fa-layer-group" label="Groupes supervisés" value={data?.total_groups ?? 0} color="#0891b2" />
        <StatTile icon="fa-eye" label="Surveillants" value={data?.total_surveillants ?? 0} color="#f59e0b" />
        <StatTile icon="fa-circle-check" label="Actifs maintenant" value={data?.active_surveillants ?? 0} color="#10b981" />
      </div>

      {/* Demandes d'appel — uniquement celles où aucun surveillant n'est
          assigné à l'étudiant (sinon c'est au surveillant de répondre) */}
      {callRequests.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fbbf24', borderRadius: 16, padding: '16px 20px', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-phone-volume" style={{ animation: 'pulse 1.5s infinite' }} />
            Demande(s) d'appel — reprise après déconnexion
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {callRequests.map(r => (
              <div key={r.attempt_id} style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{r.student_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{r.exam_title} — {new Date(r.timestamp).toLocaleTimeString('fr-FR')}</div>
                </div>
                <button onClick={() => setActiveCall(r)} style={{ fontSize: 12, fontWeight: 700, color: 'white', background: '#d97706', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-phone" /> Répondre à l'appel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeCall && (
        <AnswerCallModal
          attemptId={activeCall.attempt_id}
          examTitle={activeCall.exam_title}
          studentName={activeCall.student_name}
          onClose={() => { setActiveCall(null); loadCallRequests() }}
        />
      )}

      {proctorCall && (
        <SupervisorCallModal
          proctorId={proctorCall.id}
          proctorName={proctorCall.name}
          onClose={() => setProctorCall(null)}
        />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} />
        </div>
      ) : !data || data.groups.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', textAlign: 'center', padding: '64px 24px' }}>
          <i className="fas fa-user-shield" style={{ fontSize: 52, color: '#cbd5e1', display: 'block', marginBottom: 16 }} />
          <h3 style={{ color: '#475569', fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Aucun groupe assigné</h3>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Un administrateur doit vous rattacher à un ou plusieurs groupes de surveillants.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {data.groups.map(group => (
            <div key={group.id} style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <i className="fas fa-layer-group" style={{ color: '#0891b2' }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{group.name}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— {group.members.length} surveillant(s)</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#f1f5f9', color: '#475569' }}>
                  <i className="fas fa-shield-halved" style={{ marginRight: 5 }} />Vigilance {group.vigilance_level}
                </span>
              </div>
              {group.members.length === 0 ? (
                <div style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
                  <i className="fas fa-info-circle" style={{ marginRight: 8 }} />
                  Aucun surveillant dans ce groupe.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '8px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>Surveillant</th>
                        <th style={{ padding: '8px 24px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>Statut</th>
                        <th style={{ padding: '8px 24px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.members.map(m => (
                        <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 24px' }}>
                            <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{m.full_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.email}</div>
                          </td>
                          <td style={{ padding: '10px 24px', textAlign: 'right' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: STATUS_META[m.status].bg, color: STATUS_META[m.status].color }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_META[m.status].dot, display: 'inline-block' }} />
                              {STATUS_META[m.status].label}
                            </span>
                            {m.status === 'idle' && missingSignalLabel(m.signals) && (
                              <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>
                                <i className="fas fa-circle-info" style={{ marginRight: 4 }} />
                                {missingSignalLabel(m.signals)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 24px', textAlign: 'right' }}>
                            {m.id != null && m.full_name && (
                              <button onClick={() => setProctorCall({ id: m.id as number, name: m.full_name as string })}
                                title="Appeler ce surveillant"
                                style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                <i className="fas fa-phone-volume" /> Appeler
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatTile({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: `2px solid ${color}22`, borderRadius: 14, padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, background: `${color}15`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fas ${icon}`} style={{ color, fontSize: 18 }} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  )
}
