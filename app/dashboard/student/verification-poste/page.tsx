'use client'

import { useEffect, useRef, useState } from 'react'
import { isProctoringVisionReady, initProctoringVision, analyzeFace } from '@/lib/proctoring-vision'

type Status = 'idle' | 'checking' | 'ok' | 'warning' | 'error'

const STATUS_META: Record<Status, { icon: string; color: string; bg: string; label: string }> = {
  idle:     { icon: 'fa-circle-notch',        color: 'var(--text-muted)', bg: 'var(--background)', label: 'En attente' },
  checking: { icon: 'fa-spinner fa-spin',     color: 'var(--primary)',    bg: 'var(--background)', label: 'Vérification…' },
  ok:       { icon: 'fa-circle-check',        color: '#10b981',           bg: '#dcfce7',            label: 'Prêt' },
  warning:  { icon: 'fa-triangle-exclamation', color: '#d97706',          bg: '#fef3c7',            label: 'À vérifier' },
  error:    { icon: 'fa-circle-xmark',        color: '#ef4444',           bg: '#fee2e2',            label: 'Problème détecté' },
}

function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: m.bg, color: m.color }}>
      <i className={`fas ${m.icon}`} />{m.label}
    </span>
  )
}

/* Même détection de capacité que la page d'examen réelle (isDeviceSupported)
   — le partage d'écran complet n'est pas disponible sur mobile (Android
   Chrome n'implémente pas getDisplayMedia, iOS Safari ne peut pas fournir
   une capture "écran entier"). */
function screenShareSupported(): boolean {
  if (typeof navigator === 'undefined') return true
  return !!(navigator.mediaDevices && typeof (navigator.mediaDevices as any).getDisplayMedia === 'function')
}

