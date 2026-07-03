'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

/* ── Types ────────────────────────────────────────────────────────────────── */

interface Student {
  attempt_id:        number
  student_name:      string
  student_email:     string
  status:            string
  risk_score:        number
  warnings_count:    number
  tab_switches:      number
  no_face_count:     number
  started_at:        string | null
  submitted_at:      string | null
  score:             number | null
  ban_reason:        string | null
  duration_minutes:  number | null
  extra_minutes:     number | null
  proctor_name:      string | null
  livekit_identity:  string
  has_pre_sig:       boolean
  has_post_sig:      boolean
  pre_sig_meta?:     any
  current_egress_id?: string | null
}

interface Proctor {
  id: number; name: string; email?: string
  online?: boolean; student_count?: number
  proctor_identity?: string
}

interface ProctorData {
  exam_title:     string
  exam_status:    string
  my_role:        string
  my_identity:    string | null
  attempts:       Student[]
  proctors:       Proctor[]
  messages_count?: number
}

interface AgentStatus {
  alive:                boolean
  status_label:         string
  last_check_ago_sec:   number | null
  interval_seconds:     number
  risk_alert:           number
  risk_urgent:          number
  exams_monitored:      number
  total_alerts_session: number
  exam?: { students: number; alerts_sent: number; banned: number }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
declare global { interface Window { LivekitClient: any } }

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

function riskCls(s: number) { return s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low' }
const RC = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' } as const
const RB = { low: 'rgba(16,185,129,.2)', medium: 'rgba(245,158,11,.2)', high: 'rgba(239,68,68,.2)' } as const

/* ── Page ────────────────────────────────────────────────────────────────── */

type Filter = 'all' | 'in_progress' | 'high_risk' | 'banned'

export default function ProctorMonitorPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { success, error: toastErr } = useToast()

  const [data,       setData]       = useState<ProctorData | null>(null)
  const [agent,      setAgent]      = useState<AgentStatus | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter,     setFilter]     = useState<Filter>('in_progress')
  const [search,     setSearch]     = useState('')
  const [camOn,      setCamOn]      = useState(false)
  const [micOn,      setMicOn]      = useState(false)
  const [recording,  setRecording]  = useState(false)

  /* modal: message/avertissement */
  const [msgModal, setMsgModal] = useState<{ attemptId: number; name: string; type: 'message' | 'warning' } | null>(null)
  const [msgText,  setMsgText]  = useState('')
  const [sending,  setSending]  = useState(false)

  /* modal: exclusion */
  const [banModal,  setBanModal]  = useState<{ attemptId: number; name: string } | null>(null)
  const [banReason, setBanReason] = useState('')
  const [banning,   setBanning]   = useState(false)

  /* modal: temps supplémentaire */
  const [extraModal,   setExtraModal]   = useState<{ attemptId: number; name: string } | null>(null)
  const [extraMins,    setExtraMins]    = useState('15')
  const [grantingTime, setGrantingTime] = useState(false)

  /* modal: note de surveillance */
  const [noteModal,  setNoteModal]  = useState<{ attemptId: number; name: string } | null>(null)
  const [noteText,   setNoteText]   = useState('')
  const [savingNote, setSavingNote] = useState(false)

