// Qui s'abonne à quoi dans la salle de surveillance (LiveKit) — 17/11/2026.
// Cause racine du plafond de ~230 participants, des 16,7 Go de mémoire du SFU et des déconnexions de surveillants à l'examen de 10 h : chaque navigateur se
// connectait avec l'abonnement AUTOMATIQUE (défaut LiveKit) et chaque étudiant publie 3 pistes (caméra, micro, partage d'écran) : 800 étudiants s'abonnaient donc
// à ~2 400 pistes chacun (des centaines de milliers de flux audio croisés). Désormais : l'étudiant ne s'abonne qu'au personnel ; le surveillant aux seules
// vidéos des tuiles affichées. Le trafic passe de « N × N » à « N × personnel ».

export const isStudentIdentity = (id: string): boolean => id.startsWith('student-')
export const isPhoneIdentity = (id: string): boolean => id.startsWith('student-') && id.endsWith('-phone')
export const baseStudentIdentity = (id: string): string => (isPhoneIdentity(id) ? id.slice(0, -'-phone'.length) : id)

/** Page d'examen de l'étudiant : abonné au personnel (surveillants, enseignants, responsables…) et JAMAIS aux autres étudiants. */
export const studentShouldSubscribe = (identity: string): boolean => !isStudentIdentity(identity)

/** Page de surveillance : tout le personnel ; des étudiants, seulement la VIDÉO (caméra, écran, téléphone) de ceux dont la tuile est affichée ; jamais leur audio. */
export function monitorShouldSubscribe(identity: string, kind: string, visible: Iterable<string>): boolean {
  if (!isStudentIdentity(identity)) return true
  if (kind !== 'video') return false
  for (const v of visible) if (v === baseStudentIdentity(identity)) return true
  return false
}

/** Destinataires d'une alerte en direct d'un étudiant : le personnel présent seulement (avant : TOUS les participants, soit 800 × 800 messages). */
export function staffIdentities(remoteIdentities: Iterable<string>): string[] {
  const out: string[] = []
  for (const id of remoteIdentities) if (!isStudentIdentity(id)) out.push(id)
  return out
}
