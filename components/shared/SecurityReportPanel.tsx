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
import React, { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useProgressive } from '@/lib/useProgressive'
import ShowMore from '@/components/ui/ShowMore'
import { eventLabel } from '@/lib/eventLabels'
import { errMsg } from '@/lib/errors'

interface EventSummary  { event: string; count: number }
interface HighRiskAttempt {
  attempt_id: number; student_name: string; exam_title: string
  risk_score: number; warnings_count: number; tab_switches: number
  no_face_count: number; status: string; ban_reason?: string
}
interface IncidentSnapshot { timestamp: string | null; event_type: string | null; image_url: string }
interface StudentIncidents {
  attempt_id: number; student_name: string; exam_title: string
  risk_score: number; status: string
  incidents: EventSummary[]; total_incidents: number
  snapshots: IncidentSnapshot[]
}
interface ReferencePhoto {
  attempt_id: number; student_name: string; exam_title: string
  timestamp: string | null; image_url: string
}
interface SecurityReport {
  event_summary: EventSummary[]
  high_risk: HighRiskAttempt[]
  by_student: StudentIncidents[]
  reference_photos: ReferencePhoto[]
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
  no_face_low_light:      'fa-eye-slash',
  face_covered:           'fa-mask',
  camera_blocked:         'fa-video-slash',
  audio_suspicious:       'fa-volume-high',
  session_end:            'fa-flag-checkered',
  tab_closed:             'fa-xmark',
  env_scan_completed:     'fa-street-view',
  env_scan_person_detected: 'fa-user-group',
  env_scan_unavailable:   'fa-street-view',
  gaze_away:              'fa-eye',
  head_turned:            'fa-rotate',
  talking_detected:       'fa-comment-dots',
  suspect_object_detected:'fa-triangle-exclamation',
  liveness_check_failed:  'fa-eye',
  sustained_audio_detected:'fa-microphone-lines',
  multi_screen_detected:  'fa-display',
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
  no_face_low_light:      'Visage non détecté (éclairage faible)',
  face_covered:           'Visage partiellement masqué',
  camera_blocked:         'Caméra obstruée',
  audio_suspicious:       'Bruit suspect détecté',
  session_end:            'Fin de session',
  tab_closed:             'Onglet/navigateur fermé pendant la composition',
  env_scan_completed:     'Scan environnement effectué',
  env_scan_person_detected: 'Personne détectée dans la pièce',
  env_scan_unavailable:   'Scan environnement indisponible',
  gaze_away:              'Regard détourné de l\'écran',
  head_turned:            'Tête tournée',
  talking_detected:       'Parole détectée',
  suspect_object_detected:'Objet suspect détecté',
  liveness_check_failed:  'Contrôle de vivacité échoué (aucun clignement détecté)',
  sustained_audio_detected:'Bruit prolongé détecté',
  multi_screen_detected:  'Plusieurs écrans détectés',
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
  const [zoomed,    setZoomed]    = useState<IncidentSnapshot | null>(null)
  const [showRefGallery, setShowRefGallery] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

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

