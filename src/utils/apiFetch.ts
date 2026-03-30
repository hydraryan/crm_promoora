const API_BASE = import.meta.env.VITE_API_URL ?? '/api'
import { beginGlobalLoading, endGlobalLoading } from '@/context/LoadingContext'

const DEFAULT_CACHE_TTL_MS = 45_000

type CacheEntry = {
  expiresAt: number
  payload: unknown
}

const responseCache = new Map<string, CacheEntry>()
const inFlightRequests = new Map<string, Promise<unknown>>()

async function doFetch(path: string, options?: RequestInit, token?: string) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
}

async function tryRefreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('crm_refresh_token')
  if (!refreshToken) return null

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) return null

  const data = (await response.json()) as { accessToken?: string }
  if (!data.accessToken) return null

  localStorage.setItem('crm_access_token', data.accessToken)
  return data.accessToken
}

function clearAuthState() {
  localStorage.removeItem('crm_access_token')
  localStorage.removeItem('crm_refresh_token')
  localStorage.removeItem('crm_user')
  sessionStorage.removeItem('crm_portal_secure_session')
}

function methodFromOptions(options?: RequestInit): string {
  return (options?.method ?? 'GET').toUpperCase()
}

function shouldCacheRequest(method: string, options?: RequestInit): boolean {
  return method === 'GET' && !options?.body
}

function cacheKey(path: string, method: string): string {
  return `${method}:${path}`
}

function readCached<T>(key: string): T | null {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key)
    return null
  }
  return entry.payload as T
}

function writeCached(key: string, payload: unknown, ttlMs: number) {
  responseCache.set(key, {
    expiresAt: Date.now() + Math.max(1, ttlMs),
    payload,
  })
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const method = methodFromOptions(options)
  const canCache = shouldCacheRequest(method, options)
  const key = cacheKey(path, method)

  if (canCache) {
    const cached = readCached<T>(key)
    if (cached !== null) {
      return cached
    }

    const inFlight = inFlightRequests.get(key)
    if (inFlight) {
      return inFlight as Promise<T>
    }
  }

  const requestPromise = (async () => {
    beginGlobalLoading()
    try {
      const token = localStorage.getItem('crm_access_token') ?? localStorage.getItem('accessToken') ?? undefined

      let response = await doFetch(path, options, token)

      // Access token expired/invalid: try one refresh flow then retry once.
      if (response.status === 403 || response.status === 401) {
        const newAccessToken = await tryRefreshAccessToken()
        if (newAccessToken) {
          response = await doFetch(path, options, newAccessToken)
        }
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          clearAuthState()
          throw new Error(`Session expired. Please sign in again. (${response.status})`)
        }

        let backendMessage = ''
        try {
          const errorBody = (await response.json()) as { error?: string; message?: string }
          backendMessage = errorBody.error ?? errorBody.message ?? ''
        } catch {
          // Ignore non-JSON error bodies.
        }

        throw new Error(backendMessage ? `API error ${response.status}: ${backendMessage}` : `API error ${response.status}: ${path}`)
      }

      const contentLength = response.headers.get('content-length')
      if (contentLength === '0') {
        if (method !== 'GET') responseCache.clear()
        return null as T
      }

      const payload = (await response.json()) as T

      if (canCache) {
        writeCached(key, payload, DEFAULT_CACHE_TTL_MS)
      } else if (method !== 'GET') {
        // Keep cache correctness simple and safe after writes.
        responseCache.clear()
      }

      return payload
    } finally {
      endGlobalLoading()
      if (canCache) {
        inFlightRequests.delete(key)
      }
    }
  })()

  if (canCache) {
    inFlightRequests.set(key, requestPromise as Promise<unknown>)
  }

  return requestPromise
}
