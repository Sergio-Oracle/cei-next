'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface EventSummary {
  event: string
  count: number
}

interface HighRiskAttempt {
  attempt_id: number
  student_name: string
  exam_title: string
  risk_score: number
  warnings_count: number
  tab_switches: number
  no_face_count: number
  status: string
  ban_reason?: string
}

interface SecurityReport {
  event_summary: EventSummary[]
  high_risk: HighRiskAttempt[]
  banned_count: number
}

const EVT_ICONS: Record<string, string> = {
  no_face_detected: 'fa-eye-slash',
  window_blur: 'fa-window-restore',
  tab_switch: 'fa-exchange-alt',
  copy_attempt: 'fa-copy',
  paste_attempt: 'fa-paste',
  right_click: 'fa-mouse-pointer',
  multiple_faces: 'fa-users',
  face_reference_captured: 'fa-camera',
  screen_share_stopped: 'fa-desktop',
  student_message: 'fa-comment',
  devtools_attempt: 'fa-code',
  face_absent: 'fa-user-slash',
  fullscreen_exit: 'fa-compress',
  fullscreen_enter: 'fa-expand',
  warning_issued: 'fa-exclamation-triangle',
}

const EVT_LABELS: Record<string, string> = {
  no_face_detected: 'Visage non détecté',
  window_blur: 'Changement de fenêtre',
  tab_switch: "Changement d'onglet",
  copy_attempt: 'Tentative de copie',
  paste_attempt: 'Tentative de collage',
  right_click: 'Clic droit détecté',
  multiple_faces: 'Plusieurs visages détectés',
  face_reference_captured: 'Photo de référence capturée',
  screen_share_stopped: "Partage d'écran arrêté",
  student_message: 'Message étudiant',
  devtools_attempt: 'Console développeur ouverte',
  face_absent: 'Visage absent',
  fullscreen_exit: 'Plein écran quitté',
  fullscreen_enter: 'Plein écran activé',
  warning_issued: 'Avertissement émis',
}

const EVT_RISK_COLOR: Record<string, string> = {
  no_face_detected: '#f59e0b',
  tab_switch: '#ef4444',
  window_blur: '#f97316',
  copy_attempt: '#ef4444',
  paste_attempt: '#ef4444',
  multiple_faces: '#dc2626',
}

function riskColor(score: number) {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f59e0b'
  return '#10b981'
}

export default function AdminSecurityPage() {
  const { success, error } = useToast()
  const [report, setReport] = useState<SecurityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [facePhoto, setFacePhoto] = useState<{ attemptId: number; url: string } | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<SecurityReport>('/api/admin/security_report')
      setReport(res)
    } catch { error('Erreur chargement rapport de sécurité') }
    finally { setLoading(false) }
  }

  async function viewFacePhoto(attemptId: number) {
    try {
      const blob = await api.blob(`/api/exam_attempts/${attemptId}/face_reference`)
      const url = URL.createObjectURL(blob)
      setFacePhoto({ attemptId, url })
    } catch { error('Photo de référence non disponible') }
  }

  const totalIncidents = (report?.event_summary ?? []).reduce((a, e) => a + e.count, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-shield-alt" style={{ marginRight: 10, color: 'var(--danger)' }} />Rapport de sécurité</h2>
          <p>Incidents et comportements suspects lors des examens en ligne</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <i className="fas fa-rotate" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} />
        </div>
      ) : !report ? (
        <div className="alert alert-error">Impossible de charger le rapport de sécurité.</div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
            <div className="stat-card" style={{ textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{report.banned_count || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                <i className="fas fa-ban" /> Étudiants bannis
              </div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{report.high_risk?.length || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                <i className="fas fa-exclamation-triangle" /> À haut risque (score ≥ 70)
              </div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center', borderLeft: '4px solid #2563eb' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb' }}>{totalIncidents}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                <i className="fas fa-list" /> Incidents totaux
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, alignItems: 'start' }}>
            {/* Types d'incidents */}
            <div className="card">
              <div className="card-header">
                <h3 style={{ margin: 0 }}><i className="fas fa-chart-bar" /> Types d'incidents</h3>
              </div>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Événement</th>
                      <th>Nb</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.event_summary.length === 0 ? (
                      <tr><td colSpan={2} className="empty-message">Aucun incident</td></tr>
                    ) : report.event_summary.map(e => (
                      <tr key={e.event}>
                        <td style={{ fontSize: 13 }}>
                          <i className={`fas ${EVT_ICONS[e.event] || 'fa-circle'}`}
                            style={{ color: EVT_RISK_COLOR[e.event] || '#94a3b8', marginRight: 8 }} />
                          {EVT_LABELS[e.event] || e.event}
                        </td>
                        <td style={{ fontWeight: 700, fontSize: 13 }}>{e.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Haut risque */}
            <div className="card">
              <div className="card-header">
                <h3 style={{ margin: 0 }}><i className="fas fa-user-shield" /> Tentatives à haut risque (score ≥ 70)</h3>
              </div>
              {!report.high_risk?.length ? (
                <p className="empty-message">Aucune tentative à haut risque</p>
              ) : (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Étudiant</th>
                        <th>Examen</th>
                        <th style={{ textAlign: 'center' }}>Score</th>
                        <th style={{ textAlign: 'center' }}>Avert.</th>
                        <th style={{ textAlign: 'center' }}>Onglets</th>
                        <th style={{ textAlign: 'center' }}>Sans visage</th>
                        <th>Statut</th>
                        <th style={{ textAlign: 'center' }}>Photo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.high_risk.map(a => {
                        const statusColor = a.status === 'banned' ? '#ef4444' : '#f59e0b'
                        return (
                          <tr key={a.attempt_id}>
                            <td style={{ fontSize: 13 }}>{a.student_name}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.exam_title}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: 800, color: riskColor(a.risk_score), fontSize: 14 }}>{a.risk_score}</span>
                            </td>
                            <td style={{ textAlign: 'center', fontSize: 12 }}>{a.warnings_count}</td>
                            <td style={{ textAlign: 'center', fontSize: 12 }}>{a.tab_switches}</td>
                            <td style={{ textAlign: 'center', fontSize: 12 }}>{a.no_face_count}</td>
                            <td>
                              <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: `${statusColor}18`, padding: '3px 8px', borderRadius: 99 }}>
                                {a.status === 'banned' ? 'Banni' : a.status}
                              </span>
                              {a.ban_reason && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{a.ban_reason}</div>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button onClick={() => viewFacePhoto(a.attempt_id)}
                                style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                                <i className="fas fa-camera" /> Photo
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Interprétation */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '16px 18px', marginTop: 16, fontSize: 13, color: '#0369a1', lineHeight: 1.7 }}>
            <strong><i className="fas fa-circle-info" /> Interprétation du score de risque :</strong><br />
            Le score est calculé à partir du nombre d'avertissements, de changements d'onglet, de détections sans visage et d'autres incidents.{' '}
            <strong>0–30 : Normal · 30–70 : Attention · 70–100 : Risque élevé</strong>
          </div>
        </>
      )}

      {/* Modal photo référence */}
      {facePhoto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { URL.revokeObjectURL(facePhoto.url); setFacePhoto(null) }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, maxWidth: 420, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}><i className="fas fa-camera" style={{ marginRight: 8 }} />Photo de référence</h3>
              <button onClick={() => { URL.revokeObjectURL(facePhoto.url); setFacePhoto(null) }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <img src={facePhoto.url} alt="Face reference" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>Tentative #{facePhoto.attemptId}</p>
          </div>
        </div>
      )}
    </div>
  )
}
