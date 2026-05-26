import { create } from 'zustand';

import { clearTokens, getAccessToken, http, setAccessToken } from '@/shared/api/http';

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  isAnonymous: boolean;
  isDemo: boolean;
  currency: string | null;
  hasCompletedOnboarding: boolean;
  defaultAccountId: string | null;
}

interface AuthState {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  setReady: (r: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
}));

interface AuthResponse {
  accessToken: string;
  user: User;
}

// Dynamic imports keep the expo-notifications module out of the cold-start
// bundle path until a user is actually authenticated, and avoid pulling
// http.ts → useAuth.ts cycles back into the push module.
async function registerPushAfterAuth(): Promise<void> {
  try {
    const { registerForPushNotifications } = await import(
      '@/features/manage-push-notifications/registerForPush'
    );
    await registerForPushNotifications();
  } catch (err) {
    if (__DEV__) console.warn('[auth] push registration failed', err);
  }
}

async function unregisterPushBeforeSignOut(): Promise<void> {
  try {
    const { unregisterPushNotifications } = await import(
      '@/features/manage-push-notifications/registerForPush'
    );
    await unregisterPushNotifications();
  } catch {
    /* silent — sign-out must proceed regardless */
  }
}

export async function bootstrapAuth() {
  const token = await getAccessToken();
  if (!token) {
    useAuthStore.getState().setReady(true);
    return;
  }
  try {
    const me = await http<User>('/api/auth/me');
    useAuthStore.getState().setUser(me);
    void registerPushAfterAuth();
  } catch {
    await clearTokens();
  } finally {
    useAuthStore.getState().setReady(true);
  }
}

export async function signIn(email: string, password: string) {
  const res = await http<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
  await setAccessToken(res.accessToken);
  useAuthStore.getState().setUser(res.user);
  void registerPushAfterAuth();
  return res.user;
}

export async function signUp(email: string, password: string, name?: string) {
  const res = await http<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
    skipAuth: true,
  });
  await setAccessToken(res.accessToken);
  useAuthStore.getState().setUser(res.user);
  void registerPushAfterAuth();
  return res.user;
}

export async function signInAnonymously() {
  const res = await http<AuthResponse>('/api/auth/login/anonymous', {
    method: 'POST',
    skipAuth: true,
  });
  await setAccessToken(res.accessToken);
  useAuthStore.getState().setUser(res.user);
  void registerPushAfterAuth();
  return res.user;
}

export async function signOut() {
  // Best-effort: tell the backend to drop our push token before the JWT
  // becomes invalid. Don't block sign-out on its outcome.
  await unregisterPushBeforeSignOut();
  // Server clears the refresh_token cookie; ignore failures so the local
  // session always tears down even if the network is unreachable.
  try {
    await http('/api/auth/logout', { method: 'POST' });
  } catch {
    /* noop */
  }
  await clearTokens();
  useAuthStore.getState().setUser(null);
}

/** Subscribe to the current user only. Most callers want this. */
export function useUser() {
  return useAuthStore((s) => s.user);
}

/** Subscribe to bootstrap-ready flag only. */
export function useAuthReady() {
  return useAuthStore((s) => s.ready);
}

/**
 * Subscribes to the full auth slice. Avoid in widely-rendered components —
 * prefer `useUser` / `useAuthReady` to keep re-renders scoped.
 */
export function useAuth() {
  const user = useUser();
  const ready = useAuthReady();
  return { user, ready };
}
