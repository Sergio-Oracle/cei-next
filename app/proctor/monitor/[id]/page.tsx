'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

/* ── Interfaces ──────────────────────────────────────────────────────────── */

interface Student {
  attempt_id:       number
  student_name:     string
  student_email:    string
  status:           string
  risk_score:       number
  warnings_count:   number
  tab_switches:     number
  no_face_count:    number
  started_at:       string | null
  submitted_at:     string | null
  score:            number | null
  ban_reason:       string | null
  duration_minutes: number | null
  extra_minutes:    number | null
  proctor_name:     string | null
  has_pre_sig:      boolean
  has_post_sig:     boolean
}

interface Proctor {
  id:          number
  name:        string
  email?:      string
  online?:     boolean
  student_count?: number
}

interface Data {
  exam_title:  string
  exam_status: string
  my_role:     string
  my_identity: string | null
  attempts:    Student[]
  proctors:    Proctor[]
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function riskCls(s: number) { return s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low' }

function elapsed(iso: string | null) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 60) return `${d}s`
  if (d < 3600) return `${Math.floor(d / 60)} min`
  return `${Math.floor(d / 3600)}h${String(Math.floor((d % 3600) / 60)).padStart(2, '0')}`
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const RISK_CLR: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }
const RISK_BG:  Record<string, string> = { low: 'rgba(16,185,129,.2)', medium: 'rgba(245,158,11,.2)', high: 'rgba(239,68,68,.2)' }

/* ── Page ────────────────────────────────────────────────────────────────── */

type Filter = 'all' | 'in_progress' | 'high_risk' | 'banned'