  async function downloadPdf() {
    const targetExamId = fixedExamId ?? (examId ? Number(examId) : null)
    if (!targetExamId) { error('Sélectionnez un examen pour télécharger son rapport PDF'); return }
    setDownloadingPdf(true)
    try {
      const blob = await api.blob(`/api/online_exams/${targetExamId}/security_report/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `securite-${targetExamId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) { error(errMsg(e) || 'Erreur téléchargement PDF') }
    finally { setDownloadingPdf(false) }
  }

  async function viewFacePhoto(attemptId: number) {
    try {
      const data = await api.get<FaceRefData>(`/api/exam_attempts/${attemptId}/face_reference`)
      setFacePhoto({ ...data, attemptId })
    } catch { error('Photo de référence non disponible') }
  }

  // ── Filtres (recherche, statut, niveau de risque, type d'incident, tri) ─────────────────────────────────────────────
  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fRisk, setFRisk] = useState('')
  const [fEvent, setFEvent] = useState('')
  const [sort, setSort] = useState<'risk' | 'incidents' | 'name'>('risk')
  const [openRow, setOpenRow] = useState<number | null>(null)
  const norm = (t: string) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const riskLevel = (n: number) => (n >= 70 ? 'high' : n >= 40 ? 'mid' : 'low')
  const statusGroup = (st: string) => (st === 'banned' ? 'banned' : st === 'in_progress' || st === 'in progress' || st === 'active' ? 'running' : 'done')

  const students = useMemo(() => {
    const list = (report?.by_student ?? []).filter(s => {
      if (q && !norm(s.student_name + ' ' + s.exam_title).includes(norm(q))) return false
      if (fStatus && statusGroup(s.status) !== fStatus) return false
      if (fRisk && riskLevel(s.risk_score) !== fRisk) return false
      if (fEvent && !s.incidents.some(i => i.event === fEvent)) return false
      return true
    })
    const cnt = (s: StudentIncidents) => fEvent ? (s.incidents.find(i => i.event === fEvent)?.count ?? 0) : s.total_incidents
    return [...list].sort((a, b) => sort === 'name' ? a.student_name.localeCompare(b.student_name, 'fr') : sort === 'incidents' ? cnt(b) - cnt(a) : b.risk_score - a.risk_score)
  }, [report, q, fStatus, fRisk, fEvent, sort]) // eslint-disable-line
  const risky = useMemo(() => (report?.high_risk ?? []).filter(a =>
    (!q || norm(a.student_name + ' ' + a.exam_title).includes(norm(q))) && (!fStatus || statusGroup(a.status) === fStatus)), [report, q, fStatus]) // eslint-disable-line
  const pgStudents = useProgressive(students)
  const pgRisky = useProgressive(risky)
  const hasFilter = !!(q || fStatus || fRisk || fEvent)
  const resetFilters = () => { setQ(''); setFStatus(''); setFRisk(''); setFEvent(''); setSort('risk') }

  const incidentEvents = (report?.event_summary ?? []).filter(e => INCIDENT_EVENT_TYPES.has(e.event))
  const routineEvents  = (report?.event_summary ?? []).filter(e => !INCIDENT_EVENT_TYPES.has(e.event))
  const totalIncidents = incidentEvents.reduce((a, e) => a + e.count, 0)

  return (
    <div>
      {!hideHeader && (
        <div className="page-header">
          <div>
            <h2><i className="fas fa-shield-alt" style={{ marginRight: 10, color: 'var(--primary)' }} />Rapport de sécurité</h2>
            <p>{report?.exam_title ? <>Incidents pour l&apos;examen <strong>{report.exam_title}</strong></> : 'Incidents et comportements suspects — tous examens confondus'}</p>
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
            {(fixedExamId || examId) && (
              <button className="btn btn-secondary" onClick={downloadPdf} disabled={downloadingPdf}>
                {downloadingPdf ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-file-pdf" />} PDF
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => load(examId || undefined)}><i className="fas fa-rotate" /> Actualiser</button>
          </div>
        </div>
      )}
      {hideHeader && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 12 }}>
          {(fixedExamId || examId) && (
            <button className="btn btn-secondary" onClick={downloadPdf} disabled={downloadingPdf}>
              {downloadingPdf ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-file-pdf" />} PDF
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => load(examId || undefined)}><i className="fas fa-rotate" /> Actualiser</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 35 }} />
        </div>
      ) : !report ? (
        <div className="alert alert-error">Impossible de charger le rapport de sécurité.</div>
      ) : (
        <>
          {/* Indicateurs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
            {[
              { icon: 'fa-ban', label: 'Étudiants bannis', value: report.banned_count || 0 },
              { icon: 'fa-triangle-exclamation', label: 'À haut risque (score ≥ 70)', value: report.high_risk?.length || 0 },
              { icon: 'fa-list', label: 'Incidents enregistrés', value: totalIncidents },
            ].map(t => (
              <div key={t.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, background: '#eff6ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fas ${t.icon}`} style={{ color: '#1d4ed8', fontSize: 18 }} />
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{t.value}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>{t.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filtres */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 18 }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un étudiant ou un examen…" aria-label="Rechercher"
                style={{ ...ctl, width: '100%', paddingLeft: 34, boxSizing: 'border-box' }} />
            </div>
            <select value={fStatus} onChange={e => setFStatus(e.target.value)} aria-label="Statut" style={ctl}>
              <option value="">Tous les statuts</option><option value="running">En cours</option><option value="done">Soumis / terminé</option><option value="banned">Bannis</option>
            </select>
            <select value={fRisk} onChange={e => setFRisk(e.target.value)} aria-label="Niveau de risque" style={ctl}>
              <option value="">Tous les niveaux de risque</option><option value="high">Élevé (≥ 70)</option><option value="mid">Attention (40–69)</option><option value="low">Normal (&lt; 40)</option>
            </select>
            <select value={fEvent} onChange={e => setFEvent(e.target.value)} aria-label="Type d'incident" style={ctl}>
              <option value="">Tous les types d&apos;incident</option>
              {incidentEvents.map(e => <option key={e.event} value={e.event}>{eventLabel(e.event, EVT_LABELS)} ({e.count})</option>)}
            </select>
            <select value={sort} onChange={e => setSort(e.target.value as any)} aria-label="Tri" style={ctl}>
              <option value="risk">Trier : risque décroissant</option><option value="incidents">Trier : nombre d&apos;incidents</option><option value="name">Trier : nom</option>
            </select>
            {hasFilter && <button type="button" onClick={resetFilters} style={{ ...ctl, cursor: 'pointer', color: '#1d4ed8', background: 'transparent' }}><i className="fas fa-xmark" style={{ marginRight: 6 }} />Réinitialiser</button>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 2fr', gap: 18, alignItems: 'start' }}>
            {/* Types d'incidents */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={sectionHead}>Types d&apos;incidents</div>
              {incidentEvents.length === 0 ? <p className="empty-message">Aucun incident</p> : (
                <div style={{ padding: '4px 0 6px' }}>
                  {incidentEvents.map(e => {
                    const max = Math.max(...incidentEvents.map(x => x.count), 1)
                    const on = fEvent === e.event
                    return (
                      <button key={e.event} type="button" onClick={() => setFEvent(on ? '' : e.event)} title="Filtrer sur ce type d'incident"
                        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: on ? '#eff6ff' : 'transparent', padding: '8px 16px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: 'var(--text)' }}>
                          <i className={`fas ${EVT_ICONS[e.event] || 'fa-circle'}`} style={{ color: '#64748b', width: 16, textAlign: 'center' }} />
                          <span style={{ flex: 1 }}>{eventLabel(e.event, EVT_LABELS)}</span>
                          <b>{e.count}</b>
                        </div>
                        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 4, marginTop: 6 }}>
                          <div style={{ width: `${Math.max(4, (e.count / max) * 100)}%`, height: '100%', background: on ? '#1d4ed8' : '#94a3b8', borderRadius: 4 }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {routineEvents.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Activité de la plateforme (hors incidents)</div>
                  {routineEvents.map(e => (
                    <div key={e.event} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-muted)', padding: '3px 0' }}>
                      <i className={`fas ${EVT_ICONS[e.event] || 'fa-circle'}`} style={{ width: 16, textAlign: 'center', color: '#94a3b8' }} />
                      <span style={{ flex: 1 }}>{eventLabel(e.event, EVT_LABELS)}</span>
                      {e.event === 'face_reference_captured' && (report?.reference_photos?.length ?? 0) > 0 && (
                        <button onClick={() => setShowRefGallery(true)} style={{ background: 'transparent', border: '1px solid var(--border)', color: '#1d4ed8', padding: '1px 8px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer' }}>
                          <i className="fas fa-camera" /> Photos
                        </button>
                      )}
                      <b>{e.count}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tentatives à haut risque */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={sectionHead}>Tentatives à haut risque <span style={subtle}>(score ≥ 70)</span></div>
              {!risky.length ? (
                <p className="empty-message">{report.high_risk?.length ? 'Aucune tentative ne correspond à la recherche' : 'Aucune tentative à haut risque'}</p>
              ) : (<>
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Étudiant</th>
                        <th style={{ textAlign: 'center' }}>Score</th>
                        <th style={{ textAlign: 'center' }} title="Avertissements">Avert.</th>
                        <th style={{ textAlign: 'center' }}>Onglets</th>
                        <th style={{ textAlign: 'center' }}>Sans visage</th>
                        <th>Statut</th><th style={{ textAlign: 'center' }}>Photo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pgRisky.shown.map(a => (
                        <tr key={a.attempt_id}>
                          <td><div style={{ fontSize: 15.5, fontWeight: 600 }}>{a.student_name}</div><div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{a.exam_title}</div></td>
                          <td style={{ textAlign: 'center' }}><b style={{ color: '#b91c1c', fontSize: 17 }}>{a.risk_score}</b></td>
                          <td style={{ textAlign: 'center' }}>{a.warnings_count}</td>
                          <td style={{ textAlign: 'center' }}>{a.tab_switches}</td>
                          <td style={{ textAlign: 'center' }}>{a.no_face_count}</td>
                          <td><StatusChip status={a.status} />{a.ban_reason && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>{a.ban_reason}</div>}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button onClick={() => viewFacePhoto(a.attempt_id)} title="Voir la photo de référence" style={{ background: 'transparent', border: '1px solid var(--border)', color: '#1d4ed8', padding: '4px 10px', borderRadius: 8, cursor: 'pointer' }}>
                              <i className="fas fa-camera" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ShowMore pg={pgRisky} label="tentatives" />
              </>)}
            </div>
          </div>

          {/* Incidents par étudiant */}
          <div className="card" style={{ marginTop: 18, overflow: 'hidden' }}>
            <div style={sectionHead}>Incidents par étudiant <span style={subtle}>{students.length} sur {report.by_student?.length ?? 0}</span></div>
            {!students.length ? (
              <p className="empty-message">{report.by_student?.length ? 'Aucun étudiant ne correspond aux filtres' : 'Aucun étudiant avec un incident enregistré'}</p>
            ) : (<>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr><th>Étudiant</th><th>Statut</th><th style={{ minWidth: 150 }}>Risque</th><th>Incidents</th><th style={{ width: 44 }} /></tr>
                  </thead>
                  <tbody>
                    {pgStudents.shown.map(s => {
                      const open = openRow === s.attempt_id
                      return (
                        <React.Fragment key={s.attempt_id}>
                          <tr onClick={() => s.snapshots.length && setOpenRow(open ? null : s.attempt_id)} style={{ cursor: s.snapshots.length ? 'pointer' : 'default', background: open ? '#f8fafc' : undefined }}>
                            <td><div style={{ fontSize: 15.5, fontWeight: 600 }}>{s.student_name}</div><div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{s.exam_title}</div></td>
                            <td><StatusChip status={s.status} /></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 6, minWidth: 70 }}>
                                  <div style={{ width: `${Math.min(100, s.risk_score)}%`, height: '100%', borderRadius: 6, background: s.risk_score >= 70 ? '#b91c1c' : '#64748b' }} />
                                </div>
                                <b style={{ fontSize: 14.5, color: s.risk_score >= 70 ? '#b91c1c' : 'var(--text)', minWidth: 28, textAlign: 'right' }}>{s.risk_score}</b>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {s.incidents.map(inc => (
                                  <span key={inc.event} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13.5, background: fEvent === inc.event ? '#dbeafe' : '#f1f5f9', color: '#334155', borderRadius: 99, padding: '2px 9px' }}>
                                    <i className={`fas ${EVT_ICONS[inc.event] || 'fa-circle'}`} style={{ color: '#64748b', fontSize: 12 }} />{eventLabel(inc.event, EVT_LABELS)} × {inc.count}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', color: '#64748b' }}>{s.snapshots.length > 0 && <><i className={`fas fa-chevron-${open ? 'up' : 'down'}`} /></>}</td>
                          </tr>
                          {open && (
                            <tr><td colSpan={5} style={{ background: '#f8fafc' }}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '6px 4px' }}>
                                {s.snapshots.map((snap, i) => (
                                  <img key={i} src={snap.image_url} alt="capture incident" onClick={e => { e.stopPropagation(); setZoomed(snap) }}
                                    title={snap.timestamp ? new Date(snap.timestamp).toLocaleString('fr-FR') : ''}
                                    style={{ width: 88, height: 66, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                ))}
                              </div>
                            </td></tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <ShowMore pg={pgStudents} label="étudiants" />
            </>)}
          </div>

          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.6 }}>
            <i className="fas fa-circle-info" style={{ marginRight: 6 }} />Le score de risque (0–100) tient compte des avertissements, changements d&apos;onglet, détections sans visage et autres incidents.
            {' '}<b>0–39 : normal · 40–69 : attention · 70 et plus : risque élevé.</b>
          </p>
        </>
      )}

      {/* Modal galerie photos de référence */}
      {showRefGallery && report && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowRefGallery(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, maxWidth: 700, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize:19 }}><i className="fas fa-camera" style={{ marginRight: 8 }} />Photos de référence</h3>
              <button onClick={() => setShowRefGallery(false)}
                style={{ background: 'none', border: 'none', fontSize:24, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize:14.5, color: 'var(--text-muted)' }}>
              {report.reference_photos.length} étudiant(s) — capturées au démarrage de l&apos;examen
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
              {report.reference_photos.map(p => (
                <div key={p.attempt_id} style={{ textAlign: 'center' }}>
                  <img src={p.image_url} alt={p.student_name}
                    onClick={() => setZoomed({ image_url: p.image_url, event_type: 'face_reference_captured', timestamp: p.timestamp })}
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <div style={{ fontSize:14.5, fontWeight: 600, marginTop: 6 }}>{p.student_name}</div>
                  <div style={{ fontSize:13, color: 'var(--text-muted)' }}>{p.exam_title}</div>
                  {p.timestamp && <div style={{ fontSize:12, color: 'var(--text-muted)' }}>{new Date(p.timestamp).toLocaleString('fr-FR')}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal zoom capture incident */}
      {zoomed && (
        <div onClick={() => setZoomed(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 99999, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <img src={zoomed.image_url} alt="capture incident"
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,.5)' }} />
          <div style={{ marginTop: 14, color: 'rgba(255,255,255,.85)', fontSize:15.5, display: 'flex', gap: 12, alignItems: 'center' }}>
            {zoomed.event_type && <span>{eventLabel(zoomed.event_type, EVT_LABELS)}</span>}
            {zoomed.timestamp && <span>{new Date(zoomed.timestamp).toLocaleString('fr-FR')}</span>}
          </div>
        </div>
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
                <h3 style={{ margin: 0, fontSize:19 }}><i className="fas fa-camera" style={{ marginRight: 8 }} />Photo de référence</h3>
                {facePhoto.student_name && (
                  <p style={{ margin: '4px 0 0', fontSize:14.5, color: 'var(--text-muted)' }}>
                    {facePhoto.student_name} — {facePhoto.exam_title}
                  </p>
                )}
              </div>
              <button onClick={() => setFacePhoto(null)}
                style={{ background: 'none', border: 'none', fontSize:24, cursor: 'pointer', color: 'var(--text-muted)' }}>
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
                <i className="fas fa-camera-slash" style={{ fontSize: 35, color: '#94a3b8' }} />
                <span style={{ fontSize:15.5, color: '#64748b' }}>Photo non disponible</span>
                <span style={{ fontSize:13, color: '#94a3b8' }}>Les photos sont capturées au démarrage de l&apos;examen</span>
              </div>
            )}
            <p style={{ fontSize:13, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
              Tentative #{facePhoto.attemptId}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

const ctl: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 15, background: 'var(--background)', color: 'var(--text)', outline: 'none' }
const sectionHead: React.CSSProperties = { padding: '13px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 16.5, color: 'var(--text)' }
const subtle: React.CSSProperties = { fontWeight: 500, fontSize: 14, color: 'var(--text-muted)', marginLeft: 6 }

/** Statut : pastille neutre, seul le point change de couleur (rouge = banni, bleu = en cours). */
function StatusChip({ status }: { status: string }) {
  const st = STATUS_MAP[status] ?? { label: status, color: '#64748b' }
  const dot = status === 'banned' ? '#b91c1c' : (status === 'in_progress' || status === 'in progress' || status === 'active') ? '#1d4ed8' : '#94a3b8'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: '#334155', background: '#f1f5f9', borderRadius: 99, padding: '3px 10px', whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />{st.label}
    </span>
  )
}
