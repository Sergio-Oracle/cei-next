/**
 * Bip d'alerte pour les notifications qui doivent attirer l'attention même
 * quand l'onglet n'est pas au premier plan (ex. reprise d'examen d'un
 * étudiant) — généré via Web Audio API, aucun fichier audio à charger.
 *
 * 18/11/2026 (rapport des surveillants : « alertes sonores bruyantes qui gênent la surveillance », « notifications envahissantes ») :
 *  - réglage du son par le surveillant : normal / discret / coupé, mémorisé sur son poste ;
 *  - les alertes de surveillance (risque élevé, agent…) ne sonnent qu'UNE fois toutes les 30 s ; les événements qui exigent une réponse
 *    immédiate (appel, reprise) ne sont pas limités, mais respectent le réglage.
 */
export type SoundMode = 'normal' | 'discret' | 'coupe'
const KEY = 'cei_alert_sound'
const VOLUME: Record<SoundMode, number> = { normal: 0.25, discret: 0.06, coupe: 0 }
const THROTTLE_MS = 30_000
let lastAlertBeep = 0

export function getSoundMode(): SoundMode {
  try { const v = localStorage.getItem(KEY); if (v === 'normal' || v === 'discret' || v === 'coupe') return v } catch { /* stockage indisponible */ }
  return 'normal'
}
export function setSoundMode(m: SoundMode): void {
  try { localStorage.setItem(KEY, m); window.dispatchEvent(new Event('cei:sound-mode')) } catch { /* stockage indisponible */ }
}
export const nextSoundMode = (m: SoundMode): SoundMode => (m === 'normal' ? 'discret' : m === 'discret' ? 'coupe' : 'normal')

/** kind « alerte » : alertes de surveillance en rafale (limitées) ; « urgent » : appel / reprise (jamais limité, mais respecte le réglage). */
export function playAlertBeep(kind: 'urgent' | 'alerte' = 'urgent'): void {
  if (typeof window === 'undefined') return
  const vol = VOLUME[getSoundMode()]
  if (vol <= 0) return
  if (kind === 'alerte') { const now = Date.now(); if (now - lastAlertBeep < THROTTLE_MS) return; lastAlertBeep = now }
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const playTone = (startAt: number, freq: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt)
      gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + startAt)
      osc.stop(ctx.currentTime + startAt + 0.2)
    }
    playTone(0, 880)
    if (kind === 'urgent') playTone(0.22, 880)            // un seul bip pour une simple alerte, deux pour ce qui demande une réponse
    setTimeout(() => ctx.close().catch(() => {}), 600)
  } catch { /* audio non disponible (permissions navigateur, etc.) — silencieux */ }
}
