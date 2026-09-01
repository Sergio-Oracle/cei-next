'use client'

/**
 * Moteur de vision par ordinateur pour la surveillance d'examen — MediaPipe
 * Tasks Vision (FaceLandmarker + ObjectDetector), 100% côté navigateur
 * (WASM, aucun appel serveur, aucune donnée vidéo ne quitte l'ordinateur de
 * l'étudiant pour l'inférence elle-même).
 *
 * Vient EN COMPLÉMENT de face-api.js (toujours utilisé dans app/exam/[id]
 * pour le comptage de visages et la reconnaissance d'identité par
 * descripteur — MediaPipe Tasks Vision ne fournit pas de tâche de
 * reconnaissance faciale équivalente, donc pas de régression volontaire ici).
 *
 * Nouveaux signaux apportés :
 *  - regard (position de l'iris dans le globe oculaire)
 *  - orientation de la tête (lacet, dérivé de la géométrie du contour du
 *    visage plutôt que de la matrice de transformation — évite toute
 *    ambiguïté de convention ligne/colonne non vérifiable sans caméra réelle)
 *  - ouverture de bouche (parole/chuchotement) via le blendshape "jawOpen"
 *  - clignement des yeux (sert aussi au contrôle de vivacité, voir Phase 7)
 *  - détection d'objets interdits (téléphone, livre, second écran)
 */

import {
  FilesetResolver,
  FaceLandmarker,
  ObjectDetector,
} from '@mediapipe/tasks-vision'

// Le type Connection n'est pas exporté par le module (interne à la lib) —
// on redéclare sa forme minimale utilisée ici (start/end : indices de repères).
interface Connection { start: number; end: number }

// Hébergés localement en priorité (mêmes fichiers que le CDN, copiés sous
// /public) — l'examen ne doit pas dépendre de la disponibilité d'un CDN
// externe pendant la composition. Le CDN reste en secours automatique si
// jamais les fichiers locaux sont absents/corrompus (ex. déploiement
// incomplet), pour ne jamais perdre totalement la surveillance par vision.
const WASM_BASE_LOCAL      = '/mediapipe/wasm'
const WASM_BASE_CDN        = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm'
const FACE_MODEL_LOCAL     = '/models/mediapipe/face_landmarker.task'
const FACE_MODEL_CDN       = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
// EfficientDet-Lite2 (int8) plutôt que Lite0 (22/08, retour utilisateur sur
// des objets/écrans non détectés pendant le scan environnemental) — backbone
// plus profond, précision COCO nettement supérieure (~33 mAP vs ~26 pour
// Lite0), et la version quantifiée int8 est même plus légère (7,5 Mo contre
// 13,8 Mo pour l'ancien Lite0 float32) donc pas de régression de temps de
// chargement malgré le modèle plus capable.
const OBJECT_MODEL_LOCAL   = '/models/mediapipe/efficientdet_lite2.tflite'
const OBJECT_MODEL_CDN     = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/int8/1/efficientdet_lite2.tflite'

let faceLandmarker: FaceLandmarker | null = null
let objectDetector: ObjectDetector | null = null
let initPromise: Promise<boolean> | null = null

export function isProctoringVisionReady() { return !!faceLandmarker }

async function loadVisionModels(wasmBase: string, faceModelUrl: string, objectModelUrl: string) {
  const vision = await FilesetResolver.forVisionTasks(wasmBase)
  return Promise.all([
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: faceModelUrl, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 3,
      minFaceDetectionConfidence: 0.5,
      outputFaceBlendshapes: true,
      // Correctif (01/09, retour utilisateur — regard/tête plus détectés du
      // tout après le 27/08) : la matrice de rotation 3D activée ce jour-là
      // (Phase X, point B) n'a jamais été vérifiée sur une vraie webcam (le
      // commentaire d'origine le disait déjà : "le SIGNE de chaque angle...
      // n'est vérifiable qu'avec une vraie caméra"). Redésactivée — retour à
      // l'heuristique 2D simple (écart du nez vs centre du contour du
      // visage) confirmée fonctionner en usage réel avant cette date.
      outputFacialTransformationMatrixes: false,
    }),
    ObjectDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: objectModelUrl, delegate: 'CPU' },
      runningMode: 'VIDEO',
      // Seuil du MODÈLE volontairement bas (0.3) — c'est un plancher, pas le
      // seuil final : chaque appelant (analyzeObjects) applique son propre
      // minScore par-dessus, plus strict en cours d'examen (0.5) que pendant
      // le scan environnemental (0.35, voir analyzeObjects ci-dessous). Fixer
      // 0.5 ou 0.65 directement ICI empêchait le scan environnemental de
      // jamais voir les détections à confiance intermédiaire (retour
      // utilisateur du 22/08 : un second écran pourtant visible n'était
      // jamais remonté par le modèle, pas juste filtré trop tard).
      scoreThreshold: 0.3,
      maxResults: 5,
      // 'person' inclus : nécessaire au scan environnement 360° (Phase 1)
      // qui compte les personnes présentes, pas seulement les objets suspects.
      categoryAllowlist: ['cell phone', 'book', 'laptop', 'tv', 'remote', 'tablet', 'person'],
    }),
  ])
}

