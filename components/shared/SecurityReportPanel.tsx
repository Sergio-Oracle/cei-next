'use client'
/**
 * SecurityReportPanel — panneau réutilisable du rapport de sécurité
 * (/api/admin/security_report), déjà nativement filtrable par exam_id côté
 * backend. Deux usages :
 *   - Page "Sécurité" globale (admin + professeur) : sélecteur d'examen,
 *     "— Tous les examens —" par défaut.
 *   - Page de détail d'un examen : `fixedExamId` fige le filtre sur CET
 *     examen, pas de sélecteur, pas d'en-tête de page (juste le contenu).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import StatTile from '@/components/ui/StatTile'

interface EventSummary  { event: string; count: number }
interface HighRiskAttempt {
  attempt_id: number; student_name: string; exam_title: string
  risk_score: number; warnings_count: number; tab_switches: number
  no_face_count: number; status: string; ban_reason?: string
}
interface SecurityReport {
  event_summary: EventSummary[]
  high_risk: HighRiskAttempt[]
  banned_count: number
  exam_id?: number | null
  exam_title?: string | null
}
interface ExamOption { id: number; title: string }
interface FaceRefData {
  student_name: string; exam_title: string
  image_data: string | null; image_url?: string | null; has_photo: boolean
}

const EVT_ICONS: Record<string, string> = {
  no_face_detected:       'fa-eye-slash',
  no_face:                'fa-eye-slash',
  window_blur:            'fa-window-restore',
  tab_switch:             'fa-exchange-alt',
  copy_attempt:           'fa-copy',
  paste_attempt:          'fa-paste',
  right_click:            'fa-mouse-pointer',
  multiple_faces:         'fa-users',
  face_reference_captured:'fa-camera',
  screen_share_stopped:   'fa-desktop',
  screen_share_started:   'fa-desktop',
  student_message:        'fa-comment',
  teacher_message:        'fa-comment-dots',
  teacher_warning:        'fa-exclamation-circle',
  devtools_attempt:       'fa-code',
  face_absent:            'fa-user-slash',
  fullscreen_exit:        'fa-compress',
  fullscreen_enter:       'fa-expand',
  warning_issued:         'fa-exclamation-triangle',
  proctor_note:           'fa-sticky-note',
  'proctor note':         'fa-sticky-note',
  proctor_ban:            'fa-ban',
  teacher_ban:            'fa-ban',
  extra_time:             'fa-clock',
  teacher_private_call:   'fa-phone',
  'teacher private call': 'fa-phone',
  private_call:           'fa-phone',
  teacher_end_call:       'fa-phone-slash',
  'teacher end call':     'fa-phone-slash',
  unban:                  'fa-unlock',
  unknown:                'fa-question-circle',
}

const EVT_LABELS: Record<string, string> = {
  no_face_detected:       'Visage non détecté',
  no_face:                'Visage non détecté',
  window_blur:            'Changement de fenêtre',
  tab_switch:             "Changement d'onglet",
  copy_attempt:           'Tentative de copie',
  paste_attempt:          'Tentative de collage',
  right_click:            'Clic droit détecté',
  multiple_faces:         'Plusieurs visages détectés',
  face_reference_captured:'Photo de référence capturée',
  screen_share_stopped:   "Partage d'écran arrêté",
  screen_share_started:   "Partage d'écran démarré",
  student_message:        'Message étudiant',
  teacher_message:        "Message de l'enseignant",
  teacher_warning:        "Avertissement de l'enseignant",
  devtools_attempt:       'Console développeur ouverte',
  face_absent:            'Visage absent',
  fullscreen_exit:        'Plein écran quitté',
  fullscreen_enter:       'Plein écran activé',
  warning_issued:         'Avertissement émis',
  proctor_note:           'Note du surveillant',
  'proctor note':         'Note du surveillant',
  proctor_ban:            'Exclusion par le surveillant',
  teacher_ban:            "Exclusion par l'enseignant",
  extra_time:             'Temps supplémentaire accordé',
  teacher_private_call:   'Appel privé enseignant',
  'teacher private call': 'Appel privé enseignant',
  private_call:           'Appel privé',
  teacher_end_call:       "Fin d'appel enseignant",
  'teacher end call':     "Fin d'appel enseignant",
  unban:                  'Débannissement',
  unknown:                'Événement inconnu',
}

const EVT_RISK_COLOR: Record<string, string> = {
  no_face_detected: '#f59e0b', tab_switch: '#ef4444', window_blur: '#f97316',
  copy_attempt: '#ef4444', paste_attempt: '#ef4444', multiple_faces: '#dc2626',
}

// Seuls les événements ci-dessous représentent un comportement suspect /
// une violation potentielle des règles d'examen — le reste (messages,
// appels enseignant, photo de référence, etc.) est de l'activité normale
// de la plateforme et n'a pas sa place dans un rapport de SÉCURITÉ : les
// compter comme "incidents" gonfle artificiellement le total et noie les
// vrais signaux (changement d'onglet, plein écran quitté, visage absent…)
// au milieu d'événements routiniers.
const INCIDENT_EVENT_TYPES = new Set([
  'no_face_detected', 'no_face', 'face_absent', 'window_blur', 'tab_switch',
  'copy_attempt', 'paste_attempt', 'right_click', 'multiple_faces',
  'screen_share_stopped', 'devtools_attempt', 'fullscreen_exit',
  'warning_issued', 'proctor_ban', 'teacher_ban',
])

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  banned:         { label: 'Banni',                color: '#ef4444' },
  submitted:      { label: 'Soumis',                color: '#f59e0b' },
  auto_submitted: { label: 'Soumis automatiquement', color: '#f59e0b' },
  in_progress:    { label: 'En cours',              color: '#3b82f6' },
  'in progress':  { label: 'En cours',              color: '#3b82f6' },
  completed:      { label: 'Terminé',               color: '#10b981' },
  active:         { label: 'Actif',                 color: '#3b82f6' },
  pending:        { label: 'En attente',            color: '#94a3b8' },
  draft:          { label: 'Brouillon',             color: '#64748b' },
}

function riskColor(score: number) {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f59e0b'
  return '#10b981'
}

interface Props {
  /** Fige le rapport sur cet examen — masque le sélecteur (usage : page de détail d'un examen). */
  fixedExamId?: number
  /** Masque l'en-tête de page (titre + sélecteur + bouton actualiser en haut) — usage : intégré dans une autre page qui a déjà son propre en-tête. */
  hideHeader?: boolean
}

