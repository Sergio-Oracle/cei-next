'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useNtfy } from '@/hooks/useNtfy'

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
  banned:           boolean
  ban_reason:       string | null
  duration_minutes: number | null
  extra_minutes:    number | null
  livekit_identity: string
  proctor_name:     string
}

interface StudentMsg { id: number; student_name: string; content: string; created_at: string; read: boolean }

interface Data {
  exam_title:  string
  exam_status: string
  attempts:    Student[]
  my_role:     string
}

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

type Filter = 'all' | 'IN_PROGRESS' | 'high_risk' | 'BANNED'

export default function ProctorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { success, error: toastErr } = useToast()

  const [data, setData]           = useState<Data | null>(null)
  const [filter, setFilter]       = useState<Filter>('IN_PROGRESS')
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* Modals */
  const [warnModal, setWarnModal] = useState<{ attemptId: number; name: string; type: 'warning' | 'message' } | null>(null)
  const [warnText, setWarnText]   = useState(''); const [sending, setSending] = useState(false)
  const [banModal, setBanModal]   = useState<{ attemptId: number; name: string } | null>(null)
  const [banReason, setBanReason] = useState(''); const [banning, setBanning] = useState(false)
  const [noteModal, setNoteModal] = useState<{ attemptId: number; name: string } | null>(null)
  const [noteText, setNoteText]   = useState(''); const [noteSending, setNoteSending] = useState(false)
  const [timeModal, setTimeModal] = useState<{ attemptId: number; name: string } | null>(null)
  const [timeMin, setTimeMin]     = useState(5); const [timeSending, setTimeSending] = useState(false)

  /* Panels */
  const [logsPanel, setLogsPanel]     = useState<{ attemptId: number; name: string; logs: any[] } | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [msgsPanel, setMsgsPanel]     = useState<{ msgs: StudentMsg[] } | null>(null)
  const [msgsLoading, setMsgsLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<Data>(`/api/online_exams/${id}/active_proctoring`)
      setData(res)
    } catch (e: any) { toastErr(e.message || 'Erreur de chargement') }
    finally { setLoading(false); setRefreshing(false) }
  }, [id])

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 8000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  // Alertes temps réel via ntfy — ban + risque élevé + agent autonome
  useNtfy(id ? `exam-${id}` : null, useCallback((msg) => {
    const type = msg.event ?? (msg as any).type
    if (type === 'student_banned') {
      toastErr(msg.message ?? 'Étudiant exclu')
      load()
    } else if (type === 'high_risk' || type === 'agent_alert') {
      toastErr(msg.message ?? 'Alerte fraude')
      load()
    }
  }, [load, toastErr]))

  const students  = data?.attempts ?? []
  const active    = students.filter(s => s.status === 'in_progress')
  const done      = students.filter(s => s.status === 'submitted' || s.status === 'auto_submitted')
  const bannedAll = students.filter(s => s.banned)
  const highRisk  = students.filter(s => s.risk_score >= 70 && !s.banned)

  const filtered = students
    .filter(s => {
      const q = search.toLowerCase()
      if (q && !s.student_name.toLowerCase().includes(q) && !s.student_email.toLowerCase().includes(q)) return false
      if (filter === 'IN_PROGRESS') return s.status === 'in_progress'
      if (filter === 'BANNED')      return s.banned
      if (filter === 'high_risk')   return s.risk_score >= 70
      return true
    })
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))

  /* Actions */
  async function sendWarn() {
    if (!warnModal || !warnText.trim()) return
    setSending(true)
    try {
      await api.post(`/api/exam_attempts/${warnModal.attemptId}/send_warning`, { message: warnText, type: warnModal.type })
      success(warnModal.type === 'warning' ? 'Avertissement envoyé' : 'Message envoyé')
      setWarnModal(null); setWarnText('')
    } catch (e: any) { toastErr(e.message || 'Erreur') } finally { setSending(false) }
  }

  async function confirmBan() {
    if (!banModal) return; setBanning(true)
    try {
      await api.post(`/api/exam_attempts/${banModal.attemptId}/proctor_ban`, { reason: banReason })
      success(`${banModal.name} exclu`); setBanModal(null); setBanReason(''); load()
    } catch (e: any) { toastErr(e.message || 'Erreur') } finally { setBanning(false) }
  }

  async function sendNote() {
    if (!noteModal || !noteText.trim()) return; setNoteSending(true)
    try {
      await api.post(`/api/exam_attempts/${noteModal.attemptId}/proctor-note`, { note: noteText })
      success('Note enregistrée'); setNoteModal(null); setNoteText('')
    } catch (e: any) { toastErr(e.message || 'Erreur') } finally { setNoteSending(false) }
  }

  async function grantTime() {
    if (!timeModal) return; setTimeSending(true)
    try {
      await api.put(`/api/exam_attempts/${timeModal.attemptId}/extra-time`, { minutes: timeMin })
      success(`+${timeMin} min accordées à ${timeModal.name}`); setTimeModal(null); load()
    } catch (e: any) { toastErr(e.message || 'Erreur') } finally { setTimeSending(false) }
  }

  async function toggleRec(attemptId: number) {
    try {
      await api.post(`/api/exam_attempts/${attemptId}/recording`, {})
      success('Enregistrement basculé'); load()
    } catch (e: any) { toastErr(e.message || 'Erreur') }
  }

  async function openLogs(attemptId: number, name: string) {
    setLogsPanel({ attemptId, name, logs: [] }); setLogsLoading(true)
    try {
      const res = await api.get<any>(`/api/exam_attempts/${attemptId}/review`)
      setLogsPanel({ attemptId, name, logs: res.incidents ?? [] })
    } catch { setLogsPanel({ attemptId, name, logs: [] }) } finally { setLogsLoading(false) }
  }

  async function openMessages() {
    setMsgsPanel({ msgs: [] }); setMsgsLoading(true)
    try {
      const res = await api.get<any>(`/api/online_exams/${id}/student_messages`)
      setMsgsPanel({ msgs: res.messages ?? res ?? [] })
    } catch { setMsgsPanel({ msgs: [] }) } finally { setMsgsLoading(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'white', gap: 16 }}>
      <div className="lk-spin" /><div style={{ fontSize: 15, fontWeight: 600 }}>Chargement du dashboard…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: "-apple-system,'Segoe UI',Roboto,sans-serif" }}>
      <style>{`
        .lk-spin{width:48px;height:48px;border:4px solid rgba(255,255,255,.1);border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.9)}}
        .pc-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
        .pc-filter-btn{padding:6px 14px;border:2px solid rgba(255,255,255,.15);background:transparent;color:rgba(255,255,255,.7);border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s}
        .pc-filter-btn.active,.pc-filter-btn:hover{border-color:#3b82f6;background:#3b82f6;color:white}
        .pc-pill{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600}
        .pc-action{padding:5px 9px;border:none;border-radius:6px;cursor:pointer;font-size:11px;display:inline-flex;align-items:center;gap:4px;transition:opacity .15s;font-weight:600}
        .pc-action:hover{opacity:.8}
        .pc-metric{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:10px}
        .pc-search{padding:7px 14px;border:2px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:white;border-radius:20px;font-size:12px;outline:none;width:200px}
        .pc-search:focus{border-color:#3b82f6}
        .pc-modal-inp{width:100%;padding:10px 14px;background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.15);color:white;border-radius:8px;font-size:13px;resize:none;font-family:inherit;outline:none;box-sizing:border-box}
        .pc-modal-inp:focus{border-color:#3b82f6}
        .pc-comp-th{font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.4);padding:8px 14px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08);font-weight:700;letter-spacing:.06em;background:#0f172a !important}
        .pc-comp-td{padding:10px 14px;font-size:12px;color:rgba(255,255,255,.75);border-bottom:1px solid rgba(255,255,255,.04);background:transparent}
        .pc-hdr-btn{padding:7px 14px;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.2);color:white;transition:opacity .15s}
        .pc-hdr-btn:hover{opacity:.85}
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header style={{ background: '#2563eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,.3)', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-shield-alt" style={{ fontSize: 18 }} />
          </div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{data?.exam_title || 'Surveillance'}</h1>
            <p style={{ fontSize: 11, opacity: .8, margin: 0 }}>Actualisation auto · {data?.my_role === 'surveillant' ? 'Surveillant' : 'Enseignant'}</p>
          </div>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="pc-pill" style={{ background: 'rgba(255,255,255,.15)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} /> LIVE
          </div>
          <div className="pc-pill" style={{ background: 'rgba(255,255,255,.15)' }}><i className="fas fa-users" /> {active.length} actifs</div>
          <div className="pc-pill" style={{ background: 'rgba(239,68,68,.3)' }}><i className="fas fa-exclamation-triangle" /> {highRisk.length} risque élevé</div>
          <div className="pc-pill" style={{ background: 'rgba(16,185,129,.3)' }}><i className="fas fa-check-circle" /> {done.length} terminés</div>
          {bannedAll.length > 0 && <div className="pc-pill" style={{ background: 'rgba(239,68,68,.25)' }}><i className="fas fa-ban" /> {bannedAll.length} exclus</div>}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openMessages} className="pc-hdr-btn" style={{ background: 'rgba(139,92,246,.5)', position: 'relative' }}>
            <i className="fas fa-comments" /> Messages étudiants
          </button>
          <button onClick={() => { setRefreshing(true); load() }} className="pc-hdr-btn">
            <i className={`fas fa-sync-alt${refreshing ? ' fa-spin' : ''}`} /> Actualiser
          </button>
          <button onClick={() => router.back()} className="pc-hdr-btn">
            <i className="fas fa-arrow-left" /> Retour
          </button>
        </div>
      </header>

      {/* ── CORPS ───────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', maxWidth: 1600, margin: '0 auto' }}>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          {([['all','Tous'],['IN_PROGRESS','En cours'],['high_risk','Risque élevé'],['BANNED','Bannis']] as [Filter,string][]).map(([f,label]) => (
            <button key={f} className={`pc-filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'IN_PROGRESS' && <i className="fas fa-circle" style={{ color: '#10b981', fontSize: 8, marginRight: 4 }} />}
              {label}
            </button>
          ))}
          <input className="pc-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un étudiant…" />
        </div>

        {/* Grille */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.length === 0 ? (
            <EmptyState filter={filter} done={done.length} banned={bannedAll.length} search={search} />
          ) : filtered.map(s => (
            <StudentCard key={s.attempt_id} s={s}
              onWarn={() => setWarnModal({ attemptId: s.attempt_id, name: s.student_name, type: 'warning' })}
              onMessage={() => setWarnModal({ attemptId: s.attempt_id, name: s.student_name, type: 'message' })}
              onBan={() => setBanModal({ attemptId: s.attempt_id, name: s.student_name })}
              onNote={() => setNoteModal({ attemptId: s.attempt_id, name: s.student_name })}
              onTime={() => setTimeModal({ attemptId: s.attempt_id, name: s.student_name })}
              onRec={() => toggleRec(s.attempt_id)}
              onLogs={() => openLogs(s.attempt_id, s.student_name)}
            />
          ))}
        </div>

        {/* Panneau copies terminées */}
        {done.length > 0 && (
          <div style={{ marginTop: 20, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden' }}>
            <div onClick={() => setCompletedOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(255,255,255,.04)', cursor: 'pointer', userSelect: 'none' }}>
              <i className="fas fa-check-circle" style={{ color: '#10b981', fontSize: 15 }} />
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.8)' }}>Copies terminées</h4>
              <span style={{ background: 'rgba(16,185,129,.2)', color: '#10b981', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{done.length}</span>
              <i className="fas fa-chevron-down" style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.4)', fontSize: 12, transform: completedOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </div>
            {completedOpen && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b' }}>
                  <thead style={{ background: '#0f172a' }}>
                    <tr style={{ background: '#0f172a' }}>
                      {['Étudiant','Statut','Soumis à','Durée','Risque','Note','Surveillant'].map(h => <th key={h} className="pc-comp-th">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {done.map(s => (
                      <tr key={s.attempt_id}>
                        <td className="pc-comp-td"><div style={{ fontWeight: 600, color: 'white' }}>{s.student_name}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{s.student_email}</div></td>
                        <td className="pc-comp-td">
                          {s.status === 'auto_submitted'
                            ? <span style={{ background: 'rgba(245,158,11,.18)', color: '#d97706', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}><i className="fas fa-clock" style={{ marginRight: 4 }} />Auto-soumis</span>
                            : <span style={{ background: 'rgba(16,185,129,.15)', color: '#10b981', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}><i className="fas fa-check" style={{ marginRight: 4 }} />Soumis</span>}
                        </td>
                        <td className="pc-comp-td">{fmtTime(s.submitted_at)}</td>
                        <td className="pc-comp-td">{s.duration_minutes != null ? `${s.duration_minutes} min${s.extra_minutes ? ` (+${s.extra_minutes})` : ''}` : '—'}</td>
                        <td className="pc-comp-td" style={{ fontWeight: 700, color: s.risk_score >= 70 ? '#ef4444' : s.risk_score >= 40 ? '#d97706' : '#10b981' }}>{s.risk_score}%</td>
                        <td className="pc-comp-td" style={{ fontWeight: 700, color: s.score != null ? '#93c5fd' : 'rgba(255,255,255,.3)' }}>{s.score != null ? `${s.score}/20` : '—'}</td>
                        <td className="pc-comp-td" style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>{s.proctor_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL AVERTISSEMENT / MESSAGE ───────────────────────── */}
      {warnModal && (
        <PcModal onClose={() => { setWarnModal(null); setWarnText('') }}>
          <h2 style={mTitle}><i className={`fas ${warnModal.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-comment'}`} style={{ color: warnModal.type === 'warning' ? '#f59e0b' : '#3b82f6' }} />{warnModal.type === 'warning' ? 'Avertir' : 'Message'} — {warnModal.name}</h2>
          <textarea className="pc-modal-inp" value={warnText} onChange={e => setWarnText(e.target.value)} rows={4} placeholder={warnModal.type === 'warning' ? "Raison de l'avertissement…" : "Votre message à l'étudiant…"} style={{ marginBottom: 16 }} />
          <div style={mFoot}>
            <button onClick={() => { setWarnModal(null); setWarnText('') }} style={btnGhost}>Annuler</button>
            <button onClick={sendWarn} disabled={sending || !warnText.trim()} style={{ ...btnPrimary, background: warnModal.type === 'warning' ? '#f59e0b' : '#3b82f6', opacity: !warnText.trim() ? .5 : 1 }}>
              <i className={`fas ${warnModal.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-paper-plane'}`} />{sending ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </PcModal>
      )}

      {/* ── MODAL BAN ────────────────────────────────────────────── */}
      {banModal && (
        <PcModal onClose={() => { setBanModal(null); setBanReason('') }}>
          <h2 style={mTitle}><i className="fas fa-ban" style={{ color: '#ef4444' }} />Exclure — {banModal.name}</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 16 }}>Cette action est irréversible. Veuillez préciser la raison.</p>
          <textarea className="pc-modal-inp" value={banReason} onChange={e => setBanReason(e.target.value)} rows={3} placeholder="Raison de l'exclusion…" style={{ marginBottom: 16 }} />
          <div style={mFoot}>
            <button onClick={() => { setBanModal(null); setBanReason('') }} style={btnGhost}>Annuler</button>
            <button onClick={confirmBan} disabled={banning} style={btnDanger}>
              <i className="fas fa-ban" />{banning ? 'Exclusion…' : "Confirmer l'exclusion"}
            </button>
          </div>
        </PcModal>
      )}

      {/* ── MODAL NOTE SURVEILLANT ───────────────────────────────── */}
      {noteModal && (
        <PcModal onClose={() => { setNoteModal(null); setNoteText('') }}>
          <h2 style={mTitle}><i className="fas fa-sticky-note" style={{ color: '#3b82f6' }} />Note — {noteModal.name}</h2>
          <textarea className="pc-modal-inp" value={noteText} onChange={e => setNoteText(e.target.value)} rows={4} placeholder="Votre observation sur cet étudiant…" style={{ marginBottom: 16 }} />
          <div style={mFoot}>
            <button onClick={() => { setNoteModal(null); setNoteText('') }} style={btnGhost}>Annuler</button>
            <button onClick={sendNote} disabled={noteSending || !noteText.trim()} style={{ ...btnPrimary, background: '#3b82f6', opacity: !noteText.trim() ? .5 : 1 }}>
              <i className="fas fa-save" />{noteSending ? 'Sauvegarde…' : 'Enregistrer la note'}
            </button>
          </div>
        </PcModal>
      )}

      {/* ── MODAL TEMPS SUPPLÉMENTAIRE ───────────────────────────── */}
      {timeModal && (
        <PcModal onClose={() => setTimeModal(null)}>
          <h2 style={mTitle}><i className="fas fa-clock" style={{ color: '#f59e0b' }} />Temps supplémentaire — {timeModal.name}</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 16 }}>Accordez des minutes supplémentaires à cet étudiant (max 60 min).</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <input type="range" min={5} max={60} step={5} value={timeMin} onChange={e => setTimeMin(+e.target.value)} style={{ flex: 1 }} />
            <span style={{ fontSize: 20, fontWeight: 700, minWidth: 60, textAlign: 'center', color: '#f59e0b' }}>+{timeMin} min</span>
          </div>
          <div style={mFoot}>
            <button onClick={() => setTimeModal(null)} style={btnGhost}>Annuler</button>
            <button onClick={grantTime} disabled={timeSending} style={{ ...btnPrimary, background: '#f59e0b' }}>
              <i className="fas fa-hourglass-half" />{timeSending ? 'Application…' : `Accorder +${timeMin} min`}
            </button>
          </div>
        </PcModal>
      )}

      {/* ── PANEL LOGS ───────────────────────────────────────────── */}
      {logsPanel && (
        <SidePanel title={`Activité — ${logsPanel.name}`} onClose={() => setLogsPanel(null)}>
          {logsLoading ? <SpinCenter /> : logsPanel.logs.length === 0 ? (
            <EmptySide icon="fa-shield-alt" text="Aucun événement enregistré" />
          ) : logsPanel.logs.map((log: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 11 }}>
              <i className="fas fa-circle" style={{ color: '#60a5fa', fontSize: 6, marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: 'rgba(255,255,255,.8)' }}>{log.event_type || log.type || '—'}</div>
                {log.created_at && <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 9, marginTop: 2 }}>{new Date(log.created_at).toLocaleTimeString('fr-FR')}</div>}
              </div>
            </div>
          ))}
        </SidePanel>
      )}

      {/* ── PANEL MESSAGES ÉTUDIANTS ─────────────────────────────── */}
      {msgsPanel && (
        <SidePanel title="Messages des étudiants" onClose={() => setMsgsPanel(null)}>
          {msgsLoading ? <SpinCenter /> : msgsPanel.msgs.length === 0 ? (
            <EmptySide icon="fa-comments" text="Aucun message reçu" />
          ) : msgsPanel.msgs.map((m, i) => (
            <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.05)', background: m.read ? 'transparent' : 'rgba(139,92,246,.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>{m.student_name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', lineHeight: 1.5 }}>{m.content}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>{new Date(m.created_at).toLocaleTimeString('fr-FR')}</div>
            </div>
          ))}
        </SidePanel>
      )}
    </div>
  )
}

/* ── Carte étudiant ─────────────────────────────────────────────── */
function StudentCard({ s, onWarn, onMessage, onBan, onNote, onTime, onRec, onLogs }: {
  s: Student; onWarn:()=>void; onMessage:()=>void; onBan:()=>void; onNote:()=>void; onTime:()=>void; onRec:()=>void; onLogs:()=>void
}) {
  const rc   = riskCls(s.risk_score)
  const isDone = s.status === 'submitted' || s.status === 'auto_submitted'

  return (
    <div className="pc-card" style={{ background: s.banned ? 'rgba(239,68,68,.05)' : '#1e293b', borderRadius: 12, border: `1px solid ${s.banned ? 'rgba(239,68,68,.5)' : s.risk_score >= 70 ? 'rgba(245,158,11,.5)' : 'rgba(255,255,255,.08)'}`, overflow: 'hidden', transition: 'transform .2s,box-shadow .2s' }}>

      {/* Zone vidéo */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.25)', gap: 8 }}>
          <i className="fas fa-video-slash" style={{ fontSize: 28 }} />
          <span style={{ fontSize: 11 }}>Connexion en attente…</span>
        </div>

        {/* Overlay soumis */}
        {isDone && !s.banned && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <i className="fas fa-check-circle" style={{ fontSize: 32, color: '#10b981' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.status === 'auto_submitted' ? 'Auto-soumis' : 'Copie soumise'}</span>
            {s.submitted_at && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{fmtTime(s.submitted_at)}</span>}
          </div>
        )}

        {/* Overlay exclu */}
        {s.banned && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}>
            <i className="fas fa-ban" style={{ fontSize: 28 }} />EXCLU
          </div>
        )}

        {/* Badge risque */}
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, color: 'white', background: rc === 'high' ? 'rgba(239,68,68,.9)' : rc === 'medium' ? 'rgba(245,158,11,.9)' : 'rgba(16,185,129,.9)' }}>{s.risk_score}%</span>
        </div>

        {/* Badge extra time */}
        {s.extra_minutes && s.extra_minutes > 0 && (
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, color: 'white', background: 'rgba(245,158,11,.9)' }}>+{s.extra_minutes}min</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{s.student_name}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>{s.student_email}</div>

        {/* Statut */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10, marginBottom: 8, background: s.banned ? 'rgba(239,68,68,.15)' : isDone ? 'rgba(37,99,235,.15)' : 'rgba(16,185,129,.15)', color: s.banned ? '#ef4444' : isDone ? '#60a5fa' : '#10b981' }}>
          <i className="fas fa-circle" style={{ fontSize: 6 }} />
          {s.banned ? 'Exclu' : isDone ? (s.status === 'auto_submitted' ? 'Auto-soumis' : 'Soumis') : 'En cours'}
        </span>

        {/* Métriques */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
          {[{ icon: 'fa-exchange-alt', val: s.tab_switches, lbl: 'Onglets', warn: s.tab_switches > 0, bad: false },
            { icon: 'fa-exclamation', val: s.warnings_count, lbl: 'Avert.', warn: s.warnings_count > 0, bad: s.warnings_count > 2 },
            { icon: 'fa-user-slash', val: s.no_face_count, lbl: 'Sans visage', warn: s.no_face_count > 0, bad: s.no_face_count > 5 },
          ].map(m => (
            <div key={m.lbl} className="pc-metric" style={{ background: m.bad ? 'rgba(239,68,68,.15)' : m.warn ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.07)', color: m.bad ? '#ef4444' : m.warn ? '#f59e0b' : 'rgba(255,255,255,.7)' }}>
              <i className={`fas ${m.icon}`} style={{ fontSize: 9 }} /><strong>{m.val}</strong> {m.lbl}
            </div>
          ))}
          {s.started_at && !isDone && (
            <div className="pc-metric" style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)' }}><i className="fas fa-clock" style={{ fontSize: 9 }} /> {elapsed(s.started_at)}</div>
          )}
        </div>

        {/* Barre risque */}
        <div style={{ height: 5, background: 'rgba(255,255,255,.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(s.risk_score, 100)}%`, transition: 'width .5s', background: rc === 'high' ? '#ef4444' : rc === 'medium' ? '#f59e0b' : '#10b981' }} />
        </div>
        <div style={{ fontSize: 10, marginBottom: 8, fontWeight: 700, color: rc === 'high' ? '#ef4444' : rc === 'medium' ? '#f59e0b' : '#10b981' }}>
          Score de risque &nbsp;{s.risk_score}% — {rc === 'high' ? 'ÉLEVÉ' : rc === 'medium' ? 'MOYEN' : 'FAIBLE'}
        </div>

        {s.proctor_name && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 8 }}><i className="fas fa-user-tie" style={{ marginRight: 5, fontSize: 10 }} />{s.proctor_name}</div>}

        {/* Actions */}
        {s.banned ? (
          <div style={{ fontSize: 11, color: '#ef4444' }}><i className="fas fa-ban" style={{ marginRight: 5 }} />Exclu — {s.ban_reason || ''}</div>
        ) : isDone ? (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}><i className="fas fa-lock" style={{ marginRight: 5 }} />Copie soumise — aucune action</div>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button className="pc-action" onClick={onWarn} title="Avertir" style={{ background: 'rgba(245,158,11,.2)', color: '#f59e0b' }}><i className="fas fa-exclamation-triangle" /> Avertir</button>
            <button className="pc-action" onClick={onMessage} title="Message" style={{ background: 'rgba(59,130,246,.2)', color: '#60a5fa' }}><i className="fas fa-comment" /> Msg</button>
            <button className="pc-action" onClick={onTime} title="Temps supplémentaire" style={{ background: 'rgba(245,158,11,.15)', color: '#fbbf24' }}><i className="fas fa-hourglass-half" /> +Tps</button>
            <button className="pc-action" onClick={onNote} title="Note surveillant" style={{ background: 'rgba(139,92,246,.2)', color: '#60a5fa' }}><i className="fas fa-sticky-note" /></button>
            <button className="pc-action" onClick={onBan} title="Exclure" style={{ background: 'rgba(239,68,68,.2)', color: '#ef4444' }}><i className="fas fa-ban" /> Exclure</button>
            <button className="pc-action" onClick={onRec} title="Enregistrement" style={{ background: 'rgba(239,68,68,.12)', color: '#fca5a5' }}><i className="fas fa-circle" style={{ color: '#ef4444' }} /> REC</button>
            <button className="pc-action" onClick={onLogs} title="Voir logs" style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.6)' }}><i className="fas fa-list" /></button>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ filter, done, banned, search }: { filter: Filter; done: number; banned: number; search: string }) {
  let icon = 'fa-users-slash', msg = 'Aucun étudiant correspondant'
  if (!search) {
    if (filter === 'IN_PROGRESS') {
      if (done > 0 || banned > 0) {
        icon = 'fa-check-circle'
        const parts: string[] = []
        if (done > 0) parts.push(`${done} copie${done > 1 ? 's' : ''} soumise${done > 1 ? 's' : ''}`)
        if (banned > 0) parts.push(`${banned} exclu${banned > 1 ? 's' : ''}`)
        msg = `Tous les étudiants ont terminé · ${parts.join(' · ')} — voir le panneau ci-dessous`
      } else { icon = 'fa-hourglass-start'; msg = 'En attente de connexion des étudiants' }
    } else if (filter === 'BANNED') { icon = 'fa-shield-alt'; msg = 'Aucun étudiant exclu' }
    else if (filter === 'high_risk') { icon = 'fa-shield-alt'; msg = 'Aucun étudiant à risque élevé' }
  }
  return (
    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,.3)' }}>
      <i className={`fas ${icon}`} style={{ fontSize: 48, display: 'block', marginBottom: 16 }} />
      <p style={{ fontSize: 14 }}>{msg}</p>
    </div>
  )
}

function SidePanel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: 380, height: '100vh', background: '#1e293b', borderLeft: '1px solid rgba(255,255,255,.1)', zIndex: 500, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,.4)' }}>
      <div style={{ padding: 16, background: '#2563eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18 }}><i className="fas fa-times" /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>{children}</div>
    </div>
  )
}

function PcModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', color: 'white', padding: 28, borderRadius: 16, maxWidth: 440, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,.5)' }}>
        {children}
      </div>
    </div>
  )
}

function SpinCenter() { return <div style={{ textAlign: 'center', padding: 40 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} /></div> }
function EmptySide({ icon, text }: { icon: string; text: string }) {
  return <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,.3)', fontSize: 13 }}><i className={`fas ${icon}`} style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />{text}</div>
}

const mTitle: React.CSSProperties = { fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }
const mFoot:  React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end' }
const btnGhost:   React.CSSProperties = { padding: '8px 16px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,.1)', color: 'white' }
const btnPrimary: React.CSSProperties = { padding: '8px 16px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#3b82f6', color: 'white', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnDanger:  React.CSSProperties = { padding: '8px 16px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#ef4444', color: 'white', display: 'inline-flex', alignItems: 'center', gap: 6 }