export default function ProfessorMonitorPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { success, error: toastErr } = useToast()

  const [data, setData]           = useState<Data | null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter]       = useState<Filter>('in_progress')
  const [search, setSearch]       = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* Message / warn modal */
  const [msgModal, setMsgModal]   = useState<{ attemptId: number; name: string; type: 'message' | 'warning' } | null>(null)
  const [msgText, setMsgText]     = useState('')
  const [sending, setSending]     = useState(false)

  /* ── Load ──────────────────────────────────────────────────────────────── */

  const load = useCallback(async (bg = false) => {
    if (bg) setRefreshing(true)
    try {
      const res = await api.get<Data>(`/api/online_exams/${id}/active_proctoring`)
      setData(res)
    } catch (e: any) {
      if (!bg) toastErr(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id]) // eslint-disable-line

  useEffect(() => {
    load()
    pollRef.current = setInterval(() => load(true), 8_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  /* ── Actions ───────────────────────────────────────────────────────────── */

  async function sendMsg() {
    if (!msgModal || !msgText.trim()) return
    setSending(true)
    try {
      const endpoint = msgModal.type === 'warning'
        ? `/api/exam_attempts/${msgModal.attemptId}/warn`
        : `/api/exam_attempts/${msgModal.attemptId}/message`
      await api.post(endpoint, msgModal.type === 'warning'
        ? { message: msgText }
        : { content: msgText })
      success(msgModal.type === 'warning' ? 'Avertissement envoyé' : 'Message envoyé')
      setMsgModal(null)
      setMsgText('')
    } catch (e: any) { toastErr(e.message || 'Erreur') }
    finally { setSending(false) }
  }

  /* ── Derived stats ─────────────────────────────────────────────────────── */

  const students  = data?.attempts ?? []
  const inProgress = students.filter(s => s.status === 'in_progress')
  const completed  = students.filter(s => ['submitted', 'auto_submitted'].includes(s.status))
  const banned     = students.filter(s => s.status === 'banned')
  const scored     = completed.filter(s => s.score != null)
  const avgScore   = scored.length ? (scored.reduce((a, s) => a + (s.score!), 0) / scored.length) : null
  const avgRisk    = students.length ? Math.round(students.reduce((a, s) => a + (s.risk_score || 0), 0) / students.length) : 0

  /* ── Filter ────────────────────────────────────────────────────────────── */

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.student_name.toLowerCase().includes(q) || (s.student_email || '').toLowerCase().includes(q)
    if (!matchSearch) return false
    if (filter === 'in_progress') return s.status === 'in_progress'
    if (filter === 'high_risk')   return s.risk_score >= 60
    if (filter === 'banned')      return s.status === 'banned'
    return true
  })

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
        <div style={{ fontSize: 15, fontWeight: 600 }}>Chargement du dashboard…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const examTitle  = data?.exam_title  || 'Examen'
  const examStatus = data?.exam_status || '?'
  const proctors   = data?.proctors    ?? []

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <style>{`
        @keyframes spin  { to   { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1;transform:scale(1) } 50% { opacity:.6;transform:scale(.9) } }
        .monitor-filter-btn { padding:6px 14px;border:2px solid rgba(255,255,255,.15);background:transparent;color:rgba(255,255,255,.7);border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s; }
        .monitor-filter-btn:hover,.monitor-filter-btn.active { border-color:#3b82f6;background:#3b82f6;color:white; }
        .monitor-table { width:100%;border-collapse:collapse; }
        .monitor-table th { font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.35);padding:8px 14px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);font-weight:600;letter-spacing:.06em; }
        .monitor-table td { padding:10px 14px;font-size:12px;color:rgba(255,255,255,.75);border-bottom:1px solid rgba(255,255,255,.04); }
        .monitor-table tr:last-child td { border-bottom:none; }
        .monitor-table tr:hover td { background:rgba(255,255,255,.03); }
        .monitor-action-btn { display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:5px;font-size:10px;cursor:pointer;border:none;font-weight:600; }
      `}</style>

      {/* ════ HEADER ════════════════════════════════════════════════════════ */}
      <div style={{ background: '#1e3a5f', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 2px 12px rgba(0,0,0,.3)', flexWrap: 'wrap', gap: 10 }}>
        {/* Left: title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            <i className="fas fa-chalkboard-teacher" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{examTitle}</div>
            <div style={{ fontSize: 11, opacity: .7 }}>Vue pédagogique enseignant · Statut: {examStatus}</div>
          </div>
        </div>

        {/* Center: stat pills */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* LIVE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(255,255,255,.15)', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite', display: 'inline-block' }} />
            LIVE
          </div>
          <Pill icon="fa-users"              label={`${inProgress.length} actifs`}       bg="rgba(255,255,255,.12)" />
          <Pill icon="fa-exclamation-triangle" label={`${students.filter(s=>s.risk_score>=60).length} risque élevé`} bg="rgba(239,68,68,.3)" />
          <Pill icon="fa-ban"                label={`${banned.length} bannis`}            bg="rgba(239,68,68,.2)" />
          <Pill icon="fa-check-circle"       label={`${completed.length} terminés`}       bg="rgba(16,185,129,.3)" />
          {avgScore != null && (
            <Pill icon="fa-star" label={`Note moy. ${avgScore.toFixed(1)}/20`} bg="rgba(59,130,246,.3)" />
          )}
        </div>

        {/* Right: buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => load(true)} style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: 'rgba(255,255,255,.15)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {refreshing ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-sync-alt" />}
          </button>
          <button onClick={() => router.back()} style={{ padding: '7px 16px', border: 'none', borderRadius: 7, background: 'rgba(255,255,255,.15)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-arrow-left" /> Retour
          </button>
        </div>
      </div>

      {/* ════ BODY ══════════════════════════════════════════════════════════ */}
      <div style={{ padding: '20px 24px', maxWidth: 1600, margin: '0 auto' }}>

        {/* ── Agent IA block ─────────────────────────────────────────────── */}
        <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 38, height: 38, background: 'rgba(16,185,129,.15)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-robot" style={{ color: '#6ee7b7', fontSize: 18 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#d1fae5' }}>Agent IA Autonome</span>
              <span style={{ background: 'rgba(16,185,129,.25)', color: '#6ee7b7', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>EN SERVICE</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>Surveillance automatisée active — détection de triche en temps réel</div>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 11, color: 'rgba(255,255,255,.45)', flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#6ee7b7' }}>{students.length}</div>
              <div>étudiant(s)</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>{students.reduce((a,s) => a + (s.warnings_count || 0), 0)}</div>
              <div>alerte(s)</div>
            </div>
          </div>
        </div>

        {/* ── Surveillants humains ──────────────────────────────────────── */}
        {proctors.length > 0 && (
          <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              <i className="fas fa-user-tie" style={{ marginRight: 5 }} />Surveillants humains connectés
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {proctors.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', background: 'rgba(255,255,255,.06)', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.online ? '#10b981' : '#64748b', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>{p.name}</span>
                  {p.student_count != null && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>({p.student_count} étud.)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats grid ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 16 }}>
          {[
            { label: 'Total',      val: students.length,    color: '#f1f5f9'  },
            { label: 'En cours',   val: inProgress.length,  color: '#10b981'  },
            { label: 'Terminés',   val: completed.length,   color: '#6ee7b7'  },
            { label: 'Exclus',     val: banned.length,      color: '#f87171'  },
            { label: 'Note moy.',  val: avgScore != null ? `${avgScore.toFixed(1)}/20` : '—', color: '#93c5fd' },
            { label: 'Risque moy.', val: `${avgRisk}%`,     color: '#fcd34d'  },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 18px', background: 'rgba(255,255,255,.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,.08)', minWidth: 90 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.val}</div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(255,255,255,.4)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filter + search ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          {(['all', 'in_progress', 'high_risk', 'banned'] as Filter[]).map(f => (
            <button key={f} className={`monitor-filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Tous' : f === 'in_progress' ? 'En cours' : f === 'high_risk' ? 'Risque élevé' : 'Bannis'}
            </button>
          ))}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un étudiant…"
            style={{ padding: '7px 14px', border: '2px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.05)', color: 'white', borderRadius: 20, fontSize: 12, outline: 'none', width: 200 }}
          />
        </div>

        {/* ── Section : En cours ───────────────────────────────────────── */}
        <TableSection
          title="En cours" dotColor="#10b981" badgeBg="rgba(16,185,129,.2)" badgeColor="#6ee7b7"
          count={inProgress.length} show={filter === 'all' || filter === 'in_progress' || filter === 'high_risk'}>
          <table className="monitor-table">
            <thead><tr>
              <th>Étudiant</th><th>Démarré à</th><th>Durée</th><th>Risque</th>
              <th>Tabs / Alertes</th><th>Surveillant</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {inProgress
                .filter(s => {
                  const q = search.toLowerCase()
                  const match = !q || s.student_name.toLowerCase().includes(q) || (s.student_email||'').toLowerCase().includes(q)
                  if (!match) return false
                  if (filter === 'high_risk') return s.risk_score >= 60
                  return true
                })
                .map(s => {
                  const rc = riskCls(s.risk_score)
                  return (
                    <tr key={s.attempt_id}>
                      <td>
                        <strong style={{ color: 'rgba(255,255,255,.9)' }}>{s.student_name}</strong><br />
                        <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 10 }}>{s.student_email}</span>
                      </td>
                      <td>{fmtTime(s.started_at)}</td>
                      <td>{elapsed(s.started_at)}</td>
                      <td><span style={{ background: RISK_BG[rc], color: RISK_CLR[rc], padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{s.risk_score || 0}%</span></td>
                      <td>
                        <span style={{ color: s.tab_switches > 2 ? '#fcd34d' : 'rgba(255,255,255,.5)' }}>Tabs: {s.tab_switches || 0}</span>
                        {' · '}
                        <span style={{ color: s.warnings_count > 0 ? '#fca5a5' : 'rgba(255,255,255,.5)' }}>Alertes: {s.warnings_count || 0}</span>
                      </td>
                      <td style={{ color: 'rgba(255,255,255,.6)' }}>{s.proctor_name || '—'}</td>
                      <td>
                        <button className="monitor-action-btn" onClick={() => { setMsgModal({ attemptId: s.attempt_id, name: s.student_name, type: 'message' }); setMsgText('') }}
                          style={{ background: 'rgba(37,99,235,.2)', color: '#93c5fd', marginRight: 4 }}>
                          <i className="fas fa-comment" /> Message
                        </button>
                        <button className="monitor-action-btn" onClick={() => { setMsgModal({ attemptId: s.attempt_id, name: s.student_name, type: 'warning' }); setMsgText('') }}
                          style={{ background: 'rgba(245,158,11,.2)', color: '#fcd34d' }}>
                          <i className="fas fa-exclamation-triangle" /> Avertir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              {inProgress.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,.3)' }}>Aucun étudiant en cours</td></tr>
              )}
            </tbody>
          </table>
        </TableSection>

        {/* ── Section : Terminés ───────────────────────────────────────── */}
        <TableSection
          title="Terminés" icon="fa-check-circle" iconColor="#10b981" badgeBg="rgba(16,185,129,.2)" badgeColor="#6ee7b7"
          count={completed.length} show={filter === 'all'}>
          <table className="monitor-table">
            <thead><tr>
              <th>Étudiant</th><th>Statut</th><th>Soumis à</th><th>Note</th><th>Risque</th><th>Surveillant</th>
            </tr></thead>
            <tbody>
              {completed
                .filter(s => { const q = search.toLowerCase(); return !q || s.student_name.toLowerCase().includes(q) })
                .map(s => {
                  const rc = riskCls(s.risk_score)
                  const isAuto = s.status === 'auto_submitted'
                  return (
                    <tr key={s.attempt_id}>
                      <td>
                        <strong style={{ color: 'rgba(255,255,255,.9)' }}>{s.student_name}</strong><br />
                        <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 10 }}>{s.student_email}</span>
                      </td>
                      <td>
                        {isAuto
                          ? <span style={{ background: 'rgba(99,102,241,.2)', color: '#c7d2fe', borderRadius: 4, padding: '2px 7px', fontSize: 10 }}>Auto</span>
                          : <span style={{ background: 'rgba(16,185,129,.2)', color: '#6ee7b7', borderRadius: 4, padding: '2px 7px', fontSize: 10 }}>Soumis</span>}
                      </td>
                      <td>{fmtTime(s.submitted_at)}</td>
                      <td style={{ fontWeight: 700, color: s.score != null ? '#93c5fd' : 'rgba(255,255,255,.4)' }}>
                        {s.score != null ? `${s.score}/20` : '—'}
                      </td>
                      <td><span style={{ background: RISK_BG[rc], color: RISK_CLR[rc], padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{s.risk_score || 0}%</span></td>
                      <td style={{ color: 'rgba(255,255,255,.6)' }}>{s.proctor_name || '—'}</td>
                    </tr>
                  )
                })}
              {completed.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,.3)' }}>Aucune copie soumise</td></tr>
              )}
            </tbody>
          </table>
        </TableSection>

        {/* ── Section : Exclus ─────────────────────────────────────────── */}
        <TableSection
          title="Exclus" icon="fa-ban" iconColor="#ef4444" badgeBg="rgba(239,68,68,.2)" badgeColor="#fca5a5"
          count={banned.length} show={filter === 'all' || filter === 'banned'}>
          <table className="monitor-table">
            <thead><tr>
              <th>Étudiant</th><th>Motif d'exclusion</th><th>Risque</th><th>Surveillant</th>
            </tr></thead>
            <tbody>
              {banned
                .filter(s => { const q = search.toLowerCase(); return !q || s.student_name.toLowerCase().includes(q) })
                .map(s => {
                  const rc = riskCls(s.risk_score)
                  return (
                    <tr key={s.attempt_id}>
                      <td>
                        <strong style={{ color: 'rgba(255,255,255,.9)' }}>{s.student_name}</strong><br />
                        <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 10 }}>{s.student_email}</span>
                      </td>
                      <td style={{ color: '#fca5a5' }}>{s.ban_reason || '—'}</td>
                      <td><span style={{ background: RISK_BG[rc], color: RISK_CLR[rc], padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{s.risk_score || 0}%</span></td>
                      <td style={{ color: 'rgba(255,255,255,.6)' }}>{s.proctor_name || '—'}</td>
                    </tr>
                  )
                })}
              {banned.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,.3)' }}>Aucun étudiant exclu</td></tr>
              )}
            </tbody>
          </table>
        </TableSection>

        {/* ── Grille cartes étudiants ───────────────────────────────────── */}
        {filteredStudents.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
              <i className="fas fa-th-large" style={{ marginRight: 6 }} />Cartes étudiants ({filteredStudents.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {filteredStudents.map(s => <StudentCard key={s.attempt_id} s={s} onMsg={(type) => { setMsgModal({ attemptId: s.attempt_id, name: s.student_name, type }); setMsgText('') }} />)}
            </div>
          </div>
        )}
      </div>

      {/* ════ MODAL MESSAGE / AVERTISSEMENT ════════════════════════════════ */}
      {msgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e293b', color: 'white', padding: 28, borderRadius: 16, maxWidth: 440, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,.5)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className={`fas ${msgModal.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-comment'}`}
                style={{ color: msgModal.type === 'warning' ? '#f59e0b' : '#3b82f6' }} />
              {msgModal.type === 'warning' ? 'Envoyer un avertissement' : 'Envoyer un message'}
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 16 }}>À : <strong>{msgModal.name}</strong></p>
            <textarea
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              rows={4}
              placeholder={msgModal.type === 'warning' ? "Motif de l'avertissement…" : 'Votre message…'}
              style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,.05)', border: '2px solid rgba(255,255,255,.15)', color: 'white', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'none', marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMsgModal(null)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,.1)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Annuler</button>
              <button onClick={sendMsg} disabled={sending || !msgText.trim()}
                style={{ padding: '8px 16px', background: msgModal.type === 'warning' ? '#f59e0b' : '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: (sending || !msgText.trim()) ? .6 : 1 }}>
                {sending ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
                {msgModal.type === 'warning' ? 'Avertir' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Pill({ icon, label, bg }: { icon: string; label: string; bg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: bg, borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      <i className={`fas ${icon}`} />{label}
    </div>
  )
}

function TableSection({
  title, count, show, dotColor, icon, iconColor, badgeBg, badgeColor, children,
}: {
  title: string; count: number; show: boolean
  dotColor?: string; icon?: string; iconColor?: string
  badgeBg: string; badgeColor: string
  children: React.ReactNode
}) {
  if (!show) return null
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0 8px' }}>
        {dotColor
          ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
          : <i className={`fas ${icon}`} style={{ color: iconColor, fontSize: 13 }} />}
        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.45)' }}>{title}</h3>
        <span style={{ background: badgeBg, color: badgeColor, borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{count}</span>
      </div>
      <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)' }}>
        {children}
      </div>
    </div>
  )
}

function StudentCard({ s, onMsg }: { s: Student; onMsg: (type: 'message' | 'warning') => void }) {
  const rc      = riskCls(s.risk_score)
  const isActive   = s.status === 'in_progress'
  const isSubmitted = ['submitted', 'auto_submitted'].includes(s.status)
  const isBanned   = s.status === 'banned'

  let statusBg = 'rgba(16,185,129,.15)', statusColor = '#10b981', statusLabel = 'En cours'
  if (isSubmitted) { statusBg = 'rgba(37,99,235,.15)'; statusColor = '#60a5fa'; statusLabel = 'Soumis' }
  if (isBanned)    { statusBg = 'rgba(239,68,68,.15)'; statusColor = '#ef4444'; statusLabel = 'Exclu' }

  return (
    <div style={{ background: isBanned ? 'rgba(239,68,68,.05)' : '#1e293b', borderRadius: 12, border: `1px solid ${isBanned ? 'rgba(239,68,68,.3)' : s.risk_score >= 60 ? 'rgba(245,158,11,.3)' : 'rgba(255,255,255,.08)'}`, overflow: 'hidden', transition: 'transform .2s, box-shadow .2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.3)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>

      {/* Placeholder vidéo */}
      <div style={{ aspectRatio: '16/9', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <i className="fas fa-video-slash" style={{ fontSize: 28, color: 'rgba(255,255,255,.2)', marginBottom: 6 }} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>Flux vidéo</span>
        {/* Overlay bannis */}
        {isBanned && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'white', fontSize: 15, fontWeight: 700 }}>
            <i className="fas fa-ban" style={{ fontSize: 24 }} />EXCLU
          </div>
        )}
        {/* Overlay soumis */}
        {isSubmitted && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <i className="fas fa-check-circle" style={{ fontSize: 32, color: '#10b981' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '.05em' }}>Soumis</span>
            {s.submitted_at && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{fmtTime(s.submitted_at)}</span>}
          </div>
        )}
        {/* Overlay identity + risk */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', background: 'linear-gradient(to bottom, rgba(0,0,0,.6) 0%, transparent 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'white', background: 'rgba(0,0,0,.5)', padding: '2px 7px', borderRadius: 4 }}>{s.student_name.split(' ')[0]}</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: RISK_BG[rc], color: RISK_CLR[rc], padding: '2px 7px', borderRadius: 4 }}>{s.risk_score || 0}%</span>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 1, color: 'white' }}>{s.student_name}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 10 }}>{s.student_email}</div>

        {/* Status + chips */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: statusBg, color: statusColor, marginBottom: 8 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />{statusLabel}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {s.tab_switches > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: s.tab_switches > 2 ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.07)', color: s.tab_switches > 2 ? '#f59e0b' : 'rgba(255,255,255,.6)', borderRadius: 5, fontSize: 10 }}>
              <i className="fas fa-exchange-alt" style={{ fontSize: 9 }} />{s.tab_switches}
            </span>
          )}
          {s.warnings_count > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: 'rgba(239,68,68,.15)', color: '#ef4444', borderRadius: 5, fontSize: 10 }}>
              <i className="fas fa-exclamation-triangle" style={{ fontSize: 9 }} />{s.warnings_count}
            </span>
          )}
          {s.proctor_name && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.5)', borderRadius: 5, fontSize: 10 }}>
              <i className="fas fa-user-shield" style={{ fontSize: 9 }} />{s.proctor_name.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Risk bar */}
        <div style={{ height: 5, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${Math.min(s.risk_score, 100)}%`, background: RISK_CLR[rc], borderRadius: 3, transition: 'width .5s' }} />
        </div>

        {/* Actions */}
        {isActive && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="monitor-action-btn" onClick={() => onMsg('message')}
              style={{ flex: 1, justifyContent: 'center', background: 'rgba(37,99,235,.2)', color: '#93c5fd' }}>
              <i className="fas fa-comment" /> Message
            </button>
            <button className="monitor-action-btn" onClick={() => onMsg('warning')}
              style={{ flex: 1, justifyContent: 'center', background: 'rgba(245,158,11,.2)', color: '#fcd34d' }}>
              <i className="fas fa-exclamation-triangle" /> Avertir
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