/** Charge les deux modèles en parallèle, local d'abord puis CDN en secours.
 * Dégradation silencieuse seulement si les DEUX sources échouent (réseau,
 * navigateur non supporté) : retourne false, l'appelant doit continuer sans
 * ces signaux plutôt que bloquer l'examen. */
export async function initProctoringVision(): Promise<boolean> {
  if (faceLandmarker && objectDetector) return true
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      const [fl, od] = await loadVisionModels(WASM_BASE_LOCAL, FACE_MODEL_LOCAL, OBJECT_MODEL_LOCAL)
      faceLandmarker = fl
      objectDetector = od
      return true
    } catch (localErr) {
      console.warn('[proctoring-vision] échec chargement local, repli CDN', localErr)
      try {
        const [fl, od] = await loadVisionModels(WASM_BASE_CDN, FACE_MODEL_CDN, OBJECT_MODEL_CDN)
        faceLandmarker = fl
        objectDetector = od
        return true
      } catch (cdnErr) {
        console.warn('[proctoring-vision] échec chargement CDN également', cdnErr)
        faceLandmarker = null
        objectDetector = null
        return false
      }
    }
  })()
  return initPromise
}

/* ── Indices de repères dérivés des connecteurs officiels MediaPipe ──────────
   Jamais de nombres "magiques" codés en dur : les groupes de repères
   (contour de l'œil, iris, contour du visage) sont dérivés à l'exécution des
   constantes FaceLandmarker.FACE_LANDMARKS_* elles-mêmes. */
function indicesFromConnections(connections: Connection[]): number[] {
  const s = new Set<number>()
  connections.forEach(c => { s.add(c.start); s.add(c.end) })
  return [...s]
}

let leftIrisIdx: number[] = [], rightIrisIdx: number[] = []
let leftEyeIdx: number[] = [], rightEyeIdx: number[] = []
let ovalIdx: number[] = []

function ensureIndices() {
  if (leftIrisIdx.length) return
  leftIrisIdx = indicesFromConnections(FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS)
  rightIrisIdx = indicesFromConnections(FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS)
  leftEyeIdx = indicesFromConnections(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE)
  rightEyeIdx = indicesFromConnections(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE)
  ovalIdx = indicesFromConnections(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL)
}

interface Pt { x: number; y: number }

function centroid(landmarks: Pt[], idx: number[]): Pt {
  let sx = 0, sy = 0
  for (const i of idx) { sx += landmarks[i].x; sy += landmarks[i].y }
  return { x: sx / idx.length, y: sy / idx.length }
}
function bbox(landmarks: Pt[], idx: number[]) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const i of idx) {
    const p = landmarks[i]
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
  }
  return { minX, maxX, minY, maxY }
}

export interface FaceSignal {
  faceCount: number
  /** 0 = extrême gauche, 0.5 = centre, 1 = extrême droite ; null si non calculable */
  gazeX: number | null
  /** 0 = haut, 0.5 = centre, 1 = bas */
  gazeY: number | null
  /** -1 = tête tournée à gauche, 0 = face caméra, 1 = à droite */
  headYaw: number | null
  /** 0-1, "jawOpen" — plus haut = bouche plus ouverte (parole probable) */
  mouthOpen: number | null
  blinkLeft: number | null
  blinkRight: number | null
}

