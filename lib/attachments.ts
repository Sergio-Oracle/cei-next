import api from '@/lib/api'

export interface AttemptAttachment { num: string; key: string; name: string; size: number; url?: string }

/** Ouvre / télécharge un fichier joint à une copie (droits vérifiés par le serveur : étudiant auteur ou personnel de l'examen). */
export async function openAttachment(attemptId: number, a: { key: string; name: string }) {
  const q = `/api/exam_attempts/${attemptId}/attachments/download?key=${encodeURIComponent(a.key)}`
  const r = await api.get<{ url?: string; local?: boolean }>(q + '&json=1')
  if (r?.url) { window.open(r.url, '_blank', 'noopener'); return }
  const blob = await api.blob(q)
  const u = URL.createObjectURL(blob)
  const el = document.createElement('a'); el.href = u; el.download = a.name; el.click()
  setTimeout(() => URL.revokeObjectURL(u), 10000)
}
