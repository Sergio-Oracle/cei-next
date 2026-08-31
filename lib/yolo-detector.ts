'use client'

/**
 * Détecteur d'objets YOLO26n — second modèle, INDÉPENDANT du détecteur
 * MediaPipe EfficientDet-Lite2 déjà en place (lib/proctoring-vision.ts),
 * pour CORROBORER ses détections plutôt que les remplacer (31/08, retour
 * utilisateur : "renforcer les modèles déjà présents... vraiment fiable
 * et robuste").
 *
 * En cours d'examen (visionEnrichedTick, exam/[id]/page.tsx), ne tourne
 * JAMAIS en continu comme EfficientDet — appelé une seule fois, à la
 * demande, au moment précis où EfficientDet a déjà atteint son propre
 * seuil de détection et s'apprête à déclencher une alerte. Coût CPU
 * inchangé en régime normal (pas de second modèle tournant toutes les
 * 5s), tout en apportant une vraie vérification indépendante au moment où
 * elle compte : deux architectures différentes d'accord sur la même
 * catégorie d'objet est une preuve nettement plus fiable qu'un seul
 * modèle (voir le commentaire sur 'suspect_object_detected' dans
 * proctoring_risk_map, cei-api-v2/proctoring_routes.py — poids
 * volontairement abaissé de 25 à 12 à cause d'un problème documenté de
 * confusion main/objet avec un seul modèle).
 *
 * Pendant le scan environnement 360° AVANT l'examen (runEnvironmentScan,
 * même fichier — 31/08, retour utilisateur : "je veux que Yolo participe
 * aussi au scan de l'environnement"), la contrainte de coût CPU continu
 * ci-dessus ne s'applique pas (scan court, unique, borné à 8s) : YOLO y
 * tourne à CHAQUE échantillon en parallèle d'EfficientDet, comme un
 * second détecteur à part entière plutôt qu'un simple corroborateur —
 * le nombre de personnes retenu est le MAXIMUM des deux modèles (un faux
 * positif y coûte juste un nouveau balayage, un faux négatif laisserait
 * passer une vraie personne supplémentaire non détectée dans la pièce).
 *
 * 100% côté navigateur, comme le reste du pipeline vision (voir l'en-tête
 * de proctoring-vision.ts) — aucune image ne quitte l'ordinateur de
 * l'étudiant pour l'inférence.
 *
 * Modèle : YOLO26n (Ultralytics, licence AGPL-3.0 — acceptée explicitement
 * par l'utilisateur ; l'alternative permissive proposée, YOLOX/Apache 2.0,
 * a été refusée en faveur du modèle le plus reconnu/outillé). Remplace
 * YOLOv8n (31/08, même jour, benchmark réel avant migration — voir plus bas) :
 * architecture "end-to-end" native, la suppression des doublons (NMS) est
 * intégrée à l'entraînement du modèle lui-même, pas ajoutée après coup à
 * l'export (contrairement à YOLOv8n où `nms=True` insérait un bloc NMS
 * séparé dans le graphe) — la sortie reste néanmoins exactement la même
 * forme [x1,y1,x2,y2,conf,cls] par détection, donc aucun changement de la
 * logique de décodage ci-dessous. Aucun décodage de grille ni NMS à écrire
 * à la main côté client (zone à haut risque de bug qu'aucune webcam réelle
 * ne permet de vérifier dans cet environnement de développement — voir la
 * validation faite hors-navigateur, en Python, avant l'intégration :
 * pipeline de prétraitement identique, exécuté sur une vraie photo,
 * détections cohérentes et confiantes). Quantifié en int8 (2,9 Mo, plus
 * léger que le 3,5 Mo de l'ancien YOLOv8n ET que le 7,5 Mo
 * d'efficientdet_lite2.tflite déjà utilisé) — public/models/yolo/yolo26n.onnx.
 *
 * Migration décidée après comparaison réelle (pas sur la seule base de
 * l'annonce Ultralytics) : sur une même photo réelle difficile (téléphone
 * partiellement tenu en main, angle défavorable — le cas exact remonté par
 * l'utilisateur comme non détecté), confiance du téléphone passée de 40%
 * (YOLOv8n) à 76% (YOLO26n), fichier plus petit, coût CPU +25% par
 * inférence — acceptable vu la cadence déjà faible (jamais en continu, voir
 * plus bas).
 *
 * IMPORTANT — contrairement aux modèles MediaPipe, il n'existe aucun
 * miroir CDN externe faisant autorité pour CE fichier .onnx précis (export
 * + quantification propres à ce projet) : les POIDS restent donc
 * local-only. Seul le RUNTIME WASM générique d'onnxruntime-web (le moteur
 * d'exécution, pas le modèle) a un vrai miroir CDN pérenne (jsDelivr),
 * utilisé en repli comme pour le WASM MediaPipe.
 */

