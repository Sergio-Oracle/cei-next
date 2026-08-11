import { NextRequest, NextResponse } from 'next/server'

// Routes accessibles sans authentification
const PUBLIC_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/conditions',
  '/',
  '/robots.txt',
])

// Préfixes publics (assets, guide public, etc.)
const PUBLIC_PREFIXES = [
  '/_next/',
  '/fontawesome/',
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
  '/favicon',
  '/manifest.json',
  '/sw.js',
  '/api/',          // l'API gère sa propre auth
  '/guide-etudiant',
  '/guide-enseignant',
  '/guide-surveillant',
  '/guide-superviseur',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Laisser passer les assets et routes publiques
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  // Vérifier la présence du token dans le cookie (posé par AuthContext)
  const token = request.cookies.get('token')?.value
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|fontawesome|screenshots|icons|sw\\.js|manifest\\.json).*)',
  ],
}
