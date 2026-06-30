/**
 * serverApi.ts — fetch helper for Server Components (no localStorage).
 * Reads the auth token from the request cookie header.
 * Must only be imported in Server Components (no 'use client').
 */
import { cookies } from 'next/headers'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8100'

async function serverRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value ?? ''

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

const serverApi = {
  get:  <T>(path: string)              => serverRequest<T>('GET',  path),
  post: <T>(path: string, body: unknown) => serverRequest<T>('POST', path, body),
}

export default serverApi
