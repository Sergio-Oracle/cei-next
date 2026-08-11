'use client'

/**
 * Réponse à un appel étudiant (superviseur, en l'absence de surveillant
 * assigné — voir la règle d'autorité unique dans generate_access_code côté
 * backend). Rejoint la même room LiveKit privée que le surveillant/professeur
 * utilisent (private-{attemptId}), puis permet de générer le code de reprise
 * après vérification d'identité.
 */
import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

declare global { interface Window { LivekitClient: any } }

interface Props {
  attemptId: number
  examTitle: string
  studentName: string
  onClose: () => void
}

export default function AnswerCallModal({ attemptId, examTitle, studentName, onClose }: Props) {
  const { error: toastErr, success } = useToast()
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'connected' | 'error'>('connecting')
  const [camOn, setCamOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [accessCode, setAccessCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)

  const roomRef      = useRef<any>(null)
  const camTrackRef  = useRef<any>(null)
  const micTrackRef  = useRef<any>(null)
  const remoteVidRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudRef = useRef<HTMLAudioElement | null>(null)
  const localVidRef  = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    let cancelled = false

    function loadLiveKit(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (window.LivekitClient) { resolve(); return }
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/livekit-client@2.5.7/dist/livekit-client.umd.min.js'
        s.crossOrigin = 'anonymous'
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('LiveKit non disponible'))
        document.head.appendChild(s)
      })
    }

    async function start() {
      try {
        await loadLiveKit()
        const tok = await api.get<{ ws_url: string; token: string }>(`/api/exam_attempts/${attemptId}/private_token`)
        if (cancelled) return
        const LK = window.LivekitClient
        const room = new LK.Room({ adaptiveStream: true, dynacast: true })
        roomRef.current = room

        function attach(track: any) {
          if (track.kind === 'video' && remoteVidRef.current) track.attach(remoteVidRef.current)
          else if (track.kind === 'audio' && remoteAudRef.current) track.attach(remoteAudRef.current)
        }
        room.on(LK.RoomEvent.TrackSubscribed, (track: any) => attach(track))
        room.on(LK.RoomEvent.ParticipantConnected, () => { setStatus('connected'); success(`${studentName} a rejoint l'appel`) })
        room.on(LK.RoomEvent.Disconnected, () => { if (!cancelled) setStatus('error') })
        room.on(LK.RoomEvent.ParticipantDisconnected, () => { if (!cancelled) hangUp() })

        await room.connect(tok.ws_url, tok.token)
        if (cancelled) { room.disconnect(); return }

        room.remoteParticipants.forEach((p: any) => {
          p.trackPublications.forEach((pub: any) => { if (pub.track) attach(pub.track) })
        })
        setStatus(room.remoteParticipants.size > 0 ? 'connected' : 'waiting')

        try {
          const mic = await LK.createLocalAudioTrack()
          if (cancelled) { mic.stop(); return }
          await room.localParticipant.publishTrack(mic)
          micTrackRef.current = mic
          setMicOn(true)
        } catch { /* micro optionnel */ }
      } catch (e: any) {
        if (!cancelled) { setStatus('error'); toastErr(e.message || "Impossible de rejoindre l'appel") }
      }
    }

    start()
    return () => {
      cancelled = true
      camTrackRef.current?.stop()
      micTrackRef.current?.stop()
      roomRef.current?.disconnect()
    }
  }, []) // eslint-disable-line

  async function toggleCam() {
    const LK = window.LivekitClient
    if (!LK || !roomRef.current) return
    if (!camOn) {
      try {
        const t = await LK.createLocalVideoTrack({ resolution: LK.VideoPresets.h360.resolution })
        await roomRef.current.localParticipant.publishTrack(t)
        camTrackRef.current = t
        if (localVidRef.current) t.attach(localVidRef.current)
        setCamOn(true)
      } catch (e: any) { toastErr(e.message || 'Caméra indisponible') }
    } else {
      if (localVidRef.current && camTrackRef.current) camTrackRef.current.detach(localVidRef.current)
      if (camTrackRef.current) { await roomRef.current.localParticipant.unpublishTrack(camTrackRef.current); camTrackRef.current.stop(); camTrackRef.current = null }
      setCamOn(false)
    }
  }

  async function generateAccessCode() {
    setGeneratingCode(true)
    try {
      const res = await api.post<{ code: string; expires_at: string }>(`/api/exam_attempts/${attemptId}/access_code`, {})
      setAccessCode({ code: res.code, expires_at: res.expires_at })
    } catch (e: any) { toastErr(e.message || 'Erreur génération du code') }
    finally { setGeneratingCode(false) }
  }

  function hangUp() {
    camTrackRef.current?.stop()
    micTrackRef.current?.stop()
    roomRef.current?.disconnect()
    onClose()
  }

  const statusLabel: Record<typeof status, string> = {
    connecting: 'Connexion en cours…',
    waiting: `En attente que ${studentName} rejoigne…`,
    connected: 'En communication',
    error: 'Appel interrompu',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.75)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#0f172a', borderRadius: 16, width: '100%', maxWidth: 440, overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-phone-volume" style={{ color: '#10b981' }} />
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Appel — {studentName}</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>{examTitle}</div>
          </div>
        </div>

        <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={remoteVidRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'connected' ? 'block' : 'none' }} />
          <audio ref={remoteAudRef} autoPlay />
          {status !== 'connected' && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.6)' }}>
              <i className={`fas ${status === 'error' ? 'fa-phone-slash' : 'fa-spinner fa-spin'}`} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
              {statusLabel[status]}
            </div>
          )}
          <video ref={localVidRef} autoPlay playsInline muted
            style={{ position: 'absolute', bottom: 10, right: 10, width: 90, height: 68, borderRadius: 8, objectFit: 'cover', border: '2px solid rgba(255,255,255,.3)', display: camOn ? 'block' : 'none' }} />
        </div>

        <div style={{ padding: '14px 20px', display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => { void toggleCam() }} title={camOn ? 'Couper la caméra' : 'Activer la caméra'}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: camOn ? '#334155' : 'rgba(255,255,255,.1)', color: 'white', cursor: 'pointer' }}>
            <i className={`fas ${camOn ? 'fa-video' : 'fa-video-slash'}`} />
          </button>
          <button onClick={hangUp} title="Raccrocher"
            style={{ width: 54, height: 44, borderRadius: 22, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontSize: 16 }}>
            <i className="fas fa-phone-slash" />
          </button>
          <button title={micOn ? 'Micro actif' : 'Micro indisponible'} disabled
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: micOn ? '#334155' : 'rgba(239,68,68,.3)', color: 'white', cursor: 'default' }}>
            <i className={`fas ${micOn ? 'fa-microphone' : 'fa-microphone-slash'}`} />
          </button>
        </div>

        <div style={{ padding: '12px 20px 18px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          {accessCode ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>Code — à communiquer à {studentName}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24', letterSpacing: 5 }}>{accessCode.code}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Expire à {new Date(accessCode.expires_at).toLocaleTimeString('fr-FR')} — usage unique</div>
              </div>
              <button onClick={() => { void generateAccessCode() }} disabled={generatingCode}
                style={{ fontSize: 11, background: 'rgba(255,255,255,.1)', color: 'white', border: 'none', padding: '7px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                <i className={`fas ${generatingCode ? 'fa-spinner fa-spin' : 'fa-rotate'}`} /> Régénérer
              </button>
            </div>
          ) : (
            <button onClick={() => { void generateAccessCode() }} disabled={generatingCode}
              style={{ width: '100%', background: 'rgba(217,119,6,.25)', color: '#fcd34d', border: '1px solid rgba(217,119,6,.4)', borderRadius: 8, padding: '9px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
              <i className={`fas ${generatingCode ? 'fa-spinner fa-spin' : 'fa-key'}`} /> Générer un code de reprise (après vérification d'identité)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
