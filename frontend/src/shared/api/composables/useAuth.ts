import { ref, computed, readonly } from 'vue';
import { http, setTokens, clearTokens, getAccessToken, decodeJwtPayload, HttpError } from '../http';
import { queryClient, clearPersistedCache } from '../queryClient';
import { resetOnboardingVerified } from '@/app/router';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { ROUTE_NAMES } from '@/shared/config/routeNames';

// User type matching Profile entity from backend
export interface User {
  id: string;
  name: string | null;
  email: string | null;
  currency: string;
  hasCompletedOnboarding: boolean;
  defaultAccountId: string | null;
  createdAt: string;
  isDemo: boolean;
  demoExpiresAt: string | null;
}

// Auth response from backend
// Note: refreshToken is set via httpOnly cookie, not in response body
interface AuthResponse {
  user: User;
  accessToken: string;
}

// Global state (singleton pattern)
const user = ref<User | null>(null);
const isLoading = ref(true);
const isInitialized = ref(false);
const error = ref<Error | null>(null);

// Typed JWT payload for auth
interface JwtAuthPayload {
  sub: string;
  email?: string;
  isAnonymous?: boolean;
  isDemo?: boolean;
  exp: number;
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token) as JwtAuthPayload | null;
  if (!payload) return true;
  return payload.exp * 1000 < Date.now();
}

// Build an optimistic User from JWT payload + localStorage cache
function createOptimisticUser(token: string): User | null {
  const payload = decodeJwtPayload(token) as JwtAuthPayload | null;
  if (!payload) return null;

  return {
    id: payload.sub,
    name: null,
    email: payload.email ?? null,
    currency: localStorage.getItem(STORAGE_KEYS.SELECTED_CURRENCY) || DEFAULT_CURRENCY,
    hasCompletedOnboarding: localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === 'true',
    defaultAccountId: null,
    createdAt: '',
    isDemo: payload.isDemo ?? false,
    demoExpiresAt: null,
  };
}

// Initialize auth once at app start
export async function initializeAuth(): Promise<User | null> {
  if (isInitialized.value) {
    return user.value;
  }

  try {
    isLoading.value = true;
    error.value = null;

    let token = getAccessToken();
    if (!token) {
      // No token at all, user is not authenticated
      user.value = null;
      isInitialized.value = true;
      return null;
    }

    // If token is expired, try refreshing via httpOnly cookie before giving up
    if (isTokenExpired(token)) {
      const { refreshTokens } = await import('../http');
      const refreshed = await refreshTokens();
      if (!refreshed) {
        clearTokens();
        user.value = null;
        isInitialized.value = true;
        return null;
      }
      // Use the refreshed token
      token = getAccessToken()!;
    }

    // Set optimistic user from JWT immediately — unblocks router + UI
    const optimisticUser = createOptimisticUser(token);
    if (optimisticUser) {
      user.value = optimisticUser;
      isInitialized.value = true;
      isLoading.value = false;

      // Verify with /auth/me in background (non-blocking)
      http
        .get<User>('/auth/me')
        .then((userData) => {
          user.value = userData;
          // Sync localStorage with authoritative data
          if (userData.currency) {
            localStorage.setItem(STORAGE_KEYS.SELECTED_CURRENCY, userData.currency);
          }
          if (userData.hasCompletedOnboarding) {
            localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
          }
          if (userData.demoExpiresAt) {
            localStorage.setItem(STORAGE_KEYS.DEMO_EXPIRES_AT, userData.demoExpiresAt);
          }
        })
        .catch((err) => {
          // Only logout on 401 (token truly invalid)
          // Network errors, 500s, timeouts — keep optimistic user working
          if (err instanceof HttpError && err.status === 401) {
            clearTokens();
            user.value = null;
            import('@/app/router').then(({ router }) => {
              const currentRoute = router.currentRoute.value;
              if (currentRoute.meta.requiresAuth) {
                router.push({ name: ROUTE_NAMES.LOGIN });
              }
            });
          }
        });

      return optimisticUser;
    }

    // Fallback: JWT decode failed, fetch synchronously
    const userData = await http.get<User>('/auth/me');
    user.value = userData;

    isInitialized.value = true;
    return user.value;
  } catch (err) {
    // Token might be invalid, clear it
    clearTokens();
    user.value = null;
    error.value = err as Error;
    isInitialized.value = true;
    return null;
  } finally {
    isLoading.value = false;
  }
}

// Get current user synchronously (may be null if not initialized)
export function getCurrentUser(): User | null {
  return user.value;
}

// Wait for auth to be ready
export async function waitForAuth(): Promise<User | null> {
  if (isInitialized.value) {
    return user.value;
  }
  return initializeAuth();
}

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value);
  const isAnonymous = computed(() => {
    const token = getAccessToken();
    if (!token) return false;
    const payload = decodeJwtPayload(token);
    return payload?.isAnonymous ?? false;
  });

  async function signUp(email: string, password: string) {
    try {
      isLoading.value = true;
      error.value = null;

      const data = await http.post<AuthResponse>(
        '/auth/register',
        {
          email,
          password,
        },
        { skipAuth: true },
      );

      // Only accessToken in response, refreshToken is in httpOnly cookie
      setTokens(data.accessToken);
      user.value = data.user;

      return { user: data.user };
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function signIn(email: string, password: string) {
    try {
      isLoading.value = true;
      error.value = null;

      const data = await http.post<AuthResponse>(
        '/auth/login',
        {
          email,
          password,
        },
        { skipAuth: true },
      );

      // Only accessToken in response, refreshToken is in httpOnly cookie
      setTokens(data.accessToken);
      user.value = data.user;

      return { user: data.user };
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function signOut() {
    try {
      isLoading.value = true;
      error.value = null;

      // Call logout endpoint to clear httpOnly cookie
      try {
        await http.post('/auth/logout', {});
      } catch {
        // Continue with local cleanup even if logout request fails
      }

      // Clear local tokens
      clearTokens();
      user.value = null;

      // Clear all cached queries
      queryClient.clear();

      // Clear persisted query cache from localStorage
      clearPersistedCache();

      // Clear localStorage
      localStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_CURRENCY);
      localStorage.removeItem(STORAGE_KEYS.DEMO_EXPIRES_AT);

      // Reset in-memory onboarding flag
      resetOnboardingVerified();
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function signInAnonymously() {
    try {
      isLoading.value = true;
      error.value = null;

      const data = await http.post<AuthResponse>('/auth/login/anonymous', {}, { skipAuth: true });

      // Only accessToken in response, refreshToken is in httpOnly cookie
      setTokens(data.accessToken);
      user.value = data.user;

      return { user: data.user };
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  // Refresh user data from server
  async function refreshUser() {
    try {
      const userData = await http.get<User>('/auth/me');
      user.value = userData;
      return userData;
    } catch (err) {
      error.value = err as Error;
      throw err;
    }
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
    signInAnonymously,
    signOut,
    refreshUser,
    initialize: initializeAuth,
  };
}
