'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { loadFaceApi, captureFrame, captureDescriptorFromImage, loadImageFile, loadImageFromUrl, warmupFaceApi } from '@/lib/faceCapture'

// Sous-étapes du flux visage : choisir la source de la photo, capturer en
// direct, ou relire/valider la photo obtenue (caméra ou upload) avant de
// l'envoyer réellement au serveur — la capture et l'enregistrement sont deux
// actions distinctes, pas une seule (retour utilisateur du 22/08).
// Seule la reconnaissance faciale est proposée (WebAuthn/empreinte retiré le
// 24/08, retour utilisateur : trop encombrant pour les étudiants).
type FacePhase = 'pick' | 'camera' | 'preview'

function BiometricEnrollInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/dashboard'
  const { success, error: toastErr } = useToast()

  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [faceReady, setFaceReady] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [facePhase, setFacePhase] = useState<FacePhase>('pick')
  // descriptor est null tant que la photo (caméra) n'a pas encore été
  // analysée — l'analyse n'a lieu qu'à la validation (confirmEnrollment),
  // pas à la capture (retour utilisateur du 24/08 : la capture doit être
  // instantanée). Une photo téléversée, elle, est déjà analysée dès le choix
  // du fichier (onFileSelected) — pas de flux caméra à garder réactif là.
  const [preview, setPreview] = useState<{ snapshotDataUrl: string; descriptor: number[] | null } | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function startCameraCapture() {
    setFacePhase('camera')
    setFaceReady(false)
    setStatusMsg('Ouverture de la caméra…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
      setStatusMsg('Chargement du modèle de reconnaissance…')
      await loadFaceApi()
      // Absorbe ici le coût de compilation shader du tout premier passage
      // (voir warmupFaceApi) — pendant que l'étudiant patiente déjà pour le
      // chargement, pas au moment où il valide son inscription.
      if (videoRef.current) await warmupFaceApi(videoRef.current)
      setFaceReady(true)
      setStatusMsg('Regardez la caméra, restez immobile quelques secondes…')
    } catch (e: any) {
      toastErr(e.message || "Impossible d'accéder à la caméra")
      setFacePhase('pick')
    }
  }

  // Capture INSTANTANÉE — juste une photo, aucune analyse ici (retour
  // utilisateur du 24/08 : "je veux que tu me capture seulement l'image et
  // la vérification se fera rapidement une fois que la personne décide
  // d'enregistrer"). L'analyse (descriptor) n'a lieu qu'à confirmEnrollment.
  function captureNow() {
    if (!videoRef.current) return
    const snapshotDataUrl = captureFrame(videoRef.current)
    stopCamera()
    setPreview({ snapshotDataUrl, descriptor: null })
    setFacePhase('preview')
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
        toastErr('Aucun visage détecté sur cette photo — évitez le contre-jour ou la lumière directe, et choisissez-en une autre')
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
      let { descriptor, snapshotDataUrl } = preview
      // Photo caméra : jamais encore analysée (voir captureNow) — c'est ici,
      // au moment réel de l'enregistrement, que l'analyse a lieu.
      if (!descriptor) {
        setStatusMsg('Vérification du visage…')
        await loadFaceApi()
        const img = await loadImageFromUrl(snapshotDataUrl)
        const analyzed = await captureDescriptorFromImage(img)
        if (!analyzed) {
          toastErr('Aucun visage détecté — vérifiez votre éclairage (évitez le contre-jour et la lumière directe) et reprenez la photo')
          return
        }
        descriptor = analyzed.descriptor
        snapshotDataUrl = analyzed.snapshotDataUrl
      }
      await api.post('/api/biometric/enroll/face', { descriptor, image_data: snapshotDataUrl })
      setDone(true)
      success('Reconnaissance faciale enregistrée')
    } catch (e: any) {
      toastErr(e.message || "Échec de l'inscription")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: 'var(--primary)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="fa-solid fa-camera" style={{ fontSize: 31, color: 'white' }} />
          </div>
          <h1 style={{ fontSize: 26.5, fontWeight: 700, marginBottom: 4 }}>Vérification d'identité</h1>
          <p style={{ color: 'var(--text-muted)' }}>Requise pour accéder à vos examens</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {!done && facePhase === 'pick' && (
            <div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 15.5, lineHeight: 1.6 }}>
                Votre identification se fera par reconnaissance faciale avant chaque examen. Cette étape n'est à faire qu'une seule fois — vous pourrez la refaire depuis vos paramètres si besoin. Prenez une photo avec votre caméra, ou téléversez-en une déjà existante.
              </p>
              <button className="btn btn-primary btn-block" style={{ marginBottom: 12 }} disabled={busy} onClick={startCameraCapture}>
                <i className="fa-solid fa-camera" style={{ marginRight: 8 }} />Prendre une photo
              </button>
              <button className="btn btn-secondary btn-block" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />{statusMsg || 'Analyse…'}</> : <><i className="fa-solid fa-upload" style={{ marginRight: 8 }} />Téléverser une photo</>}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileSelected} />
            </div>
          )}

          {!done && facePhase === 'camera' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#0f172a', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                {/* Guide de cadrage — purement visuel (aucun effet sur la
                    capture/analyse), aide juste l'étudiant à bien centrer
                    son visage avant de cliquer sur "Capturer". */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: '52%', height: '78%', borderRadius: '50%', borderWidth: 4, borderStyle: 'solid', borderColor: faceReady ? '#3b82f6' : 'rgba(255,255,255,.8)', boxShadow: `0 0 0 2000px rgba(15,23,42,.55), 0 0 16px 2px ${faceReady ? 'rgba(59,130,246,.6)' : 'rgba(255,255,255,.3)'}`, transition: 'border-color .2s, box-shadow .2s' }} />
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 15 }}>{statusMsg}</p>
              <button className="btn btn-primary btn-block" disabled={!faceReady} onClick={captureNow}>
                <i className="fa-solid fa-camera" style={{ marginRight: 8 }} />Capturer
              </button>
              <button className="btn btn-secondary btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={() => { stopCamera(); setFacePhase('pick') }}>
                Annuler
              </button>
            </div>
          )}

          {!done && facePhase === 'preview' && preview && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 15.5 }}>Vérifiez que votre visage est bien visible avant de valider.</p>
              <img src={preview.snapshotDataUrl} alt="Photo capturée" style={{ width: '100%', maxWidth: 280, aspectRatio: '4/3', objectFit: 'cover', borderRadius: 12, marginBottom: 20, border: '2px solid var(--border)' }} />
              <button className="btn btn-primary btn-block" style={{ marginBottom: 10 }} disabled={busy} onClick={confirmEnrollment}>
                {busy ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />{statusMsg || 'Enregistrement…'}</> : <><i className="fa-solid fa-check" style={{ marginRight: 8 }} />Valider et enregistrer</>}
              </button>
              <button className="btn btn-secondary btn-block" disabled={busy} onClick={retakePhoto}>
                Reprendre une photo
              </button>
            </div>
          )}

          {done && (
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

        {!done && facePhase === 'pick' && (
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
