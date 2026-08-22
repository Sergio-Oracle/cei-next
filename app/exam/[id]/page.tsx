'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { initProctoringVision, isProctoringVisionReady, analyzeFace, analyzeObjects, countPeople } from '@/lib/proctoring-vision'
import Calculator from '@/components/exam/Calculator'
import BiometricCallModal from '@/components/exam/BiometricCallModal'
import { loadFaceApi, captureAveragedDescriptor } from '@/lib/faceCapture'
import { isPlatformAuthenticatorAvailable, getAssertion } from '@/lib/webauthnClient'

/* ── Types ────────────────────────────────────────────────────────────────── */
interface ExamData {
  id: number; title: string; instructions?: string; duration_minutes: number
  start_time: string; end_time: string; subject_title?: string
  max_tab_switches?: number; enable_copy_paste?: boolean; enable_right_click?: boolean; enable_file_download?: boolean
  camera_required?: boolean; ban_on_devtools?: boolean; auto_correct?: boolean; enable_calculator?: boolean
  questions_per_page?: number; randomize_questions?: boolean; time_per_question_seconds?: number | null
  status: string; questions?: Question[]
  subject_content?: { id: number; title: string; content: string } | string | null
}
interface Question {
  id: number; content: string; question_type: string; choices?: string[]; points?: number
}
interface Attempt {
  id: number; status: string; started_at: string; extra_minutes?: number; pause_used?: boolean
  answers?: Record<string, string> | string
}
interface ParsedBlock {
  type: 'text' | 'section' | 'qcm' | 'qcm_multi' | 'vf' | 'open' | 'subopen' | 'appariement' | 'code'
  content?: string; title?: string; num?: string; text?: string
  extraLines?: string[]; choices?: { letter: string; text: string }[]
  pairs?: { left: string; right: string }[]
  media?: { type: 'image' | 'audio' | 'video'; filename: string }[]
}
type Phase = 'loading' | 'instructions' | 'permissions' | 'env_scan' | 'exam' | 'submitted' | 'unsupported'
interface ServerPaginated {
  questions_per_page: number
  p1_blocks: ParsedBlock[]; p2_items: ParsedBlock[]
  p1_pages: ParsedBlock[][]; p2_pages: ParsedBlock[][]
}

/* Le partage d'écran complet (obligatoire pour composer) n'est pas disponible sur
   mobile : Android Chrome n'implémente pas getDisplayMedia, et iOS Safari ne peut
   pas fournir une capture "écran entier". Détection par capacité réelle plutôt que
   par user-agent — si un futur navigateur mobile ajoute le support, il sera
   automatiquement accepté. */
function isDeviceSupported(): boolean {
  if (typeof navigator === 'undefined') return true
  return !!(navigator.mediaDevices && typeof (navigator.mediaDevices as any).getDisplayMedia === 'function')
}
type PermStatus = 'pending' | 'loading' | 'ok' | 'error'
declare global { interface Window { LivekitClient: any } }

/* Seuils de luminosité (0-255) en deçà/au-delà desquels la détection faciale
   n'est plus fiable — mêmes bornes utilisées pour l'avertissement étudiant et
   pour disculper une absence de visage détectée par l'IA (voir faceDetectionTick). */
const BRIGHTNESS_LOW = 40, BRIGHTNESS_HIGH = 235

/* Luminosité moyenne (0-255) d'une frame vidéo, échantillonnée 1 pixel sur 10
   (suffisant pour une moyenne stable à faible coût sur une capture 320x240). */
function sampleBrightness(vid: HTMLVideoElement): number | null {
  try {
    const c = document.createElement('canvas'); c.width = 320; c.height = 240
    const ctx = c.getContext('2d'); if (!ctx) return null
    ctx.drawImage(vid, 0, 0, 320, 240)
    const { data } = ctx.getImageData(0, 0, 320, 240)
    let sum = 0, count = 0
    for (let i = 0; i < data.length; i += 40) { sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; count++ }
    return count ? Math.round(sum / count) : null
  } catch { return null }
}

/* Couleur neutre unique pour toute réponse sélectionnée (QCM/QCU/VF) — évite toute
   association implicite type "vert=bonne réponse / rouge=mauvaise" pendant que
   l'étudiant compose, qui n'a rien à voir avec la justesse réelle de son choix. */
const SELECTED_COLOR = '#2563eb'

/* ── Fisher-Yates shuffle ─────────────────────────────────────────────────── */
function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ── Pagination façon Moodle : groupe N questions par page, en gardant les
   en-têtes de section attachés à la page de la question qui les suit ──────── */
function paginateBlocks(blocks: ParsedBlock[], perPage: number): ParsedBlock[][] {
  if (blocks.length === 0) return []
  if (!isFinite(perPage) || perPage <= 0) return [blocks]
  const pages: ParsedBlock[][] = []
  let current: ParsedBlock[] = []
  let qCount = 0
  for (const b of blocks) {
    const isQuestion = b.type !== 'section' && b.type !== 'text'
    // Saut de page forcé à chaque section, façon Moodle (quiz_repaginate_questions
    // force un saut à chaque firstslot de section même si le quota n'est pas atteint)
    if (b.type === 'section' && current.length) { pages.push(current); current = []; qCount = 0 }
    else if (isQuestion && qCount === perPage) { pages.push(current); current = []; qCount = 0 }
    current.push(b)
    if (isQuestion) qCount++
  }
  if (current.length) pages.push(current)
  return pages
}

