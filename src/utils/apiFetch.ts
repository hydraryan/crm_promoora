const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

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

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
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

  return response.json() as Promise<T>
}
