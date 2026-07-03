'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface Incident {
  id: number
  event_type: string
  exam_title: string
  student_name: string
  severity: 'high' | 'medium' | 'low'
  timestamp: string
}

interface IncidentsResponse {
  incidents: Incident[]
  unread_count: number
}

const EVENT_LABELS: Record<string, string> = {
  tab_switch:              'Changement d\'onglet',
  window_blur:             'Changement de fenêtre',
  copy_attempt:            'Tentative de copie',
  paste_attempt:           'Tentative de collage',
  right_click:             'Clic droit détecté',
  devtools_attempt:        'Console développeur ouverte',
  face_absent:             'Visage absent',
  no_face_detected:        'Visage non détecté',
  multiple_faces:          'Plusieurs visages détectés',
  face_reference_captured: 'Photo de référence capturée',
  screen_share_stopped:    'Partage d\'écran arrêté',
  student_message:         'Message étudiant',
  fullscreen_exit:         'Plein écran quitté',
  fullscreen_enter:        'Plein écran activé',
  warning_issued:          'Avertissement émis',
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)   return 'À l\'instant'
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} minute${Math.floor(diff / 60) > 1 ? 's' : ''}`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} heure${Math.floor(diff / 3600) > 1 ? 's' : ''}`
  return `Il y a ${Math.floor(diff / 86400)} jour${Math.floor(diff / 86400) > 1 ? 's' : ''}`
}

export default function ProfessorNotificationsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'high' | 'medium'>('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<IncidentsResponse>('/api/professor/recent_incidents')
      setIncidents(res.incidents ?? [])
      setUnreadCount(res.unread_count ?? 0)
    } catch { setIncidents([]) }
    finally { setLoading(false) }
  }

  const visible = incidents.filter(inc => {
    if (filterSeverity === 'all') return true
    return inc.severity === filterSeverity
  })

  const highCount   = incidents.filter(i => i.severity === 'high').length
  const mediumCount = incidents.filter(i => i.severity === 'medium').length

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-bell" style={{ color: '#2563eb' }} />Notifications d'Incidents
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Incidents détectés lors de vos examens dans les dernières 24h</p>
        </div>
        <button onClick={load} style={{ padding: '9px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          <i className="fas fa-rotate-right" style={{ marginRight: 6 }} />Actualiser
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: 'fa-triangle-exclamation', label: 'Total incidents', value: incidents.length, color: '#2563eb', bg: '#dbeafe' },
          { icon: 'fa-circle-exclamation',   label: 'Haute sévérité',  value: highCount,        color: '#dc2626', bg: '#fee2e2' },
          { icon: 'fa-circle-info',          label: 'Sévérité moyenne',value: mediumCount,       color: '#f59e0b', bg: '#fef3c7' },
        ].map(({ icon, label, value, color, bg }) => (
          <div key={label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fas ${icon}`} style={{ color, fontSize: 20 }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{value}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres sévérité */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginRight: 4 }}>Filtrer :</span>
        {([['all','Tous','#0f172a','white'],['high','Haute','#dc2626','#fee2e2'],['medium','Moyenne','#f59e0b','#fef3c7']] as const).map(([val, label, activeColor, activeBg]) => (
          <button key={val} onClick={() => setFilterSeverity(val as any)}
            style={{ padding: '6px 14px', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 12,
              background: filterSeverity === val ? (val === 'all' ? '#0f172a' : activeBg) : '#f1f5f9',
              color:      filterSeverity === val ? (val === 'all' ? 'white' : activeColor) : '#475569' }}>
            {label}
            {val !== 'all' && (
              <span style={{ marginLeft: 6, background: filterSeverity === val ? activeColor : '#e2e8f0', color: filterSeverity === val ? 'white' : '#64748b', borderRadius: 99, padding: '1px 7px', fontSize: 11 }}>
                {val === 'high' ? highCount : mediumCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: '#2563eb', display: 'block', marginBottom: 14 }} />
            Chargement des incidents…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
            {incidents.length === 0 ? (
              <>
                <i className="fas fa-check-circle" style={{ fontSize: 44, color: '#10b981', display: 'block', marginBottom: 14 }} />
                <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16, color: '#059669' }}>Aucun incident détecté</p>
                <p style={{ margin: 0, fontSize: 13 }}>Tout va bien ! Aucune anomalie dans les dernières 24h.</p>
              </>
            ) : (
              <>
                <i className="fas fa-filter" style={{ fontSize: 36, display: 'block', marginBottom: 14, opacity: .4 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>Aucun incident pour ce filtre</p>
              </>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Quand','Examen','Étudiant','Type d\'incident','Sévérité'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((inc, i) => {
                const isHigh   = inc.severity === 'high'
                const label    = EVENT_LABELS[inc.event_type] || inc.event_type
                const sevColor = isHigh ? '#dc2626' : '#f59e0b'
                const sevBg    = isHigh ? '#fee2e2' : '#fef3c7'
                return (
                  <tr key={inc.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0f9ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                      <i className="fas fa-clock" style={{ marginRight: 6 }} />
                      {timeAgo(inc.timestamp)}
                    </td>
                    <td style={{ padding: '13px 16px', fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
                      <i className="fas fa-laptop-code" style={{ color: '#2563eb', marginRight: 7 }} />
                      {inc.exam_title}
                    </td>
                    <td style={{ padding: '13px 16px', color: '#334155', fontSize: 14 }}>
                      <i className="fas fa-user" style={{ color: '#94a3b8', marginRight: 7 }} />
                      {inc.student_name}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 14, color: '#334155' }}>{label}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ background: sevBg, color: sevColor, borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <i className={`fas ${isHigh ? 'fa-circle-exclamation' : 'fa-circle-info'}`} style={{ fontSize: 11 }} />
                        {isHigh ? 'Haute' : 'Moyenne'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {!loading && visible.length > 0 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              <i className="fas fa-table" style={{ marginRight: 6 }} />
              {visible.length} incident(s) affiché(s)
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Mis à jour toutes les minutes</p>
          </div>
        )}
      </div>
    </div>
  )
}
