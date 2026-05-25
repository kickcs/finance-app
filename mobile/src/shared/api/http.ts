import * as SecureStore from 'expo-secure-store';

import { API_URL } from '@/shared/config/env';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    // Backend currently keeps refresh_token in an httpOnly cookie set during
    // /api/auth/login. iOS NSURLSession and Android OkHttp persist that cookie
    // across requests, so we just call refresh and rely on the platform jar.
    const res = await fetch(`${API_URL}/api/refresh`, {
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
  await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

type RequestOptions = RequestInit & { skipAuth?: boolean };

export async function http<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = opts;
  const token = skipAuth ? null : await getAccessToken();

  const doRequest = (authToken: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
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
