/**
 * Surveillance par vision : niveaux selon le débit réel + préchargement dans un cache durable (13/11/2026).
 *
 * Principe (demande du propriétaire) : l'examen ne doit JAMAIS attendre ni gêner l'étudiant à cause des modèles de vision
 * (≈ 48 Mo bruts). Les fichiers sont répartis en 4 niveaux cumulatifs ; on charge ce que la connexion permet, le reste
 * arrive en arrière-plan ou pas du tout. Un fichier déjà en cache coûte 0 octet : le préchargement des jours précédents
 * (tableau de bord, « Test de poste ») rend donc le jour J instantané.
 *
 *   N1  présence / plusieurs visages (face-api léger)          ≈  1,5 Mo
 *   N2  + identité (reconnaissance faciale)                     ≈  6,8 Mo
 *   N3  + MediaPipe (pose de la tête, regard, objets)           ≈ 23,1 Mo
 *   N4  + YOLO (objets, renfort)                                ≈ 16,9 Mo
 *
 * Le cache `cei-vision-v1` est distinct des caches du service worker rattachés à l'identifiant de build : un déploiement
 * ne le vide pas (sinon ~48 Mo à retélécharger après CHAQUE déploiement). Changer VISION_CACHE (et public/sw.js) si les
 * fichiers de modèles changent.
 */

export const VISION_CACHE = 'cei-vision-v1'
export type VisionTier = 1 | 2 | 3 | 4

export const VISION_TIERS: Record<VisionTier, { label: string; mb: number; urls: string[] }> = {
  1: {
    label: 'présence du visage', mb: 1.5,
    urls: ['/vendor/face-api.js', '/models/faceapi/tiny_face_detector_model-weights_manifest.json', '/models/faceapi/tiny_face_detector_model-shard1'],
  },
  2: {
    label: 'identité', mb: 6.8,
    urls: [
      '/models/faceapi/face_landmark_68_model-weights_manifest.json', '/models/faceapi/face_landmark_68_model-shard1',
      '/models/faceapi/face_recognition_model-weights_manifest.json', '/models/faceapi/face_recognition_model-shard1', '/models/faceapi/face_recognition_model-shard2',
    ],
  },
  3: {
    label: 'regard et objets', mb: 23.1,
    urls: ['/mediapipe/wasm/vision_wasm_internal.js', '/mediapipe/wasm/vision_wasm_internal.wasm', '/models/mediapipe/face_landmarker.task', '/models/mediapipe/efficientdet_lite2.tflite'],
  },
  4: {
    label: 'objets (renfort)', mb: 16.9,
    urls: ['/models/yolo/yolo26n.onnx', '/models/ort/ort-wasm-simd-threaded.wasm', '/models/ort/ort-wasm-simd-threaded.mjs'],
  },
}
const ALL_TIERS: VisionTier[] = [1, 2, 3, 4]

type Conn = { downlink?: number; effectiveType?: string; saveData?: boolean; type?: string }
function connection(): Conn | null {
  return typeof navigator !== 'undefined' ? ((navigator as unknown as { connection?: Conn }).connection ?? null) : null
}

/* ── Décision pure (testable sans navigateur) ───────────────────────────────── */

/** Niveau maximal raisonnable pour un débit mesuré (Mbit/s). `null` = pas de mesure. */
export function tierForMbps(mbps: number | null, conn: Conn | null = null): VisionTier {
  if (conn?.saveData || (conn?.effectiveType && ['slow-2g', '2g'].includes(conn.effectiveType))) return 1
  if (mbps === null || !Number.isFinite(mbps)) {
    if (conn?.effectiveType === '3g') return 2
    return 3                                   // aucune information : niveau moyen, jamais YOLO « à l'aveugle »
  }
  if (mbps >= 6) return 4
  if (mbps >= 2.5) return 3
  if (mbps >= 1) return 2                    // seuil prudent : la mesure est légèrement optimiste sur liaison très lente
  return 1
}

/* ── Cache ─────────────────────────────────────────────────────────────────── */

async function openCache(): Promise<Cache | null> {
  try { return typeof caches !== 'undefined' ? await caches.open(VISION_CACHE) : null } catch { return null }
}

/** Plus haut niveau dont TOUS les fichiers (et ceux des niveaux inférieurs) sont déjà en cache : 0 = rien. */
export async function cachedTier(): Promise<0 | VisionTier> {
  const c = await openCache()
  if (!c) return 0
  let top: 0 | VisionTier = 0
  for (const t of ALL_TIERS) {
    const ok = await Promise.all(VISION_TIERS[t].urls.map(u => c.match(u).then(r => !!r).catch(() => false)))
    if (ok.every(Boolean)) top = t; else break
  }
  return top
}

/* ── Mesure du débit réel ───────────────────────────────────────────────────── */

const MBPS_KEY = 'cei_vision_mbps'
const PROBE_URL = '/models/faceapi/face_landmark_68_model-shard1'   // `probe=` => ignoré par le service worker (mesure réseau réelle)
const PROBE_BYTES = 98_304                                          // 96 Ko seulement (requête partielle) : à 0,4 Mbit/s ≈ 2 s, jamais un fardeau
const PROBE_TIMEOUT_MS = 8_000
/** Valeur retenue quand la mesure dépasse son délai : 96 Ko non reçus en 8 s = moins de 0,1 Mbit/s. Un délai dépassé est un signal de
 *  connexion TRÈS faible, jamais « inconnu » (sinon le code retombait sur un niveau moyen et tentait des téléchargements de 23 Mo). */
