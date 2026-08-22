'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { loadFaceApi, captureAveragedDescriptor } from '@/lib/faceCapture'
import { isPlatformAuthenticatorAvailable, registerCredential } from '@/lib/webauthnClient'

type Method = 'choice' | 'face' | 'webauthn' | 'done'

function BiometricEnrollInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/dashboard'
  const { success, error: toastErr } = useToast()

  const [step, setStep] = useState<Method>('choice')
  const [webauthnAvailable, setWebauthnAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [faceReady, setFaceReady] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setWebauthnAvailable)
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  async function startFaceFlow() {
    setStep('face')
    setStatusMsg('Ouverture de la caméra…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
      setStatusMsg('Chargement du modèle de reconnaissance…')
      await loadFaceApi()
      setFaceReady(true)
      setStatusMsg('Regardez la caméra, restez immobile quelques secondes…')
    } catch (e: any) {
      toastErr(e.message || "Impossible d'accéder à la caméra")
      setStep('choice')
    }
  }

  async function captureAndEnroll() {
    if (!videoRef.current) return
    setBusy(true)
    setStatusMsg('Capture en cours…')
    try {
      const result = await captureAveragedDescriptor(videoRef.current)
      if (!result) {
        toastErr('Aucun visage détecté — repositionnez-vous face à la caméra et réessayez')
        setBusy(false)
        return
      }
      await api.post('/api/biometric/enroll/face', { descriptor: result.descriptor, image_data: result.snapshotDataUrl })
      streamRef.current?.getTracks().forEach(t => t.stop())
      setStep('done')
      success('Reconnaissance faciale enregistrée')
    } catch (e: any) {
      toastErr(e.message || "Échec de l'inscription")
    } finally {
      setBusy(false)
    }
  }

  async function startWebauthnFlow() {
    setStep('webauthn')
    setBusy(true)
    try {
      const options = await api.post<any>('/api/biometric/enroll/webauthn/options')
      const credential = await registerCredential(options)
      await api.post('/api/biometric/enroll/webauthn/verify', {
        credential,
        device_label: navigator.platform || 'Appareil',
        transports: credential.response.transports,
      })
      setStep('done')
      success('Empreinte biométrique enregistrée')
    } catch (e: any) {
      toastErr(e.message || "Échec de l'enregistrement — réessayez ou utilisez la reconnaissance faciale")
      setStep('choice')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: 'var(--primary)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="fa-solid fa-fingerprint" style={{ fontSize: 31, color: 'white' }} />
          </div>
          <h1 style={{ fontSize: 26.5, fontWeight: 700, marginBottom: 4 }}>Vérification d'identité</h1>
          <p style={{ color: 'var(--text-muted)' }}>Requise pour accéder à vos examens</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {step === 'choice' && (
            <>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 15.5, lineHeight: 1.6 }}>
                {webauthnAvailable
                  ? "Choisissez comment vous souhaitez être identifié avant chaque examen. Cette étape n'est à faire qu'une seule fois — vous pourrez la refaire depuis vos paramètres si besoin."
                  : "Votre identification se fera par reconnaissance faciale avant chaque examen (aucun capteur d'empreinte/Face ID détecté sur cet appareil). Cette étape n'est à faire qu'une seule fois — vous pourrez la refaire depuis vos paramètres si besoin."}
              </p>
              <button className="btn btn-primary btn-block" style={{ marginBottom: 12 }} onClick={startFaceFlow}>
                <i className="fa-solid fa-camera" style={{ marginRight: 8 }} />Reconnaissance faciale
              </button>
              {webauthnAvailable && (
                <button className="btn btn-secondary btn-block" onClick={startWebauthnFlow}>
                  <i className="fa-solid fa-fingerprint" style={{ marginRight: 8 }} />Empreinte digitale / Face ID
                </button>
              )}
            </>
          )}

          {step === 'face' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#0f172a', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 15 }}>{statusMsg}</p>
              <button className="btn btn-primary btn-block" disabled={!faceReady || busy} onClick={captureAndEnroll}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Analyse…</> : <><i className="fa-solid fa-camera" style={{ marginRight: 8 }} />Capturer</>}
              </button>
              <button className="btn btn-secondary btn-block" style={{ marginTop: 10 }} onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setStep('choice') }}>
                Annuler
              </button>
            </div>
          )}

          {step === 'webauthn' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <i className="fa-solid fa-fingerprint fa-beat" style={{ fontSize: 53, color: 'var(--primary)', marginBottom: 16, display: 'block' }} />
              <p style={{ color: 'var(--text-muted)' }}>Suivez les instructions de votre appareil pour valider votre empreinte…</p>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 53, color: 'var(--success)', marginBottom: 16, display: 'block' }} />
              <h3 style={{ marginBottom: 8 }}>Vérification enregistrée</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 15.5 }}>
                Vous serez identifié automatiquement à chaque accès à un examen.
              </p>
              <button className="btn btn-primary btn-block" onClick={() => router.push(redirect)}>
                Continuer
              </button>
            </div>
          )}
        </div>

        {step === 'choice' && (
          <p style={{ textAlign: 'center', marginTop: 20 }}>
            <Link href="/dashboard" style={{ color: 'var(--text-muted)', fontSize: 14.5 }}>Retour au tableau de bord</Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default function BiometricEnrollPage() {
  return (
    <Suspense fallback={null}>
      <BiometricEnrollInner />
    </Suspense>
  )
}
