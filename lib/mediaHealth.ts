// Santé de la diffusion caméra / micro / écran de l'étudiant (LiveKit) — 17/11/2026.
// Cas réel (examen « Devoir-IA-Master IL ») : un étudiant partageait bien son écran, sa caméra fonctionnait chez lui (« Visage OK »), mais sa tuile restait
// noire (« Image en cours de chargement… ») chez le surveillant. Une publication qui échoue une fois (délai ICE, rafale de connexions, piste arrêtée par le
// pilote) n'était jamais retentée : la salle restait « connectée » sans caméra. Ces fonctions pures servent aux deux côtés :
//  - l'étudiant contrôle périodiquement que ses pistes sont réellement publiées et vivantes, sinon les republie ;
//  - le surveillant détecte une caméra absente / coupée / non reçue et demande à l'étudiant de la republier.

export type PubLike = {
  source?: string                       // 'camera' | 'microphone' | 'screen_share' | …
  kind?: string                         // 'video' | 'audio'
  isMuted?: boolean
  track?: { mediaStreamTrack?: { readyState?: string } | null } | null
}

export const SRC_CAMERA = 'camera'
export const SRC_MIC = 'microphone'
export const SRC_SCREEN = 'screen_share'

/** Une publication est saine si elle porte une piste dont le flux source n'est pas terminé. */
export function pubIsLive(p: PubLike | undefined | null): boolean {
  if (!p || !p.track) return false
  const st = p.track.mediaStreamTrack?.readyState
  return st !== 'ended'
}

export type LocalSources = { cam: boolean; mic: boolean; screen: boolean }   // ce que l'étudiant possède réellement (flux source vivant)
export type Missing = { cam: boolean; mic: boolean; screen: boolean }

/** Quelles pistes doivent être (re)publiées : la source existe chez l'étudiant mais aucune publication saine n'existe dans la salle. */
export function missingMedia(pubs: PubLike[], have: LocalSources): Missing {
  // On s'appuie sur le TYPE de piste, pas sur « source » seule : une piste publiée sans source explicite peut rester « unknown » côté serveur, et prendre
  // cela pour une absence ferait republier sans fin.
  const okCam = pubs.some(p => p.kind === 'video' && p.source !== SRC_SCREEN && pubIsLive(p))
  const okMic = pubs.some(p => p.kind === 'audio' && pubIsLive(p))
  const okScreen = pubs.some(p => p.source === SRC_SCREEN && pubIsLive(p))
  return { cam: have.cam && !okCam, mic: have.mic && !okMic, screen: have.screen && !okScreen }
}

export type CameraView = 'ok' | 'muted' | 'not_received' | 'absent'

/** Vu du surveillant : état de la caméra principale d'un étudiant présent dans la salle (l'écran partagé n'est pas la caméra). */
export function cameraView(pubs: PubLike[]): CameraView {
  const cams = pubs.filter(p => p.kind === 'video' && p.source !== SRC_SCREEN)
  if (cams.length === 0) return 'absent'               // l'étudiant est connecté mais n'a publié aucune caméra
  if (cams.every(p => p.isMuted)) return 'muted'       // publiée mais coupée à la source (pilote, autre application)
  if (cams.some(p => p.track)) return 'ok'
  return 'not_received'                                // publiée, mais le flux n'est pas arrivé jusqu'au surveillant
}

/** Délai minimal entre deux demandes de republication pour un même étudiant (évite de le harceler). */
export const REPUBLISH_ASK_COOLDOWN_MS = 25_000
export const shouldAskRepublish = (lastAskedAt: number | undefined, now: number): boolean =>
  lastAskedAt === undefined || now - lastAskedAt >= REPUBLISH_ASK_COOLDOWN_MS

/** Message de demande envoyé par un surveillant à un étudiant précis (jamais diffusé à tous). */
export const REQUEST_MEDIA_KIND = 'proctor_request_media'
