import * as SecureStore from 'expo-secure-store';

import { API_URL } from '@/shared/config/env';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refresh = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refresh) return null;
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      await clearTokens();
      return null;
    }
    const { accessToken, refreshToken } = (await res.json()) as {
      accessToken: string;
      refreshToken?: string;
    };
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    return accessToken;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function setTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
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
