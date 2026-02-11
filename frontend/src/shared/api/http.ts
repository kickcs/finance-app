/**
 * HTTP Client for NestJS Backend
 * Replaces Supabase client with JWT-based authentication
 *
 * Security: Refresh token is stored in httpOnly cookie (set by backend),
 * only access token is stored in localStorage.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? ''
const API_URL = `${BASE_URL}/api`

// Token storage - only access token is in localStorage
// Refresh token is in httpOnly cookie (not accessible to JS)
const TOKEN_KEY = 'access_token'

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setTokens(accessToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken)
  // Refresh token is set by backend via httpOnly cookie
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
  // Cookie is cleared via /auth/logout endpoint
}

// Token refresh logic
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function refreshTokens(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      // Refresh token is sent automatically via httpOnly cookie
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Send cookies
        headers: { 'Content-Type': 'application/json' },
        // No body needed - refresh token is in cookie
      })

      if (!response.ok) {
        clearTokens()
        return false
      }

      const data = await response.json()
      setTokens(data.accessToken) // Only access token in response
      return true
    } catch {
      clearTokens()
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

// Main HTTP client
export interface HttpOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
  skipAuth?: boolean
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`HTTP Error ${status}: ${statusText}`)
    this.name = 'HttpError'
  }
}

async function request<T>(endpoint: string, options: HttpOptions = {}): Promise<T> {
  const { params, skipAuth, ...fetchOptions } = options

  // Build URL with query params
  let url = `${API_URL}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value))
      }
    })
    const queryString = searchParams.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  // Add auth token
  if (!skipAuth) {
    const token = getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  // Make request with credentials for cookie support
  let response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include', // Send cookies with requests
    headers,
  })

  // Handle 401 - try to refresh token
  if (response.status === 401 && !skipAuth) {
    const refreshed = await refreshTokens()
    if (refreshed) {
      // Retry with new token
      const newToken = getAccessToken()
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`
      }
      response = await fetch(url, {
        ...fetchOptions,
        credentials: 'include',
        headers,
      })
    }
  }

  // Parse response
  const contentType = response.headers.get('content-type')
  let data: unknown
  if (contentType?.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  // Handle errors
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, data)
  }

  return data as T
}

// HTTP methods
export const http = {
  get<T>(endpoint: string, options?: HttpOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'GET' })
  },

  post<T>(endpoint: string, body?: unknown, options?: HttpOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  put<T>(endpoint: string, body?: unknown, options?: HttpOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  patch<T>(endpoint: string, body?: unknown, options?: HttpOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  delete<T>(endpoint: string, options?: HttpOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'DELETE' })
  },
}

export { API_URL }
