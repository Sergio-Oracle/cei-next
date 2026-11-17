// Reconnexion à la salle de surveillance (LiveKit) : l'étudiant n'abandonne JAMAIS.
// Constat du 17/11/2026 (examen 192, 2 500 étudiants) : 800 arrivées en 10 minutes ; le serveur de visioconférence n'a pas répondu à temps, chaque navigateur a
// abandonné après 4 ou 5 essais (≈ 1 minute) et n'est jamais revenu, même quand le serveur a été de nouveau disponible : seuls ~230 étudiants sur 791 étaient visibles.

/** Étalement de la toute première connexion : 600 étudiants qui démarrent la même seconde ne frappent plus le serveur au même instant. */
export const JOIN_JITTER_MS = 15000

/** Attente avant le n-ième nouvel essai (n ≥ 1) : 2 s, 3 s, 4,5 s… plafonnée à 60 s, avec ±40 % d'aléa pour ne pas rejouer la ruée en bloc. */
export function retryDelayMs(attempt: number, rand: number = Math.random()): number {
  const base = Math.min(2000 * Math.pow(1.5, Math.max(0, attempt - 1)), 60000)
  return Math.round(base * (0.6 + rand * 0.8))
}
