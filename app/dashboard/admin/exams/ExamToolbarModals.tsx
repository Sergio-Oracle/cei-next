'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

/* ── Backdrop shell ─────────────────────────────────────────────── */
function Modal({ onClose, maxWidth = 700, children }: { onClose: () => void; maxWidth?: number; children: React.ReactNode }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ icon, color, title, subtitle, onClose }: { icon: string; color: string; title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, background: color + '15', border: `1px solid ${color}30`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fas ${icon}`} style={{ color, fontSize: 17 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
        <i className="fas fa-times" />
      </button>
    </div>
  )
}

function ModalFooter({ onClose, children }: { onClose: () => void; children?: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
      {children}
      <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
        <i className="fas fa-times" />Fermer
      </button>
    </div>
  )
}

function Spinner() {
  return <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-muted)', fontSize: 13 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 22, marginBottom: 10, display: 'block' }} />Chargement…</div>
}

async function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

/* ═══════════════════════════════════════════════════════════════
   STATISTIQUES
═══════════════════════════════════════════════════════════════ */
interface StatsData {
  exam_title?: string; total?: number; submitted?: number; corrected?: number; banned?: number; in_progress?: number;
  avg_score?: number | null; median_score?: number | null; min_score?: number | null; max_score?: number | null;
  pass_rate?: number | null; distribution?: number[]; avg_duration_min?: number | null;
  avg_risk?: number; high_risk_count?: number; pre_sig_rate?: number;
}

export function StatsModal({ examId, examTitle, onClose }: { examId: number; examTitle: string; onClose: () => void }) {
  const { error }               = useToast()
  const [data, setData]         = useState<StatsData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [dlCsv, setDlCsv]       = useState(false)

  useEffect(() => {
    api.get<StatsData>(`/api/online_exams/${examId}/stats`)
      .then(setData).catch(() => error('Erreur chargement statistiques'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  async function downloadCsv() {
    setDlCsv(true)
    try {
      const blob = await api.blob(`/api/online_exams/${examId}/export-csv`)
      await triggerDownload(blob, `examen_${examId}_resultats.csv`)
    } catch { error('Erreur export CSV') }
    finally { setDlCsv(false) }
  }

  const s = data

  function bar(pct: number, color: string) {
    return (
      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginTop: 3, flex: 1 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    )
  }

  function Kpi({ label, value, color = '#1e293b' }: { label: string; value?: string | number | null; color?: string }) {
    return (
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 100 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: color ?? '#1e293b' }}>{value ?? '—'}</div>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 3 }}>{label}</div>
      </div>
    )
  }

  const distLabels = ['0–4', '5–9', '10–13', '14–16', '17–20']
  const distColors = ['#ef4444', '#f97316', '#10b981', '#3b82f6', '#2563eb']
  const maxDist = Math.max(...(s?.distribution ?? [0]))

  return (
    <Modal onClose={onClose} maxWidth={660}>
      <ModalHeader icon="fa-chart-bar" color="#2563eb" title="Statistiques" subtitle={s?.exam_title ?? examTitle} onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? <Spinner /> : !s ? <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune donnée</div> : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Kpi label="Total inscrits" value={s.total} />
              <Kpi label="Soumis"  value={s.submitted}  color="#2563eb" />
              <Kpi label="Corrigés" value={s.corrected} color="#0ea5e9" />
              <Kpi label="Bannis"  value={s.banned}     color="#ef4444" />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Kpi label="Moyenne"      value={s.avg_score    != null ? s.avg_score + '/20'    : '—'} color={(s.avg_score ?? 0) >= 10 ? '#10b981' : '#ef4444'} />
              <Kpi label="Médiane"      value={s.median_score != null ? s.median_score + '/20' : '—'} />
              <Kpi label="Min"          value={s.min_score    != null ? s.min_score + '/20'    : '—'} color="#ef4444" />
              <Kpi label="Max"          value={s.max_score    != null ? s.max_score + '/20'    : '—'} color="#10b981" />
              <Kpi label="Taux réussite" value={s.pass_rate   != null ? s.pass_rate + '%'      : '—'} color={(s.pass_rate ?? 0) >= 50 ? '#10b981' : '#ef4444'} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Kpi label="Durée moy."  value={s.avg_duration_min ? s.avg_duration_min + ' min' : '—'} />
              <Kpi label="Risque moy." value={(s.avg_risk ?? 0) + '%'} color={(s.avg_risk ?? 0) >= 40 ? '#f59e0b' : '#10b981'} />
              <Kpi label="Haut risque" value={s.high_risk_count} color={(s.high_risk_count ?? 0) > 0 ? '#ef4444' : '#10b981'} />
              <Kpi label="Sig. pré"   value={(s.pre_sig_rate ?? 0) + '%'} color="#2563eb" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Distribution des notes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(s.distribution ?? []).map((n, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: '#64748b', width: 44, flexShrink: 0 }}>{distLabels[i]}</span>
                    {bar(maxDist ? n / maxDist * 100 : 0, distColors[i])}
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', width: 24, textAlign: 'right', flexShrink: 0 }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <ModalFooter onClose={onClose}>
        <button onClick={downloadCsv} disabled={dlCsv}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#d1fae5', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#059669', cursor: dlCsv ? 'not-allowed' : 'pointer', opacity: dlCsv ? .7 : 1 }}>
          <i className={`fas ${dlCsv ? 'fa-spinner fa-spin' : 'fa-file-csv'}`} />{dlCsv ? 'Export…' : 'Export CSV'}
        </button>
      </ModalFooter>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PLAGIAT
═══════════════════════════════════════════════════════════════ */
interface PlagPair {
  student1_name: string; student2_name: string; attempt1_id: number; attempt2_id: number; similarity: number; level: string;
}
interface PlagData { suspicious?: PlagPair[]; threshold_pct?: number; total_checked?: number }

export function PlagiatModal({ examId, examTitle, onClose }: { examId: number; examTitle: string; onClose: () => void }) {
  const { error }             = useToast()
  const [data, setData]       = useState<PlagData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<PlagData>(`/api/online_exams/${examId}/plagiarism-check?threshold=0.7`)
      .then(setData).catch(() => error('Erreur analyse plagiat'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  const pairs = data?.suspicious ?? []

  return (
    <Modal onClose={onClose} maxWidth={740}>
      <ModalHeader icon="fa-magnifying-glass" color="#ef4444" title="Rapport de plagiat" subtitle={`${data?.total_checked ?? '?'} copies analysées · seuil ${data?.threshold_pct ?? 70}%`} onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loading ? <Spinner /> : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Étudiant A', 'Étudiant B', 'Similarité', 'Niveau'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pairs.length === 0
                  ? <tr><td colSpan={4} style={{ padding: '28px', textAlign: 'center', color: '#10b981' }}>
                      <i className="fas fa-shield-check" style={{ fontSize: 22, display: 'block', marginBottom: 8 }} />
                      Aucune similarité suspecte détectée
                    </td></tr>
                  : pairs.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>
                        <strong>{p.student1_name}</strong><br />
                        <span style={{ color: '#94a3b8', fontSize: 10 }}>Tentative #{p.attempt1_id}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>
                        <strong>{p.student2_name}</strong><br />
                        <span style={{ color: '#94a3b8', fontSize: 10 }}>Tentative #{p.attempt2_id}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <strong style={{ fontSize: 16, color: p.similarity >= 90 ? '#ef4444' : '#f59e0b' }}>{p.similarity}%</strong>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {p.level === 'CRITIQUE'
                          ? <span style={{ background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>CRITIQUE</span>
                          : <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>SUSPECT</span>}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ModalFooter onClose={onClose} />
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════════
   BILAN
═══════════════════════════════════════════════════════════════ */
interface BilanAttempt {
  attempt_id: number; student_name: string; status: string; score: number | null; risk_score: number; duration_min: number | null; extra_minutes: number; note_count: number;
}
interface BilanData { exam_title?: string; attempts?: BilanAttempt[] }

export function BilanModal({ examId, examTitle, onClose }: { examId: number; examTitle: string; onClose: () => void }) {
  const { error }               = useToast()
  const [data, setData]         = useState<BilanData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [dlPdf, setDlPdf]       = useState<number | null>(null)
  const [dlZip, setDlZip]       = useState(false)
  const [dlBilan, setDlBilan]   = useState(false)

  useEffect(() => {
    api.get<BilanData>(`/api/online_exams/${examId}/bilan`)
      .then(setData).catch(() => error('Erreur chargement bilan'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  async function downloadReport(attemptId: number) {
    setDlPdf(attemptId)
    try {
      const blob = await api.blob(`/api/exam_attempts/${attemptId}/integrity-report`)
      await triggerDownload(blob, `rapport_integrite_${attemptId}.pdf`)
    } catch { error('Rapport non disponible') }
    finally { setDlPdf(null) }
  }

  async function downloadZip() {
    setDlZip(true)
    try {
      const blob = await api.blob(`/api/online_exams/${examId}/corrections/zip`)
      await triggerDownload(blob, `copies_examen_${examId}.zip`)
    } catch { error('Erreur export ZIP') }
    finally { setDlZip(false) }
  }

  async function downloadBilanPdf() {
    setDlBilan(true)
    try {
      const blob = await api.blob(`/api/online_exams/${examId}/bilan/pdf`)
      await triggerDownload(blob, `bilan_examen_${examId}.pdf`)
    } catch { error('Bilan PDF non disponible') }
    finally { setDlBilan(false) }
  }

  const attempts = data?.attempts ?? []

  const statusLabel: Record<string, string> = { submitted: 'Soumis', auto_submitted: 'Auto-soumis', in_progress: 'En cours', banned: 'Exclu', not_started: 'Absent' }
  const statusColor: Record<string, string> = { submitted: '#2563eb', auto_submitted: '#2563eb', in_progress: '#f59e0b', banned: '#ef4444', not_started: '#94a3b8' }

  return (
    <Modal onClose={onClose} maxWidth={860}>
      <ModalHeader icon="fa-list-check" color="#0369a1" title={`Bilan — ${data?.exam_title ?? examTitle}`} subtitle={`${attempts.length} participant(s)`} onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loading ? <Spinner /> : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Étudiant', 'Statut', 'Note', 'Risque', 'Durée', 'Extra', 'Notes surv.', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attempts.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Aucun participant</td></tr>
                  : attempts.map(a => {
                    const sc = statusColor[a.status] ?? '#94a3b8'
                    const sl = statusLabel[a.status]  ?? a.status
                    const riskColor = a.risk_score >= 70 ? '#ef4444' : a.risk_score >= 40 ? '#f59e0b' : '#10b981'
                    const scoreColor = a.score === null ? '#94a3b8' : a.score >= 10 ? '#10b981' : '#ef4444'
                    const busy = dlPdf === a.attempt_id
                    return (
                      <tr key={a.attempt_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 500 }}>{a.student_name}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ background: sc + '20', color: sc, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{sl}</span>
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, color: scoreColor }}>
                          {a.score !== null ? a.score + '/20' : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: riskColor, fontSize: 12, fontWeight: 600 }}>
                          {a.risk_score}%
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: '#64748b' }}>
                          {a.duration_min !== null ? a.duration_min + ' min' : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: a.extra_minutes > 0 ? '#d97706' : '#94a3b8' }}>
                          {a.extra_minutes > 0 ? '+' + a.extra_minutes + ' min' : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: a.note_count > 0 ? '#2563eb' : '#94a3b8' }}>
                          {a.note_count > 0 ? a.note_count + ' note(s)' : '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <a href={`/dashboard/admin/exams/${examId}`} target="_blank" rel="noreferrer"
                              style={{ padding: '3px 9px', fontSize: 11, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                              <i className="fas fa-eye" />Réviser
                            </a>
                            {a.score !== null && (
                              <button onClick={() => downloadReport(a.attempt_id)} disabled={busy}
                                style={{ padding: '3px 9px', fontSize: 11, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 5, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, opacity: busy ? .7 : 1 }}>
                                <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} />PDF
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ModalFooter onClose={onClose}>
        <button onClick={downloadZip} disabled={dlZip}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#0369a1', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: dlZip ? 'not-allowed' : 'pointer', opacity: dlZip ? .7 : 1 }}>
          <i className={`fas ${dlZip ? 'fa-spinner fa-spin' : 'fa-file-zipper'}`} />{dlZip ? 'Export…' : 'ZIP copies'}
        </button>
        <button onClick={downloadBilanPdf} disabled={dlBilan}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: dlBilan ? 'not-allowed' : 'pointer', opacity: dlBilan ? .7 : 1 }}>
          <i className={`fas ${dlBilan ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} />{dlBilan ? 'Génération…' : 'PDF Bilan'}
        </button>
      </ModalFooter>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════════
   INCIDENTS
═══════════════════════════════════════════════════════════════ */
interface Incident {
  timestamp: string; student_name: string; event_type: string; event_data?: string; severity?: string;
}
interface IncidentsData {
  incidents?: Incident[];
  statistics?: { total_incidents: number; tab_switches: number; banned_students: number };
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
  ban:                     'Exclusion de l\'examen',
  unban:                   'Bannissement levé',
  proctor_note:            'Note de surveillance',
  extra_time:              'Temps supplémentaire accordé',
  auto_submit:             'Soumission automatique',
  submit:                  'Copie soumise',
  keyboard_shortcut:       'Raccourci clavier bloqué',
  context_menu:            'Menu contextuel bloqué',
  screenshot_attempt:      'Tentative de capture écran',
}

export function IncidentsModal({ examId, examTitle, onClose }: { examId: number; examTitle: string; onClose: () => void }) {
  const { error }             = useToast()
  const [data, setData]       = useState<IncidentsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<IncidentsData>(`/api/online_exams/${examId}/incidents`)
      .then(setData).catch(() => error('Erreur chargement incidents'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  const incidents = data?.incidents ?? []
  const stats     = data?.statistics

  function parseDetails(eventType: string, raw?: string): string {
    if (!raw) return '—'
    try {
      const d = JSON.parse(raw)
      if (eventType === 'tab_switch'  && d.count)  return `Tentative n°${d.count}`
      if (eventType === 'proctor_note')             return `"${d.note || ''}"${d.author ? ` — ${d.author}` : ''}`
      if (eventType === 'unban')                    return `Par : ${d.author || '—'}${d.reason ? ` · Motif : ${d.reason}` : ''}`
      if (eventType === 'extra_time' && d.minutes)  return `+${d.minutes} min accordées`
      if (d.count)                                  return `Occurrence n°${d.count}`
      if (d.message)                                return String(d.message)
      if (d.reason)                                 return String(d.reason)
      const entries = Object.entries(d).filter(([k]) => !['author_id'].includes(k))
      return entries.length > 0 ? entries.map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'
    } catch { return raw }
  }

  return (
    <Modal onClose={onClose} maxWidth={820}>
      <ModalHeader icon="fa-shield-halved" color="#f59e0b" title="Incidents et Logs de Surveillance" subtitle={examTitle} onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? <Spinner /> : (
          <>
            {/* Stats */}
            {stats && (
              <div style={{ display: 'flex', gap: 12 }}>
                <StatChip label="Total incidents" value={stats.total_incidents} color="#64748b" />
                <StatChip label="Changements de fenêtre" value={stats.tab_switches} color="#ef4444" />
                <StatChip label="Étudiants bannis" value={stats.banned_students} color="#dc2626" />
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Horodatage', 'Étudiant', 'Type d\'incident', 'Détails'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidents.length === 0
                    ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: '28px', color: '#10b981' }}>
                        <i className="fas fa-check-circle" style={{ fontSize: 22, display: 'block', marginBottom: 8 }} />
                        Aucun incident détecté
                      </td></tr>
                    : incidents.map((inc, i) => {
                      const isHigh = inc.severity === 'high' || inc.event_type === 'tab_switch' || inc.event_type === 'devtools_attempt'
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: isHigh ? '#fff5f5' : undefined }}>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                            {new Date(inc.timestamp).toLocaleString('fr-FR')}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500 }}>{inc.student_name}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12 }}>
                            <span style={{ color: isHigh ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                              <i className={`fas fa-${isHigh ? 'circle-exclamation' : 'triangle-exclamation'}`} style={{ marginRight: 5 }} />
                              {EVENT_LABELS[inc.event_type] ?? inc.event_type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>
                            {parseDetails(inc.event_type, inc.event_data)}
                          </td>
                        </tr>
                      )
                    })
                  }
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <ModalFooter onClose={onClose} />
    </Modal>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 16px', flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  )
}
