/**
 * Service Worker — CEI
 * Stratégies :
 *   - Static assets (_next/static, fontawesome) : Cache-First, durée illimitée
 *   - Pages HTML : Network-First avec fallback cache
 *   - API (/api/*) : Network uniquement, jamais de cache (données auth dynamiques)
 */

// __BUILD_ID__ est remplacé par le vrai build ID à chaque déploiement (voir deploy.sh) —
// ça force l'invalidation de TOUS les caches sur chaque nouveau déploiement, pour éviter
// qu'un client garde en cache une page HTML qui référence des fichiers JS supprimés du
// serveur par le build suivant (écran blanc / éléments qui ne s'affichent plus).
const BUILD_ID      = '__BUILD_ID__';
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

  // Jamais de cache pour l'API (données dynamiques + authentification)
  if (url.pathname.startsWith('/api/')) return;

  // Cache-First pour les assets statiques immuables
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fontawesome/')  ||
    url.pathname.startsWith('/static/')
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
  event.respondWith(
    fetch(request)
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