/* ── Parser contenu brut (porté de l'ancienne plateforme) ─────────────────── */
function parseExamBlocks(raw: string): ParsedBlock[] {
  const VF_RE = /\bvrai\s*[\/|ou]\s*faux\b|\bV\s*[\/|]\s*F\b/i
  const strip = (s: string) => s.trim().replace(/^[*_]{1,2}\s*/,'').replace(/\s*[*_]{1,2}$/,'').trim()
  const Q_RE  = /^(?:(?:Question|Q)\.?\s+)?(\d{1,2})(?!\s*\.\s*\d)(?:\s*[.:)–—-]|\.\s+|\s{2,})\s*(.+)/i
  const TYPE_MARKER = /\[(QCM_MULTI|QCM|VF|OUVERT|SUBOPEN|APPARIEMENT|CODE|OUVERT[ES]*)\]/i
  // Marqueur de niveau de difficulté par question (ex: [Facile]/[Moyen]/[Difficile]) —
  // visible pour l'enseignant dans l'aperçu brut avant publication, mais jamais
  // affiché à l'étudiant pendant l'examen, au même titre que TYPE_MARKER.
  const DIFF_MARKER = /\[(Facile|Moyen|Difficile)\]/i
  const isQ  = (l: string) => Q_RE.test(strip(l))
  const getQ = (l: string) => {
    const m = strip(l).match(Q_RE); if (!m) return null
    const marker = strip(l).match(TYPE_MARKER)
    return { num: m[1], text: strip(m[2]).replace(TYPE_MARKER,'').replace(DIFF_MARKER,'').trim(), markerType: marker ? marker[1].toUpperCase() : null }
  }
  const C_RE = /^(?:\(?([A-Fa-f])\)?)\s*[.):\s-]\s+(.+)/
  const isC  = (l: string) => C_RE.test(strip(l)) && strip(l).length > 3
  const getC = (l: string) => { const m = strip(l).match(C_RE); return m ? { letter: m[1].toUpperCase(), text: strip(m[2]) } : null }
  const PAIR_RE = /^(?:\(?([A-Fa-f])\)?)\s*[.):\s-]\s+(.+?)\s*(?:→|->)\s*(.+)/
  const getPair = (l: string) => { const m = strip(l).match(PAIR_RE); return m ? { left: strip(m[2]), right: strip(m[3]) } : null }
  const isSep  = (l: string) => !l.trim() || /^[-=*─═▬]{3,}$/.test(l.trim())
  // Accepte "Partie 3", "Partie III" ET "Partie — Appariement (5 pts)" /
  // "Partie : QCM" — un en-tête de section n'est pas toujours suivi d'un
  // numéro, parfois d'un simple séparateur puis d'un libellé. Sans ce cas,
  // la ligne se collait aux lignes annexes de la question précédente
  // (garbled overlap constaté : "Vrai / Faux" + "Partie — Appariement…"
  // affichés l'un sur l'autre dans le même bloc de question).
  const isSect = (l: string) => /^(?:Partie|Section|Exercice|Part)\s+(?:[IVX]+\b|\d+\b|[-–—:])/i.test(strip(l)) && !isQ(l)
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
    const isPairMode = q.markerType === 'APPARIEMENT'
    i++
    const extraLines: string[] = []; const choices: { letter: string; text: string }[] = []
    const pairs: { left: string; right: string }[] = []
    while (i < lines.length) {
      if (isSep(lines[i])) { i++; if (choices.length >= 2 || pairs.length >= 2) break; continue }
      if (isSect(lines[i]) && !isQ(lines[i])) break
      if (isQ(lines[i]) && !isC(lines[i])) break
      if (isPairMode) {
        const p = getPair(lines[i])
        if (p) { pairs.push(p); i++ }
        else if (pairs.length === 0) { extraLines.push(lines[i]); i++ }
        else break
        continue
      }
      const c = getC(lines[i])
      if (c) { choices.push(c); i++ }
      else if (choices.length === 0) { extraLines.push(lines[i]); i++ }
      else break
    }
    let type: ParsedBlock['type']
    if (q.markerType) {
      if (q.markerType === 'QCM') type = 'qcm'
      else if (q.markerType === 'QCM_MULTI') type = 'qcm_multi'
      else if (q.markerType === 'VF') type = 'vf'
      else if (q.markerType === 'SUBOPEN') type = 'subopen'
      else if (q.markerType === 'APPARIEMENT') type = 'appariement'
      else if (q.markerType === 'CODE') type = 'code'
      else type = 'open'
    } else {
      const hasPtsChoices = choices.some(c => /\(\s*\d+\s*pts?\s*\)/i.test(c.text))
      const hasInstrVerbs = choices.some(c => INSTR_RE.test(c.text))
      if ((hasPtsChoices || hasInstrVerbs) && choices.length >= 1) type = 'subopen'
      else if (choices.length >= 2) type = 'qcm'
      else if (VF_RE.test(q.text) || VF_RE.test(extraLines.join(' '))) type = 'vf'
      else type = 'open'
    }
    // Extraire les marqueurs [IMAGE:fichier]/[AUDIO:fichier]/[VIDEO:fichier] des
    // lignes annexes (Notes points 2/15, vidéo Retour #7) — ne pas les afficher
    // comme texte brut
    const MEDIA_RE = /^\[(IMAGE|AUDIO|VIDEO):(.+)\]$/i
    const media: { type: 'image' | 'audio' | 'video'; filename: string }[] = []
    const cleanExtraLines = extraLines.filter(l => {
      const m = strip(l).match(MEDIA_RE)
      if (m) { media.push({ type: m[1].toLowerCase() as 'image' | 'audio' | 'video', filename: m[2].trim() }); return false }
      return true
    })
    blocks.push({ type, num: q.num, text: q.text, extraLines: cleanExtraLines, choices, pairs: pairs.length ? pairs : undefined, media: media.length ? media : undefined })
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
  // enterExam() n'est appelé qu'une seule fois et y crée les setInterval du
  // minuteur/autosave — leur callback reste figé sur les valeurs de "answers"
  // telles qu'elles étaient À CE MOMENT (donc vides), même si l'étudiant
  // répond ensuite. Une ref toujours à jour évite ce piège de closure figée :
  // doAutoSave/handleSubmit lisent answersRef.current, jamais answers direct.
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])
  const [parsedBlocks,   setParsedBlocks]   = useState<ParsedBlock[]>([])
  const [mediaMap,       setMediaMap]       = useState<Record<string, string>>({})
  const [shuffledBlocks, setShuffledBlocks] = useState<ParsedBlock[]>([])
  const [shuffledQs,     setShuffledQs]     = useState<Question[]>([])
  // Pagination façon Moodle calculée côté serveur (page + ordre stables pour
  // une même tentative, cf. quiz_slots.page) — repli sur le calcul client
  // (parsedBlocks/shuffledBlocks + paginateBlocks) si l'appel échoue.
  const [serverPages,    setServerPages]    = useState<ServerPaginated | null>(null)
  const [qcmIdx,         setQcmIdx]         = useState(0)   // page courante — Partie 1 (QCM/VF)
  const [p2PageIdx,      setP2PageIdx]      = useState(0)   // page courante — Partie 2 (ouvertes)
  const [showPart2,      setShowPart2]      = useState(false)
  // Minuteur par page pour la Partie 1 (QCM/Vrai-Faux/Appariement) — jamais
  // les questions ouvertes. Distinct du minuteur global de l'examen : se
  // réinitialise à chaque changement de page, avance automatiquement à la
  // page suivante (ou verrouille la Partie 1 sur la dernière page) à
  // expiration, sans exiger que toutes les questions soient répondues.
  const [pageTimeLeft,   setPageTimeLeft]   = useState<number|null>(null)
  const pageTimerRef     = useRef<ReturnType<typeof setInterval>|null>(null)
  const [phase,        setPhase]        = useState<Phase>('loading')
  const [timeLeft,     setTimeLeft]     = useState(0)
  const [tabCount,     setTabCount]     = useState(0)
  const [riskScore,    setRiskScore]    = useState(0)
  const [focusLost,    setFocusLost]    = useState(false)
  const [networkOffline, setNetworkOffline] = useState(false)
  /* Adaptation à une connexion faible : la surveillance (vidéo continue,
     captures, analyses IA) ne doit jamais faire perdre à l'étudiant la
     bande passante dont il a besoin pour simplement composer/enregistrer
     ses réponses. Surveillé en continu (pas juste une fois au moment des
     permissions) via l'API Network Information, avec repli si absente
     (Firefox/Safari) sur le comportement normal. */
  const [networkQuality, setNetworkQuality] = useState<'good'|'poor'>('good')
  const networkQualityRef = useRef<'good'|'poor'>('good')
  const saveBackoffRef = useRef(0)
  const saveRetryTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const submitRetryTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const mainCamTrackRef = useRef<any>(null)
  const mainScreenTrackRef = useRef<any>(null)

  /* ── Surveillance renforcée par vision par ordinateur (MediaPipe) ────────
     Phase 1 : scan environnement 360° avant l'examen. */
  const [envScanStatus, setEnvScanStatus] = useState<'idle'|'loading_ai'|'scanning'|'blocked'|'ok'|'degraded'>('idle')
  const [envScanProgress, setEnvScanProgress] = useState(0)
  const [envScanMaxPeople, setEnvScanMaxPeople] = useState(0)
  // Objets suspects vus pendant le scan d'environnement — jusqu'ici le scan
  // ne comptait QUE les personnes (countPeople), jamais les objets
  // (analyzeObjects), alors que c'est le moment idéal (caméra balayée sur
  // toute la pièce) pour les repérer. Informatif seulement (pas de blocage,
  // comme pour la détection en cours d'examen) : un livre sur une étagère
  // lointaine, par exemple, n'est pas en soi une preuve de fraude.
  const [envScanObjects, setEnvScanObjects] = useState<string[]>([])
  const scanVideoRef = useRef<HTMLVideoElement|null>(null)
  /* Phase 7 : contrôle de vivacité à la capture de référence faciale. */
  const [livenessStatus, setLivenessStatus] = useState<'idle'|'waiting_blink'|'ok'>('idle')
  const [alerts,       setAlerts]       = useState<{type:string;msg:string;at:string}[]>([])
  const [lastSaved,    setLastSaved]    = useState<Date|null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  /* Relecture des réponses — obligatoire avant de pouvoir soumettre : le
     bouton "Soumettre" ouvre d'abord cet écran de relecture. */
  const [showReview, setShowReview] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [msgText,      setMsgText]      = useState('')
  const [msgSent,      setMsgSent]      = useState<{text:string;time:string}[]>([])
  const [camOn,        setCamOn]        = useState(false)
  const [micOn,        setMicOn]        = useState(false)
  const [screenOn,     setScreenOn]     = useState(false)
  const [faceStatus,   setFaceStatus]   = useState<'init'|'ok'|'warn'|'bad'>('init')
  const [faceIssue,    setFaceIssue]    = useState<'none'|'no_face'|'multiple'|'mismatch'>('none')
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
  /* Code de reprise — exigé quand une tentative IN_PROGRESS existe déjà et
     que l'étudiant revient sur la page (déconnexion réelle, pas un simple
     blip réseau qui laisse l'onglet ouvert). Généré automatiquement côté
     backend et renvoyé directement dans la réponse 403 (voir doStartExam) —
     self-service, plus besoin d'appeler le surveillant au préalable. */
  const [codeRequired,   setCodeRequired]   = useState(false)
  const [accessCode,     setAccessCode]     = useState('')
  const [pastedCode,     setPastedCode]     = useState('')
  const [submittingCode, setSubmittingCode] = useState(false)
  /* Vérification biométrique — exigée à chaque accès à l'examen (nouvelle
     tentative ET reprise), obligatoire pour tous les examens. La preuve est
     un flag Redis à usage unique posé par /api/biometric/verify/* et
     consommé par start_exam_attempt (voir doStartExam). Après quelques
     échecs de reconnaissance faciale, repli sur BiometricCallModal. */
  const [biometricRequired, setBiometricRequired] = useState(false)
  const [bioMethod,         setBioMethod]         = useState<'face'|'webauthn'|null>(null)
  const [bioBusy,           setBioBusy]           = useState(false)
  const [bioFailCount,      setBioFailCount]      = useState(0)
  const [bioStatusMsg,      setBioStatusMsg]      = useState('')
  const [showBiometricCall, setShowBiometricCall] = useState(false)
  const bioVideoRef = useRef<HTMLVideoElement|null>(null)
  const bioStreamRef = useRef<MediaStream|null>(null)
  const [permCam,      setPermCam]      = useState<PermStatus>('pending')
  const [permMic,      setPermMic]      = useState<PermStatus>('pending')
  const [permScreen,   setPermScreen]   = useState<PermStatus>('pending')
  const [permError,    setPermError]    = useState('')
  const [permBusy,     setPermBusy]     = useState(false)

  const timerRef        = useRef<ReturnType<typeof setInterval>|null>(null)
  const saveRef         = useRef<ReturnType<typeof setInterval>|null>(null)
  const saveFailedRef   = useRef(false)
  const msgPollRef      = useRef<ReturnType<typeof setInterval>|null>(null)
  const extraPollRef    = useRef<ReturnType<typeof setInterval>|null>(null)
  const multiScreenIntervalRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const heartbeatRef    = useRef<ReturnType<typeof setInterval>|null>(null)
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
  // Période de grâce anti-fraude au tout début de l'examen : requestFullscreen()
  // est asynchrone (enterExam) mais le montage des écouteurs blur/visibilitychange
  // /fullscreenchange est immédiat — la transition plein écran elle-même
  // déclenche parfois un évènement de perte de focus transitoire côté
  // navigateur, faussement compté comme une vraie sortie d'examen (retour
  // utilisateur du 22/08 : "on ne fait rien mais on voit perte de focus").
  const examEnterTimeRef = useRef(0)
  const IGNORE_FOCUS_EVENTS_MS = 3000
  // Filet de sécurité PWA/standalone : les événements fullscreenchange/blur
  // ne sont pas garantis de se déclencher de façon fiable dans une fenêtre
  // d'app installée (pas d'onglet à quitter, comportement plein écran /
  // focus différent selon plateforme) — ces refs empêchent la détection
  // périodique ci-dessous de re-signaler en boucle tant que l'étudiant n'a
  // pas cliqué "Revenir à l'examen", sans dépendre uniquement des events.
  const fsPollGuardRef    = useRef(false)
  const focusPollGuardRef = useRef(false)
  const extraMinRef     = useRef(0)
  /* Pause self-service de 3 min — breakActiveRef gate toute la surveillance
     pendant la pause (patron sessionEndedRef, mais réversible). resumeAt
     pilote le compte à rebours de l'overlay ; pauseUsedRef empêche une
     deuxième pause côté client (le serveur refuse aussi, filet de sécurité). */
  const breakActiveRef  = useRef(false)
  const [onBreak,       setOnBreak]       = useState(false)
  const [breakResumeAt, setBreakResumeAt] = useState<number|null>(null)
  const pauseUsedRef    = useRef(false)
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(0)

  // Compte à rebours de la pause self-service — reprend automatiquement
  // l'examen à l'échéance (calculée côté serveur, resume_at), ou plus tôt si
  // l'étudiant clique "Reprendre maintenant" (endBreak, gère aussi ce cas).
  useEffect(() => {
    if (!onBreak || !breakResumeAt) return
    const tick = () => {
      const left = Math.max(0, Math.round((breakResumeAt - Date.now()) / 1000))
      setBreakSecondsLeft(left)
      if (left <= 0) endBreak()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [onBreak, breakResumeAt]) // eslint-disable-line
  const lastSnapRef     = useRef(0)
  const lastLightWarnRef = useRef(0)
  /* Compteurs de vérifications consécutives — même logique que le reste de
     l'anti-fraude (CONSEC_ALERT) : n'alerter que sur une déviation soutenue,
     pas un mouvement bref et normal. */
  const consGazeAwayRef  = useRef(0)
  const consHeadTurnRef  = useRef(0)
  const consMouthRef     = useRef(0)
  const lastVisionAlertRef = useRef<Record<string, number>>({})
  /* Étalonnage individuel du regard/de l'orientation de la tête, mesuré
     pendant la capture de la photo de référence (l'étudiant regarde déjà la
     caméra à ce moment). MediaPipe ne peut pas détecter "porte des lunettes"
     directement (pas de classe dédiée) — mais les reflets/déformations des
     verres provoquent un bruit de mesure mesurable sur la position de
     l'iris, propre à chaque étudiant. Comparer à SON écart-type plutôt qu'à
     un seuil fixe absorbe ce bruit (lunettes, strabisme léger, etc.) sans
     perdre en sensibilité sur un vrai détournement du regard, qui reste une
     déviation large et soutenue même après cette marge personnalisée. */
  const gazeBaselineRef = useRef<{ x: number; y: number; spreadX: number; spreadY: number; yaw: number; spreadYaw: number } | null>(null)
  // Exige le MÊME type d'objet sur 2 vérifications consécutives (~5-10s,
  // à chaque tick) avant d'alerter — un objet réellement présent (téléphone,
  // livre, écran) reste visible sur la durée ; une image isolée mal
  // classifiée (reflet, objet du décor confondu un instant) ne se répète pas.
  const consObjectRef = useRef<{ what: string | null; count: number }>({ what: null, count: 0 })
  /* Phase 6 — détection audio légère (énergie RMS du signal, pas de
     transcription : plus respectueux de la vie privée et bien moins coûteux
     qu'une reconnaissance vocale continue). */
  const audioAnalyserRef = useRef<AnalyserNode|null>(null)
  const audioCtxRef = useRef<AudioContext|null>(null)
  const consAudioRef = useRef(0)
  const faceIntervalRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const lastFaceAlertRef= useRef<{no_face:number;multiple:number;mismatch:number}>({no_face:0,multiple:0,mismatch:0})
  const consNoFaceRef   = useRef(0)
  const consMultiRef    = useRef(0)
  const consMismatchRef = useRef(0)
  const refDescRef      = useRef<Float32Array|null>(null)

  /* ── Chargement ───────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false
    async function load(attempt = 0) {
      try {
        const res = await api.get<ExamData>(`/api/online_exams/${id}/details`)
        if (cancelled) return
        setExam(res); examRef.current = res
        setPhase(isDeviceSupported() ? 'instructions' : 'unsupported')
      } catch (e: any) {
        if (cancelled) return
        // Retour #13 — ne pas rebondir systématiquement vers "Mes Notes" sur
        // une erreur transitoire (ex: course avec le rafraîchissement du
        // token juste après une actualisation) ; ne rediriger que sur un
        // refus d'accès confirmé par le serveur, ou après un second essai.
        const accessDenied = e.status === 403 || e.status === 404
        if (!accessDenied && attempt === 0) {
          setTimeout(() => { if (!cancelled) load(1) }, 1200)
          return
        }
        toastErr(e.message || 'Erreur chargement')
        router.push('/dashboard/student')
      }
    }
    load()
    return () => { cancelled = true }
  }, [id]) // eslint-disable-line

  /* ── Médias insérés dans le sujet (images/audio) — Notes points 2/15 ───── */
  useEffect(() => {
    const subjectId = exam?.subject_content && typeof exam.subject_content === 'object' ? exam.subject_content.id : null
    if (!subjectId) return
    api.get<{ filename: string; url: string }[]>(`/api/subjects/${subjectId}/media`)
      .then(rows => setMediaMap(Object.fromEntries(rows.filter(r => r.url).map(r => [r.filename, r.url]))))
      .catch(() => {})
  }, [exam])

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

  /* ── Mélange aléatoire des questions au démarrage de l'examen ───────── */
  useEffect(() => {
    if (phase !== 'exam') return
    if (!exam?.randomize_questions) return // respecter le réglage professeur (désactivé par défaut)
    // Parsed blocks — mélanger les QCM (ordre + choix), garder les questions ouvertes en place
    if (parsedBlocks.length > 0) {
      const isP1 = (b: ParsedBlock) => b.type === 'qcm' || b.type === 'qcm_multi' || b.type === 'vf' || b.type === 'appariement'
      const qcmBlocks  = fisherYates(parsedBlocks.filter(isP1))
        .map(b => (b.type === 'qcm' || b.type === 'qcm_multi') && b.choices ? { ...b, choices: fisherYates(b.choices) } : b)
      const openBlocks = parsedBlocks.filter(b => !isP1(b))
      setShuffledBlocks([...qcmBlocks, ...openBlocks])
    }
    // Questions structurées — mélanger QCM séparément des ouvertes, mélanger les choix QCM
    const qs = exam?.questions ?? []
    if (qs.length > 0) {
      const qcm  = fisherYates(qs.filter(q => q.question_type === 'qcm' || q.question_type === 'vf'))
        .map(q => ({ ...q, choices: q.choices ? fisherYates(q.choices) : q.choices }))
      const open = fisherYates(qs.filter(q => q.question_type !== 'qcm' && q.question_type !== 'vf'))
      setShuffledQs([...qcm, ...open])
    }
  }, [phase]) // eslint-disable-line

  /* ── Pagination façon Moodle calculée côté serveur ───────────────────── */
  useEffect(() => {
    if (phase !== 'exam') return
    const attId = attemptRef.current
    if (!attId) return
    api.get<ServerPaginated>(`/api/exam_attempts/${attId}/paginated`)
      .then(setServerPages)
      .catch(() => {}) // repli silencieux sur le calcul client (parsedBlocks + paginateBlocks)
  }, [phase])

  /* ── Reprise après déconnexion : atterrir sur la première page non
     terminée plutôt que de tout recommencer depuis la page 1 — les réponses
     déjà données (answers) étaient déjà restaurées, mais l'index de page
     revenait toujours à 0, forçant l'étudiant à recliquer sur tout ce qu'il
     avait déjà fait (perte de temps, et paradoxalement une occasion de plus
     de revoir/modifier une partie déjà verrouillée en repassant par "Suiv."). */
  const jumpedToUnansweredRef = useRef(false)
  useEffect(() => {
    if (phase !== 'exam' || jumpedToUnansweredRef.current) return
    // Laisser un court délai pour que la pagination serveur arrive (sinon
    // repli sur le calcul client, déjà disponible synchroniquement).
    const t = setTimeout(() => {
      if (jumpedToUnansweredRef.current) return
      jumpedToUnansweredRef.current = true
      if (!exam) return
      const displayBlocks = shuffledBlocks.length > 0 ? shuffledBlocks : parsedBlocks
      const structuredQs  = shuffledQs.length > 0 ? shuffledQs : (exam.questions ?? [])
      if (structuredQs.length > 0 || displayBlocks.length === 0) return // pas de pagination dans ce cas

      const p1Blocks = serverPages?.p1_blocks ?? displayBlocks.filter(b => b.type==='qcm'||b.type==='qcm_multi'||b.type==='vf'||b.type==='appariement')
      const p2Items  = serverPages?.p2_items  ?? displayBlocks.filter(b => b.type==='section'||b.type==='open'||b.type==='subopen'||b.type==='code')
      const perPage  = exam.questions_per_page && exam.questions_per_page > 0 ? exam.questions_per_page : Infinity
      const p1Pages  = serverPages?.p1_pages ?? paginateBlocks(p1Blocks, perPage)
      const p2Pages  = serverPages?.p2_pages ?? paginateBlocks(p2Items, perPage)

      function isAnswered(b: ParsedBlock) {
        if (b.type === 'subopen') return b.choices?.some(c => (answers[`pq_${b.num}_${c.letter}`] ?? '').trim() !== '') ?? false
        if (b.type === 'appariement') return b.pairs?.every((_, i) => (answers[`pq_${b.num}_${i}`] ?? '').trim() !== '') ?? false
        return (answers[`pq_${b.num}`] ?? '').trim() !== ''
      }

      if (!showPart2) {
        const idx = p1Pages.findIndex(page => page.some(b => !isAnswered(b)))
        if (idx > 0) setQcmIdx(idx)
      } else {
        const idx = p2Pages.findIndex(page => page.some(b => b.type !== 'section' && !isAnswered(b)))
        if (idx > 0) setP2PageIdx(idx)
      }
    }, 900)
    return () => clearTimeout(t)
  }, [phase]) // eslint-disable-line

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
    ;[timerRef,saveRef,msgPollRef,extraPollRef,faceIntervalRef].forEach(r => { if (r.current) clearInterval(r.current) })
    ;[saveRetryTimerRef,submitRetryTimerRef].forEach(r => { if (r.current) clearTimeout(r.current) })
    camStream.current?.getTracks().forEach(t => t.stop())
    screenStream.current?.getTracks().forEach(t => t.stop())
    if (lkRoomRef.current) { try { lkRoomRef.current.disconnect() } catch {} }
  }, [])

  /* ── Anti-fraude ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'exam') return
    const onVis = async () => {
      if (breakActiveRef.current) return
      if (Date.now()-examEnterTimeRef.current<IGNORE_FOCUS_EVENTS_MS) return
      if (!document.hidden) return
      const next = tabCount + 1; setTabCount(next)
      setRiskScore(r => Math.min(r + 10, 100))
      setAlerts(a => [{type:'tab',msg:`Changement d'onglet (${next})`,at:new Date().toLocaleTimeString('fr-FR')},...a])
      warning(`Attention : changement d'onglet détecté (${next}/${examRef.current?.max_tab_switches??3})`)
      setFocusLost(true)
      const aId = attemptRef.current
      if (aId) {
        // Le serveur décide seul de bannir ou non (selon auto_ban_enabled) —
        // on ne force plus jamais la soumission côté client sur un simple
        // compteur local : ça bannissait même quand le prof n'avait rien activé.
        try { await logActivity(aId,'tab_switch',`Changement onglet ${next}`) } catch {}
        try { await logProctoring(aId,'tab_switch',`Changement onglet ${next}`) } catch {}
      }
    }
    const onBlur = async () => {
      // Filet de sécurité pour un basculement trop rapide (bascule OS,
      // fenêtre partiellement recouverte) : visibilitychange ne se déclenche
      // pas toujours dans ces cas alors que le focus de la fenêtre, lui,
      // est perdu immédiatement. Le backend reconnaît déjà 'window_blur'
      // dans ses seuils (severity_tab_events) — seul l'envoi manquait ici.
      if (sessionEndedRef.current || breakActiveRef.current) return
      if (Date.now()-examEnterTimeRef.current<IGNORE_FOCUS_EVENTS_MS) return
      const next = tabCount + 1; setTabCount(next)
      setRiskScore(r => Math.min(r + 10, 100))
      setAlerts(a => [{type:'blur',msg:`Perte de focus détectée (${next})`,at:new Date().toLocaleTimeString('fr-FR')},...a])
      warning(`Attention : perte de focus détectée (${next}/${examRef.current?.max_tab_switches??3})`)
      setFocusLost(true)
      const aId = attemptRef.current
      if (aId) {
        try { await logActivity(aId,'window_blur','Perte de focus fenêtre') } catch {}
        try { await logProctoring(aId,'window_blur','Perte de focus fenêtre') } catch {}
      }
    }
    const noCtx  = (e:MouseEvent)     => { if (!examRef.current?.enable_right_click) e.preventDefault() }
    const noCopy = (e:ClipboardEvent) => { if (!examRef.current?.enable_copy_paste) { e.preventDefault(); warning('Copier/coller désactivé') } }
    const noKey  = (e:KeyboardEvent)  => {
      if (breakActiveRef.current) return
      if (e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['I','J','C'].includes(e.key))||(e.ctrlKey&&e.key==='u')) {
        e.preventDefault()
        const aId = attemptRef.current
        if (aId) { logActivity(aId,'devtools_attempt','Tentative outils dev').catch(()=>{}); logProctoring(aId,'devtools_attempt','Tentative outils dev').catch(()=>{}) }
        setAlerts(a => [{type:'devtools',msg:'Accès outils développeur bloqué',at:new Date().toLocaleTimeString('fr-FR')},...a])
      }
    }
    const onFs = () => {
      if (breakActiveRef.current) return
      if (Date.now()-examEnterTimeRef.current<IGNORE_FOCUS_EVENTS_MS) return
      if (!document.fullscreenElement && !sessionEndedRef.current) {
        if (fsPollGuardRef.current) return // déjà signalé, en attente du clic "Revenir à l'examen"
        fsPollGuardRef.current = true
        setRiskScore(r => Math.min(r + 10, 100))
        setFocusLost(true)
        const aId = attemptRef.current
        if (aId) {
          logActivity(aId,'fullscreen_exit','Plein écran quitté').catch(()=>{})
          // Manquait auparavant : seul tab_switch alimentait le score de
          // risque, une sortie de plein écran ne comptait pas dessus.
          logProctoring(aId,'fullscreen_exit','Plein écran quitté').catch(()=>{})
        }
        setAlerts(a => [{type:'fs',msg:'Plein écran quitté',at:new Date().toLocaleTimeString('fr-FR')},...a])
      } else if (document.fullscreenElement) {
        fsPollGuardRef.current = false
      }
    }
    // Filet de sécurité — une PWA installée (fenêtre autonome, sans onglet)
    // ne déclenche pas toujours fullscreenchange/blur de façon fiable selon
    // le navigateur/OS (constaté : élèves en PWA échappant à la détection
    // alors que le même examen dans un onglet de navigateur normal est bien
    // surveillé). Contrairement aux events ci-dessus qui ne réagissent qu'à
    // un CHANGEMENT d'état, ce sondage vérifie l'état RÉEL toutes les 4s —
    // il détecte donc aussi le cas où le plein écran n'a jamais été atteint
    // du tout (échec silencieux de requestFullscreen), pas seulement une
    // sortie après coup.
    const pollState = () => {
      if (sessionEndedRef.current || breakActiveRef.current) return
      if (Date.now()-examEnterTimeRef.current<IGNORE_FOCUS_EVENTS_MS) return
      onFs()
      if (!document.hasFocus()) {
        if (focusPollGuardRef.current) return
        focusPollGuardRef.current = true
        const next = tabCount + 1; setTabCount(next)
        setRiskScore(r => Math.min(r + 10, 100))
        setAlerts(a => [{type:'blur',msg:`Perte de focus détectée (${next})`,at:new Date().toLocaleTimeString('fr-FR')},...a])
        warning(`Attention : perte de focus détectée (${next}/${examRef.current?.max_tab_switches??3})`)
        setFocusLost(true)
        const aId = attemptRef.current
        if (aId) {
          logActivity(aId,'window_blur','Perte de focus fenêtre (détection périodique)').catch(()=>{})
          logProctoring(aId,'window_blur','Perte de focus fenêtre (détection périodique)').catch(()=>{})
        }
      } else {
        focusPollGuardRef.current = false
      }
    }
    const pollTimer = setInterval(pollState, 4000)
    // Dissuasion à la fermeture d'onglet/navigation — c'est la limite dure du
    // navigateur : AUCUN site web ne peut techniquement empêcher un onglet de
    // se fermer (restriction de sécurité volontaire, valable pour Chrome,
    // Firefox, Safari, Edge — sinon un site malveillant pourrait piéger un
    // visiteur). Le seul mécanisme que le web autorise est cette boîte de
    // dialogue native, non stylable et non contournable par le site, que le
    // navigateur affiche lui-même et que l'étudiant peut toujours choisir de
    // confirmer pour partir quand même. La dissuasion réelle contre une sortie
    // volontaire reste donc procédurale : détection (tab_switch/window_blur/
    // fullscreen_exit ci-dessus) + comptage des violations + bannissement
    // selon le seuil fixé par l'enseignant — pas un verrou technique.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionEndedRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    // Retour DFIP #10 — "mouvement brusque" : si l'étudiant confirme la
    // fermeture malgré l'avertissement ci-dessus (ou ferme trop vite pour
    // qu'un fetch() normal aboutisse — Alt+F4, fermeture de la fenêtre),
    // pagehide est le signal le plus fiable qu'une page est réellement en
    // train de se décharger. L'appel passe par postBeacon (fetch keepalive)
    // plutôt que logActivity/logProctoring habituels : une requête fetch()
    // normale est annulée par le navigateur au déchargement de page, donc le
    // signal serait silencieusement perdu sans ce canal dédié.
    const onPageHide = () => {
      if (sessionEndedRef.current) return
      const aId = attemptRef.current
      if (!aId) return
      api.postBeacon(`/api/exam_attempts/${aId}/log_activity`,{event_type:'tab_closed',event_data:'Page fermée/quittée pendant la composition'})
      api.postBeacon(`/api/exam_attempts/${aId}/proctoring_event`,{event_type:'tab_closed',event_data:'Page fermée/quittée pendant la composition'})
    }
    document.addEventListener('visibilitychange',onVis); document.addEventListener('contextmenu',noCtx)
    document.addEventListener('copy',noCopy); document.addEventListener('paste',noCopy)
    document.addEventListener('keydown',noKey); document.addEventListener('fullscreenchange',onFs)
    window.addEventListener('blur',onBlur); window.addEventListener('beforeunload',onBeforeUnload)
    window.addEventListener('pagehide',onPageHide)
    return () => {
      document.removeEventListener('visibilitychange',onVis); document.removeEventListener('contextmenu',noCtx)
      document.removeEventListener('copy',noCopy); document.removeEventListener('paste',noCopy)
      document.removeEventListener('keydown',noKey); document.removeEventListener('fullscreenchange',onFs)
      window.removeEventListener('blur',onBlur); window.removeEventListener('beforeunload',onBeforeUnload)
      window.removeEventListener('pagehide',onPageHide)
      clearInterval(pollTimer)
    }
  }, [phase,tabCount]) // eslint-disable-line

  /* ── Connectivité réseau ──────────────────────────────────────────────────
     Signalement informatif (jamais compté comme suspect — une coupure
     réseau n'est pas une tentative de fraude) : bannière rassurante côté
     étudiant, log pour que le professeur voie qu'une éventuelle alerte
     concomitante peut avoir une cause réseau plutôt qu'une triche, et
     relance immédiate de la sauvegarde dès le retour de connexion plutôt
     que d'attendre le prochain cycle de 30s. */
  useEffect(() => {
    if (phase !== 'exam') return
    const onOffline = () => {
      setNetworkOffline(true)
      const aId = attemptRef.current
      if (aId) logActivity(aId,'network_disconnected','Connexion réseau perdue').catch(()=>{})
    }
    const onOnline = () => {
      setNetworkOffline(false)
      const aId = attemptRef.current
      if (aId) {
        logActivity(aId,'network_reconnected','Connexion réseau rétablie').catch(()=>{})
        doAutoSave(aId)
      }
    }
    if (!navigator.onLine) onOffline()
    window.addEventListener('offline',onOffline)
    window.addEventListener('online',onOnline)
    return () => {
      window.removeEventListener('offline',onOffline)
      window.removeEventListener('online',onOnline)
    }
  }, [phase]) // eslint-disable-line

  /* Sauvegarde locale (localStorage) en complément de l'auto-save serveur —
     si la connexion tombe assez longtemps pour qu'aucune sauvegarde serveur
     n'aboutisse ET que l'onglet se ferme/plante dans cet intervalle, ce
     brouillon local reste le seul filet de récupération. Restauré et fusionné
     au retour dans doStartExam/submitAccessCode (voir restoreAnswersWithLocalDraft). */
  useEffect(() => {
    const aId = attemptRef.current
    if (!aId || phase !== 'exam') return
    const t = setTimeout(() => {
      try { localStorage.setItem(`cei_exam_draft_${aId}`, JSON.stringify({ answers: answersRef.current, ts: Date.now() })) } catch {}
    }, 1000)
    return () => clearTimeout(t)
  }, [answers, phase])

  /* Surveillance CONTINUE (pas juste au moment des permissions) de la
     qualité réseau — dès qu'elle se dégrade, on réduit la charge que la
     plateforme fait elle-même peser sur la bande passante de l'étudiant
     (vidéo de surveillance, captures) pour ne jamais entraver sa capacité
     à simplement enregistrer/soumettre ses réponses, qui reste toujours
     prioritaire sur la fidélité de la surveillance. */
  useEffect(() => {
    if (phase !== 'exam') return
    const conn = (navigator as any).connection
    if (!conn) return // API absente (Firefox/Safari) — comportement normal, pas de dégradation possible à détecter
    function evaluate() {
      const poor = conn.downlink < 0.5 || ['slow-2g','2g'].includes(conn.effectiveType) || !!conn.saveData
      const next: 'good'|'poor' = poor ? 'poor' : 'good'
      if (next === networkQualityRef.current) return
      networkQualityRef.current = next
      setNetworkQuality(next)
      const aId = attemptRef.current
      if (next === 'poor') {
        warning('Connexion lente détectée — qualité vidéo réduite pour préserver votre bande passante')
        if (aId) logActivity(aId,'low_bandwidth_mode','Mode basse bande passante activé').catch(()=>{})
      } else if (aId) {
        logActivity(aId,'low_bandwidth_mode_ended','Connexion redevenue correcte — qualité normale rétablie').catch(()=>{})
      }
      applyBandwidthMode()
    }
    evaluate()
    conn.addEventListener?.('change', evaluate)
    return () => conn.removeEventListener?.('change', evaluate)
  }, [phase]) // eslint-disable-line

  /* ── Démarrer ─────────────────────────────────────────────────────────── */
  /* Restaure les réponses serveur puis fusionne un éventuel brouillon local
     plus récent (localStorage) — protège contre le cas où la dernière
     sauvegarde serveur a échoué (coupure réseau) et où l'onglet a ensuite
     été fermé/a planté avant de pouvoir réessayer : sans ce filet, ces
     réponses seraient silencieusement perdues à la reprise. Le brouillon
     local est toujours prioritaire (il reflète la frappe la plus récente),
     et une sauvegarde est immédiatement retentée pour que le serveur
     rattrape l'écart dès que possible. */
  function restoreAnswersWithLocalDraft(attemptId:number, rawAnswers:any) {
    let serverAnswers:Record<string,string> = {}
    try { const p = typeof rawAnswers==='string'?JSON.parse(rawAnswers):rawAnswers; serverAnswers = p||{} } catch {}
    let merged = serverAnswers
    try {
      const draft = localStorage.getItem(`cei_exam_draft_${attemptId}`)
      if (draft) {
        const { answers: localAnswers } = JSON.parse(draft)
        if (localAnswers && typeof localAnswers==='object') {
          merged = { ...serverAnswers, ...localAnswers }
          if (JSON.stringify(merged)!==JSON.stringify(serverAnswers)) {
            setTimeout(()=>doAutoSave(attemptId), 500)
          }
        }
      }
    } catch {}
    setAnswers(merged)
    if (merged.__qcm_locked==='1') setShowPart2(true)
  }

  async function doStartExam() {
    setStarting(true)
    try {
      const res = await api.post<{attempt:Attempt}>(`/api/online_exams/${id}/start`,{})
      const att=res.attempt; setAttempt(att); attemptRef.current=att.id
      extraMinRef.current=att.extra_minutes??0
      if (att.answers) restoreAnswersWithLocalDraft(att.id, att.answers)
      setPhase('permissions')
    } catch (e:any) {
      if (e?.data?.biometric_required) {
        if (e.data.enrolled === false) { router.push(`/biometric-enroll?redirect=/exam/${id}`); return }
        setBiometricRequired(true)
        initBiometricCheck()
      } else if (e?.data?.code_required) {
        setCodeRequired(true)
        if (e.data.code) setAccessCode(e.data.code)
      } else toastErr(e.message||"Impossible de démarrer l'examen")
    }
    finally { setStarting(false) }
  }

  /* ── Vérification biométrique ───────────────────────────────────────── */
  async function initBiometricCheck() {
    try {
      const st = await api.get<{method:'face'|'webauthn'|null}>('/api/biometric/status')
      setBioMethod(st.method)
      if (st.method === 'face') {
        setBioStatusMsg('Ouverture de la caméra…')
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } })
        bioStreamRef.current = stream
        if (bioVideoRef.current) { bioVideoRef.current.srcObject = stream; await bioVideoRef.current.play().catch(()=>{}) }
        setBioStatusMsg('Chargement du modèle de reconnaissance…')
        await loadFaceApi()
        setBioStatusMsg('Regardez la caméra pour être identifié')
      }
    } catch (e:any) {
      toastErr(e.message || 'Impossible de préparer la vérification')
    }
  }

  function stopBiometricCamera() {
    bioStreamRef.current?.getTracks().forEach(t=>t.stop())
    bioStreamRef.current = null
  }

  async function onBiometricFailure() {
    const next = bioFailCount + 1
    setBioFailCount(next)
    if (next >= 3) {
      stopBiometricCamera()
      setShowBiometricCall(true)
    } else {
      toastErr(`Non reconnu — nouvelle tentative (${next}/3)`)
    }
  }

  async function verifyFaceAndResume() {
    if (!bioVideoRef.current) return
    setBioBusy(true)
    try {
      const result = await captureAveragedDescriptor(bioVideoRef.current)
      if (!result) { toastErr('Aucun visage détecté — repositionnez-vous face à la caméra'); setBioBusy(false); return }
      const res = await api.post<{match:boolean}>('/api/biometric/verify/face', { descriptor: result.descriptor })
      if (res.match) {
        stopBiometricCamera()
        setBiometricRequired(false)
        setBioFailCount(0)
        await doStartExam()
      } else {
        await onBiometricFailure()
      }
    } catch (e:any) {
      toastErr(e.message || 'Échec de la vérification')
    } finally {
      setBioBusy(false)
    }
  }

  async function verifyWebauthnAndResume() {
    setBioBusy(true)
    try {
      const options = await api.post<any>('/api/biometric/verify/webauthn/options')
      const credential = await getAssertion(options)
      const res = await api.post<{match:boolean}>('/api/biometric/verify/webauthn/verify', { credential })
      if (res.match) {
        setBiometricRequired(false)
        setBioFailCount(0)
        await doStartExam()
      } else {
        await onBiometricFailure()
      }
    } catch (e:any) {
      toastErr(e.message || "Échec de la vérification — l'authentification a peut-être été annulée")
      await onBiometricFailure()
    } finally {
      setBioBusy(false)
    }
  }

  // Le surveillant/superviseur/professeur valide manuellement l'identité pendant
  // l'appel (BiometricCallModal) → le flag Redis est posé côté serveur ; on
  // retente périodiquement doStartExam() pour détecter cette validation.
  useEffect(() => {
    if (!showBiometricCall) return
    const interval = setInterval(() => { doStartExam() }, 5000)
    return () => clearInterval(interval)
  }, [showBiometricCall]) // eslint-disable-line

  useEffect(() => {
    if (attempt) { setShowBiometricCall(false); setBiometricRequired(false) }
  }, [attempt])

  async function submitAccessCode() {
    if (!pastedCode.trim()) { toastErr('Collez le code affiché ci-dessus.'); return }
    setSubmittingCode(true)
    try {
      const res = await api.post<{attempt:Attempt}>(`/api/online_exams/${id}/start`, { access_code: pastedCode.trim() })
      const att=res.attempt; setAttempt(att); attemptRef.current=att.id
      extraMinRef.current=att.extra_minutes??0
      if (att.answers) restoreAnswersWithLocalDraft(att.id, att.answers)
      setCodeRequired(false)
      setPhase('permissions')
    } catch (e:any) {
      // Filet de sécurité : la preuve biométrique (valable 180s) a pu expirer
      // entre l'affichage de cet écran et le clic sur "Reprendre" — redirige
      // vers la vérification plutôt que d'afficher un message confus alors
      // que l'écran de code reste affiché sans action possible.
      if (e?.data?.biometric_required) {
        setCodeRequired(false)
        setBiometricRequired(true)
        initBiometricCheck()
        return
      }
      if (e?.data?.code) setAccessCode(e.data.code)
      setPastedCode('')
      toastErr(e.message||'Code invalide')
    }
    finally { setSubmittingCode(false) }
  }

  /* ── Permissions ──────────────────────────────────────────────────────── */
  async function requestAllPermissions() {
    setPermError(''); setPermBusy(true)
    setPermCam('loading'); setPermMic('loading')
    try {
      // Contrainte "ideal" (souple) plutôt que "min" (stricte) : une exigence
      // stricte ferait échouer getUserMedia avec OverconstrainedError sur
      // les webcams bas de gamme incapables de l'atteindre, alors que le
      // besoin réel est de signaler une qualité insuffisante, pas de
      // bloquer l'accès à l'examen pour une contrainte matérielle.
      const stream = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:true})
      camStream.current=stream; setCamOn(true); setMicOn(true); setPermCam('ok'); setPermMic('ok')
      const track = stream.getVideoTracks()[0]
      const settings = track?.getSettings?.()
      if(settings?.width && settings?.height && (settings.width<480||settings.height<360)) {
        setAlerts(a=>[{type:'camera_quality',msg:`Résolution caméra faible (${settings.width}×${settings.height})`,at:new Date().toLocaleTimeString('fr-FR')},...a])
        const aId = attemptRef.current
        if(aId) {
          logActivity(aId,'low_camera_quality',`Résolution caméra faible: ${settings.width}x${settings.height}`).catch(()=>{})
          logProctoring(aId,'low_camera_quality',`Résolution caméra faible: ${settings.width}x${settings.height}`).catch(()=>{})
        }
      }
      // Bande passante minimale : l'API Network Information (non
      // universelle — absente sur Firefox/Safari, d'où la vérification
      // optionnelle) donne une estimation grossière mais suffisante pour
      // avertir avant le début de l'examen plutôt que de découvrir le
      // problème pendant l'épreuve.
      const conn = (navigator as any).connection
      if (conn && (conn.downlink < 0.5 || ['slow-2g','2g'].includes(conn.effectiveType))) {
        setAlerts(a=>[{type:'network_quality',msg:`Connexion lente détectée (${conn.effectiveType}, ${conn.downlink} Mbps)`,at:new Date().toLocaleTimeString('fr-FR')},...a])
        warning('Connexion Internet lente détectée — cela peut ralentir la sauvegarde de vos réponses.')
      }
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
        const aId=attemptRef.current; if(aId){logActivity(aId,'screen_share_stopped',"Partage d'écran interrompu").catch(()=>{})}
      })
    } catch {
      setPermScreen('error')
      setPermError("Le partage de l'écran complet est obligatoire.")
      setPermBusy(false); return
    }
    setPermBusy(false); setPhase('env_scan')
  }

  /* ── Phase 1 : scan environnement 360° ────────────────────────────────────
     Avant d'entrer dans l'examen, demande à l'étudiant de balayer lentement
     la pièce à la caméra pour vérifier l'absence d'une autre personne —
     pratique standard chez les plateformes commerciales de surveillance
     (confirmé chez Evaluo : "le candidat est invité à réaliser une courte
     vidéo de son environnement"). */
  const SCAN_DURATION_MS = 8000
  async function runEnvironmentScan() {
    setEnvScanStatus('loading_ai'); setEnvScanProgress(0); setEnvScanMaxPeople(0)
    const ready = await initProctoringVision()
    if (!ready) {
      // Dégradé : impossible de vérifier par IA, mais on ne bloque pas un
      // étudiant pour une limitation technique hors de son contrôle — on
      // journalise l'indisponibilité pour que le surveillant en soit informé.
      const aId = attemptRef.current
      if (aId) logActivity(aId,'env_scan_unavailable',"Scan environnement impossible — moteur IA indisponible").catch(()=>{})
      setEnvScanStatus('degraded')
      return
    }
    const vid = scanVideoRef.current
    if (!vid || vid.readyState < 2) { setEnvScanStatus('degraded'); return }

    setEnvScanStatus('scanning')
    const start = Date.now()
    let maxPeople = 0
    const objectSeenCount: Record<string, number> = {}
    const objectBestScore: Record<string, number> = {}
    while (Date.now() - start < SCAN_DURATION_MS) {
      const now = Date.now()
      const n = countPeople(vid, now)
      if (n !== null && n > maxPeople) { maxPeople = n; setEnvScanMaxPeople(n) }
      // Seuil abaissé (0.35 au lieu des 0.5 utilisés en cours d'examen) —
      // ce scan est un passage unique, purement informatif (jamais compté
      // comme fraude), donc un signalement en trop y coûte bien moins qu'un
      // vrai second écran manqué (retour utilisateur du 22/08).
      const obj = analyzeObjects(vid, now, 0.35)
      const what = obj?.phoneDetected?'téléphone':obj?.bookDetected?'livre/document':obj?.otherScreenDetected?'écran supplémentaire':null
      if (what) {
        objectSeenCount[what] = (objectSeenCount[what]||0) + 1
        const bestHere = Math.max(...obj!.matches.map(m=>m.score))
        objectBestScore[what] = Math.max(objectBestScore[what]||0, bestHere)
      }
      setEnvScanProgress(Math.min(100, Math.round(((Date.now()-start)/SCAN_DURATION_MS)*100)))
      await new Promise(r => setTimeout(r, 700))
    }
    setEnvScanProgress(100)
    // Exige au moins 2 détections (comme en cours d'examen) pour filtrer le
    // bruit d'une seule frame — le scan dure 8s, largement de quoi confirmer
    // une présence réelle sans exiger la persistance longue utilisée en
    // examen (30-60s), inutile ici vu le balayage volontaire de la caméra.
    const objectsDetected = Object.entries(objectSeenCount).filter(([,c])=>c>=2).map(([w])=>w)
    setEnvScanObjects(objectsDetected)

    const aId = attemptRef.current
    if (objectsDetected.length && aId) {
      const detail = objectsDetected.map(w=>`${w} (confiance ${(objectBestScore[w]*100).toFixed(0)}%)`).join(', ')
      logActivity(aId,'env_scan_object_detected',`Objets détectés pendant le scan : ${detail}`).catch(()=>{})
      logProctoring(aId,'env_scan_object_detected',`Objets détectés pendant le scan : ${detail}`).catch(()=>{})
    }
    if (maxPeople > 1) {
      setEnvScanStatus('blocked')
      if (aId) {
        logActivity(aId,'env_scan_person_detected',`${maxPeople} personnes détectées pendant le scan`).catch(()=>{})
        logProctoring(aId,'env_scan_person_detected',`${maxPeople} personnes détectées`).catch(()=>{})
      }
    } else {
      setEnvScanStatus('ok')
      if (aId) logActivity(aId,'env_scan_completed','Scan environnement validé — aucune personne supplémentaire détectée').catch(()=>{})
      // Pas d'enchaînement automatique vers enterExam() ici : requestFullscreen()
      // exige un geste utilisateur DIRECT (clic) pour aboutir dans la plupart des
      // navigateurs — un appel différé (même via setTimeout) rompt cette chaîne et
      // le plein écran échoue silencieusement. Constaté en conditions réelles :
      // l'étudiant se retrouvait immédiatement signalé "plein écran quitté" /
      // "perte de focus" en boucle dès le début de l'examen, sans rien avoir fait
      // — le plein écran n'avait en réalité jamais pu s'activer. Un bouton "Continuer"
      // (comme déjà pour les statuts 'blocked'/'degraded' ci-dessous) règle ça.
    }
  }
  useEffect(() => {
    if (phase === 'env_scan') runEnvironmentScan()
  }, [phase]) // eslint-disable-line

  // Keyboard Lock API (Chrome/Edge uniquement, ignorée ailleurs) : tant
  // qu'active, un simple appui sur Echap ne quitte plus le plein écran —
  // le navigateur affiche à la place "Maintenez Echap pour quitter" et
  // n'obéit qu'après ~1-2s d'appui maintenu. C'est une garantie du
  // navigateur lui-même (aucun site ne peut la désactiver) : ça bloque les
  // appuis accidentels/rapides, mais un étudiant qui sait qu'il doit
  // maintenir Echap peut toujours sortir — aucune API web ne permet de
  // rendre la sortie réellement impossible (restriction volontaire des
  // navigateurs). Seul un navigateur verrouillé type Safe Exam Browser (hors
  // périmètre actuel) empêche Echap au niveau du système d'exploitation.
  function lockEscapeKey() {
    try { (navigator as any).keyboard?.lock?.(['Escape']).catch(()=>{}) } catch {}
  }

  // Filet de sécurité — jusqu'ici un échec de requestFullscreen() était
  // avalé en silence (.catch(()=>{})) : l'examen continuait sans qu'aucune
  // trace ne signale que le plein écran n'a en réalité jamais été activé.
  // Constaté notamment en PWA installée (fenêtre autonome sans onglet, où
  // requestFullscreen() peut échouer ou ne rien faire selon navigateur/OS)
  // — l'étudiant n'était alors surveillé par aucun des mécanismes liés au
  // plein écran, sans que ce soit visible côté surveillant/professeur. On
  // journalise maintenant explicitement cet échec au lieu de le taire.
  function reportFullscreenUnavailable() {
    const aId = attemptRef.current
    if (aId) {
      logActivity(aId,'fullscreen_exit','Plein écran indisponible ou refusé (navigateur/OS)').catch(()=>{})
      logProctoring(aId,'fullscreen_exit','Plein écran indisponible ou refusé (navigateur/OS)').catch(()=>{})
    }
  }

  /* ── Entrer dans l'examen ─────────────────────────────────────────────── */
  // Extrait d'enterExam() pour être réutilisable à la fin d'une pause (le
  // minuteur est complètement arrêté pendant la pause, pas juste masqué —
  // évite tout risque d'auto-submit local pendant que l'étudiant est absent).
  function startTimerInterval() {
    if (!attempt) return
    timerRef.current = setInterval(()=>{
      setTimeLeft(()=>{
        const totalNow=(examRef.current?.duration_minutes??0)*60+extraMinRef.current*60
        const startMs=attempt?new Date(attempt.started_at).getTime():Date.now()
        const nl=Math.max(0,Math.floor((startMs+totalNow*1000-Date.now())/1000))
        if(nl<=0){clearInterval(timerRef.current!);handleSubmit(true)}
        return nl
      })
    },1000)
  }

  function enterExam() {
    if (!exam||!attempt) return
    examEnterTimeRef.current = Date.now()
    document.documentElement.requestFullscreen?.().then(lockEscapeKey).catch(() => reportFullscreenUnavailable())
    pauseUsedRef.current = attempt.pause_used || false
    const totalSec   = exam.duration_minutes*60+extraMinRef.current*60
    const elapsedSec = Math.floor((Date.now()-new Date(attempt.started_at).getTime())/1000)
    setTimeLeft(Math.max(totalSec-elapsedSec,0))
    startTimerInterval()
    saveRef.current     = setInterval(()=>{const aId=attemptRef.current;if(aId)doAutoSave(aId)},30000)
    msgPollRef.current  = setInterval(()=>pollTeacherMessages(attempt.id),8000)
    extraPollRef.current= setInterval(()=>pollExtraTime(attempt.id),30000)
    // Heartbeat léger — alimente ExamAttempt.last_seen_at côté serveur pour
    // le badge "hors ligne" du surveillant. Volontairement silencieux en cas
    // d'échec (navigator.onLine false ou requête qui échoue) : ne doit jamais
    // impacter le déroulement de l'examen ni compter comme une violation.
    const sendHeartbeat = () => {
      const aId = attemptRef.current
      if (aId && navigator.onLine) api.post(`/api/exam_attempts/${aId}/heartbeat`, {}).catch(()=>{})
    }
    sendHeartbeat()
    heartbeatRef.current = setInterval(sendHeartbeat, 20000)
    initLiveKit(attempt.id)
    setPhase('exam')
    setTimeout(()=>initFaceDetection(attempt.id),500)
    initAudioMonitoring()
    checkMultiScreen(attempt.id)
    multiScreenIntervalRef.current = setInterval(()=>{
      if(sessionEndedRef.current){if(multiScreenIntervalRef.current)clearInterval(multiScreenIntervalRef.current);return}
      if(breakActiveRef.current) return
      const aId=attemptRef.current; if(aId) checkMultiScreen(aId)
    },60_000)
  }

  /* ── Pause self-service (3 min) ───────────────────────────────────────── */
  async function startBreak() {
    const aId = attemptRef.current
    if (!aId || pauseUsedRef.current || breakActiveRef.current) return
    if (timerRef.current) clearInterval(timerRef.current)
    breakActiveRef.current = true
    pauseUsedRef.current = true
    try {
      const res = await api.post<{resume_at:string; total_extra:number}>(`/api/exam_attempts/${aId}/pause/start`, {})
      extraMinRef.current = res.total_extra
      const resumeAt = new Date(res.resume_at).getTime()
      setBreakResumeAt(resumeAt)
      setOnBreak(true)
      logProctoring(aId,'pause_started','Pause self-service démarrée (3 min)').catch(()=>{})
    } catch (e:any) {
      breakActiveRef.current = false
      pauseUsedRef.current = false
      toastErr(e.message || 'Impossible de démarrer la pause')
    }
  }

  function endBreak() {
    breakActiveRef.current = false
    setOnBreak(false)
    setBreakResumeAt(null)
    startTimerInterval()
    // Même filet de sécurité qu'à l'entrée dans l'examen : si l'étudiant a
    // quitté le plein écran pendant la pause (normal), la re-demande ci-dessous
    // et la période de grâce évitent qu'un faux positif de perte de focus ne
    // se déclenche immédiatement au retour.
    examEnterTimeRef.current = Date.now()
    document.documentElement.requestFullscreen?.().then(lockEscapeKey).catch(() => {})
    success('Examen repris')
  }

  // ── Minuteur par page (Partie 1 uniquement) ─────────────────────────────
  // Recalcul léger du nombre de pages QCM/VF et de la présence de questions
  // ouvertes — miroir de la logique de pagination du bloc de rendu 'exam',
  // nécessaire ici car les hooks ne peuvent pas être appelés à l'intérieur
  // d'un rendu conditionnel par phase.
  const p1PageCount = useMemo(() => {
    if (!exam) return 0
    const displayBlocks = shuffledBlocks.length > 0 ? shuffledBlocks : parsedBlocks
    const p1Blocks = serverPages?.p1_blocks ?? displayBlocks.filter(b=>b.type==='qcm'||b.type==='qcm_multi'||b.type==='vf'||b.type==='appariement')
    const perPage = exam.questions_per_page && exam.questions_per_page>0 ? exam.questions_per_page : Infinity
    const p1Pages = serverPages?.p1_pages ?? paginateBlocks(p1Blocks, perPage)
    return p1Pages.length
  }, [exam, shuffledBlocks, parsedBlocks, serverPages])

  const p2HasBlocks = useMemo(() => {
    if (!exam) return false
    const displayBlocks = shuffledBlocks.length > 0 ? shuffledBlocks : parsedBlocks
    const p2Items = serverPages?.p2_items ?? displayBlocks.filter(b=>b.type==='section'||b.type==='open'||b.type==='subopen'||b.type==='code')
    return p2Items.some(b=>b.type!=='section')
  }, [exam, shuffledBlocks, parsedBlocks, serverPages])

  useEffect(() => {
    if (pageTimerRef.current) { clearInterval(pageTimerRef.current); pageTimerRef.current = null }
    const perQ = exam?.time_per_question_seconds
    if (phase !== 'exam' || !perQ || showPart2 || p1PageCount === 0) { setPageTimeLeft(null); return }
    setPageTimeLeft(perQ)
    pageTimerRef.current = setInterval(() => {
      setPageTimeLeft(t => {
        if (t === null) return null
        if (t <= 1) {
          if (qcmIdx < p1PageCount - 1) {
            setQcmIdx(i => i + 1)
            if (attemptRef.current) doAutoSave(attemptRef.current)
          } else if (p2HasBlocks) {
            setShowPart2(true)
            setAnswers(p => ({ ...p, __qcm_locked: '1' }))
            if (attemptRef.current) doAutoSave(attemptRef.current)
          }
          return perQ
        }
        return t - 1
      })
    }, 1000)
    return () => { if (pageTimerRef.current) clearInterval(pageTimerRef.current) }
  }, [qcmIdx, phase, exam?.time_per_question_seconds, showPart2, p1PageCount, p2HasBlocks])

  /* ── Phase 8 : détection multi-écran (best-effort) ────────────────────────
     Window Management API — uniquement disponible sur Chrome/Edge et
     seulement après octroi d'une permission dédiée par l'étudiant.
     Dégradation silencieuse ailleurs (Firefox/Safari) : ce n'est qu'un
     signal supplémentaire, pas une garantie universelle. */
  async function checkMultiScreen(aId:number) {
    try {
      const getScreenDetails = (window as any).getScreenDetails
      if (typeof getScreenDetails !== 'function') return
      const details = await getScreenDetails()
      const count = details?.screens?.length ?? 1
      if (count > 1) {
        const now = Date.now()
        if (now-(lastVisionAlertRef.current.multiscreen||0) > 60_000) {
          lastVisionAlertRef.current.multiscreen = now
          warning(`${count} écrans détectés — un seul écran est autorisé pendant l'examen`)
          logActivity(aId,'multi_screen_detected',`${count} écrans détectés`).catch(()=>{})
          logProctoring(aId,'multi_screen_detected',`${count} écrans détectés`).catch(()=>{})
        }
      }
    } catch {}
  }

  /* ── Phase 6 : détection audio légère (énergie RMS, pas de transcription) ── */
  function initAudioMonitoring() {
    try {
      const stream = camStream.current; if (!stream) return
      if (!stream.getAudioTracks().length) return
      const AudioContextCls = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextCls) return
      const ctx = new AudioContextCls()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      audioCtxRef.current = ctx
      audioAnalyserRef.current = analyser
      const data = new Uint8Array(analyser.fftSize)
      const CONSEC_ALERT_AUDIO = 3
      // Un seuil absolu unique ne convient à aucune pièce en particulier —
      // une chambre avec ventilateur/rue bruyante déclenche en continu,
      // tandis qu'une pièce très calme laisserait passer des niveaux qu'un
      // seuil fixe plus haut aurait dû capter. On calibre à la place sur le
      // bruit ambiant RÉEL de cet étudiant pendant les 5 premières secondes
      // (aucune alerte pendant cette fenêtre), puis on ne signale qu'un
      // dépassement net de SA propre référence — plancher à 0.05 pour éviter
      // un seuil absurdement bas dans une pièce quasi silencieuse.
      const CALIBRATION_MS = 5_000
      const calibrationStart = Date.now()
      let calibSamples: number[] = []
      let ambientBaseline: number | null = null
      const tick = () => {
        if (sessionEndedRef.current) return
        const an = audioAnalyserRef.current
        if (an) {
          an.getByteTimeDomainData(data)
          let sum = 0
          for (let i=0;i<data.length;i++) { const v=(data[i]-128)/128; sum += v*v }
          const rms = Math.sqrt(sum/data.length)
          if (ambientBaseline===null) {
            calibSamples.push(rms)
            if (Date.now()-calibrationStart >= CALIBRATION_MS) {
              const avg = calibSamples.reduce((s,v)=>s+v,0)/calibSamples.length
              ambientBaseline = avg
            }
            setTimeout(tick, 2000)
            return
          }
          const threshold = Math.max(0.05, ambientBaseline*2.5)
          const talking = rms > threshold
          consAudioRef.current = talking ? consAudioRef.current+1 : 0
          if (consAudioRef.current >= CONSEC_ALERT_AUDIO) {
            const now = Date.now()
            if (now-(lastVisionAlertRef.current.audio||0) > 30_000) {
              lastVisionAlertRef.current.audio = now
              const aId = attemptRef.current
              if (aId) {
                logActivity(aId,'sustained_audio_detected',`Activité audio soutenue (niveau=${rms.toFixed(3)})`).catch(()=>{})
                logProctoring(aId,'sustained_audio_detected','Activité audio soutenue détectée').catch(()=>{})
              }
            }
          }
        }
        setTimeout(tick, 2000)
      }
      tick()
    } catch {}
  }

  /* ── LiveKit ──────────────────────────────────────────────────────────── */
  function initLiveKit(aId:number) {
    if(typeof window==='undefined') return
    if(window.LivekitClient){connectLiveKit(aId);return}
    const s=document.createElement('script')
    s.src='https://cdn.jsdelivr.net/npm/livekit-client@2.5.7/dist/livekit-client.umd.min.js'
    s.crossOrigin='anonymous'; s.onload=()=>connectLiveKit(aId); document.head.appendChild(s)
  }

  /* Publie (ou republie) caméra/micro/écran sur la salle. Doit être
     rappelée après CHAQUE (re)connexion : si la connexion initiale échoue
     avant que la publication n'ait eu le temps d'aboutir (ex. timeout ICE
     sur le transport publisher, cas réel observé où l'étudiant restait
     connecté à la salle sans jamais transmettre d'image), la seule
     reconnexion de room.connect() ne republie rien — l'étudiant paraît
     alors "en ligne" côté surveillance mais l'écran reste noir en
     permanence, sans qu'aucune erreur ne remonte à personne. */
  async function publishLocalTracks(room:any,LK:any) {
    const low = networkQualityRef.current==='poor'
    const camTracks=camStream.current?.getVideoTracks()
    if(camTracks?.length){
      try{
        const vt=new LK.LocalVideoTrack(camTracks[0].clone(),undefined,false)
        await room.localParticipant.publishTrack(vt,{simulcast:!low,videoEncoding:low?{maxBitrate:100_000,maxFramerate:8}:{maxBitrate:300_000,maxFramerate:15}})
        mainCamTrackRef.current=vt
      }
      catch(e){console.warn('[LiveKit] échec publication caméra:',e)}
    }
    const micTracks=camStream.current?.getAudioTracks()
    if(micTracks?.length){
      try{const at=new LK.LocalAudioTrack(micTracks[0].clone(),undefined,false);await room.localParticipant.publishTrack(at)}
      catch(e){console.warn('[LiveKit] échec publication micro:',e)}
    }
    const screenTracks=screenStream.current?.getVideoTracks()
    if(screenTracks?.length&&screenTracks[0].readyState!=='ended'){
      try{
        const st=new LK.LocalVideoTrack(screenTracks[0],undefined,false)
        await room.localParticipant.publishTrack(st,{source:LK.Track.Source.ScreenShare,name:'screen',screenShareEncoding:low?{maxBitrate:150_000,maxFramerate:2}:{maxBitrate:500_000,maxFramerate:5}})
        mainScreenTrackRef.current=st
      }
      catch(e){console.warn('[LiveKit] échec publication écran:',e)}
    }
  }

  /* Rebascule le débit vidéo caméra à chaud (sans déconnecter la room) dès
     que la qualité réseau change en cours d'examen — republie juste la
     piste caméra avec un encodage adapté. Ne touche jamais à l'écran
     partagé une fois publié (le republier interromprait le partage en
     cours, plus perturbant que le gain de bande passante). */
  async function applyBandwidthMode() {
    const room=lkRoomRef.current; const LK=(window as any).LivekitClient
    if(!room||!LK||!mainCamTrackRef.current) return
    const low=networkQualityRef.current==='poor'
    try{ await room.localParticipant.unpublishTrack(mainCamTrackRef.current); mainCamTrackRef.current.stop() }catch{}
    mainCamTrackRef.current=null
    const camTracks=camStream.current?.getVideoTracks()
    if(!camTracks?.length) return
    try{
      const vt=new LK.LocalVideoTrack(camTracks[0].clone(),undefined,false)
      await room.localParticipant.publishTrack(vt,{simulcast:!low,videoEncoding:low?{maxBitrate:100_000,maxFramerate:8}:{maxBitrate:300_000,maxFramerate:15}})
      mainCamTrackRef.current=vt
    }catch(e){console.warn('[LiveKit] échec republication adaptative caméra:',e)}
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
        setTimeout(async()=>{
          try{
            const t=await api.get<any>(`/api/exam_attempts/${aId}/livekit_token`)
            await room.connect(t.ws_url,t.token)
            reconnects=0
            /* Aucune piste ne survit à une reconnexion complète (nouvelle
               session RTC côté serveur) — il faut toujours republier. */
            await publishLocalTracks(room,LK)
          }catch{}
        },delay)
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
      await publishLocalTracks(room,LK)
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
  async function logActivity(aId:number,eventType:string,eventData:string) {
    if(sessionEndedRef.current) return
    try {
      const res=await api.post<{banned?:boolean;alert_sent?:boolean;ban_reason?:string}>(`/api/exam_attempts/${aId}/log_activity`,{event_type:eventType,event_data:eventData})
      if(res.banned) triggerBan()
      else if(res.alert_sent) warning("Comportement à risque détecté — l'enseignant a été alerté.")
    } catch {}
  }

  function triggerBan() {
    sessionEndedRef.current=true; setShowBanModal(true)
    ;[timerRef,saveRef,msgPollRef,extraPollRef,faceIntervalRef].forEach(r=>{if(r.current)clearInterval(r.current)})
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
    // Connexion faible : espacer davantage les captures (elles concurrencent
    // la bande passante nécessaire à l'enregistrement des réponses).
    if(networkQualityRef.current==='poor') minCooldown*=2
    const now=Date.now(); if(now-lastSnapRef.current<minCooldown) return
    const vid=videoRef.current; if(!vid||vid.readyState<2||vid.videoWidth===0) return
    try {
      lastSnapRef.current=now
      const c=document.createElement('canvas'); c.width=320; c.height=240
      const ctx=c.getContext('2d')!
      ctx.drawImage(vid,0,0,320,240)
      // Luminosité moyenne (0-255), échantillonnée sur l'image capturée —
      // signale à l'IA/au surveillant une caméra/éclairage insuffisant
      // (colonne frame_analysis déjà présente en base mais jamais alimentée
      // jusqu'ici).
      const brightness = sampleBrightness(vid)
      if(brightness!==null && (brightness<BRIGHTNESS_LOW||brightness>BRIGHTNESS_HIGH) && now-lastLightWarnRef.current>60_000) {
        lastLightWarnRef.current=now
        warning(brightness<BRIGHTNESS_LOW ? "Éclairage insuffisant détecté — rapprochez-vous d'une source de lumière." : 'Éclairage trop fort détecté — évitez un contre-jour direct.')
      }
      const frameAnalysis = brightness!==null ? JSON.stringify({brightness,width:vid.videoWidth,height:vid.videoHeight}) : null
      await api.post(`/api/exam_attempts/${aId}/camera_snapshot`,{event_type:eventType,image_data:c.toDataURL('image/jpeg',0.55),face_detected:faceDetected,faces_count:facesCount,confidence_score:confidenceScore,frame_analysis:frameAnalysis})
    } catch {}
  }

  /* Phase 7 — contrôle de vivacité : une photo/vidéo tenue devant la caméra
     ne peut pas cligner des yeux sur commande. Signal fort (journalisé,
     alimente le score de risque) plutôt que blocage strict de l'examen —
     un faux négatif (clignement manqué pour une vraie personne : éclairage,
     vitesse) ne doit pas empêcher un étudiant légitime de composer. */
  async function runLivenessCheck(aId:number): Promise<boolean> {
    if (!isProctoringVisionReady()) return true
    const vid = videoRef.current; if (!vid) return true
    setLivenessStatus('waiting_blink')
    // La concentration sur un écran réduit documentairement le rythme de
    // clignement (parfois 1 toutes les 8-10s) — une fenêtre unique de 6s
    // pénalisait des étudiants légitimes qui n'avaient simplement pas encore
    // cligné. Fenêtre élargie à 8s + une seconde tentative avant de conclure
    // à un échec, plutôt qu'un seul essai sec.
    async function attempt(windowMs:number): Promise<boolean> {
      const deadline = Date.now() + windowMs
      let sawOpenEyes = false
      while (Date.now() < deadline) {
        const sig = analyzeFace(vid!, Date.now())
        if (sig && sig.faceCount === 1) {
          const blink = Math.max(sig.blinkLeft ?? 0, sig.blinkRight ?? 0)
          if (blink < 0.3) sawOpenEyes = true
          if (sawOpenEyes && blink > 0.6) return true
        }
        await new Promise(r => setTimeout(r, 300))
      }
      return false
    }
    let sawBlink = await attempt(8000)
    if (!sawBlink) {
      await new Promise(r => setTimeout(r, 1000))
      sawBlink = await attempt(8000)
    }
    setLivenessStatus('ok')
    if (!sawBlink) {
      logActivity(aId,'liveness_check_failed','Aucun clignement détecté lors de la capture de référence (2 tentatives)').catch(()=>{})
      logProctoring(aId,'liveness_check_failed','Aucun clignement détecté').catch(()=>{})
    }
    return sawBlink
  }

  function initFaceDetection(aId:number) {
    const FACEAPI_MODEL_URL='/models/faceapi'
    const ALERT_COOLDOWN=30_000
    const CONSEC_ALERT=3
    // Détection de personne(s) supplémentaire(s) : seuil plus court que le
    // reste (10s au lieu de 15s) — signal plus fiable/moins ambigu qu'une
    // absence de visage ou un léger mismatch, donc pas besoin d'attendre
    // autant de confirmations consécutives avant de réagir.
    const CONSEC_ALERT_MULTI=2
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
      // Échantillons regard/tête pendant que l'étudiant regarde déjà la
      // caméra pour la photo — sert d'étalonnage individuel (voir gazeBaselineRef).
      const gazeSamples:{x:number|null;y:number|null;yaw:number|null}[]=[]
      for(let i=0;i<3;i++){
        if(i>0) await new Promise(r=>setTimeout(r,1500))
        try{
          const det=await fa.detectSingleFace(vid,opts).withFaceLandmarks().withFaceDescriptor()
          if(det){captured.push(det.descriptor)}
          else{refCapturing=false;setTimeout(captureReference,4000);return}
          if(isProctoringVisionReady()){
            const sig=analyzeFace(vid,Date.now())
            if(sig&&sig.faceCount===1) gazeSamples.push({x:sig.gazeX,y:sig.gazeY,yaw:sig.headYaw})
          }
        }catch{refCapturing=false;setTimeout(captureReference,4000);return}
      }
      runLivenessCheck(attemptRef.current||aId).catch(()=>{})
      {
        const xs=gazeSamples.map(s=>s.x).filter((v):v is number=>v!==null)
        const ys=gazeSamples.map(s=>s.y).filter((v):v is number=>v!==null)
        const yaws=gazeSamples.map(s=>s.yaw).filter((v):v is number=>v!==null)
        const mean=(a:number[])=>a.reduce((s,v)=>s+v,0)/a.length
        const spread=(a:number[],m:number)=>Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length)
        if(xs.length>=2&&ys.length>=2&&yaws.length>=2){
          const mx=mean(xs), my=mean(ys), myaw=mean(yaws)
          gazeBaselineRef.current={x:mx,y:my,spreadX:spread(xs,mx),spreadY:spread(ys,my),yaw:myaw,spreadYaw:spread(yaws,myaw)}
        }
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
      if(breakActiveRef.current) return
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
            setFaceStatus('bad'); setFaceIssue('no_face')
            if(now-lastFaceAlertRef.current.no_face>ALERT_COOLDOWN){
              lastFaceAlertRef.current.no_face=now
              // Retour DFIP — une luminosité insuffisante/excessive rend la
              // détection faciale peu fiable ; dans ce cas on ne pénalise pas
              // l'étudiant comme une vraie absence (event à risque nul,
              // purement informatif), on l'invite plutôt à corriger l'éclairage.
              const brightness = sampleBrightness(vid)
              const poorLight = brightness!==null && (brightness<BRIGHTNESS_LOW||brightness>BRIGHTNESS_HIGH)
              if(poorLight){
                warning("Éclairage insuffisant — l'IA ne peut pas vérifier votre présence de façon fiable, améliorez la luminosité")
                logActivity(curAId,'no_face_low_light',`Absent ${consNoFaceRef.current} vérifications consécutives (luminosité=${brightness})`).catch(()=>{})
                logProctoring(curAId,'no_face_low_light',`Absent ${consNoFaceRef.current} vérifications consécutives (luminosité=${brightness})`).catch(()=>{})
              } else {
                warning('Aucun visage détecté — repositionnez-vous face à la caméra')
                logActivity(curAId,'no_face_detected',`Absent ${consNoFaceRef.current} vérifications consécutives`).catch(()=>{})
                logProctoring(curAId,'no_face_detected',`Absent ${consNoFaceRef.current} vérifications consécutives`).catch(()=>{})
              }
              captureSnapshot(poorLight?'no_face_low_light':'no_face_detected',curAId,false,0,null,5_000)
            }
          } else { setFaceStatus('warn'); setFaceIssue('no_face') }
        } else if(count>1){
          consMultiRef.current++; consNoFaceRef.current=0; consMismatchRef.current=0; consGood=0
          if(consMultiRef.current>=CONSEC_ALERT_MULTI){
            setFaceStatus('bad'); setFaceIssue('multiple')
            if(now-lastFaceAlertRef.current.multiple>ALERT_COOLDOWN){
              lastFaceAlertRef.current.multiple=now
              warning(`${count} visages détectés — éloignez toute autre personne`)
              logProctoring(curAId,'multiple_faces',`${count} visages`).catch(()=>{})
              captureSnapshot('multiple_faces',curAId,true,count,null,5_000)
            }
          } else { setFaceStatus('warn'); setFaceIssue('multiple') }
        } else {
          consNoFaceRef.current=0; consMultiRef.current=0
          if(refDescRef.current&&(dets[0] as any).descriptor){
            const dist=fa.euclideanDistance((dets[0] as any).descriptor,refDescRef.current)
            if(dist<=RECOG_THRESHOLD){
              consMismatchRef.current=0; consGood++
              setFaceStatus('ok'); setFaceIssue('none')
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
                  setFaceStatus('warn'); setFaceIssue('mismatch')
                  if(now-lastFaceAlertRef.current.mismatch>ALERT_COOLDOWN){
                    lastFaceAlertRef.current.mismatch=now
                    logProctoring(curAId,'face_mismatch',`distance=${dist.toFixed(3)}`).catch(()=>{})
                    captureSnapshot('face_mismatch',curAId,true,1,1-dist,5_000)
                  }
                } else { setFaceStatus('warn'); setFaceIssue('mismatch') }
              } else { setFaceStatus('warn'); setFaceIssue('mismatch') }
            }
          } else { setFaceStatus('ok'); setFaceIssue('none'); consGood++ }
        }
      }catch{}
      visionEnrichedTick(curAId, now)
    }

    // Phases 3+4+5 — regard, orientation de la tête, parole, objets suspects
    // (MediaPipe, en complément de face-api.js ci-dessus qui reste
    // responsable du comptage/de la reconnaissance faciale). Seuils fixés à
    // des valeurs raisonnables mais non calibrées en conditions réelles —
    // aucune caméra/visage disponible pour un test visuel en dehors du
    // navigateur de l'étudiant ; à ajuster après un premier retour d'usage.
    function visionEnrichedTick(curAId:number, now:number) {
      if (!isProctoringVisionReady()) return
      const vid=videoRef.current; if(!vid||vid.readyState<2) return
      const COOLDOWN=30_000
      // Seuil élargi sur le regard/la tête + davantage de vérifications
      // consécutives exigées (vs CONSEC_ALERT=3 pour le reste) : les
      // reflets sur des verres de lunettes provoquent des sauts brefs de la
      // position mesurée de l'iris, qu'un seuil serré confondrait avec un
      // détournement du regard. Un vrai détournement reste large et soutenu,
      // donc cette marge ne réduit pas la détection réelle.
      const CONSEC_ALERT_GAZE = 4

      const sig = analyzeFace(vid, now)
      if (sig && sig.faceCount === 1) {
        const baseline = gazeBaselineRef.current
        const gazeAway = baseline
          ? (sig.gazeX!==null && Math.abs(sig.gazeX-baseline.x)>Math.max(0.28, baseline.spreadX*3))
            || (sig.gazeY!==null && Math.abs(sig.gazeY-baseline.y)>Math.max(0.24, baseline.spreadY*3))
          : (sig.gazeX!==null && (sig.gazeX<0.20||sig.gazeX>0.80)) || (sig.gazeY!==null && (sig.gazeY<0.15||sig.gazeY>0.85))
        consGazeAwayRef.current = gazeAway ? consGazeAwayRef.current+1 : 0
        if (consGazeAwayRef.current>=CONSEC_ALERT_GAZE && now-(lastVisionAlertRef.current.gaze||0)>COOLDOWN) {
          lastVisionAlertRef.current.gaze=now
          warning('Regard détourné de l\'écran de façon prolongée')
          setAlerts(a => [{type:'gaze',msg:'Regard détourné de l\'écran de façon prolongée',at:new Date().toLocaleTimeString('fr-FR')},...a])
          logActivity(curAId,'gaze_away',`Regard détourné (${consGazeAwayRef.current} vérifications consécutives)`).catch(()=>{})
          logProctoring(curAId,'gaze_away','Regard détourné de façon prolongée').catch(()=>{})
        }

        const headTurned = baseline
          ? sig.headYaw!==null && Math.abs(sig.headYaw-baseline.yaw)>Math.max(0.35, baseline.spreadYaw*3)
          : sig.headYaw!==null && Math.abs(sig.headYaw)>0.6
        consHeadTurnRef.current = headTurned ? consHeadTurnRef.current+1 : 0
        if (consHeadTurnRef.current>=CONSEC_ALERT_GAZE && now-(lastVisionAlertRef.current.head||0)>COOLDOWN) {
          lastVisionAlertRef.current.head=now
          warning('Tête tournée hors de l\'écran de façon prolongée')
          setAlerts(a => [{type:'head',msg:'Tête tournée hors de l\'écran de façon prolongée',at:new Date().toLocaleTimeString('fr-FR')},...a])
          logActivity(curAId,'head_turned',`Tête tournée (yaw=${sig.headYaw?.toFixed(2)})`).catch(()=>{})
          logProctoring(curAId,'head_turned','Tête tournée de façon prolongée').catch(()=>{})
        }

        const talking = sig.mouthOpen!==null && sig.mouthOpen>0.4
        consMouthRef.current = talking ? consMouthRef.current+1 : 0
        if (consMouthRef.current>=CONSEC_ALERT && now-(lastVisionAlertRef.current.mouth||0)>COOLDOWN) {
          lastVisionAlertRef.current.mouth=now
          warning('Parole probable détectée')
          setAlerts(a => [{type:'talking',msg:'Parole probable détectée',at:new Date().toLocaleTimeString('fr-FR')},...a])
          logActivity(curAId,'talking_detected','Bouche ouverte de façon prolongée — parole probable').catch(()=>{})
          logProctoring(curAId,'talking_detected','Parole probable détectée').catch(()=>{})
        }
      } else {
        consGazeAwayRef.current=0; consHeadTurnRef.current=0; consMouthRef.current=0
      }

      // Détection d'objets : à chaque tick (~5s). Réduit de "un tick sur deux"
      // (22/08, retour utilisateur) — un téléphone tenu brièvement pouvait
      // n'être vu qu'une fois avant de disparaître du cadre, jamais assez
      // pour atteindre 2 vérifications consécutives ; l'exigence de 2
      // détections consécutives ci-dessous reste le garde-fou anti-bruit.
      const obj = analyzeObjects(vid, now)
      const what = obj?.phoneDetected?'téléphone':obj?.bookDetected?'livre/document':obj?.otherScreenDetected?'écran supplémentaire':null
      if (what && what===consObjectRef.current.what) {
        consObjectRef.current.count++
      } else {
        consObjectRef.current = { what, count: what ? 1 : 0 }
      }
      if (what && consObjectRef.current.count>=2 && now-(lastVisionAlertRef.current.object||0)>COOLDOWN) {
        lastVisionAlertRef.current.object=now
        warning(`Objet suspect détecté : ${what}`)
        setAlerts(a => [{type:'object',msg:`Objet suspect détecté : ${what}`,at:new Date().toLocaleTimeString('fr-FR')},...a])
        const detail = obj!.matches.map(m=>`${m.label} (confiance ${(m.score*100).toFixed(0)}%)`).join(', ')
        logActivity(curAId,'suspect_object_detected',`Objets détectés : ${detail}`).catch(()=>{})
        logProctoring(curAId,'suspect_object_detected',`Objets détectés : ${detail}`).catch(()=>{})
        captureSnapshot('suspect_object_detected',curAId,true,1,null,5_000)
      }
    }

    function loadAndStart() {
      // Généralement déjà chargé pendant le scan environnement (Phase 1) —
      // appel idempotent ici en filet de sécurité si ce n'est pas le cas.
      initProctoringVision().catch(()=>{})
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

    // Charger face-api.js si pas encore chargé — hébergé localement en
    // priorité (l'examen ne doit pas dépendre d'un CDN externe), CDN en
    // secours automatique si le fichier local est absent/inaccessible.
    if((window as any).faceapi){
      loadAndStart()
    } else {
      const s=document.createElement('script')
      s.src='/vendor/face-api.js'
      s.onload=loadAndStart
      s.onerror=()=>{
        const cdn=document.createElement('script')
        cdn.src='https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js'
        cdn.crossOrigin='anonymous'; cdn.onload=loadAndStart; cdn.onerror=()=>setFaceStatus('ok')
        document.head.appendChild(cdn)
      }
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
    try{
      await api.post(`/api/exam_attempts/${aId}/save`,{answers:JSON.stringify(answersRef.current)})
      setLastSaved(new Date())
      saveFailedRef.current=false
      saveBackoffRef.current=0
      if(saveRetryTimerRef.current){clearTimeout(saveRetryTimerRef.current);saveRetryTimerRef.current=null}
    }catch{
      // n'alerter qu'une fois par série d'échecs (auto-save toutes les 30s) —
      // éviter de spammer l'étudiant si la coupure réseau dure plusieurs minutes.
      // Les réponses restent sécurisées localement (voir localStorage
      // cei_exam_draft_*) pendant que ces tentatives échouent.
      if(!saveFailedRef.current){saveFailedRef.current=true;warning('Sauvegarde automatique impossible — vos réponses restent enregistrées sur cet appareil, nouvelle tentative en cours…')}
      // Réessaye plus vite qu'attendre le prochain cycle de 30s (5s, 10s, 20s, plafonné) —
      // une coupure brève doit se rattraper vite, pas après un cycle complet.
      if(saveRetryTimerRef.current) clearTimeout(saveRetryTimerRef.current)
      const delay=Math.min(5000*Math.pow(2,saveBackoffRef.current),20000)
      saveBackoffRef.current++
      saveRetryTimerRef.current=setTimeout(()=>{if(!sessionEndedRef.current)doAutoSave(aId)},delay)
    }
  }

  const handleSubmit = useCallback(async(auto=false)=>{
    const aId=attemptRef.current; if(!aId||submitting||sessionEndedRef.current) return
    sessionEndedRef.current=true; setSubmitting(true)
    ;[timerRef,saveRef,msgPollRef,extraPollRef].forEach(r=>{if(r.current)clearInterval(r.current)})
    if(saveRetryTimerRef.current){clearTimeout(saveRetryTimerRef.current);saveRetryTimerRef.current=null}
    try { (navigator as any).keyboard?.unlock?.() } catch {}
    document.exitFullscreen?.().catch(()=>{})
    camStream.current?.getTracks().forEach(t=>t.stop())
    screenStream.current?.getTracks().forEach(t=>t.stop())
    if(lkRoomRef.current){try{lkRoomRef.current.disconnect()}catch{}}

    async function trySubmit(): Promise<boolean> {
      try {
        await api.post(`/api/exam_attempts/${aId}/submit`,{answers:JSON.stringify(answersRef.current)})
        return true
      } catch {
        try{ await api.post(`/api/exam_attempts/${aId}/save`,{answers:JSON.stringify(answersRef.current)}); return true }
        catch { return false }
      }
    }

    const ok = await trySubmit()
    if (ok) {
      try{ localStorage.removeItem(`cei_exam_draft_${aId}`) }catch{}
      if(!auto) success('Copie soumise avec succès !')
      setPhase('submitted')
    } else {
      // Ni soumission ni sauvegarde n'ont abouti — connexion probablement
      // coupée. Les réponses restent en sécurité localement ; on continue de
      // réessayer automatiquement en arrière-plan plutôt que de laisser
      // l'étudiant bloqué avec juste un message d'erreur.
      warning('Connexion indisponible — vos réponses restent sauvegardées sur cet appareil, nouvelle tentative automatique en cours…')
      const retry = async () => {
        if (await trySubmit()) {
          try{ localStorage.removeItem(`cei_exam_draft_${aId}`) }catch{}
          setPhase('submitted')
          return
        }
        submitRetryTimerRef.current = setTimeout(retry, 8000)
      }
      submitRetryTimerRef.current = setTimeout(retry, 8000)
    }
  },[submitting]) // eslint-disable-line

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
      <div style={{textAlign:'center'}}><i className="fas fa-spinner fa-spin" style={{fontSize:53,color:'#2563eb',marginBottom:16,display:'block'}}/><p style={{color:'#64748b'}}>Chargement de l'examen…</p></div>
    </div>
  )

  if(phase==='submitted') return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc'}}>
      <div style={{background:'white',borderRadius:20,padding:48,maxWidth:480,width:'90%',textAlign:'center',boxShadow:'0 8px 32px rgba(0,0,0,.1)',border:'1px solid #e2e8f0'}}>
        <div style={{width:80,height:80,background:'rgba(16,185,129,.1)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',fontSize:39.5,color:'#10b981'}}><i className="fas fa-check-circle"/></div>
        <h2 style={{color:'#0f172a',marginBottom:12}}>Copie soumise !</h2>
        <p style={{color:'#64748b',marginBottom:28,lineHeight:1.6}}>Votre copie a été transmise avec succès.</p>
        <button onClick={()=>router.push('/dashboard/student')} style={{width:'100%',padding:'13px',background:'#2563eb',color:'white',border:'none',borderRadius:10,fontWeight:700,fontSize:18,cursor:'pointer'}}>
          <i className="fas fa-home" style={{marginRight:8}}/>Retour au tableau de bord
        </button>
      </div>
    </div>
  )

  if(phase==='unsupported') return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f172a',padding:20}}>
      <div style={{background:'#1e293b',border:'1px solid #334155',borderRadius:20,padding:'40px 32px',maxWidth:460,width:'100%',textAlign:'center',color:'white'}}>
        <div style={{width:64,height:64,background:'rgba(245,158,11,.15)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:31,color:'#f59e0b'}}>
          <i className="fas fa-desktop"/>
        </div>
        <h2 style={{fontSize:23,fontWeight:800,margin:'0 0 10px'}}>Ordinateur requis</h2>
        <p style={{fontSize:15.5,color:'#94a3b8',lineHeight:1.7,marginBottom:24}}>
          Cet examen exige le partage de l'écran complet pendant toute la durée de la composition, une fonctionnalité que les téléphones et tablettes ne permettent pas.
          Merci de vous connecter depuis un <strong style={{color:'#e2e8f0'}}>ordinateur (Windows, Mac ou Linux)</strong> avec un navigateur récent (Chrome, Edge ou Firefox).
        </p>
        <button onClick={()=>router.push('/dashboard/student')} style={{width:'100%',padding:13,background:'#2563eb',color:'white',border:'none',borderRadius:10,fontWeight:700,fontSize:17,cursor:'pointer'}}>
          <i className="fas fa-home" style={{marginRight:8}}/>Retour au tableau de bord
        </button>
      </div>
    </div>
  )

  /* ── INSTRUCTIONS + ATTESTATION (thème clair, identique à l'originale) ── */
  if(phase==='instructions'&&exam&&biometricRequired) return(
    <div style={{minHeight:'100vh',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'white',borderRadius:16,boxShadow:'0 8px 32px rgba(0,0,0,.12)',maxWidth:440,width:'100%',padding:'28px 32px'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}>
          <div style={{width:52,height:52,background:'rgba(37,99,235,.1)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color:'#2563eb',flexShrink:0}}>
            <i className="fas fa-fingerprint"/>
          </div>
          <div>
            <h2 style={{margin:'0 0 3px',fontSize:21.5,fontWeight:700,color:'#1e293b'}}>Vérification d'identité</h2>
            <p style={{margin:0,color:'#64748b',fontSize:15.5}}>Requise avant chaque accès à l'examen</p>
          </div>
        </div>

        {bioMethod==='face' && (
          <>
            <div style={{position:'relative',width:'100%',aspectRatio:'4/3',background:'#0f172a',borderRadius:12,overflow:'hidden',marginBottom:16}}>
              <video ref={bioVideoRef} autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)'}}/>
            </div>
            <p style={{color:'#64748b',marginBottom:18,fontSize:14.5,textAlign:'center'}}>{bioStatusMsg}</p>
            <button onClick={verifyFaceAndResume} disabled={bioBusy}
              style={{width:'100%',padding:'11px',background:'#2563eb',color:'white',border:'none',borderRadius:8,fontWeight:600,cursor:bioBusy?'not-allowed':'pointer',opacity:bioBusy?.6:1,fontSize:17}}>
              {bioBusy ? <><i className="fas fa-spinner fa-spin" style={{marginRight:6}}/>Vérification…</> : <><i className="fas fa-camera" style={{marginRight:6}}/>Vérifier mon identité</>}
            </button>
          </>
        )}

        {bioMethod==='webauthn' && (
          <>
            <p style={{color:'#64748b',marginBottom:18,fontSize:15.5,textAlign:'center'}}>Utilisez votre empreinte digitale ou Face ID pour continuer.</p>
            <button onClick={verifyWebauthnAndResume} disabled={bioBusy}
              style={{width:'100%',padding:'11px',background:'#2563eb',color:'white',border:'none',borderRadius:8,fontWeight:600,cursor:bioBusy?'not-allowed':'pointer',opacity:bioBusy?.6:1,fontSize:17}}>
              {bioBusy ? <><i className="fas fa-spinner fa-spin" style={{marginRight:6}}/>Vérification…</> : <><i className="fas fa-fingerprint" style={{marginRight:6}}/>Vérifier mon identité</>}
            </button>
          </>
        )}

        <div style={{display:'flex',gap:10,marginTop:14}}>
          <button onClick={()=>{ stopBiometricCamera(); router.push('/dashboard/student') }} style={{flex:1,padding:'11px',background:'#f1f5f9',color:'#475569',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer',fontSize:17}}>
            <i className="fas fa-arrow-left" style={{marginRight:6}}/>Retour
          </button>
          <button onClick={()=>{ stopBiometricCamera(); setShowBiometricCall(true) }} style={{flex:1,padding:'11px',background:'#fff8ed',color:'#d97706',border:'1px solid #f59e0b',borderRadius:8,fontWeight:600,cursor:'pointer',fontSize:15}}>
            <i className="fas fa-phone" style={{marginRight:6}}/>Besoin d'aide ?
          </button>
        </div>
      </div>

      {showBiometricCall && user && (
        <BiometricCallModal examId={Number(id)} studentId={user.id} examTitle={exam.title} onClose={()=>setShowBiometricCall(false)} />
      )}
    </div>
  )

  if(phase==='instructions'&&exam&&codeRequired) return(
    <div style={{minHeight:'100vh',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'white',borderRadius:16,boxShadow:'0 8px 32px rgba(0,0,0,.12)',maxWidth:440,width:'100%',padding:'28px 32px'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}>
          <div style={{width:52,height:52,background:'rgba(245,158,11,.12)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color:'#d97706',flexShrink:0}}>
            <i className="fas fa-key"/>
          </div>
          <div>
            <h2 style={{margin:'0 0 3px',fontSize:21.5,fontWeight:700,color:'#1e293b'}}>Reprise de l'examen</h2>
            <p style={{margin:0,color:'#64748b',fontSize:15.5}}>Vous avez quitté l'examen — voici votre code personnel pour continuer</p>
          </div>
        </div>
        <div style={{background:'#fff8ed',border:'1px solid #f59e0b',borderRadius:10,padding:'14px 16px',marginBottom:14,fontSize:15.5,color:'#78350f',lineHeight:1.6}}>
          Ce code vous est propre — personne d'autre ne peut l'utiliser. Copiez-le, collez-le dans le champ ci-dessous, puis cliquez sur « Reprendre ». Votre surveillant sera automatiquement informé de votre retour.
        </div>
        <label style={{fontSize:14.5,fontWeight:700,color:'#334155',display:'block',marginBottom:8}}>1. Votre code (à copier)</label>
        <div style={{display:'flex',gap:8,marginBottom:18}}>
          <div style={{flex:1,padding:'12px 14px',fontSize:24,letterSpacing:6,textAlign:'center',border:'2px dashed #cbd5e1',borderRadius:8,fontWeight:700,color:'#1e293b',background:'#f8fafc'}}>
            {accessCode || '——————'}
          </div>
          <button type="button" onClick={()=>{ if(accessCode){ navigator.clipboard?.writeText(accessCode); success('Code copié') } }} title="Copier"
            style={{width:44,border:'2px solid #e2e8f0',borderRadius:8,background:'white',color:'#475569',cursor:'pointer'}}>
            <i className="fas fa-copy"/>
          </button>
        </div>
        <label style={{fontSize:14.5,fontWeight:700,color:'#334155',display:'block',marginBottom:8}}>2. Collez-le ici</label>
        <input value={pastedCode} onChange={e=>setPastedCode(e.target.value.replace(/\D/g,'').slice(0,6))}
          placeholder="Collez votre code" maxLength={6} inputMode="numeric" autoFocus
          style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',fontSize:24,letterSpacing:6,textAlign:'center',border:'2px solid #2563eb',borderRadius:8,fontWeight:700,color:'#1e293b',background:'white',marginBottom:18}}
          onKeyDown={e=>{ if(e.key==='Enter') submitAccessCode() }} />
        <div style={{display:'flex',gap:10}}>
          <button onClick={()=>router.push('/dashboard/student')} style={{flex:1,padding:'11px',background:'#f1f5f9',color:'#475569',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer',fontSize:17}}>
            <i className="fas fa-arrow-left" style={{marginRight:6}}/>Retour au tableau de bord
          </button>
          <button onClick={submitAccessCode} disabled={submittingCode || pastedCode.length!==6}
            style={{flex:1,padding:'11px',background:'#2563eb',color:'white',border:'none',borderRadius:8,fontWeight:600,cursor:(submittingCode||pastedCode.length!==6)?'not-allowed':'pointer',opacity:(submittingCode||pastedCode.length!==6)?.6:1,fontSize:17}}>
            {submittingCode ? <><i className="fas fa-spinner fa-spin" style={{marginRight:6}}/>Vérification…</> : 'Reprendre'}
          </button>
        </div>
      </div>
    </div>
  )

  if(phase==='instructions'&&exam) return(
    <div style={{minHeight:'100vh',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'white',borderRadius:16,boxShadow:'0 8px 32px rgba(0,0,0,.12)',maxWidth:580,width:'100%',padding:'28px 32px'}}>

        {/* En-tête */}
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:22}}>
          <div style={{width:52,height:52,background:'rgba(37,99,235,.1)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color:'#2563eb',flexShrink:0}}>
            <i className="fas fa-shield-alt"/>
          </div>
          <div>
            <h2 style={{margin:'0 0 3px',fontSize:21.5,fontWeight:700,color:'#1e293b'}}>Examen Surveillé — Attestation d'honneur</h2>
            <p style={{margin:0,color:'#64748b',fontSize:15.5}}>Lisez les conditions avant de démarrer</p>
          </div>
        </div>

        {/* Conditions de surveillance */}
        <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'14px 16px',marginBottom:18}}>
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {[
              {icon:'fa-fingerprint',color:'#2563eb',txt:"Vérification d'identité (visage ou empreinte digitale/Face ID) requise avant l'accès"},
              {icon:'fa-video',color:'#2563eb',txt:'Caméra et microphone activés pendant toute la durée'},
              {icon:'fa-user-check',color:'#10b981',txt:'Visage visible en permanence (détection faciale IA)'},
              {icon:'fa-expand',color:'#f59e0b',txt:"Plein écran obligatoire — tout changement d'onglet est enregistré"},
              {icon:'fa-ban',color:'#ef4444',txt:'Toute fraude entraîne un bannissement immédiat et définitif'},
            ].map(c=>(
              <div key={c.txt} style={{display:'flex',alignItems:'center',gap:10,fontSize:15.5,color:'#334155'}}>
                <i className={`fas ${c.icon}`} style={{color:c.color,width:16,textAlign:'center',flexShrink:0}}/>
                <span>{c.txt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attestation d'honneur */}
        <div style={{background:'#fff8ed',border:'1px solid #f59e0b',borderRadius:10,padding:'14px 16px',marginBottom:18}}>
          <p style={{margin:'0 0 4px',fontSize:15.5,fontWeight:700,color:'#92400e'}}>
            <i className="fas fa-file-signature" style={{marginRight:6}}/>Attestation sur l'honneur
          </p>
          <p style={{margin:0,fontSize:14.5,color:'#78350f',lineHeight:1.65}}>
            Je soussigné(e) <strong>{user?.full_name}</strong>, certifie que je composerai cet examen seul(e),
            sans aide extérieure, sans document non autorisé, et sans aucun outil d'intelligence artificielle.
            Je reconnais que tout manquement à ces règles constitue une fraude académique passible de sanctions.
          </p>
        </div>

        {/* Boutons */}
        <div style={{display:'flex',gap:10}}>
          <button onClick={()=>router.back()} style={{flex:1,padding:'11px',background:'#f1f5f9',color:'#475569',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer',fontSize:17}}>
            <i className="fas fa-times" style={{marginRight:6}}/>Annuler
          </button>
          <button onClick={doStartExam} disabled={starting}
            style={{flex:2,padding:'11px',background:'#2563eb',color:'white',border:'none',borderRadius:8,fontWeight:600,cursor:starting?'not-allowed':'pointer',opacity:starting?.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:17}}>
            {starting
              ?<><i className="fas fa-spinner fa-spin"/>Démarrage en cours…</>
              :<><i className="fas fa-check"/>J'accepte et je démarre l'examen</>}
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
          <i className={`fas ${icon}`} style={{color:pCol(status),fontSize:22}}/>
        </div>
        <div style={{flex:1}}><div style={{fontSize:17,fontWeight:700,color:'white',marginBottom:3}}>{label}</div><div style={{fontSize:14.5,color:status==='loading'?'#94a3b8':pCol(status)}}>{status==='loading'?'Demande en cours…':desc}</div></div>
        <div style={{width:24,height:24,minWidth:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,background:status==='ok'?'#10b981':status==='error'?'#ef4444':'#334155',color:'white'}}>
          {status==='ok'&&<i className="fas fa-check"/>}{status==='error'&&<i className="fas fa-times"/>}
          {status==='loading'&&<i className="fas fa-spinner fa-spin" style={{fontSize:11}}/>}{status==='pending'&&<i className="fas fa-clock" style={{fontSize:11}}/>}
        </div>
      </div>
    )
    return(
      <div style={{minHeight:'100vh',background:'#0f172a',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{background:'#1e293b',border:'1px solid #334155',borderRadius:20,padding:'40px 36px',maxWidth:500,width:'100%',color:'white'}}>
          <h2 style={{fontSize:24,fontWeight:800,margin:'0 0 8px'}}>Accès requis</h2>
          <p style={{fontSize:15.5,color:'#94a3b8',lineHeight:1.6,marginBottom:28}}>Autorisez les 3 accès ci-dessous pour démarrer l'examen.</p>
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:32}}>
            <PI icon="fa-video"      label="Caméra"               desc={permCam==='ok'?'Accès accordé':permCam==='error'?'Accès refusé':'Obligatoire — surveillance vidéo'}        status={permCam}/>
            <PI icon="fa-microphone" label="Microphone"           desc={permMic==='ok'?'Accès accordé':permMic==='error'?'Accès refusé':'Obligatoire — surveillance audio'}         status={permMic}/>
            <PI icon="fa-desktop"    label="Partage d'écran entier" desc={permScreen==='ok'?'Accès accordé':permScreen==='error'?'Refusé ou fenêtre sélectionnée':'Sélectionnez « Écran entier »'} status={permScreen}/>
          </div>
          <button onClick={requestAllPermissions} disabled={permBusy||isHttp}
            style={{width:'100%',padding:15,background:permBusy||isHttp?'#334155':'#2563eb',color:permBusy||isHttp?'#64748b':'white',border:'none',borderRadius:12,fontSize:18,fontWeight:700,cursor:permBusy||isHttp?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            {permBusy?<><i className="fas fa-spinner fa-spin"/>Vérification…</>:<><i className="fas fa-shield-alt"/>Autoriser et commencer</>}
          </button>
          {permError&&<div style={{marginTop:16,background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.3)',borderRadius:10,padding:'12px 14px',fontSize:15.5,color:'#fca5a5',lineHeight:1.6}}>
            <i className="fas fa-exclamation-triangle" style={{marginRight:6}}/>{permError}
          </div>}
        </div>
      </div>
    )
  }

  /* ── Phase 1 : scan environnement 360° ────────────────────────────────── */
  if(phase==='env_scan') {
    // Étapes animées guidant physiquement l'étudiant pendant les 8s du scan
    // (SCAN_DURATION_MS) — imite les indications directionnelles des
    // plateformes de surveillance standard (tourner la caméra à gauche/droite
    // puis montrer le bureau) plutôt qu'un texte statique unique qui ne
    // renseignait pas QUAND ni COMMENT bouger la caméra.
    const ENV_SCAN_STAGES = [
      { icon:'fa-user',        dir:null,    label:'Restez face à la caméra, bien centré et éclairé' },
      { icon:'fa-arrow-left',  dir:'left',  label:'Tournez lentement la caméra vers la GAUCHE' },
      { icon:'fa-arrow-right', dir:'right', label:'Tournez lentement la caméra vers la DROITE' },
      { icon:'fa-arrow-down',  dir:'down',  label:"Montrez votre bureau et l'espace autour de vous" },
    ] as const
    const scanStageIdx = envScanProgress < 20 ? 0 : envScanProgress < 45 ? 1 : envScanProgress < 70 ? 2 : 3
    const scanStage = ENV_SCAN_STAGES[scanStageIdx]
    const scanStageAnim = scanStage.dir==='left' ? 'scanArrowLeft 1.1s ease-in-out infinite'
      : scanStage.dir==='right' ? 'scanArrowRight 1.1s ease-in-out infinite'
      : scanStage.dir==='down' ? 'scanArrowDown 1.1s ease-in-out infinite'
      : 'scanPulseBlue 1.8s ease-in-out infinite'

    return(
      <div style={{minHeight:'100vh',background:'#0f172a',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <style>{`@keyframes scanArrowLeft{0%,100%{transform:translateX(0)}50%{transform:translateX(-10px)}}@keyframes scanArrowRight{0%,100%{transform:translateX(0)}50%{transform:translateX(10px)}}@keyframes scanArrowDown{0%,100%{transform:translateY(0)}50%{transform:translateY(10px)}}@keyframes scanPulseBlue{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,.6)}50%{box-shadow:0 0 0 10px rgba(59,130,246,0)}}`}</style>
        <div style={{background:'#1e293b',border:'1px solid #334155',borderRadius:20,padding:'32px 32px',maxWidth:520,width:'100%',color:'white'}}>
          <h2 style={{fontSize:24,fontWeight:800,margin:'0 0 8px',display:'flex',alignItems:'center',gap:10}}>
            <i className="fas fa-house-signal" style={{color:'#3b82f6'}}/> Vérification de votre environnement
          </h2>
          <p style={{fontSize:15.5,color:'#94a3b8',lineHeight:1.6,marginBottom:20}}>
            Tournez lentement votre caméra (ou votre ordinateur) pour montrer l'ensemble de la pièce autour de vous,
            afin de confirmer qu'aucune autre personne n'est présente.
          </p>
          <div style={{borderRadius:14,overflow:'hidden',background:'#000',position:'relative',aspectRatio:'4/3',marginBottom:18}}>
            <video ref={el=>{scanVideoRef.current=el;if(el&&camStream.current&&el.srcObject!==camStream.current)el.srcObject=camStream.current}}
              autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)'}}/>
            {envScanStatus==='scanning' && (
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(15,23,42,.55)',backdropFilter:'blur(2px)',display:'flex',alignItems:'center',justifyContent:'center',animation:scanStageAnim}}>
                  <i className={`fas ${scanStage.icon}`} style={{fontSize:26,color:'#fff'}}/>
                </div>
              </div>
            )}
          </div>

          {envScanStatus==='loading_ai' && (
            <div style={{display:'flex',alignItems:'center',gap:10,color:'#94a3b8',fontSize:15.5,marginBottom:8}}>
              <i className="fas fa-spinner fa-spin"/> Chargement du moteur de vérification…
            </div>
          )}

          {envScanStatus==='scanning' && (
            <>
              <div style={{display:'flex',gap:6,justifyContent:'center',marginBottom:10}}>
                {ENV_SCAN_STAGES.map((_,i)=>(
                  <span key={i} style={{width:7,height:7,borderRadius:'50%',background:i<=scanStageIdx?'#3b82f6':'#334155',transition:'background .3s'}}/>
                ))}
              </div>
              <div style={{height:8,borderRadius:4,background:'#334155',overflow:'hidden',marginBottom:10}}>
                <div style={{height:'100%',width:`${envScanProgress}%`,background:'#3b82f6',transition:'width .3s'}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:15.5,color:'#e2e8f0',fontWeight:600}}>
                <i className={`fas ${scanStage.icon}`} style={{color:'#3b82f6'}}/>
                {scanStage.label}
              </div>
            </>
          )}

          {envScanStatus==='blocked' && (
            <div style={{background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.3)',borderRadius:10,padding:'14px 16px',marginBottom:16}}>
              <div style={{fontSize:17,fontWeight:700,color:'#fca5a5',marginBottom:6}}>
                <i className="fas fa-triangle-exclamation" style={{marginRight:6}}/>
                {envScanMaxPeople} personnes détectées dans la pièce
              </div>
              <p style={{fontSize:15.5,color:'#fca5a5',margin:0,lineHeight:1.5}}>
                Assurez-vous d'être seul(e) dans la pièce avant de commencer l'examen, puis relancez la vérification.
              </p>
            </div>
          )}

          {envScanStatus==='degraded' && (
            <div style={{background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.3)',borderRadius:10,padding:'14px 16px',marginBottom:16}}>
              <p style={{fontSize:15.5,color:'#fcd34d',margin:0,lineHeight:1.5}}>
                <i className="fas fa-info-circle" style={{marginRight:6}}/>
                Vérification automatique indisponible sur cet appareil/navigateur — vous pouvez continuer, le surveillant en a été informé.
              </p>
            </div>
          )}

          {envScanStatus==='ok' && (
            <>
              <div style={{display:'flex',alignItems:'center',gap:10,color:'#10b981',fontSize:17,fontWeight:700,marginBottom:8}}>
                <i className="fas fa-check-circle"/> Vérifié — cliquez pour démarrer l'examen en plein écran
              </div>
              {envScanObjects.length>0 && (
                <div style={{background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.3)',borderRadius:10,padding:'10px 14px',marginBottom:8,fontSize:14.5,color:'#fcd34d'}}>
                  <i className="fas fa-triangle-exclamation" style={{marginRight:6}}/>
                  Objet(s) repéré(s) dans la pièce : {envScanObjects.join(', ')} — signalé à votre surveillant, veillez à ne pas l'utiliser pendant l'examen.
                </div>
              )}
            </>
          )}

          {(envScanStatus==='ok' || envScanStatus==='blocked' || envScanStatus==='degraded') && (
            <button onClick={envScanStatus==='blocked' ? runEnvironmentScan : enterExam}
              style={{width:'100%',padding:14,background:'#2563eb',color:'white',border:'none',borderRadius:12,fontSize:17,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
              <i className={`fas ${envScanStatus==='blocked'?'fa-rotate':'fa-arrow-right'}`}/>
              {envScanStatus==='blocked' ? 'Relancer la vérification' : "Continuer vers l'examen"}
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ── PAUSE (self-service, 3 min) ─────────────────────────────────────────
     Rendu par-dessus l'examen SANS changer `phase` (qui contrôle le montage
     des effets caméra/anti-fraude — un changement de phase démonterait la
     vidéo). La surveillance est déjà suspendue via breakActiveRef, cet
     overlay masque juste visuellement le contenu de l'examen pendant ce
     temps. */
  if(phase==='exam'&&exam&&onBreak) return(
    <div style={{position:'fixed',inset:0,background:'#0f172a',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{textAlign:'center',maxWidth:440}}>
        <i className="fas fa-mug-hot" style={{fontSize:53,color:'#38bdf8',marginBottom:20,display:'block'}}/>
        <h2 style={{color:'white',fontSize:24,fontWeight:700,marginBottom:10}}>En pause</h2>
        <p style={{color:'rgba(255,255,255,.65)',fontSize:15.5,lineHeight:1.6,marginBottom:24}}>
          La surveillance est suspendue et votre temps d'examen est reporté d'autant. Reprenez quand vous êtes prêt·e.
        </p>
        <div style={{fontSize:44,fontWeight:700,color:'#38bdf8',fontVariantNumeric:'tabular-nums',marginBottom:28}}>
          {fmtTimer(breakSecondsLeft)}
        </div>
        <button onClick={endBreak} style={{padding:'12px 28px',background:'#2563eb',color:'white',border:'none',borderRadius:10,fontWeight:700,fontSize:17,cursor:'pointer'}}>
          <i className="fas fa-play" style={{marginRight:8}}/>Reprendre maintenant
        </button>
      </div>
    </div>
  )

  /* ── EXAM ─────────────────────────────────────────────────────────────── */
  if(phase==='exam'&&exam) {
    const displayBlocks = shuffledBlocks.length > 0 ? shuffledBlocks : parsedBlocks
    const structuredQs  = shuffledQs.length > 0 ? shuffledQs : (exam.questions??[])
    // Source de vérité : pagination calculée côté serveur façon Moodle (page/ordre
    // stables pour la tentative) — repli sur le calcul client si l'appel a échoué.
    const p1Blocks      = serverPages?.p1_blocks ?? displayBlocks.filter(b=>b.type==='qcm'||b.type==='qcm_multi'||b.type==='vf'||b.type==='appariement')
    const p2Items       = serverPages?.p2_items  ?? displayBlocks.filter(b=>b.type==='section'||b.type==='open'||b.type==='subopen'||b.type==='code')
    const p2Blocks      = p2Items.filter(b=>b.type!=='section')
    const allQBlocks    = [...p1Blocks, ...p2Blocks]
    const hasParsed    = allQBlocks.length>0
    const perPage      = exam.questions_per_page && exam.questions_per_page>0 ? exam.questions_per_page : Infinity
    const p1Pages       = serverPages?.p1_pages ?? paginateBlocks(p1Blocks, perPage)
    const p2Pages       = serverPages?.p2_pages ?? paginateBlocks(p2Items, perPage)

    const structAnswered = structuredQs.filter(q=>(answers[q.id.toString()]??'').trim()!=='').length
    const parsedAnswered = allQBlocks.filter(b=>{
      if(b.type==='subopen') return b.choices?.some(c=>(answers[`pq_${b.num}_${c.letter}`]??'').trim()!=='')
      if(b.type==='appariement') return b.pairs?.some((_,i)=>(answers[`pq_${b.num}_${i}`]??'').trim()!=='')
      return (answers[`pq_${b.num}`]??'').trim()!==''
    }).length

    // Avance automatiquement à la page suivante quand la dernière question à
    // choix unique (QCU/V-F) de la page vient d'être répondue — comme demandé :
    // l'étudiant ne devrait pas avoir à cliquer sur "Suiv." après avoir choisi
    // sa réponse. Exclu volontairement pour le QCM à choix multiples (l'étudiant
    // doit pouvoir cocher plusieurs cases avant d'avancer) — il garde le bouton.
    // Verrouille définitivement la partie QCM une fois terminée : marqueur
    // persisté dans les réponses sauvegardées (survit à une actualisation de
    // page) — empêche un étudiant de revenir voir/modifier ses réponses QCM
    // une fois passé aux questions ouvertes, et donc de les partager avec
    // d'autres étudiants encore en train de composer.
    function lockQcmAndAdvance() {
      setShowPart2(true)
      setAnswers(p=>({...p,__qcm_locked:'1'}))
      if(attemptRef.current) doAutoSave(attemptRef.current)
    }

    // Version confirmée, pour le clic manuel sur "Terminer QCM" (contrairement
    // à l'avance automatique, ici toutes les questions ne sont pas forcément
    // répondues — on avertit avant un verrouillage irréversible).
    function confirmAndLockQcm() {
      const unanswered=p1Blocks.filter(b=>{
        if(b.type==='appariement') return !(b.pairs?.every((_,i)=>(answers[`pq_${b.num}_${i}`]??'').trim()!=='')??false)
        return (answers[`pq_${b.num}`]??'').trim()===''
      }).length
      const msg=unanswered>0
        ? `${unanswered} question${unanswered>1?'s':''} QCM sans réponse. Une fois la partie 2 commencée, retour impossible. Continuer ?`
        : "Une fois la partie 2 commencée, vous ne pourrez plus revenir au QCM. Continuer ?"
      if(!window.confirm(msg)) return
      lockQcmAndAdvance()
    }

    function checkAutoAdvance(justKey:string, blockType:string) {
      if(blockType==='qcm_multi') return
      const currentBlocks=p1Pages[qcmIdx]??p1Blocks
      const allDone=currentBlocks.every(b=>{
        const k=`pq_${b.num}`
        if(k===justKey) return true
        if(b.type==='appariement') return b.pairs?.every((_,i)=>(answers[`${k}_${i}`]??'').trim()!=='')??false
        return (answers[k]??'').trim()!==''
      })
      if(!allDone) return
      if(qcmIdx<p1Pages.length-1) { setQcmIdx(i=>i+1); if(attemptRef.current) doAutoSave(attemptRef.current) }
      else if(p2Blocks.length>0) lockQcmAndAdvance()
    }

    return(
      <div className="exam-shell" style={{display:'flex',height:'100vh',width:'100%',overflow:'hidden',fontFamily:"-apple-system,'Segoe UI',Roboto,sans-serif"}}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes agP{0%{box-shadow:0 0 0 0 rgba(16,185,129,.7)}50%{box-shadow:0 0 0 5px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}@keyframes faceRingBad{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.7)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}@keyframes faceRingWarn{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.6)}50%{box-shadow:0 0 0 6px rgba(245,158,11,0)}}`}</style>

        {/* Blocage actif (et non plus seulement un log passif) tant que
            l'étudiant n'a pas explicitement confirmé son retour — le clic
            sert aussi de geste utilisateur valide pour redemander le plein
            écran (requestFullscreen échoue silencieusement hors interaction
            directe). */}
        {focusLost && (
          <div style={{position:'fixed',inset:0,zIndex:10000,background:'#0f172a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,color:'#fff',textAlign:'center',padding:24}}>
            <i className="fas fa-triangle-exclamation" style={{fontSize:48,color:'#f59e0b'}} />
            <h2 style={{fontSize:24,fontWeight:700,margin:0}}>Vous avez quitté l&apos;examen</h2>
            <p style={{maxWidth:420,color:'#cbd5e1',margin:0,fontSize:17,lineHeight:1.5}}>
              Un changement d&apos;onglet, une perte de focus ou une sortie du plein écran a été détectée et enregistrée.
              Revenez à l&apos;examen pour continuer à composer.
            </p>
            <button onClick={() => {
              setFocusLost(false)
              fsPollGuardRef.current = false; focusPollGuardRef.current = false
              document.documentElement.requestFullscreen?.().then(lockEscapeKey).catch(() => reportFullscreenUnavailable())
            }}
              style={{padding:'12px 30px',borderRadius:8,border:'none',background:'#3b82f6',color:'#fff',fontWeight:600,cursor:'pointer',fontSize:18}}>
              Revenir à l&apos;examen
            </button>
          </div>
        )}

        {/* Bannière non bloquante — une coupure réseau n'est pas suspecte,
            l'étudiant continue de composer (réponses en mémoire locale) et
            la sauvegarde reprend automatiquement au retour de connexion. */}
        {networkOffline && (
          <div style={{position:'fixed',top:0,left:0,right:0,zIndex:9998,background:'#f59e0b',color:'#fff',padding:'8px 16px',textAlign:'center',fontSize:15.5,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            <i className="fas fa-wifi" style={{opacity:.85}} />
            Connexion Internet perdue — vos réponses restent conservées, la sauvegarde reprendra automatiquement dès le retour de la connexion.
          </div>
        )}
        {/* Connexion faible (mais pas coupée) : informe sans inquiéter — la
            qualité vidéo de surveillance est réduite automatiquement pour
            préserver la bande passante nécessaire à l'enregistrement des
            réponses, qui reste toujours prioritaire. */}
        {!networkOffline && networkQuality==='poor' && (
          <div style={{position:'fixed',top:0,left:0,right:0,zIndex:9998,background:'#fef3c7',color:'#92400e',padding:'6px 16px',textAlign:'center',fontSize:14.5,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            <i className="fas fa-signal" style={{opacity:.85}} />
            Connexion lente détectée — qualité vidéo réduite automatiquement pour préserver l'enregistrement de vos réponses.
          </div>
        )}

        {/* ═══ PANNEAU SURVEILLANCE ═══ */}
        <div className="exam-proctor-panel" style={{width:280,minWidth:280,background:'white',display:'flex',flexDirection:'column',borderRight:'1px solid #e2e8f0',boxShadow:'2px 0 8px rgba(0,0,0,.08)',overflowY:'auto',zIndex:100}}>
          <div style={{padding:'12px 16px',background:'#2563eb',color:'white',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,fontSize:17,fontWeight:700,marginBottom:6}}><i className="fas fa-shield-alt"/> Surveillance</div>
            <span style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 10px',background:'rgba(255,255,255,.2)',borderRadius:20,fontSize:12,fontWeight:600}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#10b981',animation:'pulse 2s infinite',display:'inline-block'}}/>En cours
            </span>
          </div>
          {/* Agent IA */}
          <div style={{margin:'8px 10px',padding:'9px 11px',background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.22)',borderRadius:8,display:'flex',alignItems:'center',gap:9}}>
            <div style={{width:28,height:28,background:'rgba(16,185,129,.15)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><i className="fas fa-robot" style={{color:'#6ee7b7',fontSize:16}}/></div>
            <div style={{display:'flex',alignItems:'center',gap:7,flex:1}}>
              <span style={{width:7,height:7,background:'#10b981',borderRadius:'50%',flexShrink:0,display:'inline-block',animation:'agP 1.8s ease-in-out infinite'}}/>
              <span style={{fontSize:12,color:'#6ee7b7',fontWeight:600,lineHeight:1.4}}>Agent IA de surveillance actif<br/><span style={{fontWeight:400,color:'rgba(110,231,183,.65)'}}>Surveillance automatique en temps réel</span></span>
            </div>
          </div>
          {/* Caméra locale — ref callback pour attach immédiat */}
          <div style={{margin:'0 12px 8px',borderRadius:8,overflow:'hidden',background:'#000',boxShadow:'0 2px 8px rgba(0,0,0,.12)',position:'relative',aspectRatio:'4/3'}}>
            <video ref={el=>{videoRef.current=el;if(el&&camStream.current&&el.srcObject!==camStream.current)el.srcObject=camStream.current}}
              autoPlay muted playsInline style={{width:'100%',height:'100%',objectFit:'cover',display:'block',transform:'scaleX(-1)'}}/>
            {/* Guide de repositionnement animé — un badge seul en coin est
                facile à manquer pendant qu'on compose ; ce contour ovale sur
                le flux vidéo lui-même (même principe que les plateformes de
                surveillance standard) montre concrètement OÙ replacer son
                visage, pas seulement QU'il manque. */}
            {(faceStatus==='warn'||faceStatus==='bad') && (
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none',padding:8,gap:6}}>
                <div style={{width:'52%',aspectRatio:'3/4',borderRadius:'50%',border:`2px dashed ${faceStatus==='bad'?'#ef4444':'#f59e0b'}`,animation:faceStatus==='bad'?'faceRingBad 1.4s ease-in-out infinite':'faceRingWarn 1.6s ease-in-out infinite'}}/>
                <div style={{background:'rgba(15,23,42,.78)',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:6,textAlign:'center',lineHeight:1.3}}>
                  <i className={`fas ${faceIssue==='multiple'?'fa-user-group':faceStatus==='bad'?'fa-user-slash':'fa-eye-slash'}`} style={{marginRight:4}}/>
                  {faceIssue==='multiple' ? 'Éloignez toute autre personne' : faceStatus==='bad' ? 'Recentrez votre visage ici' : 'Repositionnez-vous dans le cadre'}
                </div>
              </div>
            )}
            <div style={{position:'absolute',top:6,right:6,padding:'3px 7px',background:faceStatus==='ok'?'rgba(16,185,129,.9)':faceStatus==='warn'?'rgba(245,158,11,.9)':faceStatus==='bad'?'rgba(239,68,68,.9)':'rgba(0,0,0,.7)',backdropFilter:'blur(4px)',borderRadius:4,color:'white',fontSize:11,fontWeight:600,display:'flex',alignItems:'center',gap:4,animation:faceStatus==='bad'?'faceRingBad 1.4s ease-in-out infinite':faceStatus==='warn'?'faceRingWarn 1.6s ease-in-out infinite':'none'}}>
              {faceStatus==='init'&&<><i className="fas fa-sync fa-spin"/>Init…</>}
              {faceStatus==='ok'&&<><i className="fas fa-user-check"/>Visage OK</>}
              {faceStatus==='warn'&&faceIssue==='multiple'&&<><i className="fas fa-user-group"/>Plusieurs visages…</>}
              {faceStatus==='warn'&&faceIssue!=='multiple'&&<><i className="fas fa-eye-slash"/>Repositionnez…</>}
              {faceStatus==='bad'&&faceIssue==='multiple'&&<><i className="fas fa-user-group"/>Plusieurs visages</>}
              {faceStatus==='bad'&&faceIssue!=='multiple'&&<><i className="fas fa-times"/>Visage absent</>}
            </div>
          </div>
          {/* Vidéo enseignant — toujours dans le DOM pour que le ref soit disponible */}
          <div style={{display:teacherActive?'block':'none',margin:'0 12px 8px',borderRadius:8,overflow:'hidden',background:'#000',border:'2px solid #f59e0b',position:'relative'}}>
            <div style={{position:'absolute',top:4,left:6,zIndex:10,fontSize:11,fontWeight:700,color:'#f59e0b',background:'rgba(0,0,0,.7)',padding:'2px 6px',borderRadius:4}}><i className="fas fa-chalkboard-teacher"/> Enseignant</div>
            <video ref={teacherVideoRef} autoPlay playsInline style={{width:'100%',display:'block',aspectRatio:'4/3',objectFit:'cover'}}/>
          </div>
          <audio ref={teacherAudioRef} autoPlay style={{display:'none'}}/>
          {/* Périphériques */}
          <div style={{padding:'8px 12px',borderBottom:'1px solid #e2e8f0'}}>
            {[{icon:'fa-video',label:'Caméra',on:camOn},{icon:'fa-microphone',label:'Micro',on:micOn},{icon:'fa-desktop',label:'Écran',on:screenOn}].map(d=>(
              <div key={d.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:6,marginBottom:4,background:'#f8fafc',borderRadius:6}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',background:d.on?'rgba(16,185,129,.1)':'white',border:`2px solid ${d.on?'#10b981':'#e2e8f0'}`,borderRadius:4,fontSize:13,color:d.on?'#10b981':'#94a3b8'}}><i className={`fas ${d.icon}`}/></div>
                  <span style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{d.label}</span>
                </div>
                <span style={{fontSize:11,padding:'2px 6px',borderRadius:10,fontWeight:600,background:d.on?'rgba(16,185,129,.1)':'rgba(100,116,139,.1)',color:d.on?'#10b981':'#64748b'}}>{d.on?'On':'Off'}</span>
              </div>
            ))}
          </div>
          {/* Score risque */}
          <div style={{padding:'8px 12px',borderBottom:'1px solid #e2e8f0'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6,fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#64748b'}}><i className="fas fa-chart-line"/> Score de risque</div>
            <div style={{height:20,background:'#f1f5f9',borderRadius:10,overflow:'hidden',position:'relative',border:'2px solid #e2e8f0'}}>
              <div style={{height:'100%',background:riskScore>=70?'#ef4444':riskScore>=40?'#f59e0b':'#10b981',width:`${Math.min(riskScore,100)}%`,transition:'width .5s,background-color .3s'}}/>
              <span style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontWeight:700,fontSize:13,color:'#0f172a'}}>{riskScore}</span>
            </div>
          </div>
          {/* Alertes */}
          <div style={{flex:1,overflowY:'auto',padding:'8px 12px'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8,fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#64748b'}}><i className="fas fa-exclamation-triangle"/> Alertes système</div>
            {alerts.length===0?(
              <div style={{textAlign:'center',padding:'20px 12px',color:'#94a3b8'}}><i className="fas fa-shield-alt" style={{fontSize:26,opacity:.3,display:'block',marginBottom:6}}/><p style={{fontSize:12,margin:0}}>Aucune alerte</p></div>
            ):alerts.slice(0,10).map((a,i)=>(
              <div key={i} style={{background:a.type.startsWith('teacher')?'rgba(245,158,11,.07)':'rgba(239,68,68,.05)',borderLeft:`3px solid ${a.type.startsWith('teacher')?'#f59e0b':'#ef4444'}`,padding:'6px 8px',marginBottom:6,borderRadius:4,fontSize:12}}>
                <div style={{marginBottom:3,color:'#0f172a',fontWeight:500}}>{a.msg}</div>
                <div style={{color:'#64748b',fontSize:11}}>{a.at}</div>
              </div>
            ))}
          </div>
          {/* Contacter enseignant */}
          <div style={{padding:'8px 12px',borderTop:'1px solid #e2e8f0'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',color:'#64748b',marginBottom:6}}>
              <i className="fas fa-comment-dots"/> Contacter l'enseignant
            </div>
            <textarea value={msgText} onChange={e=>setMsgText(e.target.value)} placeholder="Question ou réclamation…"
              rows={2}
              style={{width:'100%',background:'white',border:'1px solid #e2e8f0',borderRadius:6,padding:'6px 8px',fontSize:13,color:'#0f172a',resize:'none',marginBottom:6,boxSizing:'border-box'}}/>
            <div style={{display:'flex',gap:4}}>
              <button onClick={()=>{
                if(!attemptRef.current) return
                api.post(`/api/exam_attempts/${attemptRef.current}/student_message`,{message:'[DEMANDE_APPEL] Je souhaite poser une question verbalement au surveillant.'}).catch(()=>{})
                setMsgSent(p=>[...p,{text:'Demande d\'appel vocal envoyée',time:new Date().toLocaleTimeString('fr-FR')}])
              }} title="Demander un appel vocal"
                style={{flex:1,background:'rgba(16,185,129,.15)',color:'#10b981',border:'1px solid rgba(16,185,129,.3)',borderRadius:6,padding:'6px',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontWeight:600}}>
                <i className="fas fa-phone"/> Appel
              </button>
              <button onClick={sendMsg} title="Envoyer un message texte"
                style={{flex:2,background:'#2563eb',color:'white',border:'none',borderRadius:6,padding:'6px 10px',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontWeight:600}}>
                <i className="fas fa-paper-plane"/> Envoyer
              </button>
            </div>
            {msgSent.length>0&&<div style={{maxHeight:72,overflowY:'auto',marginTop:6}}>
              {[...msgSent].reverse().slice(0,4).map((m,i)=>(
                <div key={i} style={{background:'rgba(37,99,235,.06)',border:'1px solid rgba(37,99,235,.1)',borderRadius:4,padding:'4px 7px',marginBottom:3,fontSize:12,color:'#1e3a8a'}}>
                  <div style={{marginBottom:1}}>{m.text}</div>
                  <div style={{fontSize:11,color:'#94a3b8'}}>Envoyé à {m.time}</div>
                </div>
              ))}
            </div>}
          </div>
        </div>

        {/* ═══ PANNEAU EXAMEN ═══ */}
        <div className="exam-main-content" style={{flex:1,background:'#f8fafc',overflowY:'auto',display:'flex',flexDirection:'column'}}>
          {/* Header — fixe en haut de la zone de contenu pendant le défilement
              des questions (position:sticky sur son conteneur scrollable
              .exam-main-content, pas la fenêtre entière). */}
          <div style={{position:'sticky',top:0,zIndex:50,background:'white',padding:'16px 24px',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,boxShadow:'0 2px 4px rgba(0,0,0,.04)'}}>
            <div>
              <h1 style={{fontSize:21.5,fontWeight:700,color:'#0f172a',margin:0}}>{exam.title}</h1>
              <p style={{fontSize:14.5,color:'#64748b',margin:'2px 0 0'}}>Durée : {exam.duration_minutes} min · Commencé à {attempt?.started_at?new Date(attempt.started_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—'}</p>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {lastSaved&&<span style={{fontSize:13,color:'#10b981'}}><i className="fas fa-cloud-arrow-up" style={{marginRight:4}}/>Sauvegardé {lastSaved.toLocaleTimeString('fr-FR')}</span>}
              {exam.enable_calculator&&(
                <button onClick={()=>setShowCalculator(s=>!s)} title="Calculatrice"
                  style={{padding:'9px 14px',background:showCalculator?'#1e293b':'#f1f5f9',color:showCalculator?'white':'#334155',border:'none',borderRadius:8,fontWeight:600,fontSize:15.5,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
                  <i className="fas fa-calculator"/> Calculatrice
                </button>
              )}
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',background:timerColor,color:'white',borderRadius:8,fontSize:24,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>
                <i className="fas fa-clock" style={{fontSize:19}}/> {fmtTimer(timeLeft)}
              </div>
              <button onClick={startBreak} disabled={pauseUsedRef.current} title={pauseUsedRef.current?'Pause déjà utilisée pour cet examen':'Pause de 3 minutes (besoin physiologique) — la surveillance est suspendue et le temps est reporté'}
                style={{padding:'9px 14px',background:'#f1f5f9',color:pauseUsedRef.current?'#94a3b8':'#334155',border:'none',borderRadius:8,fontWeight:600,fontSize:15.5,cursor:pauseUsedRef.current?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:7,opacity:pauseUsedRef.current?.6:1}}>
                <i className="fas fa-pause"/> Pause (3 min)
              </button>
              <button onClick={()=>setShowReview(true)} disabled={submitting}
                style={{padding:'10px 20px',background:'#10b981',color:'white',border:'none',borderRadius:8,fontWeight:700,fontSize:17,cursor:submitting?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:7}}>
                {submitting?<><i className="fas fa-spinner fa-spin"/>Soumission…</>:<><i className="fas fa-paper-plane"/>Soumettre</>}
              </button>
            </div>
          </div>

          <div style={{flex:1,padding:24,maxWidth:900,width:'100%',margin:'0 auto'}}>
            {/* Zone réponses */}
            <div style={{background:'white',borderRadius:12,border:'1px solid #e2e8f0',padding:24,marginBottom:24}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                <h2 style={{margin:0,fontSize:19,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><i className="fas fa-pen" style={{color:'#10b981'}}/> Vos Réponses</h2>
                <span style={{fontSize:14.5,color:'#64748b'}}>Sauvegarde automatique</span>
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

              {/* CAS 2 — Blocs parsés, paginés façon Moodle (N questions/page, configuré par le professeur) */}
              {structuredQs.length===0&&hasParsed&&(()=>{
                const saveNow=()=>{if(attemptRef.current)doAutoSave(attemptRef.current)}
                return(<>
                  <ProgBar answered={parsedAnswered} total={allQBlocks.length}/>
                  {/* Partie 1 QCM/VF — pagination par groupes. Masquée définitivement une
                      fois la partie 2 débloquée : un étudiant ne doit plus pouvoir revoir
                      ni modifier ses réponses QCM (risque de partage entre étudiants). */}
                  {p1Blocks.length>0&&!showPart2&&(
                    <div>
                      <SecHead icon="fa-check-square" color="#3b82f6" bg="#eff6ff" tc="#1e40af" title="Partie 1 — Questions à Choix Multiples" sub={`${p1Blocks.length} question${p1Blocks.length>1?'s':''}${isFinite(perPage)?` • ${perPage} par page`:''}`}/>
                      {pageTimeLeft!==null&&(
                        <div style={{display:'flex',alignItems:'center',gap:8,background:pageTimeLeft<=10?'#fef2f2':'#fffbeb',border:`1px solid ${pageTimeLeft<=10?'#fca5a5':'#fde68a'}`,borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:15.5,fontWeight:700,color:pageTimeLeft<=10?'#b91c1c':'#92400e'}}>
                          <i className="fas fa-hourglass-half" style={{animation:pageTimeLeft<=10?'pulse 1s infinite':'none'}}/>
                          Passage automatique à la page suivante dans {fmtTimer(pageTimeLeft)}
                        </div>
                      )}
                      {p1Pages.length>1&&(
                        <div style={{background:'#1e293b',borderRadius:12,padding:'12px 16px',marginBottom:16}}>
                          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                            <button onClick={()=>{setQcmIdx(i=>Math.max(0,i-1));saveNow()}} disabled={qcmIdx===0}
                              style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',borderRadius:8,padding:'8px 16px',cursor:qcmIdx===0?'not-allowed':'pointer',fontSize:15.5,fontWeight:600,opacity:qcmIdx===0?.4:1}}>
                              <i className="fas fa-chevron-left"/> Préc.
                            </button>
                            <span style={{flex:1,textAlign:'center',fontSize:17,fontWeight:700,color:'#f1f5f9'}}>Page {qcmIdx+1} / {p1Pages.length}</span>
                            {qcmIdx<p1Pages.length-1?(
                              <button onClick={()=>{setQcmIdx(i=>i+1);saveNow()}} style={{background:'#3b82f6',border:'none',color:'#fff',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontSize:15.5,fontWeight:600}}>
                                Suiv. <i className="fas fa-chevron-right"/>
                              </button>
                            ):(
                              <button onClick={confirmAndLockQcm} disabled={p2Blocks.length===0}
                                style={{background:p2Blocks.length?'#10b981':'#475569',border:'none',color:'#fff',borderRadius:8,padding:'8px 16px',cursor:p2Blocks.length?'pointer':'default',fontSize:15.5,fontWeight:600}}>
                                {p2Blocks.length?<><i className="fas fa-arrow-right"/> Terminer QCM</>:<><i className="fas fa-check"/> Fin</>}
                              </button>
                            )}
                          </div>
                          {/* Pastilles — une par question, clic saute à sa page */}
                          <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
                            {p1Blocks.map((b,i)=>{
                              const ok=b.type==='appariement'?(b.pairs?.some((_,pi)=>(answers[`pq_${b.num}_${pi}`]??'').trim()!=='')??false):(answers[`pq_${b.num}`]??'').trim()!==''
                              const pageOf=Math.floor(i/(isFinite(perPage)?perPage:p1Blocks.length))
                              const cur=pageOf===qcmIdx
                              return <span key={i} onClick={()=>{setQcmIdx(pageOf);saveNow()}} title={`Q${i+1} (page ${pageOf+1})`}
                                style={{width:24,height:24,borderRadius:'50%',background:cur?'#3b82f6':ok?'#10b981':'rgba(255,255,255,.15)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',cursor:'pointer',border:cur?'2px solid #60a5fa':'1.5px solid rgba(255,255,255,.3)',flexShrink:0}}>
                                {i+1}
                              </span>
                            })}
                          </div>
                        </div>
                      )}
                      {(p1Pages[qcmIdx]??p1Blocks).map((b,i)=><PQ key={i} block={b} answers={answers} setAnswers={setAnswers} onAnswer={checkAutoAdvance} mediaMap={mediaMap} blockDownload={!exam.enable_file_download}/>)}
                      {p1Pages.length<=1&&p2Blocks.length>0&&(
                        <button onClick={confirmAndLockQcm} style={{marginTop:8,background:'#10b981',border:'none',color:'#fff',borderRadius:8,padding:'10px 18px',cursor:'pointer',fontSize:15.5,fontWeight:600}}>
                          <i className="fas fa-arrow-right"/> Passer aux questions ouvertes
                        </button>
                      )}
                    </div>
                  )}
                  {/* Partie 2 — questions ouvertes, pagination par groupes */}
                  {p2Blocks.length>0&&(p1Blocks.length===0||showPart2)&&(
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,padding:'12px 16px',background:'#ecfdf5',borderRadius:10,borderLeft:'4px solid #10b981'}}>
                        <i className="fas fa-pen-alt" style={{color:'#10b981',fontSize:22}}/>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:17,color:'#065f46'}}>Partie 2 — Questions à réponses courtes / développées</div>
                          <div style={{fontSize:14.5,color:'#10b981'}}>{p2Blocks.length} question{p2Blocks.length>1?'s':''}{isFinite(perPage)?` • ${perPage} par page`:''} • Rédigez vos réponses dans les zones ci-dessous</div>
                          {p1Blocks.length>0&&<div style={{fontSize:13,color:'#059669',marginTop:4}}><i className="fas fa-lock" style={{marginRight:4}}/>Partie QCM terminée — retour impossible</div>}
                        </div>
                      </div>
                      {(p2Pages[p2PageIdx]??p2Items).map((b,i)=>{
                        if(b.type==='section') return <div key={i} style={{margin:'18px 0 10px',padding:'10px 16px',background:'#f1f5f9',borderRadius:8,fontWeight:700,fontSize:17,color:'#334155',borderLeft:'4px solid #94a3b8'}}><i className="fas fa-layer-group" style={{color:'#64748b',marginRight:8}}/>{b.title}</div>
                        return <PQ key={i} block={b} answers={answers} setAnswers={setAnswers} mediaMap={mediaMap} blockDownload={!exam.enable_file_download}/>
                      })}
                      {p2Pages.length>1&&(
                        <div style={{display:'flex',alignItems:'center',gap:10,marginTop:16}}>
                          <button onClick={()=>{setP2PageIdx(i=>Math.max(0,i-1));saveNow()}} disabled={p2PageIdx===0}
                            style={{background:'#f1f5f9',border:'1.5px solid #e2e8f0',color:'#334155',borderRadius:8,padding:'8px 16px',cursor:p2PageIdx===0?'not-allowed':'pointer',fontSize:15.5,fontWeight:600,opacity:p2PageIdx===0?.5:1}}>
                            <i className="fas fa-chevron-left"/> Préc.
                          </button>
                          <span style={{flex:1,textAlign:'center',fontSize:17,fontWeight:700,color:'#334155'}}>Page {p2PageIdx+1} / {p2Pages.length}</span>
                          <button onClick={()=>{setP2PageIdx(i=>Math.min(p2Pages.length-1,i+1));saveNow()}} disabled={p2PageIdx>=p2Pages.length-1}
                            style={{background:'#10b981',border:'none',color:'#fff',borderRadius:8,padding:'8px 16px',cursor:p2PageIdx>=p2Pages.length-1?'not-allowed':'pointer',fontSize:15.5,fontWeight:600,opacity:p2PageIdx>=p2Pages.length-1?.5:1}}>
                            Suiv. <i className="fas fa-chevron-right"/>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>)
              })()}

              {/* CAS 3 — Fallback textarea */}
              {structuredQs.length===0&&!hasParsed&&(
                <textarea value={answers['answer']??''} onChange={e=>setAnswers({answer:e.target.value})}
                  placeholder="Rédigez vos réponses ici en indiquant le numéro de chaque question…"
                  style={{width:'100%',minHeight:300,padding:16,border:'2px solid #e2e8f0',borderRadius:8,fontSize:17,lineHeight:1.6,resize:'vertical',fontFamily:'inherit',color:'#0f172a',outline:'none',boxSizing:'border-box'}}/>
              )}
            </div>
          </div>

          <div style={{padding:'20px 24px',background:'white',borderTop:'1px solid #e2e8f0',display:'flex',justifyContent:'flex-end',gap:12,flexShrink:0}}>
            <button onClick={()=>{const aId=attemptRef.current;if(aId)doAutoSave(aId)}}
              style={{padding:'10px 20px',background:'#f1f5f9',color:'#475569',border:'none',borderRadius:8,fontWeight:600,fontSize:17,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
              <i className="fas fa-save"/> Sauvegarder brouillon
            </button>
            <button onClick={()=>setShowReview(true)} disabled={submitting}
              style={{padding:'10px 24px',background:'#10b981',color:'white',border:'none',borderRadius:8,fontWeight:700,fontSize:17,cursor:submitting?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:7}}>
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
            <span style={{color:'#bfdbfe',fontSize:14.5,fontWeight:600}}><i className="fas fa-user-shield" style={{marginRight:4}}/>Votre surveillant</span>
            <button onClick={()=>setProctorActive(false)} style={{marginLeft:'auto',background:'none',border:'none',color:'rgba(255,255,255,.5)',fontSize:17,cursor:'pointer'}}>✕</button>
          </div>
        </div>

        {/* Calculatrice intégrée (Retour DFIP — évite la calculatrice physique/téléphone) */}
        {exam.enable_calculator&&showCalculator&&<Calculator onClose={()=>setShowCalculator(false)}/>}

        {/* Modal appel privé entrant */}
        {showPrivateCallModal&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
            <div style={{background:'white',borderRadius:12,overflow:'hidden',maxWidth:400,width:'92%',boxShadow:'0 20px 40px rgba(0,0,0,.3)',borderTop:'4px solid #3b82f6'}}>
              <div style={{padding:'24px 28px',textAlign:'center'}}>
                <div style={{width:56,height:56,margin:'0 auto 14px',background:'rgba(37,99,235,.12)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26.5,color:'#3b82f6'}}>
                  <i className="fas fa-phone"/>
                </div>
                <h3 style={{fontSize:20.5,fontWeight:700,marginBottom:8,color:'#1e40af'}}>Appel du Surveillant</h3>
                <p style={{fontSize:15.5,color:'#475569',marginBottom:20,lineHeight:1.5}}>Le surveillant souhaite vous parler en privé.<br/>Votre micro sera activé automatiquement.</p>
                <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                  <button onClick={acceptPrivateCall}
                    style={{padding:'9px 20px',background:'#10b981',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:15.5,display:'flex',alignItems:'center',gap:6}}>
                    <i className="fas fa-phone"/> Accepter
                  </button>
                  <button onClick={()=>setShowPrivateCallModal(false)}
                    style={{padding:'9px 20px',background:'#ef4444',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:15.5,display:'flex',alignItems:'center',gap:6}}>
                    <i className="fas fa-phone-slash"/> Refuser
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Relecture des réponses — passage obligatoire avant la soumission
            finale (déclenchée uniquement par le clic sur "Soumettre", jamais
            accessible autrement) : lecture seule (setAnswers no-op) pour ne
            pas permettre de modification accidentelle pendant la relecture —
            "Modifier mes réponses" ramène explicitement à l'examen pour ça. */}
        {showReview&&(
          <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
            <div style={{background:'white',borderRadius:12,overflow:'hidden',maxWidth:760,width:'100%',maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 40px rgba(0,0,0,.3)'}}>
              <div style={{padding:'18px 26px',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
                <h3 style={{fontSize:19,fontWeight:700,margin:'0 0 4px',color:'#0f172a',display:'flex',alignItems:'center',gap:8}}>
                  <i className="fas fa-list-check" style={{color:'#10b981'}}/> Relisez vos réponses avant de soumettre
                </h3>
                <p style={{fontSize:15,color:'#64748b',margin:0}}>
                  {structuredQs.length>0
                    ? `${structAnswered} / ${structuredQs.length} question(s) répondue(s)`
                    : `${parsedAnswered} / ${allQBlocks.length} question(s) répondue(s)`}
                  {' '}— vérifiez qu'aucune réponse n'a été oubliée avant de confirmer.
                </p>
              </div>
              <div style={{overflowY:'auto',flex:1,padding:'20px 26px',background:'#f8fafc'}}>
                {structuredQs.length>0 ? (
                  structuredQs.map((q,i)=><SQ key={q.id} q={q} idx={i} answers={answers} setAnswers={()=>{}}/>)
                ) : hasParsed ? (
                  allQBlocks.map((b,i)=><PQ key={i} block={b} answers={answers} setAnswers={()=>{}} mediaMap={mediaMap} blockDownload={!exam.enable_file_download}/>)
                ) : (
                  <p style={{color:'#94a3b8',fontSize:15.5}}>Aucune question détectée.</p>
                )}
              </div>
              <div style={{padding:'16px 26px',borderTop:'1px solid #e2e8f0',display:'flex',justifyContent:'flex-end',gap:10,flexShrink:0}}>
                <button onClick={()=>setShowReview(false)}
                  style={{padding:'10px 20px',background:'#f1f5f9',color:'#475569',border:'none',borderRadius:8,fontWeight:600,fontSize:17,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
                  <i className="fas fa-pen"/> Modifier mes réponses
                </button>
                <button onClick={()=>{setShowReview(false);handleSubmit(false)}} disabled={submitting}
                  style={{padding:'10px 24px',background:'#10b981',color:'white',border:'none',borderRadius:8,fontWeight:700,fontSize:17,cursor:submitting?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:7}}>
                  {submitting?<><i className="fas fa-spinner fa-spin"/>Soumission…</>:<><i className="fas fa-check"/>Confirmer et soumettre</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Panel appel privé — toujours dans le DOM pour que les refs soient disponibles */}
        <div style={{display:privateCallActive?'block':'none',position:'fixed',left:296,bottom:12,zIndex:9500,background:'#0f172a',border:'2px solid #3b82f6',borderRadius:8,overflow:'hidden',width:230,boxShadow:'0 8px 32px rgba(0,0,0,.6)'}}>
          <div style={{background:'#3b82f6',padding:'6px 10px',display:'flex',alignItems:'center',gap:8}}>
            <i className="fas fa-phone" style={{color:'white',fontSize:12}}/>
            <span style={{color:'white',fontSize:13,fontWeight:700}}>Appel privé avec le surveillant</span>
            <button onClick={leavePrivateCall} style={{marginLeft:'auto',background:'rgba(239,68,68,.85)',color:'white',border:'none',borderRadius:4,padding:'3px 8px',cursor:'pointer',fontSize:12,fontWeight:700}}>
              <i className="fas fa-phone-slash"/> Terminer
            </button>
          </div>
          <video ref={privateTeacherVidRef} autoPlay playsInline
            style={{width:'100%',display:'block',aspectRatio:'4/3',objectFit:'cover',background:'#000'}}/>
          <audio ref={privateTeacherAudRef} autoPlay style={{display:'none'}}/>
          <div style={{padding:'6px 10px',display:'flex',alignItems:'center',gap:6,background:'#1e293b'}}>
            <button onClick={togglePrivateMic}
              style={{background:privateMicOn?'rgba(16,185,129,.5)':'rgba(100,116,139,.2)',color:privateMicOn?'#a7f3d0':'#64748b',border:`1px solid ${privateMicOn?'rgba(16,185,129,.5)':'rgba(100,116,139,.3)'}`,borderRadius:4,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>
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
              <div style={{width:64,height:64,margin:'0 auto 20px',background:'rgba(239,68,68,.1)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:35,color:'#ef4444'}}><i className="fas fa-ban"/></div>
              <h2 style={{fontSize:24,fontWeight:700,marginBottom:12}}>Session terminée</h2>
              <p style={{fontSize:17,color:'#475569',marginBottom:24,lineHeight:1.5}}>Vous avez été exclu de cet examen.<br/><strong>Votre tentative sera notée 0.</strong></p>
              <button onClick={()=>router.push('/dashboard/student')} style={{padding:'10px 28px',background:'#ef4444',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:17}}>
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
        <span style={{fontSize:14.5,color:'#64748b',fontWeight:600}}><i className="fas fa-tasks"/> Progression globale</span>
        <span style={{fontSize:14.5,color:'#2563eb',fontWeight:700}}>{answered} / {total} répondu(es)</span>
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
      <i className={`fas ${icon}`} style={{color,fontSize:22}}/>
      <div><div style={{fontWeight:700,fontSize:17,color:tc}}>{title}</div><div style={{fontSize:14.5,color}}>{sub}</div></div>
    </div>
  )
}

function Modal({border,icon,iconBg,iconColor,title,titleColor,msg,msgColor,bold,onClose}:{border:string;icon:string;iconBg:string;iconColor:string;title:string;titleColor:string;msg:string;msgColor?:string;bold?:boolean;onClose:()=>void}) {
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
      <div style={{background:'white',padding:32,borderRadius:16,maxWidth:440,width:'90%',textAlign:'center',borderTop:`4px solid ${border}`,boxShadow:'0 20px 40px rgba(0,0,0,.2)'}}>
        <div style={{width:64,height:64,margin:'0 auto 20px',background:iconBg,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:35,color:iconColor}}><i className={`fas ${icon}`}/></div>
        <h2 style={{fontSize:24,fontWeight:700,marginBottom:12,color:titleColor}}>{title}</h2>
        <p style={{fontSize:17,color:msgColor||'#475569',marginBottom:24,lineHeight:1.5,fontWeight:bold?600:400}}>{msg}</p>
        <button onClick={onClose} style={{padding:'10px 28px',background:'#2563eb',color:'white',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:17}}>J'ai compris</button>
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
        <span style={{width:34,height:34,borderRadius:'50%',background:isOpen?'#065f46':'#1e40af',color:'#fff',fontWeight:800,fontSize:18,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{idx+1}</span>
        <div style={{flex:1}}><div style={{fontWeight:700,fontSize:18,color:'#0f172a',lineHeight:1.5}}>{q.content}</div>{q.points!=null&&<div style={{fontSize:14.5,color:'#64748b',marginTop:4}}>{q.points} pt{q.points>1?'s':''}</div>}</div>
        <span style={{padding:'2px 8px',borderRadius:99,fontSize:13,fontWeight:700,flexShrink:0,background:isOpen?'#ecfdf5':'#eff6ff',color:isOpen?'#065f46':'#1e40af'}}>{isOpen?'Ouvert':q.question_type==='vf'?'V/F':'QCM'}</span>
      </div>
      {q.question_type==='vf'?(
        <div style={{display:'flex',gap:12}}>
          {['Vrai','Faux'].map(opt=>{const sel=answers[q.id.toString()]===opt;const col=opt==='Vrai'?'#10b981':'#ef4444';return(
            <label key={opt} onClick={()=>setAnswers(p=>({...p,[q.id.toString()]:opt}))} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'14px 18px',border:`2px solid ${sel?col:'#e2e8f0'}`,borderRadius:12,background:sel?col+'18':'#fff',flex:1,justifyContent:'center',transition:'all .18s'}}>
              <span style={{width:32,height:32,borderRadius:'50%',background:sel?col:'#f1f5f9',color:sel?'#fff':'#64748b',fontWeight:700,fontSize:17,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{opt[0]}</span>
              <span style={{fontSize:18,color:'#1e293b'}}>{opt}</span>
              {sel&&<i className="fas fa-check-circle" style={{color:col,fontSize:22}}/>}
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
                <span style={{width:32,height:32,borderRadius:'50%',background:sel?col:'#f1f5f9',color:sel?'#fff':'#64748b',fontWeight:700,fontSize:17,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{letter}</span>
                <span style={{fontSize:18,color:'#1e293b',flex:1,lineHeight:1.5}}>{ch}</span>
                {sel&&<i className="fas fa-check-circle" style={{color:col,fontSize:22,flexShrink:0}}/>}
              </label>
            )
          })}
        </div>
      ):(
        <textarea value={answers[q.id.toString()]??''} onChange={e=>setAnswers(p=>({...p,[q.id.toString()]:e.target.value}))} rows={6} placeholder={`Rédigez votre réponse à la question ${idx+1}…`}
          style={{width:'100%',padding:'12px 14px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:17,fontFamily:'inherit',resize:'vertical',color:'#0f172a',outline:'none',boxSizing:'border-box',lineHeight:1.6}}
          onFocus={e=>{(e.target as HTMLElement).style.borderColor='#3b82f6'}}
          onBlur={e=>{(e.target as HTMLElement).style.borderColor=(answers[q.id.toString()]?.trim()?'#10b981':'#e2e8f0')}}/>
      )}
    </div>
  )
}

/* Question parsée (contenu brut) */
function PQ({block,answers,setAnswers,onAnswer,mediaMap,blockDownload}:{block:ParsedBlock;answers:Record<string,string>;setAnswers:React.Dispatch<React.SetStateAction<Record<string,string>>>;onAnswer?:(key:string,blockType:string)=>void;mediaMap?:Record<string,string>;blockDownload?:boolean}) {
  const isOpen=block.type==='open'||block.type==='subopen'||block.type==='code'
  const key=`pq_${block.num}`
  // Mélange stable (par instance de bloc) des choix de droite de l'appariement,
  // indépendamment de l'ordre des items de gauche — façon Moodle (shufflestems +
  // choices mélangés séparément) — sinon la bonne réponse est toujours au même
  // index que la question, trivialement devinable.
  const shuffledRights = useMemo(
    () => block.type==='appariement' && block.pairs ? fisherYates(block.pairs.map(p=>p.right)) : [],
    [block]
  )
  const answered=block.type==='subopen'?block.choices?.some(c=>(answers[`${key}_${c.letter}`]??'').trim()!==''):
    block.type==='appariement'?(block.pairs?.every((_,i)=>(answers[`${key}_${i}`]??'').trim()!=='')??false):
    (answers[key]??'').trim()!==''
  const TYPE_LABEL:Record<string,string>={vf:'V/F',qcm:'QCU',qcm_multi:'QCM',subopen:'Structuré',appariement:'Appariement',code:'Code / Maths'}
  return(
    <div style={{border:`2px solid ${answered?'#10b981':'#e2e8f0'}`,borderRadius:16,padding:'22px 24px',background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,.05)',marginBottom:16,transition:'border-color .2s'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:16}}>
        <span style={{width:34,height:34,borderRadius:'50%',background:isOpen?'#065f46':'#1e40af',color:'#fff',fontWeight:800,fontSize:18,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{block.num}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:18,color:'#0f172a',lineHeight:1.5}}>{block.text}</div>
          {block.extraLines&&block.extraLines.filter(l=>l.trim()).length>0&&<div style={{fontSize:17,color:'#475569',marginTop:6}}>{block.extraLines.filter(l=>l.trim()).map((l,i)=><span key={i}>{l}<br/></span>)}</div>}
        </div>
        <span style={{padding:'2px 8px',borderRadius:99,fontSize:13,fontWeight:700,flexShrink:0,background:isOpen?'#ecfdf5':'#eff6ff',color:isOpen?'#065f46':'#1e40af'}}>
          {TYPE_LABEL[block.type]??'Ouvert'}
        </span>
      </div>
      {block.media&&block.media.length>0&&(
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
          {block.media.map((m,i)=>{
            const url=mediaMap?.[m.filename]
            if(!url) return null
            return m.type==='image'?(
              <img key={i} src={url} alt={m.filename} draggable={!blockDownload}
                onDragStart={blockDownload?(e)=>e.preventDefault():undefined}
                style={{maxWidth:'100%',maxHeight:360,borderRadius:10,border:'1px solid #e2e8f0',objectFit:'contain'}}/>
            ):m.type==='video'?(
              <video key={i} src={url} controls controlsList={blockDownload?'nodownload noremoteplayback':undefined}
                disablePictureInPicture={blockDownload} onContextMenu={blockDownload?(e)=>e.preventDefault():undefined}
                style={{width:'100%',maxHeight:400,borderRadius:10,border:'1px solid #e2e8f0',background:'#000'}}/>
            ):(
              <audio key={i} src={url} controls controlsList={blockDownload?'nodownload noremoteplayback':undefined}
                onContextMenu={blockDownload?(e)=>e.preventDefault():undefined} style={{width:'100%'}}/>
            )
          })}
        </div>
      )}
      {block.type==='vf'&&(
        <div style={{display:'flex',gap:12}}>
          {['Vrai','Faux'].map(opt=>{const sel=answers[key]===opt;const col=SELECTED_COLOR;return(
            <label key={opt} onClick={()=>{setAnswers(p=>({...p,[key]:opt}));onAnswer?.(key,block.type)}} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'14px 18px',border:`2px solid ${sel?col:'#e2e8f0'}`,borderRadius:12,background:sel?col+'18':'#fff',flex:1,justifyContent:'center',transition:'all .18s'}}>
              <span style={{width:32,height:32,borderRadius:'50%',background:sel?col:'#f1f5f9',color:sel?'#fff':'#64748b',fontWeight:700,fontSize:17,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{opt[0]}</span>
              <span style={{fontSize:18,color:'#1e293b'}}>{opt}</span>{sel&&<i className="fas fa-check-circle" style={{color:col,fontSize:22}}/>}
            </label>
          )})}
        </div>
      )}
      {block.type==='qcm'&&block.choices&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {block.choices.map((c,ci)=>{
            const col=SELECTED_COLOR;const sel=answers[key]===c.letter
            return(
              <label key={ci} onClick={()=>{setAnswers(p=>({...p,[key]:c.letter}));onAnswer?.(key,block.type)}} style={{display:'flex',alignItems:'center',gap:14,cursor:'pointer',padding:'14px 18px',border:`2px solid ${sel?col:'#e2e8f0'}`,borderRadius:12,background:sel?col+'18':'#fff',transition:'all .18s',userSelect:'none'}}>
                <span style={{width:32,height:32,borderRadius:'50%',background:sel?col:'#f1f5f9',color:sel?'#fff':'#64748b',fontWeight:700,fontSize:17,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.letter}</span>
                <span style={{fontSize:18,color:'#1e293b',flex:1,lineHeight:1.5}}>{c.text}</span>
                {sel&&<i className="fas fa-check-circle" style={{color:col,fontSize:22,flexShrink:0}}/>}
              </label>
            )
          })}
        </div>
      )}
      {block.type==='qcm_multi'&&block.choices&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:14.5,color:'#64748b',marginBottom:2}}><i className="fas fa-info-circle"/> Plusieurs réponses possibles</div>
          {block.choices.map((c,ci)=>{
            const col=SELECTED_COLOR
            const selLetters=(answers[key]??'').split(',').map(s=>s.trim()).filter(Boolean)
            const sel=selLetters.includes(c.letter)
            const toggle=()=>{
              // Pas d'avance automatique ici : l'étudiant doit pouvoir cocher
              // plusieurs cases (QCM à choix multiples) avant de continuer.
              const next=sel?selLetters.filter(l=>l!==c.letter):[...selLetters,c.letter]
              setAnswers(p=>({...p,[key]:next.sort().join(',')}))
            }
            return(
              <label key={ci} onClick={toggle} style={{display:'flex',alignItems:'center',gap:14,cursor:'pointer',padding:'14px 18px',border:`2px solid ${sel?col:'#e2e8f0'}`,borderRadius:12,background:sel?col+'18':'#fff',transition:'all .18s',userSelect:'none'}}>
                <span style={{width:22,height:22,borderRadius:6,border:`2px solid ${sel?col:'#cbd5e1'}`,background:sel?col:'#fff',color:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:15.5}}>{sel&&<i className="fas fa-check"/>}</span>
                <span style={{width:28,height:28,borderRadius:'50%',background:sel?col:'#f1f5f9',color:sel?'#fff':'#64748b',fontWeight:700,fontSize:15.5,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.letter}</span>
                <span style={{fontSize:18,color:'#1e293b',flex:1,lineHeight:1.5}}>{c.text}</span>
              </label>
            )
          })}
        </div>
      )}
      {block.type==='appariement'&&block.pairs&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {block.pairs.map((pr,i)=>{
            const sk=`${key}_${i}`;const sv=answers[sk]??''
            return(
              <div key={i} style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{flex:1,padding:'12px 16px',border:'1.5px solid #e2e8f0',borderRadius:10,background:'#f8fafc',fontSize:17,color:'#0f172a',fontWeight:600}}>{pr.left}</div>
                <i className="fas fa-arrow-right" style={{color:'#94a3b8',flexShrink:0}}/>
                {/* Pas d'avance automatique : l'appariement comporte plusieurs
                    paires à compléter avant de continuer. */}
                <select value={sv} onChange={e=>{setAnswers(p=>({...p,[sk]:e.target.value}))}}
                  style={{flex:1,padding:'12px 14px',border:`1.5px solid ${sv?'#10b981':'#e2e8f0'}`,borderRadius:10,fontSize:17,color:'#0f172a',background:'#fff',outline:'none'}}>
                  <option value="">— Choisir —</option>
                  {shuffledRights.map((r,j)=><option key={j} value={r}>{r}</option>)}
                </select>
              </div>
            )
          })}
        </div>
      )}
      {block.type==='code'&&(
        <textarea value={answers[key]??''} onChange={e=>setAnswers(p=>({...p,[key]:e.target.value}))} rows={10} spellCheck={false}
          placeholder={`Rédigez votre réponse (code / démonstration) à la question ${block.num}…`}
          style={{width:'100%',padding:'12px 14px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:15.5,fontFamily:"'Courier New',monospace",whiteSpace:'pre',resize:'vertical',color:'#0f172a',outline:'none',boxSizing:'border-box',lineHeight:1.6,background:'#0f172a08',tabSize:2}}
          onFocus={e=>{(e.target as HTMLElement).style.borderColor='#3b82f6'}}
          onBlur={e=>{(e.target as HTMLElement).style.borderColor=(answers[key]?.trim()?'#10b981':'#e2e8f0')}}/>
      )}
      {block.type==='open'&&(
        <textarea value={answers[key]??''} onChange={e=>setAnswers(p=>({...p,[key]:e.target.value}))} rows={6} placeholder={`Rédigez votre réponse à la question ${block.num}…`}
          style={{width:'100%',padding:'12px 14px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:17,fontFamily:'inherit',resize:'vertical',color:'#0f172a',outline:'none',boxSizing:'border-box',lineHeight:1.6}}
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
                  <span style={{width:26,height:26,borderRadius:'50%',background:'#bbf7d0',color:'#065f46',fontWeight:700,fontSize:15.5,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.letter}</span>
                  <span style={{fontSize:17,fontWeight:600,color:'#1e293b',lineHeight:1.5}}>{c.text}</span>
                </div>
                <textarea value={sv} onChange={e=>setAnswers(p=>({...p,[sk]:e.target.value}))} rows={4} placeholder="Rédigez votre réponse ici…"
                  style={{fontSize:17,fontFamily:'inherit',resize:'vertical',borderRadius:8,border:'1.5px solid #86efac',padding:'10px 12px',width:'100%',boxSizing:'border-box',outline:'none',lineHeight:1.6}}
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
