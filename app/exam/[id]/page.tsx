'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

/* ── Types ────────────────────────────────────────────────────────────────── */
interface ExamData {
  id: number; title: string; instructions?: string; duration_minutes: number
  start_time: string; end_time: string; subject_title?: string
  max_tab_switches?: number; enable_copy_paste?: boolean; enable_right_click?: boolean
  camera_required?: boolean; ban_on_devtools?: boolean; auto_correct?: boolean
  status: string; questions?: Question[]
  subject_content?: { id: number; title: string; content: string } | string | null
}
interface Question {
  id: number; content: string; question_type: string; choices?: string[]; points?: number
}
interface Attempt {
  id: number; status: string; started_at: string; extra_minutes?: number
  answers?: Record<string, string> | string
}
interface ParsedBlock {
  type: 'text' | 'section' | 'qcm' | 'vf' | 'open' | 'subopen'
  content?: string; title?: string; num?: string; text?: string
  extraLines?: string[]; choices?: { letter: string; text: string }[]
}
type Phase = 'loading' | 'instructions' | 'permissions' | 'exam' | 'submitted'
type PermStatus = 'pending' | 'loading' | 'ok' | 'error'
declare global { interface Window { LivekitClient: any } }

/* ── Parser contenu brut (porté de l'ancienne plateforme) ─────────────────── */
function parseExamBlocks(raw: string): ParsedBlock[] {
  const VF_RE = /\bvrai\s*[\/|ou]\s*faux\b|\bV\s*[\/|]\s*F\b/i
  const strip = (s: string) => s.trim().replace(/^[*_]{1,2}\s*/,'').replace(/\s*[*_]{1,2}$/,'').trim()
  const Q_RE  = /^(?:(?:Question|Q)\.?\s+)?(\d{1,2})(?!\s*\.\s*\d)(?:\s*[.:)–—-]|\.\s+|\s{2,})\s*(.+)/i
  const TYPE_MARKER = /\[(QCM|VF|OUVERT|SUBOPEN|OUVERT[ES]*)\]/i
  const isQ  = (l: string) => Q_RE.test(strip(l))
  const getQ = (l: string) => {
    const m = strip(l).match(Q_RE); if (!m) return null
    const marker = strip(l).match(TYPE_MARKER)
    return { num: m[1], text: strip(m[2]).replace(TYPE_MARKER,'').trim(), markerType: marker ? marker[1].toUpperCase() : null }
  }
  const C_RE = /^(?:\(?([A-Fa-f])\)?)\s*[.):\s-]\s+(.+)/
  const isC  = (l: string) => C_RE.test(strip(l)) && strip(l).length > 3
  const getC = (l: string) => { const m = strip(l).match(C_RE); return m ? { letter: m[1].toUpperCase(), text: strip(m[2]) } : null }
  const isSep  = (l: string) => !l.trim() || /^[-=*─═▬]{3,}$/.test(l.trim())
  const isSect = (l: string) => /^(?:Partie|Section|Exercice|Part)\s+(?:[IVX]+|\d+)/i.test(strip(l)) && !isQ(l)
  const INSTR_RE = /^(?:Défini[rz]|Expliqu[eé][rz]?|Décri[vz]|Analys[eé][rz]?|Calcul[eé][rz]?|Rédig[eé][rz]?|Démontr[eé][rz]?|Comment[eé][rz]?|Identifi[eé][rz]?|Justifi[eé][rz]?|Compar[eé][rz]?|Présent[eé][rz]?|Discut[eé][rz]?|Montr[eé][rz]?|Propos[eé][rz]?|Cit[eé][rz]?|Donner?)/i

  const lines = raw.split('\n')
  const blocks: ParsedBlock[] = []
  let i = 0
  const preamble: string[] = []
  while (i < lines.length && !isQ(lines[i])) { preamble.push(lines[i]); i++ }
  if (preamble.join('').trim()) blocks.push({ type: 'text', content: preamble.join('\n') })

  while (i < lines.length) {
    if (isSect(lines[i])) { blocks.push({ type: 'section', title: strip(lines[i]) }); i++; continue }
    if (isSep(lines[i]) && !isQ(lines[i])) { i++; continue }
    if (!isQ(lines[i])) { i++; continue }
    const q = getQ(lines[i]); if (!q) { i++; continue }
    i++
    const extraLines: string[] = []; const choices: { letter: string; text: string }[] = []
    while (i < lines.length) {
      if (isSep(lines[i])) { i++; if (choices.length >= 2) break; continue }
      if (isSect(lines[i]) && !isQ(lines[i])) break
      if (isQ(lines[i]) && !isC(lines[i])) break
      const c = getC(lines[i])
      if (c) { choices.push(c); i++ }
      else if (choices.length === 0) { extraLines.push(lines[i]); i++ }
      else break
    }
    let type: ParsedBlock['type']
    if (q.markerType) {
      if (q.markerType === 'QCM') type = 'qcm'
      else if (q.markerType === 'VF') type = 'vf'
      else if (q.markerType === 'SUBOPEN') type = 'subopen'
      else type = 'open'
    } else {
      const hasPtsChoices = choices.some(c => /\(\s*\d+\s*pts?\s*\)/i.test(c.text))
      const hasInstrVerbs = choices.some(c => INSTR_RE.test(c.text))
      if ((hasPtsChoices || hasInstrVerbs) && choices.length >= 1) type = 'subopen'
      else if (choices.length >= 2) type = 'qcm'
      else if (VF_RE.test(q.text) || VF_RE.test(extraLines.join(' '))) type = 'vf'
      else type = 'open'
    }
    blocks.push({ type, num: q.num, text: q.text, extraLines, choices })
  }
  return blocks
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function ExamPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useAuth()
  const { success, error: toastErr, warning } = useToast()

  const [exam,         setExam]         = useState<ExamData | null>(null)
  const [attempt,      setAttempt]      = useState<Attempt | null>(null)
  const [answers,      setAnswers]      = useState<Record<string, string>>({})
  const [parsedBlocks, setParsedBlocks] = useState<ParsedBlock[]>([])
  const [qcmIdx,       setQcmIdx]       = useState(0)
  const [showPart2,    setShowPart2]    = useState(false)
  const [phase,        setPhase]        = useState<Phase>('loading')
  const [timeLeft,     setTimeLeft]     = useState(0)
  const [tabCount,     setTabCount]     = useState(0)
  const [riskScore,    setRiskScore]    = useState(0)
  const [alerts,       setAlerts]       = useState<{type:string;msg:string;at:string}[]>([])
  const [lastSaved,    setLastSaved]    = useState<Date|null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [subjectOpen,  setSubjectOpen]  = useState(false)
  const [msgText,      setMsgText]      = useState('')
  const [msgSent,      setMsgSent]      = useState<{text:string;time:string}[]>([])
  const [camOn,        setCamOn]        = useState(false)
  const [micOn,        setMicOn]        = useState(false)
  const [screenOn,     setScreenOn]     = useState(false)
  const [faceStatus,   setFaceStatus]   = useState<'init'|'ok'|'warn'|'bad'>('init')
  const [warnText,     setWarnText]     = useState('')
  const [showWarnModal,setShowWarnModal]= useState(false)
  const [msgModalText, setMsgModalText] = useState('')
  const [showMsgModal, setShowMsgModal] = useState(false)
  const [showBanModal,         setShowBanModal]         = useState(false)
  const [showPrivateCallModal, setShowPrivateCallModal] = useState(false)
  const [privateCallActive,    setPrivateCallActive]    = useState(false)
  const [privateMicOn,         setPrivateMicOn]         = useState(false)
  const [proctorActive,setProctorActive]= useState(false)
  const [teacherActive,setTeacherActive]= useState(false)
  // showConsent supprimé — attestation affichée directement en phase 'instructions'
  const [starting,     setStarting]     = useState(false)
  const [permCam,      setPermCam]      = useState<PermStatus>('pending')
  const [permMic,      setPermMic]      = useState<PermStatus>('pending')
  const [permScreen,   setPermScreen]   = useState<PermStatus>('pending')
  const [permError,    setPermError]    = useState('')
  const [permBusy,     setPermBusy]     = useState(false)

  const timerRef        = useRef<ReturnType<typeof setInterval>|null>(null)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const saveRef         = useRef<ReturnType<typeof setInterval>|null>(null)
  const msgPollRef      = useRef<ReturnType<typeof setInterval>|null>(null)
  const snapshotRef     = useRef<ReturnType<typeof setInterval>|null>(null)
  const extraPollRef    = useRef<ReturnType<typeof setInterval>|null>(null)
  const attemptRef      = useRef<number|null>(null)
  const examRef         = useRef<ExamData|null>(null)
  const videoRef        = useRef<HTMLVideoElement|null>(null)
  const camStream       = useRef<MediaStream|null>(null)
  const screenStream    = useRef<MediaStream|null>(null)
  const lkRoomRef           = useRef<any>(null)
  const proctorVideoRef     = useRef<HTMLVideoElement|null>(null)
  const proctorAudioRef     = useRef<HTMLAudioElement|null>(null)
  const teacherVideoRef     = useRef<HTMLVideoElement|null>(null)
  const teacherAudioRef     = useRef<HTMLAudioElement|null>(null)
  const privateRoomRef      = useRef<any>(null)
  const privateMicTrackRef  = useRef<any>(null)
  const privateCamTrackRef  = useRef<any>(null)
  const privateTeacherVidRef= useRef<HTMLVideoElement|null>(null)
  const privateTeacherAudRef= useRef<HTMLAudioElement|null>(null)
  const lastMsgTsRef    = useRef<string|null>(null)
  const sessionEndedRef = useRef(false)
  const extraMinRef     = useRef(0)
  const lastSnapRef     = useRef(0)
  const canvasRef       = useRef<HTMLCanvasElement|null>(null)
  const sigMeta         = useRef({strokes:0,pathLength:0,startTime:0,endTime:0})
  const drawing         = useRef(false)
  const lastPos         = useRef([0,0])
  const faceIntervalRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const lastFaceAlertRef= useRef<{no_face:number;multiple:number;mismatch:number}>({no_face:0,multiple:0,mismatch:0})
  const consNoFaceRef   = useRef(0)
  const consMultiRef    = useRef(0)
  const consMismatchRef = useRef(0)
  const refDescRef      = useRef<Float32Array|null>(null)

  /* ── Chargement ───────────────────────────────────────────────────────── */
  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.get<ExamData>(`/api/online_exams/${id}/details`)
        setExam(res); examRef.current = res; setPhase('instructions')
      } catch (e:any) { toastErr(e.message||'Erreur chargement'); router.push('/dashboard/student') }
    })()
  }, [id]) // eslint-disable-line

  /* ── Parser le contenu si pas de questions structurées ───────────────── */
  useEffect(() => {
    if (!exam) return
    if (exam.questions && exam.questions.length > 0) return
    const raw = exam.subject_content
      ? (typeof exam.subject_content === 'object' ? exam.subject_content.content : exam.subject_content as string)
      : null
    if (!raw) return
    setParsedBlocks(parseExamBlocks(raw))
  }, [exam])

  /* ── Attacher la caméra quand la vidéo est montée ────────────────────── */
  useEffect(() => {
    if (phase !== 'exam') return
    const attach = () => {
      if (videoRef.current && camStream.current && videoRef.current.srcObject !== camStream.current)
        videoRef.current.srcObject = camStream.current
    }
    attach(); const t = setTimeout(attach, 300); return () => clearTimeout(t)
  }, [phase])

  /* ── Nettoyage ────────────────────────────────────────────────────────── */
  useEffect(() => () => {
    ;[timerRef,saveRef,msgPollRef,snapshotRef,extraPollRef,faceIntervalRef].forEach(r => { if (r.current) clearInterval(r.current) })
    camStream.current?.getTracks().forEach(t => t.stop())
    screenStream.current?.getTracks().forEach(t => t.stop())
    if (lkRoomRef.current) { try { lkRoomRef.current.disconnect() } catch {} }
  }, [])

  /* ── Anti-fraude ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'exam') return
    const onVis = async () => {
      if (!document.hidden) return
      const next = tabCount + 1; setTabCount(next)
      setRiskScore(r => Math.min(r + 10, 100))
      setAlerts(a => [{type:'tab',msg:`Changement d'onglet (${next})`,at:new Date().toLocaleTimeString('fr-FR')},...a])
      warning(`Attention : changement d'onglet détecté (${next}/${examRef.current?.max_tab_switches??3})`)
      const aId = attemptRef.current
      if (aId) {
        try { await api.post(`/api/exam_attempts/${aId}/log_activity`,{event:'tab_switch',count:next}) } catch {}
        try { await logProctoring(aId,'tab_switch',`Changement onglet ${next}`) } catch {}
      }
      if (examRef.current?.max_tab_switches && next >= examRef.current.max_tab_switches) handleSubmit(true)
    }
    const noCtx  = (e:MouseEvent)     => { if (!examRef.current?.enable_right_click) e.preventDefault() }
    const noCopy = (e:ClipboardEvent) => { if (!examRef.current?.enable_copy_paste) { e.preventDefault(); warning('Copier/coller désactivé') } }
    const noKey  = (e:KeyboardEvent)  => {
      if (e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['I','J','C'].includes(e.key))||(e.ctrlKey&&e.key==='u')) {
        e.preventDefault()
        const aId = attemptRef.current; if (aId) logProctoring(aId,'devtools_attempt','Tentative outils dev').catch(()=>{})
        setAlerts(a => [{type:'devtools',msg:'Accès outils développeur bloqué',at:new Date().toLocaleTimeString('fr-FR')},...a])
      }
    }
    const onFs = () => {
      if (!document.fullscreenElement && !sessionEndedRef.current) {
        const aId = attemptRef.current
        if (aId) { try { api.post(`/api/exam_attempts/${aId}/log_activity`,{event:'fullscreen_exit'}) } catch {} }
        setAlerts(a => [{type:'fs',msg:'Plein écran quitté',at:new Date().toLocaleTimeString('fr-FR')},...a])
      }
    }
    document.addEventListener('visibilitychange',onVis); document.addEventListener('contextmenu',noCtx)
    document.addEventListener('copy',noCopy); document.addEventListener('paste',noCopy)
    document.addEventListener('keydown',noKey); document.addEventListener('fullscreenchange',onFs)
    return () => {
      document.removeEventListener('visibilitychange',onVis); document.removeEventListener('contextmenu',noCtx)
      document.removeEventListener('copy',noCopy); document.removeEventListener('paste',noCopy)
      document.removeEventListener('keydown',noKey); document.removeEventListener('fullscreenchange',onFs)
    }
  }, [phase,tabCount]) // eslint-disable-line

  /* ── Signature ────────────────────────────────────────────────────────── */
  useEffect(() => { if (phase === 'instructions') requestAnimationFrame(() => initSig()) }, [phase])
  function initSig() {
    const c = canvasRef.current; if (!c) return
    const r = c.getBoundingClientRect(); c.width = Math.round(r.width)||480; c.height = 130
    const ctx = c.getContext('2d')!; drawWm(ctx,c.width,c.height)
    sigMeta.current = {strokes:0,pathLength:0,startTime:0,endTime:0}
  }
  function drawWm(ctx:CanvasRenderingContext2D,w:number,h:number) {
    ctx.save(); ctx.globalAlpha=0.06; ctx.font=`bold ${Math.max(14,Math.floor(h/4))}px Arial`
    ctx.fillStyle='#1e293b'; ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.translate(w/2,h/2); ctx.rotate(-18*Math.PI/180); ctx.fillText('CEI — ATTESTATION',0,0); ctx.restore()
    ctx.save(); ctx.globalAlpha=0.18; ctx.font='9px monospace'; ctx.fillStyle='#475569'
    ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(user?.full_name?.toUpperCase()??'',8,5)
    ctx.textAlign='right'; ctx.textBaseline='bottom'; ctx.fillText(new Date().toLocaleDateString('fr-FR'),w-8,h-5); ctx.restore()
    ctx.save(); ctx.globalAlpha=0.15; ctx.strokeStyle='#94a3b8'; ctx.lineWidth=1; ctx.setLineDash([4,6])
    ctx.beginPath(); ctx.moveTo(10,h*0.72); ctx.lineTo(w-10,h*0.72); ctx.stroke(); ctx.restore()
  }
  function clearSig() {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')!; ctx.clearRect(0,0,c.width,c.height); drawWm(ctx,c.width,c.height)
    sigMeta.current = {strokes:0,pathLength:0,startTime:0,endTime:0}
    c.style.border='2px solid #e2e8f0'; c.style.background='#fafafa'
  }
  function getSigPos(e:React.MouseEvent|React.TouchEvent) {
    const c=canvasRef.current!; const r=c.getBoundingClientRect()
    const s='touches' in e?e.touches[0]:e as any
    return [(s.clientX-r.left)*(c.width/r.width),(s.clientY-r.top)*(c.height/r.height)]
  }
  function onSigStart(e:React.MouseEvent|React.TouchEvent) {
    e.preventDefault(); drawing.current=true; const [x,y]=getSigPos(e); lastPos.current=[x,y]
    const m=sigMeta.current; if(!m.startTime) m.startTime=Date.now(); m.strokes++
  }
  function onSigMove(e:React.MouseEvent|React.TouchEvent) {
    e.preventDefault(); if(!drawing.current) return
    const [x,y]=getSigPos(e); const [lx,ly]=lastPos.current
    const ctx=canvasRef.current!.getContext('2d')!
    ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(x,y)
    ctx.strokeStyle='#1e293b'; ctx.lineWidth=2.2; ctx.lineCap='round'; ctx.stroke()
    const m=sigMeta.current; m.pathLength+=Math.sqrt((x-lx)**2+(y-ly)**2); m.endTime=Date.now(); lastPos.current=[x,y]
  }
  function onSigEnd() { drawing.current=false }

  /* ── Démarrer ─────────────────────────────────────────────────────────── */
  async function doStartExam() {
    const c = canvasRef.current; if (!c) return
    const m = sigMeta.current
    if (m.strokes===0) { c.style.border='2px solid #ef4444'; c.style.background='#fef2f2'; toastErr('Vous devez signer avant de démarrer.'); return }
    if (m.strokes<2||m.pathLength<100) { toastErr('Signature insuffisante — tracez plusieurs traits.'); return }
    if ((m.endTime-m.startTime)<800) { toastErr('Signature trop rapide — signez normalement.'); return }
    setStarting(true)
    try {
      const res = await api.post<{attempt:Attempt}>(`/api/online_exams/${id}/start`,{
        pre_exam_signature: c.toDataURL('image/png'),
        pre_exam_signature_meta: {strokes:m.strokes,path_length:Math.round(m.pathLength),duration_ms:m.endTime-m.startTime,signed_at:new Date().toISOString()}
      })
      const att=res.attempt; setAttempt(att); attemptRef.current=att.id
      extraMinRef.current=att.extra_minutes??0
      if (att.answers) { try { const p=typeof att.answers==='string'?JSON.parse(att.answers):att.answers; setAnswers(p||{}) } catch {} }
      setPhase('permissions')
    } catch (e:any) { toastErr(e.message||"Impossible de démarrer l'examen") }
    finally { setStarting(false) }
  }

  /* ── Permissions ──────────────────────────────────────────────────────── */
  async function requestAllPermissions() {
    setPermError(''); setPermBusy(true)
    setPermCam('loading'); setPermMic('loading')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:true,audio:true})
      camStream.current=stream; setCamOn(true); setMicOn(true); setPermCam('ok'); setPermMic('ok')
    } catch {
      setPermCam('error'); setPermMic('error')
      setPermError('La caméra et le microphone sont obligatoires. Autorisez-les puis réessayez.')
      setPermBusy(false); return
    }
    setPermScreen('loading')
    try {
      const ss = await (navigator.mediaDevices as any).getDisplayMedia({video:{cursor:'always',displaySurface:'monitor'},preferCurrentTab:false,audio:false})
      const track=ss.getVideoTracks()[0]; const surface=track?.getSettings?.()?.displaySurface
      if (surface!==undefined&&surface!=='monitor') {
        track.stop(); setPermScreen('error')
        setPermError("Choisissez « Écran entier » et non une fenêtre ou un onglet.")
        setPermBusy(false); return
      }
      screenStream.current=ss; setPermScreen('ok'); setScreenOn(true)
      track.addEventListener('ended',()=>{
        setScreenOn(false)
        setAlerts(a=>[{type:'screen',msg:"Partage d'écran interrompu",at:new Date().toLocaleTimeString('fr-FR')},...a])
        const aId=attemptRef.current; if(aId){try{api.post(`/api/exam_attempts/${aId}/log_activity`,{event:'screen_share_stopped'})}catch{}}
      })
    } catch {
      setPermScreen('error')
      setPermError("Le partage de l'écran complet est obligatoire.")
      setPermBusy(false); return
    }
    setPermBusy(false); enterExam()
  }

  /* ── Entrer dans l'examen ─────────────────────────────────────────────── */
  function enterExam() {
    if (!exam||!attempt) return
    document.documentElement.requestFullscreen?.().catch(()=>{})
    const totalSec   = exam.duration_minutes*60+extraMinRef.current*60
    const elapsedSec = Math.floor((Date.now()-new Date(attempt.started_at).getTime())/1000)
    setTimeLeft(Math.max(totalSec-elapsedSec,0))
    timerRef.current = setInterval(()=>{
      setTimeLeft(()=>{
        const totalNow=(examRef.current?.duration_minutes??0)*60+extraMinRef.current*60
        const startMs=attempt?new Date(attempt.started_at).getTime():Date.now()
        const nl=Math.max(0,Math.floor((startMs+totalNow*1000-Date.now())/1000))
        if(nl<=0){clearInterval(timerRef.current!);handleSubmit(true)}
        return nl
      })
    },1000)
    saveRef.current     = setInterval(()=>{const aId=attemptRef.current;if(aId)doAutoSave(aId)},30000)
    msgPollRef.current  = setInterval(()=>pollTeacherMessages(attempt.id),8000)
    snapshotRef.current = setInterval(()=>captureSnapshot('periodic',attempt.id),120_000)
    extraPollRef.current= setInterval(()=>pollExtraTime(attempt.id),30000)
    initLiveKit(attempt.id)
    setPhase('exam')
    setTimeout(()=>initFaceDetection(attempt.id),500)
  }

  /* ── LiveKit ──────────────────────────────────────────────────────────── */
  function initLiveKit(aId:number) {
    if(typeof window==='undefined') return
    if(window.LivekitClient){connectLiveKit(aId);return}
    const s=document.createElement('script')
    s.src='https://cdn.jsdelivr.net/npm/livekit-client@2.5.7/dist/livekit-client.umd.min.js'
    s.crossOrigin='anonymous'; s.onload=()=>connectLiveKit(aId); document.head.appendChild(s)
  }

  async function connectLiveKit(aId:number) {
    try {
      const tok=await api.get<{ws_url:string;token:string}>(`/api/exam_attempts/${aId}/livekit_token`)
      if(!tok.ws_url||!tok.token) return
      const LK=window.LivekitClient
      const room=new LK.Room({adaptiveStream:true,dynacast:true}); lkRoomRef.current=room
      let reconnects=0
      room.on(LK.RoomEvent.Disconnected,()=>{
        if(sessionEndedRef.current||reconnects>=5) return
        const delay=Math.min(2000*Math.pow(1.5,reconnects),30000); reconnects++
        setTimeout(async()=>{try{const t=await api.get<any>(`/api/exam_attempts/${aId}/livekit_token`);await room.connect(t.ws_url,t.token);reconnects=0}catch{}},delay)
      })
      room.on(LK.RoomEvent.DataReceived,(payload:Uint8Array)=>{
        try{handleTeacherMessage(JSON.parse(new TextDecoder().decode(payload)))}catch{}
      })
      room.on(LK.RoomEvent.TrackSubscribed,(track:any,_pub:any,p:any)=>{
        const pid=p.identity
        if(pid.startsWith('proctor-')||pid.startsWith('surveillant-')){
          if(track.kind==='video'&&proctorVideoRef.current){track.attach(proctorVideoRef.current);setProctorActive(true)}
          else if(track.kind==='audio'&&proctorAudioRef.current){track.attach(proctorAudioRef.current);setProctorActive(true)}
        } else if(pid.startsWith('teacher-')){
          if(track.kind==='video'&&teacherVideoRef.current){track.attach(teacherVideoRef.current);setTeacherActive(true)}
          else if(track.kind==='audio'&&teacherAudioRef.current){track.attach(teacherAudioRef.current)}
        }
      })
      room.on(LK.RoomEvent.TrackUnsubscribed,(t:any,_p:any,p:any)=>{
        const pid=p.identity
        if(pid.startsWith('teacher-')){
          if(t.kind==='video'){
            try{if(teacherVideoRef.current)t.detach(teacherVideoRef.current)}catch{}
            setTeacherActive(false)
          } else if(t.kind==='audio'){
            try{if(teacherAudioRef.current)t.detach(teacherAudioRef.current)}catch{}
          }
        }
        if(pid.startsWith('proctor-')||pid.startsWith('surveillant-')){
          if(t.kind==='video'){
            try{if(proctorVideoRef.current)t.detach(proctorVideoRef.current)}catch{}
            // Masquer overlay si plus aucun srcObject
            setTimeout(()=>{if(!proctorVideoRef.current?.srcObject)setProctorActive(false)},300)
          } else if(t.kind==='audio'){
            try{if(proctorAudioRef.current)t.detach(proctorAudioRef.current)}catch{}
          }
        }
      })
      await room.connect(tok.ws_url,tok.token)
      /* Ré-attacher les tracks déjà publiés par le prof/surveillant (cas où ils étaient déjà connectés) */
      room.remoteParticipants.forEach((participant:any)=>{
        const pid=participant.identity
        participant.trackPublications.forEach((pub:any)=>{
          if(!pub.track) return
          if(pid.startsWith('proctor-')||pid.startsWith('surveillant-')){
            if(pub.kind==='video'&&proctorVideoRef.current){pub.track.attach(proctorVideoRef.current);setProctorActive(true)}
            else if(pub.kind==='audio'&&proctorAudioRef.current){pub.track.attach(proctorAudioRef.current);setProctorActive(true)}
          } else if(pid.startsWith('teacher-')){
            if(pub.kind==='video'&&teacherVideoRef.current){pub.track.attach(teacherVideoRef.current);setTeacherActive(true)}
            else if(pub.kind==='audio'&&teacherAudioRef.current){pub.track.attach(teacherAudioRef.current)}
          }
        })
      })
      /* Re-attacher la caméra locale après connect seulement si nécessaire */
      if(videoRef.current&&camStream.current&&videoRef.current.srcObject!==camStream.current)
        videoRef.current.srcObject=camStream.current
      /* Publier caméra avec track cloné pour ne pas bloquer l'aperçu */
      const camTracks=camStream.current?.getVideoTracks()
      if(camTracks?.length){try{const vt=new LK.LocalVideoTrack(camTracks[0].clone(),undefined,false);await room.localParticipant.publishTrack(vt,{simulcast:true,videoEncoding:{maxBitrate:300_000,maxFramerate:15}})}catch{}}
      const micTracks=camStream.current?.getAudioTracks()
      if(micTracks?.length){try{const at=new LK.LocalAudioTrack(micTracks[0].clone(),undefined,false);await room.localParticipant.publishTrack(at)}catch{}}
      const screenTracks=screenStream.current?.getVideoTracks()
      if(screenTracks?.length&&screenTracks[0].readyState!=='ended'){try{const st=new LK.LocalVideoTrack(screenTracks[0],undefined,false);await room.localParticipant.publishTrack(st,{source:LK.Track.Source.ScreenShare,name:'screen',screenShareEncoding:{maxBitrate:500_000,maxFramerate:5}})}catch{}}
    } catch {}
  }

  /* ── Helpers API ──────────────────────────────────────────────────────── */
  async function logProctoring(aId:number,eventType:string,eventData:string) {
    if(sessionEndedRef.current) return
    try {
      const res=await api.post<{risk_score?:number;banned?:boolean}>(`/api/exam_attempts/${aId}/proctoring_event`,{event_type:eventType,event_data:eventData})
      if(res.risk_score!=null) setRiskScore(res.risk_score)
      if(res.banned) triggerBan()
    } catch {}
  }

  function triggerBan() {
    sessionEndedRef.current=true; setShowBanModal(true)
    ;[timerRef,saveRef,msgPollRef,snapshotRef,extraPollRef,faceIntervalRef].forEach(r=>{if(r.current)clearInterval(r.current)})
    if(lkRoomRef.current){try{lkRoomRef.current.disconnect()}catch{}}
  }

  async function pollTeacherMessages(aId:number) {
    if(sessionEndedRef.current) return
    try {
      const since=lastMsgTsRef.current?`?since=${encodeURIComponent(lastMsgTsRef.current)}`:''
      const res=await api.get<{banned?:boolean;risk_score?:number;messages?:{type:string;message?:string;timestamp:string}[]}>(`/api/exam_attempts/${aId}/pending_messages${since}`)
      if(res.banned){triggerBan();return}
      if(res.risk_score!=null) setRiskScore(res.risk_score)
      for(const msg of res.messages??[]){lastMsgTsRef.current=msg.timestamp;handleTeacherMessage(msg)}
    } catch {}
  }

  function handleTeacherMessage(msg:{type:string;message?:string}) {
    if(msg.type==='warning'){
      setWarnText(msg.message||"Avertissement de l'enseignant"); setShowWarnModal(true)
      setAlerts(a=>[{type:'teacher_warn',msg:msg.message||'Avertissement',at:new Date().toLocaleTimeString('fr-FR')},...a])
    } else if(msg.type==='message'){
      setMsgModalText(msg.message||''); setShowMsgModal(true)
      setAlerts(a=>[{type:'teacher_msg',msg:msg.message||'Message',at:new Date().toLocaleTimeString('fr-FR')},...a])
    } else if(msg.type==='ban') {
      triggerBan()
    } else if(msg.type==='private_call') {
      setShowPrivateCallModal(true)
    } else if(msg.type==='end_call') {
      if(privateRoomRef.current) leavePrivateCall()
      setShowPrivateCallModal(false)
    }
  }

  async function acceptPrivateCall() {
    setShowPrivateCallModal(false)
    const aId = attemptRef.current; if(!aId) return
    try {
      const tok = await api.get<{ws_url:string;token:string}>(`/api/exam_attempts/${aId}/private_token`)
      const LK = (window as any).LivekitClient
      if(!LK) { toastErr('LiveKit non disponible'); return }
      const pr = new LK.Room({ adaptiveStream:true, dynacast:true })
      privateRoomRef.current = pr

      /* Afficher le panel immédiatement pour que les refs soient dans le DOM */
      setPrivateCallActive(true)

      function attachTrack(track:any) {
        if(track.kind === 'video') {
          /* Tenter d'abord direct, sinon avec timeout pour laisser React rendre */
          if(privateTeacherVidRef.current) { try { track.attach(privateTeacherVidRef.current) } catch {} }
          else setTimeout(() => { if(privateTeacherVidRef.current) try { track.attach(privateTeacherVidRef.current) } catch {} }, 200)
        } else if(track.kind === 'audio') {
          if(privateTeacherAudRef.current) { try { track.attach(privateTeacherAudRef.current) } catch {} }
          else setTimeout(() => { if(privateTeacherAudRef.current) try { track.attach(privateTeacherAudRef.current) } catch {} }, 200)
        }
      }

      pr.on(LK.RoomEvent.TrackSubscribed, (track:any) => { attachTrack(track) })
      pr.on(LK.RoomEvent.Disconnected, () => { leavePrivateCall() })

      await pr.connect(tok.ws_url, tok.token)

      /* Attacher les tracks déjà présents (si le professeur avait publié avant la connexion) */
      pr.remoteParticipants.forEach((p:any) => {
        p.trackPublications.forEach((pub:any) => {
          if(pub.track) attachTrack(pub.track)
        })
      })

      try {
        const micTrack = await LK.createLocalAudioTrack()
        await pr.localParticipant.publishTrack(micTrack)
        privateMicTrackRef.current = micTrack
        setPrivateMicOn(true)
      } catch {}
      /* Publier la caméra (clonée depuis le flux de surveillance déjà actif, comme pour la room générale) */
      try {
        const camTracks = camStream.current?.getVideoTracks()
        if(camTracks?.length) {
          const vt = new LK.LocalVideoTrack(camTracks[0].clone(), undefined, false)
          await pr.localParticipant.publishTrack(vt, { simulcast:true, videoEncoding:{ maxBitrate:300_000, maxFramerate:15 } })
          privateCamTrackRef.current = vt
        }
      } catch {}
      setAlerts(a=>[{type:'private_call',msg:"Appel privé avec le surveillant en cours",at:new Date().toLocaleTimeString('fr-FR')},...a])
    } catch(e:any) {
      setPrivateCallActive(false)
      toastErr(e.message || "Impossible de rejoindre l'appel privé")
    }
  }

  async function leavePrivateCall() {
    if(privateMicTrackRef.current) {
      try { await privateRoomRef.current?.localParticipant.unpublishTrack(privateMicTrackRef.current) } catch {}
      privateMicTrackRef.current.stop(); privateMicTrackRef.current = null
    }
    if(privateCamTrackRef.current) {
      try { await privateRoomRef.current?.localParticipant.unpublishTrack(privateCamTrackRef.current) } catch {}
      privateCamTrackRef.current.stop(); privateCamTrackRef.current = null
    }
    if(privateRoomRef.current) {
      try { await privateRoomRef.current.disconnect() } catch {}
      privateRoomRef.current = null
    }
    const aId = attemptRef.current
    if(aId) api.post(`/api/exam_attempts/${aId}/student_message`,{message:'[FIN_APPEL] Appel privé terminé.'}).catch(()=>{})
    setPrivateCallActive(false); setPrivateMicOn(false)
    if(privateTeacherVidRef.current) { try { (privateTeacherVidRef.current as any).srcObject = null } catch {} }
  }

  async function togglePrivateMic() {
    const LK = (window as any).LivekitClient
    if(!privateRoomRef.current || !LK) return
    if(privateMicOn) {
      if(privateMicTrackRef.current) {
        try { await privateRoomRef.current.localParticipant.unpublishTrack(privateMicTrackRef.current) } catch {}
        privateMicTrackRef.current.stop(); privateMicTrackRef.current = null
      }
      setPrivateMicOn(false)
    } else {
      try {
        const t = await LK.createLocalAudioTrack()
        await privateRoomRef.current.localParticipant.publishTrack(t)
        privateMicTrackRef.current = t; setPrivateMicOn(true)
      } catch(e:any) { toastErr(e.message || 'Micro indisponible') }
    }
  }

  async function captureSnapshot(eventType:string,aId:number,faceDetected=true,facesCount=1,confidenceScore:number|null=null,minCooldown=30_000) {
    if(sessionEndedRef.current) return
    const now=Date.now(); if(now-lastSnapRef.current<minCooldown) return
    const vid=videoRef.current; if(!vid||vid.readyState<2||vid.videoWidth===0) return
    try {
      lastSnapRef.current=now
      const c=document.createElement('canvas'); c.width=320; c.height=240
      c.getContext('2d')!.drawImage(vid,0,0,320,240)
      await api.post(`/api/exam_attempts/${aId}/camera_snapshot`,{event_type:eventType,image_data:c.toDataURL('image/jpeg',0.55),face_detected:faceDetected,faces_count:facesCount,confidence_score:confidenceScore})
    } catch {}
  }

  function initFaceDetection(aId:number) {
    const FACEAPI_MODEL_URL='/models/faceapi'
    const ALERT_COOLDOWN=30_000
    const CONSEC_ALERT=3
    const RECAPTURE_AFTER=5
    const RECOG_THRESHOLD=0.55
    let refCapturing=false
    let consGood=0

    async function captureReference() {
      const fa=(window as any).faceapi; if(!fa||refCapturing) return
      const vid=videoRef.current; if(!vid||vid.readyState<2) return
      refCapturing=true; refDescRef.current=null; const captured:Float32Array[]=[]
      setFaceStatus('warn')
      const opts=new fa.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:0.55})
      for(let i=0;i<3;i++){
        if(i>0) await new Promise(r=>setTimeout(r,1500))
        try{
          const det=await fa.detectSingleFace(vid,opts).withFaceLandmarks().withFaceDescriptor()
          if(det){captured.push(det.descriptor)}
          else{refCapturing=false;setTimeout(captureReference,4000);return}
        }catch{refCapturing=false;setTimeout(captureReference,4000);return}
      }
      if(captured.length===3){
        const size=captured[0].length; const avg=new Float32Array(size)
        for(const d of captured) for(let j=0;j<size;j++) avg[j]+=d[j]/3
        refDescRef.current=avg
        consNoFaceRef.current=0; consMismatchRef.current=0; consGood=0
        const c=document.createElement('canvas'); c.width=320; c.height=240
        const v=videoRef.current; if(v){c.getContext('2d')!.drawImage(v,0,0,320,240)}
        const imgB64=c.toDataURL('image/jpeg',0.7).split(',')[1]
        const curAId=attemptRef.current||aId
        try{await api.post(`/api/exam_attempts/${curAId}/camera_snapshot`,{event_type:'face_reference_captured',image_data:'data:image/jpeg;base64,'+imgB64,face_detected:true,faces_count:1,confidence_score:null})}catch{}
        try{await logProctoring(curAId,'face_reference_captured','Référence faciale capturée (3 frames)')}catch{}
        setFaceStatus('ok')
      }
      refCapturing=false
    }

    async function faceDetectionTick() {
      const fa=(window as any).faceapi; if(!fa||refCapturing) return
      const vid=videoRef.current; if(!vid||vid.readyState<2||vid.videoWidth===0) return
      if(sessionEndedRef.current){if(faceIntervalRef.current)clearInterval(faceIntervalRef.current);return}
      const curAId=attemptRef.current||aId; const now=Date.now()
      const opts=new fa.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:0.45})
      try{
        const dets=refDescRef.current
          ?await fa.detectAllFaces(vid,opts).withFaceLandmarks().withFaceDescriptors()
          :await fa.detectAllFaces(vid,opts)
        const count=dets.length
        if(count===0){
          consNoFaceRef.current++; consMismatchRef.current=0; consMultiRef.current=0; consGood=0
          if(consNoFaceRef.current>=CONSEC_ALERT){
            setFaceStatus('bad')
            if(now-lastFaceAlertRef.current.no_face>ALERT_COOLDOWN){
              lastFaceAlertRef.current.no_face=now
              warning('Aucun visage détecté — repositionnez-vous face à la caméra')
              logProctoring(curAId,'no_face_detected',`Absent ${consNoFaceRef.current} vérifications consécutives`).catch(()=>{})
              captureSnapshot('no_face_detected',curAId,false,0,null,5_000)
            }
          } else setFaceStatus('warn')
        } else if(count>1){
          consMultiRef.current++; consNoFaceRef.current=0; consMismatchRef.current=0; consGood=0
          if(consMultiRef.current>=CONSEC_ALERT){
            setFaceStatus('bad')
            if(now-lastFaceAlertRef.current.multiple>ALERT_COOLDOWN){
              lastFaceAlertRef.current.multiple=now
              warning(`${count} visages détectés — éloignez toute autre personne`)
              logProctoring(curAId,'multiple_faces',`${count} visages`).catch(()=>{})
              captureSnapshot('multiple_faces',curAId,true,count,null,5_000)
            }
          } else setFaceStatus('warn')
        } else {
          consNoFaceRef.current=0; consMultiRef.current=0
          if(refDescRef.current&&(dets[0] as any).descriptor){
            const dist=fa.euclideanDistance((dets[0] as any).descriptor,refDescRef.current)
            if(dist<=RECOG_THRESHOLD){
              consMismatchRef.current=0; consGood++
              setFaceStatus('ok')
              if(consGood%10===0&&dist<0.4){
                const alpha=0.1; const upd=new Float32Array(refDescRef.current.length)
                for(let i=0;i<upd.length;i++) upd[i]=(1-alpha)*refDescRef.current[i]+alpha*(dets[0] as any).descriptor[i]
                refDescRef.current=upd
              }
            } else {
              consMismatchRef.current++; consGood=0
              if(consMismatchRef.current>=CONSEC_ALERT){
                if(consMismatchRef.current===RECAPTURE_AFTER){
                  refCapturing=false; captureReference()
                } else if(consMismatchRef.current>RECAPTURE_AFTER){
                  setFaceStatus('warn')
                  if(now-lastFaceAlertRef.current.mismatch>ALERT_COOLDOWN){
                    lastFaceAlertRef.current.mismatch=now
                    logProctoring(curAId,'face_mismatch',`distance=${dist.toFixed(3)}`).catch(()=>{})
                    captureSnapshot('face_mismatch',curAId,true,1,1-dist,5_000)
                  }
                } else setFaceStatus('warn')
              } else setFaceStatus('warn')
            }
          } else { setFaceStatus('ok'); consGood++ }
        }
      }catch{}
    }

    function loadAndStart() {
      const fa=(window as any).faceapi
      if(!fa){setTimeout(loadAndStart,500);return}
      fa.nets.tinyFaceDetector.loadFromUri(FACEAPI_MODEL_URL)
        .then(()=>fa.nets.faceLandmark68Net.loadFromUri(FACEAPI_MODEL_URL))
        .then(()=>fa.nets.faceRecognitionNet.loadFromUri(FACEAPI_MODEL_URL))
        .then(()=>{
          setFaceStatus('warn')
          setTimeout(captureReference,3000)
          if(faceIntervalRef.current) clearInterval(faceIntervalRef.current)
          faceIntervalRef.current=setInterval(faceDetectionTick,5000)
        })
        .catch(()=>{ setFaceStatus('ok') }) // dégradé: pas de modèles → indicateur OK simple
    }

    // Charger face-api.js si pas encore chargé
    if((window as any).faceapi){
      loadAndStart()
    } else {
      const s=document.createElement('script')
      s.src='https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js'
      s.crossOrigin='anonymous'; s.onload=loadAndStart; s.onerror=()=>setFaceStatus('ok')
      document.head.appendChild(s)
    }
  }

  async function pollExtraTime(aId:number) {
    if(sessionEndedRef.current) return
    try {
      const res=await api.get<{extra_minutes?:number}>(`/api/exam_attempts/${aId}/subject`)
      const ne=res.extra_minutes??0
      if(ne>extraMinRef.current){const added=ne-extraMinRef.current;extraMinRef.current=ne;success(`+${added} minute${added>1?'s':''} accordée${added>1?'s':''} par le surveillant`)}
    } catch {}
  }

  async function doAutoSave(aId:number) {
    try{await api.post(`/api/exam_attempts/${aId}/save`,{answers:JSON.stringify(answers)});setLastSaved(new Date())}catch{}
  }

  const handleSubmit = useCallback(async(auto=false)=>{
    const aId=attemptRef.current; if(!aId||submitting||sessionEndedRef.current) return
    sessionEndedRef.current=true; setSubmitting(true)
    ;[timerRef,saveRef,msgPollRef,snapshotRef,extraPollRef].forEach(r=>{if(r.current)clearInterval(r.current)})
    document.exitFullscreen?.().catch(()=>{})
    camStream.current?.getTracks().forEach(t=>t.stop())
    screenStream.current?.getTracks().forEach(t=>t.stop())
    if(lkRoomRef.current){try{lkRoomRef.current.disconnect()}catch{}}
    try {
      await api.post(`/api/exam_attempts/${aId}/submit`,{answers:JSON.stringify(answers)})
      if(!auto) success('Copie soumise avec succès !')
      setPhase('submitted')
    } catch {
      try{await api.post(`/api/exam_attempts/${aId}/save`,{answers:JSON.stringify(answers)});setPhase('submitted')}
      catch{toastErr('Erreur lors de la soumission');setSubmitting(false);sessionEndedRef.current=false}
    }
  },[answers,submitting]) // eslint-disable-line

  function sendMsg() {
    if(!msgText.trim()) return
    const txt=msgText.trim(); setMsgSent(p=>[...p,{text:txt,time:new Date().toLocaleTimeString('fr-FR')}])
    if(attemptRef.current) api.post(`/api/exam_attempts/${attemptRef.current}/student_message`,{message:txt}).catch(()=>{})
    setMsgText('')
  }

  function fmtTimer(s:number) {
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60
    if(h>0) return `${h}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
  }
  const timerColor=timeLeft<300?'#ef4444':timeLeft<600?'#f59e0b':'#2563eb'

  /* ══════════════════════════════════════════════════════════════════════ */
  /* RENDER                                                                 */
  /* ══════════════════════════════════════════════════════════════════════ */
  if(phase==='loading') return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc'}}>
      <div style={{textAlign:'center'}}><i className="fas fa-spinner fa-spin" style={{fontSize:48,color:'#2563eb',marginBottom:16,display:'block'}}/><p style={{color:'#64748b'}}>Chargement de l'examen…</p></div>
    </div>
  )

  if(phase==='submitted') return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc'}}>
      <div style={{background:'white',borderRadius:20,padding:48,maxWidth:480,width:'90%',textAlign:'center',boxShadow:'0 8px 32px rgba(0,0,0,.1)',border:'1px solid #e2e8f0'}}>
        <div style={{width:80,height:80,background:'rgba(16,185,129,.1)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',fontSize:36,color:'#10b981'}}><i className="fas fa-check-circle"/></div>
        <h2 style={{color:'#0f172a',marginBottom:12}}>Copie soumise !</h2>
        <p style={{color:'#64748b',marginBottom:28,lineHeight:1.6}}>Votre copie a été transmise avec succès.</p>
        <button onClick={()=>router.push('/dashboard/student')} style={{width:'100%',padding:'13px',background:'#2563eb',color:'white',border:'none',borderRadius:10,fontWeight:700,fontSize:15,cursor:'pointer'}}>
          <i className="fas fa-home" style={{marginRight:8}}/>Retour au tableau de bord
        </button>
      </div>
    </div>
  )

  /* ── INSTRUCTIONS + ATTESTATION (thème clair, identique à l'originale) ── */
  if(phase==='instructions'&&exam) return(
    <div style={{minHeight:'100vh',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'white',borderRadius:16,boxShadow:'0 8px 32px rgba(0,0,0,.12)',maxWidth:580,width:'100%',padding:'28px 32px'}}>

        {/* En-tête */}
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:22}}>
          <div style={{width:52,height:52,background:'rgba(37,99,235,.1)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,color:'#2563eb',flexShrink:0}}>
            <i className="fas fa-shield-alt"/>
          </div>
          <div>
            <h2 style={{margin:'0 0 3px',fontSize:18,fontWeight:700,color:'#1e293b'}}>Examen Surveillé — Attestation d'honneur</h2>
            <p style={{margin:0,color:'#64748b',fontSize:13}}>Lisez les conditions et signez avant de démarrer</p>
          </div>
        </div>

        {/* Conditions de surveillance */}
        <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'14px 16px',marginBottom:18}}>
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {[
              {icon:'fa-video',color:'#2563eb',txt:'Caméra et microphone activés pendant toute la durée'},
              {icon:'fa-user-check',color:'#10b981',txt:'Visage visible en permanence (détection faciale IA)'},
              {icon:'fa-expand',color:'#f59e0b',txt:"Plein écran obligatoire — tout changement d'onglet est enregistré"},
              {icon:'fa-ban',color:'#ef4444',txt:'Toute fraude entraîne un bannissement immédiat et définitif'},
            ].map(c=>(
              <div key={c.txt} style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'#334155'}}>
                <i className={`fas ${c.icon}`} style={{color:c.color,width:16,textAlign:'center',flexShrink:0}}/>
                <span>{c.txt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attestation d'honneur */}
        <div style={{background:'#fff8ed',border:'1px solid #f59e0b',borderRadius:10,padding:'14px 16px',marginBottom:18}}>
          <p style={{margin:'0 0 4px',fontSize:13,fontWeight:700,color:'#92400e'}}>
            <i className="fas fa-file-signature" style={{marginRight:6}}/>Attestation sur l'honneur
          </p>
          <p style={{margin:0,fontSize:12,color:'#78350f',lineHeight:1.65}}>
            Je soussigné(e) <strong>{user?.full_name}</strong>, certifie que je composerai cet examen seul(e),
            sans aide extérieure, sans document non autorisé, et sans aucun outil d'intelligence artificielle.
            Je reconnais que tout manquement à ces règles constitue une fraude académique passible de sanctions.
          </p>
        </div>

        {/* Zone de signature */}
        <div style={{marginBottom:18}}>
          <label style={{fontSize:12,fontWeight:700,color:'#334155',display:'block',marginBottom:8}}>
            <i className="fas fa-pen-nib" style={{color:'#2563eb',marginRight:5}}/>
            Signez ci-dessous pour confirmer votre engagement <span style={{color:'#ef4444'}}>*</span>
          </label>
          <canvas ref={canvasRef}
            style={{border:'2px solid #e2e8f0',borderRadius:8,display:'block',cursor:'crosshair',background:'#fafafa',touchAction:'none',width:'100%',height:130}}
            onMouseDown={onSigStart as any} onMouseMove={onSigMove as any} onMouseUp={onSigEnd} onMouseLeave={onSigEnd}
            onTouchStart={onSigStart as any} onTouchMove={onSigMove as any} onTouchEnd={onSigEnd}/>
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:6}}>
            <button onClick={clearSig} style={{background:'none',border:'none',color:'#94a3b8',fontSize:12,cursor:'pointer'}}>
              <i className="fas fa-eraser"/> Effacer
            </button>
          </div>
        </div>

        {/* Boutons */}
        <div style={{display:'flex',gap:10}}>
          <button onClick={()=>router.back()} style={{flex:1,padding:'11px',background:'#f1f5f9',color:'#475569',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer',fontSize:14}}>
            <i className="fas fa-times" style={{marginRight:6}}/>Annuler
          </button>
          <button onClick={doStartExam} disabled={starting}
            style={{flex:2,padding:'11px',background:'#2563eb',color:'white',border:'none',borderRadius:8,fontWeight:600,cursor:starting?'not-allowed':'pointer',opacity:starting?.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:14}}>
            {starting
              ?<><i className="fas fa-spinner fa-spin"/>Démarrage en cours…</>
              :<><i className="fas fa-pen-nib"/>Signer et démarrer l'examen</>}
          </button>
        </div>
      </div>
    </div>
  )

  /* ── PERMISSIONS ──────────────────────────────────────────────────────── */
  if(phase==='permissions') {
    const isHttp=typeof window!=='undefined'&&window.location.protocol==='http:'&&window.location.hostname!=='localhost'
    const pCol=(s:PermStatus)=>s==='ok'?'#10b981':s==='error'?'#ef4444':'#94a3b8'
    const pBorder=(s:PermStatus)=>s==='ok'?'#10b981':s==='error'?'#ef4444':'#334155'
    const PI=({icon,label,desc,status}:{icon:string;label:string;desc:string;status:PermStatus})=>(
      <div style={{display:'flex',alignItems:'center',gap:14,background:'#0f172a',border:`1px solid ${pBorder(status)}`,borderRadius:12,padding:'14px 16px'}}>
        <div style={{width:40,height:40,minWidth:40,borderRadius:10,background:status==='ok'?'rgba(16,185,129,.15)':status==='error'?'rgba(239,68,68,.15)':'#1e293b',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <i className={`fas ${icon}`} style={{color:pCol(status),fontSize:18}}/>
        </div>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:'white',marginBottom:3}}>{label}</div><div style={{fontSize:12,color:status==='loading'?'#94a3b8':pCol(status)}}>{status==='loading'?'Demande en cours…':desc}</div></div>
        <div style={{width:24,height:24,minWidth:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,background:status==='ok'?'#10b981':status==='error'?'#ef4444':'#334155',color:'white'}}>
          {status==='ok'&&<i className="fas fa-check"/>}{status==='error'&&<i className="fas fa-times"/>}
          {status==='loading'&&<i className="fas fa-spinner fa-spin" style={{fontSize:9}}/>}{status==='pending'&&<i className="fas fa-clock" style={{fontSize:9}}/>}
        </div>
      </div>
    )
    return(
      <div style={{minHeight:'100vh',background:'#0f172a',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{background:'#1e293b',border:'1px solid #334155',borderRadius:20,padding:'40px 36px',maxWidth:500,width:'100%',color:'white'}}>
          <h2 style={{fontSize:20,fontWeight:800,margin:'0 0 8px'}}>Accès requis</h2>
          <p style={{fontSize:13,color:'#94a3b8',lineHeight:1.6,marginBottom:28}}>Autorisez les 3 accès ci-dessous pour démarrer l'examen.</p>
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:32}}>
            <PI icon="fa-video"      label="Caméra"               desc={permCam==='ok'?'Accès accordé':permCam==='error'?'Accès refusé':'Obligatoire — surveillance vidéo'}        status={permCam}/>
            <PI icon="fa-microphone" label="Microphone"           desc={permMic==='ok'?'Accès accordé':permMic==='error'?'Accès refusé':'Obligatoire — surveillance audio'}         status={permMic}/>
            <PI icon="fa-desktop"    label="Partage d'écran entier" desc={permScreen==='ok'?'Accès accordé':permScreen==='error'?'Refusé ou fenêtre sélectionnée':'Sélectionnez « Écran entier »'} status={permScreen}/>
          </div>
          <button onClick={requestAllPermissions} disabled={permBusy||isHttp}
            style={{width:'100%',padding:15,background:permBusy||isHttp?'#334155':'#2563eb',color:permBusy||isHttp?'#64748b':'white',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:permBusy||isHttp?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            {permBusy?<><i className="fas fa-spinner fa-spin"/>Vérification…</>:<><i className="fas fa-shield-alt"/>Autoriser et commencer</>}
          </button>
          {permError&&<div style={{marginTop:16,background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.3)',borderRadius:10,padding:'12px 14px',fontSize:13,color:'#fca5a5',lineHeight:1.6}}>
            <i className="fas fa-exclamation-triangle" style={{marginRight:6}}/>{permError}
          </div>}
        </div>
      </div>
    )
  }

  /* ── EXAM ─────────────────────────────────────────────────────────────── */
  if(phase==='exam'&&exam) {
    const structuredQs = exam.questions??[]
    const p1Blocks     = parsedBlocks.filter(b=>b.type==='qcm'||b.type==='vf')
    const p2Blocks     = parsedBlocks.filter(b=>b.type==='open'||b.type==='subopen')
    const allQBlocks   = parsedBlocks.filter(b=>b.type!=='text'&&b.type!=='section')
    const hasParsed    = allQBlocks.length>0
    const subjectRaw   = exam.subject_content?(typeof exam.subject_content==='object'?exam.subject_content.content:exam.subject_content as string):null

    const structAnswered = structuredQs.filter(q=>(answers[q.id.toString()]??'').trim()!=='').length
    const parsedAnswered = allQBlocks.filter(b=>{
      if(b.type==='subopen') return b.choices?.some(c=>(answers[`pq_${b.num}_${c.letter}`]??'').trim()!=='')
      return (answers[`pq_${b.num}`]??'').trim()!==''
    }).length

    return(
      <div style={{display:'flex',height:'100vh',width:'100%',overflow:'hidden',fontFamily:"-apple-system,'Segoe UI',Roboto,sans-serif"}}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes agP{0%{box-shadow:0 0 0 0 rgba(16,185,129,.7)}50%{box-shadow:0 0 0 5px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}`}</style>

        {/* ═══ PANNEAU SURVEILLANCE ═══ */}
        <div style={{width:280,minWidth:280,background:'white',display:'flex',flexDirection:'column',borderRight:'1px solid #e2e8f0',boxShadow:'2px 0 8px rgba(0,0,0,.08)',overflowY:'auto',zIndex:100}}>
          <div style={{padding:'12px 16px',background:'#2563eb',color:'white',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,fontSize:14,fontWeight:700,marginBottom:6}}><i className="fas fa-shield-alt"/> Surveillance</div>
            <span style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 10px',background:'rgba(255,255,255,.2)',borderRadius:20,fontSize:10,fontWeight:600}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#10b981',animation:'pulse 2s infinite',display:'inline-block'}}/>En cours
            </span>
          </div>
          {/* Agent IA */}
          <div style={{margin:'8px 10px',padding:'9px 11px',background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.22)',borderRadius:8,display:'flex',alignItems:'center',gap:9}}>
            <div style={{width:28,height:28,background:'rgba(16,185,129,.15)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><i className="fas fa-robot" style={{color:'#6ee7b7',fontSize:13}}/></div>
            <div style={{display:'flex',alignItems:'center',gap:7,flex:1}}>
              <span style={{width:7,height:7,background:'#10b981',borderRadius:'50%',flexShrink:0,display:'inline-block',animation:'agP 1.8s ease-in-out infinite'}}/>
              <span style={{fontSize:10,color:'#6ee7b7',fontWeight:600,lineHeight:1.4}}>Agent IA de surveillance actif<br/><span style={{fontWeight:400,color:'rgba(110,231,183,.65)'}}>Surveillance automatique en temps réel</span></span>
            </div>
          </div>
          {/* Caméra locale — ref callback pour attach immédiat */}
          <div style={{margin:'0 12px 8px',borderRadius:8,overflow:'hidden',background:'#000',boxShadow:'0 2px 8px rgba(0,0,0,.12)',position:'relative',aspectRatio:'4/3'}}>
            <video ref={el=>{videoRef.current=el;if(el&&camStream.current&&el.srcObject!==camStream.current)el.srcObject=camStream.current}}
              autoPlay muted playsInline style={{width:'100%',height:'100%',objectFit:'cover',display:'block',transform:'scaleX(-1)'}}/>
            <div style={{position:'absolute',top:6,right:6,padding:'3px 7px',background:faceStatus==='ok'?'rgba(16,185,129,.9)':faceStatus==='warn'?'rgba(245,158,11,.9)':faceStatus==='bad'?'rgba(239,68,68,.9)':'rgba(0,0,0,.7)',backdropFilter:'blur(4px)',borderRadius:4,color:'white',fontSize:9,fontWeight:600,display:'flex',alignItems:'center',gap:4}}>
              {faceStatus==='init'&&<><i className="fas fa-sync fa-spin"/>Init…</>}
              {faceStatus==='ok'&&<><i className="fas fa-user-check"/>Visage OK</>}
              {faceStatus==='warn'&&<><i className="fas fa-eye-slash"/>Repositionnez…</>}
              {faceStatus==='bad'&&<><i className="fas fa-times"/>Visage absent</>}
            </div>
          </div>
          {/* Vidéo enseignant — toujours dans le DOM pour que le ref soit disponible */}
          <div style={{display:teacherActive?'block':'none',margin:'0 12px 8px',borderRadius:8,overflow:'hidden',background:'#000',border:'2px solid #f59e0b',position:'relative'}}>
            <div style={{position:'absolute',top:4,left:6,zIndex:10,fontSize:9,fontWeight:700,color:'#f59e0b',background:'rgba(0,0,0,.7)',padding:'2px 6px',borderRadius:4}}><i className="fas fa-chalkboard-teacher"/> Enseignant</div>
            <video ref={teacherVideoRef} autoPlay playsInline style={{width:'100%',display:'block',aspectRatio:'4/3',objectFit:'cover'}}/>
          </div>
          <audio ref={teacherAudioRef} autoPlay style={{display:'none'}}/>
          {/* Périphériques */}
          <div style={{padding:'8px 12px',borderBottom:'1px solid #e2e8f0'}}>
            {[{icon:'fa-video',label:'Caméra',on:camOn},{icon:'fa-microphone',label:'Micro',on:micOn},{icon:'fa-desktop',label:'Écran',on:screenOn}].map(d=>(
              <div key={d.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:6,marginBottom:4,background:'#f8fafc',borderRadius:6}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',background:d.on?'rgba(16,185,129,.1)':'white',border:`2px solid ${d.on?'#10b981':'#e2e8f0'}`,borderRadius:4,fontSize:11,color:d.on?'#10b981':'#94a3b8'}}><i className={`fas ${d.icon}`}/></div>
                  <span style={{fontSize:11,fontWeight:600,color:'#0f172a'}}>{d.label}</span>
                </div>
                <span style={{fontSize:9,padding:'2px 6px',borderRadius:10,fontWeight:600,background:d.on?'rgba(16,185,129,.1)':'rgba(100,116,139,.1)',color:d.on?'#10b981':'#64748b'}}>{d.on?'On':'Off'}</span>
              </div>
            ))}
          </div>
          {/* Score risque */}
          <div style={{padding:'8px 12px',borderBottom:'1px solid #e2e8f0'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6,fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#64748b'}}><i className="fas fa-chart-line"/> Score de risque</div>
            <div style={{height:20,background:'#f1f5f9',borderRadius:10,overflow:'hidden',position:'relative',border:'2px solid #e2e8f0'}}>
              <div style={{height:'100%',background:riskScore>=70?'#ef4444':riskScore>=40?'#f59e0b':'#10b981',width:`${Math.min(riskScore,100)}%`,transition:'width .5s,background-color .3s'}}/>
              <span style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontWeight:700,fontSize:11,color:'#0f172a'}}>{riskScore}</span>
            </div>
          </div>
          {/* Alertes */}
          <div style={{flex:1,overflowY:'auto',padding:'8px 12px'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8,fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#64748b'}}><i className="fas fa-exclamation-triangle"/> Alertes système</div>
            {alerts.length===0?(
              <div style={{textAlign:'center',padding:'20px 12px',color:'#94a3b8'}}><i className="fas fa-shield-alt" style={{fontSize:24,opacity:.3,display:'block',marginBottom:6}}/><p style={{fontSize:10,margin:0}}>Aucune alerte</p></div>
            ):alerts.slice(0,10).map((a,i)=>(
              <div key={i} style={{background:a.type.startsWith('teacher')?'rgba(245,158,11,.07)':'rgba(239,68,68,.05)',borderLeft:`3px solid ${a.type.startsWith('teacher')?'#f59e0b':'#ef4444'}`,padding:'6px 8px',marginBottom:6,borderRadius:4,fontSize:10}}>
                <div style={{marginBottom:3,color:'#0f172a',fontWeight:500}}>{a.msg}</div>
                <div style={{color:'#64748b',fontSize:9}}>{a.at}</div>
              </div>
            ))}
          </div>
          {/* Contacter enseignant */}
          <div style={{padding:'8px 12px',borderTop:'1px solid #e2e8f0'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#64748b',marginBottom:6}}>
              <i className="fas fa-comment-dots"/> Contacter l'enseignant
            </div>
            <textarea value={msgText} onChange={e=>setMsgText(e.target.value)} placeholder="Question ou réclamation…"
              rows={2}
              style={{width:'100%',background:'white',border:'1px solid #e2e8f0',borderRadius:6,padding:'6px 8px',fontSize:11,color:'#0f172a',resize:'none',marginBottom:6,boxSizing:'border-box'}}/>
            <div style={{display:'flex',gap:4}}>
              <button onClick={()=>{
                if(!attemptRef.current) return
                api.post(`/api/exam_attempts/${attemptRef.current}/student_message`,{message:'[DEMANDE_APPEL] Je souhaite poser une question verbalement au surveillant.'}).catch(()=>{})
                setMsgSent(p=>[...p,{text:'Demande d\'appel vocal envoyée',time:new Date().toLocaleTimeString('fr-FR')}])
              }} title="Demander un appel vocal"
                style={{flex:1,background:'rgba(16,185,129,.15)',color:'#10b981',border:'1px solid rgba(16,185,129,.3)',borderRadius:6,padding:'6px',cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontWeight:600}}>
                <i className="fas fa-phone"/> Appel
              </button>
              <button onClick={sendMsg} title="Envoyer un message texte"
                style={{flex:2,background:'#2563eb',color:'white',border:'none',borderRadius:6,padding:'6px 10px',cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontWeight:600}}>
                <i className="fas fa-paper-plane"/> Envoyer
              </button>
            </div>
            {msgSent.length>0&&<div style={{maxHeight:72,overflowY:'auto',marginTop:6}}>
              {[...msgSent].reverse().slice(0,4).map((m,i)=>(
                <div key={i} style={{background:'rgba(37,99,235,.06)',border:'1px solid rgba(37,99,235,.1)',borderRadius:4,padding:'4px 7px',marginBottom:3,fontSize:10,color:'#1e3a8a'}}>
                  <div style={{marginBottom:1}}>{m.text}</div>
                  <div style={{fontSize:9,color:'#94a3b8'}}>Envoyé à {m.time}</div>
                </div>
              ))}
            </div>}
          </div>
        </div>

        {/* ═══ PANNEAU EXAMEN ═══ */}
        <div style={{flex:1,background:'#f8fafc',overflowY:'auto',display:'flex',flexDirection:'column'}}>
          {/* Header */}
          <div style={{background:'white',padding:'16px 24px',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,boxShadow:'0 2px 4px rgba(0,0,0,.04)'}}>
            <div>
              <h1 style={{fontSize:18,fontWeight:700,color:'#0f172a',margin:0}}>{exam.title}</h1>
              <p style={{fontSize:12,color:'#64748b',margin:'2px 0 0'}}>Durée : {exam.duration_minutes} min · Commencé à {attempt?.started_at?new Date(attempt.started_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—'}</p>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {lastSaved&&<span style={{fontSize:11,color:'#10b981'}}><i className="fas fa-cloud-arrow-up" style={{marginRight:4}}/>Sauvegardé {lastSaved.toLocaleTimeString('fr-FR')}</span>}
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',background:timerColor,color:'white',borderRadius:8,fontSize:20,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>
                <i className="fas fa-clock" style={{fontSize:16}}/> {fmtTimer(timeLeft)}
              </div>
              <button onClick={()=>{if(confirm('Soumettre votre copie ? Cette action est irréversible.'))handleSubmit(false)}} disabled={submitting}
                style={{padding:'10px 20px',background:'#10b981',color:'white',border:'none',borderRadius:8,fontWeight:700,fontSize:14,cursor:submitting?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:7}}>
                {submitting?<><i className="fas fa-spinner fa-spin"/>Soumission…</>:<><i className="fas fa-paper-plane"/>Soumettre</>}
              </button>
            </div>
          </div>

          <div style={{flex:1,padding:24,maxWidth:900,width:'100%',margin:'0 auto'}}>
            {/* Sujet complet */}
            {subjectRaw&&(
              <div style={{background:'white',borderRadius:12,marginBottom:24,border:'1px solid #e2e8f0',overflow:'hidden'}}>
                <div onClick={()=>setSubjectOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:10,padding:'14px 20px',cursor:'pointer',userSelect:'none',borderBottom:subjectOpen?'1px solid #e2e8f0':'none'}}>
                  <i className="fas fa-file-alt" style={{color:'#2563eb',fontSize:16}}/>
                  <h2 style={{margin:0,fontSize:15,fontWeight:700,color:'#0f172a',flex:1}}>Consulter le sujet complet</h2>
                  <i className={`fas fa-chevron-${subjectOpen?'up':'down'}`} style={{color:'#94a3b8',fontSize:13}}/>
                </div>
                {subjectOpen&&<div style={{padding:24,fontSize:14,lineHeight:1.8,color:'#374151',whiteSpace:'pre-wrap',maxHeight:450,overflowY:'auto'}}>{subjectRaw}</div>}
              </div>
            )}

            {/* Zone réponses */}
            <div style={{background:'white',borderRadius:12,border:'1px solid #e2e8f0',padding:24,marginBottom:24}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                <h2 style={{margin:0,fontSize:16,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><i className="fas fa-pen" style={{color:'#10b981'}}/> Vos Réponses</h2>
                <span style={{fontSize:12,color:'#64748b'}}>Sauvegarde automatique</span>
              </div>

              {/* CAS 1 — Questions structurées */}
              {structuredQs.length>0&&(()=>{
                const p1=structuredQs.filter(q=>q.question_type==='qcm'||q.question_type==='vf')
                const p2=structuredQs.filter(q=>q.question_type!=='qcm'&&q.question_type!=='vf')
                return(<>
                  <ProgBar answered={structAnswered} total={structuredQs.length}/>
                  {p1.length>0&&<SecHead icon="fa-check-square" color="#3b82f6" bg="#eff6ff" tc="#1e40af" title="Partie 1 — Questions à Choix Multiples" sub={`${p1.length} question${p1.length>1?'s':''} • Cochez la bonne réponse`}/>}
                  {p1.map((q,i)=><SQ key={q.id} q={q} idx={i} answers={answers} setAnswers={setAnswers}/>)}
                  {p2.length>0&&<SecHead icon="fa-pen-alt" color="#10b981" bg="#ecfdf5" tc="#065f46" title="Partie 2 — Questions à réponses courtes / développées" sub={`${p2.length} question${p2.length>1?'s':''} • Rédigez vos réponses`}/>}
                  {p2.map((q,i)=><SQ key={q.id} q={q} idx={i} answers={answers} setAnswers={setAnswers}/>)}
                </>)
              })()}

              {/* CAS 2 — Blocs parsés */}
              {structuredQs.length===0&&hasParsed&&(()=>{
                return(<>
                  <ProgBar answered={parsedAnswered} total={allQBlocks.length}/>
                  {/* Partie 1 QCM avec navigation */}
                  {p1Blocks.length>0&&(
                    <div style={{marginBottom:p2Blocks.length?(showPart2?20:0):0}}>
                      <SecHead icon="fa-check-square" color="#3b82f6" bg="#eff6ff" tc="#1e40af" title="Partie 1 — Questions à Choix Multiples" sub={`${p1Blocks.length} question${p1Blocks.length>1?'s':''}`}/>
                      {/* Barre nav */}
                      <div style={{background:'#1e293b',borderRadius:12,padding:'12px 16px',marginBottom:16}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                          <button onClick={()=>setQcmIdx(i=>Math.max(0,i-1))} disabled={qcmIdx===0}
                            style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',borderRadius:8,padding:'8px 16px',cursor:qcmIdx===0?'not-allowed':'pointer',fontSize:13,fontWeight:600,opacity:qcmIdx===0?.4:1}}>
                            <i className="fas fa-chevron-left"/> Préc.
                          </button>
                          <span style={{flex:1,textAlign:'center',fontSize:14,fontWeight:700,color:'#f1f5f9'}}>Q {qcmIdx+1} / {p1Blocks.length}</span>
                          {qcmIdx<p1Blocks.length-1?(
                            <button onClick={()=>setQcmIdx(i=>i+1)} style={{background:'#3b82f6',border:'none',color:'#fff',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:600}}>
                              Suiv. <i className="fas fa-chevron-right"/>
                            </button>
                          ):(
                            <button onClick={()=>setShowPart2(true)} disabled={p2Blocks.length===0}
                              style={{background:p2Blocks.length?'#10b981':'#475569',border:'none',color:'#fff',borderRadius:8,padding:'8px 16px',cursor:p2Blocks.length?'pointer':'default',fontSize:13,fontWeight:600}}>
                              {p2Blocks.length?<><i className="fas fa-arrow-right"/> Terminer QCM</>:<><i className="fas fa-check"/> Fin</>}
                            </button>
                          )}
                        </div>
                        {/* Pastilles */}
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
                          {p1Blocks.map((b,i)=>{
                            const ok=(answers[`pq_${b.num}`]??'').trim()!==''; const cur=i===qcmIdx
                            return <span key={i} onClick={()=>setQcmIdx(i)} title={`Q${i+1}`}
                              style={{width:24,height:24,borderRadius:'50%',background:cur?'#3b82f6':ok?'#10b981':'rgba(255,255,255,.15)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',cursor:'pointer',border:cur?'2px solid #60a5fa':'1.5px solid rgba(255,255,255,.3)',flexShrink:0}}>
                              {i+1}
                            </span>
                          })}
                        </div>
                      </div>
                      {p1Blocks[qcmIdx]&&<PQ block={p1Blocks[qcmIdx]} answers={answers} setAnswers={setAnswers} onAnswer={()=>{
                        if(advanceTimerRef.current)clearTimeout(advanceTimerRef.current)
                        if(qcmIdx<p1Blocks.length-1){
                          advanceTimerRef.current=setTimeout(()=>{advanceTimerRef.current=null;setQcmIdx(q=>q+1)},450)
                        }
                      }}/>}
                    </div>
                  )}
                  {/* Partie 2 */}
                  {p2Blocks.length>0&&(p1Blocks.length===0||showPart2)&&(
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,padding:'12px 16px',background:'#ecfdf5',borderRadius:10,borderLeft:'4px solid #10b981'}}>
                        <i className="fas fa-pen-alt" style={{color:'#10b981',fontSize:18}}/>
                        <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:'#065f46'}}>Partie 2 — Questions à réponses courtes / développées</div><div style={{fontSize:12,color:'#10b981'}}>{p2Blocks.length} question{p2Blocks.length>1?'s':''} • Rédigez vos réponses dans les zones ci-dessous</div></div>
                        {p1Blocks.length>0&&showPart2&&<button onClick={()=>setShowPart2(false)} style={{background:'#d1fae5',border:'none',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:600,color:'#065f46',cursor:'pointer'}}><i className="fas fa-arrow-left"/> Retour QCM</button>}
                      </div>
                      {parsedBlocks.map((b,i)=>{
                        if(b.type==='section') return <div key={i} style={{margin:'18px 0 10px',padding:'10px 16px',background:'#f1f5f9',borderRadius:8,fontWeight:700,fontSize:14,color:'#334155',borderLeft:'4px solid #94a3b8'}}><i className="fas fa-layer-group" style={{color:'#64748b',marginRight:8}}/>{b.title}</div>
                        if(b.type!=='open'&&b.type!=='subopen') return null
                        return <PQ key={i} block={b} answers={answers} setAnswers={setAnswers}/>
                      })}
                    </div>
                  )}
                </>)
              })()}

              {/* CAS 3 — Fallback textarea */}
              {structuredQs.length===0&&!hasParsed&&(
                <textarea value={answers['answer']??''} onChange={e=>setAnswers({answer:e.target.value})}
                  placeholder="Rédigez vos réponses ici en indiquant le numéro de chaque question…"
                  style={{width:'100%',minHeight:300,padding:16,border:'2px solid #e2e8f0',borderRadius:8,fontSize:14,lineHeight:1.6,resize:'vertical',fontFamily:'inherit',color:'#0f172a',outline:'none',boxSizing:'border-box'}}/>
              )}
            </div>
          </div>

          <div style={{padding:'20px 24px',background:'white',borderTop:'1px solid #e2e8f0',display:'flex',justifyContent:'flex-end',gap:12,flexShrink:0}}>
            <button onClick={()=>{const aId=attemptRef.current;if(aId)doAutoSave(aId)}}
              style={{padding:'10px 20px',background:'#f1f5f9',color:'#475569',border:'none',borderRadius:8,fontWeight:600,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
              <i className="fas fa-save"/> Sauvegarder brouillon
            </button>
            <button onClick={()=>{if(confirm('Soumettre votre copie ? Cette action est irréversible.'))handleSubmit(false)}} disabled={submitting}
              style={{padding:'10px 24px',background:'#10b981',color:'white',border:'none',borderRadius:8,fontWeight:700,fontSize:14,cursor:submitting?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:7}}>
              <i className="fas fa-paper-plane"/> Soumettre l'examen
            </button>
          </div>
        </div>

        {/* Overlay surveillant — toujours dans le DOM pour que le ref soit disponible */}
        <div style={{display:proctorActive?'block':'none',position:'fixed',bottom:24,left:296,zIndex:9000,background:'rgba(10,16,32,.92)',border:'2px solid #3b82f6',borderRadius:12,overflow:'hidden',width:220,boxShadow:'0 8px 32px rgba(0,0,0,.6)'}}>
          <video ref={proctorVideoRef} autoPlay playsInline style={{width:'100%',display:'block',maxHeight:124,objectFit:'cover',background:'#0a1020'}}/>
          <audio ref={proctorAudioRef} autoPlay style={{display:'none'}}/>
          <div style={{padding:'6px 10px',display:'flex',alignItems:'center',gap:6,background:'rgba(37,99,235,.25)'}}>
            <span style={{display:'inline-block',width:7,height:7,background:'#ef4444',borderRadius:'50%',animation:'pulse 1s infinite'}}/>
            <span style={{color:'#bfdbfe',fontSize:12,fontWeight:600}}><i className="fas fa-user-shield" style={{marginRight:4}}/>Votre surveillant</span>
            <button onClick={()=>setProctorActive(false)} style={{marginLeft:'auto',background:'none',border:'none',color:'rgba(255,255,255,.5)',fontSize:14,cursor:'pointer'}}>✕</button>
          </div>
        </div>

        {/* Modal appel privé entrant */}
        {showPrivateCallModal&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
            <div style={{background:'white',borderRadius:12,overflow:'hidden',maxWidth:400,width:'92%',boxShadow:'0 20px 40px rgba(0,0,0,.3)',borderTop:'4px solid #3b82f6'}}>
              <div style={{padding:'24px 28px',textAlign:'center'}}>
                <div style={{width:56,height:56,margin:'0 auto 14px',background:'rgba(37,99,235,.12)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color:'#3b82f6'}}>
                  <i className="fas fa-phone"/>
                </div>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:8,color:'#1e40af'}}>Appel du Surveillant</h3>
                <p style={{fontSize:13,color:'#475569',marginBottom:20,lineHeight:1.5}}>Le surveillant souhaite vous parler en privé.<br/>Votre micro sera activé automatiquement.</p>
                <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                  <button onClick={acceptPrivateCall}
                    style={{padding:'9px 20px',background:'#10b981',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',gap:6}}>
                    <i className="fas fa-phone"/> Accepter
                  </button>
                  <button onClick={()=>setShowPrivateCallModal(false)}
                    style={{padding:'9px 20px',background:'#ef4444',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',gap:6}}>
                    <i className="fas fa-phone-slash"/> Refuser
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel appel privé — toujours dans le DOM pour que les refs soient disponibles */}
        <div style={{display:privateCallActive?'block':'none',position:'fixed',left:296,bottom:12,zIndex:9500,background:'#0f172a',border:'2px solid #3b82f6',borderRadius:8,overflow:'hidden',width:230,boxShadow:'0 8px 32px rgba(0,0,0,.6)'}}>
          <div style={{background:'#3b82f6',padding:'6px 10px',display:'flex',alignItems:'center',gap:8}}>
            <i className="fas fa-phone" style={{color:'white',fontSize:10}}/>
            <span style={{color:'white',fontSize:11,fontWeight:700}}>Appel privé avec le surveillant</span>
            <button onClick={leavePrivateCall} style={{marginLeft:'auto',background:'rgba(239,68,68,.85)',color:'white',border:'none',borderRadius:4,padding:'3px 8px',cursor:'pointer',fontSize:10,fontWeight:700}}>
              <i className="fas fa-phone-slash"/> Terminer
            </button>
          </div>
          <video ref={privateTeacherVidRef} autoPlay playsInline
            style={{width:'100%',display:'block',aspectRatio:'4/3',objectFit:'cover',background:'#000'}}/>
          <audio ref={privateTeacherAudRef} autoPlay style={{display:'none'}}/>
          <div style={{padding:'6px 10px',display:'flex',alignItems:'center',gap:6,background:'#1e293b'}}>
            <button onClick={togglePrivateMic}
              style={{background:privateMicOn?'rgba(16,185,129,.5)':'rgba(100,116,139,.2)',color:privateMicOn?'#a7f3d0':'#64748b',border:`1px solid ${privateMicOn?'rgba(16,185,129,.5)':'rgba(100,116,139,.3)'}`,borderRadius:4,padding:'4px 10px',cursor:'pointer',fontSize:10,fontWeight:600}}>
              <i className={`fas fa-microphone${privateMicOn?'':'-slash'}`}/> {privateMicOn?'Micro':'Micro coupé'}
            </button>
          </div>
        </div>

        {/* Modals */}
        {showWarnModal&&<Modal border="#f59e0b" icon="fa-chalkboard-teacher" iconBg="rgba(245,158,11,.1)" iconColor="#f59e0b" title="Avertissement" titleColor="#92400e" msg={warnText} msgColor="#78350f" bold onClose={()=>setShowWarnModal(false)}/>}
        {showMsgModal&&<Modal border="#2563eb" icon="fa-chalkboard-teacher" iconBg="rgba(37,99,235,.12)" iconColor="#2563eb" title="Message de l'Enseignant" titleColor="#1e40af" msg={msgModalText} onClose={()=>setShowMsgModal(false)}/>}
        {showBanModal&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
            <div style={{background:'white',padding:32,borderRadius:16,maxWidth:440,width:'90%',textAlign:'center',boxShadow:'0 20px 40px rgba(0,0,0,.3)'}}>
              <div style={{width:64,height:64,margin:'0 auto 20px',background:'rgba(239,68,68,.1)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,color:'#ef4444'}}><i className="fas fa-ban"/></div>
              <h2 style={{fontSize:20,fontWeight:700,marginBottom:12}}>Session terminée</h2>
              <p style={{fontSize:14,color:'#475569',marginBottom:24,lineHeight:1.5}}>Vous avez été exclu de cet examen.<br/><strong>Votre tentative sera notée 0.</strong></p>
              <button onClick={()=>router.push('/dashboard/student')} style={{padding:'10px 28px',background:'#ef4444',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:14}}>
                <i className="fas fa-arrow-left" style={{marginRight:6}}/>Retourner à l'application
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
  return null
}

/* ── Composants partagés ──────────────────────────────────────────────────── */
function ProgBar({answered,total}:{answered:number;total:number}) {
  return(
    <div style={{marginBottom:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:12,color:'#64748b',fontWeight:600}}><i className="fas fa-tasks"/> Progression globale</span>
        <span style={{fontSize:12,color:'#2563eb',fontWeight:700}}>{answered} / {total} répondu(es)</span>
      </div>
      <div style={{height:7,background:'#e2e8f0',borderRadius:99,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${total?Math.round(answered/total*100):0}%`,background:'#2563eb',borderRadius:99,transition:'width .3s'}}/>
      </div>
    </div>
  )
}

function SecHead({icon,color,bg,tc,title,sub}:{icon:string;color:string;bg:string;tc:string;title:string;sub:string}) {
  return(
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,padding:'12px 16px',background:bg,borderRadius:10,borderLeft:`4px solid ${color}`}}>
      <i className={`fas ${icon}`} style={{color,fontSize:18}}/>
      <div><div style={{fontWeight:700,fontSize:14,color:tc}}>{title}</div><div style={{fontSize:12,color}}>{sub}</div></div>
    </div>
  )
}

function Modal({border,icon,iconBg,iconColor,title,titleColor,msg,msgColor,bold,onClose}:{border:string;icon:string;iconBg:string;iconColor:string;title:string;titleColor:string;msg:string;msgColor?:string;bold?:boolean;onClose:()=>void}) {
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
      <div style={{background:'white',padding:32,borderRadius:16,maxWidth:440,width:'90%',textAlign:'center',borderTop:`4px solid ${border}`,boxShadow:'0 20px 40px rgba(0,0,0,.2)'}}>
        <div style={{width:64,height:64,margin:'0 auto 20px',background:iconBg,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,color:iconColor}}><i className={`fas ${icon}`}/></div>
        <h2 style={{fontSize:20,fontWeight:700,marginBottom:12,color:titleColor}}>{title}</h2>
        <p style={{fontSize:14,color:msgColor||'#475569',marginBottom:24,lineHeight:1.5,fontWeight:bold?600:400}}>{msg}</p>
        <button onClick={onClose} style={{padding:'10px 28px',background:'#2563eb',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:14}}>J'ai compris</button>
      </div>
    </div>
  )
}

/* Question structurée (backend) */
function SQ({q,idx,answers,setAnswers}:{q:Question;idx:number;answers:Record<string,string>;setAnswers:React.Dispatch<React.SetStateAction<Record<string,string>>>}) {
  const isOpen=q.question_type!=='qcm'&&q.question_type!=='vf'
  const answered=(answers[q.id.toString()]??'').trim()!==''
  return(
    <div style={{border:`2px solid ${answered?'#10b981':'#e2e8f0'}`,borderRadius:16,padding:'22px 24px',background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,.05)',marginBottom:16,transition:'border-color .2s'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:16}}>
        <span style={{width:34,height:34,borderRadius:'50%',background:isOpen?'#065f46':'#1e40af',color:'#fff',fontWeight:800,fontSize:15,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{idx+1}</span>
        <div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:'#0f172a',lineHeight:1.5}}>{q.content}</div>{q.points!=null&&<div style={{fontSize:12,color:'#64748b',marginTop:4}}>{q.points} pt{q.points>1?'s':''}</div>}</div>
        <span style={{padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:700,flexShrink:0,background:isOpen?'#ecfdf5':'#eff6ff',color:isOpen?'#065f46':'#1e40af'}}>{isOpen?'Ouvert':q.question_type==='vf'?'V/F':'QCM'}</span>
      </div>
      {q.question_type==='vf'?(
        <div style={{display:'flex',gap:12}}>
          {['Vrai','Faux'].map(opt=>{const sel=answers[q.id.toString()]===opt;const col=opt==='Vrai'?'#10b981':'#ef4444';return(
            <label key={opt} onClick={()=>setAnswers(p=>({...p,[q.id.toString()]:opt}))} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'14px 18px',border:`2px solid ${sel?col:'#e2e8f0'}`,borderRadius:12,background:sel?col+'18':'#fff',flex:1,justifyContent:'center',transition:'all .18s'}}>
              <span style={{width:32,height:32,borderRadius:'50%',background:sel?col:'#f1f5f9',color:sel?'#fff':'#64748b',fontWeight:700,fontSize:14,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{opt[0]}</span>
              <span style={{fontSize:15,color:'#1e293b'}}>{opt}</span>
              {sel&&<i className="fas fa-check-circle" style={{color:col,fontSize:18}}/>}
            </label>
          )})}
        </div>
      ):q.question_type==='qcm'&&q.choices?(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {q.choices.map((ch,ci)=>{
            const letters=['A','B','C','D','E','F'];const colors={A:'#3b82f6',B:'#10b981',C:'#f59e0b',D:'#ef4444',E:'#0891b2',F:'#f97316'} as Record<string,string>
            const letter=letters[ci]??String(ci+1);const col=colors[letter]||'#3b82f6';const sel=answers[q.id.toString()]===ch
            return(
              <label key={ci} onClick={()=>setAnswers(p=>({...p,[q.id.toString()]:ch}))} style={{display:'flex',alignItems:'center',gap:14,cursor:'pointer',padding:'14px 18px',border:`2px solid ${sel?col:'#e2e8f0'}`,borderRadius:12,background:sel?col+'18':'#fff',transition:'all .18s',userSelect:'none'}}>
                <span style={{width:32,height:32,borderRadius:'50%',background:sel?col:'#f1f5f9',color:sel?'#fff':'#64748b',fontWeight:700,fontSize:14,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{letter}</span>
                <span style={{fontSize:15,color:'#1e293b',flex:1,lineHeight:1.5}}>{ch}</span>
                {sel&&<i className="fas fa-check-circle" style={{color:col,fontSize:18,flexShrink:0}}/>}
              </label>
            )
          })}
        </div>
      ):(
        <textarea value={answers[q.id.toString()]??''} onChange={e=>setAnswers(p=>({...p,[q.id.toString()]:e.target.value}))} rows={6} placeholder={`Rédigez votre réponse à la question ${idx+1}…`}
          style={{width:'100%',padding:'12px 14px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:14,fontFamily:'inherit',resize:'vertical',color:'#0f172a',outline:'none',boxSizing:'border-box',lineHeight:1.6}}
          onFocus={e=>{(e.target as HTMLElement).style.borderColor='#3b82f6'}}
          onBlur={e=>{(e.target as HTMLElement).style.borderColor=(answers[q.id.toString()]?.trim()?'#10b981':'#e2e8f0')}}/>
      )}
    </div>
  )
}

/* Question parsée (contenu brut) */
function PQ({block,answers,setAnswers,onAnswer}:{block:ParsedBlock;answers:Record<string,string>;setAnswers:React.Dispatch<React.SetStateAction<Record<string,string>>>;onAnswer?:()=>void}) {
  const isOpen=block.type==='open'||block.type==='subopen'
  const key=`pq_${block.num}`
  const answered=block.type==='subopen'?block.choices?.some(c=>(answers[`${key}_${c.letter}`]??'').trim()!==''):(answers[key]??'').trim()!==''
  return(
    <div style={{border:`2px solid ${answered?'#10b981':'#e2e8f0'}`,borderRadius:16,padding:'22px 24px',background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,.05)',marginBottom:16,transition:'border-color .2s'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:16}}>
        <span style={{width:34,height:34,borderRadius:'50%',background:isOpen?'#065f46':'#1e40af',color:'#fff',fontWeight:800,fontSize:15,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{block.num}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:15,color:'#0f172a',lineHeight:1.5}}>{block.text}</div>
          {block.extraLines&&block.extraLines.filter(l=>l.trim()).length>0&&<div style={{fontSize:14,color:'#475569',marginTop:6}}>{block.extraLines.filter(l=>l.trim()).map((l,i)=><span key={i}>{l}<br/></span>)}</div>}
        </div>
        <span style={{padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:700,flexShrink:0,background:isOpen?'#ecfdf5':'#eff6ff',color:isOpen?'#065f46':'#1e40af'}}>
          {block.type==='vf'?'V/F':block.type==='qcm'?'QCM':block.type==='subopen'?'Structuré':'Ouvert'}
        </span>
      </div>
      {block.type==='vf'&&(
        <div style={{display:'flex',gap:12}}>
          {['Vrai','Faux'].map(opt=>{const sel=answers[key]===opt;const col=opt==='Vrai'?'#10b981':'#ef4444';return(
            <label key={opt} onClick={()=>{setAnswers(p=>({...p,[key]:opt}));onAnswer?.()}} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'14px 18px',border:`2px solid ${sel?col:'#e2e8f0'}`,borderRadius:12,background:sel?col+'18':'#fff',flex:1,justifyContent:'center',transition:'all .18s'}}>
              <span style={{width:32,height:32,borderRadius:'50%',background:sel?col:'#f1f5f9',color:sel?'#fff':'#64748b',fontWeight:700,fontSize:14,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{opt[0]}</span>
              <span style={{fontSize:15,color:'#1e293b'}}>{opt}</span>{sel&&<i className="fas fa-check-circle" style={{color:col,fontSize:18}}/>}
            </label>
          )})}
        </div>
      )}
      {block.type==='qcm'&&block.choices&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {block.choices.map((c,ci)=>{
            const colors={A:'#3b82f6',B:'#10b981',C:'#f59e0b',D:'#ef4444',E:'#0891b2',F:'#f97316'} as Record<string,string>
            const col=colors[c.letter]||'#3b82f6';const sel=answers[key]===c.letter
            return(
              <label key={ci} onClick={()=>{setAnswers(p=>({...p,[key]:c.letter}));onAnswer?.()}} style={{display:'flex',alignItems:'center',gap:14,cursor:'pointer',padding:'14px 18px',border:`2px solid ${sel?col:'#e2e8f0'}`,borderRadius:12,background:sel?col+'18':'#fff',transition:'all .18s',userSelect:'none'}}>
                <span style={{width:32,height:32,borderRadius:'50%',background:sel?col:'#f1f5f9',color:sel?'#fff':'#64748b',fontWeight:700,fontSize:14,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.letter}</span>
                <span style={{fontSize:15,color:'#1e293b',flex:1,lineHeight:1.5}}>{c.text}</span>
                {sel&&<i className="fas fa-check-circle" style={{color:col,fontSize:18,flexShrink:0}}/>}
              </label>
            )
          })}
        </div>
      )}
      {block.type==='open'&&(
        <textarea value={answers[key]??''} onChange={e=>setAnswers(p=>({...p,[key]:e.target.value}))} rows={6} placeholder={`Rédigez votre réponse à la question ${block.num}…`}
          style={{width:'100%',padding:'12px 14px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:14,fontFamily:'inherit',resize:'vertical',color:'#0f172a',outline:'none',boxSizing:'border-box',lineHeight:1.6}}
          onFocus={e=>{(e.target as HTMLElement).style.borderColor='#3b82f6'}}
          onBlur={e=>{(e.target as HTMLElement).style.borderColor=(answers[key]?.trim()?'#10b981':'#e2e8f0')}}/>
      )}
      {block.type==='subopen'&&block.choices&&(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {block.choices.map((c,i)=>{
            const sk=`${key}_${c.letter}`;const sv=answers[sk]??''
            return(
              <div key={i} style={{border:'1.5px solid #d1fae5',borderRadius:10,padding:'14px 16px',background:'#f0fdf4'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
                  <span style={{width:26,height:26,borderRadius:'50%',background:'#bbf7d0',color:'#065f46',fontWeight:700,fontSize:13,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.letter}</span>
                  <span style={{fontSize:14,fontWeight:600,color:'#1e293b',lineHeight:1.5}}>{c.text}</span>
                </div>
                <textarea value={sv} onChange={e=>setAnswers(p=>({...p,[sk]:e.target.value}))} rows={4} placeholder="Rédigez votre réponse ici…"
                  style={{fontSize:14,fontFamily:'inherit',resize:'vertical',borderRadius:8,border:'1.5px solid #86efac',padding:'10px 12px',width:'100%',boxSizing:'border-box',outline:'none',lineHeight:1.6}}
                  onFocus={e=>{(e.target as HTMLElement).style.borderColor='#059669'}}
                  onBlur={e=>{(e.target as HTMLElement).style.borderColor=sv.trim()?'#10b981':'#86efac'}}/>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