export function analyzeFace(video: HTMLVideoElement, timestampMs: number): FaceSignal | null {
  if (!faceLandmarker) return null
  ensureIndices()
  let result
  try { result = faceLandmarker.detectForVideo(video, timestampMs) } catch { return null }
  const faceCount = result.faceLandmarks?.length || 0
  if (faceCount === 0 || !result.faceLandmarks[0]) {
    return { faceCount, gazeX: null, gazeY: null, headYaw: null, mouthOpen: null, blinkLeft: null, blinkRight: null }
  }

  const landmarks = result.faceLandmarks[0] as Pt[]
  const leftIris = centroid(landmarks, leftIrisIdx)
  const rightIris = centroid(landmarks, rightIrisIdx)
  const leftEyeBox = bbox(landmarks, leftEyeIdx)
  const rightEyeBox = bbox(landmarks, rightEyeIdx)
  const ratio = (v: number, min: number, max: number) => (max > min ? (v - min) / (max - min) : null)
  const gazeXLeft = ratio(leftIris.x, leftEyeBox.minX, leftEyeBox.maxX)
  const gazeXRight = ratio(rightIris.x, rightEyeBox.minX, rightEyeBox.maxX)
  const gazeYLeft = ratio(leftIris.y, leftEyeBox.minY, leftEyeBox.maxY)
  const gazeYRight = ratio(rightIris.y, rightEyeBox.minY, rightEyeBox.maxY)
  const avg2 = (a: number | null, b: number | null) => (a !== null && b !== null ? (a + b) / 2 : a ?? b)
  const gazeX = avg2(gazeXLeft, gazeXRight)
  const gazeY = avg2(gazeYLeft, gazeYRight)

  // Lacet de la tête : écart du nez (repère 1, le plus stable de la
  // topologie MediaPipe Face Mesh) par rapport au centre du contour du
  // visage — géométrie simple, sans dépendre de la convention de la
  // matrice de transformation faciale (non vérifiable sans caméra réelle).
  const nose = landmarks[1]
  const ovalBox = bbox(landmarks, ovalIdx)
  const ovalCenterX = (ovalBox.minX + ovalBox.maxX) / 2
  const ovalHalfWidth = (ovalBox.maxX - ovalBox.minX) / 2
  const headYaw = nose && ovalHalfWidth > 0
    ? Math.max(-1, Math.min(1, ((nose.x - ovalCenterX) / ovalHalfWidth) * -1))
    : null

  let mouthOpen: number | null = null, blinkLeft: number | null = null, blinkRight: number | null = null
  const blendshapes = result.faceBlendshapes?.[0]?.categories
  if (blendshapes) {
    for (const c of blendshapes) {
      if (c.categoryName === 'jawOpen') mouthOpen = c.score
      else if (c.categoryName === 'eyeBlinkLeft') blinkLeft = c.score
      else if (c.categoryName === 'eyeBlinkRight') blinkRight = c.score
    }
  }

  return { faceCount, gazeX, gazeY, headYaw, mouthOpen, blinkLeft, blinkRight }
}

export interface ObjectSignal {
  phoneDetected: boolean
  bookDetected: boolean
  otherScreenDetected: boolean
  labels: string[]
  /** Détail avec score de confiance par détection retenue — utile pour les
   * journaux d'audit (le surveillant/professeur voit la confiance réelle,
   * pas juste "détecté"). */
  matches: { label: string; score: number }[]
}

const SUSPECT_LABELS: Record<string, 'phone' | 'book' | 'screen'> = {
  'cell phone': 'phone',
  'remote': 'phone',
  'book': 'book',
  'laptop': 'screen',
  'tv': 'screen',
  'tablet': 'screen',
}

/** minScore : seuil de confiance appliqué EN PLUS de celui, plus permissif,
 * configuré sur le modèle lui-même (voir scoreThreshold ci-dessus). Deux
 * usages avec des enjeux différents partagent le même modèle chargé :
 *  - en cours d'examen (visionEnrichedTick), minScore par défaut (0.5) —
 *    une fausse alerte accuse à tort un étudiant, donc on reste strict ;
 *  - pendant le scan environnemental 360° (un seul passage, purement
 *    informatif, jamais compté comme fraude), l'appelant passe un seuil
 *    plus bas (ex. 0.35) — un signalement en trop y coûte beaucoup moins
 *    qu'un vrai second écran manqué (retour utilisateur du 22/08 : un écran
 *    pourtant visible n'était pas détecté avec le seuil unique à 0.5). */
export function analyzeObjects(video: HTMLVideoElement, timestampMs: number, minScore = 0.5): ObjectSignal | null {
  if (!objectDetector) return null
  let result
  try { result = objectDetector.detectForVideo(video, timestampMs) } catch { return null }
  const matches = (result.detections || [])
    .map(d => d.categories[0])
    .filter((c): c is NonNullable<typeof c> => !!c && !!c.categoryName && c.score >= minScore)
    .map(c => ({ label: c.categoryName, score: c.score }))
  const labels = matches.map(m => m.label)
  return {
    phoneDetected: labels.some(l => SUSPECT_LABELS[l] === 'phone'),
    bookDetected: labels.some(l => SUSPECT_LABELS[l] === 'book'),
    otherScreenDetected: labels.some(l => SUSPECT_LABELS[l] === 'screen'),
    labels,
    matches,
  }
}

/** Utilisée par le scan environnement 360° (Phase 1) : compte uniquement
 * les personnes, sans les autres signaux (plus rapide). */
export function countPeople(video: HTMLVideoElement, timestampMs: number): number | null {
  if (!objectDetector) return null
  let result
  try { result = objectDetector.detectForVideo(video, timestampMs) } catch { return null }
  return (result.detections || []).filter(d => d.categories[0]?.categoryName === 'person').length
}
