/* Adresse de retour vers Moodle quand CEI a été ouvert depuis l'activité
   « CEI » d'un cours (LTI). Gardée pour l'onglet courant (sessionStorage) :
   CEI remplace Moodle dans cet onglet, c'est là qu'il faut y revenir. */

const KEY = 'cei_lti_return'

export function isMoodleReturn(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && (u.hostname === 'unchk.sn' || u.hostname.endsWith('.unchk.sn'))
  } catch { return false }
}

export function getLtiReturn(): string | null {
  try {
    const v = sessionStorage.getItem(KEY)
    return isMoodleReturn(v) ? v : null
  } catch { return null }
}

export function setLtiReturn(url: string): void {
  try { if (isMoodleReturn(url)) sessionStorage.setItem(KEY, url) } catch {}
}

export function clearLtiReturn(): void {
  try { sessionStorage.removeItem(KEY) } catch {}
}
