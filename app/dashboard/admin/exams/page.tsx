'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam } from '@/types'
import ExamDetailModal from './ExamDetailModal'
import ExamCopiesModal from './ExamCopiesModal'
import ProctorsManageModal from './ProctorsManageModal'

/* ── Helpers ───────────────────────────────────────────────────── */
type ExamStatus = 'draft' | 'scheduled' | 'active' | 'closed'

function fmtDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ', ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_META: Record<ExamStatus, { label: string; color: string; bg: string; border: string; borderCard: string }> = {
  draft:     { label: 'Brouillon', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', borderCard: '#94a3b8' },
  scheduled: { label: 'Planifié',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', borderCard: '#f59e0b' },
  active:    { label: 'Actif',     color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', borderCard: '#10b981' },
  closed:    { label: 'Clôturé',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca', borderCard: '#ef4444' },
}

function StatusBadge({ status }: { status: ExamStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft
  return (
    <span style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
      {m.label}
    </span>
  )
}

function SecPill({ icon, value, title, color = '#64748b', bg = '#f1f5f9' }: { icon: string; value: string | number; title?: string; color?: string; bg?: string }) {
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color, border: `1px solid ${color}20`, borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      <i className={`fas ${icon}`} style={{ fontSize: 9 }} />{value}
    </span>
  )
}

/* ── Page ──────────────────────────────────────────────────────── */
export default function AdminExamsPage() {
  const { success, error } = useToast()
  const [exams,    setExams]    = useState<OnlineExam[]>([])
  const [loading,  setLoading]  = useState(true)
  const [actioning, setActioning] = useState<number | null>(null)

  /* Modals */
  const [detailExam,  setDetailExam]  = useState<OnlineExam | null>(null)
  const [copiesExamId, setCopiesExamId] = useState<number | null>(null)
  const [copiesTitle,  setCopiesTitle]  = useState('')
  const [proctorsExamId, setProctorsExamId] = useState<number | null>(null)

  /* Rallonger modal */
  const [extendId,   setExtendId]   = useState<number | null>(null)
  const [extendMin,  setExtendMin]  = useState('15')
  const [extending,  setExtending]  = useState(false)

  /* Interval for auto-refresh while an exam is active */
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    load()
    return () => { if (refreshRef.current) clearInterval(refreshRef.current) }
  }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<OnlineExam[]>('/api/online_exams')
      const list = Array.isArray(res) ? res : (res as any).exams ?? []
      setExams(list)
      /* Auto-refresh every 30s if there's an active exam */
      if (refreshRef.current) clearInterval(refreshRef.current)
      if (list.some((e: OnlineExam) => e.status === 'active')) {
        refreshRef.current = setInterval(() => load(), 30_000)
      }
    } catch { error('Erreur de chargement des examens') }
    finally { setLoading(false) }
  }

  async function activate(id: number) {
    setActioning(id)
    try {
      await api.post(`/api/online_exams/${id}/activate`, {})
      success('Examen activé — les étudiants peuvent maintenant le rejoindre')
      setExams(prev => prev.map(e => e.id === id ? { ...e, status: 'active' as ExamStatus } : e))
    } catch (e: any) { error(e.message || 'Erreur lors de l\'activation') }
    finally { setActioning(null) }
  }

  async function closeExam(id: number) {
    if (!confirm('Clôturer cet examen ? Les étudiants en cours seront automatiquement soumis.')) return
    setActioning(id)
    try {
      await api.post(`/api/online_exams/${id}/close`, {})
      success('Examen clôturé')
      setExams(prev => prev.map(e => e.id === id ? { ...e, status: 'closed' as ExamStatus } : e))
    } catch (e: any) { error(e.message || 'Erreur clôture') }
    finally { setActioning(null) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer cet examen et toutes ses données ?')) return
    setActioning(id)
    try {
      await api.delete(`/api/online_exams/${id}`)
      success('Examen supprimé')
      setExams(prev => prev.filter(e => e.id !== id))
    } catch (e: any) { error(e.message || 'Erreur suppression') }
    finally { setActioning(null) }
  }

  async function handleExtend() {
    if (!extendId) return
    const min = parseInt(extendMin)
    if (!min || min < 1 || min > 300) { error('Durée invalide (1–300 min)'); return }
    setExtending(true)
    try {
      await api.post(`/api/online_exams/${extendId}/extend`, { extra_minutes: min })
      success(`Examen rallongé de ${min} minutes`)
      await load()
      setExtendId(null)
    } catch (e: any) { error(e.message || 'Erreur rallonge') }
    finally { setExtending(false) }
  }

  const counts = {
    total:     exams.length,
    active:    exams.filter(e => e.status === 'active').length,
    scheduled: exams.filter(e => e.status === 'scheduled').length,
    closed:    exams.filter(e => e.status === 'closed' || e.status === 'draft').length,
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-desktop" style={{ color: 'var(--primary)', fontSize: 20 }} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Examens en Ligne</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Créez et gérez des examens avec surveillance anti-triche</p>
          </div>
        </div>
        <Link href="/dashboard/admin/exams/new" className="btn btn-primary">
          <i className="fa-solid fa-plus" /> Créer un Examen
        </Link>
      </div>

      {/* ── Stats ── */}
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { icon: 'fa-list', label: 'Total',     value: counts.total,     color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
          { icon: 'fa-play', label: 'En cours',  value: counts.active,    color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
          { icon: 'fa-calendar-check', label: 'Planifiés', value: counts.scheduled, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
          { icon: 'fa-flag-checkered', label: 'Terminés',  value: counts.closed,    color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 42, height: 42, background: '#fff', border: `1.5px solid ${s.border}`, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`fas ${s.icon}`} style={{ color: s.color, fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginTop: 4, opacity: .8 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 20, height: 220 }}>
              <div style={{ width: '60%', height: 16, background: 'var(--border)', borderRadius: 6, marginBottom: 12 }} />
              <div style={{ width: '40%', height: 12, background: 'var(--border)', borderRadius: 6, marginBottom: 20 }} />
              <div style={{ width: '80%', height: 12, background: 'var(--border)', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ width: '50%', height: 12, background: 'var(--border)', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ width: 64, height: 64, background: '#eff6ff', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="fas fa-desktop" style={{ fontSize: 28, color: 'var(--primary)' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Aucun examen créé</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Créez votre premier examen en ligne avec surveillance IA</div>
          <Link href="/dashboard/admin/exams/new" className="btn btn-primary">
            <i className="fas fa-plus" /> Créer un Examen
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {exams.map(exam => {
            const meta   = STATUS_META[exam.status as ExamStatus] ?? STATUS_META.draft
            const busy   = actioning === exam.id
            const isDraft     = exam.status === 'draft'
            const isScheduled = exam.status === 'scheduled'
            const isActive    = exam.status === 'active'
            const isClosed    = exam.status === 'closed'

            return (
              <div key={exam.id} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', borderLeft: `4px solid ${meta.borderCard}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,.06)', transition: 'box-shadow .2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,.12)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'}>

                {/* Card top */}
                <div style={{ padding: '16px 18px 12px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.4, flex: 1 }}>{exam.title}</div>
                    <StatusBadge status={exam.status as ExamStatus} />
                  </div>

                  {/* Subject */}
                  {exam.subject_title && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                      <i className="fas fa-book" style={{ color: 'var(--primary)', fontSize: 11, marginTop: 3, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{exam.subject_title}</span>
                    </div>
                  )}

                  {/* Creator */}
                  {exam.creator_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <i className="fas fa-user-tie" style={{ color: 'var(--text-muted)', fontSize: 11 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{exam.creator_name}</span>
                    </div>
                  )}

                  {/* Dates + durée */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <i className="fas fa-play" style={{ color: '#10b981', fontSize: 9 }} />
                        <span style={{ color: 'var(--text)' }}>{exam.start_time ? fmtDate(exam.start_time) : '—'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <i className="fas fa-stop" style={{ color: '#ef4444', fontSize: 9 }} />
                        <span style={{ color: 'var(--text)' }}>{exam.end_time ? fmtDate(exam.end_time) : '—'}</span>
                      </div>
                    </div>
                    <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 99, padding: '4px 12px', fontSize: 13, fontWeight: 800, color: 'var(--primary)', flexShrink: 0 }}>
                      {fmtDuration(exam.duration_minutes)}
                    </div>
                  </div>

                  {/* Indicateurs de sécurité — couleurs et logique identiques à la plateforme d'origine */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    <SecPill icon="fa-exchange-alt" value={`${exam.max_tab_switches ?? 2} chgt${(exam.max_tab_switches ?? 2) !== 1 ? 's' : ''}`} title="Seuil changements de fenêtre" color="#c2410c" bg="#fff7ed" />
                    {(exam.max_no_face_count == null || exam.max_no_face_count >= 0) && (
                      <SecPill icon="fa-eye-slash" value={`${exam.max_no_face_count ?? 10} visage${(exam.max_no_face_count ?? 10) !== 1 ? 's' : ''}`} title="Seuil visage absent" color="#ef4444" bg="#fef2f2" />
                    )}
                    {exam.ban_on_devtools     && <SecPill icon="fa-terminal" value="Dev ban"   title="Bannissement si outils dev"   color="#1d4ed8" bg="#eff6ff" />}
                    {!exam.enable_copy_paste  && <SecPill icon="fa-ban"      value="C/C"        title="Copier-Coller interdit"       color="#64748b" bg="#f1f5f9" />}
                    {!exam.enable_right_click && <SecPill icon="fa-ban"      value="Clic droit" title="Clic droit interdit"          color="#64748b" bg="#f1f5f9" />}
                    {exam.auto_correct        && <SecPill icon="fa-robot"    value="IA auto"    title="Correction automatique par IA activée" color="#15803d" bg="#f0fdf4" />}
                    <SecPill icon="fa-users" value={`${exam.attempts_count ?? 0}`} title="Participants" color="#2563eb" bg="#eff6ff" />
                  </div>
                </div>

                {/* Card footer — boutons */}
                <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--background)' }}>
                  {/* Détails — toujours présent */}
                  <button onClick={() => setDetailExam(exam)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    <i className="fas fa-eye" />Détails
                  </button>

                  {/* Copies (clôturé uniquement) */}
                  {isClosed && (
                    <button onClick={() => { setCopiesExamId(exam.id); setCopiesTitle(exam.title) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
                      <i className="fas fa-file-lines" />Copies
                    </button>
                  )}

                  {/* Surveillants (planifié ou actif) */}
                  {(isScheduled || isActive) && (
                    <button onClick={() => setProctorsExamId(exam.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#92400e', cursor: 'pointer' }}>
                      <i className="fas fa-user-shield" />Surveillants
                    </button>
                  )}

                  {/* Activer (brouillon ou planifié) */}
                  {(isDraft || isScheduled) && (
                    <button onClick={() => activate(exam.id)} disabled={busy}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#059669', cursor: busy ? 'not-allowed' : 'pointer' }}>
                      {busy ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-play" />}Activer
                    </button>
                  )}

                  {/* Rallonger (actif ou planifié) */}
                  {(isActive || isScheduled) && (
                    <button onClick={() => { setExtendId(exam.id); setExtendMin('15') }} disabled={busy}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#92400e', cursor: busy ? 'not-allowed' : 'pointer' }}>
                      <i className="fas fa-clock" />Rallonger
                    </button>
                  )}

                  {/* Clôturer (actif) */}
                  {isActive && (
                    <button onClick={() => closeExam(exam.id)} disabled={busy}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#dc2626', cursor: busy ? 'not-allowed' : 'pointer' }}>
                      <i className="fas fa-flag-checkered" />Clôturer
                    </button>
                  )}

                  {/* Éditer (brouillon ou planifié) */}
                  {(isDraft || isScheduled) && (
                    <Link href={`/dashboard/admin/exams/${exam.id}?tab=edit`}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none' }}>
                      <i className="fas fa-pencil" />Éditer
                    </Link>
                  )}

                  {/* Supprimer — toujours en dernier, icône seulement */}
                  <button onClick={() => handleDelete(exam.id)} disabled={busy} title="Supprimer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', cursor: busy ? 'not-allowed' : 'pointer', marginLeft: 'auto' }}>
                    <i className="fas fa-trash" style={{ fontSize: 12 }} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Rallonger ── */}
      {extendId !== null && (
        <div onClick={e => { if (e.target === e.currentTarget) setExtendId(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-clock" style={{ color: '#d97706' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Rallonger l'examen</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Ajouter du temps supplémentaire</p>
              </div>
              <button onClick={() => setExtendId(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                <i className="fas fa-plus-circle" style={{ color: 'var(--primary)', marginRight: 6 }} />
                Durée supplémentaire (minutes)
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[5, 10, 15, 30].map(v => (
                  <button key={v} onClick={() => setExtendMin(String(v))}
                    style={{ flex: 1, padding: '8px 0', border: `1.5px solid ${extendMin === String(v) ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, background: extendMin === String(v) ? '#eff6ff' : 'var(--surface)', color: extendMin === String(v) ? 'var(--primary)' : 'var(--text)', fontWeight: extendMin === String(v) ? 700 : 400, fontSize: 13, cursor: 'pointer' }}>
                    {v} min
                  </button>
                ))}
              </div>
              <input type="number" min={1} max={300} value={extendMin} onChange={e => setExtendMin(e.target.value)}
                className="form-control" style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }} />
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setExtendId(null)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleExtend} disabled={extending} className="btn btn-primary" style={{ minWidth: 130 }}>
                {extending ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />Rallonge…</> : <><i className="fas fa-clock" style={{ marginRight: 6 }} />Confirmer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Détails ── */}
      {detailExam && (
        <ExamDetailModal
          exam={detailExam}
          onClose={() => setDetailExam(null)}
          onViewCopies={(id) => { setCopiesExamId(id); setCopiesTitle(detailExam.title) }}
          onActivate={async (id) => { await activate(id) }}
          onClose_={async (id) => { await closeExam(id) }}
          onDelete={async (id) => { await handleDelete(id) }}
        />
      )}

      {/* ── Modal Copies ── */}
      {copiesExamId !== null && (
        <ExamCopiesModal
          examId={copiesExamId}
          examTitle={copiesTitle}
          onClose={() => setCopiesExamId(null)}
        />
      )}

      {/* ── Modal Surveillants ── */}
      {proctorsExamId !== null && (
        <ProctorsManageModal
          examId={proctorsExamId}
          onClose={() => setProctorsExamId(null)}
        />
      )}
    </div>
  )
}
