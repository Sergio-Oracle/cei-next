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
    ];
  },
};

export default nextConfig;
