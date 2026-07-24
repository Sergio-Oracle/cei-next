'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

interface Incident {
  timestamp: string
  type: string
}

interface ProctorNote {
  timestamp: string
  author: string
  note: string
}

interface AttemptReview {
  student_name: string
  exam_title: string
  score: number | null
  risk_score: number
  duration_min: number | null
  incidents: Incident[]
  proctor_notes: ProctorNote[]
  student_answer?: string
  raw_answers?: Record<string, string> | string
  feedback?: string
  tab_switches: number
  warnings_count: number
  no_face_count: number
  extra_minutes?: number
  ban_reason?: string
}

const INCIDENT_LABELS: Record<string, string> = {
  tab_switch:              "Changement d'onglet",
  fullscreen_exit:         'Plein écran quitté',
  window_blur:             'Fenêtre perdue',
  copy_attempt:            'Tentative de copie',
  paste_attempt:           'Tentative de collage',
  right_click:             'Clic droit',
  devtools_attempt:        'Outils développeur',
  devtools:                'Outils développeur',
  no_face:                 'Visage absent',
  no_face_detected:        'Visage non détecté',
  face_absent:             'Visage absent',
  face_mismatch:           'Visage différent',
  multiple_faces:          'Plusieurs visages',
  face_reference_captured: 'Photo de référence capturée',
  suspicious_audio:        'Audio suspect',
  unban:                   'Débannissement',
  auto_submitted:          'Soumission automatique',
  student_message:         "Message de l'étudiant",
  teacher_message:         "Message de l'enseignant",
  teacher_warning:         'Avertissement envoyé',
  teacher_private_call:    'Appel privé lancé',
  teacher_end_call:        'Appel privé terminé',
  teacher_ban:             "Exclusion par l'enseignant",
  proctor_ban:             'Exclusion par le surveillant',
  unknown:                 'Événement non catégorisé',
}

function getMention(score: number) {
  if (score >= 16) return 'Très Bien'
  if (score >= 14) return 'Bien'
  if (score >= 12) return 'Assez Bien'
  if (score >= 10) return 'Passable'
  return 'Insuffisant'
}

