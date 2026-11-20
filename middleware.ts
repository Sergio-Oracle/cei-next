import { NextRequest, NextResponse } from 'next/server'
import { isPublicPath } from './lib/publicPaths'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Laisser passer les assets et routes publiques (liste unique : lib/publicPaths.ts)
  if (isPublicPath(pathname)) return NextResponse.next()

  // Vérifier la présence de la session (cookie non-secret posé par AuthContext —
  // C-06 : ne contient plus le jeton, juste un indicateur ; la vraie validation
  // se fait côté serveur sur chaque appel API via le jeton en mémoire).
  const token = request.cookies.get('cei_logged_in')?.value
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|fontawesome|fonts|screenshots|icons|sw\\.js|manifest\\.json).*)',
  ],
}
