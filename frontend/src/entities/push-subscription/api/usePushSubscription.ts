import { ref, computed } from 'vue';
import { pushSubscriptionApi } from './pushSubscriptionApi';

// Module-level cache — avoids re-checking SW on every dashboard mount
let checkedOnce = false;

export function usePushSubscription() {
  const isSupported = computed(() => 'Notification' in window && 'PushManager' in window);
  const permission = ref<NotificationPermission>(
    isSupported.value ? Notification.permission : 'denied',
  );
  const registrationId = ref<string | null>(null);
  const isRegistering = ref(false);
  const isSubscribed = ref(false);

  async function checkExistingSubscription(): Promise<void> {
    if (!isSupported.value || checkedOnce) return;
    checkedOnce = true;
    try {
      const sw = await swReadyWithTimeout();
      const sub = await sw.pushManager.getSubscription();
      isSubscribed.value = !!sub && permission.value === 'granted';
    } catch {
      isSubscribed.value = false;
    }
  }

  async function requestPermission(): Promise<boolean> {
    if (!isSupported.value) return false;

    const result = await Notification.requestPermission();
    permission.value = result;

    if (result !== 'granted') return false;

    return subscribe();
  }

  async function subscribe(): Promise<boolean> {
    try {
      isRegistering.value = true;

      const sw = await swReadyWithTimeout();

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('VAPID public key not configured');
        return false;
      }

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      const pushSubscription = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const keys = pushSubscription.toJSON().keys;
      if (!keys?.p256dh || !keys?.auth) return false;

      const result = await pushSubscriptionApi.register({
        endpoint: pushSubscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent,
      });

      registrationId.value = result.id;
      isSubscribed.value = true;
      return true;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return false;
    } finally {
      isRegistering.value = false;
    }
  }

  async function unsubscribe(): Promise<void> {
    try {
      if (registrationId.value) {
        await pushSubscriptionApi.unregister(registrationId.value);
      }
      const sw = await swReadyWithTimeout();
      const sub = await sw.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      registrationId.value = null;
      isSubscribed.value = false;
      permission.value = Notification.permission;
    } catch (error) {
      console.error('Push unsubscribe failed:', error);
    }
  }

  return {
    isSupported,
    permission,
    isRegistering,
    isSubscribed,
    registrationId,
    requestPermission,
    checkExistingSubscription,
    unsubscribe,
  };
}

function swReadyWithTimeout(ms = 5000): Promise<ServiceWorkerRegistration> {
  let timerId: ReturnType<typeof setTimeout>;
  return Promise.race([
    navigator.serviceWorker.ready.then((sw) => {
      clearTimeout(timerId);
      return sw;
    }),
    new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error('Service Worker not available')), ms);
    }),
  ]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
