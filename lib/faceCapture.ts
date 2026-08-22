// Capture faciale réutilisable (inscription biométrique + vérification à
// l'accès examen). Reprend le mécanisme de chargement de face-api.js déjà
// utilisé pendant l'examen (app/exam/[id]/page.tsx, local d'abord puis repli
// CDN) et le calcul de descripteur moyenné sur 3 frames — mais isolé de toute
// la logique de surveillance continue propre à la page d'examen (gaze
// baseline, snapshots liés à une tentative, etc.), qui reste inchangée là-bas.

const FACEAPI_MODEL_URL = '/models/faceapi'

export function loadFaceApi(): Promise<any> {
  return new Promise((resolve, reject) => {
    const fa = (window as any).faceapi
    const afterLoad = () => {
      const f = (window as any).faceapi
      Promise.all([
        f.nets.tinyFaceDetector.loadFromUri(FACEAPI_MODEL_URL),
        f.nets.faceLandmark68Net.loadFromUri(FACEAPI_MODEL_URL),
        f.nets.faceRecognitionNet.loadFromUri(FACEAPI_MODEL_URL),
      ]).then(() => resolve(f)).catch(reject)
    }
    if (fa) { afterLoad(); return }
    const s = document.createElement('script')
    s.src = '/vendor/face-api.js'
    s.onload = afterLoad
    s.onerror = () => {
      const cdn = document.createElement('script')
      cdn.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js'
      cdn.crossOrigin = 'anonymous'
      cdn.onload = afterLoad
      cdn.onerror = () => reject(new Error('face-api.js indisponible (local et CDN)'))
      document.head.appendChild(cdn)
    }
    document.head.appendChild(s)
  })
}

export interface FaceCaptureResult {
  descriptor: number[]
  snapshotDataUrl: string
}

// Capture 3 frames espacées de 1,5s et moyenne les descripteurs — même
// principe que captureReference() dans exam/[id]/page.tsx. Retourne null si
// aucun visage n'est détecté sur l'une des 3 frames (appelant : réessayer).
export async function captureAveragedDescriptor(video: HTMLVideoElement): Promise<FaceCaptureResult | null> {
  const fa = (window as any).faceapi
  if (!fa || video.readyState < 2) return null

  const opts = new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 })
  const captured: Float32Array[] = []
  for (let i = 0; i < 3; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1500))
    const det = await fa.detectSingleFace(video, opts).withFaceLandmarks().withFaceDescriptor()
    if (!det) return null
    captured.push(det.descriptor)
  }

  const size = captured[0].length
  const avg = new Float32Array(size)
  for (const d of captured) for (let j = 0; j < size; j++) avg[j] += d[j] / 3

  const c = document.createElement('canvas')
  c.width = 320; c.height = 240
  c.getContext('2d')!.drawImage(video, 0, 0, 320, 240)

  return {
    descriptor: Array.from(avg),
    snapshotDataUrl: c.toDataURL('image/jpeg', 0.8),
  }
}

// Équivalent de captureAveragedDescriptor mais pour une photo statique
// (upload) : un seul passage, pas de moyenne sur 3 frames (une image fixe ne
// varie pas d'une frame à l'autre). Retourne null si aucun visage détecté.
export async function captureDescriptorFromImage(img: HTMLImageElement): Promise<FaceCaptureResult | null> {
  const fa = (window as any).faceapi
  if (!fa) return null

  const opts = new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 })
  const det = await fa.detectSingleFace(img, opts).withFaceLandmarks().withFaceDescriptor()
  if (!det) return null

  const maxDim = 320
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * scale)
  c.height = Math.round(img.naturalHeight * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)

  return {
    descriptor: Array.from(det.descriptor as Float32Array),
    snapshotDataUrl: c.toDataURL('image/jpeg', 0.8),
  }
}

// Charge un fichier image (upload) dans un <img> hors-DOM, prêt pour
// face-api (nécessite que l'image soit décodée avant detectSingleFace).
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image illisible'))
    img.src = url
  })
}
