'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam } from '@/types'

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

export default function StudentExamsPage() {
  const { error } = useToast()
  const router = useRouter()
  const [exams, setExams] = useState<OnlineExam[]>([])
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    load()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (refreshRef.current) clearInterval(refreshRef.current)
    }
  }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const list = await api.get<OnlineExam[]>('/api/online_exams')
      const exams = Array.isArray(list) ? list : (list as any).exams ?? []
      setExams(exams)

      // Auto-refresh toutes les 30s s'il y a un examen actif
      if (refreshRef.current) clearInterval(refreshRef.current)
      if (exams.some((e: OnlineExam) => e.status === 'active')) {
        refreshRef.current = setInterval(() => load(), 30_000)
      }

      // Programmer un refresh au prochain changement d'état
      const nowMs = Date.now()
      const nextMs = exams
        .flatMap((e: OnlineExam) => [new Date(e.start_time).getTime(), new Date(e.end_time).getTime()])
        .filter((t: number) => t > nowMs)
        .sort((a: number, b: number) => a - b)[0]
      if (nextMs) {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => load(), Math.min(nextMs - nowMs + 1500, 3_600_000))
      }
    } catch { error('Erreur de chargement des examens') }
    finally { setLoading(false) }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#3b82f6', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-laptop-code" style={{ color: 'white', fontSize: 18 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Mes Examens en Ligne</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{exams.length} examen(s) disponible(s)</p>
          </div>
        </div>
        <Link href="/dashboard/student/results"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          <i className="fas fa-history" /> Mon historique
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} />
        </div>
      ) : exams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <i className="fas fa-laptop-code" style={{ fontSize: 52, color: '#cbd5e1', display: 'block', marginBottom: 16 }} />
          <h3 style={{ color: '#475569', fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Aucun examen disponible</h3>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Vos examens apparaîtront ici lorsqu'ils seront planifiés.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {exams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
        </div>
      )}
    </div>
  )
}

function ExamCard({ exam }: { exam: OnlineExam }) {
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
          <span style={{ fontWeight: 700, color: clr, fontSize: 15, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fas fa-star" /> {Number(att.score).toFixed(2)}/20
          </span>
          <Link href="/dashboard/student/results" style={{ ...btnStyle('#2563eb', 'white'), flex: 1, textAlign: 'center' }}>
            <i className="fas fa-eye" /> Voir ma note
          </Link>
        </div>
      )
    } else if (att.status === 'banned') {
      actionNode = (
        <span style={{ color: '#ef4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-ban" /> Exclu de l'examen
        </span>
      )
    } else if (att.submitted_at) {
      actionNode = (
        <span style={{ color: '#f59e0b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-hourglass-half" /> Correction en cours…
        </span>
      )
    } else {
      actionNode = (
        <span style={{ color: '#94a3b8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
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
      <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
        <i className="fas fa-clock" /> Pas encore ouvert
      </span>
    )
  } else if (now <= end && exam.status !== 'active') {
    // Plage horaire atteinte mais l'enseignant n'a pas encore cliqué "Activer"
    actionNode = (
      <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
        <i className="fas fa-hourglass-half" /> Ouverture imminente — patientez
      </span>
    )
  } else {
    actionNode = (
      <span style={{ color: '#94a3b8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
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
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.35, flex: 1 }}>{exam.title}</h3>
          <span style={{ background: sc.bg, color: sc.color, padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <i className={`fas ${sc.icon}`} /> {sc.label}
          </span>
        </div>

        {/* Sujet */}
        {exam.subject_title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
            <i className="fas fa-book" style={{ color: '#3b82f6', width: 13 }} />
            <span>{exam.subject_title}</span>
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
            <i className="fas fa-stop" style={{ color: '#ef4444', fontSize: 9 }} />
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
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', background: bg, color, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', flex: 1 }
}
