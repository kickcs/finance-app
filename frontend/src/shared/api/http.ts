/**
 * HTTP Client for NestJS Backend
 * Replaces Supabase client with JWT-based authentication
 *
 * Security: Refresh token is stored in httpOnly cookie (set by backend),
 * only access token is stored in localStorage.
 */

import { STORAGE_KEYS } from '@/shared/config/storageKeys';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const API_URL = `${BASE_URL}/api`;

// Token storage - only access token is in localStorage
// Refresh token is in httpOnly cookie (not accessible to JS)
const TOKEN_KEY = STORAGE_KEYS.ACCESS_TOKEN;

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Cached token expiry — avoids decoding JWT on every request
let cachedExpiryMs: number | null = null;

export function setTokens(accessToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  const payload = decodeJwtPayload(accessToken);
  cachedExpiryMs = typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  cachedExpiryMs = null;
}

// JWT payload decoder — single source of truth, handles URL-safe base64
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Proactive token expiry check — refresh before sending request if token is about to expire
const EXPIRY_BUFFER_MS = 30_000; // refresh 30s before actual expiry

function isTokenExpiringSoon(): boolean {
  // Use cached expiry if available (set when token is stored)
  if (cachedExpiryMs !== null) {
    return cachedExpiryMs < Date.now() + EXPIRY_BUFFER_MS;
  }
  // Fallback: decode from localStorage (first request after page reload)
  const token = getAccessToken();
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  cachedExpiryMs = payload.exp * 1000;
  return cachedExpiryMs < Date.now() + EXPIRY_BUFFER_MS;
}

// Token refresh logic with subscriber pattern to prevent race conditions
let isRefreshing = false;
let refreshSubscribers: Array<(success: boolean) => void> = [];

function onRefreshComplete(success: boolean) {
  refreshSubscribers.forEach((callback) => callback(success));
  refreshSubscribers = [];
}

function waitForRefresh(): Promise<boolean> {
  return new Promise((resolve) => {
    refreshSubscribers.push(resolve);
  });
}

export async function refreshTokens(): Promise<boolean> {
  if (isRefreshing) {
    return waitForRefresh();
  }

  isRefreshing = true;

  try {
    // Refresh token is sent automatically via httpOnly cookie
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Send cookies
      headers: { 'Content-Type': 'application/json' },
      // No body needed - refresh token is in cookie
    });

    if (!response.ok) {
      clearTokens();
      onRefreshComplete(false);
      return false;
    }

    const data = await response.json();
    setTokens(data.accessToken); // Only access token in response
    onRefreshComplete(true);
    return true;
  } catch {
    clearTokens();
    onRefreshComplete(false);
    return false;
  } finally {
    isRefreshing = false;
  }
}

// Main HTTP client
export interface HttpOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown,
  ) {
    super(`HTTP Error ${status}: ${statusText}`);
    this.name = 'HttpError';
  }
}

function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  return url;
}

function buildHeaders(fetchHeaders?: HeadersInit, skipAuth?: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchHeaders as Record<string, string>),
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

async function request<T>(endpoint: string, options: HttpOptions = {}): Promise<T> {
  const { params, skipAuth, ...fetchOptions } = options;
  const url = buildUrl(endpoint, params);

  // Wait if refresh is already in progress, or proactively refresh if token is expired/expiring
  if (!skipAuth) {
    if (isRefreshing) {
      const refreshed = await waitForRefresh();
      if (!refreshed) {
        throw new HttpError(401, 'Unauthorized');
      }
    } else if (isTokenExpiringSoon()) {
      await refreshTokens();
    }
  }

  const headers = buildHeaders(fetchOptions.headers, skipAuth);

  let response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include',
    headers,
  });

  // Handle 401 - try to refresh token once
  if (response.status === 401 && !skipAuth) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      // Retry with new token
      const retryHeaders = buildHeaders(fetchOptions.headers, skipAuth);
      response = await fetch(url, {
        ...fetchOptions,
        credentials: 'include',
        headers: retryHeaders,
      });
    }
  }

  // Parse response
  const contentType = response.headers.get('content-type');
  let data: unknown;
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, data);
  }

  return data as T;
}

// HTTP methods
export const http = {
  get<T>(endpoint: string, options?: HttpOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T>(endpoint: string, body?: unknown, options?: HttpOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown, options?: HttpOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown, options?: HttpOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string, options?: HttpOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};

export { API_URL };
