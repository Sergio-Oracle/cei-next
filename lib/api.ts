/**
 * Client HTTP CEI — standards professionnels :
 *   - Retry exponentiel (réseau faible / timeouts transitoires)
 *   - Déduplication des requêtes GET en vol (évite doubles appels)
 *   - Timeout configurable par requête (30s par défaut)
 *   - Refresh token automatique sur 401
 *   - Détection offline avec erreur explicite
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://dev-cei.ddns.net'

const DEFAULT_TIMEOUT_MS = 30_000   // 30 s pour les routes normales
const AI_TIMEOUT_MS      = 180_000  // 3 min pour les routes IA

// ── Helpers ───────────────────────────────────────────────────────────────────
function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && (
    (err as TypeError).message.includes('fetch') ||
    (err as TypeError).message.includes('network') ||
    (err as TypeError).message.includes('Failed')
  )
}

// ── Refresh token ─────────────────────────────────────────────────────────────
let _refreshing: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  if (_refreshing) return _refreshing
  _refreshing = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return null
      const json = await res.json()
      const token = json.access_token
      if (token) localStorage.setItem('token', token)
      return token ?? null
    } catch {
      return null
    } finally {
      _refreshing = null
    }
  })()
  return _refreshing
}

// ── Déduplication GET ─────────────────────────────────────────────────────────
const _inflight = new Map<string, Promise<any>>()

// ── Requête avec timeout ───────────────────────────────────────────────────────
function fetchWithTimeout(input: RequestInfo, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id))
}

// ── Cœur : requête avec retry + refresh ───────────────────────────────────────
async function _request<T = any>(
  method: string,
  path: string,
  data?: any,
  opts: { formData?: boolean; blob?: boolean; timeoutMs?: number } = {},
  _retry = true,
  _attempt = 0,
): Promise<T> {
  // Vérification offline explicite (feedback immédiat sur mobile)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw Object.assign(new Error('Pas de connexion internet. Vérifiez votre réseau.'), { offline: true })
  }

  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!opts.formData && data && !(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const timeoutMs = opts.timeoutMs ?? (
    path.includes('/generate') || path.includes('/correct') || path.includes('/ai/')
      ? AI_TIMEOUT_MS
      : DEFAULT_TIMEOUT_MS
  )

  let res: Response
  try {
    res = await fetchWithTimeout(
      `${API_URL}${path}`,
      {
        method,
        headers,
        credentials: 'include',
        body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
      },
      timeoutMs,
    )
  } catch (err) {
    // Retry sur erreur réseau transitoire (max 2 tentatives, backoff exponentiel)
    if (_attempt < 2 && isNetworkError(err)) {
      await sleep(500 * Math.pow(2, _attempt))  // 500ms, 1000ms
      return _request<T>(method, path, data, opts, _retry, _attempt + 1)
    }
    const aborted = (err as any)?.name === 'AbortError'
    throw Object.assign(
      new Error(aborted ? 'Délai d\'attente dépassé. Vérifiez votre connexion.' : 'Erreur réseau.'),
      { network: true }
    )
  }

  // 401 → tenter refresh puis rejouer une seule fois
  if (res.status === 401 && _retry && path !== '/api/auth/login' && path !== '/api/auth/refresh') {
    const newToken = await tryRefresh()
    if (newToken) return _request<T>(method, path, data, opts, false)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return {} as T
  }

  if (opts.blob) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.blob() as unknown as T
  }

  let json: any
  try { json = await res.json() } catch { json = {} }

  if (!res.ok) {
    const msg = json?.error || json?.message || `Erreur HTTP ${res.status}`
    throw Object.assign(new Error(msg), { status: res.status, data: json })
  }

  return json as T
}

// ── GET avec déduplication ─────────────────────────────────────────────────────
function _get<T = any>(path: string): Promise<T> {
  if (_inflight.has(path)) return _inflight.get(path)!
  const p = _request<T>('GET', path).finally(() => _inflight.delete(path))
  _inflight.set(path, p)
  return p
}

// ── Interface publique ─────────────────────────────────────────────────────────
export const api = {
  get:    <T = any>(path: string)                                              => _get<T>(path),
  post:   <T = any>(path: string, data?: any)                                  => _request<T>('POST', path, data),
  put:    <T = any>(path: string, data?: any)                                  => _request<T>('PUT', path, data),
  delete: <T = any>(path: string)                                              => _request<T>('DELETE', path),
  upload: <T = any>(path: string, fd: FormData, method = 'POST')              =>
    _request<T>(method, path, fd, { formData: true }),
  blob:   (path: string)                                                       =>
    _request<Blob>('GET', path, undefined, { blob: true }),
  aiPost: <T = any>(path: string, data?: any)                                  =>
    _request<T>('POST', path, data, { timeoutMs: AI_TIMEOUT_MS }),
}

export default api
