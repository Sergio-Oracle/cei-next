// Application « CEI Examen » (client kiosque, équivalent de Safe Exam Browser) : pont avec la page d'examen.
// Hors de l'application, `window.ceiClient` n'existe pas et tout ce module est sans effet.
import api from '@/lib/api'

export interface CeiClientEvent { type: string; data: Record<string, any>; ts: number }
export interface ExamModeOptions { maxMinutes?: number; examId?: number; userId?: number; allowedSites?: string[]; allowedApps?: string[] }
interface CeiBridge {
  isCEIClient: boolean
  info(): Promise<{ client: string; version: string; platform: string; vm: boolean } | null>
  askMedia?(): Promise<Record<string, string> | null>
  status(): Promise<{ media?: Record<string, string>; examMode: boolean; displays: number; focused: boolean; kiosk: boolean; shortcuts: string[]; vm: boolean } | null>
  sign(nonce: string, userId: number, examId: number): Promise<{ sig: string; version: string; platform: string; vm: boolean; vm_hint?: string; remote?: boolean; remote_hint?: string; displays?: number; usb_storage?: number } | null>
  listApps?(): Promise<{ apps: { name: string }[] } | null>
  closeApps?(): Promise<{ closed: number; remaining: { name: string }[] } | null>
  enterExamMode(o?: ExamModeOptions): Promise<{ ok: boolean }>
  leaveExamMode(): Promise<{ ok: boolean }>
  /** Version 1.2.0+ : identité de l'examen, sites d'assistance et applications tolérées, donnés AVANT l'entrée en mode examen. */
  configure?(o: ExamModeOptions): Promise<{ ok: boolean }>
  openAssist?(url: string): Promise<{ ok: boolean; message?: string }>
  closeAssist?(): Promise<{ ok: boolean }>
  /** Version 1.3.0+ : lance tout de suite la mise à jour automatique (jamais pendant un examen). */
  /** Version 1.4.0+ : écrans branchés et disques USB (contrôle des ports avant l'examen). */
  ports?(): Promise<{ displays: number; displayNames: string[]; usb: { id: string; label: string }[] } | null>
  updateNow?(): Promise<{ skipped?: string; installing?: boolean; error?: string }>
  updateInfo?(): Promise<{ version: string; updating: boolean } | null>
}

export const getCeiClient = (): CeiBridge | undefined =>
  typeof window !== 'undefined' ? ((window as any).ceiClient as CeiBridge | undefined) : undefined

export const isCeiClient = () => !!getCeiClient()?.isCEIClient

/** Prouve au serveur que cette fenêtre est bien l'application officielle (poignée de main signée). Retourne l'indice « machine virtuelle ». */
export async function proveCeiClient(examId: number): Promise<{ ok: boolean; vm?: boolean; error?: string; outdated?: boolean; refused?: boolean }> {
  const c = getCeiClient()
  if (!c) return { ok: false, error: "Cet examen s'ouvre avec l'application CEI Examen." }
  try {
    const ch = await api.get<{ nonce: string; user_id: number }>(`/api/exam-client/challenge?exam_id=${examId}`)
    const s = await c.sign(ch.nonce, ch.user_id, examId)
    if (!s) return { ok: false, error: "L'application n'a pas pu signer la demande." }
    const r = await api.post<{ ok: boolean; vm?: boolean }>('/api/exam-client/verify', { exam_id: examId, nonce: ch.nonce, sig: s.sig, version: s.version, platform: s.platform, vm: s.vm, remote: !!s.remote, displays: s.displays ?? 1, usb_storage: s.usb_storage ?? 0 })
    return { ok: !!r.ok, vm: s.vm }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Vérification impossible', outdated: !!e?.data?.client_outdated, refused: !!(e?.data?.client_remote || e?.data?.client_vm_refused || e?.data?.client_ports) }
  }
}

/** Abonnement aux alertes du client (perte de focus, logiciel interdit, second écran…). Retourne la fonction de désabonnement. */
export function onCeiClientEvent(cb: (e: CeiClientEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const h = (ev: Event) => { try { cb(JSON.parse((ev as CustomEvent).detail)) } catch { /* événement illisible : ignoré */ } }
  window.addEventListener('cei-client-event', h)
  return () => window.removeEventListener('cei-client-event', h)
}
