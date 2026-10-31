// Application « CEI Examen » (client kiosque, équivalent de Safe Exam Browser) : pont avec la page d'examen.
// Hors de l'application, `window.ceiClient` n'existe pas et tout ce module est sans effet.
import api from '@/lib/api'

export interface CeiClientEvent { type: string; data: Record<string, any>; ts: number }
interface CeiBridge {
  isCEIClient: boolean
  info(): Promise<{ client: string; version: string; platform: string; vm: boolean } | null>
  status(): Promise<{ examMode: boolean; displays: number; focused: boolean; kiosk: boolean; shortcuts: string[]; vm: boolean } | null>
  sign(nonce: string, userId: number, examId: number): Promise<{ sig: string; version: string; platform: string; vm: boolean; vm_hint?: string } | null>
  listApps?(): Promise<{ apps: { name: string }[] } | null>
  closeApps?(): Promise<{ closed: number; remaining: { name: string }[] } | null>
  enterExamMode(o?: { maxMinutes?: number }): Promise<{ ok: boolean }>
  leaveExamMode(): Promise<{ ok: boolean }>
}

export const getCeiClient = (): CeiBridge | undefined =>
  typeof window !== 'undefined' ? ((window as any).ceiClient as CeiBridge | undefined) : undefined

export const isCeiClient = () => !!getCeiClient()?.isCEIClient

/** Prouve au serveur que cette fenêtre est bien l'application officielle (poignée de main signée). Retourne l'indice « machine virtuelle ». */
export async function proveCeiClient(examId: number): Promise<{ ok: boolean; vm?: boolean; error?: string; outdated?: boolean }> {
  const c = getCeiClient()
  if (!c) return { ok: false, error: "Cet examen s'ouvre avec l'application CEI Examen." }
  try {
    const ch = await api.get<{ nonce: string; user_id: number }>(`/api/exam-client/challenge?exam_id=${examId}`)
    const s = await c.sign(ch.nonce, ch.user_id, examId)
    if (!s) return { ok: false, error: "L'application n'a pas pu signer la demande." }
    const r = await api.post<{ ok: boolean; vm?: boolean }>('/api/exam-client/verify', { exam_id: examId, nonce: ch.nonce, sig: s.sig, version: s.version, platform: s.platform, vm: s.vm })
    return { ok: !!r.ok, vm: s.vm }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Vérification impossible', outdated: !!e?.data?.client_outdated }
  }
}

/** Abonnement aux alertes du client (perte de focus, logiciel interdit, second écran…). Retourne la fonction de désabonnement. */
export function onCeiClientEvent(cb: (e: CeiClientEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const h = (ev: Event) => { try { cb(JSON.parse((ev as CustomEvent).detail)) } catch { /* événement illisible : ignoré */ } }
  window.addEventListener('cei-client-event', h)
  return () => window.removeEventListener('cei-client-event', h)
}
