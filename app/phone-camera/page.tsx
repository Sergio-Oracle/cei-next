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
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }

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

  useEffect(() => {
    // Auto-connexion si le code arrive déjà dans l'URL (scan QR) — évite une
    // étape de confirmation inutile pour l'usage principal (scan), tout en
    // laissant la saisie manuelle disponible si le lien est tapé à la main.
    if (params.get('code')) connect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            <p style={{ color: '#ef4444', fontSize: 14.5, margin: '0 0 18px' }}>{errorMsg || 'Connexion interrompue'}</p>
            <button onClick={() => { setPhase('enter-code'); setErrorMsg('') }} style={{ width: '100%', padding: 12, background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              Réessayer
            </button>
          </div>
        )}

        {phase === 'connected' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 20, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              <i className="fa-solid fa-circle-check" /> Connecté{examTitle ? ` — ${examTitle}` : ''}
            </div>
            <p style={{ color: '#64748b', fontSize: 13.5, margin: '0 0 14px', lineHeight: 1.5 }}>
              Positionnez le téléphone pour couvrir votre poste de travail (vue latérale), puis laissez-le en place. Ne fermez pas cette page pendant l&apos;examen.
            </p>
            <video ref={videoRef} muted playsInline style={{ width: '100%', borderRadius: 8, background: '#0f172a', aspectRatio: '16/9', objectFit: 'cover' }} />
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
