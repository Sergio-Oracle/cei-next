/**
 * Bip d'alerte pour les notifications qui doivent attirer l'attention même
 * quand l'onglet n'est pas au premier plan (ex. reprise d'examen d'un
 * étudiant) — généré via Web Audio API, aucun fichier audio à charger.
 */
export function playAlertBeep(): void {
  if (typeof window === 'undefined') return
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
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + startAt)
      osc.stop(ctx.currentTime + startAt + 0.2)
    }
    playTone(0, 880)
    playTone(0.22, 880)
    setTimeout(() => ctx.close().catch(() => {}), 600)
  } catch { /* audio non disponible (permissions navigateur, etc.) — silencieux */ }
}
