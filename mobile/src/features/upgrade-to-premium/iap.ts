import { endConnection, initConnection } from 'expo-iap';
import { Platform } from 'react-native';

export const PRODUCT_IDS = {
  monthly: 'finance_premium_monthly',
  yearly: 'finance_premium_yearly',
} as const;

export type ProductPlan = keyof typeof PRODUCT_IDS;

export const ALL_PRODUCT_SKUS: readonly string[] = [
  PRODUCT_IDS.monthly,
  PRODUCT_IDS.yearly,
];

export function planFromSku(sku: string): ProductPlan | null {
  if (sku === PRODUCT_IDS.monthly) return 'monthly';
  if (sku === PRODUCT_IDS.yearly) return 'yearly';
  return null;
}

let connected = false;
let connectPromise: Promise<void> | null = null;

// IAP is only available on native iOS/Android — keep the rest of the app
// importable from web/dev tools by short-circuiting on web.
function isSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function ensureIAPConnection(): Promise<void> {
  if (!isSupported()) return;
  if (connected) return;
  if (connectPromise) return connectPromise;
  connectPromise = (async () => {
    try {
      await initConnection();
      connected = true;
    } finally {
      connectPromise = null;
    }
  })();
  return connectPromise;
}

// Called from useAuth.signOut so the next user doesn't inherit the previous
// user's store connection / cached entitlement state.
export async function shutdownIAP(): Promise<void> {
  if (!isSupported()) return;
  if (!connected) return;
  try {
    await endConnection();
  } finally {
    connected = false;
  }
}
