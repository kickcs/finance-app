import { ref, computed, readonly } from 'vue'
import { http, setTokens, clearTokens, getAccessToken } from '../http'
import { queryClient } from '../queryClient'

// User type matching Profile entity from backend
export interface User {
  id: string
  name: string | null
  email: string | null
  currency: string
  hasCompletedOnboarding: boolean
  defaultAccountId: string | null
  createdAt: string
  isDemo: boolean
  demoExpiresAt: string | null
}

// Auth response from backend
// Note: refreshToken is set via httpOnly cookie, not in response body
interface AuthResponse {
  user: User
  accessToken: string
}

// Global state (singleton pattern)
const user = ref<User | null>(null)
const isLoading = ref(true)
const isInitialized = ref(false)
const error = ref<Error | null>(null)

// JWT payload decoder
function decodeJwtPayload(token: string): { sub: string; email?: string; isAnonymous?: boolean; isDemo?: boolean; exp: number } | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

// Check if token is expired
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload) return true
  return payload.exp * 1000 < Date.now()
}

// Initialize auth once at app start
export async function initializeAuth(): Promise<User | null> {
  if (isInitialized.value) {
    return user.value
  }

  try {
    isLoading.value = true
    error.value = null

    const token = getAccessToken()
    if (!token || isTokenExpired(token)) {
      // No valid token, user is not authenticated
      user.value = null
      isInitialized.value = true
      return null
    }

    // Fetch current user profile
    const userData = await http.get<User>('/auth/me')
    user.value = userData

    isInitialized.value = true
    return user.value
  } catch (err) {
    // Token might be invalid, clear it
    clearTokens()
    user.value = null
    error.value = err as Error
    isInitialized.value = true
    return null
  } finally {
    isLoading.value = false
  }
}

// Get current user synchronously (may be null if not initialized)
export function getCurrentUser(): User | null {
  return user.value
}

// Wait for auth to be ready
export async function waitForAuth(): Promise<User | null> {
  if (isInitialized.value) {
    return user.value
  }
  return initializeAuth()
}

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value)
  const isAnonymous = computed(() => {
    const token = getAccessToken()
    if (!token) return false
    const payload = decodeJwtPayload(token)
    return payload?.isAnonymous ?? false
  })

  async function signUp(email: string, password: string) {
    try {
      isLoading.value = true
      error.value = null

      const data = await http.post<AuthResponse>('/auth/register', {
        email,
        password,
      }, { skipAuth: true })

      // Only accessToken in response, refreshToken is in httpOnly cookie
      setTokens(data.accessToken)
      user.value = data.user

      return { user: data.user }
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function signIn(email: string, password: string) {
    try {
      isLoading.value = true
      error.value = null

      const data = await http.post<AuthResponse>('/auth/login', {
        email,
        password,
      }, { skipAuth: true })

      // Only accessToken in response, refreshToken is in httpOnly cookie
      setTokens(data.accessToken)
      user.value = data.user

      return { user: data.user }
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function signInWithOAuth(_provider: 'google' | 'github' | 'apple') {
    // OAuth not implemented in NestJS backend yet
    // This would require additional setup with passport strategies
    throw new Error('OAuth not implemented. Please use email/password login.')
  }

  async function signOut() {
    try {
      isLoading.value = true
      error.value = null

      // Call logout endpoint to clear httpOnly cookie
      try {
        await http.post('/auth/logout', {})
      } catch {
        // Continue with local cleanup even if logout request fails
      }

      // Clear local tokens
      clearTokens()
      user.value = null

      // Clear all cached queries
      queryClient.clear()

      // Clear localStorage
      localStorage.removeItem('onboardingComplete')
      localStorage.removeItem('selectedCurrency')
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function resetPassword(_email: string) {
    // Password reset not implemented in NestJS backend yet
    throw new Error('Password reset not implemented.')
  }

  async function signInAnonymously() {
    try {
      isLoading.value = true
      error.value = null

      const data = await http.post<AuthResponse>('/auth/login/anonymous', {}, { skipAuth: true })

      // Only accessToken in response, refreshToken is in httpOnly cookie
      setTokens(data.accessToken)
      user.value = data.user

      return { user: data.user }
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Refresh user data from server
  async function refreshUser() {
    try {
      const userData = await http.get<User>('/auth/me')
      user.value = userData
      return userData
    } catch (err) {
      error.value = err as Error
      throw err
    }
  }

  function cleanup() {
    // Nothing to clean up for HTTP-based auth
  }

  return {
    user: readonly(user),
    isLoading: readonly(isLoading),
    isInitialized: readonly(isInitialized),
    error: readonly(error),
    isAuthenticated,
    isAnonymous,
    signUp,
    signIn,
    signInWithOAuth,
    signInAnonymously,
    signOut,
    resetPassword,
    refreshUser,
    initialize: initializeAuth,
    cleanup,
  }
}