export default function VerificationPostePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const camStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)
  const faceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resumeGestureRef = useRef<(() => void) | null>(null)

  const [camStatus, setCamStatus] = useState<Status>('idle')
  const [camMsg, setCamMsg] = useState('')
  const [faceDetected, setFaceDetected] = useState(false)

  const [micStatus, setMicStatus] = useState<Status>('idle')
  const [micMsg, setMicMsg] = useState('')
  const [micLevel, setMicLevel] = useState(0)
  const [micDiag, setMicDiag] = useState('')
  const micEverHeardRef = useRef(false)
  const micStartRef = useRef(0)

  const [screenStatus, setScreenStatus] = useState<Status>(screenShareSupported() ? 'idle' : 'error')
  const [screenMsg, setScreenMsg] = useState(screenShareSupported() ? '' : "Le partage d'écran complet n'est pas disponible sur cet appareil (souvent le cas sur mobile) — un ordinateur est nécessaire pour composer.")

  const [netStatus, setNetStatus] = useState<Status>('checking')
  const [netMsg, setNetMsg] = useState('')

  /* Caméra + micro : même flux combiné que la page d'examen (une seule
     autorisation navigateur pour les deux). */
  useEffect(() => {
    let cancelled = false
    setCamStatus('checking'); setMicStatus('checking')
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      camStreamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      setCamStatus('ok'); setCamMsg('Caméra accessible.')

      // Vérification explicite qu'une piste audio réelle et active a bien
      // été accordée — un mauvais périphérique sélectionné par défaut par
      // le système (ex. carte son virtuelle, micro désactivé au niveau OS)
      // peut faire réussir getUserMedia() sans qu'aucune piste audio
      // exploitable n'existe, ce qui rend le niveau muet sans aucune
      // erreur JS pour l'expliquer.
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        setMicStatus('error')
        setMicMsg("Aucune piste microphone détectée dans le flux — vérifiez qu'un microphone est bien sélectionné par défaut dans les paramètres son de votre système/navigateur.")
      } else if (audioTracks[0].muted || !audioTracks[0].enabled) {
        setMicStatus('error')
        setMicMsg("Le microphone est détecté mais coupé (muet) — vérifiez qu'aucune autre application ne le désactive, puis rechargez cette page.")
      } else {
        setMicStatus('ok'); setMicMsg('Microphone accessible — parlez pour voir le niveau réagir ci-dessous.')
      }

      // Niveau micro en direct (même approche RMS que la page d'examen).
      // IMPORTANT : contrairement à la page d'examen (où l'AudioContext est
      // créé juste après un clic explicite sur "Autoriser et commencer"),
      // cette page le crée automatiquement au chargement — les navigateurs
      // (politique d'autoplay) démarrent alors l'AudioContext à l'état
      // "suspended" tant qu'aucun geste utilisateur n'a eu lieu DANS cette
      // page, et l'analyseur ne traite alors aucun son réel (niveau bloqué
      // à 0 en silence). resume() explicite + relance au premier clic/touche
      // en filet de sécurité pour les navigateurs les plus stricts, ET un
      // diagnostic visible (état réel du contexte + éventuel silence
      // prolongé malgré un contexte "running") pour ne plus avoir à deviner
      // à distance quand ça ne marche pas chez l'utilisateur.
      if (audioTracks.length > 0) try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        audioCtxRef.current = ctx
        setMicDiag(`contexte audio : ${ctx.state}`)
        ctx.resume().then(() => setMicDiag(`contexte audio : ${ctx.state}`)).catch(() => setMicDiag(`contexte audio : ${ctx.state} (resume() a échoué)`))
        const resumeOnGesture = () => { ctx.resume().then(() => setMicDiag(`contexte audio : ${ctx.state}`)).catch(() => {}) }
        resumeGestureRef.current = resumeOnGesture
        window.addEventListener('click', resumeOnGesture)
        window.addEventListener('keydown', resumeOnGesture)
        window.addEventListener('touchstart', resumeOnGesture)
        const data = new Uint8Array(analyser.fftSize)
        micStartRef.current = Date.now()
        // Échelle en décibels plutôt que linéaire : confirmé sur un vrai
        // poste (27/08) que le contexte audio tournait bien ("running") et
        // qu'un signal réel était capté, mais qu'un multiplicateur linéaire
        // (x6) rendait une voix à gain de micro modeste quasi invisible
        // dans la barre (niveau ≈ 0.038 en parlant normalement). Les
        // indicateurs de niveau audio standards utilisent une échelle dB —
        // beaucoup plus sensible aux sons discrets sans écraser les sons
        // forts. Plage -60dB (silence) à -12dB (voix forte/proche).
        const MIN_DB = -60, MAX_DB = -12
        const tick = () => {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v }
          const rms = Math.sqrt(sum / data.length)
          const db = 20 * Math.log10(rms + 1e-6)
          const level = Math.max(0, Math.min(1, (db - MIN_DB) / (MAX_DB - MIN_DB)))
          setMicLevel(level)
          if (level > 0.06) micEverHeardRef.current = true
          // Après 6s, si le contexte tourne bien mais qu'aucun son n'a
          // jamais été détecté (même le bruit ambiant produit un léger
          // signal), le problème n'est plus l'AudioContext mais le
          // périphérique lui-même (mauvais micro sélectionné, coupé au
          // niveau OS, etc.) — le dire clairement plutôt que de laisser
          // la jauge muette sans explication.
          if (!micEverHeardRef.current && Date.now() - micStartRef.current > 6000 && ctx.state === 'running') {
            setMicDiag(`contexte audio : running — mais aucun son capté depuis 6s. Vérifiez que le bon micro est sélectionné dans les paramètres de votre système (pas seulement du navigateur), et qu'aucune autre appli ne le monopolise.`)
          } else if (Date.now() - micStartRef.current <= 6000 || micEverHeardRef.current) {
            setMicDiag(`contexte audio : running (${db.toFixed(0)} dB)`)
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch (e: any) {
        setMicDiag(`erreur AudioContext : ${e?.message || e}`)
      }

      // Détection de visage en direct (même moteur que pendant l'examen)
      initProctoringVision().then(() => {
        if (cancelled) return
        faceIntervalRef.current = setInterval(() => {
          if (!videoRef.current || videoRef.current.readyState < 2 || !isProctoringVisionReady()) return
          const sig = analyzeFace(videoRef.current, Date.now())
          setFaceDetected(!!sig && sig.faceCount === 1)
        }, 1000)
      }).catch(() => {})
    }).catch((err: any) => {
      if (cancelled) return
      setCamStatus('error'); setMicStatus('error')
      const denied = err?.name === 'NotAllowedError'
      const msg = denied
        ? "Accès refusé — autorisez la caméra et le microphone dans les paramètres de votre navigateur, puis rechargez cette page."
        : "Caméra ou microphone introuvable — vérifiez qu'aucune autre application ne les utilise déjà."
      setCamMsg(msg); setMicMsg(msg)
    })

    return () => {
      cancelled = true
      camStreamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close().catch(() => {})
      if (faceIntervalRef.current) clearInterval(faceIntervalRef.current)
      cancelAnimationFrame(rafRef.current)
      if (resumeGestureRef.current) {
        window.removeEventListener('click', resumeGestureRef.current)
        window.removeEventListener('keydown', resumeGestureRef.current)
        window.removeEventListener('touchstart', resumeGestureRef.current)
      }
    }
  }, [])

  /* Réseau : même seuils que la page d'examen (navigator.connection). Cette
     API n'existe que sur Chrome/Edge/Opera (pas Safari/Firefox) — message
     honnête plutôt qu'un faux résultat quand elle est absente. */
  useEffect(() => {
    const conn = (navigator as any).connection
    if (!conn) {
      setNetStatus('warning')
      setNetMsg("Votre navigateur ne permet pas de mesurer automatiquement votre connexion — assurez-vous simplement d'avoir une connexion stable et évitez le partage de connexion mobile faible le jour de l'examen.")
      return
    }
    const evaluate = () => {
      const poor = conn.downlink < 0.5 || ['slow-2g', '2g'].includes(conn.effectiveType)
      const shaky = !poor && (conn.downlink < 1.5 || conn.effectiveType === '3g')
      if (poor) {
        setNetStatus('error')
        setNetMsg(`Connexion faible détectée (${conn.effectiveType}, ${conn.downlink} Mbps). L'examen réduira automatiquement sa consommation, mais rapprochez-vous de votre routeur ou changez de réseau si possible.`)
      } else if (shaky) {
        setNetStatus('warning')
        setNetMsg(`Connexion correcte mais limite (${conn.effectiveType}, ${conn.downlink} Mbps). Ça devrait fonctionner ; évitez de partager la connexion avec d'autres usages pendant l'examen.`)
      } else {
        setNetStatus('ok')
        setNetMsg(`Connexion satisfaisante (${conn.effectiveType}, ${conn.downlink} Mbps).`)
      }
    }
    evaluate()
    conn.addEventListener?.('change', evaluate)
    return () => conn.removeEventListener?.('change', evaluate)
  }, [])

  async function testScreenShare() {
    setScreenStatus('checking'); setScreenMsg('')
    try {
      const ss = await (navigator.mediaDevices as any).getDisplayMedia({ video: { cursor: 'always', displaySurface: 'monitor' }, preferCurrentTab: false, audio: false })
      const track = ss.getVideoTracks()[0]
      const settings = track?.getSettings?.() || {}
      const isFullScreen = settings.displaySurface ? settings.displaySurface === 'monitor' : true
      ss.getTracks().forEach((t: MediaStreamTrack) => t.stop())
      if (isFullScreen) {
        setScreenStatus('ok'); setScreenMsg("Partage d'écran entier fonctionnel.")
      } else {
        setScreenStatus('warning'); setScreenMsg("Le partage a fonctionné, mais vérifiez bien de choisir « Écran entier » (pas une fenêtre ni un onglet) le jour de l'examen.")
      }
    } catch {
      setScreenStatus('error'); setScreenMsg("Partage annulé ou refusé. Le jour de l'examen, il sera obligatoire de l'autoriser et de choisir « Écran entier ».")
    }
  }

  const allGood = camStatus === 'ok' && micStatus === 'ok' && (screenStatus === 'ok' || screenStatus === 'idle') && netStatus !== 'error'

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-shield-halved" style={{ marginRight: 10, color: 'var(--primary)' }} />Vérifier mon poste</h2>
          <p>Testez votre caméra, micro, partage d'écran et connexion avant le jour de l'examen — pas besoin d'attendre l'examen blanc pour savoir si tout fonctionne.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        {/* Caméra */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}><i className="fas fa-video" style={{ marginRight: 8, color: 'var(--primary)' }} />Caméra</h3>
            <StatusBadge status={camStatus} />
          </div>
          <div style={{ background: '#000', borderRadius: 10, overflow: 'hidden', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: camStatus === 'ok' ? 'block' : 'none' }} />
            {camStatus !== 'ok' && <i className={`fas ${camStatus === 'checking' ? 'fa-spinner fa-spin' : 'fa-video-slash'}`} style={{ color: '#666', fontSize: 32 }} />}
          </div>
          {camStatus === 'ok' && (
            <div style={{ marginTop: 10, fontSize: 14.5, color: faceDetected ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
              <i className={`fas ${faceDetected ? 'fa-circle-check' : 'fa-circle-notch fa-spin'}`} style={{ marginRight: 6 }} />
              {faceDetected ? 'Visage détecté clairement' : 'Recherche de votre visage…'}
            </div>
          )}
          {camMsg && <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>{camMsg}</p>}
        </div>

        {/* Microphone */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}><i className="fas fa-microphone" style={{ marginRight: 8, color: 'var(--primary)' }} />Microphone</h3>
            <StatusBadge status={micStatus} />
          </div>
          <p style={{ fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 10 }}>Parlez normalement pour vérifier que le niveau réagit :</p>
          <div style={{ height: 14, borderRadius: 7, background: 'var(--background)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(micLevel * 100)}%`, background: micLevel > 0.15 ? '#10b981' : 'var(--primary)', transition: 'width 0.08s linear' }} />
          </div>
          {micMsg && <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 10 }}>{micMsg}</p>}
          {micStatus === 'ok' && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'monospace' }}>
              niveau : {micLevel.toFixed(3)} — {micDiag || 'initialisation…'}
            </p>
          )}
        </div>

        {/* Partage d'écran */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}><i className="fas fa-desktop" style={{ marginRight: 8, color: 'var(--primary)' }} />Partage d'écran</h3>
            <StatusBadge status={screenStatus} />
          </div>
          <p style={{ fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 12 }}>Le jour de l'examen, vous devrez partager votre <strong>écran entier</strong> (pas juste un onglet).</p>
          <button className="btn btn-secondary" onClick={testScreenShare} disabled={screenStatus === 'checking' || !screenShareSupported()} style={{ width: '100%' }}>
            {screenStatus === 'checking' ? <><i className="fas fa-spinner fa-spin" /> Vérification…</> : <><i className="fas fa-play" /> Tester le partage d'écran</>}
          </button>
          {screenMsg && <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 10 }}>{screenMsg}</p>}
        </div>

        {/* Réseau */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}><i className="fas fa-wifi" style={{ marginRight: 8, color: 'var(--primary)' }} />Connexion réseau</h3>
            <StatusBadge status={netStatus} />
          </div>
          <p style={{ fontSize: 14.5, color: 'var(--text-muted)' }}>{netMsg || 'Mesure en cours…'}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 14, background: allGood ? '#dcfce7' : undefined }}>
        <i className={`fas ${allGood ? 'fa-circle-check' : 'fa-info-circle'}`} style={{ fontSize: 28, color: allGood ? '#10b981' : 'var(--primary)' }} />
        <div>
          <strong style={{ fontSize: 16 }}>{allGood ? 'Votre poste semble prêt pour composer.' : "Terminez les vérifications ci-dessus avant le jour de l'examen."}</strong>
          <p style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--text-muted)' }}>
            En cas de problème persistant, contactez votre surveillant ou l'administration avant le jour de l'examen — voir la page <a href="/dashboard/student/aide">Aide</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
