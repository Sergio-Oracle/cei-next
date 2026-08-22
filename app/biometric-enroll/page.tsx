'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { loadFaceApi, captureAveragedDescriptor, captureDescriptorFromImage, loadImageFile, FaceCaptureResult } from '@/lib/faceCapture'
import { isPlatformAuthenticatorAvailable, registerCredential } from '@/lib/webauthnClient'

type Method = 'choice' | 'face' | 'webauthn' | 'done'
// Sous-étapes du flux visage : choisir la source de la photo, capturer en
// direct, ou relire/valider la photo obtenue (caméra ou upload) avant de
// l'envoyer réellement au serveur — la capture et l'enregistrement sont deux
// actions distinctes, pas une seule (retour utilisateur du 22/08).
type FacePhase = 'pick' | 'camera' | 'preview'

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
  const [facePhase, setFacePhase] = useState<FacePhase>('pick')
  const [preview, setPreview] = useState<FaceCaptureResult | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setWebauthnAvailable)
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function enterFaceChoice() {
    setStep('face')
    setFacePhase('pick')
    setPreview(null)
  }

  async function startCameraCapture() {
    setFacePhase('camera')
    setFaceReady(false)
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
      setFacePhase('pick')
    }
  }

  // Capture uniquement — l'envoi au serveur n'a lieu qu'après validation
  // explicite de l'aperçu (confirmEnrollment), pas ici.
  async function captureNow() {
    if (!videoRef.current) return
    setBusy(true)
    setStatusMsg('Capture en cours…')
    try {
      const result = await captureAveragedDescriptor(videoRef.current)
      if (!result) {
        toastErr('Aucun visage détecté — repositionnez-vous face à la caméra et réessayez')
        return
      }
      stopCamera()
      setPreview(result)
      setFacePhase('preview')
    } catch (e: any) {
      toastErr(e.message || 'Échec de la capture')
    } finally {
      setBusy(false)
    }
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier ensuite
    if (!file) return
    setBusy(true)
    setStatusMsg('Analyse de la photo…')
    try {
      await loadFaceApi()
      const img = await loadImageFile(file)
      const result = await captureDescriptorFromImage(img)
      if (!result) {
        toastErr('Aucun visage détecté sur cette photo — choisissez-en une autre')
        return
      }
      setPreview(result)
      setFacePhase('preview')
    } catch (e: any) {
      toastErr(e.message || "Impossible d'analyser cette photo")
    } finally {
      setBusy(false)
    }
  }

  function retakePhoto() {
    setPreview(null)
    setFacePhase('pick')
  }

  async function confirmEnrollment() {
    if (!preview) return
    setBusy(true)
    try {
      await api.post('/api/biometric/enroll/face', { descriptor: preview.descriptor, image_data: preview.snapshotDataUrl })
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
              <button className="btn btn-primary btn-block" style={{ marginBottom: 12 }} onClick={enterFaceChoice}>
                <i className="fa-solid fa-camera" style={{ marginRight: 8 }} />Reconnaissance faciale
              </button>
              {webauthnAvailable && (
                <button className="btn btn-secondary btn-block" onClick={startWebauthnFlow}>
                  <i className="fa-solid fa-fingerprint" style={{ marginRight: 8 }} />Empreinte digitale / Face ID
                </button>
              )}
            </>
          )}

          {step === 'face' && facePhase === 'pick' && (
            <div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 15.5, lineHeight: 1.6 }}>
                Prenez une photo avec votre caméra, ou téléversez-en une déjà existante.
              </p>
              <button className="btn btn-primary btn-block" style={{ marginBottom: 12 }} disabled={busy} onClick={startCameraCapture}>
                <i className="fa-solid fa-camera" style={{ marginRight: 8 }} />Prendre une photo
              </button>
              <button className="btn btn-secondary btn-block" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />{statusMsg || 'Analyse…'}</> : <><i className="fa-solid fa-upload" style={{ marginRight: 8 }} />Téléverser une photo</>}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileSelected} />
              <button className="btn btn-secondary btn-block" style={{ marginTop: 10, background: 'transparent' }} disabled={busy} onClick={() => setStep('choice')}>
                Retour
              </button>
            </div>
          )}

          {step === 'face' && facePhase === 'camera' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#0f172a', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 15 }}>{statusMsg}</p>
              <button className="btn btn-primary btn-block" disabled={!faceReady || busy} onClick={captureNow}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Analyse…</> : <><i className="fa-solid fa-camera" style={{ marginRight: 8 }} />Capturer</>}
              </button>
              <button className="btn btn-secondary btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={() => { stopCamera(); setFacePhase('pick') }}>
                Annuler
              </button>
            </div>
          )}

          {step === 'face' && facePhase === 'preview' && preview && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 15.5 }}>Vérifiez que votre visage est bien visible avant de valider.</p>
              <img src={preview.snapshotDataUrl} alt="Photo capturée" style={{ width: '100%', maxWidth: 280, aspectRatio: '4/3', objectFit: 'cover', borderRadius: 12, marginBottom: 20, border: '2px solid var(--border)' }} />
              <button className="btn btn-primary btn-block" style={{ marginBottom: 10 }} disabled={busy} onClick={confirmEnrollment}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Enregistrement…</> : <><i className="fa-solid fa-check" style={{ marginRight: 8 }} />Valider et enregistrer</>}
              </button>
              <button className="btn btn-secondary btn-block" disabled={busy} onClick={retakePhoto}>
                Reprendre une photo
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