export default function SecurityReportPanel({ fixedExamId, hideHeader = false }: Props) {
  const { error } = useToast()
  const [report,    setReport]    = useState<SecurityReport | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [facePhoto, setFacePhoto] = useState<(FaceRefData & { attemptId: number }) | null>(null)
  const [exams,     setExams]     = useState<ExamOption[]>([])
  const [examId,    setExamId]    = useState(fixedExamId ? String(fixedExamId) : '')

  useEffect(() => {
    load(fixedExamId ? String(fixedExamId) : undefined)
    if (!fixedExamId) {
      api.get<any>('/api/online_exams').then(r => setExams(Array.isArray(r) ? r : r.exams ?? [])).catch(() => {})
    }
  }, []) // eslint-disable-line

  async function load(examFilter?: string) {
    setLoading(true)
    try {
      const qs = examFilter ? `?exam_id=${examFilter}` : ''
      setReport(await api.get<SecurityReport>(`/api/admin/security_report${qs}`))
    }
    catch { error('Erreur chargement rapport de sécurité') }
    finally { setLoading(false) }
  }

  async function viewFacePhoto(attemptId: number) {
    try {
      const data = await api.get<FaceRefData>(`/api/exam_attempts/${attemptId}/face_reference`)
      setFacePhoto({ ...data, attemptId })
    } catch { error('Photo de référence non disponible') }
  }

  const incidentEvents = (report?.event_summary ?? []).filter(e => INCIDENT_EVENT_TYPES.has(e.event))
  const routineEvents  = (report?.event_summary ?? []).filter(e => !INCIDENT_EVENT_TYPES.has(e.event))
  const totalIncidents = incidentEvents.reduce((a, e) => a + e.count, 0)

  return (
    <div>
      {!hideHeader && (
        <div className="page-header">
          <div>
            <h2><i className="fas fa-shield-alt" style={{ marginRight: 10, color: 'var(--danger)' }} />Rapport de sécurité</h2>
            <p>{report?.exam_title ? <>Incidents pour l'examen <strong>{report.exam_title}</strong></> : 'Incidents et comportements suspects — tous examens confondus'}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {!fixedExamId && (
              <select className="form-control" value={examId}
                onChange={e => { setExamId(e.target.value); load(e.target.value || undefined) }}
                style={{ minWidth: 240 }}>
                <option value="">— Tous les examens —</option>
                {exams.map(x => <option key={x.id} value={String(x.id)}>{x.title}</option>)}
              </select>
            )}
            <button className="btn btn-secondary" onClick={() => load(examId || undefined)}><i className="fas fa-rotate" /> Actualiser</button>
          </div>
        </div>
      )}
      {hideHeader && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn btn-secondary" onClick={() => load(examId || undefined)}><i className="fas fa-rotate" /> Actualiser</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} />
        </div>
      ) : !report ? (
        <div className="alert alert-error">Impossible de charger le rapport de sécurité.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatTile icon="fa-ban" color="#ef4444" label="Étudiants bannis" value={report.banned_count || 0} />
            <StatTile icon="fa-triangle-exclamation" color="#f59e0b" label="À haut risque (score ≥ 70)" value={report.high_risk?.length || 0} />
            <StatTile icon="fa-list" color="#2563eb" label="Incidents totaux" value={totalIncidents} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 18, alignItems: 'start' }}>
            <div className="card">
              <div className="card-header">
                <h3 style={{ margin: 0 }}><i className="fas fa-chart-bar" /> Types d'incidents</h3>
              </div>
              <div className="table-responsive">
                <table>
                  <thead><tr><th>Événement</th><th style={{ textAlign: 'center' }}>Nb</th></tr></thead>
                  <tbody>
                    {incidentEvents.length === 0 ? (
                      <tr><td colSpan={2} className="empty-message">Aucun incident</td></tr>
                    ) : incidentEvents.map(e => (
                      <tr key={e.event}>
                        <td>
                          <i className={`fas ${EVT_ICONS[e.event] || 'fa-circle'}`}
                            style={{ color: EVT_RISK_COLOR[e.event] || '#94a3b8', marginRight: 8, width: 14, textAlign: 'center' }} />
                          {EVT_LABELS[e.event] || e.event}
                        </td>
                        <td style={{ fontWeight: 700, textAlign: 'center' }}>{e.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {routineEvents.length > 0 && (
                <>
                  <div className="card-header" style={{ borderTop: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                      <i className="fas fa-circle-info" /> Activité de la plateforme (hors incidents)
                    </h3>
                  </div>
                  <div className="table-responsive">
                    <table>
                      <tbody>
                        {routineEvents.map(e => (
                          <tr key={e.event}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                              <i className={`fas ${EVT_ICONS[e.event] || 'fa-circle'}`}
                                style={{ color: '#94a3b8', marginRight: 8, width: 14, textAlign: 'center' }} />
                              {EVT_LABELS[e.event] || e.event}
                            </td>
                            <td style={{ fontWeight: 600, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{e.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

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
                        <th>Étudiant</th><th>Examen</th>
                        <th style={{ textAlign: 'center' }}>Score</th>
                        <th style={{ textAlign: 'center' }}>Avert.</th>
                        <th style={{ textAlign: 'center' }}>Onglets</th>
                        <th style={{ textAlign: 'center' }}>Sans visage</th>
                        <th>Statut</th><th style={{ textAlign: 'center' }}>Photo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.high_risk.map(a => {
                        const st = STATUS_MAP[a.status] ?? { label: a.status, color: '#64748b' }
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
                              <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.color + '18', padding: '3px 8px', borderRadius: 99 }}>
                                {st.label}
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

          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '16px 18px', marginTop: 16, fontSize: 13, color: '#0369a1', lineHeight: 1.7 }}>
            <strong><i className="fas fa-circle-info" /> Interprétation du score de risque :</strong><br />
            Le score est calculé à partir du nombre d'avertissements, de changements d'onglet, de détections sans visage et d'autres incidents.{' '}
            <strong>0–30 : Normal · 30–70 : Attention · 70–100 : Risque élevé</strong>
          </div>
        </>
      )}

      {/* Modal photo référence */}
      {facePhoto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setFacePhoto(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, maxWidth: 440, width: '90%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}><i className="fas fa-camera" style={{ marginRight: 8 }} />Photo de référence</h3>
                {facePhoto.student_name && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    {facePhoto.student_name} — {facePhoto.exam_title}
                  </p>
                )}
              </div>
              <button onClick={() => setFacePhoto(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            {facePhoto.has_photo && (facePhoto.image_data || facePhoto.image_url) ? (
              <img
                src={facePhoto.image_url || (facePhoto.image_data!.startsWith('data:') ? facePhoto.image_data! : `data:image/jpeg;base64,${facePhoto.image_data}`)}
                alt="Photo de référence"
                style={{ width: '100%', borderRadius: 8, display: 'block', border: '1px solid #e2e8f0' }}
              />
            ) : (
              <div style={{ width: '100%', height: 180, background: '#f1f5f9', borderRadius: 8,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <i className="fas fa-camera-slash" style={{ fontSize: 32, color: '#94a3b8' }} />
                <span style={{ fontSize: 13, color: '#64748b' }}>Photo non disponible</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Les photos sont capturées au démarrage de l'examen</span>
              </div>
            )}
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
              Tentative #{facePhoto.attemptId}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