const PROBE_TIMEOUT_MBPS = 0.1

/** Débit de téléchargement mesuré vers NOTRE serveur (Mbit/s), mémorisé 20 min ; `null` seulement si la mesure est réellement impossible. */
export async function measureMbps(force = false): Promise<number | null> {
  try {
    if (!force) {
      const raw = sessionStorage.getItem(MBPS_KEY)
      if (raw) { const o = JSON.parse(raw); if (Date.now() - o.t < 20 * 60_000) return o.v }
    }
  } catch { /* stockage indisponible : on mesure */ }
  const remember = (v: number) => { try { sessionStorage.setItem(MBPS_KEY, JSON.stringify({ v, t: Date.now() })) } catch { /* ignoré */ } return v }
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), PROBE_TIMEOUT_MS)
  try {
    const url = `${PROBE_URL}?probe=${Date.now()}`
    const t0 = performance.now()
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal, headers: { Range: `bytes=0-${PROBE_BYTES - 1}` } })
    const buf = await r.arrayBuffer(); clearTimeout(to)
    if (!(r.status === 206 || r.status === 200) || buf.byteLength < 30_000) return null     // 404 / page d'erreur : pas une mesure
    let secs = (performance.now() - t0) / 1000
    try {                                                       // durée de transfert seule (sans la latence), quand le navigateur la donne
      const e = performance.getEntriesByName(new URL(url, location.href).href).pop() as PerformanceResourceTiming | undefined
      if (e && e.responseEnd > e.responseStart) secs = Math.max((e.responseEnd - e.responseStart) / 1000, 0.02)
    } catch { /* garde la durée totale */ }
    return remember(Math.round(((buf.byteLength * 8) / 1e6 / secs) * 10) / 10)
  } catch (e) {
    clearTimeout(to)
    return (e as { name?: string })?.name === 'AbortError' ? remember(PROBE_TIMEOUT_MBPS) : null
  }
}

export interface VisionPlan { tier: VisionTier; mbps: number | null; cached: 0 | VisionTier; lite: boolean }

/** Niveau à viser MAINTENANT : celui que le débit permet, ou celui déjà en cache s'il est plus haut (coût nul). */
export async function visionPlan(): Promise<VisionPlan> {
  const [mbps, cached] = await Promise.all([measureMbps(), cachedTier()])
  const byNet = tierForMbps(mbps, connection())
  const tier = (Math.max(byNet, cached) as VisionTier)
  return { tier, mbps, cached, lite: tier < 3 }
}

/* ── Préchargement ──────────────────────────────────────────────────────────── */

export interface PreloadProgress { tier: VisionTier; file: string; doneFiles: number; totalFiles: number }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Télécharge dans le cache durable les fichiers des niveaux 1..upTo (un à la fois, priorité basse, 3 essais par fichier).
 *  Les fichiers déjà présents sont ignorés. Renvoie le plus haut niveau complet. */
export async function preloadVision(upTo: VisionTier, onProgress?: (p: PreloadProgress) => void, signal?: AbortSignal): Promise<0 | VisionTier> {
  const c = await openCache()
  if (!c) return 0
  try { await navigator.storage?.persist?.() } catch { /* facultatif */ }
  const files: { tier: VisionTier; url: string }[] = []
  for (const t of ALL_TIERS) if (t <= upTo) VISION_TIERS[t].urls.forEach(url => files.push({ tier: t, url }))
  let done = 0
  for (const f of files) {
    if (signal?.aborted) break
    if (!(await c.match(f.url))) {
      let ok = false
      for (let attempt = 0; attempt < 3 && !ok && !signal?.aborted; attempt++) {
        try {
          const r = await fetch(f.url, { signal, priority: 'low' } as RequestInit)
          if (r.ok && r.status === 200 && !(r.headers.get('content-type') || '').includes('text/html')) { await c.put(f.url, r); ok = true }
          else await sleep(2000 * (attempt + 1))
        } catch { await sleep([2000, 6000, 15000][attempt]) }
      }
      if (!ok) break                                           // on s'arrête au premier fichier impossible : mieux vaut un niveau complet qu'un niveau troué
    }
    done++; onProgress?.({ tier: f.tier, file: f.url, doneFiles: done, totalFiles: files.length })
  }
  return cachedTier()
}

/** Faut-il lancer seul le préchargement (sans que l'étudiant le demande) ? Jamais sur données mobiles / économie de données. */
export function mayAutoPrefetch(): boolean {
  const c = connection()
  if (!c) return true                                          // Firefox/Safari : pas d'information ; la mesure de débit tranchera ensuite
  if (c.saveData || c.type === 'cellular') return false
  return !(c.effectiveType && ['slow-2g', '2g'].includes(c.effectiveType))
}

const PREFETCH_KEY = 'cei_vision_prefetch_at'

/** Préchargement discret : au plus une tentative toutes les 6 h, seulement si la connexion le permet, jusqu'au niveau que le débit autorise. */
export async function autoPrefetch(): Promise<void> {
  try {
    if (!mayAutoPrefetch()) return
    const last = Number(localStorage.getItem(PREFETCH_KEY) || 0)
    if (Date.now() - last < 6 * 3600_000) return
    const [mbps, cached] = await Promise.all([measureMbps(), cachedTier()])
    const target = tierForMbps(mbps, connection())
    if (cached >= target) { localStorage.setItem(PREFETCH_KEY, String(Date.now())); return }
    localStorage.setItem(PREFETCH_KEY, String(Date.now()))
    await preloadVision(target)
  } catch { /* le préchargement ne doit jamais gêner la page */ }
}
