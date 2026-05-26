import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { http } from '@/shared/api/http';

// Foreground handler — without this, banners/sound/badge are suppressed when
// the app is in the foreground. SDK 56 split the iOS banner flags into
// `shouldShowBanner` / `shouldShowList`; the old `shouldShowAlert` is gone.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface RegisterForPushResult {
  /** Expo push token (`ExponentPushToken[xxx]`) — null when registration didn't happen (simulator, permission denied, missing projectId, backend error). */
  token: string | null;
  reason?: 'not-device' | 'permission-denied' | 'no-project-id' | 'backend-error';
}

/**
 * Idempotent push-token registration. Safe to call after every successful
 * sign-in. Silent on failures so it never blocks the auth flow — the worst
 * outcome of a failure is "this user just won't receive pushes until next
 * launch", which is recoverable.
 */
export async function registerForPushNotifications(): Promise<RegisterForPushResult> {
  // expo-notifications token APIs throw on iOS Simulator / Android Emulator —
  // skip entirely and report cleanly.
  if (!Device.isDevice) {
    return { token: null, reason: 'not-device' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    // Only ask if the system says we still can — otherwise iOS silently
    // returns the prior denial and we burn a permission grant.
    if (!existing.canAskAgain) {
      return { token: null, reason: 'permission-denied' };
    }
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    return { token: null, reason: 'permission-denied' };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    if (__DEV__) console.warn('[push] missing EAS projectId — token request skipped');
    return { token: null, reason: 'no-project-id' };
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  try {
    await http<void>('/api/push-devices', {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      }),
    });
  } catch (err) {
    if (__DEV__) console.warn('[push] backend registration failed', err);
    return { token, reason: 'backend-error' };
  }

  return { token };
}

/**
 * Best-effort cleanup on sign-out so a logged-out device stops receiving
 * pushes for the previous user. Silent on failures (network/permissions)
 * since the local session is being torn down regardless.
 */
export async function unregisterPushNotifications(): Promise<void> {
  if (!Device.isDevice) return;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await http<void>('/api/push-devices/unregister', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  } catch {
    /* silent — session is ending anyway */
  }
}