  /* modal: écran partagé */
  const [screenModal, setScreenModal] = useState<{ attemptId: number; name: string; identity: string } | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)

  /* panel: logs */
  const [logsPanel, setLogsPanel] = useState<{ name: string; logs: any[] } | null>(null)
  const [loadingLogs, setLoadingLogs] = useState(false)

  /* enregistrements individuels */
  const [recSet, setRecSet] = useState<Set<number>>(new Set())
  const roomEgressRef = useRef<string | null>(null)

  /* boutons écran par étudiant (visible si screen share actif) */
  const [screenSet, setScreenSet] = useState<Set<string>>(new Set())

  /* identités LiveKit des étudiants actuellement connectés */
  const [liveSet, setLiveSet] = useState<Set<string>>(new Set())

  /* messages étudiants */
  const [studentMsgs, setStudentMsgs]       = useState<any[]>([])
  const [studentMsgsModal, setStudentMsgsModal] = useState(false)
  const lastMsgTsRef = useRef<string | null>(null)
  const [newMsgCount, setNewMsgCount]       = useState(0)

  /* modal enregistrements */
  const [recModal,    setRecModal]    = useState(false)
  const [recTab,      setRecTab]      = useState<'videos' | 'snapshots'>('videos')
  const [videoRecs,   setVideoRecs]   = useState<any>(null)
  const [snapRecs,    setSnapRecs]    = useState<any>(null)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [selectedSnapIdx, setSelectedSnapIdx] = useState(0)

  /* alertes agent */
  const [agentAlerts, setAgentAlerts] = useState<any[]>([])
  const [agentPanel,  setAgentPanel]  = useState(false)
  const [alertBadge,  setAlertBadge]  = useState(0)

  /* appel privé */
  const [privateCall,   setPrivateCall]   = useState<{ attemptId: number; name: string } | null>(null)
  const [privateStatus, setPrivateStatus] = useState('')
  const [privateCamOn,  setPrivateCamOn]  = useState(false)
  const [privateMicOn,  setPrivateMicOn]  = useState(false)
  const privateRoomRef  = useRef<any>(null)
  const privateCamRef   = useRef<any>(null)
  const privateMicRef   = useRef<any>(null)

  /* LiveKit */
  const roomRef         = useRef<any>(null)
  const videoTracksRef  = useRef<Map<string, any>>(new Map())
  const screenTracksRef = useRef<Map<string, any>>(new Map())
  const myLocalCamRef   = useRef<any>(null)
  const myLocalMicRef   = useRef<any>(null)

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const agentPoll = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Chargement données ─────────────────────────────────────────────────── */

  const loadData = useCallback(async (bg = false) => {
    if (bg) setRefreshing(true)
    try {
      const res = await api.get<ProctorData>(`/api/online_exams/${id}/active_proctoring`)
      setData(res)
      /* ré-attacher les tracks déjà reçus */
      setTimeout(() => {
        res.attempts?.forEach(s => {
          const track = videoTracksRef.current.get(s.livekit_identity)
          if (track) attachVideo(s.livekit_identity, track)
        })
      }, 100)
    } catch (e: any) {
      if (!bg) toastErr(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id]) // eslint-disable-line

  const loadAgent = useCallback(async () => {
    try {
      const res = await api.get<AgentStatus>(`/api/agent/status?exam_id=${id}`)
      setAgent(res)
    } catch {}
  }, [id])

  const loadStudentMessages = useCallback(async () => {
    try {
      const since = lastMsgTsRef.current ? `?since=${encodeURIComponent(lastMsgTsRef.current)}` : ''
      const res = await api.get<any>(`/api/online_exams/${id}/student_messages${since}`)
      const newMsgs: any[] = res.messages || []
      if (newMsgs.length > 0) {
        lastMsgTsRef.current = newMsgs[0].timestamp
        setStudentMsgs(prev => [...newMsgs, ...prev].slice(0, 100))
        setNewMsgCount(prev => prev + newMsgs.length)
      }
    } catch {}
  }, [id]) // eslint-disable-line

  const fetchAgentAlerts = useCallback(async () => {
    try {
      const data = await api.get<any>('/api/agent/alerts')
      setAgentAlerts(data.alerts || [])
      setAlertBadge(data.total_unread || 0)
    } catch {}
  }, []) // eslint-disable-line

  useEffect(() => {
    loadData()
    loadAgent()
    fetchAgentAlerts()
    loadStudentMessages()
    pollRef.current   = setInterval(() => loadData(true), 8_000)
    agentPoll.current = setInterval(loadAgent, 30_000)
    const msgPoll  = setInterval(loadStudentMessages, 20_000)
    const bellPoll = setInterval(fetchAgentAlerts,    15_000)
    return () => {
      if (pollRef.current)   clearInterval(pollRef.current)
      if (agentPoll.current) clearInterval(agentPoll.current)
      clearInterval(msgPoll)
      clearInterval(bellPoll)
      roomRef.current?.disconnect()
      privateRoomRef.current?.disconnect()
    }
  }, [loadData, loadAgent]) // eslint-disable-line

  /* ── LiveKit ────────────────────────────────────────────────────────────── */

  useEffect(() => {
    let scriptEl: HTMLScriptElement | null = null
    function initLK() {
      if (typeof window === 'undefined') return
      if (!window.LivekitClient) {
        scriptEl = document.createElement('script')
        scriptEl.src = 'https://cdn.jsdelivr.net/npm/livekit-client@2.5.7/dist/livekit-client.umd.min.js'
        scriptEl.crossOrigin = 'anonymous'
        scriptEl.onload = () => connectLK()
        document.head.appendChild(scriptEl)
      } else {
        connectLK()
      }
    }
    initLK()
    return () => { if (scriptEl) scriptEl.remove() }
  }, [id]) // eslint-disable-line

  async function connectLK() {
    try {
      const tok = await api.get<{ ws_url: string; token: string }>(`/api/online_exams/${id}/proctor_token`)
      if (!tok.ws_url || !tok.token) return
      const LK   = window.LivekitClient
      const room = new LK.Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      room.on(LK.RoomEvent.TrackSubscribed, (track: any, pub: any, participant: any) => {
        const identity = participant.identity
        if (!identity.startsWith('student-')) return
        const isScreen = pub.source === LK.Track.Source.ScreenShare || pub.trackName === 'screen'
        if (track.kind === 'video') {
          if (isScreen) {
            screenTracksRef.current.set(identity, track)
            setScreenSet(prev => new Set(prev).add(identity))
          } else {
            videoTracksRef.current.set(identity, track)
            setData(prev => {
              if (!prev) return prev
              const s = prev.attempts.find(a => a.livekit_identity === identity)
              if (s) setTimeout(() => attachVideo(identity, track), 50)
              return prev
            })
          }
        }
      })

      room.on(LK.RoomEvent.TrackUnsubscribed, (track: any, pub: any, participant: any) => {
        const identity = participant.identity
        const isScreen = pub.source === LK.Track.Source?.ScreenShare || pub.trackName === 'screen'
        if (track.kind === 'video') {
          if (isScreen) {
            screenTracksRef.current.delete(identity)
            setScreenSet(prev => { const n = new Set(prev); n.delete(identity); return n })
          } else {
            videoTracksRef.current.delete(identity)
            const el = document.getElementById(`video-${identity}`) as HTMLVideoElement | null
            const ph = document.getElementById(`ph-${identity}`)
            if (el) el.style.display = 'none'
            if (ph) ph.style.display = 'flex'
          }
        }
      })

      room.on(LK.RoomEvent.ParticipantConnected, (participant: any) => {
        const ident = participant.identity
        if (ident.startsWith('student-')) {
          setLiveSet(prev => new Set(prev).add(ident))
        }
      })

      room.on(LK.RoomEvent.ParticipantDisconnected, (participant: any) => {
        const ident = participant.identity
        if (ident.startsWith('student-')) {
          setLiveSet(prev => { const n = new Set(prev); n.delete(ident); return n })
          videoTracksRef.current.delete(ident)
          const el = document.getElementById(`video-${ident}`) as HTMLVideoElement | null
          const ph = document.getElementById(`ph-${ident}`)
          if (el) el.style.display = 'none'
          if (ph) ph.style.display = 'flex'
        }
      })

      await room.connect(tok.ws_url, tok.token)

      /* participants déjà présents au moment de la connexion */
      const alreadyLive: string[] = []
      room.remoteParticipants.forEach((p: any) => {
        const ident = p.identity
        if (ident.startsWith('student-')) alreadyLive.push(ident)
        p.trackPublications.forEach((pub: any) => {
          if (!pub.track || pub.kind !== 'video') return
          if (!ident.startsWith('student-')) return
          const isScreen = pub.source === LK.Track.Source.ScreenShare || pub.trackName === 'screen'
          if (isScreen) {
            screenTracksRef.current.set(ident, pub.track)
            setScreenSet(prev => new Set(prev).add(ident))
          } else {
            videoTracksRef.current.set(ident, pub.track)
            setData(prev => {
              if (!prev) return prev
              const s = prev.attempts.find(a => a.livekit_identity === ident)
              if (s) setTimeout(() => attachVideo(ident, pub.track), 100)
              return prev
            })
          }
        })
      })
      if (alreadyLive.length > 0) {
        setLiveSet(new Set(alreadyLive))
      }
    } catch (e) { console.warn('LiveKit proctor connection failed:', e) }
  }

  function attachVideo(identity: string, track: any) {
    const el = document.getElementById(`video-${identity}`) as HTMLVideoElement | null
    const ph = document.getElementById(`ph-${identity}`)
    if (!el) return
    try {
      track.attach(el)
      el.style.display = 'block'
      if (ph) ph.style.display = 'none'
    } catch {}
  }

  /* ── Toggles caméra / micro ──────────────────────────────────────────────── */

  async function toggleCam() {
    const room = roomRef.current
    if (!room) { toastErr('Connexion LiveKit non établie — rechargez la page'); return }
    const LK = window.LivekitClient
    try {
      if (!camOn) {
        const track = await LK.createLocalVideoTrack({ facingMode: 'user' })
        await room.localParticipant.publishTrack(track)
        myLocalCamRef.current = track
        setCamOn(true)
        success('Caméra activée')
      } else {
        if (myLocalCamRef.current) {
          myLocalCamRef.current.stop()
          await room.localParticipant.unpublishTrack(myLocalCamRef.current)
        }
        myLocalCamRef.current = null
        setCamOn(false)
        success('Caméra coupée')
      }
    } catch (e: any) { toastErr(e.message || 'Caméra non disponible') }
  }

  async function toggleMic() {
    const room = roomRef.current
    if (!room) { toastErr('Connexion LiveKit non établie — rechargez la page'); return }
    const LK = window.LivekitClient
    try {
      if (!micOn) {
        const track = await LK.createLocalAudioTrack()
        await room.localParticipant.publishTrack(track)
        myLocalMicRef.current = track
        setMicOn(true)
        success('Microphone activé')
      } else {
        if (myLocalMicRef.current) {
          myLocalMicRef.current.stop()
          await room.localParticipant.unpublishTrack(myLocalMicRef.current)
        }
        myLocalMicRef.current = null
        setMicOn(false)
        success('Microphone coupé')
      }
    } catch (e: any) { toastErr(e.message || 'Microphone non disponible') }
  }

  async function toggleGroupRec() {
    const role = data?.my_role || 'professor'
    const isSurv = role === 'surveillant'
    const endpoint = isSurv
      ? `/api/online_exams/${id}/group_recording`
      : `/api/online_exams/${id}/room_recording`
    try {
      if (!recording) {
        const res: any = await api.post(endpoint, { action: 'start' })
        roomEgressRef.current = res?.egress_id ?? null
        setRecording(true); success(isSurv ? 'REC Groupe démarré' : 'REC Salle démarrée')
      } else {
        await api.post(endpoint, { action: 'stop', egress_id: roomEgressRef.current })
        roomEgressRef.current = null
        setRecording(false); success('Enregistrement arrêté')
      }
    } catch (e: any) { toastErr(e.message || 'Erreur enregistrement') }
  }

  /* ── Enregistrement individuel ──────────────────────────────────────────── */

  async function toggleStudentRec(attemptId: number) {
    const starting = !recSet.has(attemptId)
    try {
      await api.post(`/api/exam_attempts/${attemptId}/recording`, { action: starting ? 'start' : 'stop' })
      if (starting) {
        setRecSet(prev => new Set(prev).add(attemptId))
        success('Enregistrement démarré')
      } else {
        setRecSet(prev => { const n = new Set(prev); n.delete(attemptId); return n })
        success('Enregistrement arrêté')
      }
    } catch (e: any) { toastErr(e.message || 'Erreur REC') }
  }

  /* ── Actions message / avertissement / exclusion ─────────────────────────── */

  async function sendMsg() {
    if (!msgModal || !msgText.trim()) return
    setSending(true)
    try {
      await api.post(
        `/api/exam_attempts/${msgModal.attemptId}/send_warning`,
        { message: msgText, type: msgModal.type === 'warning' ? 'warning' : 'message' }
      )
      success(msgModal.type === 'warning' ? 'Avertissement envoyé' : 'Message envoyé')
      setMsgModal(null); setMsgText('')
    } catch (e: any) { toastErr(e.message || 'Erreur') }
    finally { setSending(false) }
  }

  async function banStudent() {
    if (!banModal) return
    setBanning(true)
    try {
      await api.post(`/api/exam_attempts/${banModal.attemptId}/proctor_ban`, { reason: banReason || 'Comportement suspect' })
      success(`${banModal.name} exclu`)
      setBanModal(null); setBanReason('')
      loadData(true)
    } catch (e: any) { toastErr(e.message || 'Erreur') }
    finally { setBanning(false) }
  }

  async function grantExtraTime() {
    if (!extraModal) return
    const mins = parseInt(extraMins) || 15
    setGrantingTime(true)
    try {
      const res = await api.put<any>(`/api/exam_attempts/${extraModal.attemptId}/extra-time`, { minutes: mins })
      success(`+${res.added ?? mins} min accordées à ${extraModal.name}${res.total_extra ? ` (total : ${res.total_extra} min)` : ''}`)
      setExtraModal(null); setExtraMins('15')
    } catch (e: any) { toastErr(e.message || 'Erreur temps supplémentaire') }
    finally { setGrantingTime(false) }
  }

  async function saveNote() {
    if (!noteModal || !noteText.trim()) return
    setSavingNote(true)
    try {
      await api.post(`/api/exam_attempts/${noteModal.attemptId}/proctor-note`, { note: noteText })
      success('Note enregistrée')
      setNoteModal(null); setNoteText('')
    } catch (e: any) { toastErr(e.message || 'Erreur note') }
    finally { setSavingNote(false) }
  }

  async function openLogs(s: Student) {
    setLoadingLogs(true)
    setLogsPanel({ name: s.student_name, logs: [] })
    try {
      const res = await api.get<any>(`/api/exam_attempts/${s.attempt_id}/review`)
      /* review retourne { incidents: [], proctor_notes: [], ... } — on fusionne */
      const incidents = (res.incidents ?? []).map((l: any) => ({
        event_type: l.event_type ?? l.type ?? 'event',
        description: l.description ?? l.message ?? '',
        created_at: l.created_at ?? l.timestamp ?? null,
      }))
      const notes = (res.proctor_notes ?? []).map((n: any) => ({
        event_type: 'proctor_note',
        description: `[Note] ${n.note}${n.author ? ` — ${n.author}` : ''}`,
        created_at: n.timestamp ?? null,
      }))
      const all = [...incidents, ...notes].sort((a, b) =>
        new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
      )
      setLogsPanel({ name: s.student_name, logs: all })
    } catch {
      setLogsPanel({ name: s.student_name, logs: [] })
    } finally { setLoadingLogs(false) }
  }

  function openScreenView(s: Student) {
    setScreenModal({ attemptId: s.attempt_id, name: s.student_name, identity: s.livekit_identity })
  }

  /* attach screen track when modal opens */
  useEffect(() => {
    if (!screenModal || !screenVideoRef.current) return
    const track = screenTracksRef.current.get(screenModal.identity)
    if (track) {
      try { track.attach(screenVideoRef.current) } catch {}
    }
  }, [screenModal])

  /* ── Données dérivées ───────────────────────────────────────────────────── */

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
      <div style={{ fontSize: 15, fontWeight: 600 }}>Chargement du tableau de bord…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const examTitle     = data?.exam_title  || 'Examen'
  const examStatus    = data?.exam_status || '?'
  const myRole        = data?.my_role     || 'professor'
  const isSurveillant = myRole === 'surveillant'
  const students      = data?.attempts  ?? []
  const proctors      = data?.proctors  ?? []
  const msgsCount     = data?.messages_count ?? 0

  const inProgress = students.filter(s => s.status === 'in_progress')
  const completed  = students.filter(s => ['submitted', 'auto_submitted'].includes(s.status))
  const banned     = students.filter(s => s.status === 'banned')
  const highRisk   = students.filter(s => s.risk_score >= 60)
  const scored     = completed.filter(s => s.score != null)
  const avgScore   = scored.length ? (scored.reduce((a, s) => a + s.score!, 0) / scored.length) : null

  const agentLastCheck = agent?.last_check_ago_sec != null
    ? (agent.last_check_ago_sec < 60
        ? `il y a ${agent.last_check_ago_sec}s`
        : `il y a ${Math.floor(agent.last_check_ago_sec / 60)}min`)
    : '—'

  /* Grille "Vues en direct" : uniquement les étudiants connectés à LiveKit */
  const liveStudents = students.filter(s => {
    if (!liveSet.has(s.livekit_identity)) return false
    const q = search.toLowerCase()
    if (q && !s.student_name.toLowerCase().includes(q) && !(s.student_email || '').toLowerCase().includes(q)) return false
    /* filtres optionnels pour la vue surveillant */
    if (isSurveillant) {
      if (filter === 'in_progress') return s.status === 'in_progress'
      if (filter === 'high_risk')   return s.risk_score >= 60
      if (filter === 'banned')      return s.status === 'banned'
    }
    return true
  })

  /* ── Actions communes sur les cartes ──────────────────────────────────────── */
  function openMsg(s: Student, type: 'message' | 'warning') {
    setMsgModal({ attemptId: s.attempt_id, name: s.student_name, type }); setMsgText('')
  }
  function openBan(s: Student) {
    setBanModal({ attemptId: s.attempt_id, name: s.student_name }); setBanReason('')
  }
  function openExtra(s: Student) {
    setExtraModal({ attemptId: s.attempt_id, name: s.student_name }); setExtraMins('15')
  }
  function openNote(s: Student) {
    setNoteModal({ attemptId: s.attempt_id, name: s.student_name }); setNoteText('')
  }

  /* ── Alertes agent — marquer comme lue ──────────────────────────────────── */

  async function markAlertRead(attemptId: number) {
    try {
      await api.post('/api/agent/alerts/read', { attempt_ids: [attemptId] })
      fetchAgentAlerts()
    } catch {}
  }

  /* ── Appel privé ────────────────────────────────────────────────────────── */

  async function startPrivateCall(attemptId: number, name: string) {
    setPrivateCall({ attemptId, name })
    setPrivateStatus('Connexion en cours…')
    setPrivateCamOn(false)
    setPrivateMicOn(false)
    try {
      await api.post(`/api/exam_attempts/${attemptId}/send_warning`, {
        message: 'Appel privé initié par le surveillant', type: 'private_call'
      })
      const tok = await api.get<{ ws_url: string; token: string }>(`/api/exam_attempts/${attemptId}/private_token`)
      const LK  = window.LivekitClient
      if (!LK) throw new Error('LiveKit non chargé')
      const pr = new LK.Room({ adaptiveStream: true, dynacast: true })
      privateRoomRef.current = pr
      pr.on(LK.RoomEvent.TrackSubscribed, (track: any) => {
        if (track.kind === 'video') {
          const el = document.getElementById('private-student-video') as HTMLVideoElement | null
          if (el) track.attach(el)
        } else if (track.kind === 'audio') {
          const el = document.getElementById('private-student-audio') as HTMLAudioElement | null
          if (el) track.attach(el)
        }
      })
      pr.on(LK.RoomEvent.ParticipantConnected, () => {
        setPrivateStatus(`${name} a rejoint l'appel`)
        success(`${name} a rejoint l'appel privé`)
      })
      pr.on(LK.RoomEvent.Disconnected, () => setPrivateStatus('Déconnecté'))
      await pr.connect(tok.ws_url, tok.token)
      setPrivateStatus(`En attente de ${name}…`)
      // micro automatique
      const micTrack = await LK.createLocalAudioTrack()
      await pr.localParticipant.publishTrack(micTrack)
      privateMicRef.current = micTrack
      setPrivateMicOn(true)
    } catch (e: any) {
      toastErr(e.message || 'Erreur appel privé')
      setPrivateCall(null)
    }
  }

  async function endPrivateCall() {
    if (privateCall) {
      try { await api.post(`/api/exam_attempts/${privateCall.attemptId}/send_warning`, { message: 'Appel privé terminé', type: 'end_call' }) } catch {}
    }
    if (privateCamRef.current) {
      try { await privateRoomRef.current?.localParticipant.unpublishTrack(privateCamRef.current) } catch {}
      privateCamRef.current.stop(); privateCamRef.current = null
    }
    if (privateMicRef.current) {
      try { await privateRoomRef.current?.localParticipant.unpublishTrack(privateMicRef.current) } catch {}
      privateMicRef.current.stop(); privateMicRef.current = null
    }
    await privateRoomRef.current?.disconnect()
    privateRoomRef.current = null
    setPrivateCall(null); setPrivateCamOn(false); setPrivateMicOn(false)
    const sv = document.getElementById('private-student-video') as HTMLVideoElement | null
    if (sv) sv.srcObject = null
    const mp = document.getElementById('private-my-preview') as HTMLVideoElement | null
    if (mp) mp.srcObject = null
  }

  async function togglePrivateCam() {
    const LK = window.LivekitClient
    if (!LK || !privateRoomRef.current) return
    if (!privateCamOn) {
      try {
        const t = await LK.createLocalVideoTrack({ resolution: LK.VideoPresets.h360.resolution })
        await privateRoomRef.current.localParticipant.publishTrack(t)
        privateCamRef.current = t
        const prev = document.getElementById('private-my-preview') as HTMLVideoElement | null
        if (prev) t.attach(prev)
        setPrivateCamOn(true)
      } catch (e: any) { toastErr(e.message || 'Caméra indisponible') }
    } else {
      const prev = document.getElementById('private-my-preview') as HTMLVideoElement | null
      if (prev && privateCamRef.current) privateCamRef.current.detach(prev)
      if (privateCamRef.current) { await privateRoomRef.current?.localParticipant.unpublishTrack(privateCamRef.current); privateCamRef.current.stop(); privateCamRef.current = null }
      setPrivateCamOn(false)
    }
  }

  async function togglePrivateMic() {
    const LK = window.LivekitClient
    if (!LK || !privateRoomRef.current) return
    if (!privateMicOn) {
      try {
        const t = await LK.createLocalAudioTrack()
        await privateRoomRef.current.localParticipant.publishTrack(t)
        privateMicRef.current = t
        setPrivateMicOn(true)
      } catch (e: any) { toastErr(e.message || 'Micro indisponible') }
    } else {
      if (privateMicRef.current) { await privateRoomRef.current?.localParticipant.unpublishTrack(privateMicRef.current); privateMicRef.current.stop(); privateMicRef.current = null }
      setPrivateMicOn(false)
    }
  }

  /* ── Enregistrements ────────────────────────────────────────────────────── */

  async function openRecordings() {
    setRecModal(true); setRecTab('videos')
    await loadVideoRecs()
  }

  async function loadVideoRecs() {
    setLoadingRecs(true)
    try {
      const data = await api.get<any>(`/api/online_exams/${id}/video_recordings`)
      setVideoRecs(data)
    } catch (e: any) {
      setVideoRecs({ error: e.message, videos: [] })
    } finally { setLoadingRecs(false) }
  }

  async function loadSnapRecs() {
    setLoadingRecs(true)
    try {
      const data = await api.get<any>(`/api/online_exams/${id}/recordings`)
      setSnapRecs(data)
    } catch (e: any) {
      setSnapRecs({ error: e.message, students: [] })
    } finally { setLoadingRecs(false) }
  }

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <style>{`
        @keyframes spin    { to { transform:rotate(360deg) } }
        @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.9)} }
        @keyframes ripple  { 0%{box-shadow:0 0 0 0 rgba(16,185,129,.7)} 50%{box-shadow:0 0 0 6px rgba(16,185,129,0)} 100%{box-shadow:0 0 0 0 rgba(16,185,129,0)} }
        .mon-filter { padding:6px 14px;border:2px solid rgba(255,255,255,.15);background:transparent;color:rgba(255,255,255,.7);border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s; }
        .mon-filter:hover,.mon-filter.active { border-color:#3b82f6;background:#3b82f6;color:white; }
        .mon-tbl { width:100%;border-collapse:collapse; }
        .mon-tbl thead { background:transparent !important;position:static !important; }
        .mon-tbl th { font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.35);padding:8px 14px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);font-weight:600;letter-spacing:.06em;background:transparent !important; }
        .mon-tbl td { padding:10px 14px;font-size:12px;color:rgba(255,255,255,.75);border-bottom:1px solid rgba(255,255,255,.04); }
        .mon-tbl tr:last-child td { border-bottom:none; }
        .mon-tbl tr:hover { background:none !important; }
        .mon-tbl tr:hover td { background:rgba(255,255,255,.03); }
        .mon-act { display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:5px;font-size:10px;cursor:pointer;border:none;font-weight:600;transition:opacity .15s; }
        .mon-act:hover { opacity:.8; }
        .hdr-btn { padding:7px 14px;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s; }
        .hdr-btn:hover { filter:brightness(1.15); }
        .video-card { background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.08);transition:transform .2s,box-shadow .2s; }
        .video-card:hover { transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3); }
        .tv-sig-btn { display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:5px;font-size:10px;cursor:pointer;font-weight:600; }
        .tv-sig-btn.pre  { background:rgba(16,185,129,.15);color:#6ee7b7;border:1px solid rgba(16,185,129,.3); }
        .tv-sig-btn.post { background:rgba(37,99,235,.15);color:#93c5fd;border:1px solid rgba(37,99,235,.3); }
        .tv-sig-btn.absent { background:rgba(255,255,255,.05);color:rgba(255,255,255,.35);border:1px solid rgba(255,255,255,.1);cursor:default; }
        .tv-risk-badge { padding:2px 7px;border-radius:6px;font-size:10px;font-weight:700; }
        .tv-risk-badge.high { background:rgba(239,68,68,.2);color:#ef4444; }
        .tv-risk-badge.medium { background:rgba(245,158,11,.2);color:#f59e0b; }
        .tv-risk-badge.low { background:rgba(16,185,129,.2);color:#10b981; }
        .card-act-btn { display:inline-flex;align-items:center;justify-content:center;gap:3px;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid transparent;transition:opacity .15s;flex:1; }
        .card-act-btn:hover { opacity:.8; }
      `}</style>

      {/* ══════════════════════════════════════════════════════ HEADER */}
      <div style={{ background: '#1a2744', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 2px 12px rgba(0,0,0,.4)', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid rgba(255,255,255,.06)' }}>

        {/* Gauche : titre + rôle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, background: 'rgba(37,99,235,.25)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className={`fas ${isSurveillant ? 'fa-user-shield' : 'fa-chalkboard-teacher'}`} style={{ fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{examTitle}</div>
            <div style={{ fontSize: 10, opacity: .6, marginTop: 2 }}>
              {isSurveillant ? 'Surveillant — Mon groupe' : 'Enseignant — Vue globale'} &middot; {examStatus}
            </div>
          </div>
        </div>

        {/* Centre : pills stats */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill label="LIVE" dot="#10b981" />
          <Pill label={`${inProgress.length} actifs`} icon="fa-users" />
          {highRisk.length > 0 && <Pill label={`${highRisk.length} risque élevé`} icon="fa-exclamation-triangle" color="rgba(239,68,68,.25)" />}
          {banned.length > 0 && <Pill label={`${banned.length} exclus`} icon="fa-ban" color="rgba(239,68,68,.2)" />}
          {!isSurveillant && completed.length > 0 && <Pill label={`${completed.length} terminés`} icon="fa-check-circle" color="rgba(16,185,129,.2)" />}
          {!isSurveillant && avgScore != null && <Pill label={`Moy. ${avgScore.toFixed(1)}/20`} icon="fa-star" color="rgba(59,130,246,.25)" />}
          {(msgsCount > 0 || studentMsgs.length > 0) && (
            <button onClick={() => { setStudentMsgsModal(true); setNewMsgCount(0) }} style={{ background: newMsgCount > 0 ? 'rgba(37,99,235,.6)' : 'rgba(255,255,255,.12)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
              <i className="fas fa-comments" />
              {studentMsgs.length > 0 ? studentMsgs.length : msgsCount} message(s)
              {newMsgCount > 0 && <span style={{ background: '#ef4444', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{newMsgCount}</span>}
            </button>
          )}
        </div>

        {/* Droite : boutons action (labels différents selon rôle) */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="hdr-btn" onClick={toggleCam}
            style={{ background: camOn ? '#10b981' : 'rgba(255,255,255,.12)', color: 'white' }}>
            <i className={`fas ${camOn ? 'fa-video' : 'fa-video-slash'}`} />
            {isSurveillant ? (camOn ? 'Arrêter caméra' : 'Diffuser caméra') : (camOn ? 'Couper caméra' : 'Caméra')}
          </button>
          <button className="hdr-btn" onClick={toggleMic}
            style={{ background: micOn ? '#3b82f6' : 'rgba(255,255,255,.12)', color: 'white' }}>
            <i className={`fas ${micOn ? 'fa-microphone' : 'fa-microphone-slash'}`} />
            {isSurveillant ? (micOn ? 'Arrêter micro' : 'Diffuser micro') : (micOn ? 'Couper micro' : 'Micro')}
          </button>
          <button className="hdr-btn" onClick={toggleGroupRec}
            style={{ background: recording ? '#ef4444' : 'rgba(255,255,255,.12)', color: 'white' }}>
            <span style={{ width: 7, height: 7, background: recording ? 'white' : '#ef4444', borderRadius: '50%', display: 'inline-block', animation: recording ? 'pulse 1s infinite' : 'none' }} />
            {recording ? 'Arrêter REC' : (isSurveillant ? 'REC Groupe' : 'REC Salle')}
          </button>
          <button className="hdr-btn" onClick={openRecordings}
            style={{ background: 'rgba(255,255,255,.1)', color: 'white' }}>
            <i className="fas fa-film" /> Enregistrements
          </button>
          {/* Cloche alertes agent */}
          <div style={{ position: 'relative' }}>
            <button className="hdr-btn" onClick={() => setAgentPanel(p => !p)}
              style={{ background: alertBadge > 0 ? 'rgba(239,68,68,.25)' : 'rgba(255,255,255,.1)', color: 'white', position: 'relative' }}>
              <i className="fas fa-bell" />
              {alertBadge > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {alertBadge > 99 ? '99+' : alertBadge}
                </span>
              )}
            </button>
            {agentPanel && (
              <div style={{ position: 'absolute', top: 44, right: 0, width: 360, maxHeight: 480, overflowY: 'auto', background: '#1e293b', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 20px 50px rgba(0,0,0,.6)', zIndex: 9999 }}
                onClick={e => e.stopPropagation()}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}><i className="fas fa-robot" style={{ marginRight: 6, color: '#60a5fa' }} />Alertes Agent IA</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {agentAlerts.length > 0 && <button onClick={() => { agentAlerts.forEach(a => markAlertRead(a.attempt_id)) }} style={{ fontSize: 10, background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.6)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>Tout lu</button>}
                    <button onClick={() => setAgentPanel(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer' }}><i className="fas fa-times" /></button>
                  </div>
                </div>
                {agentAlerts.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                    <i className="fas fa-shield-check" style={{ fontSize: 24, display: 'block', marginBottom: 8, color: '#10b981' }} />Aucune alerte active
                  </div>
                ) : agentAlerts.map((a: any, i: number) => {
                  const col = a.level === 'URGENT' ? '#ef4444' : '#f59e0b'
                  const ts  = a.timestamp ? new Date(a.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
                  return (
                    <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ background: col, color: '#fff', padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{a.level}</span>
                          <strong style={{ fontSize: 13, color: '#f1f5f9' }}>{a.student_name}</strong>
                        </div>
                        <span style={{ fontSize: 10, color: '#64748b' }}>{ts}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                        Risque <strong style={{ color: col }}>{a.risk_score}/100</strong> &middot; Sans visage {a.no_face || 0}× &middot; Tab {a.tab_switches || 0}×
                      </div>
                      {a.ai_note && <div style={{ fontSize: 11, color: '#7dd3fc', background: '#0c1929', padding: '5px 9px', borderRadius: 5, marginBottom: 6, borderLeft: '3px solid #2563eb' }}>{a.ai_note}</div>}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button onClick={() => { setAgentPanel(false); setMsgModal({ attemptId: a.attempt_id, name: a.student_name, type: 'warning' }); setMsgText('') }}
                          style={{ fontSize: 10, background: '#f59e0b', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                          <i className="fas fa-exclamation-triangle" /> Avertir
                        </button>
                        <button onClick={() => { setAgentPanel(false); startPrivateCall(a.attempt_id, a.student_name) }}
                          style={{ fontSize: 10, background: '#2563eb', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                          <i className="fas fa-phone" /> Appel
                        </button>
                        <button onClick={() => { setAgentPanel(false); setBanModal({ attemptId: a.attempt_id, name: a.student_name }); setBanReason('') }}
                          style={{ fontSize: 10, background: '#dc2626', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                          <i className="fas fa-ban" /> Exclure
                        </button>
                        <button onClick={() => markAlertRead(a.attempt_id)}
                          style={{ fontSize: 10, background: 'rgba(255,255,255,.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,.1)', padding: '4px 8px', borderRadius: 5, cursor: 'pointer' }}>
                          <i className="fas fa-check" /> Lu
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <button className="hdr-btn" onClick={() => loadData(true)}
            style={{ background: 'rgba(255,255,255,.1)', color: 'white' }}>
            {refreshing ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-sync-alt" />}
          </button>
          <button className="hdr-btn" onClick={() => router.back()}
            style={{ background: 'rgba(255,255,255,.1)', color: 'white' }}>
            <i className="fas fa-arrow-left" /> Retour
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ BODY */}
      <div style={{ padding: '20px 22px', maxWidth: 1700, margin: '0 auto' }}>

        {/* Banner Agent IA */}
        <AgentBanner agent={agent} lastCheck={agentLastCheck} studentsCount={students.length} />

        {/* Surveillants connectés (prof uniquement) */}
        {!isSurveillant && proctors.length > 0 && (
          <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.07)', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              <i className="fas fa-user-tie" style={{ marginRight: 5 }} />Surveillants connectés
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {proctors.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', background: 'rgba(255,255,255,.05)', borderRadius: 8, border: '1px solid rgba(255,255,255,.08)', fontSize: 12 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.online ? '#10b981' : '#475569', display: 'inline-block' }} />
                  {p.name}
                  {p.student_count != null && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>({p.student_count} étud.)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mini-stats + filtres */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
          {[
            { label: 'Total', val: students.length, color: '#e2e8f0' },
            { label: 'En cours', val: inProgress.length, color: '#34d399' },
            { label: 'Terminés', val: completed.length, color: '#6ee7b7' },
            { label: 'Exclus', val: banned.length, color: '#f87171' },
            ...(avgScore != null ? [{ label: 'Moy.', val: `${avgScore.toFixed(1)}/20`, color: '#93c5fd' }] : []),
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px', background: 'rgba(255,255,255,.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,.07)', minWidth: 80 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(255,255,255,.35)', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          {/* Filtres uniquement pour les tables du prof ou la grille du surveillant */}
          {(['all', 'in_progress', 'high_risk', 'banned'] as Filter[]).map(f => (
            <button key={f} className={`mon-filter${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Tous' : f === 'in_progress' ? 'En cours' : f === 'high_risk' ? 'Risque élevé' : 'Bannis'}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ padding: '7px 14px', border: '2px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'white', borderRadius: 20, fontSize: 12, outline: 'none', width: 180 }} />
        </div>

        {/* ═══════════ TABLES PROFESSEUR uniquement ═══════════════════════ */}
        {!isSurveillant && (
          <>
            {/* Table EN COURS */}
            {(filter === 'all' || filter === 'in_progress' || filter === 'high_risk') && (
              <Section title="En cours" count={inProgress.filter(s => filter !== 'high_risk' || s.risk_score >= 60).length} dot="#10b981" badgeBg="rgba(16,185,129,.2)" badgeColor="#6ee7b7">
                <table className="mon-tbl">
                  <thead>
                    <tr>
                      <th>Étudiant</th><th>Démarré</th><th>Durée</th><th>Risque</th>
                      <th>Tabs / Alertes</th><th>Surveillant</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inProgress
                      .filter(s => {
                        const q = search.toLowerCase()
                        const m = !q || s.student_name.toLowerCase().includes(q)
                        if (!m) return false
                        if (filter === 'high_risk') return s.risk_score >= 60
                        return true
                      })
                      .map(s => {
                        const rc = riskCls(s.risk_score)
                        return (
                          <tr key={s.attempt_id}>
                            <td>
                              <strong style={{ color: 'rgba(255,255,255,.9)' }}>{s.student_name}</strong>
                              <br /><span style={{ color: 'rgba(255,255,255,.35)', fontSize: 10 }}>{s.student_email}</span>
                            </td>
                            <td>{fmtTime(s.started_at)}</td>
                            <td>{elapsed(s.started_at)}</td>
                            <td><span className={`tv-risk-badge ${rc}`}>{s.risk_score || 0}%</span></td>
                            <td>
                              <span style={{ color: s.tab_switches > 2 ? '#fcd34d' : 'rgba(255,255,255,.45)' }}>Tabs: {s.tab_switches || 0}</span>
                              {' · '}
                              <span style={{ color: s.warnings_count > 0 ? '#fca5a5' : 'rgba(255,255,255,.45)' }}>Alertes: {s.warnings_count || 0}</span>
                            </td>
                            <td style={{ color: 'rgba(255,255,255,.55)' }}>{s.proctor_name || '—'}</td>
                            <td>
                              <button className="mon-act" style={{ background: 'rgba(37,99,235,.2)', color: '#93c5fd', marginRight: 4 }}
                                onClick={() => openMsg(s, 'message')}>
                                <i className="fas fa-comment" /> Message
                              </button>
                              <button className="mon-act" style={{ background: 'rgba(245,158,11,.2)', color: '#fcd34d', marginRight: 4 }}
                                onClick={() => openMsg(s, 'warning')}>
                                <i className="fas fa-exclamation-triangle" /> Avertir
                              </button>
                              <button className="mon-act" style={{ background: 'rgba(239,68,68,.2)', color: '#fca5a5' }}
                                onClick={() => openBan(s)}>
                                <i className="fas fa-ban" /> Exclure
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
              </Section>
            )}

            {/* Table TERMINÉS */}
            {(filter === 'all') && (
              <Section title="Terminés" count={completed.length} icon="fa-check-circle" iconColor="#10b981" badgeBg="rgba(16,185,129,.2)" badgeColor="#6ee7b7">
                <table className="mon-tbl">
                  <thead>
                    <tr>
                      <th>Étudiant</th><th>Statut</th><th>Soumis à</th><th>Durée</th>
                      <th>Note</th><th>Risque</th><th>Sig. pré</th><th>Sig. post</th><th>Surveillant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completed.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,.3)' }}>Aucune copie soumise</td></tr>
                    ) : completed.map(s => {
                      const rc    = riskCls(s.risk_score)
                      const isAuto = s.status === 'auto_submitted'
                      const dur   = s.duration_minutes != null ? `${s.duration_minutes} min` : '—'
                      const preSigEl = s.has_pre_sig
                        ? <span className="tv-sig-btn pre"><i className="fas fa-signature" /> Voir</span>
                        : <span className="tv-sig-btn absent"><i className="fas fa-times-circle" /> Absente</span>
                      const postSigEl = isAuto
                        ? <span className="tv-sig-btn absent"><i className="fas fa-robot" /> Auto</span>
                        : s.has_post_sig
                          ? <span className="tv-sig-btn post"><i className="fas fa-signature" /> Voir</span>
                          : <span className="tv-sig-btn absent"><i className="fas fa-times-circle" /> Absente</span>
                      return (
                        <tr key={s.attempt_id}>
                          <td>
                            <strong style={{ color: 'rgba(255,255,255,.9)' }}>{s.student_name}</strong>
                            <br /><span style={{ color: 'rgba(255,255,255,.35)', fontSize: 10 }}>{s.student_email}</span>
                          </td>
                          <td>
                            <span style={{ background: isAuto ? 'rgba(99,102,241,.2)' : 'rgba(16,185,129,.2)', color: isAuto ? '#c7d2fe' : '#6ee7b7', borderRadius: 4, padding: '2px 7px', fontSize: 10 }}>
                              {isAuto ? 'Auto-soumis' : 'Soumis'}
                            </span>
                          </td>
                          <td>{fmtTime(s.submitted_at)}</td>
                          <td>{dur}</td>
                          <td style={{ fontWeight: 700, color: s.score != null ? '#93c5fd' : 'rgba(255,255,255,.35)' }}>
                            {s.score != null ? `${s.score}/20` : '—'}
                          </td>
                          <td><span className={`tv-risk-badge ${rc}`}>{s.risk_score || 0}%</span></td>
                          <td>{preSigEl}</td>
                          <td>{postSigEl}</td>
                          <td style={{ color: 'rgba(255,255,255,.55)' }}>{s.proctor_name || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Table EXCLUS */}
            {(filter === 'all' || filter === 'banned') && (
              <Section title="Exclus" count={banned.length} icon="fa-ban" iconColor="#ef4444" badgeBg="rgba(239,68,68,.2)" badgeColor="#fca5a5">
                <table className="mon-tbl">
                  <thead>
                    <tr><th>Étudiant</th><th>Motif d'exclusion</th><th>Risque</th><th>Surveillant</th></tr>
                  </thead>
                  <tbody>
                    {banned.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,.3)' }}>Aucun étudiant exclu</td></tr>
                    ) : banned.map(s => {
                      const rc = riskCls(s.risk_score)
                      return (
                        <tr key={s.attempt_id}>
                          <td><strong style={{ color: 'rgba(255,255,255,.9)' }}>{s.student_name}</strong></td>
                          <td style={{ color: '#fca5a5' }}>{s.ban_reason || '—'}</td>
                          <td><span className={`tv-risk-badge ${rc}`}>{s.risk_score || 0}%</span></td>
                          <td style={{ color: 'rgba(255,255,255,.55)' }}>{s.proctor_name || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Section>
            )}
          </>
        )}

        {/* ═══════════ GRILLE VIDÉO — uniquement les étudiants connectés (LiveKit) ═══ */}
        <div style={{ marginTop: !isSurveillant ? 24 : 0 }}>
          {liveStudents.length > 0 && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Vues en direct ({liveStudents.length})
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
            {liveStudents.map(s => (
              <VideoCard key={s.attempt_id} s={s}
                recActive={recSet.has(s.attempt_id)}
                screenAvail={screenSet.has(s.livekit_identity)}
                onMsg={type => openMsg(s, type)}
                onBan={() => openBan(s)}
                onRec={() => toggleStudentRec(s.attempt_id)}
                onScreen={() => openScreenView(s)}
                onCall={() => startPrivateCall(s.attempt_id, s.student_name)}
                onExtraTime={() => openExtra(s)}
                onNote={() => openNote(s)}
                onLogs={() => openLogs(s)}
              />
            ))}
          </div>
          {liveSet.size === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,.25)' }}>
              <i className="fas fa-hourglass-half" style={{ fontSize: 48, display: 'block', marginBottom: 14 }} />
              En attente de connexion des étudiants
            </div>
          ) : liveStudents.length === 0 && filter !== 'all' ? (
            <div style={{ textAlign: 'center', padding: '40px 24px', color: 'rgba(255,255,255,.25)' }}>
              <i className="fas fa-filter" style={{ fontSize: 32, display: 'block', marginBottom: 12 }} />
              Aucun étudiant connecté correspondant à ce filtre
            </div>
          ) : null}
        </div>
      </div>

      {/* ══════════════════════════════════════════════ MODALS */}

      {/* Message / Avertissement */}
      {msgModal && (
        <Modal onClose={() => setMsgModal(null)}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className={`fas ${msgModal.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-comment'}`}
              style={{ color: msgModal.type === 'warning' ? '#f59e0b' : '#3b82f6' }} />
            {msgModal.type === 'warning' ? 'Envoyer un avertissement' : 'Envoyer un message'}
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginBottom: 16 }}>À : <strong>{msgModal.name}</strong></p>
          <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={4}
            placeholder={msgModal.type === 'warning' ? "Motif de l'avertissement…" : 'Votre message…'}
            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,.05)', border: '2px solid rgba(255,255,255,.12)', color: 'white', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'none', marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setMsgModal(null)} style={btnSecondary}>Annuler</button>
            <button onClick={sendMsg} disabled={sending || !msgText.trim()}
              style={{ ...btnPrimary, background: msgModal.type === 'warning' ? '#f59e0b' : '#3b82f6', opacity: (sending || !msgText.trim()) ? .5 : 1 }}>
              {sending ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
              {msgModal.type === 'warning' ? 'Avertir' : 'Envoyer'}
            </button>
          </div>
        </Modal>
      )}

      {/* Exclusion */}
      {banModal && (
        <Modal onClose={() => setBanModal(null)}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, color: '#fca5a5' }}>
            <i className="fas fa-ban" /> Exclure {banModal.name}
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginBottom: 16 }}>Cette action est définitive. L'étudiant ne pourra plus continuer son examen.</p>
          <input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Motif d'exclusion (optionnel)"
            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,.05)', border: '2px solid rgba(255,255,255,.12)', color: 'white', borderRadius: 8, fontSize: 13, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setBanModal(null)} style={btnSecondary}>Annuler</button>
            <button onClick={banStudent} disabled={banning}
              style={{ ...btnPrimary, background: '#ef4444', opacity: banning ? .5 : 1 }}>
              {banning ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-ban" />} Confirmer l'exclusion
            </button>
          </div>
        </Modal>
      )}

      {/* Temps supplémentaire */}
      {extraModal && (
        <Modal onClose={() => setExtraModal(null)}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, color: '#fcd34d' }}>
            <i className="fas fa-clock" /> Temps supplémentaire
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginBottom: 16 }}>Étudiant : <strong>{extraModal.name}</strong></p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['5', '10', '15', '20', '30'].map(m => (
              <button key={m} onClick={() => setExtraMins(m)}
                style={{ padding: '8px 16px', border: `2px solid ${extraMins === m ? '#f59e0b' : 'rgba(255,255,255,.12)'}`, background: extraMins === m ? 'rgba(245,158,11,.2)' : 'transparent', color: extraMins === m ? '#f59e0b' : 'rgba(255,255,255,.7)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                +{m} min
              </button>
            ))}
          </div>
          <input type="number" min={1} max={120} value={extraMins} onChange={e => setExtraMins(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,.05)', border: '2px solid rgba(255,255,255,.12)', color: 'white', borderRadius: 8, fontSize: 13, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setExtraModal(null)} style={btnSecondary}>Annuler</button>
            <button onClick={grantExtraTime} disabled={grantingTime}
              style={{ ...btnPrimary, background: '#d97706', opacity: grantingTime ? .5 : 1 }}>
              {grantingTime ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-clock" />} Accorder +{extraMins} min
            </button>
          </div>
        </Modal>
      )}

      {/* Note de surveillance */}
      {noteModal && (
        <Modal onClose={() => setNoteModal(null)}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, color: '#a5b4fc' }}>
            <i className="fas fa-sticky-note" /> Note de surveillance
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginBottom: 16 }}>Étudiant : <strong>{noteModal.name}</strong></p>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={5}
            placeholder="Votre observation de surveillance…"
            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,.05)', border: '2px solid rgba(255,255,255,.12)', color: 'white', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'none', marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setNoteModal(null)} style={btnSecondary}>Annuler</button>
            <button onClick={saveNote} disabled={savingNote || !noteText.trim()}
              style={{ ...btnPrimary, background: '#6366f1', opacity: (savingNote || !noteText.trim()) ? .5 : 1 }}>
              {savingNote ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />} Enregistrer
            </button>
          </div>
        </Modal>
      )}

      {/* Vue écran partagé */}
      {screenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }}>
          <div style={{ background: '#0f172a', borderRadius: 14, overflow: 'hidden', maxWidth: 1000, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
                <i className="fas fa-desktop" style={{ color: '#6366f1' }} />
                Écran de {screenModal.name}
              </div>
              <button onClick={() => setScreenModal(null)} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: 'white', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                <i className="fas fa-times" /> Fermer
              </button>
            </div>
            <div style={{ background: '#000', aspectRatio: '16/9', position: 'relative' }}>
              <video ref={screenVideoRef} autoPlay playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              {!screenTracksRef.current.has(screenModal.identity) && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.4)', gap: 10 }}>
                  <i className="fas fa-desktop" style={{ fontSize: 48 }} />
                  <span style={{ fontSize: 13 }}>Partage d'écran non disponible</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overlay pour fermer le panel agent au clic extérieur */}
      {agentPanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setAgentPanel(false)} />
      )}

      {/* ══════════════ Modal Messages Étudiants */}
      {studentMsgsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={e => { if (e.target === e.currentTarget) setStudentMsgsModal(false) }}>
          <div style={{ background: '#1e293b', color: 'white', borderRadius: 16, maxWidth: 560, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}><i className="fas fa-comments" style={{ marginRight: 8, color: '#60a5fa' }} />Messages des étudiants</div>
              <button onClick={() => setStudentMsgsModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 18 }}><i className="fas fa-times" /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: 18 }}>
              {studentMsgs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,.4)' }}>
                  <i className="fas fa-comments" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />Aucun message reçu
                </div>
              ) : studentMsgs.map((m: any, i: number) => (
                <div key={i} style={{ background: 'rgba(37,99,235,.1)', borderLeft: '3px solid #3b82f6', borderRadius: 6, padding: '10px 14px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ color: '#93c5fd', fontSize: 13 }}><i className="fas fa-user-graduate" style={{ marginRight: 5 }} />{m.student_name}</strong>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{m.timestamp ? new Date(m.timestamp).toLocaleTimeString('fr-FR') : ''}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'white', marginBottom: 8 }}>{m.message}</div>
                  <button onClick={() => { setStudentMsgsModal(false); setMsgModal({ attemptId: m.attempt_id, name: m.student_name, type: 'message' }); setMsgText('') }}
                    style={{ fontSize: 11, background: 'rgba(37,99,235,.3)', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                    <i className="fas fa-reply" /> Répondre
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ Modal Enregistrements */}
      {recModal && (() => {
        const REC_TYPE: Record<string, { icon: string; color: string; label: string }> = {
          'individuel':    { icon: 'fa-video',    color: '#60a5fa', label: 'REC individuel' },
          'groupe-caméra': { icon: 'fa-users',    color: '#f59e0b', label: 'REC groupe — caméra' },
          'groupe-écran':  { icon: 'fa-desktop',  color: '#06b6d4', label: 'REC groupe — écran' },
          'salle':         { icon: 'fa-building', color: '#10b981', label: 'Enreg. salle' },
        }
        const STATUS_COLOR: Record<string, string> = { in_progress: '#10b981', submitted: '#3b82f6', banned: '#ef4444', auto_submitted: '#f59e0b' }
        const STATUS_LABEL: Record<string, string> = { in_progress: 'En cours', submitted: 'Soumis', banned: 'Exclu', auto_submitted: 'Auto-soumis' }
        const snapStudents: any[] = snapRecs?.students || []
        const curSnap = snapStudents[selectedSnapIdx] || null

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
            onClick={e => { if (e.target === e.currentTarget) setRecModal(false) }}>
            <div style={{ background: '#1e293b', color: 'white', borderRadius: 16, maxWidth: 860, width: '96%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.7)' }}>

              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}><i className="fas fa-film" style={{ marginRight: 8, color: '#60a5fa' }} />Enregistrements</div>
                <button onClick={() => setRecModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 20 }}><i className="fas fa-times" /></button>
              </div>

              {/* Onglets */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {(['videos', 'snapshots'] as const).map(t => (
                  <button key={t} onClick={async () => {
                    setRecTab(t)
                    if (t === 'snapshots' && !snapRecs) { await loadSnapRecs(); setSelectedSnapIdx(0) }
                    if (t === 'videos'    && !videoRecs) await loadVideoRecs()
                  }}
                    style={{ flex: 1, padding: '13px 0', border: 'none', background: recTab === t ? 'rgba(59,130,246,.15)' : 'transparent', color: recTab === t ? 'white' : 'rgba(255,255,255,.45)', fontWeight: 700, fontSize: 13, cursor: 'pointer', borderBottom: `2px solid ${recTab === t ? '#3b82f6' : 'transparent'}` }}>
                    <i className={`fas ${t === 'videos' ? 'fa-video' : 'fa-camera'}`} style={{ marginRight: 7 }} />
                    {t === 'videos' ? 'Vidéos enregistrées' : 'Snapshots caméra'}
                  </button>
                ))}
              </div>

              {/* Corps */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {loadingRecs ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.4)' }}>
                    <i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} />
                  </div>

                ) : recTab === 'videos' ? (
                  /* ── ONGLET VIDÉOS ─────────────────────────────────── */
                  <div style={{ overflowY: 'auto', flex: 1, padding: 18 }}>
                    {!videoRecs || (videoRecs.videos || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '50px 20px', color: 'rgba(255,255,255,.4)' }}>
                        <i className="fas fa-video-slash" style={{ fontSize: 40, display: 'block', marginBottom: 14 }} />
                        {videoRecs?.error || 'Aucun enregistrement vidéo disponible'}
                      </div>
                    ) : (
                      <>
                        {/* Résumé */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>
                            <i className="fas fa-film" style={{ marginRight: 5, color: '#60a5fa' }} />
                            <strong style={{ color: 'rgba(255,255,255,.8)' }}>{(videoRecs.videos || []).length}</strong> enregistrement(s) sur{' '}
                            <strong style={{ color: 'rgba(255,255,255,.8)' }}>{videoRecs.attempts_total || videoRecs.recorded_count || (videoRecs.videos || []).length}</strong> étudiant(s)
                          </div>
                          <button onClick={loadVideoRecs} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.7)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            <i className="fas fa-sync-alt" style={{ marginRight: 5 }} />Actualiser
                          </button>
                        </div>

                        {(videoRecs.videos || []).map((v: any, i: number) => {
                          const rt   = REC_TYPE[v.rec_type] || REC_TYPE['individuel']
                          const sc   = STATUS_COLOR[v.student_status] || '#64748b'
                          const sl   = STATUS_LABEL[v.student_status] || v.student_status || ''
                          const ts   = v.last_modified ? new Date(v.last_modified).toLocaleString('fr-FR') : '—'
                          const started   = v.started_at   ? new Date(v.started_at).toLocaleString('fr-FR') : null
                          const submitted = v.submitted_at ? new Date(v.submitted_at).toLocaleString('fr-FR') : null
                          return (
                            <div key={i} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 10, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                              {/* Icône type */}
                              <div style={{ width: 44, height: 44, background: `${rt.color}22`, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <i className={`fas ${rt.icon}`} style={{ color: rt.color, fontSize: 18 }} />
                              </div>
                              {/* Infos */}
                              <div style={{ flex: 1, minWidth: 180 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <i className="fas fa-user-graduate" style={{ color: '#60a5fa', fontSize: 12 }} />
                                  {v.student_name}
                                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${rt.color}22`, color: rt.color, fontWeight: 700 }}>{rt.label}</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', lineHeight: 1.8 }}>
                                  <i className="fas fa-file-video" style={{ marginRight: 3 }} />{v.filename}
                                  {v.size_mb && <>&nbsp;·&nbsp;<i className="fas fa-weight-hanging" style={{ marginRight: 3 }} />{v.size_mb} Mo</>}
                                  &nbsp;·&nbsp;<i className="fas fa-save" style={{ marginRight: 3 }} />{ts}
                                  {started && <><br /><i className="fas fa-play-circle" style={{ marginRight: 3, color: '#10b981' }} />Début examen : {started}</>}
                                  {submitted && <>&nbsp;·&nbsp;<i className="fas fa-flag-checkered" style={{ marginRight: 3, color: '#3b82f6' }} />Soumis : {submitted}</>}
                                </div>
                              </div>
                              {/* Droite */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {sl && <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: `${sc}22`, color: sc, fontWeight: 600 }}>{sl}</span>}
                                {v.url ? (
                                  <>
                                    <a href={v.url} target="_blank" rel="noreferrer"
                                      style={{ padding: '7px 14px', background: 'rgba(59,130,246,.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,.3)', borderRadius: 7, textDecoration: 'none', fontSize: 12, fontWeight: 600, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                                      <i className="fas fa-play" /> Lire
                                    </a>
                                    <a href={v.url} download={v.filename} target="_blank" rel="noreferrer"
                                      style={{ padding: '7px 14px', background: 'rgba(16,185,129,.15)', color: '#10b981', border: '1px solid rgba(16,185,129,.3)', borderRadius: 7, textDecoration: 'none', fontSize: 12, fontWeight: 600, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                                      <i className="fas fa-download" /> Télécharger
                                    </a>
                                  </>
                                ) : <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}><i className="fas fa-clock" /> Lien expiré — Actualisez</span>}
                              </div>
                            </div>
                          )
                        })}
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 10, textAlign: 'center' }}>
                          <i className="fas fa-info-circle" /> Les liens sont valables 4h. Cliquez sur Actualiser pour les renouveler.
                        </div>
                      </>
                    )}
                  </div>

                ) : (
                  /* ── ONGLET SNAPSHOTS ──────────────────────────────── */
                  !snapRecs || snapStudents.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'rgba(255,255,255,.4)' }}>
                      <i className="fas fa-camera-slash" style={{ fontSize: 40 }} />
                      {snapRecs?.error || 'Aucun snapshot disponible'}
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                      {/* Sidebar étudiants */}
                      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.08)', overflowY: 'auto', padding: '12px 10px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, paddingLeft: 4 }}>
                          {snapStudents.length} étudiant(s)
                        </div>
                        {snapStudents.map((stu: any, i: number) => {
                          const sc = STATUS_COLOR[stu.status] || '#64748b'
                          const sl = STATUS_LABEL[stu.status] || stu.status || ''
                          const active = i === selectedSnapIdx
                          return (
                            <div key={i} onClick={() => setSelectedSnapIdx(i)}
                              style={{ padding: '9px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 3, background: active ? 'rgba(59,130,246,.2)' : 'transparent', border: `1px solid ${active ? 'rgba(59,130,246,.4)' : 'transparent'}` }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <i className="fas fa-user" style={{ fontSize: 13 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stu.student_name}</div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{stu.snapshots_count} snapshot(s)</div>
                              </div>
                              {sl && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 99, background: `${sc}22`, color: sc, fontWeight: 700, flexShrink: 0 }}>{sl}</span>}
                            </div>
                          )
                        })}
                      </div>

                      {/* Contenu snapshots de l'étudiant sélectionné */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                        {curSnap ? (
                          <>
                            {/* En-tête étudiant */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{curSnap.student_name}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{curSnap.student_email}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {STATUS_LABEL[curSnap.status] && (
                                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: `${STATUS_COLOR[curSnap.status] || '#64748b'}22`, color: STATUS_COLOR[curSnap.status] || '#94a3b8' }}>
                                    {STATUS_LABEL[curSnap.status]}
                                  </span>
                                )}
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                                  <i className="fas fa-camera" style={{ marginRight: 4 }} />{curSnap.snapshots_count} snapshot(s)
                                </span>
                                <button onClick={loadSnapRecs} style={{ padding: '5px 10px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
                                  <i className="fas fa-sync-alt" />
                                </button>
                              </div>
                            </div>

                            {/* Grille snapshots */}
                            {(curSnap.snapshots || []).filter((s: any) => s.image_data).length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,.4)' }}>
                                <i className="fas fa-camera-slash" style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
                                Aucun snapshot disponible
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                                {(curSnap.snapshots || []).filter((s: any) => s.image_data).map((snap: any, j: number) => {
                                  const src = snap.image_data.startsWith('data:') ? snap.image_data : `data:image/jpeg;base64,${snap.image_data}`
                                  const ts  = snap.timestamp ? new Date(snap.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
                                  const et  = snap.event_type ? snap.event_type.replace(/_/g, ' ') : ''
                                  return (
                                    <div key={j} style={{ background: 'rgba(0,0,0,.35)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.09)' }}>
                                      <img src={src} alt="snapshot" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                                        onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                                      <div style={{ padding: '5px 8px' }}>
                                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)' }}>{ts}</div>
                                        {et && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 1 }}>{et}</div>}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══════════════ Modal Appel Privé — identique à l'original */}
      {privateCall && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden', width: 520, maxWidth: '95vw', boxShadow: '0 24px 60px rgba(0,0,0,.5)', border: '1px solid #334155' }}>
            {/* Header bleu */}
            <div style={{ background: '#3b82f6', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fas fa-phone" style={{ color: 'white' }} />
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>
                Appel privé — {privateCall.name}
              </span>
              <button onClick={endPrivateCall}
                style={{ marginLeft: 'auto', background: 'rgba(239,68,68,.85)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                <i className="fas fa-phone-slash" /> Terminer
              </button>
            </div>
            {/* Corps : vidéo étudiant | contrôles prof */}
            <div style={{ display: 'flex', height: 260 }}>
              {/* Vidéo étudiant */}
              <div style={{ flex: 1, background: '#0f172a', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video id="private-student-video" autoPlay playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <audio id="private-student-audio" autoPlay style={{ display: 'none' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,.25)', pointerEvents: 'none' }}>
                  <i className="fas fa-user" style={{ fontSize: 40 }} />
                  <span style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>Étudiant</span>
                </div>
              </div>
              {/* Contrôles professeur */}
              <div style={{ width: 170, background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, borderLeft: '1px solid #334155', padding: 12 }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Ma prévisualisation</div>
                <div style={{ width: 140, height: 90, borderRadius: 8, background: '#1e293b', overflow: 'hidden', border: '1px solid #334155', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <video id="private-my-preview" autoPlay playsInline muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {!privateCamOn && <i className="fas fa-video-slash" style={{ position: 'absolute', color: 'rgba(255,255,255,.25)', fontSize: 20 }} />}
                </div>
                <button onClick={togglePrivateCam}
                  style={{ width: 140, background: privateCamOn ? 'rgba(37,99,235,.5)' : 'rgba(37,99,235,.2)', color: privateCamOn ? '#bfdbfe' : '#93c5fd', border: `1px solid ${privateCamOn ? 'rgba(37,99,235,.6)' : 'rgba(37,99,235,.3)'}`, borderRadius: 8, padding: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  <i className={`fas ${privateCamOn ? 'fa-video' : 'fa-video-slash'}`} /> {privateCamOn ? 'Caméra on' : 'Caméra'}
                </button>
                <button onClick={togglePrivateMic}
                  style={{ width: 140, background: privateMicOn ? 'rgba(16,185,129,.5)' : 'rgba(16,185,129,.2)', color: privateMicOn ? '#a7f3d0' : '#6ee7b7', border: `1px solid ${privateMicOn ? 'rgba(16,185,129,.6)' : 'rgba(16,185,129,.3)'}`, borderRadius: 8, padding: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  <i className={`fas ${privateMicOn ? 'fa-microphone' : 'fa-microphone-slash'}`} /> {privateMicOn ? 'Micro on' : 'Micro'}
                </button>
                <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 4 }}>{privateStatus}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs panel */}
      {logsPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#1e293b', borderRadius: 14, width: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                <i className="fas fa-list-alt" style={{ marginRight: 8, color: '#94a3b8' }} />
                Logs — {logsPanel.name}
              </div>
              <button onClick={() => setLogsPanel(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 16 }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 18px' }}>
              {loadingLogs ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,.4)' }}>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
                </div>
              ) : logsPanel.logs.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13, textAlign: 'center', padding: 24 }}>Aucun log disponible</p>
              ) : logsPanel.logs.map((log: any, i: number) => {
                const labelMap: Record<string, string> = {
                  tab_switch:              "Changement d'onglet",
                  copy_attempt:            'Tentative de copie',
                  paste_attempt:           'Tentative de collage',
                  right_click:             'Clic droit bloqué',
                  devtools_attempt:        "Tentative d'ouverture DevTools",
                  fullscreen_exit:         'Plein écran quitté',
                  no_face_detected:        'Aucun visage détecté',
                  no_face:                 'Aucun visage détecté',
                  multiple_faces:          'Plusieurs visages détectés',
                  camera_blocked:          'Caméra bloquée',
                  face_covered:            'Visage couvert',
                  face_mismatch:           'Visage non reconnu',
                  face_reference_captured: 'Référence faciale capturée',
                  window_blur:             'Fenêtre mise en arrière-plan',
                  teacher_warning:         "Avertissement de l'enseignant",
                  teacher_message:         "Message de l'enseignant",
                  student_message:         "Message de l'étudiant",
                  teacher_ban:             "Exclusion par l'enseignant",
                  proctor_note:            'Note de surveillance',
                  'proctor note':          'Note de surveillance',
                  proctor_ban:             'Exclusion par le surveillant',
                  session_end:             'Fin de session',
                  extra_time:              'Temps supplémentaire accordé',
                  private_call:            'Appel privé',
                  teacher_private_call:    'Appel privé enseignant',
                  'teacher private call':  'Appel privé enseignant',
                  end_call:                "Fin d'appel",
                  teacher_end_call:        "Fin d'appel enseignant",
                  'teacher end call':      "Fin d'appel enseignant",
                  unban:                   'Débannissement',
                  warning_issued:          'Avertissement émis',
                }
                const iconMap: Record<string, { icon: string; color: string }> = {
                  tab_switch:             { icon: 'exchange-alt',        color: '#f59e0b' },
                  no_face_detected:       { icon: 'user-slash',          color: '#ef4444' },
                  no_face:                { icon: 'user-slash',          color: '#ef4444' },
                  multiple_faces:         { icon: 'users',               color: '#ef4444' },
                  teacher_warning:        { icon: 'exclamation-triangle', color: '#f59e0b' },
                  teacher_message:        { icon: 'comment',             color: '#3b82f6' },
                  student_message:        { icon: 'comment-dots',        color: '#6366f1' },
                  proctor_note:           { icon: 'sticky-note',         color: '#a5b4fc' },
                  'proctor note':         { icon: 'sticky-note',         color: '#a5b4fc' },
                  teacher_ban:            { icon: 'ban',                 color: '#ef4444' },
                  proctor_ban:            { icon: 'ban',                 color: '#ef4444' },
                  extra_time:             { icon: 'clock',               color: '#f59e0b' },
                  private_call:           { icon: 'phone',               color: '#10b981' },
                  teacher_private_call:   { icon: 'phone',               color: '#10b981' },
                  'teacher private call': { icon: 'phone',               color: '#10b981' },
                  end_call:               { icon: 'phone-slash',         color: '#94a3b8' },
                  teacher_end_call:       { icon: 'phone-slash',         color: '#94a3b8' },
                  'teacher end call':     { icon: 'phone-slash',         color: '#94a3b8' },
                  unban:                  { icon: 'unlock',              color: '#10b981' },
                  warning_issued:         { icon: 'exclamation-circle',  color: '#f59e0b' },
                }
                const et = log.event_type || log.type || 'event'
                const label = labelMap[et] || et.replace(/_/g, ' ')
                const meta  = iconMap[et]  || { icon: 'circle', color: 'rgba(255,255,255,.4)' }
                return (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <i className={`fas fa-${meta.icon}`} style={{ color: meta.color, marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{label}</span>
                        <span style={{ color: 'rgba(255,255,255,.3)' }}>{fmtTime(log.created_at || log.timestamp)}</span>
                      </div>
                      {log.description && <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>{log.description}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Helpers styles ────────────────────────────────────────────────────────── */
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', background: 'rgba(255,255,255,.1)', color: 'white',
  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
}
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', color: 'white', border: 'none', borderRadius: 8,
  cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#1e293b', color: 'white', padding: 28, borderRadius: 16, maxWidth: 460, width: '92%', boxShadow: '0 20px 40px rgba(0,0,0,.5)' }}>
        {children}
      </div>
    </div>
  )
}

function Pill({ label, icon, dot, color }: { label: string; icon?: string; dot?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: color || 'rgba(255,255,255,.12)', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, animation: 'pulse 2s infinite', display: 'inline-block' }} />}
      {icon && <i className={`fas ${icon}`} />}
      {label}
    </div>
  )
}

function Section({ title, count, dot, icon, iconColor, badgeBg, badgeColor, children }: {
  title: string; count: number; dot?: string; icon?: string; iconColor?: string
  badgeBg: string; badgeColor: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0 8px' }}>
        {dot
          ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />
          : <i className={`fas ${icon}`} style={{ color: iconColor, fontSize: 13 }} />}
        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.4)' }}>{title}</h3>
        <span style={{ background: badgeBg, color: badgeColor, borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{count}</span>
      </div>
      <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)' }}>
        {children}
      </div>
    </div>
  )
}

function AgentBanner({ agent, lastCheck, studentsCount }: { agent: AgentStatus | null; lastCheck: string; studentsCount: number }) {
  const alive     = agent?.alive ?? false
  const bgColor   = alive ? 'rgba(16,185,129,.07)'  : 'rgba(239,68,68,.07)'
  const border    = alive ? 'rgba(16,185,129,.2)'    : 'rgba(239,68,68,.2)'
  const dotColor  = alive ? '#10b981' : '#ef4444'
  const badgeBg   = alive ? 'rgba(16,185,129,.2)'   : 'rgba(239,68,68,.2)'
  const badgeClr  = alive ? '#6ee7b7' : '#fca5a5'
  const badgeLbl  = alive ? 'EN SERVICE' : (agent === null ? 'Vérification…' : 'HORS LIGNE')
  return (
    <div style={{ background: bgColor, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
      <div style={{ width: 36, height: 36, background: alive ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.1)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className="fas fa-robot" style={{ color: alive ? '#6ee7b7' : '#fca5a5', fontSize: 16 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block', animation: alive ? 'ripple 2s infinite' : 'none' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Agent IA Autonome</span>
          <span style={{ background: badgeBg, color: badgeClr, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{badgeLbl}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>Dernier cycle : {lastCheck}</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
          {alive
            ? `Seuil alerte ≥ ${agent?.risk_alert ?? 60} · Alertes session : ${agent?.exam?.alerts_sent ?? 0}`
            : 'Service agent inactif — redémarrez cei-agent.service'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, fontSize: 11, color: 'rgba(255,255,255,.4)', flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#6ee7b7' }}>{studentsCount}</div>
          <div>étudiant(s)</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>{agent?.exam?.alerts_sent ?? 0}</div>
          <div>alerte(s)</div>
        </div>
      </div>
    </div>
  )
}

function VideoCard({ s, recActive, screenAvail, onMsg, onBan, onRec, onScreen, onCall, onExtraTime, onNote, onLogs }: {
  s: Student
  recActive:    boolean
  screenAvail:  boolean
  onMsg:        (t: 'message' | 'warning') => void
  onBan:        () => void
  onRec:        () => void
  onScreen:     () => void
  onCall:       () => void
  onExtraTime:  () => void
  onNote:       () => void
  onLogs:       () => void
}) {
  const rc          = riskCls(s.risk_score)
  const isActive    = s.status === 'in_progress'
  const isSubmitted = ['submitted', 'auto_submitted'].includes(s.status)
  const isBanned    = s.status === 'banned'

  let statusBg = 'rgba(16,185,129,.15)', statusColor = '#10b981', statusLabel = 'En cours'
  if (isSubmitted) { statusBg = 'rgba(37,99,235,.15)'; statusColor = '#60a5fa'; statusLabel = s.status === 'auto_submitted' ? 'Auto-soumis' : 'Soumis' }
  if (isBanned)    { statusBg = 'rgba(239,68,68,.15)';  statusColor = '#ef4444'; statusLabel = 'Exclu' }

  return (
    <div className="video-card" style={{ border: `1px solid ${isBanned ? 'rgba(239,68,68,.35)' : s.risk_score >= 60 ? 'rgba(245,158,11,.25)' : 'rgba(255,255,255,.07)'}` }}>

      {/* Zone vidéo */}
      <div style={{ aspectRatio: '16/9', background: '#000', position: 'relative', overflow: 'hidden' }}>
        <div id={`ph-${s.livekit_identity}`}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <i className="fas fa-video-slash" style={{ fontSize: 26, color: 'rgba(255,255,255,.18)' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.18)' }}>Flux vidéo</span>
        </div>
        <video id={`video-${s.livekit_identity}`} autoPlay playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'none' }} />

        {/* Overlay exclu */}
        {isBanned && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'white', fontWeight: 700, zIndex: 2 }}>
            <i className="fas fa-ban" style={{ fontSize: 22 }} />EXCLU
            {s.ban_reason && <span style={{ fontSize: 10, fontWeight: 400, textAlign: 'center', maxWidth: 140 }}>{s.ban_reason}</span>}
          </div>
        )}

        {/* Overlay soumis */}
        {isSubmitted && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, zIndex: 2 }}>
            <i className="fas fa-check-circle" style={{ fontSize: 30, color: '#10b981' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: '.05em', textTransform: 'uppercase' }}>{statusLabel}</span>
            {s.submitted_at && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>{fmtTime(s.submitted_at)}</span>}
          </div>
        )}

        {/* Barre top : nom + risque */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '6px 8px', background: 'linear-gradient(to bottom,rgba(0,0,0,.7) 0%,transparent 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'white', background: 'rgba(0,0,0,.45)', padding: '2px 6px', borderRadius: 4 }}>
            {s.student_name.split(' ')[0]}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, background: RB[rc], color: RC[rc], padding: '2px 6px', borderRadius: 4 }}>
            {s.risk_score || 0}%
          </span>
        </div>

        {/* Badge REC */}
        {recActive && (
          <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(239,68,68,.85)', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, zIndex: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'white', display: 'inline-block', animation: 'pulse 1s infinite' }} /> REC
          </div>
        )}
      </div>

      {/* Info panneau */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 1 }}>{s.student_name}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>{s.student_email}</div>

        {/* Statut */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: statusBg, color: statusColor, marginBottom: 8 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />{statusLabel}
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
          {s.tab_switches > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: s.tab_switches > 2 ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.06)', color: s.tab_switches > 2 ? '#f59e0b' : 'rgba(255,255,255,.5)', borderRadius: 5, fontSize: 10 }}>
              <i className="fas fa-exchange-alt" style={{ fontSize: 9 }} />{s.tab_switches} onglets
            </span>
          )}
          {s.warnings_count > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'rgba(239,68,68,.12)', color: '#ef4444', borderRadius: 5, fontSize: 10 }}>
              <i className="fas fa-exclamation-triangle" style={{ fontSize: 9 }} />{s.warnings_count} alertes
            </span>
          )}
          {s.no_face_count > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'rgba(245,158,11,.12)', color: '#f59e0b', borderRadius: 5, fontSize: 10 }}>
              <i className="fas fa-user-slash" style={{ fontSize: 9 }} />{s.no_face_count} hors champ
            </span>
          )}
        </div>

        {/* Barre de risque */}
        <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${Math.min(s.risk_score, 100)}%`, background: RC[rc], borderRadius: 3, transition: 'width .5s' }} />
        </div>

        {/* Boutons d'action */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {!isBanned ? (
            <>
              <button className="card-act-btn" style={{ background: 'rgba(245,158,11,.15)', color: '#f59e0b', borderColor: 'rgba(245,158,11,.25)' }}
                onClick={() => onMsg('warning')} title="Avertir">
                <i className="fas fa-exclamation-triangle" />
              </button>
              <button className="card-act-btn" style={{ background: 'rgba(37,99,235,.15)', color: '#60a5fa', borderColor: 'rgba(37,99,235,.25)' }}
                onClick={() => onMsg('message')} title="Message">
                <i className="fas fa-comment" />
              </button>
              {isActive && (
                <button className="card-act-btn" style={{ background: 'rgba(239,68,68,.15)', color: '#f87171', borderColor: 'rgba(239,68,68,.25)' }}
                  onClick={onBan} title="Exclure">
                  <i className="fas fa-ban" />
                </button>
              )}
              <button className="card-act-btn" style={{ background: recActive ? 'rgba(239,68,68,.4)' : 'rgba(239,68,68,.12)', color: '#ef4444', borderColor: recActive ? '#ef4444' : 'rgba(239,68,68,.25)' }}
                onClick={onRec} title={recActive ? "Arrêter l'enregistrement" : 'Démarrer enregistrement'}>
                {recActive ? <><i className="fas fa-stop-circle" /> STOP</> : <><i className="fas fa-circle" /> REC</>}
              </button>
              {screenAvail && (
                <button className="card-act-btn" style={{ background: 'rgba(99,102,241,.15)', color: '#818cf8', borderColor: 'rgba(99,102,241,.25)' }}
                  onClick={onScreen} title="Voir l'écran partagé">
                  <i className="fas fa-desktop" />
                </button>
              )}
              <button className="card-act-btn" style={{ background: 'rgba(16,185,129,.12)', color: '#34d399', borderColor: 'rgba(16,185,129,.2)' }}
                onClick={onCall} title="Appel privé">
                <i className="fas fa-phone" />
              </button>
              <button className="card-act-btn" style={{ background: 'rgba(245,158,11,.12)', color: '#d97706', borderColor: 'rgba(245,158,11,.2)' }}
                onClick={onExtraTime} title="Temps supplémentaire">
                <i className="fas fa-clock" />
              </button>
              <button className="card-act-btn" style={{ background: 'rgba(99,102,241,.12)', color: '#a5b4fc', borderColor: 'rgba(99,102,241,.2)' }}
                onClick={onNote} title="Note de surveillance">
                <i className="fas fa-sticky-note" />
              </button>
            </>
          ) : (
            <span style={{ fontSize: 10, color: '#fca5a5' }}>
              <i className="fas fa-ban" style={{ marginRight: 4 }} />{s.ban_reason || 'Exclu'}
            </span>
          )}
          <button className="card-act-btn" style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.55)', borderColor: 'rgba(255,255,255,.1)', marginLeft: 'auto' }}
            onClick={onLogs} title="Voir les logs">
            <i className="fas fa-list" />
          </button>
        </div>
      </div>
    </div>
  )
}
