import * as SecureStore from 'expo-secure-store';

import { API_URL } from '@/shared/config/env';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    // Backend (backend/.../auth.controller.ts) issues refresh_token only as an
    // httpOnly cookie (path /api/auth, sameSite=lax) from /api/auth/login.
    // iOS NSURLSession persists this in the shared HTTPCookieStorage; Android
    // OkHttp does the same when credentials:include is set on both login and
    // refresh requests. If you see the user being signed out on access-token
    // expiry, plumb @react-native-cookies/cookies OR add a mobile body-based
    // refresh endpoint on the backend (tracked separately).
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      await clearTokens();
      return null;
    }
    const { accessToken } = (await res.json()) as { accessToken: string };
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    return accessToken;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function setAccessToken(accessToken: string) {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

type RequestOptions = RequestInit & { skipAuth?: boolean };

export async function http<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { skipAuth, headers, body, ...rest } = opts;
  const token = skipAuth ? null : await getAccessToken();

  // RN's fetch fills in the multipart boundary in Content-Type automatically
  // for FormData bodies — injecting application/json over it produces an
  // unparseable request on the server side.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const doRequest = (authToken: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...rest,
      body,
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
    });

  let res = await doRequest(token);
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doRequest(newToken);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as T;
}