import * as ort from 'onnxruntime-web/wasm'

// Version figée pour que le repli CDN pointe vers exactement les mêmes
// fichiers que ceux self-hébergés (voir package.json) — à mettre à jour
// ensemble si la dépendance est un jour montée de version.
const ORT_VERSION = '1.29.0'
const WASM_BASE_LOCAL = '/models/ort/'
const WASM_BASE_CDN   = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`
const YOLO_MODEL_URL  = '/models/yolo/yolo26n.onnx' // local uniquement, voir en-tête

const INPUT_SIZE = 640

let session: ort.InferenceSession | null = null
let initPromise: Promise<boolean> | null = null

export function isYoloReady() { return !!session }

/** Charge le runtime ONNX (WASM local d'abord, CDN en secours) puis le
 * modèle YOLO26n. Dégradation silencieuse si tout échoue (réseau,
 * navigateur non supporté) : retourne false, l'appelant continue avec
 * EfficientDet seul (voir isYoloReady() dans exam/[id]/page.tsx) — jamais
 * bloquant pour l'étudiant. */
export async function initYoloDetector(): Promise<boolean> {
  if (session) return true
  if (initPromise) return initPromise
  initPromise = (async () => {
    // Un seul thread : évite d'exiger les en-têtes COOP/COEP (aucun n'est
    // posé actuellement par ce projet) nécessaires au WASM multi-thread
    // (SharedArrayBuffer). "no worker thread will be spawned" (doc
    // onnxruntime-web) — le fichier .wasm reste le même, juste exécuté en
    // mono-thread. Coût CPU du modèle lui-même reste faible de toute façon
    // : appelé une seule fois par candidat, jamais en continu (voir
    // en-tête du fichier).
    ort.env.wasm.numThreads = 1
    ort.env.wasm.simd = true
    for (const base of [WASM_BASE_LOCAL, WASM_BASE_CDN]) {
      try {
        ort.env.wasm.wasmPaths = base
        session = await ort.InferenceSession.create(YOLO_MODEL_URL, { executionProviders: ['wasm'] })
        return true
      } catch (err) {
        console.warn(`[yolo-detector] échec chargement (wasm=${base})`, err)
      }
    }
    session = null
    return false
  })()
  return initPromise
}

export interface YoloMatch { label: string; score: number; classId: number }
export interface YoloSignal {
  phoneDetected: boolean
  bookDetected: boolean
  otherScreenDetected: boolean
  matches: YoloMatch[]
  /** Nombre de détections "person" (classe COCO 0) au-dessus de minScore —
   * calculé dans le MÊME passage d'inférence que les objets suspects (le
   * modèle détecte déjà toutes les classes à chaque appel, pas de coût
   * supplémentaire). Utilisé par le scan environnement 360° (31/08, retour
   * utilisateur : "je veux que Yolo participe aussi au scan") en renfort du
   * comptage EfficientDet existant (countPeople, proctoring-vision.ts). */
  personCount: number
}

// Sous-ensemble de COCO-80 pertinent, même taxonomie que SUSPECT_LABELS
// dans proctoring-vision.ts pour une comparabilité directe des deux
// modèles. Pas de classe "tablet" en COCO (contrairement à l'allowlist
// EfficientDet côté MediaPipe) — YOLO ne peut structurellement jamais
// corroborer une détection de tablette ; voir le traitement explicite du
// cas no_equivalent_class côté appelant (exam/[id]/page.tsx), à ne pas
// confondre avec un vrai désaccord entre les deux modèles.
const YOLO_CLASS_MAP: Record<number, { label: string; category: 'phone' | 'book' | 'screen' }> = {
  67: { label: 'cell phone', category: 'phone' },
  65: { label: 'remote',     category: 'phone' },
  73: { label: 'book',       category: 'book' },
  63: { label: 'laptop',     category: 'screen' },
  62: { label: 'tv',         category: 'screen' },
}

let letterboxCanvas: HTMLCanvasElement | null = null

/** Redimensionne l'image courante en 640x640 en conservant le ratio
 * (letterbox, marge gris 114 — même convention que le prétraitement
 * standard Ultralytics, indispensable pour correspondre à l'entraînement
 * du modèle). Identique à la validation faite en Python hors-navigateur
 * avant l'intégration (mêmes calculs, même résultat vérifié sur une vraie
 * photo). */
function preprocess(video: HTMLVideoElement): Float32Array {
  if (!letterboxCanvas) letterboxCanvas = document.createElement('canvas')
  letterboxCanvas.width = INPUT_SIZE
  letterboxCanvas.height = INPUT_SIZE
  const ctx = letterboxCanvas.getContext('2d')!
  ctx.fillStyle = 'rgb(114,114,114)'
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  const vw = video.videoWidth, vh = video.videoHeight
  const r = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh)
  const nw = Math.round(vw * r), nh = Math.round(vh * r)
  const dx = Math.floor((INPUT_SIZE - nw) / 2), dy = Math.floor((INPUT_SIZE - nh) / 2)
  ctx.drawImage(video, 0, 0, vw, vh, dx, dy, nw, nh)
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  // RGBA (entrelacé, ligne par ligne) -> NCHW float32 normalisé /255
  const out = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  const plane = INPUT_SIZE * INPUT_SIZE
  for (let i = 0; i < plane; i++) {
    out[i]             = data[i * 4]     / 255 // R
    out[plane + i]     = data[i * 4 + 1] / 255 // G
    out[2 * plane + i] = data[i * 4 + 2] / 255 // B
  }
  return out
}

/** Détection d'objets suspects (+ comptage de personnes, voir personCount
 * sur YoloSignal) en un seul appel. Deux usages, avec des minScore
 * différents passés explicitement par l'appelant selon le contexte :
 *  - Corroboration à la demande en cours d'examen (visionEnrichedTick,
 *    exam/[id]/page.tsx) — minScore par défaut (0.45), volontairement un
 *    peu plus permissif que le seuil EfficientDet en cours d'examen (0.5,
 *    voir analyzeObjects dans proctoring-vision.ts) : YOLO n'agit ici qu'en
 *    RENFORT d'une détection déjà candidate, pas en détecteur principal —
 *    un seuil trop strict réduirait sa capacité à corroborer de vraies
 *    détections sans réduire le risque de faux positif (c'est justement
 *    l'ACCORD des deux modèles, pas YOLO seul, qui doit porter la
 *    confiance renforcée côté appelant).
 *  - Scan environnement 360° (runEnvironmentScan) — minScore plus bas
 *    (0.35, même valeur que le seuil EfficientDet y utilisé), car ce scan
 *    est un passage unique purement informatif où un signalement en trop
 *    coûte bien moins qu'une personne/un objet réellement présent manqué. */
export async function detectSuspectObjects(video: HTMLVideoElement, minScore = 0.45): Promise<YoloSignal | null> {
  if (!session) return null
  try {
    const input = preprocess(video)
    const tensor = new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE])
    const outputs = await session.run({ images: tensor })
    const out = outputs['output0']
    if (!out) return null
    const data = out.data as Float32Array
    // [1, N, 6] = [x1,y1,x2,y2,conf,cls] par détection, doublons déjà
    // éliminés nativement (architecture end-to-end de YOLO26, voir en-tête
    // du fichier) — pas de décodage de grille ni de NMS à refaire ici.
    // Les coordonnées de boîte sont ignorées (même
    // forme de sortie que ObjectSignal côté EfficientDet, {label,score}
    // uniquement — aucune UI n'affiche de boîte englobante aujourd'hui,
    // choix délibéré pour réduire la surface de calcul non vérifiable
    // sans caméra réelle).
    const n = (out.dims as number[])[1] ?? 0
    const matches: YoloMatch[] = []
    let personCount = 0
    const PERSON_CLASS_ID = 0 // COCO
    for (let i = 0; i < n; i++) {
      const base = i * 6
      const conf = data[base + 4]
      if (conf < minScore) continue
      const classId = Math.round(data[base + 5])
      if (classId === PERSON_CLASS_ID) { personCount++; continue }
      const entry = YOLO_CLASS_MAP[classId]
      if (!entry) continue
      matches.push({ label: entry.label, score: conf, classId })
    }
    return {
      phoneDetected:       matches.some(m => YOLO_CLASS_MAP[m.classId]?.category === 'phone'),
      bookDetected:        matches.some(m => YOLO_CLASS_MAP[m.classId]?.category === 'book'),
      otherScreenDetected: matches.some(m => YOLO_CLASS_MAP[m.classId]?.category === 'screen'),
      matches,
      personCount,
    }
  } catch (err) {
    console.warn('[yolo-detector] échec inférence', err)
    return null
  }
}
