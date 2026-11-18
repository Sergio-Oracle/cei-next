// Aide précise et en langage simple quand la caméra, le micro ou le partage d'écran ne démarrent pas. Avant (examen du 17/11) l'étudiant lisait seulement « Autorisez-les puis
// réessayez » : près d'un étudiant sur dix est resté plus de 5 minutes avant l'affichage de sa copie, le plus souvent bloqué sur cette étape sans savoir quoi corriger.

const osName = (): 'windows' | 'mac' | 'linux' => {
  const u = typeof navigator === 'undefined' ? '' : navigator.userAgent
  return /windows/i.test(u) ? 'windows' : /mac/i.test(u) ? 'mac' : 'linux'
}

/** Caméra / micro : que faire selon la cause (refus, appareil absent, appareil déjà utilisé…). */
export function mediaHelp(e: { name?: string } | null | undefined): string {
  const os = osName()
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
    if (os === 'windows') return "Windows bloque l'accès. Ouvrez Paramètres, Confidentialité et sécurité, Caméra puis Microphone, et activez « Autoriser les applications de bureau à accéder à la caméra / au microphone ». Cliquez ensuite sur « Réessayer »."
    if (os === 'mac') return "macOS a refusé l'accès. Ouvrez Réglages Système, Confidentialité et sécurité, Caméra puis Microphone, cochez votre navigateur (ou CEI Examen), relancez-le puis cliquez sur « Réessayer »."
    return "L'accès a été refusé. Cliquez sur le cadenas à gauche de l'adresse, mettez la caméra et le micro sur « Autoriser », puis cliquez sur « Réessayer »."
  }
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return "Aucune caméra ou aucun micro n'a été trouvé. Vérifiez qu'ils sont bien branchés et activés, puis cliquez sur « Réessayer »."
  if (e?.name === 'NotReadableError' || e?.name === 'AbortError') return "Votre caméra ou votre micro est déjà utilisé par un autre logiciel (Zoom, Teams, un autre onglet…). Fermez-le, puis cliquez sur « Réessayer »."
  return "La caméra et le micro sont obligatoires. Vérifiez les branchements et les autorisations, puis cliquez sur « Réessayer »."
}

/** Partage d'écran : annulé, refusé par le système, ou mauvais choix. */
export function screenHelp(e: { name?: string } | null | undefined): string {
  const os = osName()
  if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') {
    return os === 'mac'
      ? "Le partage de l'écran n'a pas démarré. Si vous avez cliqué sur « Annuler », cliquez sur « Réessayer », choisissez « Écran entier » puis « Partager ». Sinon : Réglages Système, Confidentialité et sécurité, Enregistrement de l'écran, cochez votre navigateur, relancez-le."
      : "Le partage de l'écran n'a pas démarré. Cliquez sur « Réessayer », choisissez « Écran entier » (et non une fenêtre) puis cliquez sur « Partager »."
  }
  return "Le partage de l'écran entier est obligatoire. Cliquez sur « Réessayer », choisissez « Écran entier » puis « Partager »."
}