export default function AttemptDetailPage() {
  const { id } = useParams() as { id: string }
  const [data, setData]         = useState<AttemptReview | null>(null)
  const [loading, setLoading]   = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get<AttemptReview>(`/api/exam_attempts/${id}/review`)
      .then(r => setData(r))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  async function downloadPDF() {
    setPdfLoading(true)
    try {
      const blob = await api.blob(`/api/exam_attempts/${id}/report/pdf`)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `correction_${data?.student_name?.replace(/\s+/g, '_') ?? id}.pdf`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { alert('Impossible de générer le rapport PDF') }
    finally { setPdfLoading(false) }
  }

  /* ── États de chargement ── */
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 36, color: '#2563eb', display: 'block', marginBottom: 16 }} />
          <p style={{ color: '#64748b', fontSize: 14 }}>Chargement de la correction…</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ width: 64, height: 64, background: '#fef3c7', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <i className="fas fa-triangle-exclamation" style={{ fontSize: 28, color: '#d97706' }} />
        </div>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text)' }}>Correction introuvable</h3>
        <p style={{ color: '#64748b', marginBottom: 24 }}>Cette tentative n'existe pas ou vous n'y avez pas accès.</p>
        <Link href="/dashboard/professor/corrected"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: '#2563eb', color: 'white', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
          <i className="fas fa-arrow-left" />Retour aux copies corrigées
        </Link>
      </div>
    )
  }

  const hasScore   = data.score != null
  const scoreGood  = hasScore && (data.score as number) >= 10
  const scoreColor = scoreGood ? '#059669' : '#dc2626'
  const scoreBg    = scoreGood ? '#dcfce7'  : '#fee2e2'
  const riskColor  = data.risk_score >= 70 ? '#dc2626' : data.risk_score >= 40 ? '#d97706' : '#059669'

  /* Clés qui représentent UN champ réponse unique (pas un vrai nom de question) */
  const SIMPLE_ANSWER_KEYS = new Set(['reponse', 'answer', 'text', 'content', 'response', 'réponse'])

  /* Parsing de la réponse étudiant — peut être du JSON brut ou du texte libre */
  const displayAnswer = (() => {
    function extractFromObj(obj: Record<string, unknown>): string | null {
      const keys = Object.keys(obj)
      // Cas {"reponse":"..."} ou {"answer":"..."} : une seule clé connue → extraire la valeur
      if (keys.length === 1 && SIMPLE_ANSWER_KEYS.has(keys[0])) {
        const val = String(obj[keys[0]] ?? '').trim()
        return val || null
      }
      // Clés multiples dont certaines sont des noms de champ connus → extraire la première valeur non vide
      for (const key of SIMPLE_ANSWER_KEYS) {
        if (key in obj && obj[key] !== '' && obj[key] !== null && obj[key] !== undefined) {
          return String(obj[key]).trim() || null
        }
      }
      // Vrai objet multi-questions (clés comme "q1", "1", "Question 1"…)
      const entries = Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      return entries.length > 0
        ? entries.map(([k, v]) => `[Question ${k}]\n${v}`).join('\n\n')
        : null
    }

    // 1. student_answer en priorité — reconstruit lisible côté serveur
    // (numéro + texte de question, choix résolus), pas les clés de
    // stockage brutes (pq_1, pq_2…) que montrait raw_answers.
    if (data.student_answer) {
      try {
        const parsed = JSON.parse(data.student_answer)
        if (typeof parsed === 'object' && parsed !== null) return extractFromObj(parsed as Record<string, unknown>)
        return String(parsed).trim() || null
      } catch {
        return data.student_answer.trim() || null
      }
    }

    // 2. raw_answers — repli si le serveur n'a pas pu reconstruire de texte lisible
    if (data.raw_answers) {
      try {
        const raw = typeof data.raw_answers === 'string' ? JSON.parse(data.raw_answers) : data.raw_answers
        if (typeof raw === 'object' && raw !== null) return extractFromObj(raw as Record<string, unknown>)
        if (typeof raw === 'string') return raw.trim() || null
      } catch {}
    }

    return null
  })()
  const riskBg     = data.risk_score >= 70 ? '#fee2e2' : data.risk_score >= 40 ? '#fef3c7' : '#dcfce7'
  const riskLabel  = data.risk_score >= 70 ? 'Élevé' : data.risk_score >= 40 ? 'Modéré' : 'Faible'

  const initials = (data.student_name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Fil d'Ariane + bouton retour */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: '#64748b' }}>
        <Link href="/dashboard/professor/corrected"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb', fontWeight: 600, textDecoration: 'none', padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13 }}>
          <i className="fas fa-arrow-left" />Retour aux copies corrigées
        </Link>
        <i className="fas fa-chevron-right" style={{ fontSize: 10 }} />
        <span style={{ color: '#94a3b8' }}>Révision de copie</span>
        <i className="fas fa-chevron-right" style={{ fontSize: 10 }} />
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{data.student_name}</span>
      </div>

      {/* Carte d'en-tête principale */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 24, borderTop: `4px solid ${scoreGood ? '#10b981' : '#ef4444'}` }}>
        <div style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>

          {/* Identité étudiant */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #bfdbfe' }}>
              {initials}
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{data.student_name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="fas fa-laptop-code" style={{ color: '#2563eb', fontSize: 11 }} />
                  {data.exam_title}
                </span>
              </div>
            </div>
          </div>

          {/* Métriques clés */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Note */}
            <div style={{ textAlign: 'center', padding: '12px 20px', background: scoreBg, border: `1.5px solid ${scoreColor}44`, borderRadius: 12, minWidth: 80 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: scoreColor, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Note</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
                {hasScore ? data.score : '—'}<span style={{ fontSize: 12, fontWeight: 600 }}>/20</span>
              </div>
              {hasScore && <div style={{ fontSize: 10, color: scoreColor, marginTop: 2, fontWeight: 600 }}>{getMention(data.score as number)}</div>}
            </div>

            {/* Risque */}
            <div style={{ textAlign: 'center', padding: '12px 20px', background: riskBg, border: `1.5px solid ${riskColor}44`, borderRadius: 12, minWidth: 80 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: riskColor, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Risque</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: riskColor, lineHeight: 1 }}>{data.risk_score}<span style={{ fontSize: 12, fontWeight: 600 }}>%</span></div>
              <div style={{ fontSize: 10, color: riskColor, marginTop: 2, fontWeight: 600 }}>{riskLabel}</div>
            </div>

            {/* Durée */}
            <div style={{ textAlign: 'center', padding: '12px 20px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, minWidth: 80 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Durée</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb', lineHeight: 1 }}>
                {data.duration_min != null ? data.duration_min : '—'}<span style={{ fontSize: 12, fontWeight: 600 }}>{data.duration_min != null ? ' min' : ''}</span>
              </div>
              {data.extra_minutes ? <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2, fontWeight: 600 }}>+{data.extra_minutes} min extra</div> : <div style={{ height: 14 }} />}
            </div>

            {/* Bouton PDF */}
            <button onClick={downloadPDF} disabled={pdfLoading}
              style={{ padding: '14px 20px', background: pdfLoading ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: pdfLoading ? 'not-allowed' : 'pointer', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 90 }}>
              {pdfLoading
                ? <><i className="fas fa-spinner fa-spin" style={{ fontSize: 18 }} /><span style={{ fontSize: 11 }}>Génération…</span></>
                : <><i className="fas fa-file-pdf" style={{ fontSize: 18 }} /><span style={{ fontSize: 11 }}>Rapport PDF</span></>}
            </button>
          </div>
        </div>

        {/* Bande récap incidents */}
        <div style={{ borderTop: '1px solid var(--border)', background: '#f8fafc', padding: '10px 28px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Changements onglet', value: data.tab_switches,   icon: 'fa-window-maximize',    color: data.tab_switches   > 0 ? '#dc2626' : '#10b981' },
            { label: 'Avertissements',      value: data.warnings_count, icon: 'fa-triangle-exclamation', color: data.warnings_count > 0 ? '#d97706' : '#10b981' },
            { label: 'Sans-visage',          value: data.no_face_count,  icon: 'fa-user-slash',         color: data.no_face_count  > 0 ? '#dc2626' : '#10b981' },
            { label: 'Total incidents',      value: data.incidents.length, icon: 'fa-clipboard-list',   color: data.incidents.length > 0 ? '#ef4444' : '#10b981' },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <i className={`fas ${stat.icon}`} style={{ color: stat.color, fontSize: 13 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: stat.color }}>{stat.value}</span>
              <span style={{ fontSize: 12, color: '#64748b' }}>{stat.label}</span>
            </div>
          ))}
          {data.ban_reason && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <i className="fas fa-ban" style={{ color: '#dc2626', fontSize: 13 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>Exclu : </span>
              <span style={{ fontSize: 12, color: '#64748b' }}>{data.ban_reason}</span>
            </div>
          )}
        </div>
      </div>

      {/* Grille : Incidents | Notes surveillant */}
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Incidents */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: data.incidents.length > 0 ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className={`fas ${data.incidents.length > 0 ? 'fa-triangle-exclamation' : 'fa-check-circle'}`} style={{ color: data.incidents.length > 0 ? '#ef4444' : '#10b981', fontSize: 14 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: data.incidents.length > 0 ? '#dc2626' : '#15803d' }}>
              Incidents ({data.incidents.length})
            </span>
          </div>
          <div style={{ padding: '14px 20px', maxHeight: 260, overflowY: 'auto' }}>
            {data.incidents.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#10b981', fontWeight: 600, fontSize: 13 }}>
                <i className="fas fa-shield-alt" />Aucun incident détecté
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.incidents.slice(-20).map((inc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', background: i % 2 === 0 ? '#fef2f2' : 'white', borderRadius: 6 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', minWidth: 54 }}>
                      {inc.timestamp ? new Date(inc.timestamp).toLocaleTimeString('fr-FR') : '—'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
                      {INCIDENT_LABELS[inc.type] || inc.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notes surveillant */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: '#fffbeb', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-sticky-note" style={{ color: '#f59e0b', fontSize: 14 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>
              Notes surveillant ({data.proctor_notes.length})
            </span>
          </div>
          <div style={{ padding: '14px 20px', maxHeight: 260, overflowY: 'auto' }}>
            {data.proctor_notes.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Aucune note de surveillance enregistrée</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.proctor_notes.map((n, i) => (
                  <div key={i} style={{ background: '#fef3c7', borderLeft: '3px solid #f59e0b', padding: '10px 14px', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, marginBottom: 3 }}>
                      <i className="fas fa-user-shield" style={{ marginRight: 4 }} />
                      {n.author || '—'} — {n.timestamp ? new Date(n.timestamp).toLocaleString('fr-FR') : '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>{n.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Réponse étudiant */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-pencil-alt" style={{ color: '#475569', fontSize: 13 }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Réponse de l'étudiant</span>
        </div>
        <div style={{ padding: '18px 20px' }}>
          {displayAnswer && displayAnswer.trim() !== '' ? (
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13, color: '#334155', background: '#f8fafc', padding: 16, borderRadius: 10, maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', margin: 0, lineHeight: 1.8 }}>
              {displayAnswer.substring(0, 3000)}{displayAnswer.length > 3000 ? '\n\n…(réponse tronquée à 3000 caractères)' : ''}
            </pre>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>
              <i className="fas fa-inbox" />L'étudiant n'a pas rédigé de réponse
            </div>
          )}
        </div>
      </div>

      {/* Correction IA */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: '#f0f9ff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: '#dbeafe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-comment-dots" style={{ color: '#2563eb', fontSize: 13 }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1d4ed8' }}>Correction IA</span>
          {hasScore && (
            <span style={{ marginLeft: 'auto', background: scoreBg, color: scoreColor, padding: '3px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
              {data.score}/20 — {getMention(data.score as number)}
            </span>
          )}
        </div>
        <div style={{ padding: '18px 20px' }}>
          {data.feedback ? (
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13, color: '#1e3a5f', background: '#f0f9ff', padding: 16, borderRadius: 10, maxHeight: 420, overflowY: 'auto', border: '1px solid #bae6fd', margin: 0, lineHeight: 1.8 }}>
              {data.feedback.substring(0, 4000)}{data.feedback.length > 4000 ? '\n\n…(feedback tronqué à 4000 caractères)' : ''}
            </pre>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>
              <i className="fas fa-clock" />Pas encore corrigé par l'IA
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
