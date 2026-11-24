/**
 * Pages et chemins PUBLICS (accessibles sans être connecté) — SOURCE UNIQUE (20/11/2026).
 *
 * Lue par deux endroits qui doivent TOUJOURS être d'accord :
 *  - middleware.ts : laisse passer ces chemins sans cookie de session ;
 *  - lib/api.ts    : ne renvoie JAMAIS vers /login depuis une de ces pages quand un appel d'API répond 401.
 * Avant, seule la première lisait cette liste : la page publique « Tester mon poste » appelait l'API, recevait un 401 (visiteur non connecté) et le client d'API
 * la renvoyait vers la connexion — alors que le routeur l'avait laissée passer. Ajouter une page publique = l'ajouter ICI, et rien d'autre.
 * Contrôle automatique : cei-api-v2/scripts/e2e/pages_publiques.py (ouvre chacune de ces pages sans session ; lancé après chaque livraison).
 */

export const PUBLIC_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/conditions',
  '/',
  '/robots.txt',
  '/security.txt',
  // Ouverte depuis le téléphone en scannant un QR code — cet appareil n'a
  // jamais de session CEI (pas de cookie token), voir POST /api/phone_camera/token.
  '/phone-camera',
  // Page de téléchargement de l'application CEI Examen : consultée avant la connexion
  '/telecharger-client',
  // Test du poste (caméra, micro, partage d'écran, connexion) avant un examen : avant même la connexion
  '/test-poste',
])

// Préfixes publics (assets, guide public, etc.)
export const PUBLIC_PREFIXES = [
  '/_next/',
  '/fontawesome/',
  '/fonts/',
  '/static/',
  '/screenshots/',  // captures d'écran produit sur la page d'accueil publique
  '/icons/',        // icônes PWA (manifest.json) — doivent rester accessibles sans authentification
  '/brand/',        // logos partenaires (ex. UNCHK) affichés sur les pages publiques
  '/models/',       // modèles IA (face-api.js, MediaPipe) hébergés localement — fichiers
                     // génériques sans donnée utilisateur ; un cookie manquant/expiré ne doit
                     // jamais faire échouer silencieusement le chargement de la surveillance
                     // (redirigeait vers /login, un HTML reçu à la place du modèle attendu)
  '/mediapipe/',    // runtime WASM MediaPipe, même raison
  '/vendor/',       // bibliothèques JS tierces hébergées localement (face-api.js), même raison
  '/mathlive/',     // polices de l'éditeur visuel de formules (MathLive), hébergées localement : sans elles les symboles s'affichent mal — même raison
  '/favicon',
  '/manifest.json',
  '/sw.js',
  // C-23 (audit DITSI-SSSI AVR-2026-09-CEI-AUDIT) : /.well-known/security.txt
  // retournait un 307 vers /login (redirigé comme n'importe quelle route
  // privée, faute d'être listé ici) — pas un problème de fichier manquant,
  // le middleware l'interceptait avant même d'atteindre le serveur statique.
  '/.well-known/',
  '/api/',          // l'API gère sa propre auth
  '/guide-etudiant',
  '/guide-enseignant',
  '/guide-surveillant',
  '/guide-superviseur',
  '/guide-responsable-examen',
]


/** Ce chemin est-il public (page ou ressource accessible sans session) ? */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}
