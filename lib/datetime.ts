// Dates d'examen : le serveur envoie des instants UTC (avec « Z »), le navigateur
// les affiche dans le fuseau de l'appareil. Les champs « datetime-local » parlent
// toujours en heure LOCALE de l'utilisateur ; ces deux fonctions font la
// conversion dans un sens et dans l'autre, sans jamais supposer un fuseau.

/** Valeur d'un champ datetime-local (heure locale saisie) → instant UTC ISO. */
export function localInputToIso(v: string): string {
  return new Date(v).toISOString()
}

/** Instant (ISO avec Z, ou Date) → valeur d'un champ datetime-local en heure locale. */
export function isoToLocalInput(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  const shifted = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 16)
}
