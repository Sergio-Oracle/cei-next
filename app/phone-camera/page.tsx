'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import api from '@/lib/api'

// Page PUBLIQUE (pas de session CEI) — ouverte en scannant le QR code affiché
// sur la page d'examen de l'étudiant. Échange un code de couplage à usage
// unique contre un token LiveKit publish-only, puis publie la caméra du
// téléphone dans la même salle que la caméra principale de l'examen
// (voir POST /api/exam_attempts/{id}/phone_camera/pair côté page d'examen
// et POST /api/phone_camera/token ici).

type Phase = 'enter-code' | 'connecting' | 'connected' | 'error'

declare global { interface Window { LivekitClient: any } }

function loadLiveKit(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.LivekitClient) { resolve(window.LivekitClient); return }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/livekit-client@2.5.7/dist/livekit-client.umd.min.js'
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve(window.LivekitClient)
    s.onerror = () => reject(new Error('LiveKit indisponible'))
    document.head.appendChild(s)
  })
}

function PhoneCameraInner() {
  const params = useSearchParams()
  const [code, setCode] = useState(params.get('code') || '')
  const [phase, setPhase] = useState<Phase>('enter-code')
  const [errorMsg, setErrorMsg] = useState('')
  const [examTitle, setExamTitle] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const roomRef = useRef<any>(null)
  // Le code de couplage est à usage unique côté serveur — un double appel de
  // connect() (constaté en réel : l'effet d'auto-connexion se déclenche deux
  // fois) ferait échouer le second avec "code invalide", écrasant l'état
  // "connecté" obtenu par le premier appel qui, lui, avait réussi. Verrou
  // synchrone (pas juste un contrôle sur `phase`, mis à jour de façon
  // asynchrone et donc pas fiable contre un second appel presque simultané).
  const connectLockRef = useRef(false)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      roomRef.current?.disconnect()
    }
  }, [])

  async function connect() {
    if (connectLockRef.current) return
    const trimmed = code.trim()
    if (!trimmed) { setErrorMsg('Entrez le code affiché sur votre écran principal'); return }
    connectLockRef.current = true
    setPhase('connecting')
    setErrorMsg('')
    try {
      const res = await api.post<{ token: string; ws_url: string; room: string; exam_title: string }>('/api/phone_camera/token', { code: trimmed })
      setExamTitle(res.exam_title)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      // Pas d'attache ici : le <video> de prévisualisation n'existe dans le
      // DOM que dans le bloc de rendu phase==='connected', pas encore atteint
      // à ce stade — videoRef.current serait toujours null (bug réel constaté
      // le 24/08 : aperçu caméra tout noir côté téléphone malgré une
      // publication LiveKit fonctionnelle). Voir le useEffect plus bas, qui
      // attache le flux dès que ce <video> apparaît réellement.

      const LK = await loadLiveKit()
      const room = new LK.Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room
      room.on(LK.RoomEvent.Disconnected, () => { connectLockRef.current = false; setPhase('error') })
      await room.connect(res.ws_url, res.token)

      const camTrack = stream.getVideoTracks()[0]
      const vt = new LK.LocalVideoTrack(camTrack, undefined, false)
      await room.localParticipant.publishTrack(vt, { simulcast: false, videoEncoding: { maxBitrate: 300_000, maxFramerate: 15 } })

      setPhase('connected')
    } catch (e: any) {
      connectLockRef.current = false
      setErrorMsg(e.message || e.data?.error || 'Échec de la connexion — vérifiez le code et réessayez')
      setPhase('error')
    }
  }

  // Attache le flux au <video> de prévisualisation dès qu'il apparaît
  // réellement dans le DOM (phase==='connected') — voir le commentaire dans
  // connect() ci-dessus.
  useEffect(() => {
    if (phase === 'connected' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
      // Bonus : masque la barre d'adresse/chrome du navigateur si le
      // support existe (absent sur iOS Safari — échec silencieux sans
      // conséquence, le plein écran CSS ci-dessous reste garanti).
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }, [phase])

  // Phase connectée : vue plein écran bord-à-bord, sans le cadre/carte
  // centré utilisé pour les autres étapes — `inset:0` sur `position:fixed`
  // se cale directement sur le viewport, donc s'adapte automatiquement à
  // une rotation de l'appareil (portrait/paysage) sans code supplémentaire.
  if (phase === 'connected') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
        <video ref={videoRef} muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 16px', background: 'linear-gradient(to bottom,rgba(0,0,0,.6) 0%,transparent 100%)', display: 'flex', alignItems: 'center', gap: 8, color: '#4ade80', fontSize: 14.5, fontWeight: 700 }}>
          <i className="fa-solid fa-circle-check" /> Connecté{examTitle ? ` — ${examTitle}` : ''}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', background: 'linear-gradient(to top,rgba(0,0,0,.65) 0%,transparent 100%)', color: 'rgba(255,255,255,.85)', fontSize: 12.5, lineHeight: 1.5, textAlign: 'center' }}>
          Positionnez le téléphone pour couvrir votre poste de travail, puis laissez-le en place. Ne fermez pas cette page pendant l&apos;examen.
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, margin: '0 auto 16px', background: 'rgba(37,99,235,.18)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#60a5fa' }}>
          <i className="fa-solid fa-mobile-screen" />
        </div>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Caméra secondaire CEI</h1>
        <p style={{ color: '#94a3b8', fontSize: 14.5, margin: '0 0 24px' }}>Centre d&apos;Examen Intelligent</p>

        {phase === 'enter-code' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 24 }}>
            <p style={{ color: '#64748b', fontSize: 14.5, margin: '0 0 16px' }}>Entrez le code à 6 chiffres affiché sur votre écran principal.</p>
            <input
              type="text" inputMode="numeric" maxLength={6} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              style={{ width: '100%', padding: 14, fontSize: 26, textAlign: 'center', letterSpacing: 6, fontVariantNumeric: 'tabular-nums', border: '1.5px solid #e2e8f0', borderRadius: 8, marginBottom: 16, boxSizing: 'border-box' }}
            />
            {errorMsg && <p style={{ color: '#ef4444', fontSize: 14, margin: '0 0 14px' }}>{errorMsg}</p>}
            <button onClick={connect} style={{ width: '100%', padding: 14, background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
              Se connecter
            </button>
          </div>
        )}

        {phase === 'connecting' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 32 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: '#2563eb' }} />
            <p style={{ color: '#64748b', fontSize: 15, marginTop: 14 }}>Connexion en cours…</p>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 24 }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 26, color: '#ef4444', marginBottom: 10, display: 'block' }} />
            <p style={{ color: '#ef4444', fontSize: 14.5, margin: '0 0 14px' }}>{errorMsg || 'Connexion interrompue'}</p>
            {/* Chaque code n'est valable qu'une fois — un simple "Réessayer"
                avec le même code échouerait forcément à nouveau (retour
                utilisateur du 24/08 : confusion sur où récupérer un nouveau
                code après une déconnexion). */}
            <p style={{ color: '#64748b', fontSize: 13.5, margin: '0 0 18px', lineHeight: 1.5 }}>
              Ce code n&apos;est plus valable. Sur l&apos;écran principal (l&apos;ordinateur), cliquez à nouveau sur « Ajouter une caméra secondaire » pour obtenir un nouveau code, puis entrez-le ci-dessous.
            </p>
            <button onClick={() => { setCode(''); setPhase('enter-code'); setErrorMsg('') }} style={{ width: '100%', padding: 12, background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              Entrer un nouveau code
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default function PhoneCameraPage() {
  return (
    <Suspense fallback={null}>
      <PhoneCameraInner />
    </Suspense>
  )
}
