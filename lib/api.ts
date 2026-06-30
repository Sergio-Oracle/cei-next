const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://62.171.190.6:8100'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

let refreshing: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  if (refreshing) return refreshing
  refreshing = (async () => {
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
      refreshing = null
    }
  })()
  return refreshing
}

async function request<T = any>(
  method: string,
  path: string,
  data?: any,
  opts: { formData?: boolean; blob?: boolean } = {},
  retry = true
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}

  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!opts.formData && data && !(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  })

  /* Token expiré → tenter un refresh puis relancer une fois */
  if (res.status === 401 && retry && path !== '/api/auth/login' && path !== '/api/auth/refresh') {
    const newToken = await tryRefresh()
    if (newToken) {
      return request<T>(method, path, data, opts, false)
    }
    /* Refresh échoué → déconnexion */
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
    const msg = json?.error || json?.message || `HTTP ${res.status}`
    throw Object.assign(new Error(msg), { status: res.status, data: json })
  }

  return json as T
}

export const api = {
  get:    <T = any>(path: string)                               => request<T>('GET', path),
  post:   <T = any>(path: string, data?: any)                   => request<T>('POST', path, data),
  put:    <T = any>(path: string, data?: any)                   => request<T>('PUT', path, data),
  delete: <T = any>(path: string)                               => request<T>('DELETE', path),
  upload: <T = any>(path: string, fd: FormData, method = 'POST') =>
    request<T>(method, path, fd, { formData: true }),
  blob:   (path: string)                                        => request<Blob>('GET', path, undefined, { blob: true }),
}

export default api
