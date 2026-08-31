import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Ne pas révéler la techno derrière la plateforme (en-tête X-Powered-By:
  // Next.js sinon envoyé sur chaque réponse) — les en-têtes X-Nextjs-*
  // restants (cache/prerender/stale-time) sont retirés côté nginx, ce
  // flag ne les couvre pas.
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://dev-cei.ddns.net",
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(), payment=()',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Correctif montée en charge (31/08, retour utilisateur sur l'ajout
      // de YOLO) : ces fichiers (modèles IA + runtimes WASM sous public/,
      // face-api.js) étaient servis avec Cache-Control: max-age=0 par
      // défaut (comportement standard de Next.js pour tout fichier sous
      // public/, contrairement à /_next/static/ dont les URLs sont
      // hashées) — chaque étudiant qui ouvrait un examen refaisait une
      // requête complète au serveur pour du contenu qui n'avait pourtant
      // pas changé, même déjà téléchargé lors d'un examen précédent sur le
      // même appareil. Avec 3000 étudiants potentiellement simultanés
      // (voir project_cei_capacity_3000_students, bande passante déjà
      // identifiée comme le vrai plafond de la plateforme), ce n'est pas
      // anodin. PAS `immutable`/1 an comme /_next/static/ ci-dessus : ces
      // URLs ne changent JAMAIS même quand le contenu change (pas de hash
      // dans le nom de fichier) — un cache trop long bloquerait la
      // diffusion d'une future mise à jour de modèle. 7 jours = même durée
      // déjà utilisée pour /static/ côté nginx (cei-api-v2), assez long
      // pour éliminer le coût sur la quasi-totalité des examens réels,
      // assez court pour qu'une vraie mise à jour de modèle se propage
      // vite sans dépendre d'un vidage de cache manuel.
      {
        source: '/models/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800' },
        ],
      },
      {
        source: '/mediapipe/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800' },
        ],
      },
      {
        source: '/vendor/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800' },
        ],
      },
    ];
  },
};

export default nextConfig;
