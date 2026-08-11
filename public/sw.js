/**
 * Service Worker — CEI
 * Stratégies :
 *   - Static assets (_next/static, fontawesome) : Cache-First, durée illimitée
 *   - Pages HTML : Network-First avec fallback cache
 *   - API (/api/*) : Network uniquement, jamais de cache (données auth dynamiques)
 */

// N2ey0-gLsGnczQhYDXBd5 est remplacé par le vrai build ID à chaque déploiement (voir deploy.sh) —
// ça force l'invalidation de TOUS les caches sur chaque nouveau déploiement, pour éviter
// qu'un client garde en cache une page HTML qui référence des fichiers JS supprimés du
// serveur par le build suivant (écran blanc / éléments qui ne s'affichent plus).
const BUILD_ID      = 'JncdqrVMhXKXqX5MiTYpU';
const STATIC_CACHE = 'cei-static-' + BUILD_ID;
const PAGE_CACHE   = 'cei-pages-' + BUILD_ID;
const ALL_CACHES   = [STATIC_CACHE, PAGE_CACHE];

// Assets à pré-cacher à l'installation
const PRECACHE_URLS = [
  '/login',
  '/fontawesome/all.min.css',
];

// ── Installation ──────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activation — nettoyage des anciens caches ─────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes non-GET
  if (request.method !== 'GET') return;

  // Ne jamais tenter de mettre en cache une requête dont le schéma n'est pas
  // http(s) — une extension navigateur (bloqueur de pub, gestionnaire de mots
  // de passe...) peut déclencher des fetch() en chrome-extension:// depuis la
  // page ; Cache.put() lève alors une TypeError non catchée ("Request scheme
  // 'chrome-extension' is unsupported"). On laisse le navigateur gérer ces
  // requêtes normalement, sans passer par le Service Worker.
  if (!url.protocol.startsWith('http')) return;

  // Ne jamais intercepter les requêtes cross-origin (CDN MediaPipe/face-api.js
  // pour la surveillance par vision, LiveKit, Google Translate...). Sans ce
  // filtre, ces requêtes tombaient dans le repli "pages HTML" ci-dessous : un
  // échec réseau transitoire sur un gros fichier CDN (modèle IA, WASM)
  // recevait alors la page /login mise en cache à la place du binaire
  // attendu — échec silencieux de la surveillance IA, le code appelant
  // avalant l'erreur (try/catch) sans jamais savoir que la réponse reçue
  // n'avait rien à voir avec ce qui était demandé. Constaté surtout en PWA
  // installée, où le Service Worker contrôle systématiquement la page dès le
  // tout premier chargement — contrairement à un onglet de navigateur
  // classique, où il ne prend le contrôle qu'à partir du second chargement.
  if (url.origin !== self.location.origin) return;

  // Jamais de cache pour l'API (données dynamiques + authentification)
  if (url.pathname.startsWith('/api/')) return;

  // Cache-First pour les assets statiques immuables — inclut les modèles de
  // vision par ordinateur hébergés localement (MediaPipe WASM/modèles,
  // face-api.js) : gros fichiers versionnés qui ne changent jamais entre
  // deux déploiements du même build, autant les servir depuis le cache.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fontawesome/')  ||
    url.pathname.startsWith('/static/')       ||
    url.pathname.startsWith('/mediapipe/')    ||
    url.pathname.startsWith('/models/')       ||
    url.pathname.startsWith('/vendor/')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-First pour les pages HTML (dashboard, login, etc.)
  // cache:'no-store' est essentiel ici : sans ça, le Cache-Control très long
  // que Next.js met sur les pages statiquement pré-rendues (s-maxage=1 an) fait
  // que le cache HTTP du navigateur répond directement sans jamais recontacter
  // le serveur — un PWA installé restait alors bloqué sur une ancienne version
  // de la page (ex. connexion) même après un nouveau déploiement.
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(PAGE_CACHE).then(c => c.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match('/login')
        )
      )
  );
});

// ── Message : forcer la mise à jour ──────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
