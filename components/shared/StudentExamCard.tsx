'use client'

import Link from 'next/link'
import type { OnlineExam } from '@/types'

/* Carte d'examen côté étudiant (statut, horaires, règles de surveillance,
   bouton Composer / Reprendre / note). Partagée par « Mes examens » et la page
   ouverte depuis l'activité Moodle « Examens CEI » (/lti/course/<ec>). */

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
    <span style={{ background: bg, color, padding: '3px 9px', borderRadius: 99, fontSize:13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <i className={`fas ${icon}`} />{label}
    </span>
  )
}

export default function ExamCard({ exam }: { exam: OnlineExam }) {
  const now = new Date()
  const start = new Date(exam.start_time)
  const end   = new Date(exam.end_time)

  const effectiveStatus = exam.status === 'active' && now > end ? 'closed' : exam.status
  const sc = STATUS_CFG[effectiveStatus] ?? STATUS_CFG.draft
  // Le serveur n'autorise l'accès que si le statut est strictement "active"
  // (le professeur a cliqué "Activer") — "scheduled" avec l'heure déjà
  // arrivée ne suffit pas, sinon le bouton "Composer" mène à une erreur.
  const canCompose = now >= start && now <= end && exam.status === 'active'

  const att = exam.my_attempt

  // Détermine le bouton d'action
  let actionNode: React.ReactNode
  if (att) {
    if (att.status === 'in_progress' && canCompose) {
      actionNode = (
        <Link href={`/exam/${exam.id}`} style={btnStyle('#f59e0b', 'white')}>
          <i className="fas fa-redo" /> Reprendre l'examen
        </Link>
      )
    } else if (att.corrected_at && att.score !== null) {
      const clr = (att.score ?? 0) >= 10 ? '#10b981' : '#ef4444'
      actionNode = (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          <span style={{ fontWeight: 700, color: clr, fontSize:18, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fas fa-star" /> {Number(att.score).toFixed(2)}/20
          </span>
          <Link href="/dashboard/student/results" style={{ ...btnStyle('#2563eb', 'white'), flex: 1, textAlign: 'center' }}>
            <i className="fas fa-eye" /> Voir ma note
          </Link>
        </div>
      )
    } else if (att.pending_publication) {
      actionNode = (
        <span style={{ color: '#f59e0b', fontSize:15.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-gavel" /> En délibération
        </span>
      )
    } else if (att.status === 'banned') {
      actionNode = (
        <span style={{ color: '#ef4444', fontSize:15.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-ban" /> Exclu de l'examen
        </span>
      )
    } else if (att.submitted_at) {
      actionNode = (
        <span style={{ color: '#f59e0b', fontSize:15.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-hourglass-half" /> Correction en cours…
        </span>
      )
    } else {
      actionNode = (
        <span style={{ color: '#94a3b8', fontSize:15.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-check-circle" /> Déjà composé
        </span>
      )
    }
  } else if (canCompose) {
    actionNode = (
      <Link href={`/exam/${exam.id}`} style={{ ...btnStyle('#059669', 'white'), flex: 1, textAlign: 'center' }}>
        <i className="fas fa-play" /> Composer
      </Link>
    )
  } else if (now < start) {
    actionNode = (
      <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 14px', fontSize:15.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
        <i className="fas fa-clock" /> Pas encore ouvert
      </span>
    )
  } else if (now <= end && exam.status !== 'active') {
    // Plage horaire atteinte mais l'enseignant n'a pas encore cliqué "Activer"
    actionNode = (
      <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 14px', fontSize:15.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
        <i className="fas fa-hourglass-half" /> Ouverture imminente — patientez
      </span>
    )
  } else {
    actionNode = (
      <span style={{ color: '#94a3b8', fontSize:15.5, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="fas fa-check" /> Terminé
      </span>
    )
  }

  const maxNF = exam.max_no_face_count ?? 10

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,.07)', transition: 'box-shadow .2s, transform .2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>

      {/* Barre colorée statut */}
      <div style={{ height: 4, background: sc.bar }} />

      <div style={{ padding: '18px 20px', flex: 1 }}>
        {/* Titre + badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <h3 style={{ fontSize:18, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.35, flex: 1 }}>{exam.title}</h3>
          <span style={{ background: sc.bg, color: sc.color, padding: '4px 10px', borderRadius: 99, fontSize:13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <i className={`fas ${sc.icon}`} /> {sc.label}
          </span>
        </div>

        {/* Sujet */}
        {exam.subject_title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize:15.5, marginBottom: 12 }}>
            <i className="fas fa-book" style={{ color: '#3b82f6', width: 13 }} />
            <span>{exam.subject_title}</span>
          </div>
        )}

        {/* Dates + durée */}
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: 12, border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize:14.5, marginBottom: 5 }}>
            <i className="fas fa-play" style={{ color: '#10b981', fontSize: 11 }} />
            <span style={{ flex: 1 }}>{start.toLocaleString('fr-FR', LOCALE_OPTS)}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="fas fa-clock" style={{ color: '#3b82f6', fontSize: 13 }} /> {fmtDuration(exam.duration_minutes)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize:14.5 }}>
            <i className="fas fa-stop" style={{ color: '#ef4444', fontSize: 11 }} />
            <span>{end.toLocaleString('fr-FR', LOCALE_OPTS)}</span>
          </div>
        </div>

        {/* Badges sécurité */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <SecChip icon="fa-exchange-alt" label={`${exam.max_tab_switches ?? 2} chgt${(exam.max_tab_switches ?? 2) !== 1 ? 's' : ''}`} color="#c2410c" bg="#fff7ed" />
          {maxNF >= 0 && <SecChip icon="fa-eye-slash" label={`${maxNF} visage${maxNF !== 1 ? 's' : ''}`} color="#ef4444" bg="#fef2f2" />}
          {exam.ban_on_devtools     && <SecChip icon="fa-terminal" label="Dev ban"   color="#1d4ed8" bg="#eff6ff" />}
          {!exam.enable_copy_paste  && <SecChip icon="fa-ban"      label="C/C"        color="#64748b" bg="#f1f5f9" />}
          {!exam.enable_right_click && <SecChip icon="fa-ban"      label="Clic droit" color="#64748b" bg="#f1f5f9" />}
          {exam.auto_correct        && <SecChip icon="fa-robot"    label="IA auto"    color="#15803d" bg="#f0fdf4" />}
        </div>
      </div>

      {/* Footer action */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: '#fafafa', display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        {actionNode}
      </div>
    </div>
  )
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', background: bg, color, border: 'none', borderRadius: 8, fontSize:15.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', flex: 1 }
}
