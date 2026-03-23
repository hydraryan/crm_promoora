/**
 * CRM Portal API Service
 * Handles all API calls to the Express backend
 */

export interface LoginRequestBody {
  email: string
  password: string
  deviceId?: string
  userAgent?: string
}

export interface LoginResponse {
  success: boolean
  accessToken: string
  refreshToken: string
  user: {
    id: string
    name: string
    email: string
    avatarInitials: string
    role: string
    status: string
  }
}

export interface ApiError {
  error: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

/**
 * Login with email and password
 */
export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const url = `${API_BASE_URL}/auth/login`
    console.log('🔐 Attempting login to:', url)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        deviceId: generateDeviceId(),
        userAgent: navigator.userAgent,
      }),
    })

    console.log('📡 Response status:', response.status)

    if (!response.ok) {
      const error = (await response.json()) as ApiError
      console.error('❌ Login error:', error)
      throw new Error(error.error || `Login failed with status ${response.status}`)
    }

    const data = (await response.json()) as LoginResponse
    console.log('✅ Login successful')
    return data
  } catch (err) {
    console.error('💥 Login exception:', err)
    throw err
  }
}

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken: string): Promise<{ accessToken: string }> => {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    const error = (await response.json()) as ApiError
    throw new Error(error.error || 'Token refresh failed')
  }

  return response.json()
}

/**
 * Logout user
 */
export const logoutUser = async (accessToken: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = (await response.json()) as ApiError
    throw new Error(error.error || 'Logout failed')
  }
}

/**
 * Generate a unique device ID for multi-device session management
 */
function generateDeviceId(): string {
  const stored = localStorage.getItem('crm_device_id')
  if (stored) return stored

  const deviceId = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  localStorage.setItem('crm_device_id', deviceId)
  return deviceId
}

/**
 * Store authentication tokens
 */
export const storeTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem('crm_access_token', accessToken)
  localStorage.setItem('crm_refresh_token', refreshToken)
}

/**
 * Get stored access token
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem('crm_access_token')
}

/**
 * Get stored refresh token
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem('crm_refresh_token')
}

/**
 * Clear all stored tokens
 */
export const clearTokens = (): void => {
  localStorage.removeItem('crm_access_token')
  localStorage.removeItem('crm_refresh_token')
  localStorage.removeItem('crm_user')
}

/**
 * Store user info
 */
export const storeUser = (user: LoginResponse['user']): void => {
  localStorage.setItem('crm_user', JSON.stringify(user))
}

/**
 * Get stored user info
 */
export const getUser = (): LoginResponse['user'] | null => {
  const stored = localStorage.getItem('crm_user')
  return stored ? JSON.parse(stored) : null
}
