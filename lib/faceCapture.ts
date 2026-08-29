// Capture faciale réutilisable (inscription biométrique + vérification à
// l'accès examen). Reprend le mécanisme de chargement de face-api.js déjà
// utilisé pendant l'examen (app/exam/[id]/page.tsx, local d'abord puis repli
// CDN) et le calcul de descripteur moyenné sur 3 frames — mais isolé de toute
// la logique de surveillance continue propre à la page d'examen (gaze
// baseline, snapshots liés à une tentative, etc.), qui reste inchangée là-bas.

const FACEAPI_MODEL_URL = '/models/faceapi'

// Retour utilisateur (28/08) : la vérification échouait par forte luminosité
// (soleil direct dans la salle) — contre-jour ou surexposition qui écrase le
// contraste du visage sans forcément faire disparaître tout détail
// exploitable. Ni l'inscription ni la vérification n'appliquaient jusqu'ici
// le moindre traitement d'image avant le calcul du descripteur (confirmé en
// lisant le code — voir captureSingleDescriptor/captureDescriptorFromImage
// ci-dessous, qui dessinaient la frame brute puis appelaient directement
// detectSingleFace). Étire l'histogramme de luminance vers la pleine plage
// 0-255 avant la détection — atténue l'écart entre inscription et
// vérification dans les deux sens (trop clair comme trop sombre), sans
// dépendre d'un éclairage contrôlé. N'altère jamais la photo réellement
// stockée (image_data envoyée au serveur) — seule la copie utilisée pour la
// détection est corrigée.
function normalizeLighting(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imgData.data
  let min = 255, max = 0
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (luma < min) min = luma
    if (luma > max) max = luma
  }
  const range = max - min
  // Image quasi unie (caméra bouchée, obscurité totale...) — étirer un
  // histogramme aussi plat amplifierait surtout du bruit, sans rien
  // récupérer d'exploitable. On laisse tel quel dans ce cas.
  if (range < 12) return
  const scale = 255 / range
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.max(0, Math.min(255, (data[i] - min) * scale))
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - min) * scale))
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - min) * scale))
  }
  ctx.putImageData(imgData, 0, 0)
}

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

// Déclenche une inférence "à vide" (résultat ignoré) juste après le
// chargement des modèles — le tout premier appel WebGL réel compile les
// shaders à la volée, un coût ponctuel mais mesuré comme important (vérifié
// en réel via Playwright : jusqu'à plusieurs secondes selon l'accélération
// GPU disponible). Sans cet appel, ce coût retombait entièrement sur le
// premier vrai detectSingleFace — donc sur la vérification à l'accès examen,
// ou sur la validation d'inscription depuis que celle-ci diffère l'analyse
// (retour utilisateur du 24/08). Ici il est absorbé PENDANT le chargement,
// une attente déjà attendue par l'étudiant, plutôt qu'au moment où il pense
// avoir fini. Utilise le flux vidéo réel (pas un canvas vide) pour que les
// 3 réseaux (détecteur, repères, descripteur) soient tous sollicités au
// moins une fois — un canvas vide sans visage détecté court-circuiterait la
// chaîne avant les deux derniers réseaux.
export async function warmupFaceApi(video: HTMLVideoElement): Promise<void> {
  const fa = (window as any).faceapi
  if (!fa || video.readyState < 2) return
  try {
    const opts = new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 })
    await fa.detectSingleFace(video, opts).withFaceLandmarks().withFaceDescriptor()
  } catch {}
}

// Capture INSTANTANÉE d'une seule frame — aucun appel face-api ici (retour
// utilisateur du 24/08 : la capture doit être immédiate ; l'analyse
// (detectSingleFace) n'a lieu qu'au moment où l'utilisateur valide
// réellement l'inscription, voir captureDescriptorFromImage + loadImageFromUrl
// plus bas). Résolution native du flux — c'est la photo d'identité, la
// netteté prime sur la légèreté.
export function captureFrame(video: HTMLVideoElement): string {
  const c = document.createElement('canvas')
  c.width = video.videoWidth || 640
  c.height = video.videoHeight || 480
  c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.92)
}

// Détection en un seul passage sur le flux vidéo en direct — utilisée pour
// la VÉRIFICATION à l'accès examen (verifyFaceAndResume), où il n'y a pas
// d'étape de confirmation séparée à laquelle différer l'analyse : cliquer
// "Vérifier mon identité" doit produire un résultat rapidement. Remplace
// l'ancien design à 3 passes + pauses de 1,5s (captureAveragedDescriptor,
// retiré le 24/08 — bien plus lent sans gain de fiabilité justifiant
// l'attente pour ce cas d'usage précis).
export async function captureSingleDescriptor(video: HTMLVideoElement): Promise<FaceCaptureResult | null> {
  const fa = (window as any).faceapi
  if (!fa || video.readyState < 2) return null

  const detectScale = Math.min(1, 640 / Math.max(video.videoWidth || 640, video.videoHeight || 480))
  const detectCanvas = document.createElement('canvas')
  detectCanvas.width = Math.round((video.videoWidth || 640) * detectScale)
  detectCanvas.height = Math.round((video.videoHeight || 480) * detectScale)
  detectCanvas.getContext('2d')!.drawImage(video, 0, 0, detectCanvas.width, detectCanvas.height)
  normalizeLighting(detectCanvas)

  const opts = new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 })
  const det = await fa.detectSingleFace(detectCanvas, opts).withFaceLandmarks().withFaceDescriptor()
  if (!det) return null

  return {
    descriptor: Array.from(det.descriptor as Float32Array),
    snapshotDataUrl: captureFrame(video),
  }
}

// Équivalent de captureAveragedDescriptor mais pour une photo statique
// (upload) : un seul passage, pas de moyenne sur 3 frames (une image fixe ne
// varie pas d'une frame à l'autre). Retourne null si aucun visage détecté.
export async function captureDescriptorFromImage(img: HTMLImageElement): Promise<FaceCaptureResult | null> {
  const fa = (window as any).faceapi
  if (!fa) return null

  // Ne réduit que si la photo dépasse largement une taille HD raisonnable —
  // ne jamais dégrader une photo déjà correcte (min(1, ...) empêche aussi
  // tout agrandissement d'une petite photo).
  const maxDim = 1280
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * scale)
  c.height = Math.round(img.naturalHeight * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)

  // Détection sur une copie normalisée (voir normalizeLighting ci-dessus) —
  // la photo réellement stockée (snapshotDataUrl, tirée de `c` non modifié)
  // reste la photo naturelle, seule l'entrée de detectSingleFace est corrigée.
  const detectCanvas = document.createElement('canvas')
  detectCanvas.width = c.width
  detectCanvas.height = c.height
  detectCanvas.getContext('2d')!.drawImage(c, 0, 0)
  normalizeLighting(detectCanvas)

  const opts = new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 })
  const det = await fa.detectSingleFace(detectCanvas, opts).withFaceLandmarks().withFaceDescriptor()
  if (!det) return null

  return {
    descriptor: Array.from(det.descriptor as Float32Array),
    snapshotDataUrl: c.toDataURL('image/jpeg', 0.92),
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

// Recharge une data URL déjà capturée (captureFrame) dans un <img> hors-DOM
// — utilisée pour analyser, au moment de la validation seulement, une photo
// prise instantanément par captureFrame (voir plus haut).
export function loadImageFromUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image illisible'))
    img.src = dataUrl
  })
}
