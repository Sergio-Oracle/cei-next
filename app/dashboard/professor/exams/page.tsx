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

/* ── Page principale ─────────────────────────────────────────────────────── */
export default function ProfessorExamsPage() {
  const { success, error } = useToast()
  const [exams, setExams]           = useState<OnlineExam[]>([])
  const [loading, setLoading]       = useState(true)
  const [actioning, setActioning]   = useState<number | null>(null)

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
      await api.post(`/api/online_exams/${id}/extend`, { extra_minutes: minutes })
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
                  onDelete={deleteExam} />
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
  exam, actioning, onActivate, onClose, onExtend, onDelete,
}: {
  exam: OnlineExam
  actioning: number | null
  onActivate: (id: number) => void
  onClose:    (id: number) => void
  onExtend:   (id: number) => void
  onDelete:   (id: number, title: string) => void
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
